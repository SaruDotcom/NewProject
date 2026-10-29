import { useCallback, useEffect, useState } from "react";
import {
  Building2,
  Calendar,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
  Eye,
  Globe,
  Mail,
  MessageCircle,
  PauseCircle,
  PlayCircle,
  RefreshCw,
  Search,
  Share2,
  Sparkles,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader, StatusBadge } from "@/components/admin-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ConfirmationModal } from "@/components/ui/confirmation-modal";
import { api } from "@/lib/api";

const statusStyles = {
  SENT: "bg-sky-50 text-sky-700 border-sky-200",
  OPENED: "bg-amber-50 text-amber-700 border-amber-200",
  REGISTERED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  EXPIRED: "bg-gray-100 text-gray-600 border-gray-200",
  REVOKED: "bg-rose-50 text-rose-700 border-rose-200",
};

const wholesalerSiteUrl = (import.meta.env.VITE_WHOLESALER_SITE_URL || "").replace(/\/+$/, "");

export function WholesalerInvitesPage() {
  // 1. Permanent Admin Referral Link state
  const [linkData, setLinkData] = useState({
    code: "",
    isPaused: false,
    linkOpens: 0,
    registered: 0,
    today: 0,
    thisWeek: 0,
  });
  const [loadingLink, setLoadingLink] = useState(true);
  const [campaign, setCampaign] = useState("");
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedMsg, setCopiedMsg] = useState(false);
  const [confirmRegenOpen, setConfirmRegenOpen] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isTogglingPause, setIsTogglingPause] = useState(false);

  // 2. "Registered through this link" Table state
  const [regRows, setRegRows] = useState([]);
  const [regLoading, setRegLoading] = useState(false);
  const [regSearch, setRegSearch] = useState("");
  const [regKyc, setRegKyc] = useState("ALL");
  const [regDateFrom, setRegDateFrom] = useState("");
  const [regDateTo, setRegDateTo] = useState("");
  const [regPage, setRegPage] = useState(1);
  const [regPagination, setRegPagination] = useState({ total: 0, totalPages: 1, limit: 20 });

  // 3. Legacy Single-Use Invitations state (collapsed by default)
  const [showLegacy, setShowLegacy] = useState(false);
  const [legacyRows, setLegacyRows] = useState([]);
  const [legacyStats, setLegacyStats] = useState({});
  const [legacyLoading, setLegacyLoading] = useState(false);
  const [legacyStatus, setLegacyStatus] = useState("ALL");
  const [legacySearch, setLegacySearch] = useState("");
  const [legacyDateFrom, setLegacyDateFrom] = useState("");
  const [legacyDateTo, setLegacyDateTo] = useState("");
  const [legacyPage, setLegacyPage] = useState(1);
  const [legacyPagination, setLegacyPagination] = useState({ total: 0, totalPages: 1 });

  // Compute the current shareable link
  const computedLink = (() => {
    const base = wholesalerSiteUrl || (typeof window !== "undefined" ? window.location.origin : "");
    if (!linkData?.code) return "";
    let url = `${base}/register?ref=${encodeURIComponent(linkData.code)}`;
    if (campaign.trim()) {
      url += `&utm_source=admin&utm_campaign=${encodeURIComponent(campaign.trim().toLowerCase())}`;
    }
    return url;
  })();

  const shareMessage = computedLink
    ? `Register your wholesale business online: ${computedLink}`
    : "";

  // Load Admin Link info & stats
  const loadLinkData = useCallback(async () => {
    try {
      setLoadingLink(true);
      const res = await api.get("/admin/wholesaler-invites/link");
      if (res?.data) {
        setLinkData(res.data);
      }
    } catch (error) {
      toast.error(error.message || "Unable to load wholesaler registration link.");
    } finally {
      setLoadingLink(false);
    }
  }, []);

  // Load Registered Wholesalers list
  const loadRegisteredWholesalers = useCallback(async () => {
    try {
      setRegLoading(true);
      const params = new URLSearchParams({
        page: String(regPage),
        limit: "20",
      });
      if (regSearch.trim()) params.set("search", regSearch.trim());
      if (regKyc !== "ALL") params.set("kycStatus", regKyc);
      if (regDateFrom) params.set("dateFrom", regDateFrom);
      if (regDateTo) params.set("dateTo", regDateTo);

      const res = await api.get(`/admin/wholesaler-invites/link/wholesalers?${params.toString()}`);
      setRegRows(res.data?.items || []);
      setRegPagination(res.data?.pagination || { total: 0, totalPages: 1, limit: 20 });
    } catch (error) {
      toast.error(error.message || "Unable to load registered wholesalers list.");
    } finally {
      setRegLoading(false);
    }
  }, [regDateFrom, regDateTo, regKyc, regPage, regSearch]);

  // Load Legacy single-use invitations
  const loadLegacyInvites = useCallback(async () => {
    try {
      setLegacyLoading(true);
      const params = new URLSearchParams({ limit: "20", page: String(legacyPage) });
      if (legacyStatus !== "ALL") params.set("status", legacyStatus);
      if (legacySearch.trim()) params.set("search", legacySearch.trim());
      if (legacyDateFrom) params.set("dateFrom", legacyDateFrom);
      if (legacyDateTo) params.set("dateTo", legacyDateTo);
      const result = await api.get(`/admin/wholesaler-invites?${params.toString()}`);
      setLegacyRows(result.data?.items || []);
      setLegacyStats(result.data?.stats || {});
      setLegacyPagination(result.data?.pagination || { total: 0, totalPages: 1 });
    } catch (error) {
      toast.error(error.message || "Unable to load legacy invitations.");
    } finally {
      setLegacyLoading(false);
    }
  }, [legacyDateFrom, legacyDateTo, legacyPage, legacySearch, legacyStatus]);

  // Initial load
  useEffect(() => {
    void loadLinkData();
    void loadRegisteredWholesalers();
  }, [loadLinkData, loadRegisteredWholesalers]);

  // Load legacy only when expanded or params change
  useEffect(() => {
    if (showLegacy) {
      void loadLegacyInvites();
    }
  }, [showLegacy, loadLegacyInvites]);

  // Copy Link button handler
  const handleCopyLink = async () => {
    if (!computedLink) return;
    try {
      await navigator.clipboard.writeText(computedLink);
      setCopiedLink(true);
      toast.success("Registration link copied to clipboard!");
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      toast.error("Unable to copy to clipboard automatically. Please copy the URL from the text field.");
    }
  };

  // Copy Message button handler
  const handleCopyMessage = async () => {
    if (!shareMessage) return;
    try {
      await navigator.clipboard.writeText(shareMessage);
      setCopiedMsg(true);
      toast.success("Ready-to-share message copied to clipboard!");
      setTimeout(() => setCopiedMsg(false), 2500);
    } catch {
      toast.error("Unable to copy message. Please copy the link directly.");
    }
  };

  // Toggle Pause Link handler
  const handleTogglePause = async (checked) => {
    try {
      setIsTogglingPause(true);
      const res = await api.patch("/admin/wholesaler-invites/link/pause", { isPaused: checked });
      if (res?.data) {
        setLinkData(res.data);
      }
      toast.success(checked ? "Wholesaler registrations paused for this link." : "Wholesaler registrations resumed!");
    } catch (error) {
      toast.error(error.message || "Unable to update link pause status.");
    } finally {
      setIsTogglingPause(false);
    }
  };

  // Regenerate Link handler
  const handleConfirmRegenerate = async () => {
    try {
      setIsRegenerating(true);
      const res = await api.post("/admin/wholesaler-invites/link/regenerate", {});
      if (res?.data) {
        setLinkData(res.data);
      }
      setConfirmRegenOpen(false);
      toast.success("New permanent registration link generated. The old link is now deactivated.");
      void loadRegisteredWholesalers();
    } catch (error) {
      toast.error(error.message || "Unable to regenerate registration link.");
    } finally {
      setIsRegenerating(false);
    }
  };

  // Legacy actions: Regenerate & Revoke single-use invite
  const handleLegacyRegenerate = async (invite) => {
    try {
      await api.post(`/admin/wholesaler-invites/${invite.id}/regenerate`, {});
      await loadLegacyInvites();
      toast.success("Legacy invitation regenerated.");
    } catch (error) {
      toast.error(error.message || "Unable to regenerate legacy invitation.");
    }
  };

  const handleLegacyRevoke = async (invite) => {
    try {
      await api.post(`/admin/wholesaler-invites/${invite.id}/revoke`, {});
      await loadLegacyInvites();
      toast.success("Legacy invitation revoked.");
    } catch (error) {
      toast.error(error.message || "Unable to revoke legacy invitation.");
    }
  };

  // Clear filters
  const handleClearRegFilters = () => {
    setRegSearch("");
    setRegKyc("ALL");
    setRegDateFrom("");
    setRegDateTo("");
    setRegPage(1);
  };

  const handleClearLegacyFilters = () => {
    setLegacySearch("");
    setLegacyStatus("ALL");
    setLegacyDateFrom("");
    setLegacyDateTo("");
    setLegacyPage(1);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Wholesaler Invites"
        description="Share a permanent registration link with prospective wholesalers and track onboarding performance."
      />

      {/* 1. SHARE LINK CARD (Top of the page, replaces the old create form) */}
      <section className="relative overflow-hidden rounded-2xl border border-primary/20 bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Globe className="size-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold tracking-tight text-foreground">
                  Wholesaler registration link
                </h2>
                <p className="text-xs text-muted-foreground">
                  Permanent and reusable. No details needed from admin—copy and share anywhere.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {linkData.isPaused ? (
              <Badge variant="destructive" className="flex items-center gap-1.5 px-3 py-1 font-semibold text-xs">
                <PauseCircle className="size-3.5" />
                Registrations Paused
              </Badge>
            ) : (
              <Badge className="flex items-center gap-1.5 border-emerald-500/20 bg-emerald-500/10 px-3 py-1 font-semibold text-xs text-emerald-700 dark:text-emerald-400">
                <PlayCircle className="size-3.5" />
                Active Link
              </Badge>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmRegenOpen(true)}
              className="text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              <RefreshCw className="mr-1.5 size-3.5" />
              Generate new link
            </Button>
          </div>
        </div>

        {/* Read-only link box and Campaign name */}
        <div className="mt-5 grid gap-4 lg:grid-cols-12">
          {/* Link box */}
          <div className="space-y-1.5 lg:col-span-8">
            <label className="text-xs font-bold text-foreground">
              Registration URL
            </label>
            <div className="relative flex items-center">
              <Input
                readOnly
                value={computedLink || (loadingLink ? "Loading registration link..." : "")}
                onFocus={(e) => e.target.select()}
                className="h-11 bg-muted/30 font-mono text-xs pr-10 text-foreground selection:bg-primary/20"
                aria-label="Wholesaler registration link"
              />
              {computedLink && (
                <button
                  type="button"
                  onClick={handleCopyLink}
                  aria-label="Quick copy link"
                  className="absolute right-2.5 rounded-md p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                >
                  {copiedLink ? <Check className="size-4 text-emerald-600" /> : <Copy className="size-4" />}
                </button>
              )}
            </div>
          </div>

          {/* Optional Campaign name field */}
          <div className="space-y-1.5 lg:col-span-4">
            <label className="flex items-center justify-between text-xs font-bold text-foreground">
              <span>Campaign name <span className="font-normal text-muted-foreground">(optional)</span></span>
              {campaign && (
                <button
                  type="button"
                  onClick={() => setCampaign("")}
                  className="text-[11px] font-medium text-muted-foreground hover:text-foreground"
                >
                  Clear
                </button>
              )}
            </label>
            <Input
              value={campaign}
              maxLength={50}
              placeholder="e.g. diwali, expo2026, linkedin"
              onChange={(e) => setCampaign(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ""))}
              className="h-11 text-xs"
            />
          </div>
        </div>

        {/* Action Buttons Row */}
        <div className="mt-4 flex flex-wrap items-center gap-2.5">
          <Button
            onClick={handleCopyLink}
            disabled={!computedLink}
            className="h-10 font-semibold"
          >
            {copiedLink ? (
              <>
                <Check className="mr-2 size-4 text-emerald-300" />
                Copied link!
              </>
            ) : (
              <>
                <Copy className="mr-2 size-4" />
                Copy link
              </>
            )}
          </Button>

          <Button asChild variant="outline" className="h-10 border-[#25D366]/40 text-[#128C7E] hover:bg-[#25D366]/10 hover:text-[#075E54]">
            <a
              href={`https://wa.me/?text=${encodeURIComponent(shareMessage)}`}
              target="_blank"
              rel="noreferrer"
            >
              <MessageCircle className="mr-2 size-4 text-[#25D366]" />
              Share on WhatsApp
            </a>
          </Button>

          <Button asChild variant="outline" className="h-10">
            <a
              href={`mailto:?subject=${encodeURIComponent("Register your wholesale business online")}&body=${encodeURIComponent(shareMessage)}`}
            >
              <Mail className="mr-2 size-4 text-sky-600" />
              Share by Email
            </a>
          </Button>

          <Button
            variant="ghost"
            onClick={handleCopyMessage}
            disabled={!shareMessage}
            className="h-10 text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            {copiedMsg ? (
              <>
                <Check className="mr-1.5 size-4 text-emerald-600" />
                Message copied
              </>
            ) : (
              <>
                <Share2 className="mr-1.5 size-4" />
                Copy message
              </>
            )}
          </Button>

          {/* Pause switch on right */}
          <div className="ml-auto flex items-center gap-2.5 rounded-xl border bg-muted/20 px-3 py-2 text-xs">
            <Switch
              id="pause-registrations-switch"
              checked={linkData.isPaused}
              disabled={isTogglingPause}
              onCheckedChange={handleTogglePause}
            />
            <label
              htmlFor="pause-registrations-switch"
              className="cursor-pointer font-semibold text-foreground select-none"
            >
              Pause registrations from this link
            </label>
          </div>
        </div>
      </section>

      {/* 2. TRACKING STAT CARDS */}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Link opens",
            value: linkData.linkOpens || 0,
            subtitle: "Unique visitors (1/visitor/day)",
            icon: Eye,
            color: "text-sky-600",
            bg: "bg-sky-50 dark:bg-sky-950/40",
          },
          {
            label: "Registered",
            value: linkData.registered || 0,
            subtitle: "Wholesalers via admin link",
            icon: Users,
            color: "text-emerald-600",
            bg: "bg-emerald-50 dark:bg-emerald-950/40",
          },
          {
            label: "Today",
            value: linkData.today || 0,
            subtitle: "New signups today",
            icon: TrendingUp,
            color: "text-amber-600",
            bg: "bg-amber-50 dark:bg-amber-950/40",
          },
          {
            label: "This week",
            value: linkData.thisWeek || 0,
            subtitle: "Signups since Monday",
            icon: Calendar,
            color: "text-indigo-600",
            bg: "bg-indigo-50 dark:bg-indigo-950/40",
          },
        ].map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="rounded-xl border bg-card p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {card.label}
                </p>
                <div className={`flex size-8 items-center justify-center rounded-lg ${card.bg}`}>
                  <Icon className={`size-4 ${card.color}`} />
                </div>
              </div>
              <p className={`mt-3 text-3xl font-bold tracking-tight ${card.color}`}>
                {card.value}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">{card.subtitle}</p>
            </div>
          );
        })}
      </section>

      {/* 3. "REGISTERED THROUGH THIS LINK" TABLE */}
      <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="border-b p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Building2 className="size-5 text-primary" />
                <h2 className="font-bold text-base text-foreground">
                  Registered through this link
                </h2>
                <Badge variant="secondary" className="text-xs font-bold">
                  {regPagination.total}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Wholesalers registered through the admin invite link.
              </p>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => void loadRegisteredWholesalers()}
              disabled={regLoading}
              className="self-start sm:self-auto text-xs"
            >
              <RefreshCw className={`mr-1.5 size-3.5 ${regLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>

          {/* Clean Filter Row */}
          <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                className="h-9 pl-9 text-xs"
                placeholder="Search registered wholesalers..."
                value={regSearch}
                onChange={(e) => {
                  setRegPage(1);
                  setRegSearch(e.target.value);
                }}
              />
            </div>

            <div>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={regKyc}
                onChange={(e) => {
                  setRegPage(1);
                  setRegKyc(e.target.value);
                }}
                aria-label="Filter KYC status"
              >
                <option value="ALL">All KYC</option>
                <option value="DRAFT">DRAFT</option>
                <option value="SUBMITTED">SUBMITTED</option>
                <option value="IN_REVIEW">IN_REVIEW</option>
                <option value="APPROVED">APPROVED</option>
                <option value="REJECTED">REJECTED</option>
              </select>
            </div>

            <div>
              <Input
                type="date"
                className="h-9 text-xs"
                aria-label="Registered date from"
                value={regDateFrom}
                onChange={(e) => {
                  setRegPage(1);
                  setRegDateFrom(e.target.value);
                }}
              />
            </div>

            <div>
              <Input
                type="date"
                className="h-9 text-xs"
                aria-label="Registered date to"
                value={regDateTo}
                onChange={(e) => {
                  setRegPage(1);
                  setRegDateTo(e.target.value);
                }}
              />
            </div>

            <div>
              <Button
                variant="outline"
                className="h-9 w-full text-xs"
                onClick={handleClearRegFilters}
              >
                Clear filters
              </Button>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-semibold">Business name</th>
                <th className="px-4 py-3 font-semibold">Contact</th>
                <th className="px-4 py-3 font-semibold">Mobile</th>
                <th className="px-4 py-3 font-semibold">City</th>
                <th className="px-4 py-3 font-semibold">Campaign</th>
                <th className="px-4 py-3 font-semibold">Registered date</th>
                <th className="px-4 py-3 font-semibold">KYC status</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {regRows.map((wholesaler) => (
                <tr key={wholesaler.id} className="transition-colors hover:bg-muted/20">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-foreground">{wholesaler.businessName}</div>
                    <div className="text-xs text-muted-foreground">{wholesaler.email}</div>
                  </td>
                  <td className="px-4 py-3 font-medium text-foreground">{wholesaler.contactName}</td>
                  <td className="px-4 py-3 font-mono text-xs text-foreground">{wholesaler.phone}</td>
                  <td className="px-4 py-3 text-muted-foreground">{wholesaler.city}</td>
                  <td className="px-4 py-3">
                    {wholesaler.campaign && wholesaler.campaign !== "—" ? (
                      <span className="inline-flex items-center rounded-md border bg-primary/5 px-2 py-0.5 text-xs font-semibold text-primary">
                        {wholesaler.campaign}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {wholesaler.registeredDate
                      ? new Date(wholesaler.registeredDate).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={wholesaler.kycStatus} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button asChild variant="outline" size="sm" className="h-8 text-xs font-semibold">
                      <a href={`/wholesalers/${wholesaler.userId || wholesaler.id}`}>
                        View profile <ExternalLink className="ml-1 size-3" />
                      </a>
                    </Button>
                  </td>
                </tr>
              ))}
              {!regRows.length && (
                <tr>
                  <td colSpan="8" className="px-4 py-12 text-center text-sm text-muted-foreground">
                    {regLoading ? "Loading registered wholesalers..." : "No wholesalers have registered through this link yet."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between border-t px-4 py-3 text-xs text-muted-foreground">
          <span>
            {regPagination.total} wholesaler{regPagination.total === 1 ? "" : "s"} registered
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={regPage <= 1 || regLoading}
              onClick={() => setRegPage((curr) => Math.max(1, curr - 1))}
            >
              Previous
            </Button>
            <span>
              Page {regPage} of {regPagination.totalPages || 1}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={regPage >= (regPagination.totalPages || 1) || regLoading}
              onClick={() => setRegPage((curr) => curr + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </section>

      {/* 4. LEGACY INVITATION HISTORY (Collapsed Section as required) */}
      <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <button
          type="button"
          onClick={() => setShowLegacy((prev) => !prev)}
          className="flex w-full items-center justify-between p-4 text-left font-semibold transition hover:bg-muted/30 focus-visible:outline-none"
        >
          <div className="flex items-center gap-2.5">
            <h3 className="text-sm font-semibold text-foreground">
              Legacy single-use invitation history
            </h3>
            {legacyStats.total !== undefined && (
              <Badge variant="outline" className="text-xs font-medium">
                {legacyPagination.total || 0}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <span>{showLegacy ? "Hide history" : "Show past single-use invites"}</span>
            {showLegacy ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </div>
        </button>

        {showLegacy && (
          <div className="border-t">
            {/* Fixed Filter Row: one clean aligned row with matching input heights and labels */}
            <div className="p-4 bg-muted/10 border-b">
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-6">
                <div className="lg:col-span-2">
                  <Input
                    className="h-10 text-xs"
                    placeholder="Search business, contact, email..."
                    value={legacySearch}
                    onChange={(event) => {
                      setLegacyPage(1);
                      setLegacySearch(event.target.value);
                    }}
                  />
                </div>
                <div>
                  <Input
                    type="date"
                    className="h-10 text-xs"
                    aria-label="Created from"
                    value={legacyDateFrom}
                    onChange={(event) => {
                      setLegacyPage(1);
                      setLegacyDateFrom(event.target.value);
                    }}
                  />
                </div>
                <div>
                  <Input
                    type="date"
                    className="h-10 text-xs"
                    aria-label="Created through"
                    value={legacyDateTo}
                    onChange={(event) => {
                      setLegacyPage(1);
                      setLegacyDateTo(event.target.value);
                    }}
                  />
                </div>
                <div>
                  <select
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={legacyStatus}
                    onChange={(event) => {
                      setLegacyPage(1);
                      setLegacyStatus(event.target.value);
                    }}
                    aria-label="Filter invitation status"
                  >
                    {["ALL", "SENT", "OPENED", "REGISTERED", "EXPIRED", "REVOKED"].map((val) => (
                      <option key={val} value={val}>
                        {val === "ALL" ? "All statuses" : val}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="h-10 flex-1 text-xs"
                    onClick={handleClearLegacyFilters}
                  >
                    Clear
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 shrink-0"
                    onClick={() => void loadLegacyInvites()}
                    aria-label="Refresh legacy invitations"
                  >
                    <RefreshCw className={`size-4 ${legacyLoading ? "animate-spin" : ""}`} />
                  </Button>
                </div>
              </div>
            </div>

            {/* Legacy Table */}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] text-left text-sm">
                <thead className="bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    {["Business / contact", "Email", "Phone", "Status", "Created", "Expires", "Actions"].map(
                      (label) => (
                        <th key={label} className="px-4 py-3 font-semibold">
                          {label}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {legacyRows.map((invite) => (
                    <tr key={invite.id} className="transition-colors hover:bg-muted/20">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-foreground">{invite.businessName}</div>
                        <div className="text-xs text-muted-foreground">{invite.contactName}</div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{invite.email}</td>
                      <td className="px-4 py-3 font-mono text-xs">{invite.phone}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                            statusStyles[invite.status] || ""
                          }`}
                        >
                          {invite.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {new Date(invite.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {new Date(invite.expiresAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1.5">
                          {invite.status === "SENT" || invite.status === "OPENED" ? (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 text-xs font-semibold"
                                onClick={() => void handleLegacyRegenerate(invite)}
                                title="Regenerate single-use invitation"
                              >
                                <RefreshCw className="mr-1 size-3" />
                                Regenerate
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                onClick={() => void handleLegacyRevoke(invite)}
                                aria-label={`Revoke invitation for ${invite.businessName}`}
                              >
                                <X className="size-4" />
                              </Button>
                            </>
                          ) : invite.wholesalerId ? (
                            <Button asChild variant="outline" size="sm" className="h-8 text-xs font-semibold">
                              <a href={`/wholesalers/${invite.wholesalerId}`}>
                                Profile <ExternalLink className="ml-1 size-3" />
                              </a>
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!legacyRows.length && (
                    <tr>
                      <td colSpan="7" className="px-4 py-12 text-center text-sm text-muted-foreground">
                        {legacyLoading ? "Loading legacy invitations..." : "No legacy invitations found."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Legacy Pagination */}
            <div className="flex items-center justify-between border-t px-4 py-3 text-xs text-muted-foreground">
              <span>
                {legacyPagination.total} invitation{legacyPagination.total === 1 ? "" : "s"}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={legacyPage <= 1 || legacyLoading}
                  onClick={() => setLegacyPage((current) => current - 1)}
                >
                  Previous
                </Button>
                <span>
                  Page {legacyPage} of {legacyPagination.totalPages || 1}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={legacyPage >= (legacyPagination.totalPages || 1) || legacyLoading}
                  onClick={() => setLegacyPage((current) => current + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Confirmation Modal for Regenerating Link */}
      <ConfirmationModal
        open={confirmRegenOpen}
        title="Generate new registration link?"
        description="The old link will stop working immediately. Any prospective wholesaler who has not yet registered using the old link will need this new link."
        confirmLabel={isRegenerating ? "Generating..." : "Yes, generate new link"}
        cancelLabel="Cancel"
        variant="destructive"
        onConfirm={handleConfirmRegenerate}
        onCancel={() => setConfirmRegenOpen(false)}
      />
    </div>
  );
}
