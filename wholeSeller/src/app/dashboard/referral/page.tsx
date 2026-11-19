'use client';

import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, Copy, Gift, Share2, Users } from 'lucide-react';
import api from '@/lib/api';
import { useWholesaler } from '@/context/WholesalerContext';
import { wholesalerQueryKeys } from '@/lib/query-client';

const money = (amount: number) => new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
}).format(Number(amount || 0));

const date = (value: string | null) => value
  ? new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  : '—';

const statusClass: Record<string, string> = {
  AWAITING_KYC: 'bg-slate-100 text-slate-700',
  PENDING: 'bg-amber-100 text-amber-800',
  APPROVED: 'bg-sky-100 text-sky-800',
  PROCESSING: 'bg-violet-100 text-violet-800',
  PAID: 'bg-emerald-100 text-emerald-800',
  REJECTED: 'bg-red-100 text-red-800',
};

export default function ReferralPage() {
  const { profile, isProfileLoaded } = useWholesaler();
  const [page, setPage] = useState(1);
  const [message, setMessage] = useState('');
  const query = useQuery({
    queryKey: wholesalerQueryKeys.resource(profile.id || 'unknown', 'referral-program', page),
    queryFn: async () => (await api.getWholesalerReferralProgram(page, 10)).data,
    enabled: Boolean(profile.id),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
  const referralLink = useMemo(
    () => query.data?.code
      ? `${window.location.origin}/register?wholesaler_ref=${encodeURIComponent(query.data.code)}`
      : '',
    [query.data?.code],
  );
  const summary = query.data?.summary;
  const pagination = query.data?.pagination;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setMessage('Referral link copied.');
    } catch (error) {
      console.error('Unable to copy the wholesaler referral link.', error);
      setMessage('Unable to copy the link. Copy it from the field above.');
    }
  };

  const shareLink = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Join ThokStore as a wholesaler',
          text: `Register as a wholesaler and join me on ThokStore. I earn ${money(query.data?.commissionAmount || 300)} when your KYC is approved.`,
          url: referralLink,
        });
      } else {
        await copyLink();
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      console.error('Unable to share the wholesaler referral link.', error);
      setMessage('Unable to share the link. Copy it and send it directly.');
    }
  };

  if (!isProfileLoaded || query.isLoading) {
    return <main className="mx-auto max-w-7xl p-4 sm:p-6" role="status">Loading your referral dashboard…</main>;
  }

  if (query.isError || !query.data) {
    return (
      <main className="mx-auto max-w-7xl p-4 sm:p-6">
        <h1 className="text-2xl font-bold text-tradeflow-navy">Referral &amp; Earn</h1>
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {query.error instanceof Error ? query.error.message : 'Unable to load your referral details.'}
        </p>
        <button type="button" onClick={() => void query.refetch()} className="mt-3 rounded-lg bg-tradeflow-navy px-4 py-2 text-sm font-semibold text-white">
          Try again
        </button>
      </main>
    );
  }

  const cards = [
    { label: 'Total Referrals', value: String(summary?.totalReferrals || 0), icon: Users },
    { label: 'Successful Referrals', value: String(summary?.successfulReferrals || 0), icon: Check },
    { label: 'Pending Commissions', value: money(summary?.pendingCommissions || 0), icon: Gift },
    { label: 'Total Commission Earned', value: money(summary?.totalCommissionEarned || 0), icon: Gift },
    { label: 'Total Commission Paid', value: money(summary?.totalCommissionPaid || 0), icon: Check },
    { label: 'Available Commission Balance', value: money(summary?.availableCommissionBalance || 0), icon: Gift },
  ];

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-tradeflow-green">Grow your wholesaler network</p>
        <h1 className="mt-1 text-2xl font-bold text-tradeflow-navy sm:text-3xl">Referral &amp; Earn</h1>
        <p className="mt-2 text-sm text-gray-600">Invite wholesalers to ThokStore and earn a commission after their KYC is approved.</p>
      </header>

      <section className="rounded-2xl bg-tradeflow-navy p-5 text-white shadow-sm sm:flex sm:items-center sm:justify-between sm:p-7">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold">
            <Gift className="h-4 w-4" /> Referral reward
          </div>
          <p className="mt-3 text-3xl font-extrabold">{money(query.data.commissionAmount)}</p>
          <p className="mt-1 text-sm text-white/75">for every referred wholesaler who completes registration and receives KYC approval</p>
        </div>
        <div className="mt-5 rounded-xl border border-white/15 bg-white/5 p-4 sm:mt-0 sm:min-w-72">
          <p className="text-xs font-semibold uppercase tracking-wide text-white/70">My Referral Code</p>
          <p className="mt-1 font-mono text-xl font-bold tracking-widest">{query.data.code}</p>
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
        <label htmlFor="wholesaler-referral-link" className="text-sm font-bold text-tradeflow-navy">My Referral Link</label>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input
            id="wholesaler-referral-link"
            readOnly
            value={referralLink}
            className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-gray-50 px-3 py-2.5 text-sm text-gray-700"
          />
          <button type="button" onClick={() => void copyLink()} className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-tradeflow-navy hover:bg-gray-50">
            <Copy className="h-4 w-4" /> Copy Link
          </button>
          <button type="button" onClick={() => void shareLink()} className="inline-flex items-center justify-center gap-2 rounded-lg bg-tradeflow-green px-4 py-2 text-sm font-semibold text-white hover:bg-tradeflow-green-hover">
            <Share2 className="h-4 w-4" /> Share Link
          </button>
        </div>
        {message && <p role="status" className="mt-2 text-xs text-gray-600">{message}</p>}
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map(({ label, value, icon: Icon }) => (
          <article key={label} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-500">{label}</p>
              <Icon className="h-4 w-4 text-tradeflow-green" />
            </div>
            <p className="mt-2 text-xl font-bold text-tradeflow-navy">{value}</p>
          </article>
        ))}
      </section>

      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 p-4 sm:p-5">
          <h2 className="font-bold text-tradeflow-navy">Referral History</h2>
          <p className="mt-1 text-xs text-gray-500">Commissions are created only after the referred wholesaler receives KYC approval.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Wholesaler</th>
                <th className="px-4 py-3">Referral Date</th>
                <th className="px-4 py-3">Commission</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Approved Date</th>
                <th className="px-4 py-3">Payment Date</th>
                <th className="px-4 py-3">Transaction Reference</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {query.data.referrals.map((referral) => (
                <tr key={referral.id}>
                  <td className="px-4 py-3 font-semibold text-gray-800">{referral.wholesalerName}</td>
                  <td className="px-4 py-3 text-gray-600">{date(referral.referralDate)}</td>
                  <td className="px-4 py-3 font-semibold">{referral.commissionAmount ? money(referral.commissionAmount) : '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass[referral.commissionStatus] || statusClass.AWAITING_KYC}`}>
                      {referral.commissionStatus === 'AWAITING_KYC' ? 'Awaiting KYC' : referral.commissionStatus}
                    </span>
                    {referral.rejectionReason && <p className="mt-1 max-w-xs text-xs text-red-700">{referral.rejectionReason}</p>}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{date(referral.approvedAt)}</td>
                  <td className="px-4 py-3 text-gray-600">{date(referral.paidAt)}</td>
                  <td className="px-4 py-3 text-gray-600">{referral.transactionReference || '—'}</td>
                </tr>
              ))}
              {query.data.referrals.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-gray-500">Share your referral link to see new wholesalers here.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3 text-xs text-gray-600">
            <span>{pagination.total} referrals</span>
            <div className="flex gap-2">
              <button type="button" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded border px-3 py-1.5 disabled:opacity-40">Previous</button>
              <span className="py-1.5">Page {page} of {pagination.totalPages}</span>
              <button type="button" disabled={page >= pagination.totalPages} onClick={() => setPage((value) => Math.min(pagination.totalPages, value + 1))} className="rounded border px-3 py-1.5 disabled:opacity-40">Next</button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
