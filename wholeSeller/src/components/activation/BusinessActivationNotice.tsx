import { AlertCircle, Clock, ShieldAlert, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useWholesaler } from '@/context/WholesalerContext';

type BusinessActivationNoticeProps = {
  kycStatus?: string;
  isProfileLoaded?: boolean;
};

export default function BusinessActivationNotice(props: BusinessActivationNoticeProps) {
  const context = useWholesaler();

  const isProfileLoaded = props.isProfileLoaded ?? context.isProfileLoaded;

  if (!isProfileLoaded) return null;

  const kycStatus = String(props.kycStatus ?? context.profile.kycStatus ?? '').trim().toUpperCase();
  const kycApproved = kycStatus === 'APPROVED';

  if (kycApproved) return null;

  // Determine main alert state matching requirements exactly
  let title = '';
  let description = '';
  let actionText = '';
  let actionLink = '';
  let icon = <AlertCircle className="mt-0.5 size-5 shrink-0 text-[#8A2C45]" />;
  let badgeTone = 'border-[#E8D8C8] bg-[#FBF5EA] text-[#4B2430]';

  if (!kycApproved) {
    if (['SUBMITTED', 'UNDER_REVIEW', 'PENDING'].includes(kycStatus)) {
      title = 'Your KYC is under review';
      description = 'Your KYC documents are currently being verified by the admin team. Business management features will activate once approved.';
      actionText = 'View KYC Status';
      actionLink = '/dashboard/kyc';
      icon = <Clock className="mt-0.5 size-5 shrink-0 text-amber-600" />;
      badgeTone = 'border-amber-200 bg-amber-50/70 text-amber-900';
    } else if (['REJECTED', 'RESUBMISSION_REQUIRED', 'RESUBMIT_REQUESTED'].includes(kycStatus)) {
      title = 'Your KYC was rejected. Please review and resubmit';
      description = 'Your KYC application was not approved. Please review the admin remarks and resubmit updated details to unlock features.';
      actionText = 'Resubmit KYC';
      actionLink = '/dashboard/kyc';
      icon = <ShieldAlert className="mt-0.5 size-5 shrink-0 text-rose-600" />;
      badgeTone = 'border-rose-200 bg-rose-50/80 text-rose-900';
    } else {
      title = 'Complete KYC to continue';
      description = 'Submit your business identity documents for KYC review to unlock product, category, and retailer features.';
      actionText = 'Complete KYC';
      actionLink = '/dashboard/kyc';
      icon = <ShieldCheck className="mt-0.5 size-5 shrink-0 text-tradeflow-navy" />;
      badgeTone = 'border-[#E8D8C8] bg-[#FBF5EA] text-[#4B2430]';
    }
  }

  const kycLabel = kycApproved
    ? 'Approved'
    : ['SUBMITTED', 'UNDER_REVIEW', 'PENDING'].includes(kycStatus)
      ? 'Under review'
      : ['REJECTED', 'RESUBMISSION_REQUIRED', 'RESUBMIT_REQUESTED'].includes(kycStatus)
        ? 'Action required'
        : 'Incomplete';

  return (
    <section
      role="alert"
      className={`space-y-4 rounded-2xl border p-4 text-sm shadow-sm transition-all sm:p-5 ${badgeTone}`}
    >
      <div className="flex items-start gap-3">
        {icon}
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-extrabold tracking-tight">{title}</h2>
          <p className="mt-1 text-xs leading-5 opacity-90">{description}</p>
        </div>
      </div>

      <div className="flex min-w-0 items-center justify-between rounded-xl border border-black/10 bg-white/90 px-3.5 py-2.5">
        <div className="flex items-center gap-2 min-w-0">
          {['SUBMITTED', 'UNDER_REVIEW', 'PENDING'].includes(kycStatus) ? (
            <Clock className="size-4 shrink-0 text-amber-600" />
          ) : (
            <ShieldAlert className="size-4 shrink-0 text-rose-600" />
          )}
          <span className="truncate text-xs font-medium text-gray-700">KYC Status:</span>
        </div>
        <span className="text-xs font-bold text-gray-900">{kycLabel}</span>
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Link
          to={actionLink}
          className="inline-flex items-center rounded-xl bg-tradeflow-navy px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-black"
        >
          {actionText}
        </Link>
      </div>
    </section>
  );
}
