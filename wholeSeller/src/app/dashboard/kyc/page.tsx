'use client';

import React, { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, ArrowUpFromLine, CheckCircle2, Clock3, FileCheck2, FileImage, LoaderCircle, ShieldCheck } from 'lucide-react';
import { useWholesaler } from '@/context/WholesalerContext';
import api from '@/lib/api';
import { wholesalerQueryKeys } from '@/lib/query-client';

const emptyForm = {
  businessName: '',
  ownerName: '',
  businessType: 'Proprietorship',
  pan: '',
  hasGst: false,
  gstin: '',
  street: '',
  city: '',
  state: '',
  pincode: '',
  accountHolderName: '',
  accountNumber: '',
  ifscCode: '',
  bankName: '',
  branch: '',
};

const inputClass = 'w-full rounded-md border border-tradeflow-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-tradeflow-green';
const fieldClass = 'space-y-1.5';
const documentSlots = [
  { key: 'panCard', type: 'PAN_CARD', title: 'PAN card', side: 'Front side' },
  { key: 'aadhaarFront', type: 'AADHAAR_FRONT', title: 'Aadhaar card', side: 'Front side' },
  { key: 'aadhaarBack', type: 'AADHAAR_BACK', title: 'Aadhaar card', side: 'Back side' },
] as const;
type DocumentKey = (typeof documentSlots)[number]['key'];
type KycDocument = { _id?: string; id?: string; documentType: string; originalName?: string; mimeType?: string };
type DocumentFiles = Record<DocumentKey, File | null>;
const emptyDocumentFiles: DocumentFiles = { panCard: null, aadhaarFront: null, aadhaarBack: null };

export default function KycPage() {
  const { profile, updateProfile } = useWholesaler();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm);
  const [documentFiles, setDocumentFiles] = useState<DocumentFiles>(emptyDocumentFiles);
  const [existingDocuments, setExistingDocuments] = useState<KycDocument[]>([]);
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  const [status, setStatus] = useState(profile.kycStatus || 'DRAFT');
  const [reviewReason, setReviewReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const kycQuery = useQuery({
    queryKey: wholesalerQueryKeys.resource(profile.id || 'unknown', 'kyc'),
    queryFn: () => api.getMyKyc(),
    enabled: Boolean(profile.id),
    staleTime: 0,
    gcTime: 0,
  });
  const loading = kycQuery.isLoading;

  useEffect(() => {
    const application = kycQuery.data?.data || {};
    if (kycQuery.data) {
      const nextStatus = application.status || 'DRAFT';
      setStatus(nextStatus);
      setReviewReason(application.reviewReason || '');
      setExistingDocuments(application.documents || []);
      const hasGst = application.hasGst !== undefined ? Boolean(application.hasGst) : Boolean(application.gstin || profile.gstin);
      updateProfile({ kycStatus: nextStatus });
      setForm({
        businessName: application.businessName || profile.businessName || '',
        ownerName: application.ownerName || profile.ownerName || '',
        businessType: application.businessType || 'Proprietorship',
        pan: application.pan || '',
        hasGst,
        gstin: application.gstin || profile.gstin || '',
        street: application.registeredAddress?.street || profile.streetAddress || '',
        city: application.registeredAddress?.city || profile.city || '',
        state: application.registeredAddress?.state || profile.state || '',
        pincode: application.registeredAddress?.pincode || profile.pincode || '',
        accountHolderName: application.bankDetails?.accountHolderName || profile.businessName || '',
        accountNumber: application.bankDetails?.accountNumber || profile.accountNumber || '',
        ifscCode: application.bankDetails?.ifscCode || profile.ifscCode || '',
        bankName: application.bankDetails?.bankName || profile.bankName || '',
        branch: application.bankDetails?.branch || '',
      });
    }
    if (kycQuery.error) setError(kycQuery.error.message || 'Unable to load KYC details.');
  }, [kycQuery.data, kycQuery.error, profile.accountNumber, profile.bankName, profile.businessName, profile.city, profile.gstin, profile.ifscCode, profile.ownerName, profile.pincode, profile.state, profile.streetAddress, updateProfile]);

  useEffect(() => {
    let active = true;
    const objectUrls: string[] = [];
    const nextPreviews: Record<string, string> = {};
    Object.entries(documentFiles).forEach(([key, file]) => {
      if (!file) return;
      const url = URL.createObjectURL(file);
      objectUrls.push(url);
      nextPreviews[`local:${key}`] = url;
    });
    setPreviewUrls(nextPreviews);

    Promise.all(existingDocuments.map(async (document) => {
      const id = String(document._id || document.id || '');
      if (!id || !document.mimeType?.startsWith('image/')) return null;
      try {
        const blob = await api.getKycDocument(id);
        if (!active) return null;
        const url = URL.createObjectURL(blob);
        objectUrls.push(url);
        return [id, url] as const;
      } catch {
        return null;
      }
    })).then((entries) => {
      if (!active) return;
      setPreviewUrls((current) => ({ ...current, ...Object.fromEntries(entries.filter(Boolean) as [string, string][]) }));
    });

    return () => {
      active = false;
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [documentFiles, existingDocuments]);

  const changeField = (field: keyof typeof emptyForm) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
  };

  const changeDocument = (key: DocumentKey) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Choose a JPG, PNG, or WEBP image for each identity document.');
      event.target.value = '';
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('Each document image must be 10 MB or smaller.');
      event.target.value = '';
      return;
    }
    setError('');
    setDocumentFiles((current) => ({ ...current, [key]: file }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    // 1. PAN Validation (10 characters: 5 letters, 4 digits, 1 letter)
    const cleanPan = form.pan.trim().toUpperCase();
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    if (!cleanPan || !panRegex.test(cleanPan)) {
      setError('Please enter a valid 10-character Indian PAN number (e.g. ABCDE1234F). Codes like "567SDF" or "12345" are invalid.');
      return;
    }

    // 2. GST Validation (if hasGst is true)
    if (form.hasGst) {
      const cleanGst = form.gstin.trim().toUpperCase();
      if (!cleanGst) {
        setError('Please enter your GST number or select No if you do not have one.');
        return;
      }
      const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
      if (!gstRegex.test(cleanGst)) {
        setError('Enter a valid 15-character Indian GSTIN (e.g. 22AAAAA0000A1Z5).');
        return;
      }
    }

    // 3. PIN Code Validation (6 numeric digits)
    const cleanPincode = form.pincode.trim();
    if (!cleanPincode || !/^\d{6}$/.test(cleanPincode)) {
      setError('Please enter a valid 6-digit Indian PIN code (e.g. 302018).');
      return;
    }

    // 4. Bank Account Number Validation (9 to 18 numeric digits)
    const cleanAccountNumber = form.accountNumber.trim();
    if (!cleanAccountNumber || !/^\d{9,18}$/.test(cleanAccountNumber)) {
      setError('Please enter a valid Bank Account Number (must be between 9 and 18 numeric digits).');
      return;
    }

    // 5. IFSC Code Validation (11 characters: 4 letters + 0 + 6 alphanumeric)
    const cleanIfsc = form.ifscCode.trim().toUpperCase();
    const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
    if (!cleanIfsc || !ifscRegex.test(cleanIfsc)) {
      setError('Please enter a valid 11-character Indian IFSC code (e.g. SBIN0001234 or PUNB0123400). Code like "567SDF" is invalid.');
      return;
    }

    // 6. Identity documents check
    const missingDocument = documentSlots.find((slot) => (
      !documentFiles[slot.key] && !existingDocuments.some((document) => document.documentType === slot.type)
    ));
    if (missingDocument) {
      setError(`Please upload a clear image for ${missingDocument.title} (${missingDocument.side}).`);
      return;
    }

    setSaving(true);
    try {
      const submission = new FormData();
      const formFields = {
        businessName: form.businessName.trim(),
        ownerName: form.ownerName.trim(),
        businessType: form.businessType,
        pan: cleanPan,
        hasGst: String(form.hasGst),
        gstin: form.hasGst ? form.gstin.trim().toUpperCase() : '',
        address: form.street.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        pincode: cleanPincode,
        accountHolderName: form.accountHolderName.trim(),
        accountNumber: cleanAccountNumber,
        ifscCode: cleanIfsc,
        bankName: form.bankName.trim(),
        branch: form.branch.trim(),
      };
      Object.entries(formFields).forEach(([key, value]) => submission.append(key, value));
      documentSlots.forEach((slot) => {
        submission.append(`${slot.key}_type`, slot.type);
        const file = documentFiles[slot.key];
        if (file) submission.append(slot.key, file);
      });

      const response = await api.submitKyc(submission);
      const nextStatus = response?.data?.status || 'SUBMITTED';
      setStatus(nextStatus);
      setReviewReason('');
      updateProfile({ kycStatus: nextStatus });
      await queryClient.invalidateQueries({
        queryKey: wholesalerQueryKeys.resource(profile.id || 'unknown', 'kyc'),
      });
      const refreshed = await kycQuery.refetch();
      setExistingDocuments(refreshed.data?.data?.documents || []);
      setDocumentFiles(emptyDocumentFiles);
    } catch (submitError: any) {
      setError(submitError?.message || 'Unable to submit KYC details.');
    } finally {
      setSaving(false);
    }
  };

  const isLocked = ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED'].includes(status);
  const statusConfig = status === 'APPROVED'
    ? { icon: CheckCircle2, tone: 'border-status-success/25 bg-tradeflow-green-50 text-status-success', title: 'KYC approved', detail: 'You can now add products and categories.' }
    : isLocked
      ? { icon: Clock3, tone: 'border-amber-500/30 bg-amber-50 text-status-warning-foreground', title: 'KYC under review', detail: 'Product and category creation will unlock after approval.' }
      : { icon: AlertCircle, tone: 'border-tradeflow-green/20 bg-tradeflow-green-50 text-green-700', title: status === 'REJECTED' ? 'KYC needs changes' : status === 'RESUBMISSION_REQUIRED' ? 'KYC resubmission requested' : 'Complete your KYC', detail: reviewReason || 'Submit your legal business, address, and bank details for verification.' };
  const StatusIcon = statusConfig.icon;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-col gap-4 border-b border-tradeflow-gray-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-wide text-green-700"><FileCheck2 className="h-4 w-4" /> Account verification</div>
          <h1 className="text-3xl font-extrabold text-tradeflow-navy">Verify your business</h1>
          <p className="mt-1 text-sm text-gray-500">Submit your legal identity and payout details for review.</p>
        </div>
        <div className={`inline-flex w-fit items-center gap-2 rounded-md border px-3 py-2 text-xs font-bold ${statusConfig.tone}`}>
          <StatusIcon className="h-4 w-4" /> {statusConfig.title} <span className="opacity-70">·</span> {status.replace(/_/g, ' ')}
        </div>
      </header>

      {error && <p role="alert" className="border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {loading ? (
        <div className="flex min-h-64 items-center justify-center gap-2 text-sm text-gray-500"><LoaderCircle className="h-4 w-4 animate-spin" /> Loading verification details...</div>
      ) : (
        <form onSubmit={handleSubmit} className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(300px,0.8fr)]">
          <div className="space-y-5">
            <fieldset disabled={isLocked || saving} className="space-y-5 disabled:opacity-75">
              <section className="overflow-hidden rounded-lg border border-tradeflow-gray-200 bg-white shadow-sm">
                <div className="border-b border-tradeflow-gray-200 px-5 py-4">
                  <p className="text-[10px] font-extrabold uppercase tracking-wide text-green-700">01 · Business identity</p>
                  <h2 className="mt-1 text-base font-extrabold text-tradeflow-navy">Legal details</h2>
                </div>
                <div className="grid gap-4 p-5 sm:grid-cols-2">
                  <label className={fieldClass}>Business name *<input required className={inputClass} value={form.businessName} onChange={changeField('businessName')} /></label>
                  <label className={fieldClass}>Owner name *<input required className={inputClass} value={form.ownerName} onChange={changeField('ownerName')} /></label>
                  <label className={fieldClass}>Business type *<select className={inputClass} value={form.businessType} onChange={changeField('businessType')}><option>Proprietorship</option><option>Partnership</option><option>LLP</option><option>Private Limited</option><option>Public Limited</option><option>Other</option></select></label>
                  <label className={fieldClass}>
                    PAN number *
                    <input
                      required
                      maxLength={10}
                      className={`${inputClass} uppercase tracking-wider font-mono`}
                      value={form.pan}
                      onChange={(e) => setForm((curr) => ({ ...curr, pan: e.target.value.toUpperCase().slice(0, 10) }))}
                      placeholder="e.g. ABCDE1234F (10 chars)"
                      autoComplete="off"
                    />
                  </label>
                  
                  <div className={`${fieldClass} sm:col-span-2 rounded-md border border-tradeflow-gray-200 bg-tradeflow-gray-50 p-3.5`}>
                    <p className="text-xs font-bold text-tradeflow-navy">Do you have a GST number? *</p>
                    <div className="flex items-center gap-6 pt-2">
                      <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-tradeflow-navy">
                        <input
                          type="radio"
                          name="hasGst"
                          checked={form.hasGst}
                          onChange={() => setForm((curr) => ({ ...curr, hasGst: true }))}
                          className="h-4 w-4 accent-tradeflow-green"
                        />
                        Yes (GST Registered)
                      </label>
                      <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-tradeflow-navy">
                        <input
                          type="radio"
                          name="hasGst"
                          checked={!form.hasGst}
                          onChange={() => setForm((curr) => ({ ...curr, hasGst: false, gstin: '' }))}
                          className="h-4 w-4 accent-tradeflow-green"
                        />
                        No (Not Registered)
                      </label>
                    </div>
                  </div>

                  {form.hasGst && (
                    <label className={`${fieldClass} sm:col-span-2`}>
                      GSTIN / GST Number *
                      <input
                        required={form.hasGst}
                        className={`${inputClass} uppercase tracking-wider font-mono`}
                        value={form.gstin}
                        onChange={(e) => setForm((curr) => ({ ...curr, gstin: e.target.value.toUpperCase().slice(0, 15) }))}
                        placeholder="e.g. 22AAAAA0000A1Z5 (15 characters)"
                        autoComplete="off"
                        maxLength={15}
                      />
                    </label>
                  )}
                </div>
              </section>

              <section className="overflow-hidden rounded-lg border border-tradeflow-gray-200 bg-white shadow-sm">
                <div className="border-b border-tradeflow-gray-200 px-5 py-4">
                  <p className="text-[10px] font-extrabold uppercase tracking-wide text-green-700">02 · Registered address</p>
                  <h2 className="mt-1 text-base font-extrabold text-tradeflow-navy">Where your business is registered</h2>
                </div>
                <div className="grid gap-4 p-5 sm:grid-cols-2">
                  <label className={`${fieldClass} sm:col-span-2`}>Street address *<input required className={inputClass} value={form.street} onChange={changeField('street')} /></label>
                  <label className={fieldClass}>City *<input required className={inputClass} value={form.city} onChange={changeField('city')} /></label>
                  <label className={fieldClass}>State *<input required className={inputClass} value={form.state} onChange={changeField('state')} /></label>
                  <label className={fieldClass}>
                    PIN code *
                    <input
                      required
                      maxLength={6}
                      className={`${inputClass} font-mono`}
                      value={form.pincode}
                      onChange={(e) => setForm((curr) => ({ ...curr, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
                      placeholder="e.g. 302018 (6 digits)"
                      inputMode="numeric"
                    />
                  </label>
                </div>
              </section>

              <section className="overflow-hidden rounded-lg border border-tradeflow-gray-200 bg-white shadow-sm">
                <div className="border-b border-tradeflow-gray-200 px-5 py-4">
                  <p className="text-[10px] font-extrabold uppercase tracking-wide text-green-700">03 · Payout account</p>
                  <h2 className="mt-1 text-base font-extrabold text-tradeflow-navy">Bank details</h2>
                </div>
                <div className="grid gap-4 p-5 sm:grid-cols-2">
                  <label className={fieldClass}>Account holder name *<input required className={inputClass} value={form.accountHolderName} onChange={changeField('accountHolderName')} /></label>
                  <label className={fieldClass}>
                    Account number *
                    <input
                      required
                      maxLength={18}
                      className={`${inputClass} font-mono`}
                      value={form.accountNumber}
                      onChange={(e) => setForm((curr) => ({ ...curr, accountNumber: e.target.value.replace(/\D/g, '').slice(0, 18) }))}
                      placeholder="9 to 18 digits (numbers only)"
                      autoComplete="off"
                    />
                  </label>
                  <label className={fieldClass}>
                    IFSC code *
                    <input
                      required
                      maxLength={11}
                      className={`${inputClass} uppercase tracking-wider font-mono`}
                      value={form.ifscCode}
                      onChange={(e) => setForm((curr) => ({ ...curr, ifscCode: e.target.value.toUpperCase().slice(0, 11) }))}
                      placeholder="e.g. SBIN0001234 (11 chars)"
                      autoComplete="off"
                    />
                  </label>
                  <label className={fieldClass}>Bank name *<input required className={inputClass} value={form.bankName} onChange={changeField('bankName')} /></label>
                  <label className={fieldClass}>Branch<input className={inputClass} value={form.branch} onChange={changeField('branch')} /></label>
                </div>
              </section>
            </fieldset>

            {!isLocked && (
              <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-md bg-tradeflow-green px-5 py-3 text-sm font-bold text-tradeflow-navy shadow-sm transition-colors hover:bg-tradeflow-green-hover disabled:cursor-wait disabled:opacity-60">
                {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                {saving ? 'Submitting securely...' : status === 'DRAFT' ? 'Submit for verification' : 'Resubmit for verification'}
              </button>
            )}
          </div>

          <aside className="space-y-5 lg:sticky lg:top-24">
            <section className="overflow-hidden rounded-lg border border-tradeflow-gray-200 bg-white shadow-sm">
              <div className="border-b border-tradeflow-gray-200 px-5 py-4">
                <p className="text-[10px] font-extrabold uppercase tracking-wide text-green-700">04 · Identity documents</p>
                <h2 className="mt-1 text-base font-extrabold text-tradeflow-navy">Upload clear card images</h2>
                <p className="mt-1 text-xs text-gray-500">PAN front, Aadhaar front and back. JPG, PNG or WEBP, up to 10 MB each.</p>
              </div>
              <div className="space-y-3 p-4">
                {documentSlots.map((slot) => {
                  const existing = [...existingDocuments].reverse().find((document) => document.documentType === slot.type);
                  const existingId = String(existing?._id || existing?.id || '');
                  const preview = previewUrls[`local:${slot.key}`] || (existingId ? previewUrls[existingId] : '');
                  const selectedFile = documentFiles[slot.key];
                  const labelId = `kyc-document-${slot.key}`;
                  return (
                    <div key={slot.key} className="rounded-md border border-tradeflow-gray-200 bg-tradeflow-gray-50 p-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <div><p className="text-xs font-extrabold text-tradeflow-navy">{slot.title}</p><p className="text-[11px] text-gray-500">{slot.side}</p></div>
                        {existing && !selectedFile && <span className="rounded-sm bg-tradeflow-green-50 px-2 py-1 text-[10px] font-bold text-status-success">On file</span>}
                      </div>
                      <label htmlFor={labelId} className={`group relative flex h-36 cursor-pointer items-center justify-center overflow-hidden rounded border border-dashed ${preview ? 'border-status-success/40 bg-white' : 'border-tradeflow-gray-300 bg-white hover:border-tradeflow-green'}`}>
                        {preview ? <img src={preview} alt={`${slot.title} ${slot.side} preview`} className="h-full w-full object-contain p-2" /> : <span className="flex flex-col items-center gap-2 px-3 text-center text-xs text-gray-500"><FileImage className="h-7 w-7 text-gray-400" /><span>{existing ? 'Loading saved document preview...' : 'Choose an image'}</span></span>}
                        {!isLocked && <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-sm bg-tradeflow-navy/85 px-2 py-1 text-[10px] font-bold text-white"><ArrowUpFromLine className="h-3 w-3" />{selectedFile || !existing ? 'Upload' : 'Replace'}</span>}
                      </label>
                      <input id={labelId} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={isLocked || saving} onChange={changeDocument(slot.key)} />
                      <p className="mt-2 truncate text-[10px] text-gray-500">{selectedFile?.name || existing?.originalName || 'Required for verification'}</p>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-start gap-2 border-t border-tradeflow-gray-200 bg-tradeflow-gray-50 px-4 py-3 text-[11px] leading-relaxed text-gray-600">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-status-success" />
                Your documents are sent securely and only visible to you and authorized reviewers.
              </div>
            </section>

            <section className={`rounded-lg border p-4 ${statusConfig.tone}`}>
              <div className="flex items-start gap-3"><StatusIcon className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="text-sm font-extrabold">{statusConfig.title}</p><p className="mt-1 text-xs leading-relaxed">{reviewReason || statusConfig.detail}</p></div></div>
            </section>
          </aside>
        </form>
      )}
    </div>
  );
}