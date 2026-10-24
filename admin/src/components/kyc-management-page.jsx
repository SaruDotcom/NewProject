import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  AlertCircle,
  AlertTriangle,
  BadgeCheck,
  Building2,
  Calendar,
  Check,
  Clock,
  ExternalLink,
  Eye,
  FileCheck2,
  FileText,
  Mail,
  RefreshCw,
  RotateCcw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  User,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState, PageHeader, StatusBadge } from "@/components/admin-ui";
import { apiGet, apiPatch } from "@/lib/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const statusLabels = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  RESUBMISSION_REQUIRED: "Resubmission required",
  RESUBMIT_REQUESTED: "Resubmission required",
};

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

function getRelativeTime(dateString) {
  if (!dateString) return "";
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);
  if (diffInSeconds < 60) return "Just now";
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 30) return `${diffInDays}d ago`;
  const diffInMonths = Math.floor(diffInDays / 30);
  return `${diffInMonths}mo ago`;
}

export function KycManagementPage() {
  const navigate = useNavigate();
  const [applications, setApplications] = useState([]);
  const [allApplications, setAllApplications] = useState([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [reasonAction, setReasonAction] = useState(null);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");

  const loadApplications = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const query =
        status === "all" ? "?limit=100" : `?status=${encodeURIComponent(status)}&limit=100`;

      const [filteredPayload, allPayload] = await Promise.all([
        apiGet(`/admin/kyc${query}`),
        apiGet(`/admin/kyc?limit=100`),
      ]);

      const items = Array.isArray(filteredPayload)
        ? filteredPayload
        : filteredPayload?.applications || filteredPayload?.items || [];
      setApplications(items);

      const allItems = Array.isArray(allPayload)
        ? allPayload
        : allPayload?.applications || allPayload?.items || [];
      setAllApplications(allItems);
    } catch (loadError) {
      setError(loadError.message || "Unable to load KYC applications.");
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    loadApplications();
  }, [loadApplications]);

  // Compute status counts across all applications
  const counts = useMemo(() => {
    const pool = allApplications.length ? allApplications : applications;
    let pending = 0;
    let approved = 0;
    let resubmit = 0;
    let rejected = 0;

    for (const app of pool) {
      const st = String(app.status || "").toUpperCase();
      if (st === "APPROVED") {
        approved++;
      } else if (st === "RESUBMISSION_REQUIRED" || st === "RESUBMIT_REQUESTED") {
        resubmit++;
      } else if (st === "REJECTED") {
        rejected++;
      } else if (["PENDING", "SUBMITTED", "UNDER_REVIEW"].includes(st)) {
        pending++;
      }
    }

    return {
      total: pool.length,
      pending,
      approved,
      resubmit,
      rejected,
    };
  }, [allApplications, applications]);

  const visibleApplications = useMemo(() => {
    const query = search.trim().toLowerCase();
    return applications.filter((application) => {
      const wholesaler = application.wholesalerId || {};
      return (
        !query ||
        [
          application.businessName,
          application.ownerName,
          application.pan,
          application.gstin,
          wholesaler.email,
          wholesaler.name,
        ].some((value) =>
          String(value || "")
            .toLowerCase()
            .includes(query)
        )
      );
    });
  }, [applications, search]);

  const approveApplication = async (application) => {
    setActionLoading(true);
    try {
      await apiPatch(`/admin/kyc/${application._id}/approve`, {});
      toast.success(`${application.businessName || "Wholesaler"} approved successfully`);
      await loadApplications();
    } catch (actionError) {
      toast.error(actionError.message || "Unable to approve this application");
    } finally {
      setActionLoading(false);
    }
  };

  const submitReasonAction = async (event) => {
    if (event) event.preventDefault();
    if (!reasonAction || !reason.trim()) return;
    setActionLoading(true);
    try {
      const actionPath =
        reasonAction.type === "reject" ? "reject" : "resubmission";
      await apiPatch(
        `/admin/kyc/${reasonAction.application._id}/${actionPath}`,
        { reason: reason.trim() }
      );
      toast.success(
        reasonAction.type === "reject"
          ? "KYC application rejected"
          : "Resubmission requested from wholesaler"
      );
      setReasonAction(null);
      setReason("");
      await loadApplications();
    } catch (actionError) {
      toast.error(actionError.message || "Unable to update this application");
    } finally {
      setActionLoading(false);
    }
  };

  const filterTabs = [
    { id: "all", label: "All Requests", count: counts.total },
    {
      id: "PENDING",
      label: "Pending Review",
      count: counts.pending,
      badgeColor:
        counts.pending > 0
          ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30"
          : undefined,
    },
    {
      id: "APPROVED",
      label: "Approved",
      count: counts.approved,
      badgeColor: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
    },
    {
      id: "RESUBMISSION_REQUIRED",
      label: "Resubmit Requested",
      count: counts.resubmit,
      badgeColor: "bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/20",
    },
    {
      id: "REJECTED",
      label: "Rejected",
      count: counts.rejected,
      badgeColor: "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20",
    },
  ];

  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-6">
        {/* Top Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                <ShieldCheck className="size-3.5" />
                Compliance & Verification
              </span>
              {counts.pending > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-400 animate-pulse">
                  <Clock className="size-3" />
                  {counts.pending} Action Required
                </span>
              )}
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              KYC Review
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Review wholesaler identity, tax credentials, and business registrations before enabling catalog creation.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              onClick={loadApplications}
              disabled={loading}
              className="h-9 gap-2 shadow-xs transition-all hover:border-primary/40"
            >
              <RefreshCw className={cn("size-3.5", loading && "animate-spin text-primary")} />
              <span>Refresh</span>
            </Button>
          </div>
        </div>

        {/* KPI Metrics Cards */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {/* Card 1: Total */}
          <button
            type="button"
            onClick={() => setStatus("all")}
            className={cn(
              "admin-card group relative flex flex-col justify-between overflow-hidden p-4 text-left transition-all duration-200",
              status === "all"
                ? "ring-2 ring-primary/40 border-primary/40 shadow-sm"
                : "hover:border-slate-300 dark:hover:border-slate-700"
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Total Dossiers
              </span>
              <div className="flex size-8 items-center justify-center rounded-lg border border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-200">
                <Building2 className="size-4" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl font-extrabold tracking-tight text-foreground">
                {counts.total}
              </span>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                All registered wholesalers
              </p>
            </div>
          </button>

          {/* Card 2: Pending Review */}
          <button
            type="button"
            onClick={() => setStatus("PENDING")}
            className={cn(
              "admin-card group relative flex flex-col justify-between overflow-hidden p-4 text-left transition-all duration-200",
              status === "PENDING"
                ? "ring-2 ring-amber-500/50 border-amber-500/50 shadow-sm"
                : "hover:border-amber-300 dark:hover:border-amber-800"
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                Pending Review
              </span>
              <div className="flex size-8 items-center justify-center rounded-lg border border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-400">
                <Clock className="size-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-extrabold tracking-tight text-foreground">
                  {counts.pending}
                </span>
                {counts.pending > 0 && (
                  <span className="inline-flex items-center rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-400">
                    Needs Action
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Awaiting approval decision
              </p>
            </div>
          </button>

          {/* Card 3: Approved */}
          <button
            type="button"
            onClick={() => setStatus("APPROVED")}
            className={cn(
              "admin-card group relative flex flex-col justify-between overflow-hidden p-4 text-left transition-all duration-200",
              status === "APPROVED"
                ? "ring-2 ring-emerald-500/50 border-emerald-500/50 shadow-sm"
                : "hover:border-emerald-300 dark:hover:border-emerald-800"
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                Approved
              </span>
              <div className="flex size-8 items-center justify-center rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                <ShieldCheck className="size-4" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl font-extrabold tracking-tight text-foreground">
                {counts.approved}
              </span>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Verified & active catalog access
              </p>
            </div>
          </button>

          {/* Card 4: Resubmit Requested */}
          <button
            type="button"
            onClick={() => setStatus("RESUBMISSION_REQUIRED")}
            className={cn(
              "admin-card group relative flex flex-col justify-between overflow-hidden p-4 text-left transition-all duration-200",
              status === "RESUBMISSION_REQUIRED"
                ? "ring-2 ring-sky-500/50 border-sky-500/50 shadow-sm"
                : "hover:border-sky-300 dark:hover:border-sky-800"
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-sky-700 dark:text-sky-400">
                Resubmit Requested
              </span>
              <div className="flex size-8 items-center justify-center rounded-lg border border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-400">
                <RotateCcw className="size-4" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl font-extrabold tracking-tight text-foreground">
                {counts.resubmit}
              </span>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Awaiting updated documents
              </p>
            </div>
          </button>
        </div>

        {/* Main Content Card */}
        <section className="admin-card overflow-hidden border-border/80 shadow-sm">
          {/* Controls: Search & Filter Tabs */}
          <div className="flex flex-col gap-3.5 border-b border-border/70 bg-card/60 p-4 lg:flex-row lg:items-center lg:justify-between">
            {/* Search Input */}
            <div className="relative min-w-64 max-w-md flex-1">
              <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground pointer-events-none" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search business, owner, PAN, or GSTIN..."
                className="pl-9 pr-8 text-sm shadow-none h-9.5 bg-background border-border/80 focus-visible:ring-1 focus-visible:ring-primary"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground p-0.5 rounded-sm"
                  aria-label="Clear search"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>

            {/* Segmented Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              {filterTabs.map((tab) => {
                const isActive = status === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setStatus(tab.id)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-150 border",
                      isActive
                        ? "bg-tradeflow-navy text-white border-tradeflow-navy shadow-xs dark:bg-primary dark:text-primary-foreground dark:border-primary"
                        : "bg-background text-muted-foreground border-border/70 hover:bg-muted/70 hover:text-foreground"
                    )}
                  >
                    <span>{tab.label}</span>
                    <span
                      className={cn(
                        "rounded-full px-1.5 py-0.2 text-[10px] font-bold tabular-nums",
                        isActive
                          ? "bg-white/20 text-white"
                          : tab.badgeColor || "bg-muted text-muted-foreground"
                      )}
                    >
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Table / Content Area */}
          {loading ? (
            <div className="p-6">
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="flex items-center gap-4 rounded-lg border border-border/50 p-4 animate-pulse bg-muted/20"
                  >
                    <div className="size-10 rounded-xl bg-muted/60" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-40 rounded bg-muted/60" />
                      <div className="h-3 w-28 rounded bg-muted/40" />
                    </div>
                    <div className="h-4 w-24 rounded bg-muted/40" />
                    <div className="h-4 w-28 rounded bg-muted/40" />
                    <div className="h-6 w-20 rounded-full bg-muted/50" />
                    <div className="h-8 w-24 rounded bg-muted/50" />
                  </div>
                ))}
              </div>
            </div>
          ) : error ? (
            <div role="alert" className="flex flex-col items-center justify-center p-12 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-rose-500/10 text-rose-600 border border-rose-500/20">
                <AlertCircle className="size-6" />
              </div>
              <h3 className="mt-3 font-semibold text-foreground">Failed to load applications</h3>
              <p className="mt-1 text-sm text-muted-foreground">{error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={loadApplications}
                className="mt-4 gap-1.5"
              >
                <RefreshCw className="size-3.5" />
                Retry
              </Button>
            </div>
          ) : visibleApplications.length === 0 ? (
            <EmptyState
              icon={search ? Search : ShieldCheck}
              title={search ? "No matching KYC records" : "No applications found"}
              description={
                search
                  ? `No applications matched "${search}". Try searching by another keyword or reset the filter.`
                  : status === "all"
                  ? "There are currently no wholesaler KYC applications in the system."
                  : `There are no applications currently marked as "${statusLabels[status] || status}".`
              }
              action={
                search || status !== "all" ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSearch("");
                      setStatus("all");
                    }}
                    className="gap-1.5"
                  >
                    <RotateCcw className="size-3.5" />
                    Reset all filters
                  </Button>
                ) : null
              }
            />
          ) : (
            <div className="relative overflow-x-auto fine-scrollbar">
              <Table className="w-full min-w-[1050px] text-left">
                <TableHeader>
                  <TableRow className="border-b border-border/80 bg-muted/30 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:bg-muted/30">
                    <TableHead className="py-3.5 pl-5 pr-4 w-[280px]">Business & Entity</TableHead>
                    <TableHead className="py-3.5 px-4 w-[180px]">Owner / Signatory</TableHead>
                    <TableHead className="py-3.5 px-4 w-[180px]">Tax Credentials</TableHead>
                    <TableHead className="py-3.5 px-4 w-[150px]">Submitted</TableHead>
                    <TableHead className="py-3.5 px-4 w-[140px]">Status</TableHead>
                    <TableHead className="py-3.5 pl-4 pr-5 text-right w-[240px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleApplications.map((application, index) => {
                    const appId = String(
                      application._id || application.id || `kyc-${index}`
                    );
                    const wholesaler = application.wholesalerId || {};
                    const bName =
                      application.businessName ||
                      wholesaler.businessName ||
                      "Business";
                    const isApproved = application.status === "APPROVED";
                    const isResubmit =
                      application.status === "RESUBMISSION_REQUIRED" ||
                      application.status === "RESUBMIT_REQUESTED";
                    const isRejected = application.status === "REJECTED";
                    const isPending =
                      application.status === "SUBMITTED" ||
                      application.status === "UNDER_REVIEW" ||
                      application.status === "PENDING" ||
                      !application.status;

                    // Monogram letters
                    const initials =
                      bName
                        .split(/\s+/)
                        .filter(Boolean)
                        .slice(0, 2)
                        .map((w) => w[0])
                        .join("")
                        .toUpperCase() || "B";

                    return (
                      <TableRow
                        key={appId}
                        className="group border-b border-border/60 transition-colors hover:bg-muted/30"
                      >
                        {/* Column 1: Business Profile */}
                        <TableCell className="py-3.5 pl-5 pr-4">
                          <div className="flex items-center gap-3">
                            <div className="relative flex size-10 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-gradient-to-br from-primary/10 to-sky-500/10 font-bold text-xs text-foreground shadow-2xs">
                              {initials}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() =>
                                    navigate({
                                      to: "/kyc/$id",
                                      params: { id: appId },
                                    })
                                  }
                                  className="truncate font-semibold text-sm text-foreground hover:text-primary transition-colors text-left flex items-center gap-1 group/btn"
                                  title={`View ${bName} KYC Details`}
                                >
                                  <span>{bName}</span>
                                  <ExternalLink className="size-3 opacity-0 group-hover/btn:opacity-100 transition-opacity text-primary shrink-0" />
                                </button>
                                {isApproved && (
                                  <BadgeCheck
                                    className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                                    title="Verified Business"
                                  />
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5 truncate">
                                <Mail className="size-3 shrink-0 opacity-70" />
                                <span className="truncate">{wholesaler.email || "No email"}</span>
                              </div>
                            </div>
                          </div>
                        </TableCell>

                        {/* Column 2: Owner */}
                        <TableCell className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <div className="flex size-7 shrink-0 items-center justify-center rounded-full border border-border/80 bg-muted/60 text-muted-foreground">
                              <User className="size-3.5" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-sm text-foreground truncate">
                                {application.ownerName || wholesaler.name || "—"}
                              </p>
                              <p className="text-[11px] text-muted-foreground">
                                Primary Signatory
                              </p>
                            </div>
                          </div>
                        </TableCell>

                        {/* Column 3: Tax Credentials */}
                        <TableCell className="py-3.5 px-4">
                          <div className="space-y-1">
                            <div className="inline-flex items-center gap-1 font-mono text-xs font-semibold px-2 py-0.5 rounded-md bg-muted/70 border border-border/80 text-foreground">
                              <Shield className="size-3 text-muted-foreground" />
                              <span>{application.pan || "No PAN"}</span>
                            </div>
                            <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                              <span className="font-semibold text-muted-foreground/70 text-[10px]">GST:</span>
                              {application.gstin ? (
                                <span className="font-mono text-xs font-medium text-foreground">
                                  {application.gstin}
                                </span>
                              ) : (
                                <span className="italic text-muted-foreground/70">Unregistered</span>
                              )}
                            </div>
                          </div>
                        </TableCell>

                        {/* Column 4: Submitted Date */}
                        <TableCell className="py-3.5 px-4">
                          <div className="flex items-start gap-2">
                            <Calendar className="size-3.5 text-muted-foreground mt-0.5 shrink-0" />
                            <div>
                              <p className="text-sm font-medium text-foreground whitespace-nowrap">
                                {application.submittedAt
                                  ? new Date(application.submittedAt).toLocaleDateString("en-IN", {
                                      day: "numeric",
                                      month: "short",
                                      year: "numeric",
                                    })
                                  : "—"}
                              </p>
                              <p className="text-[11px] text-muted-foreground">
                                {getRelativeTime(application.submittedAt)}
                              </p>
                            </div>
                          </div>
                        </TableCell>

                        {/* Column 5: Status */}
                        <TableCell className="py-3.5 px-4">
                          <StatusBadge
                            status={
                              statusLabels[application.status] ||
                              application.status
                            }
                          />
                        </TableCell>

                        {/* Column 6: Actions */}
                        <TableCell className="py-3.5 pl-4 pr-5">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Primary 'View Dossier' Button */}
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-8 gap-1 px-2.5 text-xs font-semibold shadow-2xs hover:border-primary/40"
                                  onClick={() =>
                                    navigate({
                                      to: "/kyc/$id",
                                      params: { id: appId },
                                    })
                                  }
                                >
                                  <Eye className="size-3.5 text-muted-foreground" />
                                  <span>View</span>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                Open full KYC documentation dossier
                              </TooltipContent>
                            </Tooltip>

                            {/* Pending State Actions */}
                            {isPending && (
                              <>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="sm"
                                      onClick={() => approveApplication(application)}
                                      disabled={actionLoading}
                                      className="h-8 gap-1 px-3 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                                    >
                                      <Check className="size-3.5" />
                                      <span>Approve</span>
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    Approve business & enable catalog access
                                  </TooltipContent>
                                </Tooltip>

                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => {
                                        setReasonAction({
                                          type: "resubmission",
                                          application,
                                        });
                                        setReason("");
                                      }}
                                      disabled={actionLoading}
                                      className="h-8 size-8 p-0 border-amber-500/40 text-amber-700 hover:bg-amber-500/10 hover:border-amber-500/60 dark:text-amber-400"
                                    >
                                      <RotateCcw className="size-3.5" />
                                      <span className="sr-only">Request Resubmission</span>
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    Request document correction / resubmission
                                  </TooltipContent>
                                </Tooltip>

                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => {
                                        setReasonAction({
                                          type: "reject",
                                          application,
                                        });
                                        setReason("");
                                      }}
                                      disabled={actionLoading}
                                      className="h-8 size-8 p-0 border-rose-500/40 text-rose-700 hover:bg-rose-500/10 hover:border-rose-500/60 dark:text-rose-400"
                                    >
                                      <X className="size-3.5" />
                                      <span className="sr-only">Reject KYC</span>
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    Reject application
                                  </TooltipContent>
                                </Tooltip>
                              </>
                            )}

                            {/* Approved State Actions */}
                            {isApproved && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setReasonAction({
                                        type: "resubmission",
                                        application,
                                      });
                                      setReason("");
                                    }}
                                    disabled={actionLoading}
                                    className="h-8 gap-1 px-2 text-xs text-muted-foreground hover:text-amber-700 hover:border-amber-500/40"
                                  >
                                    <RotateCcw className="size-3.5" />
                                    <span>Re-verify</span>
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  Request compliance re-verification from this wholesaler
                                </TooltipContent>
                              </Tooltip>
                            )}

                            {/* Resubmit State Actions */}
                            {isResubmit && (
                              <>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="sm"
                                      onClick={() => approveApplication(application)}
                                      disabled={actionLoading}
                                      variant="outline"
                                      className="h-8 gap-1 px-2.5 text-xs text-emerald-700 border-emerald-500/30 hover:bg-emerald-500/10"
                                    >
                                      <Check className="size-3.5" />
                                      <span>Approve</span>
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    Override and approve application
                                  </TooltipContent>
                                </Tooltip>

                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => {
                                        setReasonAction({
                                          type: "resubmission",
                                          application,
                                        });
                                        setReason("");
                                      }}
                                      disabled={actionLoading}
                                      className="h-8 size-8 p-0 text-amber-700 border-amber-500/30 hover:bg-amber-500/10"
                                    >
                                      <RotateCcw className="size-3.5" />
                                      <span className="sr-only">Update Request Note</span>
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    Update resubmission instructions
                                  </TooltipContent>
                                </Tooltip>
                              </>
                            )}

                            {/* Rejected State Actions */}
                            {isRejected && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setReasonAction({
                                        type: "resubmission",
                                        application,
                                      });
                                      setReason("");
                                    }}
                                    disabled={actionLoading}
                                    className="h-8 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
                                  >
                                    <RotateCcw className="size-3.5" />
                                    <span>Re-evaluate</span>
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  Ask wholesaler to submit corrected documents
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Table Footer / Summary Bar */}
          {!loading && !error && visibleApplications.length > 0 && (
            <div className="flex flex-col gap-2 border-t border-border/70 bg-muted/20 px-5 py-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <span>
                Showing <strong className="font-semibold text-foreground">{visibleApplications.length}</strong> of{" "}
                <strong className="font-semibold text-foreground">{applications.length}</strong> records
                {status !== "all" && ` (filtered by ${statusLabels[status] || status})`}
              </span>
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="size-3.5 text-primary" />
                VyaparOne Compliance Core
              </span>
            </div>
          )}
        </section>

        {/* Reason Action Modal (Dialog) */}
        <Dialog
          open={Boolean(reasonAction)}
          onOpenChange={(open) => {
            if (!open && !actionLoading) {
              setReasonAction(null);
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
                    reasonAction?.type === "reject"
                      ? "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400"
                      : "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                  )}
                >
                  {reasonAction?.type === "reject" ? (
                    <ShieldAlert className="size-5" />
                  ) : (
                    <RotateCcw className="size-5" />
                  )}
                </div>
                <div>
                  <DialogTitle className="text-base font-bold">
                    {reasonAction?.type === "reject"
                      ? "Reject KYC Application"
                      : "Request Document Resubmission"}
                  </DialogTitle>
                  <DialogDescription className="text-xs">
                    {reasonAction?.type === "reject"
                      ? "Specify the non-compliance reason for rejecting this wholesaler."
                      : "Provide instructions on which documents need to be re-uploaded."}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            {reasonAction && (
              <form onSubmit={submitReasonAction} className="space-y-4 pt-2">
                {/* Wholesaler Summary Card */}
                <div className="rounded-lg border border-border/80 bg-muted/40 p-3 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground">
                      {reasonAction.application.businessName || "Business"}
                    </span>
                    <Badge variant="outline" className="text-[10px] uppercase font-mono">
                      {reasonAction.application.pan || "No PAN"}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground truncate">
                    {reasonAction.application.wholesalerId?.email || "No email available"}
                  </p>
                </div>

                {/* Quick Suggestion Chips */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
                    <span>Quick Select Reason</span>
                    <span className="text-[10px] text-muted-foreground/80">Click to insert</span>
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {(reasonAction.type === "reject"
                      ? REJECT_REASONS
                      : RESUBMIT_REASONS
                    ).map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setReason(preset)}
                        className="rounded-md border border-border/80 bg-background px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/5 hover:text-foreground text-left"
                      >
                        + {preset}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Detailed Feedback Textarea */}
                <div className="space-y-1.5">
                  <label htmlFor="reason-textarea" className="text-xs font-semibold text-foreground">
                    Notice to Wholesaler <span className="text-destructive">*</span>
                  </label>
                  <Textarea
                    id="reason-textarea"
                    required
                    autoFocus
                    rows={4}
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    placeholder={
                      reasonAction.type === "reject"
                        ? "Detail reasons for rejection..."
                        : "Describe required fixes (e.g. upload clear PAN photo and electricity bill)..."
                    }
                    className="text-sm resize-none focus-visible:ring-primary"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    This note will be displayed directly on the wholesaler&apos;s KYC portal.
                  </p>
                </div>

                <DialogFooter className="gap-2 sm:gap-0 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setReasonAction(null);
                      setReason("");
                    }}
                    disabled={actionLoading}
                    className="text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant={
                      reasonAction.type === "reject" ? "destructive" : "default"
                    }
                    disabled={actionLoading || !reason.trim()}
                    className={cn(
                      "text-xs font-semibold",
                      reasonAction.type !== "reject" && "bg-amber-600 hover:bg-amber-700 text-white"
                    )}
                  >
                    {actionLoading ? (
                      <span className="flex items-center gap-1.5">
                        <RefreshCw className="size-3.5 animate-spin" />
                        Saving...
                      </span>
                    ) : reasonAction.type === "reject" ? (
                      "Confirm Rejection"
                    ) : (
                      "Send Resubmit Request"
                    )}
                  </Button>
                </DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
