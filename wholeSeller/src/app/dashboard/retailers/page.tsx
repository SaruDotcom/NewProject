'use client';

import React, { useState } from 'react';
import { Check, Copy, Eye, MessageCircle, RefreshCw, Search, Share2, ShieldCheck, Users, X } from 'lucide-react';
import { useWholesaler } from '@/context/WholesalerContext';
import { Retailer } from '@/lib/types';
import api from '@/lib/api';

type RetailerReferral = { code: string; signupsEnabled: boolean; joinedCount: number };

export default function RetailersPage() {
  const { profile, retailers, orders } = useWholesaler();
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedCredential, setCopiedCredential] = useState('');
  const [selectedRetailerDetails, setSelectedRetailerDetails] = useState<Retailer | null>(null);
  const [referral, setReferral] = useState<RetailerReferral | null>(null);
  const [isReferralLoading, setIsReferralLoading] = useState(true);
  const [isReferralUpdating, setIsReferralUpdating] = useState(false);
  const [referralError, setReferralError] = useState('');
  const retailerAppBaseUrl = ((import.meta as any).env?.VITE_RETAILER_URL || 'http://localhost:5174').replace(/\/+$/, '');
  const referralUrl = referral
    ? `${retailerAppBaseUrl}/register?ref=${encodeURIComponent(referral.code)}`
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
  const selectedRetailerOrders = selectedRetailerDetails ? orders.filter((o) => o.retailerName === selectedRetailerDetails.businessName) : [];

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
              <label className="mb-1 block text-[10px] font-extrabold uppercase text-gray-400">Invite code</label>
              <div className="flex items-center gap-2">
                <div className="flex-1 rounded-xl border border-blue-200 bg-blue-50/50 px-3.5 py-2 font-mono text-sm font-black text-blue-900">
                  {referral.code}
                </div>
                <button type="button" onClick={() => copyCredential(referral.code)} className="flex shrink-0 items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-sm font-bold text-white hover:bg-blue-700">
                  {copiedCredential === referral.code ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  Copy Invite Code
                </button>
              </div>
            </div>
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
              <button type="button" onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`Join ${profile.businessName} on NEXORA: ${referralUrl}`)}`, '_blank', 'noopener,noreferrer')} className="flex items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-2.5 text-xs font-black text-white hover:bg-green-700">
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
                      <div className="truncate font-mono text-[10px] text-gray-400">GSTIN: {ret.gstin}</div>
                      <div className="mt-1 inline-flex rounded-full bg-tradeflow-gray-50 px-2 py-0.5 text-[10px] font-bold text-gray-500">{ret.profileComplete ? 'Profile complete' : 'Details pending'}</div>
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
          <div className="max-h-[90vh] w-full max-w-3xl space-y-4 overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-tradeflow-gray-200 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-tradeflow-navy">{selectedRetailerDetails.businessName}</h3>
                <p className="text-xs text-gray-500">{selectedRetailerDetails.contactPerson} • {selectedRetailerDetails.phone || 'Phone pending'} • {selectedRetailerDetails.city || 'City pending'}</p>
              </div>
              <button onClick={() => setSelectedRetailerDetails(null)} className="rounded-lg p-1 text-gray-400 hover:bg-tradeflow-gray-50 hover:text-gray-700">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ['Business Type', selectedRetailerDetails.businessType || 'Pending'],
                ['Category', selectedRetailerDetails.category || 'Pending'],
                ['GST Status', selectedRetailerDetails.gstin === 'NON-GST' ? 'Non GST' : 'GST Registered'],
                ['Address', selectedRetailerDetails.address || 'Pending'],
                ['Location', [selectedRetailerDetails.city, selectedRetailerDetails.state, selectedRetailerDetails.pincode].filter(Boolean).join(', ') || 'Pending'],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-tradeflow-gray-200 bg-tradeflow-gray-50 p-3">
                  <div className="text-[10px] font-black uppercase text-gray-400">{label}</div>
                  <div className="mt-1 text-xs font-bold text-tradeflow-navy">{value}</div>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500">Orders Placed With {profile.businessName} ({selectedRetailerOrders.length})</h4>
              {selectedRetailerOrders.length === 0 ? (
                <div className="rounded-xl border border-dashed border-tradeflow-gray-200 py-8 text-center text-xs text-gray-400">No wholesale orders placed by this retailer yet.</div>
              ) : (
                <div className="space-y-2">
                  {selectedRetailerOrders.map((ord) => (
                    <div key={ord.id} className="flex items-center justify-between rounded-xl border border-tradeflow-gray-200 bg-tradeflow-gray-50 p-3.5 text-xs">
                      <div>
                        <div className="font-bold text-tradeflow-navy">{ord.orderNumber}</div>
                        <div className="text-[11px] text-gray-400">{ord.createdAt}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-tradeflow-navy">₹{(ord.totalAmount || 0).toLocaleString('en-IN')}</div>
                        <span className="inline-block rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700">{ord.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
