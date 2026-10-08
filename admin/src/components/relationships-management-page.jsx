import { useEffect, useState } from "react";
import {
    ArrowDown,
    ArrowUp,
    Building2,
    ChevronLeft,
    ChevronRight,
    Download,
    IndianRupee,
    Link2,
    MoreHorizontal,
    Plus,
    RefreshCw,
    Search,
    Store,
    Users,
} from "lucide-react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useDebounce } from "@/hooks/use-debounce";
import { Button } from "@/components/ui/button";
import { ConfirmationModal } from "@/components/ui/confirmation-modal";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { KpiCard, PageHeader, StatusBadge } from "@/components/admin-ui";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api";
import { toast } from "sonner";

const statusLabels = { pending: "Pending", approved: "Connected", blocked: "Suspended" };
const initial = {
    items: [],
    metrics: {
        totalConnections: 0,
        activeConnections: 0,
        wholesalersConnected: 0,
        retailersConnected: 0,
        totalTradeValue: 0,
    },
    pagination: { page: 1, limit: 10, total: 0, totalPages: 1 },
    filters: { wholesalers: [], retailers: [] },
};

export function RelationshipsManagementPage() {
    const navigate = useNavigate();
    const [search, setSearch] = useState("");
    const debouncedSearch = useDebounce(search, 350);
    const [status, setStatus] = useState("all");
    const [wholesaler, setWholesaler] = useState("all");
    const [retailer, setRetailer] = useState("all");
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");
    const [sortBy, setSortBy] = useState("createdAt");
    const [sortOrder, setSortOrder] = useState("desc");
    const [page, setPage] = useState(1);
    const [result, setResult] = useState(initial);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [refreshKey, setRefreshKey] = useState(0);
    const [formOpen, setFormOpen] = useState(false);
    const [form, setForm] = useState({ wholesaler: "", retailer: "" });
    const [viewing, setViewing] = useState(null);
    const [confirmation, setConfirmation] = useState(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => setPage(1), [debouncedSearch, status, wholesaler, retailer, dateFrom, dateTo]);
    useEffect(() => {
        let mounted = true;
        const params = new URLSearchParams({ page: String(page), limit: "10", sortBy, sortOrder });
        if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
        if (status !== "all") params.set("status", status);
        if (wholesaler !== "all") params.set("wholesaler", wholesaler);
        if (retailer !== "all") params.set("retailer", retailer);
        if (dateFrom) params.set("dateFrom", dateFrom);
        if (dateTo) params.set("dateTo", dateTo);

        setLoading(true);
        setError(null);
        apiGet(`/admin/relationships?${params.toString()}`)
            .then((payload) => {
                if (mounted) {
                    setResult({
                        items: payload?.items || [],
                        metrics: payload?.metrics || initial.metrics,
                        pagination: payload?.pagination || initial.pagination,
                        filters: payload?.filters || initial.filters,
                    });
                }
            })
            .catch((err) => mounted && setError(err.message || "Failed to load relationships"))
            .finally(() => mounted && setLoading(false));

        return () => {
            mounted = false;
        };
    }, [debouncedSearch, status, wholesaler, retailer, dateFrom, dateTo, sortBy, sortOrder, page, refreshKey]);

    const refresh = () => setRefreshKey((value) => value + 1);
    const toggleSort = (key) => {
        if (sortBy === key) setSortOrder((value) => (value === "asc" ? "desc" : "asc"));
        else {
            setSortBy(key);
            setSortOrder("asc");
        }
        setPage(1);
    };

    const save = async () => {
        if (!form.wholesaler || !form.retailer) {
            toast.error("Select both a wholesaler and retailer");
            return;
        }
        setSaving(true);
        try {
            await apiPost("/admin/relationships", form);
            toast.success("Relationship connected successfully");
            setFormOpen(false);
            setForm({ wholesaler: "", retailer: "" });
            refresh();
        } catch (err) {
            toast.error(err.message || "Unable to connect relationship");
        } finally {
            setSaving(false);
        }
    };

    const runAction = async () => {
        if (!confirmation) return;
        setSaving(true);
        try {
            if (confirmation.kind === "delete") await apiDelete(`/admin/relationships/${confirmation.row.id}`);
            else await apiPatch(`/admin/relationships/${confirmation.row.id}/status`, { status: confirmation.status });
            toast.success(confirmation.kind === "delete" ? "Relationship removed successfully" : "Relationship status updated successfully");
            setConfirmation(null);
            refresh();
        } catch (err) {
            toast.error(err.message || "Relationship action failed");
        } finally {
            setSaving(false);
        }
    };

    const exportCsv = () => {
        const escape = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
        const csv = [
            ["Wholesaler", "Retailer", "Location", "Orders", "Value", "Status", "Since"],
            ...result.items.map((row) => [
                row.wholesaler?.name,
                row.retailer?.name,
                row.location,
                row.orders,
                row.value,
                row.status,
                row.createdAt,
            ]),
        ]
            .map((row) => row.map(escape).join(","))
            .join("\r\n");
        const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
        const link = document.createElement("a");
        link.href = url;
        link.download = "relationships.csv";
        link.click();
        URL.revokeObjectURL(url);
        toast.success("Relationships exported");
    };

    const filters = result.filters || initial.filters;
    const metrics = result.metrics || initial.metrics;
    const pages = Math.max(1, result.pagination.totalPages || 1);
    const money = (value) => `₹${Number(value || 0).toLocaleString("en-IN")}`;
    const selectable = (items) => items || [];

    return (
        <div className="space-y-6">
            <PageHeader
                title="Wholesaler-Retailer Network"
                description="Understand and manage every commercial connection on the platform."
                action={
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={exportCsv}>
                            <Download /> Export
                        </Button>
                        <Button variant="outline" onClick={refresh}>
                            <RefreshCw /> Refresh
                        </Button>
                        <Button onClick={() => setFormOpen(true)}>
                            <Plus /> Add Connection
                        </Button>
                    </div>
                }
            />

            {/* KPI Metric Summary Cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <KpiCard
                    label="Connected Wholesalers"
                    value={(metrics.wholesalersConnected || 0).toLocaleString("en-IN")}
                    icon={Building2}
                    tone="primary"
                />
                <KpiCard
                    label="Connected Retailers"
                    value={(metrics.retailersConnected || 0).toLocaleString("en-IN")}
                    icon={Store}
                    tone="success"
                />
                <KpiCard
                    label="Active Connections"
                    value={(metrics.activeConnections || 0).toLocaleString("en-IN")}
                    icon={Link2}
                    tone="warning"
                />
                <KpiCard
                    label="Network Trade Value"
                    value={money(metrics.totalTradeValue || 0)}
                    icon={IndianRupee}
                    tone="primary"
                />
            </div>

            <section className="admin-card overflow-hidden">
                <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center lg:flex-wrap">
                    <div className="relative min-w-56 flex-1">
                        <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                        <Input
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Search wholesaler, retailer, or location..."
                            className="pl-9"
                        />
                    </div>
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
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="approved">Connected</SelectItem>
                            <SelectItem value="blocked">Suspended</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select
                        value={wholesaler}
                        onValueChange={(value) => {
                            setWholesaler(value);
                            setPage(1);
                        }}
                    >
                        <SelectTrigger className="w-full lg:w-44">
                            <SelectValue placeholder="Wholesaler" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All wholesalers</SelectItem>
                            {selectable(filters.wholesalers).map((user) => (
                                <SelectItem key={user.id} value={String(user.id)}>
                                    {user.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select
                        value={retailer}
                        onValueChange={(value) => {
                            setRetailer(value);
                            setPage(1);
                        }}
                    >
                        <SelectTrigger className="w-full lg:w-44">
                            <SelectValue placeholder="Retailer" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All retailers</SelectItem>
                            {selectable(filters.retailers).map((user) => (
                                <SelectItem key={user.id} value={String(user.id)}>
                                    {user.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Input
                        type="date"
                        value={dateFrom}
                        onChange={(event) => {
                            setDateFrom(event.target.value);
                            setPage(1);
                        }}
                        aria-label="Connected from"
                    />
                    <Input
                        type="date"
                        value={dateTo}
                        onChange={(event) => {
                            setDateTo(event.target.value);
                            setPage(1);
                        }}
                        aria-label="Connected to"
                    />
                </div>

                {loading ? (
                    <div className="p-8 text-sm text-muted-foreground">Loading relationships...</div>
                ) : error ? (
                    <div className="p-8 text-sm text-destructive">{error}</div>
                ) : result.items.length === 0 ? (
                    <div className="p-8 text-sm text-muted-foreground">No relationships found.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <Table className="min-w-[1100px]">
                            <TableHeader>
                                <TableRow className="bg-muted/40">
                                    {[
                                        ["wholesaler", "Wholesaler"],
                                        ["retailer", "Retailer"],
                                        ["location", "Location"],
                                        ["orders", "Orders"],
                                        ["value", "Value"],
                                        ["status", "Status"],
                                        ["createdAt", "Since"],
                                    ].map(([key, label]) => (
                                        <TableHead key={key}>
                                            <button className="inline-flex items-center gap-1" onClick={() => toggleSort(key)}>
                                                {label}
                                                {sortBy === key &&
                                                    (sortOrder === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
                                            </button>
                                        </TableHead>
                                    ))}
                                    <TableHead />
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {result.items.map((row) => (
                                    <TableRow key={String(row.id)}>
                                        <TableCell className="font-semibold">
                                            <Link to="/relationships/$id" params={{ id: String(row.id) }} className="hover:underline hover:text-primary">
                                                {row.wholesaler?.name || "—"}
                                            </Link>
                                        </TableCell>
                                        <TableCell>
                                            <Link to="/relationships/$id" params={{ id: String(row.id) }} className="hover:underline hover:text-primary">
                                                {row.retailer?.name || "—"}
                                            </Link>
                                        </TableCell>
                                        <TableCell>{row.location || "—"}</TableCell>
                                        <TableCell>{row.orders || 0}</TableCell>
                                        <TableCell>{money(row.value)}</TableCell>
                                        <TableCell>
                                            <StatusBadge status={statusLabels[row.status] || row.status} />
                                        </TableCell>
                                        <TableCell>
                                            {row.createdAt ? new Date(row.createdAt).toLocaleDateString("en-IN") : "—"}
                                        </TableCell>
                                        <TableCell>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" aria-label="Relationship actions">
                                                        <MoreHorizontal />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onSelect={() => navigate({ to: "/relationships/$id", params: { id: String(row.id) } })}>View details</DropdownMenuItem>
                                                    {row.status !== "approved" && (
                                                        <DropdownMenuItem
                                                            onSelect={() => setConfirmation({ kind: "status", row, status: "approved" })}
                                                        >
                                                            Connect
                                                        </DropdownMenuItem>
                                                    )}
                                                    {row.status !== "blocked" && (
                                                        <DropdownMenuItem
                                                            onSelect={() => setConfirmation({ kind: "status", row, status: "blocked" })}
                                                        >
                                                            Suspend
                                                        </DropdownMenuItem>
                                                    )}
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem
                                                        className="text-destructive"
                                                        onSelect={() => setConfirmation({ kind: "delete", row })}
                                                    >
                                                        Remove
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
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
                            <ChevronLeft />
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
                            <ChevronRight />
                        </Button>
                    </div>
                </div>
            </section>

            <Dialog open={formOpen} onOpenChange={(open) => !open && setFormOpen(false)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add connection</DialogTitle>
                        <DialogDescription>Connect a retailer to one active wholesaler.</DialogDescription>
                    </DialogHeader>
                    <Select value={form.wholesaler} onValueChange={(value) => setForm((current) => ({ ...current, wholesaler: value }))}>
                        <SelectTrigger>
                            <SelectValue placeholder="Select wholesaler" />
                        </SelectTrigger>
                        <SelectContent>
                            {selectable(filters.wholesalers).map((user) => (
                                <SelectItem key={user.id} value={String(user.id)}>
                                    {user.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select value={form.retailer} onValueChange={(value) => setForm((current) => ({ ...current, retailer: value }))}>
                        <SelectTrigger>
                            <SelectValue placeholder="Select retailer" />
                        </SelectTrigger>
                        <SelectContent>
                            {selectable(filters.retailers).map((user) => (
                                <SelectItem key={user.id} value={String(user.id)}>
                                    {user.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>
                            Cancel
                        </Button>
                        <Button onClick={save} disabled={saving}>
                            {saving ? "Saving..." : "Connect"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={Boolean(viewing)} onOpenChange={(open) => !open && setViewing(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Relationship details</DialogTitle>
                        <DialogDescription>Live connection information</DialogDescription>
                    </DialogHeader>
                    {viewing && (
                        <div className="grid gap-3 text-sm sm:grid-cols-2">
                            <p>
                                <strong>Wholesaler:</strong> {viewing.wholesaler?.name}
                            </p>
                            <p>
                                <strong>Retailer:</strong> {viewing.retailer?.name}
                            </p>
                            <p>
                                <strong>Orders:</strong> {viewing.orders}
                            </p>
                            <p>
                                <strong>Value:</strong> {money(viewing.value)}
                            </p>
                            <p>
                                <strong>Status:</strong> {statusLabels[viewing.status] || viewing.status}
                            </p>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setViewing(null)}>
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <ConfirmationModal
                open={Boolean(confirmation)}
                title={
                    confirmation?.kind === "delete"
                        ? "Remove relationship?"
                        : confirmation?.status === "approved"
                        ? "Connect relationship?"
                        : "Suspend relationship?"
                }
                description={
                    confirmation?.kind === "delete"
                        ? "This removes the connection if no active orders exist."
                        : "The relationship status will be updated."
                }
                confirmLabel={
                    confirmation?.kind === "delete" ? "Remove" : confirmation?.status === "approved" ? "Connect" : "Suspend"
                }
                variant={confirmation?.kind === "delete" || confirmation?.status === "blocked" ? "destructive" : "default"}
                onCancel={() => !saving && setConfirmation(null)}
                onConfirm={runAction}
            />
        </div>
    );
}
