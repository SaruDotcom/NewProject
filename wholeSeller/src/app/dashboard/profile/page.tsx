import { type FormEvent, useEffect, useState } from 'react';
import { ArrowLeft, Building2, Check, Copy, ImagePlus, MapPin, Save, X } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useWholesaler } from '@/context/WholesalerContext';
import api from '@/lib/api';
import BusinessLogo from '@/components/BusinessLogo';
import KycPage from '../kyc/page';

export default function WholesalerProfilePage() {
  const { profile, updateProfile } = useWholesaler();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [copied, setCopied] = useState(false);
  const [businessName, setBusinessName] = useState(profile.businessName || '');
  const [businessTagline, setBusinessTagline] = useState(profile.businessTagline || '');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState('');
  const [removeLogo, setRemoveLogo] = useState(false);
  const [savingBranding, setSavingBranding] = useState(false);
  const [brandingError, setBrandingError] = useState('');
  const [brandingSaved, setBrandingSaved] = useState(false);
  const activeTab = searchParams.get('tab') === 'kyc' ? 'kyc' : 'business';

  useEffect(() => setBusinessName(profile.businessName || ''), [profile.businessName]);
  useEffect(() => setBusinessTagline(profile.businessTagline || ''), [profile.businessTagline]);
  useEffect(() => {
    if (!logoFile) {
      setLogoPreview('');
      return;
    }
    const preview = URL.createObjectURL(logoFile);
    setLogoPreview(preview);
    return () => URL.revokeObjectURL(preview);
  }, [logoFile]);

  const handleLogoSelection = (file?: File) => {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || !/\.(jpe?g|png|webp)$/i.test(file.name)) {
      setLogoFile(null);
      setBrandingError('Choose a JPG, JPEG, PNG, or WebP image.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setLogoFile(null);
      setBrandingError('Business logo must be 5 MB or smaller.');
      return;
    }
    setBrandingError('');
    setBrandingSaved(false);
    setLogoFile(file);
    setRemoveLogo(false);
  };

  const saveBranding = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextName = businessName.trim();
    if (!nextName) {
      setBrandingError('Business name is required.');
      return;
    }
    setSavingBranding(true);
    setBrandingError('');
    setBrandingSaved(false);
    try {
      const nextTagline = businessTagline.trim();
      if (nextName !== profile.businessName || nextTagline !== profile.businessTagline) {
        const response = await api.updateBusinessProfile({
          businessName: nextName,
          businessTagline: nextTagline,
        });
        updateProfile({
          businessName: response.data.profile.businessName || nextName,
          businessTagline: response.data.profile.businessTagline ?? nextTagline,
        });
      }
      if (logoFile) {
        const response = await api.uploadBusinessLogo(logoFile);
        updateProfile({ businessLogoUrl: response.data.profile.businessLogoUrl || '' });
        setLogoFile(null);
        setRemoveLogo(false);
      } else if (removeLogo && profile.businessLogoUrl) {
        await api.removeBusinessLogo();
        updateProfile({ businessLogoUrl: '' });
        setRemoveLogo(false);
      }
      setBrandingSaved(true);
    } catch (error) {
      setBrandingError(error instanceof Error ? error.message : 'Unable to save business branding.');
    } finally {
      setSavingBranding(false);
    }
  };

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

      <div role="tablist" aria-label="Profile sections" className="flex gap-2 border-b border-tradeflow-gray-200">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'business'}
          onClick={() => setSearchParams({})}
          className={`border-b-2 px-4 py-3 text-sm font-bold transition-colors ${
            activeTab === 'business'
              ? 'border-tradeflow-green text-tradeflow-navy'
              : 'border-transparent text-gray-500 hover:text-tradeflow-navy'
          }`}
        >
          Business Profile
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'kyc'}
          onClick={() => setSearchParams({ tab: 'kyc' })}
          className={`border-b-2 px-4 py-3 text-sm font-bold transition-colors ${
            activeTab === 'kyc'
              ? 'border-tradeflow-green text-tradeflow-navy'
              : 'border-transparent text-gray-500 hover:text-tradeflow-navy'
          }`}
        >
          KYC Verification
        </button>
      </div>

      {activeTab === 'kyc' ? (
        <KycPage />
      ) : (
        <>
      <section className="rounded-2xl border border-tradeflow-gray-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-4">
          <h2 className="text-sm font-extrabold text-tradeflow-navy">Business branding</h2>
          <p className="mt-1 text-xs text-gray-500">This name and logo appear on your wholesaler dashboard and retailer-facing store.</p>
        </div>
        <form onSubmit={saveBranding} className="grid gap-5 md:grid-cols-[1fr_auto] md:items-end">
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <div className="space-y-3">
              <div>
              <label htmlFor="business-name" className="mb-1 block text-xs font-bold text-gray-700">Business name</label>
              <input
                id="business-name"
                value={businessName}
                onChange={(event) => {
                  setBusinessName(event.target.value);
                  setBrandingSaved(false);
                }}
                maxLength={150}
                required
                className="w-full rounded-xl border border-tradeflow-gray-200 bg-white px-3.5 py-2.5 text-sm text-tradeflow-navy focus:border-tradeflow-green focus:outline-none focus:ring-1 focus:ring-tradeflow-green"
              />
              </div>
              <div>
                <label htmlFor="business-tagline" className="mb-1 block text-xs font-bold text-gray-700">Business tagline</label>
                <input
                  id="business-tagline"
                  value={businessTagline}
                  onChange={(event) => {
                    setBusinessTagline(event.target.value);
                    setBrandingSaved(false);
                  }}
                  maxLength={160}
                  placeholder="A short line describing your business"
                  className="w-full rounded-xl border border-tradeflow-gray-200 bg-white px-3.5 py-2.5 text-sm text-tradeflow-navy focus:border-tradeflow-green focus:outline-none focus:ring-1 focus:ring-tradeflow-green"
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <BusinessLogo
                src={logoFile ? logoPreview : (removeLogo ? '' : profile.businessLogoUrl)}
                name={businessName || 'Your business'}
                className="h-14 w-14 rounded-xl border border-tradeflow-gray-200 bg-tradeflow-gray-50 text-tradeflow-green"
              />
              <div className="flex flex-wrap gap-2">
                <label htmlFor="profile-business-logo" className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-tradeflow-gray-200 px-3 py-2 text-xs font-bold text-tradeflow-navy hover:bg-tradeflow-gray-50">
                  <ImagePlus className="h-4 w-4" /> {profile.businessLogoUrl && !removeLogo ? 'Change logo' : 'Upload logo'}
                </label>
                {(logoFile || (profile.businessLogoUrl && !removeLogo)) && (
                  <button
                    type="button"
                    onClick={() => {
                      setLogoFile(null);
                      setRemoveLogo(true);
                      setBrandingSaved(false);
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border border-tradeflow-gray-200 px-3 py-2 text-xs font-bold text-gray-600 hover:bg-tradeflow-gray-50"
                  >
                    <X className="h-4 w-4" /> Remove
                  </button>
                )}
              </div>
              <input
                id="profile-business-logo"
                type="file"
                accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={(event) => {
                  handleLogoSelection(event.target.files?.[0]);
                  event.currentTarget.value = '';
                }}
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={savingBranding}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-tradeflow-green px-4 py-2.5 text-xs font-extrabold text-white transition-colors hover:bg-tradeflow-green-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Save className="h-4 w-4" /> {savingBranding ? 'Saving…' : 'Save branding'}
          </button>
        </form>
        <p className="mt-2 text-[11px] text-gray-500">Optional image: JPG, JPEG, PNG, or WebP up to 5 MB.</p>
        {brandingError && <p role="alert" className="mt-3 text-xs font-semibold text-red-600">{brandingError}</p>}
        {brandingSaved && <p role="status" className="mt-3 text-xs font-semibold text-green-700">Business branding saved.</p>}
      </section>
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
        </>
      )}
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
