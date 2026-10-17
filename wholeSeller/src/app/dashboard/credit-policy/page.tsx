'use client';

import React, { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock,
  Coins,
  CreditCard,
  DollarSign,
  Edit2,
  HandCoins,
  Info,
  RefreshCw,
  Search,
  ShieldAlert,
  Users,
  X,
} from 'lucide-react';
import api from '@/lib/api';
import { useWholesaler } from '@/context/WholesalerContext';
import { wholesalerQueryKeys } from '@/lib/query-client';

type CreditPolicy = {
  creditEnabled: boolean;
  allowCOD: boolean;
  defaultCreditLimit: number;
  creditPeriodDays: number;
  lateFeePercent: number;
  minOrderForCredit: number;
};

type CreditRetailerItem = {
  relationshipId: string;
  retailerId: string;
  businessName: string;
  ownerName: string;
  phone: string;
  email: string;
  customCreditLimit: number | null;
  effectiveLimit: number;
  currentOutstandingAmount: number;
  availableCredit: number;
  activeCreditOrdersCount: number;
  overdueCount: number;
  overdueAmount: number;
  oldestDueDate: string | null;
  creditOrders: Array<{
    orderId: string;
    orderNumber: string;
    grandTotal: number;
    creditDueDate: string;
    creditPaymentStatus: string;
    createdAt: string;
  }>;
};

export default function CreditPolicyPage() {
  const { profile } = useWholesaler();
  const queryClient = useQueryClient();
  const [policy, setPolicy] = useState<CreditPolicy>({
    creditEnabled: false,
    allowCOD: true,
    defaultCreditLimit: 10000,
    creditPeriodDays: 15,
    lateFeePercent: 0,
    minOrderForCredit: 0,
  });
  const [summary, setSummary] = useState({
    totalRetailersOnCredit: 0,
    totalOutstandingAmount: 0,
    totalOverdueAmount: 0,
  });
  const [retailers, setRetailers] = useState<CreditRetailerItem[]>([]);
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OUTSTANDING' | 'OVERDUE'>('ALL');
  
  const [editingRetailer, setEditingRetailer] = useState<CreditRetailerItem | null>(null);
  const [customLimitInput, setCustomLimitInput] = useState<string>('');
  const [savingLimit, setSavingLimit] = useState(false);

  const [settleModalRetailer, setSettleModalRetailer] = useState<CreditRetailerItem | null>(null);
  const [settlingOrderId, setSettlingOrderId] = useState<string | null>(null);

  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const creditQuery = useQuery({
    queryKey: wholesalerQueryKeys.resource(profile.id || 'unknown', 'credit-overview'),
    queryFn: () => api.getCreditOverview(),
    enabled: Boolean(profile.id),
  });
  const loading = creditQuery.isLoading;
  const loadCreditData = async () => {
    await queryClient.invalidateQueries({
      queryKey: wholesalerQueryKeys.resource(profile.id || 'unknown', 'credit-overview'),
    });
    await creditQuery.refetch();
  };

  useEffect(() => {
    const data = creditQuery.data?.data;
    if (data?.policy) {
      setPolicy({
        creditEnabled: Boolean(data.policy.creditEnabled),
        allowCOD: data.policy.allowCOD !== undefined ? Boolean(data.policy.allowCOD) : true,
        defaultCreditLimit: data.policy.defaultCreditLimit || 0,
        creditPeriodDays: data.policy.creditPeriodDays || 15,
        lateFeePercent: data.policy.lateFeePercent || 0,
        minOrderForCredit: data.policy.minOrderForCredit || 0,
      });
    }
    if (data?.summary) setSummary(data.summary);
    if (Array.isArray(data?.retailers)) setRetailers(data.retailers);
    if (creditQuery.error) {
      setMessage({ type: 'error', text: creditQuery.error.message || 'Unable to load credit overview data.' });
    }
  }, [creditQuery.data, creditQuery.error]);

  const handleSavePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPolicy(true);
    setMessage(null);

    // Client-side validations
    const defaultCreditLimit = Math.max(0, Number(policy.defaultCreditLimit) || 0);
    const creditPeriodDays = Math.max(1, Math.floor(Number(policy.creditPeriodDays) || 1));
    const minOrderForCredit = Math.max(0, Number(policy.minOrderForCredit) || 0);
    const lateFeePercent = Math.min(100, Math.max(0, Number(policy.lateFeePercent) || 0));

    const validatedPolicy = {
      ...policy,
      defaultCreditLimit,
      creditPeriodDays,
      minOrderForCredit,
      lateFeePercent,
    };

    try {
      const updated = await api.updateCreditPolicy(validatedPolicy);
      if (updated?.data) {
        setPolicy({
          creditEnabled: Boolean(updated.data.creditEnabled),
          allowCOD: updated.data.allowCOD !== undefined ? Boolean(updated.data.allowCOD) : true,
          defaultCreditLimit: updated.data.defaultCreditLimit || 0,
          creditPeriodDays: updated.data.creditPeriodDays || 15,
          lateFeePercent: updated.data.lateFeePercent || 0,
          minOrderForCredit: updated.data.minOrderForCredit || 0,
        });
      }
      setMessage({ type: 'success', text: 'Credit policy settings updated successfully!' });
      await loadCreditData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Failed to update credit policy.' });
    } finally {
      setSavingPolicy(false);
    }
  };

  const handleSaveCustomLimit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRetailer) return;
    setSavingLimit(true);
    try {
      const numericLimit = customLimitInput.trim() === '' ? null : Math.max(0, Number(customLimitInput));
      await api.setRetailerCreditLimit(editingRetailer.retailerId, numericLimit);
      setMessage({
        type: 'success',
        text: `Credit limit updated for ${editingRetailer.businessName}.`,
      });
      setEditingRetailer(null);
      await loadCreditData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Failed to set retailer credit limit.' });
    } finally {
      setSavingLimit(false);
    }
  };

  const handleSettleOrder = async (orderId: string) => {
    setSettlingOrderId(orderId);
    try {
      await api.settleOrderCredit(orderId);
      setMessage({ type: 'success', text: 'Order credit payment settled successfully!' });
      setSettleModalRetailer(null);
      await loadCreditData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Failed to settle order credit.' });
    } finally {
      setSettlingOrderId(null);
    }
  };

  const filteredRetailers = retailers.filter((r) => {
    const q = search.toLowerCase();
    const matchesSearch =
      r.businessName.toLowerCase().includes(q) ||
      r.ownerName.toLowerCase().includes(q) ||
      r.phone.includes(q);
    if (!matchesSearch) return false;

    if (statusFilter === 'OUTSTANDING') return r.currentOutstandingAmount > 0;
    if (statusFilter === 'OVERDUE') return r.overdueCount > 0;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-tradeflow-gray-200 pb-5">
        <div>
          <div className="mb-1.5 flex items-center gap-2 text-xs font-extrabold uppercase text-green-700">
            <HandCoins className="h-4 w-4" />
            <span>Credit Management</span>
          </div>
          <h1 className="text-2xl font-extrabold text-tradeflow-navy"> Credit Policy</h1>
          <p className="text-xs text-gray-500 mt-1">
            Set default credit terms, customize per-retailer limits, and track outstanding & overdue payments.
          </p>
        </div>
        <button
          onClick={loadCreditData}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-xl border border-tradeflow-gray-200 bg-white px-3.5 py-2 text-xs font-bold text-tradeflow-navy shadow-xs hover:bg-tradeflow-gray-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh Data
        </button>
      </div>

      {message && (
        <div
          className={`flex items-center justify-between rounded-xl border p-4 text-xs font-bold ${
            message.type === 'success'
              ? 'border-green-200 bg-green-50 text-green-800'
              : 'border-red-200 bg-red-50 text-red-800'
          }`}
        >
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="text-gray-400 hover:text-gray-600">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Credit Policy Settings Card */}
      <form onSubmit={handleSavePolicy} className="rounded-2xl border border-tradeflow-gray-200 bg-white p-6 shadow-xs">
        <div className="flex items-center justify-between border-b border-tradeflow-gray-200 pb-4 mb-5">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${policy.creditEnabled ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-gray-100 text-gray-400'}`}>
              <HandCoins className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-tradeflow-navy">Wholesaler Credit Terms Config</h2>
              <p className="text-xs text-gray-500">Allow retailers to purchase goods on credit</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6">
            <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2 hover:bg-gray-100 transition-colors">
              <input
                type="checkbox"
                checked={policy.allowCOD}
                onChange={(e) => setPolicy({ ...policy, allowCOD: e.target.checked })}
                className="h-4 w-4 cursor-pointer accent-tradeflow-green"
              />
              <span className="text-xs font-extrabold text-tradeflow-navy">
                {policy.allowCOD ? 'COD Allowed' : 'COD Disabled'}
              </span>
            </label>

            <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2 hover:bg-gray-100 transition-colors">
              <input
                type="checkbox"
                checked={policy.creditEnabled}
                onChange={(e) => setPolicy({ ...policy, creditEnabled: e.target.checked })}
                className="h-4 w-4 cursor-pointer accent-tradeflow-green"
              />
              <span className="text-xs font-extrabold text-tradeflow-navy">
                {policy.creditEnabled ? 'Credit Enabled' : 'Credit Disabled'}
              </span>
            </label>
          </div>
        </div>

        <div className={`grid gap-5 sm:grid-cols-2 lg:grid-cols-4 ${!policy.creditEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
          <div>
            <label className="block text-xs font-bold text-tradeflow-navy mb-1.5">
              Default Credit Limit (₹) *
            </label>
            <div className="flex items-center rounded-xl border border-tradeflow-gray-300 bg-white px-2 py-1 focus-within:border-tradeflow-green">
              <button
                type="button"
                onClick={() => setPolicy((p) => ({ ...p, defaultCreditLimit: Math.max(0, p.defaultCreditLimit - 1000) }))}
                className="px-2 py-1 text-xs font-bold text-gray-500 hover:text-black hover:bg-gray-100 rounded transition-colors"
                title="Decrease by ₹1,000"
              >
                -
              </button>
              <input
                type="number"
                min={0}
                required
                value={policy.defaultCreditLimit === 0 ? '' : policy.defaultCreditLimit}
                onChange={(e) => {
                  const val = e.target.value;
                  setPolicy({ ...policy, defaultCreditLimit: val === '' ? 0 : Math.max(0, Number(val)) });
                }}
                placeholder="e.g. 10000"
                className="w-full text-center text-xs font-bold outline-none border-none py-1"
              />
              <button
                type="button"
                onClick={() => setPolicy((p) => ({ ...p, defaultCreditLimit: p.defaultCreditLimit + 1000 }))}
                className="px-2 py-1 text-xs font-bold text-gray-500 hover:text-black hover:bg-gray-100 rounded transition-colors"
                title="Increase by ₹1,000"
              >
                +
              </button>
            </div>
            <p className="mt-1 text-[10px] text-gray-400">Default for all connected retailers (typeable)</p>
          </div>

          <div>
            <label className="block text-xs font-bold text-tradeflow-navy mb-1.5">
              Credit Period (Days) *
            </label>
            <div className="flex items-center rounded-xl border border-tradeflow-gray-300 bg-white px-2 py-1 focus-within:border-tradeflow-green">
              <button
                type="button"
                onClick={() => setPolicy((p) => ({ ...p, creditPeriodDays: Math.max(1, p.creditPeriodDays - 1) }))}
                className="px-2 py-1 text-xs font-bold text-gray-500 hover:text-black hover:bg-gray-100 rounded transition-colors"
                title="Decrease 1 day"
              >
                -
              </button>
              <input
                type="number"
                min={1}
                step={1}
                required
                value={policy.creditPeriodDays === 0 ? '' : policy.creditPeriodDays}
                onChange={(e) => {
                  const val = e.target.value;
                  setPolicy({ ...policy, creditPeriodDays: val === '' ? 1 : Math.max(1, Math.floor(Number(val))) });
                }}
                placeholder="e.g. 15, 30, 45"
                className="w-full text-center text-xs font-bold outline-none border-none py-1"
              />
              <button
                type="button"
                onClick={() => setPolicy((p) => ({ ...p, creditPeriodDays: p.creditPeriodDays + 1 }))}
                className="px-2 py-1 text-xs font-bold text-gray-500 hover:text-black hover:bg-gray-100 rounded transition-colors"
                title="Increase 1 day"
              >
                +
              </button>
            </div>
            <p className="mt-1 text-[10px] text-gray-400">Days until due (whole number ≥ 1)</p>
          </div>

          <div>
            <label className="block text-xs font-bold text-tradeflow-navy mb-1.5">
              Min Order Value for Credit (₹)
            </label>
            <div className="flex items-center rounded-xl border border-tradeflow-gray-300 bg-white px-2 py-1 focus-within:border-tradeflow-green">
              <button
                type="button"
                onClick={() => setPolicy((p) => ({ ...p, minOrderForCredit: Math.max(0, p.minOrderForCredit - 500) }))}
                className="px-2 py-1 text-xs font-bold text-gray-500 hover:text-black hover:bg-gray-100 rounded transition-colors"
                title="Decrease by ₹500"
              >
                -
              </button>
              <input
                type="number"
                min={0}
                value={policy.minOrderForCredit === 0 ? '' : policy.minOrderForCredit}
                onChange={(e) => {
                  const val = e.target.value;
                  setPolicy({ ...policy, minOrderForCredit: val === '' ? 0 : Math.max(0, Number(val)) });
                }}
                placeholder="e.g. 2000"
                className="w-full text-center text-xs font-bold outline-none border-none py-1"
              />
              <button
                type="button"
                onClick={() => setPolicy((p) => ({ ...p, minOrderForCredit: p.minOrderForCredit + 500 }))}
                className="px-2 py-1 text-xs font-bold text-gray-500 hover:text-black hover:bg-gray-100 rounded transition-colors"
                title="Increase by ₹500"
              >
                +
              </button>
            </div>
            <p className="mt-1 text-[10px] text-gray-400">0 for no minimum restriction (typeable)</p>
          </div>

          <div>
            <label className="block text-xs font-bold text-tradeflow-navy mb-1.5">
              Late Fee / Interest % (Optional)
            </label>
            <div className="flex items-center rounded-xl border border-tradeflow-gray-300 bg-white px-2 py-1 focus-within:border-tradeflow-green">
              <button
                type="button"
                onClick={() => setPolicy((p) => ({ ...p, lateFeePercent: Math.max(0, Number((p.lateFeePercent - 0.5).toFixed(1))) }))}
                className="px-2 py-1 text-xs font-bold text-gray-500 hover:text-black hover:bg-gray-100 rounded transition-colors"
                title="Decrease 0.5%"
              >
                -
              </button>
              <input
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={policy.lateFeePercent === 0 ? '' : policy.lateFeePercent}
                onChange={(e) => {
                  const val = e.target.value;
                  setPolicy({
                    ...policy,
                    lateFeePercent: val === '' ? 0 : Math.min(100, Math.max(0, Number(val))),
                  });
                }}
                placeholder="e.g. 2"
                className="w-full text-center text-xs font-bold outline-none border-none py-1"
              />
              <button
                type="button"
                onClick={() => setPolicy((p) => ({ ...p, lateFeePercent: Math.min(100, Number((p.lateFeePercent + 0.5).toFixed(1))) }))}
                className="px-2 py-1 text-xs font-bold text-gray-500 hover:text-black hover:bg-gray-100 rounded transition-colors"
                title="Increase 0.5%"
              >
                +
              </button>
            </div>
            <p className="mt-1 text-[10px] text-gray-400">Late fee penalty rate % (0-100%)</p>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="submit"
            disabled={savingPolicy}
            className="inline-flex items-center gap-2 rounded-xl bg-tradeflow-green px-5 py-2.5 text-xs font-bold text-tradeflow-navy shadow-xs transition-colors hover:bg-tradeflow-green-hover disabled:opacity-60"
          >
            {savingPolicy ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            <span>Save Credit Policy Settings</span>
          </button>
        </div>
      </form>

      {/* Credit Summary Analytics Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-tradeflow-gray-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-gray-400">Active Retailers on Credit</span>
            <Users className="h-4 w-4 text-blue-600" />
          </div>
          <div className="mt-3 text-2xl font-black text-tradeflow-navy">{summary.totalRetailersOnCredit}</div>
          <p className="mt-1 text-[11px] text-gray-500">Retailers with active outstanding balances</p>
        </div>

        <div className="rounded-2xl border border-tradeflow-gray-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-gray-400">Total Outstanding Balance</span>
            <DollarSign className="h-4 w-4 text-amber-600" />
          </div>
          <div className="mt-3 text-2xl font-black text-amber-700">₹{summary.totalOutstandingAmount.toLocaleString('en-IN')}</div>
          <p className="mt-1 text-[11px] text-gray-500">Total credit owed across all retailers</p>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-amber-800">Total Overdue Amount</span>
            <AlertTriangle className="h-4 w-4 text-amber-700" />
          </div>
          <div className="mt-3 text-2xl font-black text-amber-800">₹{summary.totalOverdueAmount.toLocaleString('en-IN')}</div>
          <p className="mt-1 text-[11px] text-amber-800">Payments past due date requiring follow-up</p>
        </div>
      </div>

      {/* Retailers Credit Limit & Outstanding Table */}
      <div className="rounded-2xl border border-tradeflow-gray-200 bg-white p-5 shadow-xs space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-tradeflow-gray-200 pb-4">
          <div>
            <h3 className="text-base font-extrabold text-tradeflow-navy">Connected Retailer Credit Accounts</h3>
            <p className="text-xs text-gray-500">Set custom limits per retailer or view active credit balances</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search retailer name, owner, phone..."
                className="w-64 rounded-xl border border-tradeflow-gray-300 pl-9 pr-3 py-1.5 text-xs outline-none focus:border-tradeflow-green"
              />
            </div>

            <div className="flex rounded-xl border border-tradeflow-gray-200 bg-tradeflow-gray-50 p-1 text-xs font-bold">
              <button
                onClick={() => setStatusFilter('ALL')}
                className={`rounded-lg px-3 py-1 ${statusFilter === 'ALL' ? 'bg-white shadow-xs text-green-700' : 'text-gray-500'}`}
              >
                All ({retailers.length})
              </button>
              <button
                onClick={() => setStatusFilter('OUTSTANDING')}
                className={`rounded-lg px-3 py-1 ${statusFilter === 'OUTSTANDING' ? 'bg-white shadow-xs text-amber-700' : 'text-gray-500'}`}
              >
                Outstanding ({retailers.filter((r) => r.currentOutstandingAmount > 0).length})
              </button>
              <button
                onClick={() => setStatusFilter('OVERDUE')}
                className={`rounded-lg px-3 py-1 ${statusFilter === 'OVERDUE' ? 'bg-white shadow-xs text-amber-800' : 'text-gray-500'}`}
              >
                Overdue ({retailers.filter((r) => r.overdueCount > 0).length})
              </button>
            </div>
          </div>
        </div>

        {filteredRetailers.length === 0 ? (
          <div className="py-12 text-center text-xs text-gray-400">
            No retailer credit accounts match your filter criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[900px]">
              <thead>
                <tr className="border-b border-tradeflow-gray-200 font-bold text-gray-400 uppercase tracking-wider">
                  <th className="pb-3">Retailer Store</th>
                  <th className="pb-3">Effective Credit Limit</th>
                  <th className="pb-3">Outstanding Amount</th>
                  <th className="pb-3">Available Credit</th>
                  <th className="pb-3">Credit Status</th>
                  <th className="pb-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-tradeflow-gray-200">
                {filteredRetailers.map((item) => (
                  <tr key={item.relationshipId} className="hover:bg-tradeflow-gray-50 transition-colors">
                    <td className="py-3.5 pr-3">
                      <div className="font-extrabold text-tradeflow-navy text-sm">{item.businessName}</div>
                      <div className="text-gray-400 text-[11px]">{item.ownerName} • {item.phone}</div>
                    </td>

                    <td className="py-3.5 pr-3">
                      <div className="font-extrabold text-tradeflow-navy">
                        ₹{item.effectiveLimit.toLocaleString('en-IN')}
                      </div>
                      <div className="text-[10px]">
                        {item.customCreditLimit !== null ? (
                          <span className="font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                            Custom Limit
                          </span>
                        ) : (
                          <span className="text-gray-400">Default Limit</span>
                        )}
                      </div>
                    </td>

                    <td className="py-3.5 pr-3">
                      <div className={`font-extrabold ${item.currentOutstandingAmount > 0 ? 'text-amber-700' : 'text-gray-600'}`}>
                        ₹{item.currentOutstandingAmount.toLocaleString('en-IN')}
                      </div>
                      {item.activeCreditOrdersCount > 0 && (
                        <div className="text-[10px] text-gray-400">
                          {item.activeCreditOrdersCount} active order{item.activeCreditOrdersCount > 1 ? 's' : ''}
                        </div>
                      )}
                    </td>

                    <td className="py-3.5 pr-3">
                      <div className="font-extrabold text-emerald-700">
                        ₹{item.availableCredit.toLocaleString('en-IN')}
                      </div>
                    </td>

                    <td className="py-3.5 pr-3">
                      {item.overdueCount > 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-extrabold text-amber-800 border border-amber-300">
                          <AlertTriangle className="h-3 w-3" />
                          {item.overdueCount} Overdue (₹{item.overdueAmount.toLocaleString('en-IN')})
                        </span>
                      ) : item.currentOutstandingAmount > 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold text-amber-800 border border-amber-300">
                          <Clock className="h-3 w-3" />
                          Active Credit
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-[10px] font-bold text-green-800 border border-green-300">
                          <CheckCircle2 className="h-3 w-3" />
                          Clear Balance
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            setEditingRetailer(item);
                            setCustomLimitInput(item.customCreditLimit !== null ? String(item.customCreditLimit) : '');
                          }}
                          className="inline-flex items-center gap-1 rounded-xl border border-tradeflow-gray-200 bg-white px-2.5 py-1.5 text-xs font-bold text-gray-700 hover:bg-tradeflow-gray-50"
                        >
                          <Edit2 className="h-3 w-3 text-gray-500" />
                          <span>Custom Limit</span>
                        </button>

                        {item.currentOutstandingAmount > 0 && (
                          <button
                            onClick={() => setSettleModalRetailer(item)}
                            className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 shadow-xs"
                          >
                            <HandCoins className="h-3 w-3" />
                            <span>Settle Credit</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal 1: Edit Custom Limit for Specific Retailer */}
      {editingRetailer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form onSubmit={handleSaveCustomLimit} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-base font-extrabold text-tradeflow-navy">Custom Credit Limit</h3>
                <p className="text-xs text-gray-500">{editingRetailer.businessName} ({editingRetailer.ownerName})</p>
              </div>
              <button type="button" onClick={() => setEditingRetailer(null)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-tradeflow-navy mb-1.5">
                Custom Credit Limit Amount (₹)
              </label>
              <div className="flex items-center rounded-xl border border-tradeflow-gray-300 bg-white px-2 py-1 focus-within:border-tradeflow-green">
                <button
                  type="button"
                  onClick={() => {
                    const current = customLimitInput === '' ? policy.defaultCreditLimit : Number(customLimitInput);
                    setCustomLimitInput(String(Math.max(0, current - 1000)));
                  }}
                  className="px-2.5 py-1 text-xs font-bold text-gray-500 hover:text-black hover:bg-gray-100 rounded transition-colors"
                  title="Decrease by ₹1,000"
                >
                  -
                </button>
                <input
                  type="number"
                  min={0}
                  value={customLimitInput}
                  onChange={(e) => setCustomLimitInput(e.target.value)}
                  placeholder={`Leave blank to use default (₹${policy.defaultCreditLimit.toLocaleString('en-IN')})`}
                  className="w-full text-center text-sm font-bold outline-none border-none py-1.5"
                />
                <button
                  type="button"
                  onClick={() => {
                    const current = customLimitInput === '' ? policy.defaultCreditLimit : Number(customLimitInput);
                    setCustomLimitInput(String(current + 1000));
                  }}
                  className="px-2.5 py-1 text-xs font-bold text-gray-500 hover:text-black hover:bg-gray-100 rounded transition-colors"
                  title="Increase by ₹1,000"
                >
                  +
                </button>
              </div>
              <p className="mt-1.5 text-[11px] text-gray-500">
                Leave blank or empty to reset to wholesaler default limit (₹{policy.defaultCreditLimit.toLocaleString('en-IN')}). Type directly or use -/+ controls.
              </p>
            </div>

            <div className="flex items-center justify-between pt-3">
              <button
                type="button"
                onClick={() => setCustomLimitInput('')}
                className="text-xs font-bold text-blue-600 hover:underline"
              >
                Reset to Default
              </button>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditingRetailer(null)}
                  className="rounded-xl border border-tradeflow-gray-200 px-4 py-2 text-xs font-bold text-gray-600 hover:bg-tradeflow-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingLimit}
                  className="rounded-xl bg-tradeflow-green px-4 py-2 text-xs font-bold text-tradeflow-navy hover:bg-tradeflow-green-hover disabled:opacity-60"
                >
                  {savingLimit ? 'Saving...' : 'Save Limit'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Modal 2: Settle Credit Orders for Retailer */}
      {settleModalRetailer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-xl max-h-[85vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-base font-extrabold text-tradeflow-navy">Settle Credit Orders</h3>
                <p className="text-xs text-gray-500">
                  {settleModalRetailer.businessName} • Outstanding: <strong className="text-amber-700">₹{settleModalRetailer.currentOutstandingAmount.toLocaleString('en-IN')}</strong>
                </p>
              </div>
              <button type="button" onClick={() => setSettleModalRetailer(null)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-bold text-gray-700">Pending Credit Orders for this retailer:</p>
              {settleModalRetailer.creditOrders.length === 0 ? (
                <div className="p-4 text-center text-xs text-gray-400 border border-dashed rounded-xl">
                  No individual credit order records found.
                </div>
              ) : (
                settleModalRetailer.creditOrders.map((order) => (
                  <div key={order.orderId} className="flex items-center justify-between border rounded-xl p-3 text-xs bg-tradeflow-gray-50">
                    <div>
                      <div className="font-extrabold text-tradeflow-navy">Order #{order.orderNumber}</div>
                      <div className="text-[11px] text-gray-500">
                        Placed: {new Date(order.createdAt).toLocaleDateString('en-IN')} • Due: <strong className="text-gray-700">{order.creditDueDate ? new Date(order.creditDueDate).toLocaleDateString('en-IN') : 'N/A'}</strong>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="font-extrabold text-amber-700">₹{order.grandTotal.toLocaleString('en-IN')}</div>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                          {order.creditPaymentStatus}
                        </span>
                      </div>

                      <button
                        onClick={() => handleSettleOrder(order.orderId)}
                        disabled={settlingOrderId === order.orderId}
                        className="rounded-xl bg-emerald-600 text-white font-bold px-3 py-1.5 text-xs hover:bg-emerald-700 disabled:opacity-60"
                      >
                        {settlingOrderId === order.orderId ? 'Settling...' : 'Mark Paid'}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-3">
              <button
                onClick={() => setSettleModalRetailer(null)}
                className="rounded-xl border border-tradeflow-gray-200 px-4 py-2 text-xs font-bold text-gray-600 hover:bg-tradeflow-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
