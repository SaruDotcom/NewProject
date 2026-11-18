'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Copy, CreditCard, QrCode, RefreshCw, ShieldCheck } from 'lucide-react';
import api from '@/lib/api';
import { useWholesaler } from '@/context/WholesalerContext';
import { wholesalerQueryKeys } from '@/lib/query-client';

type PaymentSettings = {
  upiId: string;
  accountName: string;
  bankDetails: {
    accountHolderName: string;
    bankName: string;
    accountNumber: string;
    ifscCode: string;
    branch: string;
    isVerified: boolean;
    verificationStatus: 'NOT_SUBMITTED' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'UNVERIFIED';
    rejectionReason: string;
    submittedAt: string | null;
    approvedAt: string | null;
  };
  additionalPaymentMethods: string[];
  paymentOtpLimit: number;
  hasQrImage: boolean;
  qrPaymentsEnabled: boolean;
  upiIdPaymentsEnabled: boolean;
  qrSessionMinutes: number;
  qrDataUrl: string;
  qrImageUrl?: string;
};

const UPI_ID_PATTERN = /^[a-zA-Z0-9._-]{2,128}@[a-zA-Z][a-zA-Z0-9.-]{1,63}$/;
const ACCOUNT_HOLDER_PATTERN = /^[\p{L}][\p{L}\s.'-]{1,99}$/u;
const BANK_NAME_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N}\s&.'()-]{1,99}$/u;
const ACCOUNT_NUMBER_PATTERN = /^\d{9,18}$/;
const IFSC_PATTERN = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const BRANCH_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N}\s&.'()-]{1,99}$/u;

export default function PaymentSettingsPage() {
  const { profile } = useWholesaler();
  const queryClient = useQueryClient();
  const queryKey = wholesalerQueryKeys.resource(profile.id || 'unknown', 'payment-settings');
  const settingsQuery = useQuery({
    queryKey,
    queryFn: async () => (await api.getPaymentSettings()).data as PaymentSettings,
    enabled: Boolean(profile.id),
    staleTime: 30_000,
  });
  const reportsQuery = useQuery({
    queryKey: wholesalerQueryKeys.resource(profile.id || 'unknown', 'payment-reports'),
    queryFn: async () => (await api.getPaymentReports()).data || [],
    enabled: Boolean(profile.id),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
  const [upiId, setUpiId] = useState('');
  const [accountName, setAccountName] = useState('');
  const [bankDetails, setBankDetails] = useState({
    accountHolderName: '',
    bankName: '',
    accountNumber: '',
    ifscCode: '',
    branch: '',
  });
  const [additionalPaymentMethods, setAdditionalPaymentMethods] = useState<string[]>([]);
  const [paymentOtpLimit, setPaymentOtpLimit] = useState(10000);
  const [qrPaymentsEnabled, setQrPaymentsEnabled] = useState(false);
  const [upiIdPaymentsEnabled, setUpiIdPaymentsEnabled] = useState(false);
  const [qrSessionMinutes, setQrSessionMinutes] = useState(10);
  const [qrImage, setQrImage] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [bankBusy, setBankBusy] = useState(false);
  const [bankEditorOpen, setBankEditorOpen] = useState(false);
  const [confirmAccountNumber, setConfirmAccountNumber] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('info');
  const [uploadMessage, setUploadMessage] = useState('');
  const [uploadMessageType, setUploadMessageType] = useState<'success' | 'error' | 'info'>('info');
  const [uploadProgress, setUploadProgress] = useState(0);
  const qrFileInput = useRef<HTMLInputElement>(null);
  const [evidenceUrl, setEvidenceUrl] = useState<string | null>(null);
  const [evidenceContentType, setEvidenceContentType] = useState('');
  const savedBankDetails = settingsQuery.data?.bankDetails;
  const bankDetailsVerified = Boolean(savedBankDetails?.isVerified);

  const showMessage = (text: string, type: 'success' | 'error' | 'info' = 'info') => {
    setMessage(text);
    setMessageType(type);
  };

  const showUploadMessage = (text: string, type: 'success' | 'error' | 'info' = 'info') => {
    setUploadMessage(text);
    setUploadMessageType(type);
  };

  useEffect(() => () => {
    if (evidenceUrl) URL.revokeObjectURL(evidenceUrl);
  }, [evidenceUrl]);

  useEffect(() => {
    const data = settingsQuery.data;
    if (!data) return;
    setUpiId(data.upiId || '');
    setAccountName(data.accountName || '');
    setBankDetails({
      accountHolderName: data.bankDetails?.accountHolderName || '',
      bankName: data.bankDetails?.bankName || '',
      accountNumber: data.bankDetails?.accountNumber || '',
      ifscCode: data.bankDetails?.ifscCode || '',
      branch: data.bankDetails?.branch || '',
    });
    setAdditionalPaymentMethods(data.additionalPaymentMethods || []);
    setPaymentOtpLimit(Number(data.paymentOtpLimit ?? 10000));
    setQrPaymentsEnabled(Boolean(data.qrPaymentsEnabled));
    setUpiIdPaymentsEnabled(Boolean(data.upiIdPaymentsEnabled));
    setQrSessionMinutes(data.qrSessionMinutes || 10);
  }, [settingsQuery.data]);

  const saveSettings = async (event: React.FormEvent) => {
    event.preventDefault();
    const cleanUpiId = upiId.trim();
    if (cleanUpiId && !UPI_ID_PATTERN.test(cleanUpiId)) {
      showMessage('Enter a valid UPI ID.', 'error');
      return;
    }
    if (upiIdPaymentsEnabled && !cleanUpiId) {
      showMessage('Enter a UPI ID before enabling UPI ID payments.', 'error');
      return;
    }
    setBusy(true);
    showMessage('');
    setUploadMessage('');
    setUploadProgress(0);
    try {
      const payload = new FormData();
      payload.append('upiId', cleanUpiId);
      payload.append('accountName', accountName);
      payload.append('qrPaymentsEnabled', String(qrPaymentsEnabled));
      payload.append('upiIdPaymentsEnabled', String(upiIdPaymentsEnabled));
      payload.append('qrSessionMinutes', String(qrSessionMinutes));
      payload.append('additionalPaymentMethods', JSON.stringify(additionalPaymentMethods));
      payload.append('paymentOtpLimit', String(paymentOtpLimit));
      if (qrImage) payload.append('qrImage', qrImage);
      const response = await api.updatePaymentSettings(payload, setUploadProgress);
      if (qrImage && !response.data.hasQrImage) {
        throw new Error('The server did not confirm the QR image. Please try uploading it again.');
      }
      await queryClient.invalidateQueries({ queryKey });
      setQrImage(null);
      if (qrFileInput.current) qrFileInput.current.value = '';
      setUploadProgress(100);
      showMessage('Payment settings saved.', 'success');
      showUploadMessage(qrImage ? 'QR image uploaded and saved successfully.' : 'Payment settings saved.', 'success');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unable to save payment settings.';
      showMessage(errorMessage, 'error');
      showUploadMessage(errorMessage, 'error');
    } finally {
      setBusy(false);
    }
  };

  const submitBankDetails = async (event: React.FormEvent) => {
    event.preventDefault();
    const cleanBankDetails = {
      accountHolderName: bankDetails.accountHolderName.trim(),
      bankName: bankDetails.bankName.trim(),
      accountNumber: bankDetails.accountNumber.trim(),
      ifscCode: bankDetails.ifscCode.trim().toUpperCase(),
      branch: bankDetails.branch.trim(),
    };
    const validBankDetails = ACCOUNT_HOLDER_PATTERN.test(cleanBankDetails.accountHolderName) &&
      BANK_NAME_PATTERN.test(cleanBankDetails.bankName) &&
      ACCOUNT_NUMBER_PATTERN.test(cleanBankDetails.accountNumber) &&
      IFSC_PATTERN.test(cleanBankDetails.ifscCode) &&
      BRANCH_PATTERN.test(cleanBankDetails.branch);
    if (!validBankDetails) {
      showMessage('Enter a valid account holder name, bank name, 9-18 digit account number, IFSC code, and branch name.', 'error');
      return;
    }
    if (
      (!savedBankDetails?.accountNumber ||
        cleanBankDetails.accountNumber !== savedBankDetails.accountNumber) &&
      cleanBankDetails.accountNumber !== confirmAccountNumber.trim()
    ) {
      showMessage('Account number and confirmation do not match.', 'error');
      return;
    }

    setBankBusy(true);
    showMessage('');
    try {
      await api.submitBankDetails({
        ...cleanBankDetails,
        ...(confirmAccountNumber.trim() ? { confirmAccountNumber: confirmAccountNumber.trim() } : {}),
      });
      await queryClient.invalidateQueries({ queryKey });
      setConfirmAccountNumber('');
      setBankEditorOpen(false);
      showMessage('Bank details submitted for Superadmin verification.', 'success');
    } catch (error) {
      showMessage(error instanceof Error ? error.message : 'Unable to submit bank details.', 'error');
    } finally {
      setBankBusy(false);
    }
  };

  const selectQrImage = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    if (file && file.size > 5 * 1024 * 1024) {
      event.target.value = '';
      setQrImage(null);
      showUploadMessage('The QR image must be 5 MB or smaller.', 'error');
      showMessage('The QR image must be 5 MB or smaller.', 'error');
      return;
    }
    setQrImage(file);
    setUploadProgress(0);
    showUploadMessage(file ? `${file.name} selected. Save to upload it.` : '');
    showMessage('');
  };

  const review = async (id: string, action: 'VERIFY' | 'REJECT') => {
    const note = action === 'REJECT' ? window.prompt('Add a note for the retailer:') : '';
    if (action === 'REJECT' && note === null) return;
    try {
      let otp: string | undefined;
      const report = reports.find((item: any) => item._id === id);
      if (action === 'VERIFY' && Number(report?.amount || 0) > Number(settings?.paymentOtpLimit ?? 10000)) {
        const otpResponse = await api.requestPaymentApprovalOtp(id);
        if (otpResponse.data.otpRequired) {
          const enteredOtp = window.prompt(`Enter the code sent to ${otpResponse.data.sentTo || 'your registered mobile'}:`);
          if (enteredOtp === null) return;
          otp = enteredOtp.trim();
        }
      }
      await api.reviewPaymentReport(id, action, note || '', otp);
      await queryClient.invalidateQueries({ queryKey: wholesalerQueryKeys.resource(profile.id || 'unknown', 'payment-reports') });
      await queryClient.invalidateQueries({ queryKey: wholesalerQueryKeys.resource(profile.id || 'unknown', 'credit-overview') });
    } catch (error) {
      showMessage(error instanceof Error ? error.message : 'Unable to review this payment report.', 'error');
    }
  };

  const reverse = async (id: string) => {
    const reason = window.prompt('Enter the reason for this reverse entry:');
    if (reason === null) return;
    try {
      await api.reversePaymentReport(id, reason);
      await queryClient.invalidateQueries({ queryKey: wholesalerQueryKeys.resource(profile.id || 'unknown', 'payment-reports') });
      await queryClient.invalidateQueries({ queryKey: wholesalerQueryKeys.resource(profile.id || 'unknown', 'credit-overview') });
    } catch (error) {
      showMessage(error instanceof Error ? error.message : 'Unable to reverse this payment.', 'error');
    }
  };

  const toggleAdditionalMethod = (method: string) => {
    setAdditionalPaymentMethods((current) => current.includes(method)
      ? current.filter((value) => value !== method)
      : [...current, method]);
  };

  const openEvidence = async (id: string) => {
    try {
      const evidence = await api.getPaymentReportScreenshot(id);
      setEvidenceUrl(evidence.url);
      setEvidenceContentType(evidence.contentType);
    } catch (error) {
      showMessage(error instanceof Error ? error.message : 'Unable to open payment evidence.', 'error');
    }
  };

  const settings = settingsQuery.data;
  const reports = reportsQuery.data || [];
  const hasSavedBankDetails = Boolean(savedBankDetails && [
    savedBankDetails.accountHolderName,
    savedBankDetails.bankName,
    savedBankDetails.accountNumber,
    savedBankDetails.ifscCode,
    savedBankDetails.branch,
  ].some((value) => value.trim()));

  const copySavedUpiId = async () => {
    const savedUpiId = settings?.upiId?.trim();
    if (!savedUpiId) return;
    try {
      await navigator.clipboard.writeText(savedUpiId);
      showMessage('UPI ID copied.', 'success');
    } catch {
      showMessage('Unable to copy the UPI ID. Please copy it manually.', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex items-start gap-3 border-b border-tradeflow-gray-200 pb-5">
        <div className="rounded-xl bg-tradeflow-green/10 p-3 text-tradeflow-green"><QrCode className="h-5 w-5" /></div>
        <div>
          <h1 className="text-2xl font-extrabold text-tradeflow-navy">Payment Settings</h1>
          <p className="mt-1 text-sm text-gray-500">Configure UPI, QR payments, and high-value payment approval. Bank details are reviewed separately.</p>
        </div>
      </header>

      {settingsQuery.isLoading && <p role="status" className="rounded-xl border border-tradeflow-gray-200 bg-white p-3 text-sm text-gray-600">Loading saved payment settings…</p>}
      {settingsQuery.isError && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <span>{settingsQuery.error instanceof Error ? settingsQuery.error.message : 'Unable to load payment settings.'}</span>
          <button type="button" onClick={() => void settingsQuery.refetch()} className="rounded-lg border border-red-300 px-3 py-1.5 font-semibold">Retry</button>
        </div>
      )}
      {message && (
        <div
          role={messageType === 'error' ? 'alert' : 'status'}
          className={`rounded-xl border p-3 text-sm ${
            messageType === 'error'
              ? 'border-red-200 bg-red-50 text-red-800'
              : messageType === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-tradeflow-gray-200 bg-white text-tradeflow-navy'
          }`}
        >
          {message}
        </div>
      )}

      <form onSubmit={saveSettings} className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)] lg:items-start">
        <section className="space-y-4 rounded-2xl border border-tradeflow-gray-200 bg-white p-5 shadow-sm">
          <label className="block text-sm font-semibold text-tradeflow-navy">
            UPI ID
            <input value={upiId} onChange={(event) => setUpiId(event.target.value)} placeholder="Enter your UPI ID" className="mt-1 w-full rounded-lg border border-tradeflow-gray-200 px-3 py-2 font-normal" />
          </label>
          <label className="block text-sm font-semibold text-tradeflow-navy">
            Account Name
            <input value={accountName} onChange={(event) => setAccountName(event.target.value)} className="mt-1 w-full rounded-lg border border-tradeflow-gray-200 px-3 py-2 font-normal" />
          </label>
          <label className="block text-sm font-semibold text-tradeflow-navy">
            QR Code Image (max 5 MB)
            <input
              ref={qrFileInput}
              type="file"
              accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
              onChange={selectQrImage}
              className="mt-1 block w-full text-sm font-normal"
            />
            <span className="mt-1 block text-xs font-normal text-gray-500">
              {qrImage
                ? `${qrImage.name} is selected but not uploaded yet. Use the button below to save it.`
                : 'Choose a JPG, PNG, or WEBP image. Selecting a file alone does not upload it.'}
            </span>
          </label>
          <div className="space-y-2">
            <button type="submit" disabled={busy || settingsQuery.isLoading || settingsQuery.isError} className="rounded-lg border border-tradeflow-navy px-4 py-2 text-sm font-bold text-tradeflow-navy disabled:opacity-60">
              {busy ? (qrImage ? `Uploading QR… ${uploadProgress}%` : 'Saving…') : qrImage ? 'Upload QR & Save Payment Settings' : 'Save Payment Settings'}
            </button>
            {busy && qrImage && (
              <div role="status" aria-live="polite" className="space-y-1">
                <progress value={uploadProgress} max={100} aria-label="QR image upload progress" className="h-2 w-full accent-emerald-600" />
                <p className="text-xs text-gray-600">Uploading QR image: {uploadProgress}%</p>
              </div>
            )}
            {uploadMessage && (
              <p
                role={uploadMessageType === 'error' ? 'alert' : 'status'}
                className={`text-xs ${
                  uploadMessageType === 'error'
                    ? 'text-red-700'
                    : uploadMessageType === 'success'
                      ? 'text-emerald-700'
                      : 'text-gray-500'
                }`}
              >
                {uploadMessage}
              </p>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={qrPaymentsEnabled} onChange={(event) => setQrPaymentsEnabled(event.target.checked)} /> Enable QR payments</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={upiIdPaymentsEnabled} onChange={(event) => setUpiIdPaymentsEnabled(event.target.checked)} /> Enable UPI ID payments</label>
          </div>
          <label className="block text-sm font-semibold text-tradeflow-navy">
            QR Session (minutes)
            <input type="number" min={1} max={60} value={qrSessionMinutes} onChange={(event) => setQrSessionMinutes(Number(event.target.value))} className="mt-1 block w-28 rounded-lg border border-tradeflow-gray-200 px-3 py-2 font-normal" />
          </label>
          <fieldset className="space-y-2 rounded-xl border border-tradeflow-gray-200 p-4">
            <legend className="px-1 text-sm font-bold text-tradeflow-navy">Additional payment methods</legend>
            {[
              ['NET_BANKING', 'Net Banking'],
              ['CASH_DEPOSIT', 'Cash Deposit'],
              ['CHEQUE', 'Cheque'],
            ].map(([value, label]) => (
              <label key={value} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={additionalPaymentMethods.includes(value)}
                  disabled={!bankDetailsVerified}
                  onChange={() => toggleAdditionalMethod(value)}
                />
                {label}
              </label>
            ))}
            <p className="text-xs text-gray-500">
              {bankDetailsVerified
                ? 'Bank details are approved. Select the bank payment methods you want to offer.'
                : savedBankDetails?.verificationStatus === 'APPROVED'
                  ? 'Bank details are approved. Bank payment methods remain disabled until your KYC is approved.'
                  : 'Bank payments stay disabled until a Superadmin approves your bank details.'}
            </p>
          </fieldset>
          <label className="block text-sm font-semibold text-tradeflow-navy">
            Payment OTP Limit (₹)
            <input type="number" min={0} step="0.01" value={paymentOtpLimit} onChange={(event) => setPaymentOtpLimit(Number(event.target.value))} className="mt-1 block w-full rounded-lg border border-tradeflow-gray-200 px-3 py-2 font-normal" />
            <span className="mt-1 block text-xs font-normal text-gray-500">Approvals above this amount require a code sent to your registered mobile.</span>
          </label>
          <p className="rounded-lg bg-blue-50 p-3 text-xs text-blue-900">Test the QR with a UPI app before enabling. Expiry closes the retailer&apos;s QR session.</p>
          <button disabled={busy || settingsQuery.isLoading || settingsQuery.isError} className="rounded-lg bg-tradeflow-navy px-4 py-2 text-sm font-bold text-white disabled:opacity-60">{busy ? (qrImage ? `Uploading QR… ${uploadProgress}%` : 'Saving…') : 'Save Payment Settings'}</button>
        </section>
        <aside className="space-y-4">
          <section className="rounded-2xl border border-tradeflow-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-bold text-tradeflow-navy">QR Code</h2>
                <p className="mt-1 text-xs text-gray-500">Your saved code, ready for connected retailers to scan.</p>
              </div>
              {settings?.qrPaymentsEnabled && (
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">Enabled</span>
              )}
            </div>
            {settings?.qrImageUrl || settings?.qrDataUrl ? (
              <div className="mt-4 flex justify-center rounded-xl border border-tradeflow-gray-200 bg-gray-50 p-4">
                <img src={settings.qrImageUrl || settings.qrDataUrl} alt="Your UPI QR code" className="h-60 w-60 max-w-full rounded-lg bg-white object-contain p-2" />
              </div>
            ) : (
              <div className="mt-4 flex min-h-40 flex-col items-center justify-center rounded-xl border border-dashed border-tradeflow-gray-200 bg-gray-50 px-4 text-center">
                <QrCode className="h-8 w-8 text-gray-400" />
                <p className="mt-2 text-sm font-medium text-gray-600">No QR image uploaded</p>
                <p className="mt-1 text-xs text-gray-500">Upload one in the settings form to display it here.</p>
              </div>
            )}
            {settings?.hasQrImage && <p className="mt-3 flex items-center justify-center gap-1 text-xs text-emerald-700"><ShieldCheck className="h-4 w-4" /> Private to you and your linked retailers</p>}
          </section>

          {settings?.upiId?.trim() && (
            <section className="rounded-2xl border border-tradeflow-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-tradeflow-green/10 p-2 text-tradeflow-green"><CreditCard className="h-4 w-4" /></div>
                <div className="min-w-0 flex-1">
                  <h2 className="font-bold text-tradeflow-navy">UPI Payment Details</h2>
                  <p className="mt-1 break-all text-sm font-semibold text-gray-800">{settings.upiId}</p>
                  <p className="mt-1 text-xs text-gray-500">{settings.upiIdPaymentsEnabled ? 'UPI payments are enabled.' : 'UPI ID payments are currently disabled.'}</p>
                </div>
                <button type="button" onClick={() => void copySavedUpiId()} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-tradeflow-gray-200 px-3 py-2 text-xs font-semibold text-tradeflow-navy hover:bg-gray-50">
                  <Copy className="h-3.5 w-3.5" /> Copy
                </button>
              </div>
            </section>
          )}

          <section className="rounded-2xl border border-tradeflow-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="rounded-lg bg-tradeflow-green/10 p-2 text-tradeflow-green"><CreditCard className="h-4 w-4" /></div>
                  <h2 className="font-bold text-tradeflow-navy">Bank Account Details</h2>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${bankDetailsVerified ? 'bg-emerald-50 text-emerald-700' : savedBankDetails?.verificationStatus === 'REJECTED' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>
                  {bankDetailsVerified ? 'Approved' : savedBankDetails?.verificationStatus === 'REJECTED' ? 'Rejected' : savedBankDetails?.verificationStatus === 'PENDING' ? 'Pending review' : 'Not submitted'}
                </span>
              </div>
              {hasSavedBankDetails && savedBankDetails ? (
                <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                  {savedBankDetails.accountHolderName && <div className="col-span-2"><dt className="text-xs text-gray-500">Account Holder</dt><dd className="mt-0.5 font-semibold text-tradeflow-navy">{savedBankDetails.accountHolderName}</dd></div>}
                  {savedBankDetails.bankName && <div><dt className="text-xs text-gray-500">Bank Name</dt><dd className="mt-0.5 font-semibold text-tradeflow-navy">{savedBankDetails.bankName}</dd></div>}
                  {savedBankDetails.accountNumber && <div><dt className="text-xs text-gray-500">Account Number</dt><dd className="mt-0.5 font-semibold text-tradeflow-navy">••••••••{savedBankDetails.accountNumber.slice(-4)}</dd></div>}
                  {savedBankDetails.ifscCode && <div><dt className="text-xs text-gray-500">IFSC Code</dt><dd className="mt-0.5 font-semibold text-tradeflow-navy">{savedBankDetails.ifscCode}</dd></div>}
                  {savedBankDetails.branch && <div><dt className="text-xs text-gray-500">Branch Name</dt><dd className="mt-0.5 font-semibold text-tradeflow-navy">{savedBankDetails.branch}</dd></div>}
                </dl>
              ) : (
                <p className="mt-3 text-sm text-gray-500">No bank details have been submitted.</p>
              )}
              {savedBankDetails?.verificationStatus === 'REJECTED' && savedBankDetails.rejectionReason && (
                <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">
                  Rejection reason: {savedBankDetails.rejectionReason}
                </p>
              )}
              {!bankDetailsVerified && (
                <p className="mt-3 text-xs text-amber-700">
                  {savedBankDetails?.verificationStatus === 'PENDING'
                    ? 'Your bank details are awaiting Superadmin review. Bank transfer remains disabled.'
                    : 'Bank transfer is available after your bank details and KYC are approved.'}
                </p>
              )}
              <button
                type="button"
                onClick={() => {
                  setConfirmAccountNumber('');
                  setBankEditorOpen((open) => !open);
                }}
                className="mt-4 rounded-lg border border-tradeflow-navy px-4 py-2 text-sm font-bold text-tradeflow-navy"
              >
                Add / Update Bank Details
              </button>
            </section>
        </aside>
      </form>

      {bankEditorOpen && (
        <form onSubmit={submitBankDetails} className="space-y-4 rounded-2xl border border-tradeflow-gray-200 bg-white p-5 shadow-sm">
          <div>
            <h2 className="text-lg font-bold text-tradeflow-navy">
              {savedBankDetails?.verificationStatus === 'REJECTED' ? 'Correct and Resubmit Bank Details' : 'Add / Update Bank Details'}
            </h2>
            <p className="mt-1 text-sm text-gray-500">These details are stored with your wholesaler profile and reviewed separately from KYC.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              ['accountHolderName', 'Account Holder Name'],
              ['bankName', 'Bank Name'],
              ['accountNumber', 'Account Number'],
              ['ifscCode', 'IFSC Code'],
              ['branch', 'Branch Name'],
            ].map(([key, label]) => (
              <label key={key} className="block text-sm font-semibold text-tradeflow-navy">
                {label}
                <input
                  required
                  value={bankDetails[key as keyof typeof bankDetails]}
                  onChange={(event) => {
                    setBankDetails((current) => ({ ...current, [key]: event.target.value }));
                    if (key === 'accountNumber') setConfirmAccountNumber('');
                  }}
                  autoComplete="off"
                  maxLength={key === 'accountNumber' ? 18 : key === 'ifscCode' ? 11 : 100}
                  inputMode={key === 'accountNumber' ? 'numeric' : 'text'}
                  className="mt-1 w-full rounded-lg border border-tradeflow-gray-200 px-3 py-2 font-normal"
                />
              </label>
            ))}
            {(!savedBankDetails?.accountNumber ||
              bankDetails.accountNumber.trim() !== savedBankDetails.accountNumber) && (
              <label className="block text-sm font-semibold text-tradeflow-navy">
                Confirm Account Number
                <input
                  required
                  value={confirmAccountNumber}
                  onChange={(event) => setConfirmAccountNumber(event.target.value)}
                  autoComplete="off"
                  inputMode="numeric"
                  maxLength={18}
                  className="mt-1 w-full rounded-lg border border-tradeflow-gray-200 px-3 py-2 font-normal"
                />
              </label>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={bankBusy} className="rounded-lg bg-tradeflow-navy px-4 py-2 text-sm font-bold text-white disabled:opacity-60">
              {bankBusy ? 'Submitting…' : savedBankDetails?.verificationStatus === 'REJECTED' ? 'Resubmit Bank Details' : 'Submit Bank Details'}
            </button>
            <button type="button" onClick={() => setBankEditorOpen(false)} disabled={bankBusy} className="rounded-lg border border-tradeflow-gray-200 px-4 py-2 text-sm font-semibold text-gray-700">
              Cancel
            </button>
          </div>
        </form>
      )}

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
                <p className="mt-1 text-xs text-gray-500">{report.paymentMethod} · Ref: {report.transactionReference} · {report.paymentDetails || (report.isCreditRepayment ? 'Credit repayment' : report.orderId?.orderNumber || 'Order payment')} · {report.status}</p>
                {report.reviewNote && <p className="mt-1 text-xs text-amber-700">{report.reviewNote}</p>}
                {report.isReversal && <p className="mt-1 text-xs text-red-700">Reverse entry · {report.reversalReason}</p>}
              </div>
              <div className="flex flex-wrap gap-2">
                {report.screenshotAvailable && <button onClick={() => void openEvidence(report._id)} className="rounded-lg border px-3 py-2 text-xs font-bold">View evidence</button>}
                {report.status === 'PENDING' && <>
                  <button onClick={() => void review(report._id, 'VERIFY')} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white"><CheckCircle2 className="h-4 w-4" /> Confirm received</button>
                  <button onClick={() => void review(report._id, 'REJECT')} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-700">Reject</button>
                </>}
                {report.status === 'PAID' && !report.isReversal && !report.wasReversed && (
                  <button onClick={() => void reverse(report._id)} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-700">Reverse entry</button>
                )}
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
            {evidenceContentType === 'application/pdf'
              ? <iframe src={evidenceUrl} title="Retailer-submitted payment receipt" className="h-[75vh] w-full" />
              : <img src={evidenceUrl} alt="Retailer-submitted payment screenshot" className="mx-auto max-h-[75vh] max-w-full object-contain" />}
          </div>
        </div>
      )}
    </div>
  );
}
