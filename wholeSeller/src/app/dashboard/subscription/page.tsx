import { useCallback, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  CreditCard,
  LoaderCircle,
  ShieldCheck,
  Sparkles,
  AlertCircle,
  Copy,
  Check,
  RefreshCw,
  Clock,
  Calendar,
  XCircle,
  Receipt,
  ArrowRight,
  X,
  Building2,
  Lock,
} from 'lucide-react';
import { useWholesaler } from '@/context/WholesalerContext';
import api, {
  type SubscriptionPlan,
  type WholesalerSubscription,
  type SubscriptionPaymentRecord,
} from '@/lib/api';
import { getWholesalerId, wholesalerQueryKeys } from '@/lib/query-client';

type RazorpayResponse = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

type RazorpayInstance = {
  open: () => void;
  on: (event: string, callback: (response: { error?: { description?: string; metadata?: { payment_id?: string }; source?: string } }) => void) => void;
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
    script.addEventListener('error', () => reject(new Error('Unable to load Razorpay checkout. Please check your internet connection and try again.')), { once: true });
    document.body.appendChild(script);
  });
}

function formatDate(date?: string | Date | null) {
  if (!date) return '—';
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatDateTime(date?: string | Date | null) {
  if (!date) return '—';
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function billingLabel(period: SubscriptionPlan['billingPeriod'] | WholesalerSubscription['billingPeriod']) {
  return period === 'YEARLY' ? 'year' : 'month';
}

function durationLabel(period: SubscriptionPlan['billingPeriod'] | WholesalerSubscription['billingPeriod']) {
  return period === 'YEARLY' ? '1 Year' : '1 Month';
}

function getDaysRemaining(renewalDate?: string) {
  if (!renewalDate) return 0;
  const target = new Date(renewalDate).getTime();
  const now = Date.now();
  const diff = target - now;
  if (diff <= 0) return 0;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function formatPaymentMethod(method?: string) {
  if (!method) return 'Razorpay';
  const m = method.toLowerCase();
  if (m === 'upi') return 'UPI (GPay / PhonePe / Paytm)';
  if (m === 'card') return 'Debit / Credit Card';
  if (m === 'netbanking') return 'Net Banking';
  if (m === 'wallet') return 'Digital Wallet';
  return method.toUpperCase();
}

function calculateTaxBreakdown(totalAmount: number) {
  // Assuming total is inclusive of 18% GST (standard Indian SaaS rate)
  const basePrice = Math.round((totalAmount / 1.18) * 100) / 100;
  const gstAmount = Math.round((totalAmount - basePrice) * 100) / 100;
  const cgst = Math.round((gstAmount / 2) * 100) / 100;
  const sgst = Math.round((gstAmount - cgst) * 100) / 100;
  return { basePrice, gstAmount, cgst, sgst, totalAmount };
}

export default function SubscriptionPage() {
  const { profile } = useWholesaler();
  const queryClient = useQueryClient();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [subscription, setSubscription] = useState<WholesalerSubscription | null>(null);
  const [payments, setPayments] = useState<SubscriptionPaymentRecord[]>([]);
  const [paymentConfigured, setPaymentConfigured] = useState(true);
  const [loading, setLoading] = useState(true);
  const [submittingPlanId, setSubmittingPlanId] = useState('');
  const [selectedPlanForReview, setSelectedPlanForReview] = useState<SubscriptionPlan | null>(null);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const hasPendingApproval = payments.some(
    (payment) => payment.status === 'PAID' && payment.approvalStatus === 'PENDING',
  );

  const refreshSubscription = useCallback(async (force = false) => {
    const queryKey = wholesalerQueryKeys.resource(profile.id || getWholesalerId(), 'subscription');
    const cached = queryClient.getQueryData(queryKey);
    if (!cached) setLoading(true);
    setError('');
    try {
      if (force) {
        await queryClient.invalidateQueries({ queryKey, refetchType: 'none' });
      }
      const response = await queryClient.fetchQuery({
        queryKey,
        queryFn: () => api.getWholesalerSubscription(),
        staleTime: 30_000,
      });
      setPlans(response.data.plans || []);
      setSubscription(response.data.subscription);
      setPayments(response.data.payments || []);
      setPaymentConfigured(response.data.payment?.configured ?? true);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load subscription details.');
    } finally {
      setLoading(false);
    }
  }, [profile.id, queryClient]);

  useEffect(() => {
    void refreshSubscription();
  }, [refreshSubscription]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleStartCheckout = (plan: SubscriptionPlan) => {
    setSelectedPlanForReview(plan);
    setError('');
    setSuccessMessage('');
  };

  const handleConfirmAndPay = async (plan: SubscriptionPlan) => {
    setSelectedPlanForReview(null);
    setSubmittingPlanId(plan.id);
    setError('');
    setSuccessMessage('');

    try {
      const orderResponse = await api.createSubscriptionOrder(plan.id);
      if (!orderResponse.data.configured || !orderResponse.data.keyId || !orderResponse.data.order) {
        setPaymentConfigured(false);
        setError('Online payment is not configured on the platform. Please contact platform support.');
        setSubmittingPlanId('');
        return;
      }

      await loadRazorpay();
      if (!window.Razorpay) {
        throw new Error('Razorpay checkout is unavailable. Please check your browser or try again.');
      }

      const order = orderResponse.data.order;
      let isPaymentHandled = false;

      const checkout = new window.Razorpay({
        key: orderResponse.data.keyId,
        amount: order.amount,
        currency: order.currency || 'INR',
        name: 'Vyapar Dwaar',
        description: `${plan.name} · ${durationLabel(plan.billingPeriod)}`,
        order_id: order.id,
        method: {
          upi: true,
          card: true,
          netbanking: true,
          wallet: true,
        },
        prefill: {
          name: profile.ownerName || profile.businessName || '',
          email: profile.email || '',
          contact: profile.phone || '',
        },
        notes: {
          planId: plan.id,
          planName: plan.name,
          billingPeriod: plan.billingPeriod,
        },
        theme: { color: '#6D1D36' },
        handler: async (response: RazorpayResponse) => {
          isPaymentHandled = true;
          try {
            const verified = await api.verifySubscriptionPayment(response);
            setSubscription(verified.data.subscription);
            window.dispatchEvent(new Event('wholesaler-subscription-updated'));
            setSuccessMessage(`Payment received for ${plan.name}. Your subscription will activate after Superadmin approval and KYC approval.`);
            setError('');
            void refreshSubscription(true);
          } catch (verificationError) {
            setError(verificationError instanceof Error ? verificationError.message : 'Payment verification failed.');
            void refreshSubscription(true);
          } finally {
            setSubmittingPlanId('');
          }
        },
        modal: {
          ondismiss: async () => {
            setSubmittingPlanId('');
            if (!isPaymentHandled) {
              try {
                await api.cancelSubscriptionPayment({
                  razorpayOrderId: order.id,
                  reason: 'Checkout window dismissed by user',
                });
                void refreshSubscription(true);
              } catch (cancelErr) {
                console.warn('Could not record checkout dismissal:', cancelErr);
              }
            }
          },
        },
      });

      checkout.on('payment.failed', async (failedResponse) => {
        isPaymentHandled = true;
        const failureReason = failedResponse.error?.description || 'Payment failed or was declined by the bank.';
        setError(failureReason);
        setSubmittingPlanId('');
        try {
          await api.failSubscriptionPayment({
            razorpayOrderId: order.id,
            razorpayPaymentId: failedResponse.error?.metadata?.payment_id || '',
            errorReason: failureReason,
            paymentMethod: failedResponse.error?.source || '',
          });
          void refreshSubscription();
        } catch (failErr) {
          console.warn('Could not record payment failure:', failErr);
        }
      });

      checkout.open();
    } catch (paymentError) {
      setError(paymentError instanceof Error ? paymentError.message : 'Unable to initiate Razorpay checkout.');
      setSubmittingPlanId('');
    }
  };

  const isSubscriptionActive = subscription?.status === 'ACTIVE' && new Date(subscription.renewalDate) > new Date();
  const daysLeft = isSubscriptionActive ? getDaysRemaining(subscription?.renewalDate) : 0;

  if (loading) {
    return (
      <div className="flex min-h-64 items-center justify-center gap-2 text-sm text-gray-500">
        <LoaderCircle className="h-5 w-5 animate-spin text-tradeflow-green" />
        <span>Loading subscription plans and payment history...</span>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8 pb-12">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-extrabold uppercase tracking-wide text-tradeflow-green">Billing & Membership</span>
            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${paymentConfigured ? 'bg-tradeflow-green/10 text-tradeflow-green' : 'bg-amber-100 text-amber-800'}`}>
              {paymentConfigured ? <ShieldCheck className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
              {paymentConfigured ? 'Razorpay Configured' : 'Razorpay Not Configured'}
            </span>
          </div>
          <h1 className="mt-1 text-2xl font-extrabold text-tradeflow-navy">Wholesaler Subscription Plans</h1>
          <p className="mt-1 text-sm text-gray-500">
            An approved subscription and approved KYC are required to use wholesaler business features.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refreshSubscription(true)}
          className="inline-flex items-center gap-1.5 self-start sm:self-auto rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50 transition"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Refresh Status
        </button>
      </header>

      {/* Notifications */}
      {successMessage && (
        <div role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900 shadow-sm flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
          <span>{successMessage}</span>
        </div>
      )}
      {error && (
        <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-900 shadow-sm flex items-center gap-3">
          <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}
      {hasPendingApproval && (
        <div role="status" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900 shadow-sm flex items-center gap-3">
          <Clock className="h-5 w-5 shrink-0 text-amber-700" />
          <span>Your payment is confirmed and awaiting Superadmin approval. Business features remain locked until both your subscription and KYC are approved.</span>
        </div>
      )}
      {!paymentConfigured && (
        <div role="status" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900 shadow-sm flex items-center gap-3">
          <AlertCircle className="h-5 w-5 shrink-0 text-amber-600" />
          <div>
            <p className="font-bold">Razorpay payment setup is incomplete</p>
            <p className="text-xs text-amber-800 font-normal mt-0.5">
              Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to the backend hosting environment using the matching Razorpay test or live credentials, then restart or redeploy the backend. Never add these secrets to frontend code.
            </p>
          </div>
        </div>
      )}

      {/* Current Subscription Hero Banner */}
      {subscription && (
        <section className={`rounded-2xl border p-6 shadow-sm transition-all ${isSubscriptionActive ? 'border-emerald-200 bg-gradient-to-br from-white to-emerald-50/40' : 'border-amber-200 bg-amber-50/30'}`}>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2.5">
                <span className="text-xs font-extrabold uppercase tracking-wide text-gray-500">Active Membership</span>
                {isSubscriptionActive ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-extrabold text-emerald-800">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Active Plan
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-3 py-1 text-xs font-extrabold text-red-800">
                    <XCircle className="h-3.5 w-3.5 text-red-600" /> Expired
                  </span>
                )}
                {isSubscriptionActive && daysLeft > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-800">
                    <Clock className="h-3 w-3" /> {daysLeft} day{daysLeft === 1 ? '' : 's'} left
                  </span>
                )}
              </div>
              <h2 className="text-2xl font-black text-tradeflow-navy">{subscription.planName}</h2>
              <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-gray-600">
                <span>
                  <strong>Price:</strong> ₹{subscription.amount.toLocaleString('en-IN')} / {billingLabel(subscription.billingPeriod)}
                </span>
                <span>•</span>
                <span>
                  <strong>Billing Duration:</strong> {durationLabel(subscription.billingPeriod)}
                </span>
                {subscription.paymentMethod && (
                  <>
                    <span>•</span>
                    <span>
                      <strong>Payment Mode:</strong> {formatPaymentMethod(subscription.paymentMethod)}
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 self-start md:self-auto border-t md:border-t-0 md:border-l border-gray-200 pt-4 md:pt-0 md:pl-6">
              <div>
                <p className="text-xs text-gray-500 font-medium">Started Date</p>
                <p className="text-sm font-bold text-gray-800">{formatDate(subscription.startedAt)}</p>
              </div>
              <div className="hidden sm:block text-gray-300">→</div>
              <div>
                <p className="text-xs text-gray-500 font-medium">Renews / Expires On</p>
                <p className="text-sm font-bold text-tradeflow-navy">{formatDate(subscription.renewalDate)}</p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Available Plans Grid */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-bold text-tradeflow-navy">Select a Subscription Plan</h2>
          <p className="text-xs text-gray-500">
            Choose a plan to request activation. A confirmed payment is reviewed by Superadmin before the plan becomes active.
          </p>
        </div>

        {!plans.length && (
          <div role="status" className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-600">
            No subscription plans are currently available. Please check back later.
          </div>
        )}

        <div className="grid items-stretch gap-4 sm:grid-cols-2 2xl:grid-cols-4">
          {plans.map((plan) => {
            const isCurrentPlan = Boolean(subscription && String(subscription.planId) === plan.id);
            const currentPlanActive = isCurrentPlan && isSubscriptionActive;

            return (
              <article
                key={plan.id}
                className={`relative flex flex-col justify-between overflow-hidden rounded-2xl border bg-white shadow-sm transition-all hover:shadow-md ${
                  plan.recommended
                    ? 'border-[#7A233D] ring-2 ring-[#7A233D]/10'
                    : 'border-tradeflow-gray-200'
                }`}
              >
                <div className="flex-1 space-y-4 p-4">
                  {/* Plan Title & Badge */}
                  <div className="flex min-h-14 items-start justify-between gap-2">
                    <div>
                      <h3 className="text-base font-black text-[#5D1D32]">{plan.name}</h3>
                      <p className="mt-1 text-xs leading-5 text-gray-500">{plan.description}</p>
                    </div>
                    {plan.recommended && (
                      <span className="shrink-0 rounded-full bg-[#F7EDE3] px-2 py-1 text-[10px] font-bold text-[#6D1D36]">
                        Popular
                      </span>
                    )}
                  </div>

                  {/* Price & Duration */}
                  <div className="rounded-xl border border-[#E8D8C8] bg-[#FBF5EA] p-3">
                    <div className="flex flex-wrap items-baseline gap-x-1.5">
                      <span className="text-3xl font-black text-[#5D1D32]">
                        ₹{plan.price.toLocaleString('en-IN')}
                      </span>
                      <span className="text-xs font-semibold text-[#6D514C]">/ {durationLabel(plan.billingPeriod)}</span>
                    </div>
                    <p className="mt-1 text-[11px] font-medium text-[#6D514C]">Valid for {durationLabel(plan.billingPeriod)}</p>
                  </div>

                  {/* Features List */}
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Included Features</p>
                    <ul className="space-y-1.5 text-[11px] text-gray-700">
                      {plan.features.filter((f) => f.enabled).map((feature) => (
                        <li key={feature.id} className="flex items-start gap-2">
                          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#8A2C45]" />
                          <span>{feature.title}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Footer Action & Supported Payment Methods */}
                <div className="space-y-3 border-t border-[#E8D8C8] bg-[#FBF5EA]/70 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-gray-500">
                    <span className="flex items-center gap-1">
                      <CreditCard className="h-3.5 w-3.5 text-gray-400" /> UPI, Cards, Net Banking
                    </span>
                    <span className="flex items-center gap-1 font-semibold text-[#6D1D36]">
                      <Lock className="h-3 w-3" /> Razorpay
                    </span>
                  </div>

                  {currentPlanActive ? (
                    <button
                      type="button"
                      disabled
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-100 px-3 py-2.5 text-xs font-bold text-emerald-800 cursor-default"
                    >
                      <CheckCircle2 className="h-4 w-4" /> Current Plan Active
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleStartCheckout(plan)}
                      disabled={Boolean(submittingPlanId) || !paymentConfigured || hasPendingApproval}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#6D1D36] px-3 py-2.5 text-xs font-extrabold text-white shadow-sm transition hover:bg-[#541529] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer active:scale-[0.99]"
                    >
                      {submittingPlanId === plan.id ? (
                        <>
                          <LoaderCircle className="h-4 w-4 animate-spin" />
                          <span>Opening Razorpay...</span>
                        </>
                      ) : (
                        <>
                          <CreditCard className="h-4 w-4" />
                          <span>{hasPendingApproval ? 'Awaiting Approval' : isCurrentPlan ? 'Renew Plan' : 'Choose Plan'}</span>
                          <ArrowRight className="h-4 w-4" />
                        </>
                      )}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* Plan Review & Confirmation Modal */}
      {selectedPlanForReview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-gray-50/70">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-tradeflow-green/20 text-tradeflow-navy font-bold">
                  <Receipt className="h-5 w-5 text-emerald-700" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-tradeflow-navy">Subscription Order Review</h3>
                  <p className="text-xs text-gray-500">Verify plan details and taxes before proceeding</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPlanForReview(null)}
                className="rounded-lg p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition cursor-pointer"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-5">
              {/* Plan Summary */}
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-800">Selected Plan</span>
                    <h4 className="text-lg font-black text-tradeflow-navy">{selectedPlanForReview.name}</h4>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-emerald-700 shadow-xs border border-emerald-200">
                    {durationLabel(selectedPlanForReview.billingPeriod)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-gray-600">{selectedPlanForReview.description}</p>
              </div>

              {/* Tax Invoice Breakdown */}
              <div className="rounded-2xl border border-gray-200 p-4 space-y-2.5 text-xs">
                <p className="font-bold text-tradeflow-navy text-xs uppercase tracking-wide">Price & Tax Breakdown</p>
                {(() => {
                  const taxes = calculateTaxBreakdown(selectedPlanForReview.price);
                  return (
                    <>
                      <div className="flex justify-between text-gray-600">
                        <span>Base Subscription Fee:</span>
                        <span className="font-mono font-medium">₹{taxes.basePrice.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-gray-600">
                        <span>CGST (9%):</span>
                        <span className="font-mono font-medium">₹{taxes.cgst.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-gray-600">
                        <span>SGST (9%):</span>
                        <span className="font-mono font-medium">₹{taxes.sgst.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm font-black text-tradeflow-navy border-t border-gray-200 pt-2.5">
                        <span>Total Payable Amount:</span>
                        <span className="text-emerald-700 font-mono">₹{taxes.totalAmount.toFixed(2)}</span>
                      </div>
                    </>
                  );
                })()}
              </div>

              {/* Supported Payment Methods Note */}
              <div className="rounded-2xl bg-gray-50 p-3.5 border border-gray-200 text-xs space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold text-gray-800">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  <span>Supported Payment Methods via Razorpay</span>
                </div>
                <p className="text-[11px] text-gray-600">
                  • <strong>UPI:</strong> Google Pay, PhonePe, Paytm, BHIM, Any UPI App
                </p>
                <p className="text-[11px] text-gray-600">
                  • <strong>Cards:</strong> Visa, MasterCard, RuPay, Maestro (Debit & Credit Cards)
                </p>
                <p className="text-[11px] text-gray-600">
                  • <strong>Net Banking:</strong> HDFC, ICICI, SBI, Axis, Kotak & 50+ other Indian banks
                </p>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-100 bg-gray-50/70">
              <button
                type="button"
                onClick={() => setSelectedPlanForReview(null)}
                className="px-4 py-2.5 rounded-xl border border-gray-300 text-xs font-bold text-gray-700 hover:bg-gray-100 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmAndPay(selectedPlanForReview)}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-tradeflow-green text-tradeflow-navy text-xs font-extrabold hover:bg-tradeflow-green-hover transition shadow-sm cursor-pointer"
              >
                <CreditCard className="h-4 w-4" />
                <span>Pay ₹{selectedPlanForReview.price.toLocaleString('en-IN')} with Razorpay</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Subscription Payment History Table */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-tradeflow-green" />
            <h2 className="text-lg font-bold text-tradeflow-navy">Subscription Payment History</h2>
          </div>
          <span className="text-xs font-semibold text-gray-500">
            {payments.length} {payments.length === 1 ? 'transaction' : 'transactions'} recorded
          </span>
        </div>

        <div className="overflow-hidden rounded-2xl border border-tradeflow-gray-200 bg-white shadow-sm">
          {!payments.length ? (
            <div className="p-8 text-center text-sm text-gray-500">
              No subscription payments recorded yet. When you subscribe, all transaction details and tax invoices will appear here.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-gray-200 bg-gray-50/80 text-[11px] font-extrabold uppercase tracking-wider text-gray-500">
                  <tr>
                    <th className="px-5 py-3.5">Date & Time</th>
                    <th className="px-5 py-3.5">Plan Name</th>
                    <th className="px-5 py-3.5">Billing Period</th>
                    <th className="px-5 py-3.5">Amount (₹)</th>
                    <th className="px-5 py-3.5">Payment Method</th>
                    <th className="px-5 py-3.5">Razorpay Order & Payment ID</th>
                    <th className="px-5 py-3.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-gray-700">
                  {payments.map((p) => {
                    const approvalPending = p.status === 'PAID' && p.approvalStatus === 'PENDING';
                    const statusLabel = approvalPending ? 'PENDING APPROVAL' : p.status;
                    const statusClass =
                      approvalPending
                        ? 'bg-amber-100 text-amber-800'
                        : p.status === 'PAID'
                        ? 'bg-emerald-100 text-emerald-800'
                        : p.status === 'PENDING'
                        ? 'bg-amber-100 text-amber-800'
                        : p.status === 'FAILED'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-gray-100 text-gray-700';

                    return (
                      <tr key={p.id} className="hover:bg-gray-50/60 transition-colors">
                        <td className="px-5 py-3.5 font-medium whitespace-nowrap text-gray-900">
                          {formatDateTime(p.createdAt)}
                        </td>
                        <td className="px-5 py-3.5 font-bold text-tradeflow-navy whitespace-nowrap">
                          {p.planName}
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          {p.billingPeriod === 'YEARLY' ? 'Annual (365 Days)' : 'Monthly (30 Days)'}
                        </td>
                        <td className="px-5 py-3.5 font-bold text-gray-900 whitespace-nowrap font-mono">
                          ₹{p.amount.toLocaleString('en-IN')}
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 font-medium text-gray-800">
                            <CreditCard className="h-3.5 w-3.5 text-gray-400" />
                            {formatPaymentMethod(p.paymentMethod)}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap space-y-0.5 font-mono text-[11px]">
                          <div className="flex items-center gap-1.5">
                            <span className="text-gray-400 font-sans">Order:</span>
                            <span className="text-gray-700">{p.razorpayOrderId}</span>
                            <button
                              type="button"
                              onClick={() => handleCopy(p.razorpayOrderId)}
                              className="text-gray-400 hover:text-gray-700 cursor-pointer"
                              title="Copy Order ID"
                            >
                              {copiedId === p.razorpayOrderId ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                            </button>
                          </div>
                          {p.razorpayPaymentId && (
                            <div className="flex items-center gap-1.5">
                              <span className="text-gray-400 font-sans">Payment:</span>
                              <span className="text-gray-700">{p.razorpayPaymentId}</span>
                              <button
                                type="button"
                                onClick={() => handleCopy(p.razorpayPaymentId!)}
                                className="text-gray-400 hover:text-gray-700 cursor-pointer"
                                title="Copy Payment ID"
                              >
                                {copiedId === p.razorpayPaymentId ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                              </button>
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${statusClass}`}>
                            {p.status === 'PAID' && <CheckCircle2 className="h-3 w-3" />}
                            {p.status === 'PENDING' && <Clock className="h-3 w-3" />}
                            {p.status === 'FAILED' && <XCircle className="h-3 w-3" />}
                            {p.status === 'CANCELLED' && <X className="h-3 w-3" />}
                            {statusLabel}
                          </span>
                          {p.errorReason && (
                            <p className="text-[10px] text-red-600 mt-1 max-w-[180px] truncate" title={p.errorReason}>
                              {p.errorReason}
                            </p>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
