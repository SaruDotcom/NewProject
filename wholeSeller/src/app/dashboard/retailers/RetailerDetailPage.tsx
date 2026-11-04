'use client';

import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  Mail,
  MapPin,
  PackageCheck,
  Phone,
  ShieldCheck,
  Store,
  UserRound,
} from 'lucide-react';
import api from '@/lib/api';

type RetailerDetails = {
  id: string;
  retailerId: string;
  businessName: string;
  contactPerson: string;
  businessType?: string;
  category?: string;
  email?: string;
  phone?: string;
  gstin?: string;
  gstStatus?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  status?: string;
  accountStatus?: string;
  profileComplete?: boolean;
  creditLimit?: number;
  outstandingAmount?: number;
  totalOrdersCount?: number;
  totalSpent?: number;
  joinedAt?: string;
  createdAt?: string;
  lastLoginAt?: string | null;
  registrationSource?: string;
  profile?: {
    businessName?: string;
    ownerName?: string;
    businessType?: string;
    category?: string;
    gstin?: string;
    gstStatus?: string;
    address?: { street?: string; city?: string; state?: string; pincode?: string };
    registrationSource?: string;
    createdAt?: string;
    pan?: { number?: string; last4?: string; hasImage?: boolean };
    aadhaar?: { last4?: string; hasFrontImage?: boolean; hasBackImage?: boolean };
    shopPhoto?: { hasImage?: boolean };
    verificationStatus?: string;
    verificationNote?: string;
    documentsSubmitted?: boolean;
  } | null;
  orders?: Array<{
    _id?: string;
    id?: string;
    orderNumber?: string;
    createdAt?: string;
    grandTotal?: number;
    totalAmount?: number;
    orderStatus?: string;
    status?: string;
  }>;
};

const money = (value?: number) =>
  `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

function displayDate(value?: string | null) {
  if (!value) return 'Not available';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not available' : date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function InfoTile({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-[#fbfaf7] p-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-stone-400">{label}</p>
      <p className="mt-1.5 break-words text-sm font-semibold text-[#263b31]">{value || 'Not provided'}</p>
    </div>
  );
}

function PrivateDocumentViewer({
  retailerId,
  documentType,
  onClose,
}: {
  retailerId: string;
  documentType: string;
  onClose: () => void;
}) {
  const [url, setUrl] = useState('');
  const [mimeType, setMimeType] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    let objectUrl = '';
    void api.getRetailerDocument(retailerId, documentType)
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
        setMimeType(blob.type);
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load this document.');
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [documentType, retailerId]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#17251e]/70 p-4" role="dialog" aria-modal="true" aria-label="Retailer document">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-stone-400">Private document</p>
            <h2 className="mt-1 text-sm font-semibold capitalize text-[#263b31]">{documentType.replace(/-/g, ' ')}</h2>
          </div>
          <div className="flex items-center gap-2">
            {url && (
              <a href={url} download={`${documentType}.${mimeType === 'application/pdf' ? 'pdf' : 'jpg'}`} className="rounded-lg border border-stone-200 px-3 py-2 text-xs font-semibold text-[#314c3f]">
                Download
              </a>
            )}
            <button type="button" onClick={onClose} className="rounded-lg border border-stone-200 px-3 py-2 text-xs font-semibold text-stone-600">Close</button>
          </div>
        </div>
        <div className="flex min-h-[50vh] flex-1 items-center justify-center overflow-auto bg-[#f7f6f2] p-5">
          {error ? (
            <p role="alert" className="text-sm font-medium text-rose-700">{error}</p>
          ) : !url ? (
            <p role="status" className="text-sm text-stone-500">Loading secure document…</p>
          ) : mimeType === 'application/pdf' ? (
            <iframe title={`${documentType} PDF`} src={url} className="h-[70vh] w-full rounded-lg bg-white" />
          ) : (
            <img src={url} alt={`${documentType} document`} className="max-h-[70vh] max-w-full object-contain" />
          )}
        </div>
      </div>
    </div>
  );
}

export default function RetailerDetailPage() {
  const { relationshipId } = useParams<{ relationshipId: string }>();
  const [retailer, setRetailer] = useState<RetailerDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [fullAadhaar, setFullAadhaar] = useState('');
  const [aadhaarLoading, setAadhaarLoading] = useState(false);
  const [verificationNote, setVerificationNote] = useState('');
  const [verificationSaving, setVerificationSaving] = useState(false);
  const [documentType, setDocumentType] = useState<string | null>(null);
  const profile = retailer?.profile;

  useEffect(() => {
    if (!relationshipId) {
      setError('Retailer relationship was not specified.');
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    setError('');
    setRetailer(null);
    setFullAadhaar('');
    setVerificationNote('');
    void api.getRetailerDetails(relationshipId)
      .then((response) => {
        if (active) setRetailer(response.data);
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load retailer details.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [relationshipId, retry]);

  const revealAadhaar = async () => {
    if (!retailer?.retailerId) return;
    setAadhaarLoading(true);
    setError('');
    try {
      const response = await api.getFullRetailerAadhaar(retailer.retailerId);
      setFullAadhaar(response.data.number);
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to show Aadhaar number.');
    } finally {
      setAadhaarLoading(false);
    }
  };

  const updateVerification = async (status: 'VERIFIED' | 'REJECTED') => {
    if (!retailer?.retailerId) return;
    setVerificationSaving(true);
    setError('');
    try {
      await api.updateRetailerVerification(retailer.retailerId, status, verificationNote);
      setRetailer((current) => current ? {
        ...current,
        profile: current.profile ? {
          ...current.profile,
          verificationStatus: status,
          verificationNote,
        } : current.profile,
      } : current);
      setVerificationNote('');
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to update verification status.');
    } finally {
      setVerificationSaving(false);
    }
  };

  const verificationStatus = profile?.verificationStatus || 'NOT_SUBMITTED';
  const verificationLabel = verificationStatus === 'VERIFIED'
    ? 'Verified'
    : verificationStatus === 'SUBMITTED'
      ? 'Submitted for review'
      : verificationStatus === 'REJECTED'
        ? 'Changes requested'
        : 'Not submitted';

  if (loading) {
    return <div role="status" className="rounded-2xl border border-stone-200 bg-white px-6 py-20 text-center text-sm text-stone-500">Loading retailer profile…</div>;
  }

  if (error && !retailer) {
    return (
      <section className="rounded-2xl border border-rose-200 bg-white p-8 text-center">
        <p role="alert" className="text-sm font-semibold text-rose-700">{error}</p>
        <div className="mt-5 flex justify-center gap-2">
          <button type="button" onClick={() => setRetry((value) => value + 1)} className="rounded-lg bg-[#314c3f] px-4 py-2 text-xs font-semibold text-white">Try again</button>
          <Link to="/dashboard/retailers" className="rounded-lg border border-stone-200 px-4 py-2 text-xs font-semibold text-stone-600">Back to retailers</Link>
        </div>
      </section>
    );
  }

  if (!retailer) return null;

  return (
    <main className="space-y-6 pb-8">
      <Link to="/dashboard/retailers" className="inline-flex items-center gap-2 text-xs font-semibold text-stone-500 transition hover:text-[#314c3f]">
        <ArrowLeft className="size-4" /> All retailers
      </Link>

      <header className="overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm">
        <div className="h-1.5 bg-gradient-to-r from-[#314c3f] via-[#81917f] to-[#c3aa76]" />
        <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div className="flex min-w-0 items-center gap-4">
            <div className="grid size-14 shrink-0 place-items-center rounded-2xl bg-[#edf2ed] text-[#314c3f] sm:size-16">
              <Store className="size-7" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#829083]">Retailer profile</p>
              <h1 className="mt-1 truncate font-serif text-2xl font-semibold tracking-tight text-[#23372d] sm:text-3xl">
                {profile?.businessName || retailer.businessName || 'Retailer'}
              </h1>
              <p className="mt-1 text-sm text-stone-500">{profile?.ownerName || retailer.contactPerson || 'Business contact not provided'}</p>
            </div>
          </div>
          <span className={`inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${
            retailer.status === 'ACTIVE'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-stone-200 bg-stone-50 text-stone-600'
          }`}>
            <span className={`size-1.5 rounded-full ${retailer.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-stone-400'}`} />
            {retailer.status || 'Connected'}
          </span>
        </div>
        <div className="grid border-t border-stone-100 sm:grid-cols-3">
          {[
            ['Orders with your business', String(retailer.totalOrdersCount ?? retailer.orders?.length ?? 0)],
            ['Total purchases', money(retailer.totalSpent)],
            ['Outstanding balance', money(retailer.outstandingAmount)],
          ].map(([label, value], index) => (
            <div key={label} className={`px-5 py-4 sm:px-8 ${index > 0 ? 'border-t border-stone-100 sm:border-l sm:border-t-0' : ''}`}>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-stone-400">{label}</p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-[#263b31]">{value}</p>
            </div>
          ))}
        </div>
      </header>

      {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}

      <section className="grid gap-5 xl:grid-cols-2">
        <article className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-4 flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-xl bg-[#edf2ed] text-[#496451]"><Building2 className="size-4" /></span>
            <div>
              <h2 className="text-base font-semibold text-[#263b31]">Business information</h2>
              <p className="text-xs text-stone-500">Registration and store details</p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <InfoTile label="Business type" value={profile?.businessType || retailer.businessType} />
            <InfoTile label="Category" value={profile?.category || retailer.category} />
            <InfoTile label="GSTIN" value={profile?.gstin || retailer.gstin} />
            <InfoTile label="GST status" value={profile?.gstStatus || retailer.gstStatus} />
            <InfoTile label="Registration source" value={profile?.registrationSource || retailer.registrationSource} />
            <InfoTile label="Joined" value={displayDate(profile?.createdAt || retailer.joinedAt || retailer.createdAt)} />
            <InfoTile label="Profile status" value={retailer.profileComplete ? 'Complete' : 'In progress'} />
            <InfoTile label="Last login" value={retailer.lastLoginAt ? new Date(retailer.lastLoginAt).toLocaleString('en-IN') : 'Not available'} />
          </div>
        </article>

        <article className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-4 flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-xl bg-[#f4f0e7] text-[#8b7549]"><MapPin className="size-4" /></span>
            <div>
              <h2 className="text-base font-semibold text-[#263b31]">Contact &amp; location</h2>
              <p className="text-xs text-stone-500">Reach the retailer directly</p>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-start gap-3 rounded-xl border border-stone-200 p-3.5">
              <UserRound className="mt-0.5 size-4 text-stone-400" />
              <div><p className="text-[10px] font-bold uppercase tracking-wide text-stone-400">Contact person</p><p className="mt-1 text-sm font-semibold text-[#263b31]">{profile?.ownerName || retailer.contactPerson || 'Not provided'}</p></div>
            </div>
            <div className="flex items-start gap-3 rounded-xl border border-stone-200 p-3.5">
              <Phone className="mt-0.5 size-4 text-stone-400" />
              <div><p className="text-[10px] font-bold uppercase tracking-wide text-stone-400">Phone</p>{retailer.phone ? <a href={`tel:${retailer.phone}`} className="mt-1 block text-sm font-semibold text-[#314c3f] hover:underline">{retailer.phone}</a> : <p className="mt-1 text-sm text-stone-500">Not provided</p>}</div>
            </div>
            <div className="flex items-start gap-3 rounded-xl border border-stone-200 p-3.5">
              <Mail className="mt-0.5 size-4 text-stone-400" />
              <div><p className="text-[10px] font-bold uppercase tracking-wide text-stone-400">Email</p>{retailer.email ? <a href={`mailto:${retailer.email}`} className="mt-1 block break-all text-sm font-semibold text-[#314c3f] hover:underline">{retailer.email}</a> : <p className="mt-1 text-sm text-stone-500">Not provided</p>}</div>
            </div>
            <div className="flex items-start gap-3 rounded-xl border border-stone-200 p-3.5">
              <MapPin className="mt-0.5 size-4 text-stone-400" />
              <div><p className="text-[10px] font-bold uppercase tracking-wide text-stone-400">Business address</p><p className="mt-1 text-sm font-semibold text-[#263b31]">{[
                profile?.address?.street || retailer.address,
                profile?.address?.city || retailer.city,
                profile?.address?.state || retailer.state,
                profile?.address?.pincode || retailer.pincode,
              ].filter(Boolean).join(', ') || 'Not provided'}</p></div>
            </div>
          </div>
        </article>
      </section>

      <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-xl bg-[#f4f0e7] text-[#8b7549]"><ShieldCheck className="size-4" /></span>
            <div>
              <h2 className="text-base font-semibold text-[#263b31]">Identity &amp; verification</h2>
              <p className="text-xs text-stone-500">Sensitive information is protected and revealed only on request</p>
            </div>
          </div>
          <span className="rounded-full border border-stone-200 bg-[#fbfaf7] px-3 py-1.5 text-xs font-semibold text-stone-600">{verificationLabel}</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <InfoTile label="PAN number" value={profile?.pan?.number || (profile?.pan?.last4 ? `••••••${profile.pan.last4}` : 'Not provided')} />
          <div className="rounded-xl border border-stone-200 bg-[#fbfaf7] p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-stone-400">Aadhaar number</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm font-semibold text-[#263b31]">
              <span>{fullAadhaar || (profile?.aadhaar?.last4 ? `•••• •••• ${profile.aadhaar.last4}` : 'Not provided')}</span>
              {profile?.aadhaar?.last4 && !fullAadhaar && (
                <button type="button" onClick={() => void revealAadhaar()} disabled={aadhaarLoading} className="text-xs text-[#496451] underline disabled:opacity-50">
                  {aadhaarLoading ? 'Loading…' : 'Reveal'}
                </button>
              )}
            </div>
          </div>
          <InfoTile label="Documents submitted" value={profile?.documentsSubmitted ? 'Yes' : 'No'} />
          <InfoTile label="Verification note" value={profile?.verificationNote} />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {([
            ['shop-photo', 'Shop photo', profile?.shopPhoto?.hasImage],
            ['pan', 'PAN document', profile?.pan?.hasImage],
            ['aadhaar-front', 'Aadhaar front', profile?.aadhaar?.hasFrontImage],
            ['aadhaar-back', 'Aadhaar back', profile?.aadhaar?.hasBackImage],
          ] as const).map(([type, label, available]) => (
            <button key={type} type="button" disabled={!available} onClick={() => setDocumentType(type)} className="inline-flex items-center gap-2 rounded-lg border border-stone-200 px-3 py-2 text-xs font-semibold text-[#314c3f] hover:bg-[#f7f8f6] disabled:cursor-not-allowed disabled:text-stone-400">
              <FileText className="size-3.5" /> {available ? `View ${label}` : `${label}: Not provided`}
            </button>
          ))}
        </div>
        {profile?.verificationStatus === 'SUBMITTED' && (
          <div className="mt-5 border-t border-stone-100 pt-4">
            <label htmlFor="verification-note" className="text-xs font-semibold text-stone-600">Verification note</label>
            <textarea id="verification-note" value={verificationNote} onChange={(event) => setVerificationNote(event.target.value)} maxLength={1000} rows={2} placeholder="Add a note if requesting a re-upload" className="mt-2 w-full rounded-xl border border-stone-200 p-3 text-sm outline-none focus:border-[#81917f]" />
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" disabled={verificationSaving} onClick={() => void updateVerification('VERIFIED')} className="inline-flex items-center gap-2 rounded-lg bg-[#314c3f] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"><CheckCircle2 className="size-3.5" /> Mark verified</button>
              <button type="button" disabled={verificationSaving || !verificationNote.trim()} onClick={() => void updateVerification('REJECTED')} className="rounded-lg border border-amber-300 px-3 py-2 text-xs font-semibold text-amber-800 disabled:opacity-50">Request re-upload</button>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-4 flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-xl bg-[#edf2ed] text-[#496451]"><PackageCheck className="size-4" /></span>
          <div>
            <h2 className="text-base font-semibold text-[#263b31]">Orders with your business</h2>
            <p className="text-xs text-stone-500">{retailer.orders?.length || 0} recent orders</p>
          </div>
        </div>
        {retailer.orders?.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead><tr className="border-b border-stone-200 text-[10px] font-bold uppercase tracking-wide text-stone-400"><th className="pb-3 pr-4">Order</th><th className="pb-3 pr-4">Date</th><th className="pb-3 pr-4">Status</th><th className="pb-3 text-right">Amount</th></tr></thead>
              <tbody className="divide-y divide-stone-100">
                {retailer.orders.map((order) => (
                  <tr key={order._id || order.id || order.orderNumber}>
                    <td className="py-3 pr-4 font-semibold text-[#314c3f]">{order.orderNumber || 'Order'}</td>
                    <td className="py-3 pr-4 text-stone-500">{displayDate(order.createdAt)}</td>
                    <td className="py-3 pr-4"><span className="rounded-full bg-stone-100 px-2.5 py-1 text-[10px] font-semibold text-stone-600">{(order.orderStatus || order.status || 'PENDING').replace(/_/g, ' ')}</span></td>
                    <td className="py-3 text-right font-semibold tabular-nums text-[#263b31]">{money(order.grandTotal ?? order.totalAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-stone-200 py-10 text-center">
            <Clock3 className="mx-auto size-5 text-stone-300" />
            <p className="mt-2 text-sm font-medium text-stone-500">No orders with your business yet.</p>
          </div>
        )}
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <InfoTile label="Credit limit" value={money(retailer.creditLimit)} />
          <InfoTile label="Available credit" value={money(Math.max(0, Number(retailer.creditLimit || 0) - Number(retailer.outstandingAmount || 0)))} />
        </div>
      </section>

      <div className="flex items-center gap-2 text-[11px] text-stone-400">
        <CalendarDays className="size-3.5" />
        Retailer details are scoped to your active business relationship.
      </div>

      {documentType && retailer.retailerId && (
        <PrivateDocumentViewer retailerId={retailer.retailerId} documentType={documentType} onClose={() => setDocumentType(null)} />
      )}
    </main>
  );
}
