'use client';

import React, { useState } from 'react';
import { Check, Copy, Eye, Search, Share2, ShieldCheck, Users, X } from 'lucide-react';
import { useWholesaler } from '@/context/WholesalerContext';
import { Retailer } from '@/lib/mock-data';
import api from '@/lib/api';

export default function RetailersPage() {
  const { profile, retailers, orders, generateInviteLink } = useWholesaler();
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedCredential, setCopiedCredential] = useState('');
  const [selectedRetailerDetails, setSelectedRetailerDetails] = useState<Retailer | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [resetResult, setResetResult] = useState<{ loginId: string; password: string } | null>(null);
  const [resetError, setResetError] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [isGeneratingInvite, setIsGeneratingInvite] = useState(false);

  const handleGenerateInvite = async () => {
    setIsGeneratingInvite(true);
    const link = await generateInviteLink();
    if (link) setInviteUrl(link);
    setIsGeneratingInvite(false);
  };

  const wholesalerRefCode = `REF-${(profile.businessName || 'WHOLESALER').replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase()}-${String(profile.id || 'WHOLESALER').slice(-6).toUpperCase()}`;
  const retailerAppBaseUrl = (import.meta as any).env?.VITE_RETAILER_URL || 'http://localhost:5174';
  const permanentReferralUrl = `${retailerAppBaseUrl}/register?ref=${wholesalerRefCode}`;

  const filteredConnected = retailers.filter((r) => `${r.businessName} ${r.contactPerson} ${r.city} ${r.loginId || ''}`.toLowerCase().includes(searchQuery.toLowerCase()));
  const selectedRetailerOrders = selectedRetailerDetails ? orders.filter((o) => o.retailerName === selectedRetailerDetails.businessName) : [];

  const copyCredential = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCredential(text);
    setTimeout(() => setCopiedCredential(''), 2000);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRetailerDetails) return;
    setResetError('');
    if (resetPassword.trim().length < 6) {
      setResetError('Password must be at least 6 characters.');
      return;
    }

    setIsResetting(true);
    try {
      const res = await api.resetRetailerPassword(selectedRetailerDetails.id, resetPassword.trim());
      setResetResult({
        loginId: res.data.loginId || selectedRetailerDetails.loginId || '',
        password: res.data.temporaryPassword || resetPassword.trim(),
      });
      setResetPassword('');
    } catch (err: any) {
      setResetError(err?.message || 'Unable to reset password.');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <span className="flex items-center gap-1 rounded-full border border-[#2E7D32]/20 bg-[#E8F5E9] px-2.5 py-0.5 text-[10px] font-extrabold uppercase text-[#2E7D32]">
              <ShieldCheck className="h-3 w-3" />
              <span>Wholesaler CRM Scope: {profile.businessName}</span>
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-[#1F1F1F]">Connected Retailer Network</h1>
          <p className="text-xs text-gray-500">Share your referral code or link so retailers can register and connect to your store.</p>
        </div>
      </div>

      <div className="space-y-4 rounded-2xl border border-[#E5E5E5] bg-white p-5 shadow-xs">
          <div>
            <div className="flex items-center justify-between gap-2 border-b border-[#E5E5E5] pb-3 mb-3">
              <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[10px] font-extrabold uppercase text-blue-700 border border-blue-200">
                Self-Registration (Referral)
              </span>
              <span className="font-mono text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">Permanent & Reusable</span>
            </div>
            <h2 className="flex items-center gap-2 text-base font-extrabold text-[#1F1F1F]">
              <Share2 className="h-4 w-4 text-blue-600" />
              Share Permanent Referral Link
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              Retailers click this link to self-register with their own name, email, mobile & password. They automatically link to your store.
            </p>

            <div className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block text-[10px] font-extrabold uppercase text-gray-400 mb-1">Your Reusable Referral Code</label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 rounded-xl border border-blue-200 bg-blue-50/50 px-3.5 py-2 font-mono font-black text-blue-900 text-sm">
                    {wholesalerRefCode}
                  </div>
                  <button
                    type="button"
                    onClick={() => copyCredential(wholesalerRefCode)}
                    className="px-3.5 py-2 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition-colors shrink-0 flex items-center gap-1.5"
                  >
                    {copiedCredential === wholesalerRefCode ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    <span>Copy Code</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-extrabold uppercase text-gray-400 mb-1">Direct Referral Link for Retailers</label>
                <div className="rounded-xl border border-[#E5E5E5] bg-[#FAF9F7] p-3 break-all font-mono text-[11px] font-bold text-gray-700">
                  {permanentReferralUrl}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={() => copyCredential(permanentReferralUrl)}
              className="flex-1 rounded-xl bg-[#1F1F1F] py-2.5 text-xs font-black text-white hover:bg-black transition-colors flex items-center justify-center gap-2 shadow-xs"
            >
              {copiedCredential === permanentReferralUrl ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
              <span>Copy Referral Link</span>
            </button>
          </div>
      </div>

      <div className="flex flex-col items-center justify-between gap-4 rounded-2xl border border-[#E5E5E5] bg-white p-4 shadow-xs md:flex-row">
        <div className="flex items-center gap-2 text-xs font-extrabold text-[#1F1F1F]">
          <Users className="h-4 w-4 text-[#C62828]" />
          <span>Connected Retailers ({filteredConnected.length})</span>
        </div>
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Search retailer, contact, city, or ID..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full rounded-xl border border-[#E5E5E5] bg-[#FAF9F7] py-2 pl-10 pr-4 text-xs focus:border-[#C62828] focus:outline-none" />
        </div>
      </div>

      <div className="space-y-4 rounded-2xl border border-[#E5E5E5] bg-white p-6 shadow-xs">
        <div>
          <h2 className="text-base font-bold text-[#1F1F1F]">Retailer Accounts ({filteredConnected.length})</h2>
          <p className="text-xs text-gray-500">Retailers who register with your referral code can access your store catalog and company details.</p>
        </div>

        {filteredConnected.length === 0 ? (
          <div className="space-y-2 py-12 text-center text-xs text-gray-500">
            <Users className="mx-auto h-8 w-8 text-gray-300" />
            <p className="font-bold text-gray-700">No connected retailers found.</p>
            <p className="text-gray-400">Share your referral code or link to connect your first retail store.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[980px] w-full table-fixed text-left text-xs">
              <thead>
                <tr className="border-b border-[#E5E5E5] font-bold uppercase tracking-wider text-gray-400">
                  <th className="w-[210px] pb-3">Retailer Business</th>
                  <th className="w-[210px] pb-3">Login ID</th>
                  <th className="w-[220px] pb-3">Contact</th>
                  <th className="w-[130px] pb-3">Joined</th>
                  <th className="w-[120px] pb-3">Spend</th>
                  <th className="w-[120px] pb-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E5E5]">
                {filteredConnected.map((ret) => (
                  <tr key={ret.id} className="transition-colors hover:bg-[#FAF9F7]">
                    <td className="py-4 pr-3">
                      <div className="truncate text-sm font-bold text-[#1F1F1F]">{ret.businessName}</div>
                      <div className="truncate font-mono text-[10px] text-gray-400">GSTIN: {ret.gstin}</div>
                      <div className="mt-1 inline-flex rounded-full bg-[#FAF9F7] px-2 py-0.5 text-[10px] font-bold text-gray-500">{ret.profileComplete ? 'Profile complete' : 'Details pending'}</div>
                    </td>
                    <td className="py-4 pr-3">
                      <button type="button" onClick={() => ret.loginId && copyCredential(ret.loginId)} className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-[#E5E5E5] bg-[#FAF9F7] px-2.5 py-1.5 font-mono font-bold text-[#1F1F1F]">
                        {copiedCredential === ret.loginId ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5 text-gray-500" />}
                        <span className="truncate">{ret.loginId || 'Not set'}</span>
                      </button>
                    </td>
                    <td className="py-4 pr-3">
                      <div className="font-semibold text-gray-700">{ret.contactPerson}</div>
                      <div className="truncate text-[11px] text-gray-400">{ret.phone || 'Phone pending'} • {ret.email}</div>
                      <div className="truncate text-[10px] text-gray-400">{[ret.city, ret.state].filter(Boolean).join(', ') || 'Location pending'}</div>
                    </td>
                    <td className="py-4 font-mono text-gray-500">{ret.joinedDate}</td>
                    <td className="py-4 font-bold text-[#1F1F1F]">₹{(ret.totalSpent || 0).toLocaleString('en-IN')}</td>
                    <td className="py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => { setSelectedRetailerDetails(ret); setResetPassword(''); setResetResult(null); setResetError(''); }} className="flex items-center gap-1 rounded-xl border border-[#E5E5E5] bg-[#FAF9F7] px-3 py-1.5 text-xs font-bold text-gray-700 transition-colors hover:bg-[#E5E5E5]">
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
            <div className="flex items-center justify-between border-b border-[#E5E5E5] pb-3">
              <div>
                <h3 className="text-base font-extrabold text-[#1F1F1F]">{selectedRetailerDetails.businessName}</h3>
                <p className="text-xs text-gray-500">{selectedRetailerDetails.contactPerson} • {selectedRetailerDetails.phone || 'Phone pending'} • {selectedRetailerDetails.city || 'City pending'}</p>
              </div>
              <button onClick={() => setSelectedRetailerDetails(null)} className="rounded-lg p-1 text-gray-400 hover:bg-[#FAF9F7] hover:text-gray-700">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ['Login ID', selectedRetailerDetails.loginId || 'Not set'],
                ['Password', resetResult?.password || 'Reset password to view/share new password'],
                ['Business Type', selectedRetailerDetails.businessType || 'Pending'],
                ['Category', selectedRetailerDetails.category || 'Pending'],
                ['GST Status', selectedRetailerDetails.gstin === 'NON-GST' ? 'Non GST' : 'GST Registered'],
                ['Address', selectedRetailerDetails.address || 'Pending'],
                ['Location', [selectedRetailerDetails.city, selectedRetailerDetails.state, selectedRetailerDetails.pincode].filter(Boolean).join(', ') || 'Pending'],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-[#E5E5E5] bg-[#FAF9F7] p-3">
                  <div className="text-[10px] font-black uppercase text-gray-400">{label}</div>
                  <div className="mt-1 text-xs font-bold text-[#1F1F1F]">{value}</div>
                </div>
              ))}
            </div>

            <form onSubmit={handleResetPassword} className="space-y-3 rounded-xl border border-[#E5E5E5] bg-white p-4">
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-[#1F1F1F]">Retailer Login Credential</h4>
                <p className="text-[11px] text-gray-500">Existing password secure hash me hai, isliye old password show nahi hota. New password reset karte hi yahin visible/copy hoga.</p>
              </div>
              {resetError && <div className="rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-700">{resetError}</div>}
              {resetResult && (
                <div className="grid gap-2 rounded-xl border border-green-200 bg-green-50 p-3 text-xs sm:grid-cols-2">
                  <div><span className="font-bold text-green-700">Retailer ID:</span> <span className="font-mono">{resetResult.loginId}</span></div>
                  <div><span className="font-bold text-green-700">New Password:</span> <span className="font-mono">{resetResult.password}</span></div>
                  <button type="button" onClick={() => copyCredential(`Retailer ID: ${resetResult.loginId}\nPassword: ${resetResult.password}`)} className="rounded-lg bg-green-600 px-3 py-2 text-xs font-bold text-white sm:col-span-2">
                    {copiedCredential ? 'Copied' : 'Copy ID & Password'}
                  </button>
                </div>
              )}
              <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <input
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value.slice(0, 64))}
                  className="rounded-xl border border-[#E5E5E5] px-3 py-2 text-xs focus:border-[#C62828] focus:outline-none"
                  placeholder="Enter new password to share"
                  minLength={6}
                />
                <button disabled={isResetting} className="rounded-xl bg-[#1F1F1F] px-4 py-2 text-xs font-black text-white hover:bg-black disabled:opacity-60">
                  {isResetting ? 'Saving...' : 'Reset Password'}
                </button>
              </div>
            </form>

            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500">Orders Placed With {profile.businessName} ({selectedRetailerOrders.length})</h4>
              {selectedRetailerOrders.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#E5E5E5] py-8 text-center text-xs text-gray-400">No wholesale orders placed by this retailer yet.</div>
              ) : (
                <div className="space-y-2">
                  {selectedRetailerOrders.map((ord) => (
                    <div key={ord.id} className="flex items-center justify-between rounded-xl border border-[#E5E5E5] bg-[#FAF9F7] p-3.5 text-xs">
                      <div>
                        <div className="font-bold text-[#1F1F1F]">{ord.orderNumber}</div>
                        <div className="text-[11px] text-gray-400">{ord.createdAt}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-[#1F1F1F]">₹{(ord.totalAmount || 0).toLocaleString('en-IN')}</div>
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
