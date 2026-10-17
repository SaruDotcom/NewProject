'use client';

import React, { useState } from 'react';
import {
  CreditCard,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
  Zap,
  ArrowRight,
  Download,
  Check,
  X,
  Tag,
  Percent,
  Gift,
  Ticket,
  AlertCircle
} from 'lucide-react';
import { useWholesaler } from '@/context/WholesalerContext';
import api from '@/lib/api';
import { WHOLESALER_PLAN_PRICING } from '@/config/plans';

export default function SubscriptionPage() {
  const { profile, updateSubscription } = useWholesaler();
  const [selectedPlan, setSelectedPlan] = useState<'MONTHLY' | 'ANNUAL'>(
    profile.subscriptionPlan === 'ANNUAL' ? 'ANNUAL' : 'MONTHLY',
  );
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [paymentStep, setPaymentStep] = useState<'SELECT' | 'PROCESSING' | 'SUCCESS'>('SELECT');
  const [selectedUpi, setSelectedUpi] = useState('rajesh@okhdfcbank');

  // Coupon state
  const [couponInput, setCouponInput] = useState('');
  const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    title: string;
    discountAmount: number;
    netPrice: number;
    discountType: string;
    discountValue: number;
  } | null>(null);

  const getBasePrice = (plan: 'MONTHLY' | 'ANNUAL') => WHOLESALER_PLAN_PRICING[plan];

  const handleOpenCheckout = (plan: 'MONTHLY' | 'ANNUAL') => {
    setSelectedPlan(plan);
    setPaymentStep('SELECT');
    setShowCheckoutModal(true);
    // If coupon is already applied, re-validate for new plan price
    if (appliedCoupon) {
      validateCode(appliedCoupon.code, getBasePrice(plan));
    }
  };

  const validateCode = async (codeToTest: string, basePrice: number) => {
    if (!codeToTest.trim()) {
      setCouponError('Please enter a valid promo code');
      return;
    }
    setIsValidatingCoupon(true);
    setCouponError(null);
    try {
      const res = await api.validateCoupon(codeToTest.trim(), basePrice, selectedPlan);
      if (res.success && res.data.valid) {
        setAppliedCoupon({
          code: res.data.code,
          title: res.data.title,
          discountAmount: res.data.discountAmount,
          netPrice: res.data.netPrice,
          discountType: res.data.discountType,
          discountValue: res.data.discountValue,
        });
        setCouponInput(res.data.code);
      } else {
        setAppliedCoupon(null);
        setCouponError('Invalid or expired coupon code');
      }
    } catch (err: any) {
      setAppliedCoupon(null);
      setCouponError(err?.message || 'Failed to apply coupon');
    } finally {
      setIsValidatingCoupon(false);
    }
  };

  const handleApplyCoupon = () => {
    validateCode(couponInput, getBasePrice(selectedPlan));
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponInput('');
    setCouponError(null);
  };

  const handleQuickApply = (code: string) => {
    setCouponInput(code);
    validateCode(code, getBasePrice(selectedPlan));
  };

  const handleSimulatePayment = () => {
    setPaymentStep('PROCESSING');
    setTimeout(() => {
      setPaymentStep('SUCCESS');
      updateSubscription(selectedPlan);
    }, 1800);
  };

  const currentBasePrice = getBasePrice(selectedPlan);
  const finalPrice = appliedCoupon ? appliedCoupon.netPrice : currentBasePrice;
  const savings = appliedCoupon ? appliedCoupon.discountAmount : 0;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-tradeflow-navy">Wholesaler Subscription & Billing</h1>
          <p className="text-xs text-gray-500">Simple, transparent pricing to power your wholesale business operations</p>
        </div>
      </div>

      {/* Active Subscription Status Banner */}
      <div className="p-6 rounded-2xl bg-white border border-tradeflow-gray-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-tradeflow-green-50 text-green-700 flex items-center justify-center font-bold">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-extrabold text-tradeflow-navy">
                {profile.subscriptionPlan === 'ANNUAL'
                  ? 'Annual Pro Plan'
                  : profile.subscriptionPlan === 'MONTHLY'
                    ? 'Monthly Wholesaler Plan'
                    : 'No active plan'}
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-tradeflow-green-50 text-status-success border border-status-success/20">
                {profile.subscriptionStatus === 'ACTIVE' ? 'Active & Auto-Renews' : 'No active subscription'}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Next Billing Date: <span className="font-bold text-tradeflow-navy font-mono">{profile.nextBillingDate || 'Not scheduled'}</span>
            </p>
          </div>
        </div>

        <div className="text-right">
          {profile.subscriptionPlan && (
            <>
              <span className="text-2xl font-black text-green-700">
                ₹{WHOLESALER_PLAN_PRICING[profile.subscriptionPlan].toLocaleString('en-IN')}
              </span>
              <span className="text-xs text-gray-500">
                /{profile.subscriptionPlan === 'ANNUAL' ? 'year' : 'month'}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Special Offers & Coupons Banner */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-tradeflow-navy via-tradeflow-navy-hover to-tradeflow-navy-pressed text-white shadow-lg space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-400 text-tradeflow-navy flex items-center justify-center font-bold shadow-md">
              <Gift className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-extrabold text-base flex items-center gap-2">
                Available Wholesaler Offers & Coupon Codes
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-400 text-tradeflow-navy font-black uppercase tracking-wider">
                  Limited Period
                </span>
              </h3>
              <p className="text-xs text-white/75">
                Apply a promo code at checkout to get instant cash discounts on your subscription!
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
          {/* Offer 1 */}
          <div className="p-3.5 rounded-xl bg-white/10 backdrop-blur-md border border-white/15 flex flex-col justify-between hover:border-amber-400 transition-all">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-black uppercase text-amber-300 tracking-wider">New Wholesaler</span>
                <span className="text-xs font-black text-emerald-400">50% OFF</span>
              </div>
              <div className="font-mono font-bold text-sm text-white">WELCOME50</div>
              <p className="text-[11px] text-gray-300 mt-1">Get 50% discount on any Annual plan payment</p>
            </div>
            <button
              onClick={() => handleQuickApply('WELCOME50')}
              className="mt-3 py-1.5 px-3 bg-amber-400 hover:bg-amber-300 text-tradeflow-navy font-extrabold text-xs rounded-lg transition-all flex items-center justify-center gap-1.5"
            >
              <Ticket className="w-3.5 h-3.5" /> Apply WELCOME50
            </button>
          </div>

          {/* Offer 2 */}
          <div className="p-3.5 rounded-xl bg-white/10 backdrop-blur-md border border-white/15 flex flex-col justify-between hover:border-amber-400 transition-all">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-black uppercase text-amber-300 tracking-wider">Festive Special</span>
                <span className="text-xs font-black text-emerald-400">FLAT ₹200 OFF</span>
              </div>
              <div className="font-mono font-bold text-sm text-white">FESTIVE200</div>
              <p className="text-[11px] text-gray-300 mt-1">Flat ₹200 discount for orders above ₹300</p>
            </div>
            <button
              onClick={() => handleQuickApply('FESTIVE200')}
              className="mt-3 py-1.5 px-3 bg-amber-400 hover:bg-amber-300 text-tradeflow-navy font-extrabold text-xs rounded-lg transition-all flex items-center justify-center gap-1.5"
            >
              <Ticket className="w-3.5 h-3.5" /> Apply FESTIVE200
            </button>
          </div>

          {/* Offer 3 */}
          <div className="p-3.5 rounded-xl bg-white/10 backdrop-blur-md border border-white/15 flex flex-col justify-between hover:border-amber-400 transition-all">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-black uppercase text-amber-300 tracking-wider">Super VIP</span>
                <span className="text-xs font-black text-emerald-400">70% OFF</span>
              </div>
              <div className="font-mono font-bold text-sm text-white">SUPERVIP</div>
              <p className="text-[11px] text-gray-300 mt-1">Exclusive 70% off upgrade discount</p>
            </div>
            <button
              onClick={() => handleQuickApply('SUPERVIP')}
              className="mt-3 py-1.5 px-3 bg-amber-400 hover:bg-amber-300 text-tradeflow-navy font-extrabold text-xs rounded-lg transition-all flex items-center justify-center gap-1.5"
            >
              <Ticket className="w-3.5 h-3.5" /> Apply SUPERVIP
            </button>
          </div>
        </div>
      </div>

      {/* Pricing Plans Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto pt-2">
        {/* Monthly Plan (₹300/mo) */}
        <div className={`p-6 rounded-2xl border transition-all flex flex-col justify-between ${
          profile.subscriptionPlan === 'MONTHLY'
            ? 'bg-white border-2 border-tradeflow-green shadow-lg relative'
            : 'bg-white border-tradeflow-gray-200 shadow-xs hover:border-gray-400'
        }`}>
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-bold text-gray-500 uppercase tracking-wider">Monthly Tier</span>
              {profile.subscriptionPlan === 'MONTHLY' && (
                <span className="text-[10px] font-bold bg-tradeflow-green-50 text-green-700 px-2.5 py-1 rounded-full">
                  Current Plan
                </span>
              )}
            </div>

            <div className="mb-4">
              {appliedCoupon && selectedPlan === 'MONTHLY' ? (
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-black text-status-success">₹{appliedCoupon.netPrice}</span>
                    <span className="text-lg text-gray-400 line-through font-bold">₹{WHOLESALER_PLAN_PRICING.MONTHLY}</span>
                    <span className="text-xs text-gray-500 font-semibold"> / month</span>
                  </div>
                  <span className="inline-block mt-1 px-2.5 py-0.5 rounded-md text-[11px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                    Coupon `{appliedCoupon.code}` Applied (Saved ₹{appliedCoupon.discountAmount})
                  </span>
                </div>
              ) : (
                <div>
                  <span className="text-4xl font-black text-tradeflow-navy">₹{WHOLESALER_PLAN_PRICING.MONTHLY}</span>
                  <span className="text-xs text-gray-500 font-semibold"> / month</span>
                </div>
              )}
            </div>
            <p className="text-xs text-gray-600 mb-6">
              Flexible monthly billing for growing wholesalers. Cancel anytime with zero lock-in.
            </p>

            <ul className="space-y-3 text-xs text-gray-700">
              {[
                'Unlimited Product Catalog & SKUs',
                'Automated Realtime Inventory Sync',
                'Up to 100 Connected B2B Retailers',
                'GST Tax Invoice Generator',
                'Basic Income & Sales Analytics',
              ].map((feature, idx) => (
                <li key={idx} className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-status-success shrink-0" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>

          <button
            onClick={() => handleOpenCheckout('MONTHLY')}
            disabled={profile.subscriptionPlan === 'MONTHLY'}
            className={`w-full mt-8 py-3 rounded-xl font-bold text-xs transition-all ${
              profile.subscriptionPlan === 'MONTHLY'
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-tradeflow-green text-tradeflow-navy hover:bg-tradeflow-green-hover shadow-md'
            }`}
          >
            {profile.subscriptionPlan === 'MONTHLY' ? 'Currently Active' : 'Switch to Monthly Plan'}
          </button>
        </div>

        {/* Annual Plan (₹3000/yr - Best Value) */}
        <div className={`p-6 rounded-2xl border transition-all flex flex-col justify-between ${
          profile.subscriptionPlan === 'ANNUAL'
            ? 'bg-white border-2 border-tradeflow-green shadow-lg relative'
            : 'bg-white border-tradeflow-gray-200 shadow-xs hover:border-gray-400'
        }`}>
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-gray-500 uppercase tracking-wider">Annual Value Tier</span>
                <span className="text-[10px] font-extrabold bg-tradeflow-green-50 text-status-success px-2 py-0.5 rounded-full border border-status-success/20">
                  SAVE 16%+
                </span>
              </div>
              {profile.subscriptionPlan === 'ANNUAL' && (
                <span className="text-[10px] font-bold bg-tradeflow-green-50 text-green-700 px-2.5 py-1 rounded-full">
                  Current Plan
                </span>
              )}
            </div>

            <div className="mb-4">
              {appliedCoupon && selectedPlan === 'ANNUAL' ? (
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-black text-status-success">₹{appliedCoupon.netPrice.toLocaleString()}</span>
                    <span className="text-lg text-gray-400 line-through font-bold">₹{WHOLESALER_PLAN_PRICING.ANNUAL.toLocaleString('en-IN')}</span>
                    <span className="text-xs text-gray-500 font-semibold"> / year</span>
                  </div>
                  <span className="inline-block mt-1 px-2.5 py-0.5 rounded-md text-[11px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                    Coupon `{appliedCoupon.code}` Applied (Saved ₹{appliedCoupon.discountAmount.toLocaleString()})
                  </span>
                </div>
              ) : (
                <div>
                  <span className="text-4xl font-black text-tradeflow-navy">₹{WHOLESALER_PLAN_PRICING.ANNUAL.toLocaleString('en-IN')}</span>
                  <span className="text-xs text-gray-500 font-semibold"> / year</span>
                  <div className="text-[11px] text-status-success font-bold mt-1">Effective ₹250 / month</div>
                </div>
              )}
            </div>
            <p className="text-xs text-gray-600 mb-6">
              Maximum savings & priority feature updates for full enterprise scale.
            </p>

            <ul className="space-y-3 text-xs text-gray-700">
              {[
                'Everything in Monthly Plan',
                'UNLIMITED B2B Retailer Connections',
                'Advanced Profit & Financial Analytics',
                'Dedicated ERP Integration API Key',
                'Priority 24/7 Phone & Email Support',
              ].map((feature, idx) => (
                <li key={idx} className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-status-success shrink-0" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>

          <button
            onClick={() => handleOpenCheckout('ANNUAL')}
            disabled={profile.subscriptionPlan === 'ANNUAL'}
            className={`w-full mt-8 py-3 rounded-xl font-bold text-xs transition-all ${
              profile.subscriptionPlan === 'ANNUAL'
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-tradeflow-green text-tradeflow-navy hover:bg-tradeflow-green-hover shadow-md'
            }`}
          >
            {profile.subscriptionPlan === 'ANNUAL' ? 'Currently Active' : 'Upgrade to Annual Plan (Save ₹600)'}
          </button>
        </div>
      </div>

      {/* Payment Checkout Modal Simulation */}
      {showCheckoutModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 border border-tradeflow-gray-200 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-tradeflow-gray-200">
              <h2 className="text-base font-bold text-tradeflow-navy">Wholesaler Payment Gateway</h2>
              <button onClick={() => setShowCheckoutModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {paymentStep === 'SELECT' && (
              <div className="space-y-4 text-xs">
                {/* Plan Summary Card */}
                <div className="p-3.5 bg-tradeflow-gray-50 rounded-xl border border-tradeflow-gray-200 space-y-2">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-bold text-tradeflow-navy">
                        {selectedPlan === 'ANNUAL' ? 'Annual Subscription (1 Year)' : 'Monthly Subscription (1 Month)'}
                      </div>
                      <div className="text-gray-500">Includes all portal features & ERP sync</div>
                    </div>
                    <div className="text-right">
                      {appliedCoupon ? (
                        <div>
                          <div className="text-xs line-through text-gray-400 font-semibold">
                            ₹{currentBasePrice.toLocaleString()}
                          </div>
                          <div className="font-black text-base text-status-success">
                            ₹{finalPrice.toLocaleString()}
                          </div>
                        </div>
                      ) : (
                        <div className="font-black text-base text-green-700">
                          ₹{currentBasePrice.toLocaleString()}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Coupon Applied Details */}
                  {appliedCoupon && (
                    <div className="pt-2 border-t border-gray-200 flex items-center justify-between text-[11px]">
                      <span className="text-status-success font-extrabold flex items-center gap-1">
                        <Tag className="w-3 h-3" /> Coupon `{appliedCoupon.code}` Applied
                      </span>
                      <span className="font-extrabold text-status-success">
                        - ₹{savings.toLocaleString()} OFF
                      </span>
                    </div>
                  )}
                </div>

                {/* Promo Code Input Field */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <label className="block font-bold text-gray-700 text-[11px] uppercase tracking-wider flex items-center gap-1">
                    <Ticket className="w-3.5 h-3.5 text-green-700" /> Have a Promo / Coupon Code?
                  </label>
                  {appliedCoupon ? (
                    <div className="flex items-center justify-between p-2 bg-emerald-50 border border-emerald-300 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                        <div>
                          <div className="font-mono font-black text-emerald-800">{appliedCoupon.code}</div>
                          <div className="text-[10px] text-emerald-700">{appliedCoupon.title}</div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleRemoveCoupon}
                        className="text-xs text-red-600 hover:text-red-800 font-bold underline"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="e.g. WELCOME50"
                        value={couponInput}
                        onChange={(e) => {
                          setCouponInput(e.target.value.toUpperCase());
                          setCouponError(null);
                        }}
                        className="flex-1 px-3 py-2 border border-tradeflow-gray-200 rounded-lg bg-white font-mono uppercase text-xs focus:ring-2 focus:ring-tradeflow-green focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={handleApplyCoupon}
                        disabled={isValidatingCoupon || !couponInput.trim()}
                        className="px-4 py-2 bg-tradeflow-green hover:bg-tradeflow-green-hover disabled:opacity-50 text-tradeflow-navy font-bold text-xs rounded-lg transition-all"
                      >
                        {isValidatingCoupon ? 'Validating...' : 'Apply Code'}
                      </button>
                    </div>
                  )}

                  {couponError && (
                    <div className="text-[11px] text-red-600 font-semibold flex items-center gap-1 pt-1">
                      <AlertCircle className="w-3.5 h-3.5" /> {couponError}
                    </div>
                  )}
                </div>

                {/* Payment Method */}
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Select Payment Method</label>
                  <div className="p-3 border border-tradeflow-green rounded-xl bg-tradeflow-green-50 flex items-center justify-between">
                    <span className="font-bold text-green-700">BHIM UPI / GooglePay / PhonePe</span>
                    <Check className="w-4 h-4 text-green-700" />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">UPI ID</label>
                  <input
                    type="text"
                    value={selectedUpi}
                    onChange={(e) => setSelectedUpi(e.target.value)}
                    className="w-full px-3 py-2 border border-tradeflow-gray-200 rounded-xl bg-tradeflow-gray-50 font-mono"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleSimulatePayment}
                  className="w-full py-3 bg-tradeflow-green text-tradeflow-navy font-bold rounded-xl hover:bg-tradeflow-green-hover transition-all shadow-md flex items-center justify-center gap-2"
                >
                  <span>Pay ₹{finalPrice.toLocaleString()} & Activate Plan</span>
                  {appliedCoupon && (
                    <span className="text-[10px] bg-emerald-500 text-white px-2 py-0.5 rounded-full font-black">
                      (Saved ₹{savings.toLocaleString()})
                    </span>
                  )}
                </button>
              </div>
            )}

            {paymentStep === 'PROCESSING' && (
              <div className="py-8 text-center space-y-3">
                <div className="w-12 h-12 border-4 border-tradeflow-green border-t-transparent rounded-full animate-spin mx-auto" />
                <div className="font-bold text-sm text-tradeflow-navy">Processing UPI Payment Request...</div>
                <div className="text-xs text-gray-500">
                  Communicating with bank servers for instant settlement of ₹{finalPrice.toLocaleString()}
                </div>
              </div>
            )}

            {paymentStep === 'SUCCESS' && (
              <div className="py-6 text-center space-y-3">
                <div className="w-14 h-14 bg-tradeflow-green-50 text-status-success rounded-full flex items-center justify-center mx-auto font-bold">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div className="font-extrabold text-base text-tradeflow-navy">Payment Successful!</div>
                <p className="text-xs text-gray-600">
                  Your Wholesaler {selectedPlan === 'ANNUAL' ? 'Annual' : 'Monthly'} Subscription is now active.
                </p>
                {appliedCoupon && (
                  <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-bold">
                    You saved ₹{savings.toLocaleString()} using coupon code `{appliedCoupon.code}`!
                  </div>
                )}
                <button
                  onClick={() => setShowCheckoutModal(false)}
                  className="px-6 py-2 bg-status-success text-white font-bold text-xs rounded-xl hover:bg-tradeflow-green-hover"
                >
                  Return to Dashboard
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
