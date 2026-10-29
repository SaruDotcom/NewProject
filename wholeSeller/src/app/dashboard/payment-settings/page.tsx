'use client';

import React, { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, QrCode, RefreshCw, ShieldCheck } from 'lucide-react';
import api from '@/lib/api';
import { useWholesaler } from '@/context/WholesalerContext';
import { wholesalerQueryKeys } from '@/lib/query-client';

type PaymentSettings = {
  upiId: string;
  accountName: string;
  hasQrImage: boolean;
  qrPaymentsEnabled: boolean;
  upiIdPaymentsEnabled: boolean;
  qrSessionMinutes: number;
  qrDataUrl: string;
};

export default function PaymentSettingsPage() {
  const { profile } = useWholesaler();
  const queryClient = useQueryClient();
  const queryKey = wholesalerQueryKeys.resource(profile.id || 'unknown', 'payment-settings');
  const settingsQuery = useQuery({
    queryKey,
    queryFn: async () => (await api.getPaymentSettings()).data as PaymentSettings,
    enabled: Boolean(profile.id),
    staleTime: 0,
    gcTime: 0,
  });
  const reportsQuery = useQuery({
    queryKey: wholesalerQueryKeys.resource(profile.id || 'unknown', 'payment-reports'),
    queryFn: async () => (await api.getPaymentReports()).data || [],
    enabled: Boolean(profile.id),
    staleTime: 0,
    gcTime: 0,
    refetchInterval: 15000,
  });
  const [upiId, setUpiId] = useState('');
  const [accountName, setAccountName] = useState('');
  const [qrPaymentsEnabled, setQrPaymentsEnabled] = useState(false);
  const [upiIdPaymentsEnabled, setUpiIdPaymentsEnabled] = useState(false);
  const [qrSessionMinutes, setQrSessionMinutes] = useState(10);
  const [qrImage, setQrImage] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState<string | null>(null);

  useEffect(() => () => {
    if (evidenceUrl) URL.revokeObjectURL(evidenceUrl);
  }, [evidenceUrl]);

  useEffect(() => {
    const data = settingsQuery.data;
    if (!data) return;
    setUpiId(data.upiId || '');
    setAccountName(data.accountName || '');
    setQrPaymentsEnabled(Boolean(data.qrPaymentsEnabled));
    setUpiIdPaymentsEnabled(Boolean(data.upiIdPaymentsEnabled));
    setQrSessionMinutes(data.qrSessionMinutes || 10);
  }, [settingsQuery.data]);

  const saveSettings = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const payload = new FormData();
      payload.append('upiId', upiId);
      payload.append('accountName', accountName);
      payload.append('qrPaymentsEnabled', String(qrPaymentsEnabled));
      payload.append('upiIdPaymentsEnabled', String(upiIdPaymentsEnabled));
      payload.append('qrSessionMinutes', String(qrSessionMinutes));
      if (qrImage) payload.append('qrImage', qrImage);
      await api.updatePaymentSettings(payload);
      await queryClient.invalidateQueries({ queryKey });
      setQrImage(null);
      setMessage('Payment settings saved.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to save payment settings.');
    } finally {
      setBusy(false);
    }
  };

  const review = async (id: string, action: 'VERIFY' | 'REJECT') => {
    const note = action === 'REJECT' ? window.prompt('Add a note for the retailer:') : '';
    if (action === 'REJECT' && note === null) return;
    try {
      await api.reviewPaymentReport(id, action, note || '');
      await queryClient.invalidateQueries({ queryKey: wholesalerQueryKeys.resource(profile.id || 'unknown', 'payment-reports') });
      await queryClient.invalidateQueries({ queryKey: wholesalerQueryKeys.resource(profile.id || 'unknown', 'credit-overview') });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to review this payment report.');
    }
  };

  const openEvidence = async (id: string) => {
    try {
      const url = await api.getPaymentReportScreenshot(id);
      setEvidenceUrl(url);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to open payment evidence.');
    }
  };

  const settings = settingsQuery.data;
  const reports = reportsQuery.data || [];

  return (
    <div className="space-y-6">
      <header className="flex items-start gap-3 border-b border-tradeflow-gray-200 pb-5">
        <div className="rounded-xl bg-tradeflow-green/10 p-3 text-tradeflow-green"><QrCode className="h-5 w-5" /></div>
        <div>
          <h1 className="text-2xl font-extrabold text-tradeflow-navy">Payment Settings</h1>
          <p className="mt-1 text-sm text-gray-500">Configure UPI payment details for your connected retailers.</p>
        </div>
      </header>

      {message && <div role="status" className="rounded-xl border border-tradeflow-gray-200 bg-white p-3 text-sm text-tradeflow-navy">{message}</div>}

      <form onSubmit={saveSettings} className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <section className="space-y-4 rounded-2xl border border-tradeflow-gray-200 bg-white p-5 shadow-sm">
          <label className="block text-sm font-semibold text-tradeflow-navy">
            UPI ID
            <input value={upiId} onChange={(event) => setUpiId(event.target.value)} placeholder="business@upi" className="mt-1 w-full rounded-lg border border-tradeflow-gray-200 px-3 py-2 font-normal" />
          </label>
          <label className="block text-sm font-semibold text-tradeflow-navy">
            Account Name
            <input value={accountName} onChange={(event) => setAccountName(event.target.value)} className="mt-1 w-full rounded-lg border border-tradeflow-gray-200 px-3 py-2 font-normal" />
          </label>
          <label className="block text-sm font-semibold text-tradeflow-navy">
            QR Code Image (max 5 MB)
            <input type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" onChange={(event) => setQrImage(event.target.files?.[0] || null)} className="mt-1 block w-full text-sm font-normal" />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={qrPaymentsEnabled} onChange={(event) => setQrPaymentsEnabled(event.target.checked)} /> Enable QR payments</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={upiIdPaymentsEnabled} onChange={(event) => setUpiIdPaymentsEnabled(event.target.checked)} /> Enable UPI ID payments</label>
          </div>
          <label className="block text-sm font-semibold text-tradeflow-navy">
            QR Session (minutes)
            <input type="number" min={1} max={60} value={qrSessionMinutes} onChange={(event) => setQrSessionMinutes(Number(event.target.value))} className="mt-1 block w-28 rounded-lg border border-tradeflow-gray-200 px-3 py-2 font-normal" />
          </label>
          <p className="rounded-lg bg-blue-50 p-3 text-xs text-blue-900">Test the QR with a UPI app before enabling. Expiry closes the retailer&apos;s QR session.</p>
          <button disabled={busy} className="rounded-lg bg-tradeflow-navy px-4 py-2 text-sm font-bold text-white disabled:opacity-60">{busy ? 'Saving...' : 'Save'}</button>
        </section>
        <aside className="rounded-2xl border border-tradeflow-gray-200 bg-white p-5 text-center shadow-sm">
          <h2 className="font-bold text-tradeflow-navy">Current QR Code</h2>
          {settings?.qrDataUrl ? <img src={settings.qrDataUrl} alt="Your UPI QR code" className="mx-auto mt-4 max-h-64 max-w-full object-contain" /> : <p className="mt-5 text-sm text-gray-500">No QR image uploaded.</p>}
          {settings?.hasQrImage && <p className="mt-3 flex items-center justify-center gap-1 text-xs text-emerald-700"><ShieldCheck className="h-4 w-4" /> Private to you and your linked retailers</p>}
        </aside>
      </form>

      <section className="rounded-2xl border border-tradeflow-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div><h2 className="text-lg font-extrabold text-tradeflow-navy">Payment Reports</h2><p className="text-xs text-gray-500">Verify incoming payments from retailers.</p></div>
          <button onClick={() => void reportsQuery.refetch()} className="rounded-lg border p-2" aria-label="Refresh reports"><RefreshCw className="h-4 w-4" /></button>
        </div>
        <div className="mt-4 space-y-3">
          {reportsQuery.isLoading && <p className="text-sm text-gray-500">Loading reports…</p>}
          {!reportsQuery.isLoading && reports.length === 0 && <p className="text-sm text-gray-500">No payment reports submitted.</p>}
          {reports.map((report: any) => (
            <article key={report._id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-tradeflow-gray-200 p-4">
              <div>
                <p className="font-bold text-tradeflow-navy">{report.retailerId?.name || 'Retailer'} · ₹{Number(report.amount).toLocaleString('en-IN')}</p>
                <p className="mt-1 text-xs text-gray-500">Ref: {report.transactionReference} · {report.isCreditRepayment ? 'Credit repayment' : report.orderId?.orderNumber || 'Order payment'} · {report.status}</p>
                {report.reviewNote && <p className="mt-1 text-xs text-amber-700">{report.reviewNote}</p>}
              </div>
              <div className="flex flex-wrap gap-2">
                {report.screenshotAvailable && <button onClick={() => void openEvidence(report._id)} className="rounded-lg border px-3 py-2 text-xs font-bold">View evidence</button>}
                {report.status === 'PENDING' && <>
                  <button onClick={() => void review(report._id, 'VERIFY')} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white"><CheckCircle2 className="h-4 w-4" /> Confirm received</button>
                  <button onClick={() => void review(report._id, 'REJECT')} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-700">Reject</button>
                </>}
              </div>
            </article>
          ))}
        </div>
      </section>
      {evidenceUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-label="Payment screenshot">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-2xl bg-white p-4">
            <div className="mb-3 flex justify-end gap-2">
              <a href={evidenceUrl} download="payment-evidence" className="rounded-lg border px-3 py-2 text-xs font-bold">Download</a>
              <button onClick={() => setEvidenceUrl(null)} className="rounded-lg bg-tradeflow-navy px-3 py-2 text-xs font-bold text-white">Close</button>
            </div>
            <img src={evidenceUrl} alt="Retailer-submitted payment screenshot" className="mx-auto max-h-[75vh] max-w-full object-contain" />
          </div>
        </div>
      )}
    </div>
  );
}
