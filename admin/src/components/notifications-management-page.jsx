import { useEffect, useState } from "react";
import { Bell, Check, ChevronLeft, ChevronRight, Headphones, MoreHorizontal, RefreshCw, Search, Trash2, ShoppingBag, CreditCard, ShieldCheck, Wallet } from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce";
import { Button } from "@/components/ui/button";
import { ConfirmationModal } from "@/components/ui/confirmation-modal";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader, StatusBadge } from "@/components/admin-ui";
import { apiDelete, apiGet, apiPatch } from "@/lib/api";
import { toast } from "sonner";

const initial = { items: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 1 }, filters: { modules: [] } };

export function NotificationsManagementPage() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 350);
  const [unread, setUnread] = useState("all");
  const [module, setModule] = useState("all");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState(initial);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [confirmation, setConfirmation] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => setPage(1), [debouncedSearch, unread, module]);

  useEffect(() => {
    let mounted = true;
    const params = new URLSearchParams({
      page: String(page),
      limit: "10",
      sortBy: "createdAt",
      sortOrder: "desc",
    });
    if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
    if (unread !== "all") params.set("unread", unread);
    if (module !== "all") params.set("module", module);

    setLoading(true);
    setError(null);
    apiGet(`/admin/notifications?${params.toString()}`)
      .then((payload) =>
        mounted &&
        setResult({
          items: payload?.items || [],
          pagination: payload?.pagination || initial.pagination,
          filters: payload?.filters || initial.filters,
        })
      )
      .catch((err) => mounted && setError(err.message || "Failed to load notifications"))
      .finally(() => mounted && setLoading(false));

    return () => {
      mounted = false;
    };
  }, [debouncedSearch, unread, module, page, refreshKey]);

  const refresh = () => setRefreshKey((value) => value + 1);
  const pages = Math.max(1, result.pagination.totalPages || 1);

  const markAll = async () => {
    setSaving(true);
    try {
      await apiPatch("/admin/notifications/read-all", {});
      toast.success("All notifications marked as read");
      refresh();
    } catch (err) {
      toast.error(err.message || "Unable to mark notifications as read");
    } finally {
      setSaving(false);
    }
  };

  const runDelete = async () => {
    setSaving(true);
    try {
      await apiDelete(`/admin/notifications/${confirmation.id}`);
      toast.success("Notification deleted");
      setConfirmation(null);
      refresh();
    } catch (err) {
      toast.error(err.message || "Unable to delete notification");
    } finally {
      setSaving(false);
    }
  };

  const markRead = async (id) => {
    try {
      await apiPatch(`/admin/notifications/${id}/read`, {});
      toast.success("Notification marked as read");
      refresh();
    } catch (err) {
      toast.error(err.message || "Unable to update notification");
    }
  };

  const getNotificationIcon = (mod, title) => {
    const t = (title || "").toLowerCase();
    if (mod === "Help Request" || t.includes("help") || t.includes("issue")) {
      return <Headphones className="size-4 text-status-info" />;
    }
    if (mod === "Order" || t.includes("order")) {
      return <ShoppingBag className="size-4 text-status-info" />;
    }
    if (mod === "Payment" || t.includes("payment")) {
      return <CreditCard className="size-4 text-emerald-600" />;
    }
    if (mod === "KYC" || t.includes("kyc")) {
      return <ShieldCheck className="size-4 text-amber-600" />;
    }
    if (mod === "Payout" || t.includes("payout")) {
      return <Wallet className="size-4 text-status-info" />;
    }
    return <Bell className="size-4 text-primary" />;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title=" Notifications "
        description="Live updates on Wholesaler help requests, orders, payments, KYC submissions, and payout requests."
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={refresh}>
              <RefreshCw className="mr-1.5 size-4" /> Refresh
            </Button>
            <Button variant="outline" onClick={markAll} disabled={saving}>
              <Check className="mr-1.5 size-4" /> Mark all read
            </Button>
          </div>
        }
      />

      <section className="admin-card overflow-hidden">
        <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search notifications by title, wholesaler, or message..."
              className="pl-9"
            />
          </div>
          <Select
            value={unread}
            onValueChange={(value) => {
              setUnread(value);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-full lg:w-36">
              <SelectValue placeholder="Read state" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All notifications</SelectItem>
              <SelectItem value="true">Unread</SelectItem>
              <SelectItem value="false">Read</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={module}
            onValueChange={(value) => {
              setModule(value);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-full lg:w-44">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {(result.filters.modules || []).map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="p-8 text-sm text-muted-foreground">Loading notifications...</div>
        ) : error ? (
          <div className="p-8 text-sm text-destructive">{error}</div>
        ) : result.items.length === 0 ? (
          <div className="p-8 text-sm text-muted-foreground">No notifications found.</div>
        ) : (
          <div className="divide-y">
            {result.items.map((item) => {
              const wholesaler = item.wholesalerName || item.data?.wholesalerName;
              const phone = item.phone || item.data?.phone;
              const isHelp = item.module === "Help Request" || (item.title || "").toLowerCase().includes("help");

              return (
                <div
                  key={String(item._id || item.id)}
                  className={`flex items-start gap-3 p-4 transition-colors ${
                    item.unread ? "bg-accent/20" : "opacity-75 hover:opacity-100"
                  }`}
                >
                  <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
                    {getNotificationIcon(item.module, item.title)}
                  </span>

                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-foreground">{item.title}</p>
                      {item.unread && <span className="size-2 rounded-full bg-primary" />}
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-extrabold uppercase bg-secondary text-secondary-foreground">
                        {item.module || "SYSTEM"}
                      </span>
                    </div>

                    {wholesaler && (
                      <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-bold bg-status-info-50 text-status-info-foreground border border-status-info/30">
                        <span>Wholesaler:</span>
                        <span className="underline">{wholesaler}</span>
                        {phone && <span className="font-mono font-normal">({phone})</span>}
                      </div>
                    )}

                    <p className="text-xs text-muted-foreground leading-relaxed">{item.message}</p>

                    <div className="flex items-center gap-3 pt-1 text-[11px] text-muted-foreground">
                      <span>{item.createdAt ? new Date(item.createdAt).toLocaleString("en-IN") : "—"}</span>
                      {isHelp && (
                        <span className="font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded">
                          Priority Support Desk Message
                        </span>
                      )}
                    </div>
                  </div>

                  <StatusBadge status={item.module || "System"} />

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" aria-label="Notification actions">
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {item.unread && (
                        <DropdownMenuItem onSelect={() => markRead(item._id || item.id)}>
                          <Check className="mr-2 size-4" /> Mark read
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        className="text-destructive"
                        onSelect={() => setConfirmation({ id: item._id || item.id })}
                      >
                        <Trash2 className="mr-2 size-4" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex items-center justify-between border-t px-4 py-3 text-xs text-muted-foreground">
          <span>
            Showing {result.items.length ? (page - 1) * 10 + 1 : 0}-
            {Math.min(page * 10, result.pagination.total)} of {result.pagination.total}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              disabled={page === 1 || loading}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              aria-label="Previous page"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span>
              Page {page} of {pages}
            </span>
            <Button
              variant="outline"
              size="icon"
              disabled={page >= pages || loading}
              onClick={() => setPage((value) => Math.min(pages, value + 1))}
              aria-label="Next page"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      </section>

      <ConfirmationModal
        open={Boolean(confirmation)}
        title="Delete notification?"
        description="This notification will be removed permanently."
        confirmLabel="Delete"
        variant="destructive"
        onCancel={() => !saving && setConfirmation(null)}
        onConfirm={runDelete}
      />
    </div>
  );
}
