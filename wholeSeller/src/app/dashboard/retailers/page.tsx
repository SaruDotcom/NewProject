'use client';

import React, { useState } from 'react';
import { Check, Copy, Download, Eye, MessageCircle, RefreshCw, Search, Share2, ShieldCheck, Users, X, ZoomIn, ZoomOut } from 'lucide-react';
import { useWholesaler } from '@/context/WholesalerContext';
import { Retailer } from '@/lib/types';
import api from '@/lib/api';

type RetailerReferral = { code: string; signupsEnabled: boolean; joinedCount: number };
type RetailerDetails = Retailer & {
  retailerId?: string;
  phone?: string;
  email?: string;
  creditLimit?: number;
  outstandingAmount?: number;
  totalOrdersCount?: number;
  totalSpent?: number;
  lastLoginAt?: string | null;
  createdAt?: string;
  registrationSource?: string;
  profile?: {
    businessName?: string;
    ownerName?: string;
    businessType?: string;
    category?: string;
    gstin?: string;
    address?: { street?: string; city?: string; state?: string; pincode?: string };
    registrationSource?: string;
    createdAt?: string;
    pan?: { number?: string; last4?: string; hasImage?: boolean };
    aadhaar?: { last4?: string; hasFrontImage?: boolean; hasBackImage?: boolean };
    shopPhoto?: { hasImage?: boolean };
    verificationStatus?: string;
    verificationNote?: string;
    documentsSubmitted?: boolean;
  };
  orders?: Array<{ id?: string; _id?: string; orderNumber?: string; createdAt?: string; grandTotal?: number; totalAmount?: number; orderStatus?: string; status?: string }>;
};

function PrivateDocumentViewer({
  retailerId,
  documentType,
  onClose,
}: {
  retailerId: string;
  documentType: string;
  onClose: () => void;
}) {
  const [documentUrl, setDocumentUrl] = useState('');
  const [mimeType, setMimeType] = useState('');
  const [error, setError] = useState('');
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  React.useEffect(() => {
    let active = true;
    let objectUrl = '';
    setDocumentUrl('');
    setMimeType('');
    setError('');
    void api.getRetailerDocument(retailerId, documentType)
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setDocumentUrl(objectUrl);
        setMimeType(blob.type);
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load this document.');
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [retailerId, documentType]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-label="Private retailer document">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b p-4">
          <h3 className="text-sm font-extrabold text-tradeflow-navy">{documentType.replace(/-/g, ' ')}</h3>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setZoom((value) => Math.min(3, value + 0.25))} aria-label="Zoom in" className="rounded-lg border p-2"><ZoomIn className="h-4 w-4" /></button>
            <button type="button" onClick={() => setZoom((value) => Math.max(0.5, value - 0.25))} aria-label="Zoom out" className="rounded-lg border p-2"><ZoomOut className="h-4 w-4" /></button>
            <button type="button" onClick={() => setRotation((value) => value + 90)} className="rounded-lg border px-3 py-2 text-xs font-bold">Rotate</button>
            {documentUrl && <a href={documentUrl} download={`${documentType}.${mimeType === 'application/pdf' ? 'pdf' : mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg'}`} className="rounded-lg border p-2" aria-label="Download document"><Download className="h-4 w-4" /></a>}
            <button type="button" onClick={onClose} aria-label="Close document" className="rounded-lg border p-2"><X className="h-4 w-4" /></button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto bg-tradeflow-gray-50 p-4">
          {error ? (
            <p role="alert" className="py-12 text-center text-sm font-semibold text-red-600">{error}</p>
          ) : !documentUrl ? (
            <p className="py-12 text-center text-sm text-gray-500">Loading secure document...</p>
          ) : mimeType === 'application/pdf' ? (
            <div className="flex min-h-[70vh] items-center justify-center overflow-auto">
              <iframe
                title={`${documentType} PDF`}
                src={documentUrl}
                className="h-[70vh] w-full rounded-lg bg-white transition-transform"
                style={{ transform: `scale(${zoom}) rotate(${rotation}deg)` }}
              />
            </div>
          ) : (
            <div className="flex min-h-[60vh] items-center justify-center overflow-auto">
              <img src={documentUrl} alt={`${documentType} document`} className="max-h-[70vh] max-w-full object-contain transition-transform" style={{ transform: `scale(${zoom}) rotate(${rotation}deg)` }} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function RetailersPage() {
  const { profile, retailers, orders } = useWholesaler();
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedCredential, setCopiedCredential] = useState('');
  const [selectedRetailerDetails, setSelectedRetailerDetails] = useState<Retailer | null>(null);
  const [retailerDetails, setRetailerDetails] = useState<RetailerDetails | null>(null);
  const [retailerDetailsLoading, setRetailerDetailsLoading] = useState(false);
  const [retailerDetailsError, setRetailerDetailsError] = useState('');
  const [fullAadhaar, setFullAadhaar] = useState('');
  const [aadhaarLoading, setAadhaarLoading] = useState(false);
  const [verificationNote, setVerificationNote] = useState('');
  const [verificationSaving, setVerificationSaving] = useState(false);
  const [documentType, setDocumentType] = useState<string | null>(null);
  const [referral, setReferral] = useState<RetailerReferral | null>(null);
  const [isReferralLoading, setIsReferralLoading] = useState(true);
  const [isReferralUpdating, setIsReferralUpdating] = useState(false);
  const [referralError, setReferralError] = useState('');
  const retailerAppOrigin = new URL(import.meta.env.VITE_RETAILER_URL || 'http://localhost:5174').origin;
  const referralUrl = referral
    ? `${retailerAppOrigin}/?ref=${encodeURIComponent(referral.code)}`
    : '';

  const loadReferral = React.useCallback(async () => {
    setIsReferralLoading(true);
    setReferralError('');
    try {
      const response = await api.getRetailerReferral();
      setReferral(response.data);
    } catch (err: any) {
      setReferralError(err?.message || 'Unable to load your referral settings.');
    } finally {
      setIsReferralLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadReferral();
  }, [loadReferral]);

  const updateReferral = async (action: () => Promise<{ data: RetailerReferral }>) => {
    setIsReferralUpdating(true);
    setReferralError('');
    try {
      const response = await action();
      setReferral(response.data);
    } catch (err: any) {
      setReferralError(err?.message || 'Unable to update your referral settings.');
    } finally {
      setIsReferralUpdating(false);
    }
  };

  const handleRegenerateReferral = () => {
    if (!window.confirm('Regenerate your referral code? Your current link will stop working immediately. Existing retailers remain connected.')) return;
    void updateReferral(() => api.regenerateRetailerReferral());
  };

  const handleToggleSignups = () => {
    if (!referral) return;
    void updateReferral(() => api.setRetailerReferralEnabled(!referral.signupsEnabled));
  };

  const filteredConnected = retailers.filter((r) => `${r.businessName} ${r.contactPerson} ${r.city}`.toLowerCase().includes(searchQuery.toLowerCase()));
  const selectedRetailerOrders = selectedRetailerDetails
    ? orders.filter((o) => {
        if (o.retailerId && (o.retailerId === selectedRetailerDetails.retailerId || o.retailerId === selectedRetailerDetails.id)) return true;
        if (selectedRetailerDetails.businessName) {
          if (o.retailerName && o.retailerName.toLowerCase() === selectedRetailerDetails.businessName.toLowerCase()) return true;
          if (o.retailerBusinessName && o.retailerBusinessName.toLowerCase() === selectedRetailerDetails.businessName.toLowerCase()) return true;
        }
        if (selectedRetailerDetails.contactPerson && o.retailerName && o.retailerName.toLowerCase() === selectedRetailerDetails.contactPerson.toLowerCase()) return true;
        return false;
      })
    : [];

  React.useEffect(() => {
    if (!selectedRetailerDetails) return;
    let active = true;
    setRetailerDetails(null);
    setRetailerDetailsError('');
    setFullAadhaar('');
    setRetailerDetailsLoading(true);
    void api.getRetailerDetails(selectedRetailerDetails.id)
      .then((response) => {
        if (active) setRetailerDetails(response.data);
      })
      .catch((error: unknown) => {
        if (active) setRetailerDetailsError(error instanceof Error ? error.message : 'Unable to load retailer details.');
      })
      .finally(() => {
        if (active) setRetailerDetailsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedRetailerDetails?.id]);

  const revealAadhaar = async () => {
    if (!retailerDetails?.retailerId) return;
    setAadhaarLoading(true);
    try {
      const response = await api.getFullRetailerAadhaar(retailerDetails.retailerId);
      setFullAadhaar(response.data.number);
    } catch (error: unknown) {
      setRetailerDetailsError(error instanceof Error ? error.message : 'Unable to show Aadhaar number.');
    } finally {
      setAadhaarLoading(false);
    }
  };

  const updateVerification = async (status: 'VERIFIED' | 'REJECTED') => {
    if (!retailerDetails?.retailerId) return;
    setVerificationSaving(true);
    setRetailerDetailsError('');
    try {
      await api.updateRetailerVerification(retailerDetails.retailerId, status, verificationNote);
      setRetailerDetails((current) => current ? {
        ...current,
        profile: {
          ...current.profile,
          verificationStatus: status,
          verificationNote,
        },
      } : current);
      setVerificationNote('');
    } catch (error: unknown) {
      setRetailerDetailsError(error instanceof Error ? error.message : 'Unable to update verification status.');
    } finally {
      setVerificationSaving(false);
    }
  };

  const copyCredential = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCredential(text);
    setTimeout(() => setCopiedCredential(''), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <span className="flex items-center gap-1 rounded-full border border-status-success/20 bg-tradeflow-green-50 px-2.5 py-0.5 text-[10px] font-extrabold uppercase text-status-success">
              <ShieldCheck className="h-3 w-3" />
              <span>Wholesaler CRM Scope: {profile.businessName}</span>
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-tradeflow-navy">Connected Retailer Network</h1>
          <p className="text-xs text-gray-500">Share your invite link so retailers can register and connect to your store.</p>
        </div>
      </div>

      <div className="space-y-4 rounded-2xl border border-tradeflow-gray-200 bg-white p-5 shadow-xs">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-tradeflow-gray-200 pb-3">
          <div>
            <h2 className="flex items-center gap-2 text-base font-extrabold text-tradeflow-navy">
              <Share2 className="h-4 w-4 text-blue-600" />
              Your retailer invite link
            </h2>
            <p className="mt-1 text-xs text-gray-500">Retailers can register only through this active invite link.</p>
          </div>
          {referral && (
            <span className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold ${referral.signupsEnabled ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
              {referral.signupsEnabled ? 'Sign-ups open' : 'Sign-ups paused'}
            </span>
          )}
        </div>

        {referralError && <p role="alert" className="text-xs font-semibold text-red-600">{referralError}</p>}
        {isReferralLoading ? (
          <p className="text-xs text-gray-500">Loading referral settings...</p>
        ) : referral ? (
          <>
            <div>
              <label className="mb-1 block text-[10px] font-extrabold uppercase text-gray-400">Invite link</label>
              <div className="break-all rounded-xl border border-tradeflow-gray-200 bg-tradeflow-gray-50 p-3 font-mono text-[11px] font-bold text-gray-700">
                {referralUrl}
              </div>
            </div>
            <p className="text-xs font-semibold text-gray-700">{referral.joinedCount} retailer{referral.joinedCount === 1 ? '' : 's'} joined through your referral.</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => copyCredential(referralUrl)} className="flex items-center justify-center gap-2 rounded-xl bg-tradeflow-navy px-4 py-2.5 text-xs font-black text-white hover:bg-black">
                {copiedCredential === referralUrl ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                Copy Link
              </button>
              <button type="button" onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(referralUrl)}`, '_blank', 'noopener,noreferrer')} className="flex items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-2.5 text-xs font-black text-white hover:bg-green-700">
                <MessageCircle className="h-4 w-4" />
                Share via WhatsApp
              </button>
              <button type="button" onClick={handleRegenerateReferral} disabled={isReferralUpdating} className="flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-bold text-gray-700 disabled:opacity-50">
                <RefreshCw className="h-4 w-4" />
                Regenerate Code
              </button>
              <button type="button" onClick={handleToggleSignups} disabled={isReferralUpdating} className="rounded-xl border px-4 py-2.5 text-xs font-bold text-gray-700 disabled:opacity-50">
                {referral.signupsEnabled ? 'Pause Sign-ups' : 'Resume Sign-ups'}
              </button>
            </div>
          </>
        ) : null}
      </div>

      <div className="flex flex-col items-center justify-between gap-4 rounded-2xl border border-tradeflow-gray-200 bg-white p-4 shadow-xs md:flex-row">
        <div className="flex items-center gap-2 text-xs font-extrabold text-tradeflow-navy">
          <Users className="h-4 w-4 text-green-700" />
          <span>Connected Retailers ({filteredConnected.length})</span>
        </div>
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Search retailer, contact, or city..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full rounded-xl border border-tradeflow-gray-200 bg-tradeflow-gray-50 py-2 pl-10 pr-4 text-xs focus:border-tradeflow-green focus:outline-none" />
        </div>
      </div>

      <div className="space-y-4 rounded-2xl border border-tradeflow-gray-200 bg-white p-6 shadow-xs">
        <div>
          <h2 className="text-base font-bold text-tradeflow-navy">Retailer Accounts ({filteredConnected.length})</h2>
          <p className="text-xs text-gray-500">Retailers who register with your referral code can access your store catalog and company details.</p>
        </div>

        {filteredConnected.length === 0 ? (
          <div className="space-y-2 py-12 text-center text-xs text-gray-500">
            <Users className="mx-auto h-8 w-8 text-gray-300" />
            <p className="font-bold text-gray-700">No connected retailers found.</p>
            <p className="text-gray-400">Share your invite link to connect your first retail store.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[980px] w-full table-fixed text-left text-xs">
              <thead>
                <tr className="border-b border-tradeflow-gray-200 font-bold uppercase tracking-wider text-gray-400">
                  <th className="w-[210px] pb-3">Retailer Business</th>
                  <th className="w-[220px] pb-3">Contact</th>
                  <th className="w-[130px] pb-3">Joined</th>
                  <th className="w-[120px] pb-3">Spend</th>
                  <th className="w-[120px] pb-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-tradeflow-gray-200">
                {filteredConnected.map((ret) => (
                  <tr key={ret.id} className="transition-colors hover:bg-tradeflow-gray-50">
                    <td className="py-4 pr-3">
                      <div className="truncate text-sm font-bold text-tradeflow-navy">{ret.businessName}</div>
                      <div className="truncate font-mono text-[10px] text-gray-400">GSTIN: {ret.gstin || 'Not provided'}</div>
                      <div className="mt-1 inline-flex rounded-full bg-tradeflow-gray-50 px-2 py-0.5 text-[10px] font-bold text-gray-500">{ret.profileComplete ? 'Profile complete' : 'Details pending'}</div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                          {ret.verificationStatus === 'VERIFIED' ? 'Verified' : ret.verificationStatus === 'SUBMITTED' ? 'Submitted' : ret.verificationStatus === 'REJECTED' ? 'Rejected' : 'Not submitted'}
                        </span>
                        {!ret.documentsSubmitted && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">Documents not submitted</span>}
                      </div>
                    </td>
                    <td className="py-4 pr-3">
                      <div className="font-semibold text-gray-700">{ret.contactPerson}</div>
                      <div className="truncate text-[11px] text-gray-400">{ret.phone || 'Phone pending'} • {ret.email}</div>
                      <div className="truncate text-[10px] text-gray-400">{[ret.city, ret.state].filter(Boolean).join(', ') || 'Location pending'}</div>
                    </td>
                    <td className="py-4 font-mono text-gray-500">{ret.joinedDate}</td>
                    <td className="py-4 font-bold text-tradeflow-navy">₹{(ret.totalSpent || 0).toLocaleString('en-IN')}</td>
                    <td className="py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => setSelectedRetailerDetails(ret)} className="flex items-center gap-1 rounded-xl border border-tradeflow-gray-200 bg-tradeflow-gray-50 px-3 py-1.5 text-xs font-bold text-gray-700 transition-colors hover:bg-tradeflow-gray-200">
                          <Eye className="h-3.5 w-3.5 text-gray-500" />
                          <span>View</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedRetailerDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-4xl space-y-4 overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-tradeflow-gray-200 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-tradeflow-navy">{retailerDetails?.businessName || selectedRetailerDetails.businessName}</h3>
                <p className="text-xs text-gray-500">{retailerDetails?.contactPerson || selectedRetailerDetails.contactPerson || 'Not provided'}</p>
              </div>
              <button onClick={() => { setSelectedRetailerDetails(null); setDocumentType(null); }} className="rounded-lg p-1 text-gray-400 hover:bg-tradeflow-gray-50 hover:text-gray-700" aria-label="Close retailer details">
                <X className="h-5 w-5" />
              </button>
            </div>

            {retailerDetailsLoading ? (
              <p role="status" className="py-12 text-center text-sm text-gray-500">Loading retailer profile...</p>
            ) : retailerDetailsError ? (
              <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{retailerDetailsError}</p>
            ) : retailerDetails ? (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    ['Business name', retailerDetails.profile?.businessName || retailerDetails.businessName],
                    ['Owner name', retailerDetails.profile?.ownerName || retailerDetails.contactPerson],
                    ['Business type', retailerDetails.profile?.businessType || retailerDetails.businessType],
                    ['Category', retailerDetails.profile?.category || retailerDetails.category],
                    ['GSTIN', retailerDetails.profile?.gstin || retailerDetails.gstin],
                    ['GST status', retailerDetails.profile?.gstin ? 'GST registered' : 'Not provided'],
                    ['Address', retailerDetails.profile?.address?.street || retailerDetails.address],
                    ['City', retailerDetails.profile?.address?.city || retailerDetails.city],
                    ['State', retailerDetails.profile?.address?.state || retailerDetails.state],
                    ['Pincode', retailerDetails.profile?.address?.pincode || retailerDetails.pincode],
                    ['Registration date', retailerDetails.profile?.createdAt || retailerDetails.createdAt],
                    ['Registration source', retailerDetails.profile?.registrationSource || retailerDetails.registrationSource],
                    ['Credit limit', retailerDetails.creditLimit === undefined ? '' : `₹${retailerDetails.creditLimit.toLocaleString('en-IN')}`],
                    ['Outstanding amount', retailerDetails.outstandingAmount === undefined ? '' : `₹${retailerDetails.outstandingAmount.toLocaleString('en-IN')}`],
                    ['Order count', String(retailerDetails.totalOrdersCount ?? 0)],
                    ['Total purchases', `₹${Number(retailerDetails.totalSpent ?? 0).toLocaleString('en-IN')}`],
                    ['Last login', retailerDetails.lastLoginAt ? new Date(retailerDetails.lastLoginAt).toLocaleString('en-IN') : ''],
                  ].map(([label, rawValue]) => (
                    <div key={label} className="rounded-xl border border-tradeflow-gray-200 bg-tradeflow-gray-50 p-3">
                      <div className="text-[10px] font-black uppercase text-gray-400">{label}</div>
                      <div className="mt-1 break-words text-xs font-bold text-tradeflow-navy">{rawValue || 'Not provided'}</div>
                    </div>
                  ))}
                </div>

                <section className="space-y-3 rounded-xl border border-tradeflow-gray-200 p-4">
                  <h4 className="text-xs font-black uppercase tracking-wider text-gray-500">Contact</h4>
                  <div className="flex flex-wrap gap-4 text-sm font-semibold">
                    {retailerDetails.phone ? <a className="text-blue-700 underline" href={`tel:${retailerDetails.phone}`}>{retailerDetails.phone}</a> : <span>Not provided</span>}
                    {retailerDetails.email ? <a className="text-blue-700 underline" href={`mailto:${retailerDetails.email}`}>{retailerDetails.email}</a> : <span>Not provided</span>}
                  </div>
                </section>

                <section className="space-y-3 rounded-xl border border-tradeflow-gray-200 p-4">
                  <h4 className="text-xs font-black uppercase tracking-wider text-gray-500">Identity and documents</h4>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg bg-tradeflow-gray-50 p-3">
                      <div className="text-[10px] font-black uppercase text-gray-400">PAN number</div>
                      <div className="mt-1 text-xs font-bold text-tradeflow-navy">{retailerDetails.profile?.pan?.number || 'Not provided'}</div>
                    </div>
                    <div className="rounded-lg bg-tradeflow-gray-50 p-3">
                      <div className="text-[10px] font-black uppercase text-gray-400">Aadhaar number</div>
                      <div className="mt-1 flex items-center gap-2 text-xs font-bold text-tradeflow-navy">
                        {retailerDetails.profile?.aadhaar?.last4 ? (fullAadhaar || `•••• •••• ${retailerDetails.profile.aadhaar.last4}`) : 'Not provided'}
                        {retailerDetails.profile?.aadhaar?.last4 && !fullAadhaar && (
                          <button type="button" onClick={() => void revealAadhaar()} disabled={aadhaarLoading} className="text-blue-700 underline disabled:opacity-50">
                            {aadhaarLoading ? 'Loading...' : 'Show full'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {([
                      ['shop-photo', 'Shop photo', retailerDetails.profile?.shopPhoto?.hasImage],
                      ['pan', 'PAN document', retailerDetails.profile?.pan?.hasImage],
                      ['aadhaar-front', 'Aadhaar front', retailerDetails.profile?.aadhaar?.hasFrontImage],
                      ['aadhaar-back', 'Aadhaar back', retailerDetails.profile?.aadhaar?.hasBackImage],
                    ] as const).map(([type, label, available]) => (
                      <button
                        key={type}
                        type="button"
                        disabled={!available}
                        onClick={() => setDocumentType(String(type))}
                        className="rounded-lg border px-3 py-2 text-xs font-bold text-tradeflow-navy disabled:cursor-not-allowed disabled:text-gray-400"
                      >
                        {available ? `View ${label}` : `${label}: Not provided`}
                      </button>
                    ))}
                  </div>
                </section>

                <section className="space-y-3 rounded-xl border border-tradeflow-gray-200 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-xs font-black uppercase tracking-wider text-gray-500">Verification</h4>
                    <span className="rounded-full bg-blue-50 px-3 py-1 text-[10px] font-extrabold text-blue-700">
                      {retailerDetails.profile?.verificationStatus === 'VERIFIED' ? 'Verified' : retailerDetails.profile?.verificationStatus === 'SUBMITTED' ? 'Submitted' : retailerDetails.profile?.verificationStatus === 'REJECTED' ? 'Rejected' : 'Not submitted'}
                    </span>
                  </div>
                  {retailerDetails.profile?.verificationNote && <p className="text-xs text-gray-600">Note: {retailerDetails.profile.verificationNote}</p>}
                  <textarea value={verificationNote} onChange={(event) => setVerificationNote(event.target.value)} maxLength={1000} rows={2} placeholder="Add a note for a re-upload request" className="w-full rounded-lg border p-2 text-xs" />
                  <div className="flex flex-wrap gap-2">
                    <button type="button" disabled={verificationSaving || retailerDetails.profile?.verificationStatus !== 'SUBMITTED'} onClick={() => void updateVerification('VERIFIED')} className="rounded-lg bg-green-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Mark as Verified</button>
                    <button type="button" disabled={verificationSaving || retailerDetails.profile?.verificationStatus !== 'SUBMITTED' || !verificationNote.trim()} onClick={() => void updateVerification('REJECTED')} className="rounded-lg border border-amber-300 px-3 py-2 text-xs font-bold text-amber-800 disabled:opacity-50">Request re-upload</button>
                  </div>
                </section>
              </>
            ) : null}

            <div className="space-y-3">
              {(() => {
                const combinedOrders = (retailerDetails?.orders && retailerDetails.orders.length > 0)
                  ? retailerDetails.orders
                  : selectedRetailerOrders;
                return (
                  <>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500">
                      Orders Placed With {profile.businessName} ({combinedOrders.length})
                    </h4>
                    {combinedOrders.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-tradeflow-gray-200 py-8 text-center text-xs text-gray-400">
                        No wholesale orders placed by this retailer yet.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {combinedOrders.map((ord: any) => (
                          <div key={ord.id || ord._id} className="flex items-center justify-between rounded-xl border border-tradeflow-gray-200 bg-tradeflow-gray-50 p-3.5 text-xs">
                            <div>
                              <div className="font-bold text-tradeflow-navy">{ord.orderNumber || ord.orderNo || 'Not provided'}</div>
                              <div className="text-[11px] text-gray-400">{ord.createdAt ? new Date(ord.createdAt).toLocaleDateString('en-IN') : 'Not provided'}</div>
                            </div>
                            <div className="text-right">
                              <div className="font-bold text-tradeflow-navy">₹{Number(ord.grandTotal ?? ord.totalAmount ?? ord.total ?? 0).toLocaleString('en-IN')}</div>
                              <span className="inline-block rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700">{(ord.orderStatus || ord.status || 'PENDING').toUpperCase()}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                );
              })()}

              {documentType && retailerDetails?.retailerId && (
                <PrivateDocumentViewer
                  retailerId={retailerDetails.retailerId}
                  documentType={documentType}
                  onClose={() => setDocumentType(null)}
                />
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
