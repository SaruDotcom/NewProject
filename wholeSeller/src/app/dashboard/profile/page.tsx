import { useState } from 'react';
import { ArrowLeft, Building2, Check, Copy, MapPin } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useWholesaler } from '@/context/WholesalerContext';

export default function WholesalerProfilePage() {
  const { profile } = useWholesaler();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  const copyId = async () => {
    if (!profile.id) return;
    try {
      await navigator.clipboard.writeText(profile.id);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  const businessAddress = [profile.streetAddress, profile.city, profile.state, profile.pincode]
    .filter(Boolean)
    .join(', ');
  const pickupAddress = [profile.pickupStreetAddress, profile.pickupCity, profile.pickupState, profile.pickupPincode]
    .filter(Boolean)
    .join(', ');

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="rounded-lg border border-tradeflow-gray-200 bg-white p-2 text-gray-600 transition-colors hover:bg-tradeflow-gray-50"
          aria-label="Go back"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <p className="mb-1 text-[10px] font-extrabold uppercase tracking-wide text-green-700">Wholesaler account</p>
          <h1 className="text-2xl font-extrabold text-tradeflow-navy">{profile.businessName || 'Business details'}</h1>
          <p className="text-xs text-gray-500">Business and account information</p>
        </div>
      </div>

      <section className="rounded-2xl border border-tradeflow-gray-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-tradeflow-green-50 text-green-700">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500">Wholesaler ID</p>
              <p className="break-all font-mono text-sm font-bold text-tradeflow-navy">{profile.id || 'Not available'}</p>
            </div>
          </div>
          <button
            onClick={copyId}
            disabled={!profile.id}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-tradeflow-gray-200 px-3 py-2 text-xs font-bold text-gray-700 transition-colors hover:bg-tradeflow-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {copied ? <Check className="h-4 w-4 text-status-success" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Copied' : 'Copy ID'}
          </button>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border border-tradeflow-gray-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="mb-4 text-sm font-extrabold text-tradeflow-navy">Business information</h2>
          <dl className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
            <Detail label="Business name" value={profile.businessName || 'Not provided'} />
            <Detail label="Business type" value={profile.businessType || 'Not provided'} />
            <Detail label="GSTIN" value={profile.gstin || 'Not provided'} />
            <Detail label="Trade license" value={profile.tradeLicense || 'Not provided'} />
            <Detail label="Account status" value={profile.accountStatus ? profile.accountStatus.replace(/_/g, ' ') : 'Not available'} />
          </dl>
        </section>

        <section className="rounded-2xl border border-tradeflow-gray-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="mb-4 text-sm font-extrabold text-tradeflow-navy">Contact information</h2>
          <dl className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
            <Detail label="Owner" value={profile.ownerName} />
            <Detail label="Email" value={profile.email} />
            <Detail label="Phone" value={profile.phone} />
          </dl>
        </section>

        <section className="rounded-2xl border border-tradeflow-gray-200 bg-white p-5 shadow-sm sm:p-6 lg:col-span-2">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-extrabold text-tradeflow-navy"><MapPin className="h-4 w-4 text-green-700" />Addresses</h2>
          <dl className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
            <Detail label="Business address" value={businessAddress} />
            <Detail label="Pickup address" value={profile.sameAsBusinessAddress ? businessAddress : pickupAddress} />
          </dl>
        </section>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold text-gray-500">{label}</dt>
      <dd className="mt-1 break-words text-sm font-bold text-tradeflow-navy">{value || 'Not provided'}</dd>
    </div>
  );
}
