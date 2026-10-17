import { useEffect, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Download,
  MoreHorizontal,
  RefreshCw,
  Search,
  Star,
  User,
  Store,
  Building2,
  MessageSquare,
  CheckCircle,
  Clock,
  EyeOff,
} from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce";
import { Button } from "@/components/ui/button";
import { ConfirmationModal } from "@/components/ui/confirmation-modal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { KpiCard, PageHeader, StatusBadge } from "@/components/admin-ui";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiDelete, apiGet, apiPatch } from "@/lib/api";
import { toast } from "sonner";

const labels = { approved: "Approved", pending: "Pending", hidden: "Hidden" };
const initial = {
  items: [],
  pagination: { page: 1, limit: 10, total: 0, totalPages: 1 },
  summary: {},
};

export function ReviewsManagementPage() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 350);
  const [status, setStatus] = useState("all");
  const [rating, setRating] = useState("all");
  const [userRole, setUserRole] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [sortOrder, setSortOrder] = useState("desc");
  const [result, setResult] = useState(initial);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [confirmation, setConfirmation] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, status, rating, userRole, dateFrom, dateTo]);

  useEffect(() => {
    let mounted = true;
    const params = new URLSearchParams({
      page: String(page),
      limit: "10",
      sortBy: "createdAt",
      sortOrder,
    });

    if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
    if (status !== "all") params.set("status", status);
    if (rating !== "all") params.set("rating", rating);
    if (userRole !== "all") params.set("userRole", userRole);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);

    setLoading(true);
    setError(null);

    apiGet(`/admin/reviews?${params.toString()}`)
      .then((payload) => {
        if (mounted) setResult(payload || initial);
      })
      .catch((err) => {
        if (mounted) setError(err.message || "Failed to load reviews");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [debouncedSearch, status, rating, userRole, dateFrom, dateTo, page, sortOrder, refreshKey]);

  const refresh = () => setRefreshKey((value) => value + 1);
  const pages = Math.max(1, result.pagination.totalPages || 1);

  const runAction = async () => {
    setSaving(true);
    try {
      if (confirmation.kind === "delete") {
        await apiDelete(`/admin/reviews/${confirmation.id}`);
      } else {
        await apiPatch(`/admin/reviews/${confirmation.id}/status`, { status: confirmation.status });
      }
      toast.success(confirmation.kind === "delete" ? "Review deleted" : "Review status updated");
      setConfirmation(null);
      refresh();
    } catch (err) {
      toast.error(err.message || "Review action failed");
    } finally {
      setSaving(false);
    }
  };

  const exportCsv = () => {
    const esc = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const csv = [
      ["Reviewer Name", "Role", "Email", "Subject/Product", "Rating", "Review", "Status", "Date"],
      ...result.items.map((row) => [
        row.reviewer?.name || row.retailer?.name || "User",
        row.userRole || row.reviewer?.role || "RETAILER",
        row.reviewer?.email || "",
        row.product?.name || row.title || "Feedback",
        row.rating,
        row.comment,
        row.status,
        row.createdAt,
      ]),
    ]
      .map((row) => row.map(esc).join(","))
      .join("\r\n");

    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "reviews.csv";
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Reviews exported");
  };

  const renderRoleBadge = (role) => {
    const isWholesaler = role?.toUpperCase() === "WHOLESALER";
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
          isWholesaler
            ? "bg-tradeflow-navy text-white dark:bg-tradeflow-navy-hover"
            : "bg-tradeflow-sky-50 text-tradeflow-navy dark:bg-tradeflow-navy-hover dark:text-tradeflow-sky"
        }`}
      >
        {isWholesaler ? <Building2 className="size-3" /> : <Store className="size-3" />}
        {isWholesaler ? "Wholesaler" : "Retailer"}
      </span>
    );
  };

  const renderStars = (ratingCount) => {
    const count = Number(ratingCount) || 5;
    return (
      <div className="flex items-center gap-0.5 text-amber-500">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`size-3.5 ${star <= count ? "fill-amber-400 text-amber-400" : "text-gray-300 dark:text-gray-600"}`}
          />
        ))}
        <span className="ml-1 text-xs font-bold text-foreground">{count}/5</span>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Review & Feedback Moderation"
        description="Monitor, approve, hide, or remove feedback submitted by Retailers and Wholesalers."
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportCsv}>
              <Download className="mr-1.5 size-4" /> Export CSV
            </Button>
            <Button variant="outline" onClick={refresh}>
              <RefreshCw className="mr-1.5 size-4" /> Refresh
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="Total Reviews"
          value={String(Object.values(result.summary || {}).reduce((sum, row) => sum + (row?.count || 0), 0))}
          icon={MessageSquare}
        />
        <KpiCard label="Approved" value={String(result.summary?.approved?.count || 0)} icon={CheckCircle} tone="success" />
        <KpiCard label="Pending" value={String(result.summary?.pending?.count || 0)} icon={Clock} tone="warning" />
        <KpiCard label="Hidden" value={String(result.summary?.hidden?.count || 0)} icon={EyeOff} />
      </div>

      <section className="admin-card overflow-hidden">
        <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search feedback text, title, or reviewer..."
              className="pl-9"
            />
          </div>

          {/* User Role Filter */}
          <Select
            value={userRole}
            onValueChange={(value) => {
              setUserRole(value);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-full lg:w-40">
              <SelectValue placeholder="All Roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="RETAILER">Retailers Only</SelectItem>
              <SelectItem value="WHOLESALER">Wholesalers Only</SelectItem>
            </SelectContent>
          </Select>

          {/* Status Filter */}
          <Select
            value={status}
            onValueChange={(value) => {
              setStatus(value);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-full lg:w-36">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {Object.entries(labels).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Rating Filter */}
          <Select
            value={rating}
            onValueChange={(value) => {
              setRating(value);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-full lg:w-32">
              <SelectValue placeholder="Rating" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All ratings</SelectItem>
              {[5, 4, 3, 2, 1].map((value) => (
                <SelectItem key={value} value={String(value)}>
                  {value} Stars
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} aria-label="Review from" />
          <Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} aria-label="Review to" />
        </div>

        {loading ? (
          <div className="p-8 text-sm text-muted-foreground text-center">Loading reviews...</div>
        ) : error ? (
          <div className="p-8 text-sm text-destructive text-center">{error}</div>
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-[1100px]">
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>Reviewer</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Subject / Product</TableHead>
                  <TableHead>Rating</TableHead>
                  <TableHead>Review Comment</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground text-sm">
                      No feedback or reviews found.
                    </TableCell>
                  </TableRow>
                ) : (
                  result.items.map((row) => (
                    <TableRow key={String(row._id)}>
                      {/* Reviewer Name */}
                      <TableCell className="font-medium">
                        <div className="flex flex-col">
                          <span className="font-bold text-foreground">
                            {row.reviewer?.name || row.retailer?.businessName || row.retailer?.name || "Anonymous"}
                          </span>
                          {row.reviewer?.email && (
                            <span className="text-[11px] text-muted-foreground">{row.reviewer.email}</span>
                          )}
                        </div>
                      </TableCell>

                      {/* User Role */}
                      <TableCell>{renderRoleBadge(row.userRole || row.retailer?.role)}</TableCell>

                      {/* Subject / Product */}
                      <TableCell className="font-semibold text-foreground">
                        {row.product?.name || row.title || "General Feedback"}
                      </TableCell>

                      {/* Rating */}
                      <TableCell>{renderStars(row.rating)}</TableCell>

                      {/* Review Comment */}
                      <TableCell className="max-w-72 truncate text-sm text-muted-foreground" title={row.comment}>
                        {row.comment || "—"}
                      </TableCell>

                      {/* Status Badge */}
                      <TableCell>
                        <StatusBadge status={labels[row.status] || row.status} />
                      </TableCell>

                      {/* Date */}
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {row.createdAt ? new Date(row.createdAt).toLocaleDateString("en-IN") : "—"}
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" aria-label="Review actions">
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={() => setConfirmation({ id: row._id, status: "approved" })}>
                              Approve
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => setConfirmation({ id: row._id, status: "hidden" })}>
                              Hide
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => setConfirmation({ id: row._id, status: "pending" })}>
                              Mark pending
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive font-semibold"
                              onSelect={() => setConfirmation({ id: row._id, kind: "delete" })}
                            >
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}

        <div className="flex items-center justify-between border-t px-4 py-3 text-xs text-muted-foreground">
          <span>
            Showing {result.items?.length ? (page - 1) * 10 + 1 : 0}-
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
        title={confirmation?.kind === "delete" ? "Delete review?" : "Update review status?"}
        description="This moderation action will be saved immediately."
        confirmLabel={confirmation?.kind === "delete" ? "Delete" : "Confirm"}
        variant={confirmation?.kind === "delete" ? "destructive" : "default"}
        onCancel={() => !saving && setConfirmation(null)}
        onConfirm={runAction}
      />
    </div>
  );
}
