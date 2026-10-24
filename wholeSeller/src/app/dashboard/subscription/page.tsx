import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, CreditCard, LoaderCircle, ShieldCheck, Sparkles } from 'lucide-react';
import { useWholesaler } from '@/context/WholesalerContext';
import api, { type SubscriptionPlan, type WholesalerSubscription } from '@/lib/api';

type RazorpayResponse = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

type RazorpayInstance = {
  open: () => void;
  on: (event: string, callback: (response: { error?: { description?: string } }) => void) => void;
};

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
  }
}

function loadRazorpay(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.dataset.razorpayCheckout = 'true';
    script.addEventListener('load', () => resolve(), { once: true });
    script.addEventListener('error', () => reject(new Error('Unable to load Razorpay checkout. Please try again.')), { once: true });
    document.body.appendChild(script);
  });
}

function formatDate(date?: string) {
  if (!date) return 'Not scheduled';
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? 'Not scheduled' : parsed.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function billingLabel(period: SubscriptionPlan['billingPeriod'] | WholesalerSubscription['billingPeriod']) {
  return period === 'YEARLY' ? 'year' : 'month';
}

export default function SubscriptionPage() {
  const { profile, updateSubscription } = useWholesaler();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [subscription, setSubscription] = useState<WholesalerSubscription | null>(null);
  const [paymentConfigured, setPaymentConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submittingPlanId, setSubmittingPlanId] = useState('');
  const [error, setError] = useState('');

  const refreshSubscription = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.getWholesalerSubscription();
      setPlans(response.data.plans);
      setSubscription(response.data.subscription);
      setPaymentConfigured(response.data.payment.configured);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load subscription details.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshSubscription();
  }, [refreshSubscription]);

  const beginPayment = async (plan: SubscriptionPlan) => {
    setSubmittingPlanId(plan.id);
    setError('');
    try {
      const orderResponse = await api.createSubscriptionOrder(plan.id);
      if (!orderResponse.data.configured || !orderResponse.data.keyId || !orderResponse.data.order) {
        setPaymentConfigured(false);
        setError('Online payment is not configured');
        setSubmittingPlanId('');
        return;
      }

      await loadRazorpay();
      if (!window.Razorpay) throw new Error('Razorpay checkout is unavailable. Please try again.');
      const order = orderResponse.data.order;
      const checkout = new window.Razorpay({
        key: orderResponse.data.keyId,
        amount: order.amount,
        currency: order.currency,
        name: 'TradeFlow',
        description: `${plan.name} · ${billingLabel(plan.billingPeriod)}`,
        order_id: order.id,
        prefill: {
          name: profile.ownerName,
          email: profile.email,
          contact: profile.phone,
        },
        theme: { color: '#20A66A' },
        handler: async (payment: RazorpayResponse) => {
          try {
            const verified = await api.verifySubscriptionPayment(payment);
            setSubscription(verified.data.subscription);
            updateSubscription(
              verified.data.subscription.billingPeriod === 'YEARLY' ? 'ANNUAL' : 'MONTHLY',
              verified.data.subscription.renewalDate,
            );
            window.dispatchEvent(new Event('wholesaler-subscription-updated'));
            setError('');
          } catch (verificationError) {
            setError(verificationError instanceof Error ? verificationError.message : 'Payment verification failed.');
          } finally {
            setSubmittingPlanId('');
          }
        },
        modal: {
          ondismiss: () => setSubmittingPlanId(''),
        },
      });
      checkout.on('payment.failed', (response) => {
        setError(response.error?.description || 'Payment failed. Please try again.');
        setSubmittingPlanId('');
      });
      checkout.open();
    } catch (paymentError) {
      setError(paymentError instanceof Error ? paymentError.message : 'Unable to start payment.');
      setSubmittingPlanId('');
    }
  };

  const isSubscriptionActive = subscription?.status === 'ACTIVE' && new Date(subscription.renewalDate) > new Date();

  if (loading) {
    return <div className="flex min-h-64 items-center justify-center gap-2 text-sm text-gray-500"><LoaderCircle className="h-4 w-4 animate-spin" /> Loading subscription plans...</div>;
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header>
        <p className="text-xs font-extrabold uppercase tracking-wide text-tradeflow-green">Billing</p>
        <h1 className="mt-1 text-2xl font-extrabold text-tradeflow-navy">Subscription</h1>
        <p className="mt-1 text-sm text-gray-500">Choose the plan and billing period that work for your business.</p>
      </header>

      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {!paymentConfigured && <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">Online payment is not configured</p>}

      {subscription && (
        <section className="rounded-2xl border border-tradeflow-gray-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Current subscription</p>
              <h2 className="mt-1 text-lg font-extrabold text-tradeflow-navy">{subscription.planName}</h2>
              <p className="mt-1 text-sm text-gray-600">
                ₹{subscription.amount.toLocaleString('en-IN')} / {billingLabel(subscription.billingPeriod)} · {subscription.status}
              </p>
            </div>
            <div className="text-sm">
              <p className="text-xs text-gray-500">Ends / renews on</p>
              <p className="font-bold text-tradeflow-navy">{formatDate(subscription.renewalDate)}</p>
            </div>
          </div>
        </section>
      )}

      {!plans.length && (
        <p role="status" className="rounded-xl border border-tradeflow-gray-200 bg-white p-6 text-center text-sm text-gray-600">
          {error || 'No subscription plans are currently available.'}
        </p>
      )}

      <div className="grid items-stretch gap-5 md:grid-cols-2 xl:grid-cols-3">
        {plans.map((plan) => {
          const isCurrentPlan = Boolean(subscription && String(subscription.planId) === plan.id);
          const currentPlanActive = isCurrentPlan && isSubscriptionActive;
          return (
            <article
              key={plan.id}
              className={`relative flex flex-col overflow-hidden rounded-2xl border bg-white shadow-sm ${
                plan.recommended ? 'border-tradeflow-green ring-2 ring-tradeflow-green/20' : 'border-tradeflow-gray-200'
              }`}
            >
              {plan.recommended && (
                <div className="flex items-center gap-2 bg-tradeflow-green px-5 py-2 text-xs font-extrabold uppercase tracking-wide text-white">
                  <Sparkles className="h-4 w-4" /> Recommended
                </div>
              )}
              <div className="flex-1 p-5 sm:p-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-extrabold text-tradeflow-navy">{plan.name}</h2>
                    <p className="mt-2 min-h-10 text-sm text-gray-500">{plan.description}</p>
                  </div>
                  {currentPlanActive && <span className="shrink-0 rounded-full bg-tradeflow-green/10 px-3 py-1 text-xs font-bold text-tradeflow-green">Current Plan</span>}
                </div>
                <p className="mt-5 text-3xl font-black text-tradeflow-navy">
                  ₹{plan.price.toLocaleString('en-IN')}
                  <span className="ml-1 text-sm font-semibold text-gray-500">/ {billingLabel(plan.billingPeriod)}</span>
                </p>
                {isCurrentPlan && subscription && (
                  <p className="mt-2 text-xs font-semibold text-gray-600">
                    Current price: ₹{subscription.amount.toLocaleString('en-IN')} / {billingLabel(subscription.billingPeriod)} through {formatDate(subscription.renewalDate)}
                  </p>
                )}
                <ul className="mt-6 space-y-3">
                  {plan.features.filter((feature) => feature.enabled).map((feature) => (
                    <li key={feature.id} className="flex items-start gap-2 text-sm text-gray-700">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-status-success" />
                      <span>{feature.title}</span>
                    </li>
                  ))}
                </ul>
                {plan.taxNote && <p className="mt-5 text-xs text-gray-500">{plan.taxNote}</p>}
              </div>
              <div className="border-t border-tradeflow-gray-200 p-5">
                {currentPlanActive ? (
                  <div className="flex items-center justify-center gap-2 rounded-xl bg-tradeflow-green/10 px-4 py-3 text-sm font-extrabold text-tradeflow-green">
                    <ShieldCheck className="h-4 w-4" /> Current Plan · Ends {formatDate(subscription?.renewalDate)}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => void beginPayment(plan)}
                    disabled={Boolean(submittingPlanId) || !paymentConfigured}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-tradeflow-green px-4 py-3 text-sm font-extrabold text-tradeflow-navy shadow-sm transition hover:bg-tradeflow-green-hover disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <CreditCard className="h-4 w-4" />
                    {submittingPlanId === plan.id ? 'Starting secure checkout...' : isCurrentPlan ? 'Renew' : 'Subscribe'}
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
