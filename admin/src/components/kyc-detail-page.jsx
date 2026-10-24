import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  Building2,
  Calendar,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  CreditCard,
  Download,
  ExternalLink,
  Eye,
  FileCheck2,
  FileText,
  Landmark,
  Mail,
  MapPin,
  Package,
  Phone,
  RotateCcw,
  RotateCw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Tag,
  User,
  UserCheck,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader, StatusBadge } from "@/components/admin-ui";
import { useAdminBreadcrumb } from "@/components/admin-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { apiGet, apiGetKycDocument, apiPatch } from "@/lib/api";
import { cn } from "@/lib/utils";

const RESUBMIT_REASONS = [
  "PAN card image is blurry or illegible",
  "Aadhaar back image missing address proof",
  "GSTIN trade name mismatch with business name",
  "Expired business address proof document",
  "Bank statement / cancelled cheque required",
];

const REJECT_REASONS = [
  "Invalid or unverified PAN / GSTIN credentials",
  "Applicant identity failed authentication check",
  "Business type is ineligible for wholesale catalog",
  "Duplicate registration / blacklisted entity",
];

const textOrFallback = (value) =>
  value === undefined || value === null || value === "" ? "Not provided" : value;

const formatDate = (value) =>
  value
    ? new Date(value).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "Not provided";

const formatDateTime = (value) =>
  value
    ? new Date(value).toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Not provided";

const documentLabel = (value) =>
  String(value || "Document")
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const maskNumber = (value) => {
  const digits = String(value || "").replace(/\D/g, "");
  return digits ? `•••• •••• ${digits.slice(-4)}` : "Not provided";
};

function InfoField({ label, value, href, isMono = false, badge = false }) {
  const content = textOrFallback(value);
  const isFallback = content === "Not provided";

  return (
    <div className="min-w-0 space-y-1">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      {badge && !isFallback ? (
        <span className="inline-flex items-center gap-1 font-mono text-xs font-semibold px-2 py-0.5 rounded-md bg-muted/80 border border-border/80 text-foreground">
          {content}
        </span>
      ) : href && !isFallback ? (
        <a
          className="break-words text-sm font-semibold text-primary hover:underline inline-flex items-center gap-1"
          href={href}
        >
          <span>{content}</span>
          <ExternalLink className="size-3 shrink-0 opacity-70" />
        </a>
      ) : (
        <p
          className={cn(
            "break-words text-sm font-semibold",
            isFallback ? "font-normal italic text-muted-foreground/70" : "text-foreground",
            isMono && !isFallback && "font-mono font-medium"
          )}
        >
          {content}
        </p>
      )}
    </div>
  );
}

function DetailCard({ title, icon: Icon, tone = "primary", children, className }) {
  const tones = {
    primary: "border-primary/20 bg-primary/10 text-primary",
    sky: "border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-400",
    amber: "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-400",
    violet: "border-indigo-500/20 bg-indigo-500/10 text-indigo-700 dark:text-indigo-400",
    emerald: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  };

  return (
    <section className={cn("admin-card overflow-hidden rounded-xl border border-border/80 shadow-xs", className)}>
      <div className="flex items-center gap-2.5 border-b border-border/70 bg-card/60 px-5 py-3.5">
        <div className={cn("flex size-7.5 items-center justify-center rounded-lg border", tones[tone] || tones.primary)}>
          <Icon className="size-4" aria-hidden="true" />
        </div>
        <h2 className="text-sm font-bold tracking-tight text-foreground">{title}</h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4.5 p-5">
        {children}
      </div>
    </section>
  );
}

export function KycDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams({ strict: false });
  const [application, setApplication] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [reasonAction, setReasonAction] = useState("");
  const [reason, setReason] = useState("");
  const [documentPreviews, setDocumentPreviews] = useState({});
  const [activeDocumentIndex, setActiveDocumentIndex] = useState(-1);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  const loadApplication = async () => {
    setLoading(true);
    setError("");
    try {
      setApplication(await apiGet(`/admin/kyc/${encodeURIComponent(id)}`));
    } catch (loadError) {
      setError(loadError.message || "Unable to load this KYC profile.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    apiGet(`/admin/kyc/${encodeURIComponent(id)}`)
      .then((payload) => {
        if (active) setApplication(payload);
      })
      .catch((loadError) => {
        if (active)
          setError(loadError.message || "Unable to load this KYC profile.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  const wholesaler = application?.wholesalerId || {};
  const profile = application?.profile || {};
  const address = application?.registeredAddress || {};
  const bank = application?.bankDetails || {};
  const profileBank = profile?.bankDetails || {};
  const history = Array.isArray(application?.history) ? application.history : [];
  const auditEvents = (application?.auditLogs || []).filter((entry) =>
    [
      "CREATE",
      "KYC_APPROVED",
      "KYC_REJECTED",
      "KYC_RESUBMISSION_REQUESTED",
    ].includes(entry.action)
  );
  const initialSubmission = auditEvents
    .filter((entry) => entry.action === "CREATE")
    .sort((left, right) => new Date(left.createdAt) - new Date(right.createdAt))[0];

  const businessName =
    application?.businessName || profile?.businessName || wholesaler?.name || "Wholesaler";

  // Provide dynamic breadcrumb title to AdminShell topbar
  useAdminBreadcrumb(businessName);

  const documents = useMemo(
    () => (Array.isArray(application?.documents) ? application.documents : []),
    [application?.documents]
  );
  const documentIdsKey = documents
    .map((doc) => String(doc._id || doc.id || ""))
    .join(",");

  useEffect(() => {
    if (!documentIdsKey) {
      setDocumentPreviews({});
      return undefined;
    }
    let active = true;
    const objectUrls = [];
    Promise.all(
      documents.map(async (document) => {
        const documentId = String(document._id || document.id || "");
        if (!documentId) return null;
        try {
          const blob = await apiGetKycDocument(documentId);
          if (!active) return null;
          const url = URL.createObjectURL(blob);
          objectUrls.push(url);
          return [documentId, { url, error: "" }];
        } catch (previewError) {
          return [
            documentId,
            {
              url: "",
              error: previewError.message || "Unable to load document",
            },
          ];
        }
      })
    ).then((entries) => {
      if (active)
        setDocumentPreviews(Object.fromEntries(entries.filter(Boolean)));
    });
    return () => {
      active = false;
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [documentIdsKey, documents]);

  const submitAction = async (event) => {
    if (event) event.preventDefault();
    if (!application || !reasonAction || !reason.trim()) return;
    setActionLoading(true);
    try {
      const actionPath = reasonAction === "reject" ? "reject" : "resubmission";
      await apiPatch(`/admin/kyc/${application._id}/${actionPath}`, {
        reason: reason.trim(),
      });
      toast.success(
        reasonAction === "reject"
          ? "KYC application rejected"
          : "Resubmission requested from wholesaler"
      );
      setReasonAction("");
      setReason("");
      await loadApplication();
    } catch (actionError) {
      toast.error(actionError.message || "Unable to update this application");
    } finally {
      setActionLoading(false);
    }
  };

  const approve = async () => {
    if (!application) return;
    setActionLoading(true);
    try {
      await apiPatch(`/admin/kyc/${application._id}/approve`, {});
      toast.success("KYC application approved successfully");
      await loadApplication();
    } catch (actionError) {
      toast.error(actionError.message || "Unable to approve this application");
    } finally {
      setActionLoading(false);
    }
  };

  const activeDocument =
    activeDocumentIndex >= 0 ? documents[activeDocumentIndex] : null;
  const activePreview = activeDocument
    ? documentPreviews[String(activeDocument._id || activeDocument.id || "")]
    : null;

  const goToDocument = (direction) => {
    if (!documents.length) return;
    setActiveDocumentIndex(
      (current) => (current + direction + documents.length) % documents.length
    );
    setZoom(1);
    setRotation(0);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-6 w-48 rounded-md bg-muted/60 animate-pulse" />
            <div className="h-4 w-72 rounded-md bg-muted/40 animate-pulse" />
          </div>
          <div className="h-9 w-28 rounded-md bg-muted/50 animate-pulse" />
        </div>
        <div className="h-32 rounded-xl border border-border/60 bg-muted/20 animate-pulse p-6" />
        <div className="grid gap-5 xl:grid-cols-2">
          <div className="h-64 rounded-xl border border-border/60 bg-muted/20 animate-pulse" />
          <div className="h-64 rounded-xl border border-border/60 bg-muted/20 animate-pulse" />
        </div>
      </div>
    );
  }

  if (error || !application) {
    return (
      <div className="space-y-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate({ to: "/kyc" })}
          className="gap-1.5"
        >
          <ArrowLeft className="size-4" /> Back to KYC Review
        </Button>
        <div
          role="alert"
          className="admin-card rounded-xl border border-destructive/30 bg-destructive/5 p-8 text-center"
        >
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertCircle className="size-6" />
          </div>
          <h3 className="mt-3 text-base font-bold text-foreground">
            KYC Application Not Found
          </h3>
          <p className="mt-1 text-sm text-muted-foreground max-w-md mx-auto">
            {error || "The requested KYC application record does not exist or has been removed."}
          </p>
          <Button
            variant="default"
            size="sm"
            onClick={() => navigate({ to: "/kyc" })}
            className="mt-4 gap-1.5"
          >
            Return to Applications List
          </Button>
        </div>
      </div>
    );
  }

  const isApproved = application.status === "APPROVED";
  const isResubmit =
    application.status === "RESUBMISSION_REQUIRED" ||
    application.status === "RESUBMIT_REQUESTED";
  const isRejected = application.status === "REJECTED";

  const statusLabels = {
    APPROVED: "KYC Approved",
    REJECTED: "KYC Rejected",
    RESUBMIT_REQUESTED: "Resubmission Requested",
    RESUBMISSION_REQUIRED: "Resubmission Requested",
    SUBMITTED: "KYC Submitted",
    UNDER_REVIEW: "KYC Review Started",
  };

  const timeline = [
    ...(initialSubmission
      ? [
          {
            id: String(initialSubmission._id),
            title: "KYC Submitted",
            reason: "",
            changedAt: initialSubmission.createdAt,
            changedBy: initialSubmission.actorId,
          },
        ]
      : application.submittedAt
      ? [
          {
            id: "initial-submission",
            title: "KYC Submitted",
            changedAt: application.submittedAt,
            changedBy: wholesaler,
          },
        ]
      : []),
    ...history.map((entry, index) => ({
      ...entry,
      id: String(entry._id || index),
      title: statusLabels[entry.toStatus] || "KYC Status Updated",
    })),
  ].sort((left, right) => new Date(left.changedAt) - new Date(right.changedAt));

  const aadhaarNumber =
    application.aadhaarNumber ||
    application.aadhaar ||
    profile.aadhaarNumber ||
    profile.aadhaar;

  const initials =
    businessName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase() || "B";

  return (
    <div className="space-y-6">
      {/* Page Header Pattern */}
      <PageHeader
        title={businessName}
        description="Wholesaler profile, tax identity, uploaded compliance dossiers, and audit timeline."
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate({ to: "/kyc" })}
            className="gap-1.5 shadow-2xs hover:border-primary/40"
          >
            <ArrowLeft className="size-4" />
            <span>Back to KYC Review</span>
          </Button>
        }
      />

      {/* Header Card */}
      <section className="admin-card rounded-xl border border-border/80 bg-card p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          {/* Left: Avatar & Business Details */}
          <div className="flex items-start sm:items-center gap-4">
            <div className="relative flex size-16 shrink-0 items-center justify-center rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/15 to-sky-500/15 font-extrabold text-2xl text-foreground shadow-xs">
              {initials}
            </div>

            <div className="space-y-1.5 min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground truncate">
                  {businessName}
                </h2>
                <StatusBadge status={application.status} />
                {isApproved && (
                  <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 gap-1 text-[11px] font-semibold">
                    <ShieldCheck className="size-3" /> Active Wholesaler
                  </Badge>
                )}
              </div>

              {/* Meta Chips */}
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground pt-0.5">
                <span className="inline-flex items-center gap-1.5 rounded-md border border-border/80 bg-muted/50 px-2.5 py-1 text-xs font-medium">
                  <CalendarDays className="size-3.5 text-muted-foreground/80" />
                  Registered {formatDate(wholesaler.createdAt || profile.createdAt || application.createdAt)}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-md border border-border/80 bg-muted/50 px-2.5 py-1 text-xs font-medium">
                  <Sparkles className="size-3.5 text-muted-foreground/80" />
                  Source: {textOrFallback(profile.registrationSource)}
                </span>
                {application.pan && (
                  <span className="inline-flex items-center gap-1.5 rounded-md border border-border/80 bg-muted/50 px-2.5 py-1 font-mono text-xs font-semibold">
                    <Shield className="size-3.5 text-muted-foreground/80" />
                    PAN: {application.pan}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex flex-wrap items-center gap-2.5 pt-2 lg:pt-0">
            {!isApproved ? (
              <>
                <Button
                  onClick={approve}
                  disabled={actionLoading}
                  className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-xs text-xs h-9 px-3.5"
                >
                  <Check className="size-4" />
                  <span>Approve KYC</span>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setReasonAction("resubmission");
                    setReason("");
                  }}
                  disabled={actionLoading}
                  className="gap-1.5 border-amber-500/40 text-amber-700 hover:bg-amber-500/10 dark:text-amber-400 font-semibold shadow-2xs text-xs h-9 px-3"
                >
                  <RotateCcw className="size-4" />
                  <span>Request Resubmission</span>
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    setReasonAction("reject");
                    setReason("");
                  }}
                  disabled={actionLoading}
                  className="gap-1.5 font-semibold shadow-xs text-xs h-9 px-3"
                >
                  <X className="size-4" />
                  <span>Reject</span>
                </Button>
              </>
            ) : (
              <Button
                variant="outline"
                onClick={() => {
                  setReasonAction("resubmission");
                  setReason("");
                }}
                disabled={actionLoading}
                className="gap-1.5 text-muted-foreground hover:text-amber-700 hover:border-amber-500/40 text-xs h-9 px-3"
              >
                <RotateCcw className="size-4" />
                <span>Request Re-verification</span>
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* Grid of Section Cards (12px radius, tinted icons, small uppercase gray labels) */}
      <div className="grid gap-5 xl:grid-cols-2">
        {/* Card 1: Business Details */}
        <DetailCard title="Business details" icon={Building2} tone="emerald">
          <InfoField
            label="Business name"
            value={application.businessName || profile.businessName}
          />
          <InfoField
            label="Business type"
            value={application.businessType || profile.businessType}
          />
          <InfoField
            label="Street address"
            value={address.street || profile.address?.street}
          />
          <InfoField
            label="City"
            value={address.city || profile.address?.city}
          />
          <InfoField
            label="State"
            value={address.state || profile.address?.state}
          />
          <InfoField
            label="Pincode"
            value={address.pincode || profile.address?.pincode}
          />
          <InfoField
            label="GSTIN"
            value={application.gstin || profile.gstin}
            badge
          />
          <InfoField
            label="Has GST"
            value={
              (application.hasGst ?? profile.hasGst)
                ? "Yes (Registered)"
                : application.hasGst === false || profile.hasGst === false
                ? "No (Unregistered)"
                : "Not provided"
            }
          />
        </DetailCard>

        {/* Card 2: Owner and Contact */}
        <DetailCard title="Owner and contact" icon={UserCheck} tone="sky">
          <InfoField
            label="Owner name"
            value={application.ownerName || wholesaler.name}
          />
          <InfoField
            label="Signatory status"
            value={wholesaler.status ? `Account ${wholesaler.status}` : "Primary Contact"}
          />
          <InfoField
            label="Mobile"
            value={wholesaler.phone}
            href={wholesaler.phone ? `tel:${wholesaler.phone}` : undefined}
          />
          <InfoField
            label="Email"
            value={wholesaler.email}
            href={wholesaler.email ? `mailto:${wholesaler.email}` : undefined}
          />
          <InfoField
            label="Last login"
            value={formatDateTime(wholesaler.lastLoginAt)}
          />
          <InfoField
            label="User registered"
            value={formatDate(wholesaler.createdAt)}
          />
        </DetailCard>

        {/* Card 3: Identity & Legal IDs */}
        <DetailCard title="Identity & Legal IDs" icon={ShieldCheck} tone="amber">
          <InfoField
            label="PAN number"
            value={application.pan || profile.pan}
            badge
          />
          <InfoField
            label="Aadhaar number"
            value={maskNumber(aadhaarNumber)}
            isMono
          />
          <InfoField
            label="Application status"
            value={statusLabels[application.status] || application.status}
          />
          <InfoField
            label="Review date"
            value={application.reviewedAt ? formatDate(application.reviewedAt) : "Pending Review"}
          />
        </DetailCard>

        {/* Card 4: Bank and Pickup Details */}
        <DetailCard title="Bank and pickup details" icon={Landmark} tone="violet">
          <InfoField
            label="Account holder"
            value={bank.accountHolderName || profileBank.accountHolderName}
          />
          <InfoField
            label="Account number"
            value={bank.accountNumber || profileBank.accountNumber}
            isMono
          />
          <InfoField
            label="Bank name"
            value={bank.bankName || profileBank.bankName}
          />
          <InfoField
            label="IFSC Code"
            value={bank.ifscCode || profileBank.ifscCode}
            badge
          />
          <InfoField
            label="Pickup address"
            value={profile.pickupAddress?.street || "Same as registered address"}
          />
          <InfoField
            label="Pickup location"
            value={[
              profile.pickupAddress?.city || address.city,
              profile.pickupAddress?.state || address.state,
              profile.pickupAddress?.pincode || address.pincode,
            ]
              .filter(Boolean)
              .join(", ")}
          />
          <InfoField
            label="Subscription plan"
            value={profile.plan || profile.subscriptionPlan || "Standard"}
          />
          <InfoField
            label="Referral code"
            value={profile.retailerReferralCode || profile.adminReferralCode}
            badge
          />
        </DetailCard>
      </div>

      {/* Uploaded Documents Section */}
      <section className="admin-card overflow-hidden rounded-xl border border-border/80 shadow-xs">
        <div className="flex items-center justify-between border-b border-border/70 bg-card/60 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex size-7.5 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
              <FileText className="size-4" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-tight text-foreground">Uploaded Documents</h2>
              <p className="text-xs text-muted-foreground">
                Identity and legal credentials submitted by wholesaler for verification.
              </p>
            </div>
          </div>
          <Badge variant="outline" className="text-xs font-semibold tabular-nums">
            {documents.length} {documents.length === 1 ? "file" : "files"} attached
          </Badge>
        </div>

        {documents.length ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-5">
            {documents.map((document, index) => {
              const preview =
                documentPreviews[String(document._id || document.id || "")];
              const isImage = document.mimeType?.startsWith("image/");
              const isPdf = document.mimeType === "application/pdf";

              return (
                <button
                  key={String(document._id || document.id || index)}
                  type="button"
                  className="group relative flex flex-col overflow-hidden rounded-xl border border-border/80 bg-card text-left transition-all duration-200 hover:border-primary/60 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  onClick={() => {
                    setActiveDocumentIndex(index);
                    setZoom(1);
                    setRotation(0);
                  }}
                  aria-label={`View ${documentLabel(document.documentType)}`}
                >
                  {/* Thumbnail Container with Hover Zoom */}
                  <div className="relative flex aspect-[16/10] w-full items-center justify-center overflow-hidden bg-muted/40 border-b border-border/60">
                    {preview?.url && isImage ? (
                      <img
                        src={preview.url}
                        alt={documentLabel(document.documentType)}
                        className="h-full w-full object-contain p-2 transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : preview?.url && isPdf ? (
                      <div className="flex flex-col items-center gap-2 text-primary transition-transform duration-300 group-hover:scale-105">
                        <FileText className="size-10 stroke-[1.5]" />
                        <span className="text-xs font-semibold">PDF Document</span>
                      </div>
                    ) : preview?.error ? (
                      <span className="px-4 text-center text-xs text-destructive">
                        {preview.error}
                      </span>
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <FileCheck2 className="size-8 stroke-[1.5] animate-pulse" />
                        <span className="text-xs">
                          {preview?.url ? "Preview unavailable" : "Loading secure document..."}
                        </span>
                      </div>
                    )}

                    {/* Quick View Overlay Badge */}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-bold text-tradeflow-navy shadow-lg">
                        <Eye className="size-3.5" /> Fullscreen View
                      </span>
                    </div>
                  </div>

                  {/* Card Meta Content */}
                  <div className="flex flex-1 flex-col justify-between p-3.5 space-y-1">
                    <div>
                      <span className="block truncate text-sm font-bold text-foreground">
                        {documentLabel(document.documentType)}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground font-mono">
                        {textOrFallback(document.originalName)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-border/50 text-[11px] text-muted-foreground">
                      <span>{formatDate(document.createdAt)}</span>
                      <span className="font-semibold uppercase text-[10px] text-muted-foreground/80">
                        {document.mimeType?.split("/")[1] || "DOC"}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No KYC documents have been uploaded for this application.
          </div>
        )}
      </section>

      {/* Activity & History Grid */}
      <div className="grid gap-5 xl:grid-cols-2">
        {/* Card 5: Account Activity */}
        <DetailCard title="Account activity" icon={Activity} tone="sky">
          <InfoField
            label="Linked retailers"
            value={application.stats?.linkedRetailersCount ?? 0}
          />
          <InfoField
            label="Active products"
            value={application.stats?.productsCount ?? 0}
          />
          <InfoField
            label="Total orders placed"
            value={application.stats?.ordersCount ?? 0}
          />
          <InfoField
            label="Registration source"
            value={profile.registrationSource}
          />
        </DetailCard>

        {/* Card 6: KYC Review History */}
        <section className="admin-card overflow-hidden rounded-xl border border-border/80 shadow-xs">
          <div className="flex items-center gap-2.5 border-b border-border/70 bg-card/60 px-5 py-3.5">
            <div className="flex size-7.5 items-center justify-center rounded-lg border border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-400">
              <Clock3 className="size-4" aria-hidden="true" />
            </div>
            <h2 className="text-sm font-bold tracking-tight text-foreground">KYC Audit History</h2>
          </div>
          {timeline.length ? (
            <ol className="space-y-0 p-5">
              {timeline.map((event) => (
                <li
                  key={event.id}
                  className="relative border-l border-border/80 pb-6 pl-5 last:border-transparent last:pb-0"
                >
                  <span className="absolute -left-1.5 top-1 size-3 rounded-full border-2 border-primary bg-background" />
                  <p className="font-bold text-sm text-foreground">
                    {String(event.title || "").replaceAll("_", " ")}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatDateTime(event.changedAt)} ·{" "}
                    <span className="font-medium text-foreground/80">
                      {textOrFallback(event.changedBy?.name || event.changedBy?.email || "System")}
                    </span>
                  </p>
                  {event.reason && (
                    <div className="mt-2 rounded-md border border-border/60 bg-muted/40 p-2.5 text-xs text-foreground">
                      <span className="font-semibold text-muted-foreground block text-[10px] uppercase">
                        Reason / Notes:
                      </span>
                      {event.reason}
                    </div>
                  )}
                </li>
              ))}
            </ol>
          ) : (
            <p className="p-5 text-sm text-muted-foreground">
              No audit timeline events available for this dossier.
            </p>
          )}
        </section>
      </div>

      {/* Action Dialog: Reject / Resubmission with Quick Reason Presets */}
      <Dialog
        open={Boolean(reasonAction)}
        onOpenChange={(open) => {
          if (!open && !actionLoading) {
            setReasonAction("");
            setReason("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-xl border",
                  reasonAction === "reject"
                    ? "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400"
                    : "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                )}
              >
                {reasonAction === "reject" ? (
                  <ShieldAlert className="size-5" />
                ) : (
                  <RotateCcw className="size-5" />
                )}
              </div>
              <div>
                <DialogTitle className="text-base font-bold">
                  {reasonAction === "reject"
                    ? "Reject KYC Application"
                    : "Request Document Resubmission"}
                </DialogTitle>
                <DialogDescription className="text-xs">
                  {reasonAction === "reject"
                    ? "Specify the compliance deficiency causing this application to be rejected."
                    : "Provide specific instructions for the wholesaler on what to re-upload."}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={submitAction} className="space-y-4 pt-2">
            {/* Wholesaler Summary Card */}
            <div className="rounded-lg border border-border/80 bg-muted/40 p-3 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground">{businessName}</span>
                <Badge variant="outline" className="text-[10px] uppercase font-mono">
                  {application.pan || "No PAN"}
                </Badge>
              </div>
              <p className="text-muted-foreground truncate">
                {wholesaler.email || "No email available"}
              </p>
            </div>

            {/* Quick Suggestion Chips */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
                <span>Quick Select Reason</span>
                <span className="text-[10px] text-muted-foreground/80">Click to insert</span>
              </label>
              <div className="flex flex-wrap gap-1.5">
                {(reasonAction === "reject" ? REJECT_REASONS : RESUBMIT_REASONS).map(
                  (preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setReason(preset)}
                      className="rounded-md border border-border/80 bg-background px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/5 hover:text-foreground text-left"
                    >
                      + {preset}
                    </button>
                  )
                )}
              </div>
            </div>

            {/* Notice to Wholesaler */}
            <div className="space-y-1.5">
              <label htmlFor="resubmit-textarea" className="text-xs font-semibold text-foreground">
                Notice to Wholesaler <span className="text-destructive">*</span>
              </label>
              <Textarea
                id="resubmit-textarea"
                required
                autoFocus
                rows={4}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder={
                  reasonAction === "reject"
                    ? "State detailed reasons for KYC rejection..."
                    : "Specify required fixes (e.g. upload uncropped PAN photo)..."
                }
                disabled={actionLoading}
                className="text-sm resize-none focus-visible:ring-primary"
              />
              <p className="text-[11px] text-muted-foreground">
                This notice will be sent to the wholesaler and displayed on their KYC review portal.
              </p>
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setReasonAction("");
                  setReason("");
                }}
                disabled={actionLoading}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant={reasonAction === "reject" ? "destructive" : "default"}
                disabled={actionLoading || !reason.trim()}
                className={cn(
                  "text-xs font-semibold",
                  reasonAction !== "reject" && "bg-amber-600 hover:bg-amber-700 text-white"
                )}
              >
                {actionLoading ? (
                  "Saving..."
                ) : reasonAction === "reject" ? (
                  "Confirm Rejection"
                ) : (
                  "Send Resubmit Request"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Fullscreen Document Viewer Dialog */}
      <Dialog
        open={Boolean(activeDocument)}
        onOpenChange={(open) => !open && setActiveDocumentIndex(-1)}
      >
        <DialogContent className="fixed inset-0 z-[60] flex h-screen w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none border-0 bg-black/95 p-0 text-white sm:rounded-none [&>button:last-child]:hidden backdrop-blur-md">
          {/* Viewer Top Bar */}
          <div className="flex items-center justify-between gap-3 border-b border-white/15 px-4 py-3 bg-black/80">
            <div className="min-w-0">
              <DialogTitle className="truncate text-sm font-bold text-white">
                {documentLabel(activeDocument?.documentType)}
              </DialogTitle>
              <p className="truncate text-xs text-white/65 font-mono">
                {activeDocument?.originalName}
              </p>
            </div>

            {/* Viewer Action Controls */}
            <div className="flex shrink-0 items-center gap-1">
              <Button
                size="icon"
                variant="ghost"
                title="Previous document"
                aria-label="Previous document"
                onClick={() => goToDocument(-1)}
                disabled={documents.length < 2}
                className="text-white hover:bg-white/15"
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                title="Next document"
                aria-label="Next document"
                onClick={() => goToDocument(1)}
                disabled={documents.length < 2}
                className="text-white hover:bg-white/15"
              >
                <ChevronRight className="size-4" />
              </Button>
              <div className="h-4 w-px bg-white/20 mx-1" />
              <Button
                size="icon"
                variant="ghost"
                title="Zoom out"
                aria-label="Zoom out"
                onClick={() => setZoom((value) => Math.max(0.5, value - 0.25))}
                className="text-white hover:bg-white/15"
              >
                <ZoomOut className="size-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                title="Zoom in"
                aria-label="Zoom in"
                onClick={() => setZoom((value) => Math.min(3, value + 0.25))}
                className="text-white hover:bg-white/15"
              >
                <ZoomIn className="size-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                title="Rotate"
                aria-label="Rotate document"
                onClick={() => setRotation((value) => (value + 90) % 360)}
                className="text-white hover:bg-white/15"
              >
                <RotateCw className="size-4" />
              </Button>
              {activePreview?.url && (
                <a
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md text-white hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white transition-colors"
                  href={activePreview.url}
                  download={activeDocument?.originalName || "kyc-document"}
                  title="Download document"
                  aria-label="Download document"
                >
                  <Download className="size-4" />
                </a>
              )}
              <div className="h-4 w-px bg-white/20 mx-1" />
              <Button
                size="icon"
                variant="ghost"
                title="Close viewer"
                aria-label="Close viewer"
                onClick={() => setActiveDocumentIndex(-1)}
                className="text-white hover:bg-white/20"
              >
                <X className="size-4" />
              </Button>
            </div>
          </div>

          {/* Viewer Preview Area */}
          <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-4 sm:p-8">
            {activePreview?.error ? (
              <div className="text-center space-y-2">
                <AlertCircle className="size-8 text-rose-400 mx-auto" />
                <p role="alert" className="text-sm text-rose-300">
                  {activePreview.error}
                </p>
              </div>
            ) : !activePreview?.url ? (
              <div className="flex items-center gap-2 text-sm text-white/70">
                <FileCheck2 className="size-5 animate-pulse text-primary" />
                <span>Decrypting & loading document securely...</span>
              </div>
            ) : activeDocument?.mimeType === "application/pdf" ? (
              <iframe
                title={activeDocument.originalName || "KYC PDF"}
                src={activePreview.url}
                className="h-full w-full max-w-5xl rounded-lg bg-white shadow-2xl"
                style={{ transform: `rotate(${rotation}deg) scale(${zoom})` }}
              />
            ) : activeDocument?.mimeType?.startsWith("image/") ? (
              <img
                src={activePreview.url}
                alt={documentLabel(activeDocument.documentType)}
                className="max-h-full max-w-full rounded-md object-contain transition-transform shadow-2xl"
                style={{ transform: `rotate(${rotation}deg) scale(${zoom})` }}
              />
            ) : (
              <div className="text-center text-sm text-white/70">
                Preview is not supported for this file type. Please use the Download button.
              </div>
            )}
          </div>

          {/* Viewer Bottom Counter */}
          <div className="border-t border-white/15 px-4 py-2.5 text-center text-xs text-white/60 bg-black/80 font-medium">
            Document {activeDocumentIndex + 1} of {documents.length}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
