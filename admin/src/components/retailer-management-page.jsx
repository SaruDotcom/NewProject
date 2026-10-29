import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, CalendarDays, ChevronLeft, ChevronRight, MoreHorizontal, Search, Users } from "lucide-react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useDebounce } from "@/hooks/use-debounce";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmationModal } from "@/components/ui/confirmation-modal";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { PageHeader, StatusBadge, UserAvatar } from "@/components/admin-ui";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { apiDelete, apiGet, apiPatch, apiPut } from "@/lib/api";

const statusLabels = { pending: "Pending", active: "Active", blocked: "Blocked" };
const columns = [
    ["businessName", "Business"],
    ["email", "Email"],
    ["wholesaler", "Wholesaler"],
    ["city", "City"],
    ["state", "State"],
    ["totalOrders", "Orders"],
    ["totalAmountSpent", "Amount spent"],
    ["status", "Status"],
    ["createdAt", "Registered"],
];

const initialResult = {
    items: [],
    pagination: { page: 1, limit: 10, total: 0, totalPages: 1 },
    filters: { cities: [], states: [] },
};

export function RetailerManagementPage() {
    const navigate = useNavigate();
    const [search, setSearch] = useState("");
    const debouncedSearch = useDebounce(search, 350);
    const [status, setStatus] = useState("all");
    const [wholesaler, setWholesaler] = useState("all");
    const [city, setCity] = useState("all");
    const [state, setState] = useState("all");
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");
    const [sortBy, setSortBy] = useState("createdAt");
    const [sortOrder, setSortOrder] = useState("desc");
    const [page, setPage] = useState(1);
    const [result, setResult] = useState(initialResult);
    const [wholesalers, setWholesalers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [refreshKey, setRefreshKey] = useState(0);
    const [confirmation, setConfirmation] = useState(null);
    const [editing, setEditing] = useState(null);
    const [viewing, setViewing] = useState(null);
    const [changingWholesaler, setChangingWholesaler] = useState(null);
    const [selectedWholesalerId, setSelectedWholesalerId] = useState("");
    const [editForm, setEditForm] = useState({});
    const [formErrors, setFormErrors] = useState({});
    const [actionLoading, setActionLoading] = useState(false);

    useEffect(() => {
        apiGet("/admin/wholesalers?limit=100&sortBy=businessName&sortOrder=asc")
            .then((payload) => setWholesalers(Array.isArray(payload?.items) ? payload.items : []))
            .catch(() => setWholesalers([]));
    }, []);

    useEffect(() => {
        setPage(1);
    }, [debouncedSearch, status, wholesaler, city, state, dateFrom, dateTo]);

    useEffect(() => {
        let mounted = true;
        const params = new URLSearchParams({ page: String(page), limit: "10", sortBy, sortOrder });
        if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
        if (status !== "all") params.set("status", status);
        if (wholesaler !== "all") params.set("wholesaler", wholesaler);
        if (city !== "all") params.set("city", city);
        if (state !== "all") params.set("state", state);
        if (dateFrom) params.set("dateFrom", dateFrom);
        if (dateTo) params.set("dateTo", dateTo);

        setLoading(true);
        setError(null);
        apiGet(`/admin/retailers?${params.toString()}`)
            .then((payload) => {
                if (!mounted) return;
                setResult({
                    items: Array.isArray(payload?.items) ? payload.items : [],
                    pagination: payload?.pagination || initialResult.pagination,
                    filters: payload?.filters || initialResult.filters,
                });
            })
            .catch((err) => {
                if (!mounted) return;
                setResult((current) => ({ ...current, items: [] }));
                setError(err.message || "Failed to load retailers");
            })
            .finally(() => mounted && setLoading(false));

        return () => { mounted = false; };
    }, [debouncedSearch, status, wholesaler, city, state, dateFrom, dateTo, sortBy, sortOrder, page, refreshKey]);

    const openView = (row) => {
        navigate({ to: `/retailers/${row.id}` });
    };

    const openEdit = async (row) => {
        setFormErrors({});
        setEditing(row);
        try {
            const payload = await apiGet(`/admin/retailers/${row.id}`);
            const profile = payload?.profile || payload || row;
            setEditForm({
                name: profile.name || "",
                businessName: profile.businessName || "",
                company: profile.company || "",
                email: profile.email || "",
                phone: profile.phone || "",
                city: profile.city || "",
                state: profile.state || "",
            });
        } catch (err) {
            setEditing(null);
            toast.error(err.message || "Unable to load retailer for editing");
        }
    };

    const confirmStatus = (row) => setConfirmation({
        kind: "status",
        row,
        nextStatus: row.status === "blocked" ? "active" : "blocked",
        title: row.status === "blocked" ? "Activate retailer?" : "Deactivate retailer?",
        description: row.status === "blocked"
            ? "This retailer will be allowed to operate again."
            : "This retailer will be blocked from normal platform activity.",
    });

    const confirmDelete = (row) => setConfirmation({
        kind: "delete",
        row,
        title: "Delete retailer?",
        description: "The retailer will be soft-deleted. Retailers with pending orders cannot be deleted.",
    });

    const openChangeWholesaler = (row) => {
        setSelectedWholesalerId("");
        setChangingWholesaler(row);
    };

    const requestWholesalerChange = () => {
        if (!changingWholesaler || !selectedWholesalerId) return;
        const selected = wholesalers.find((row) => String(row.id) === selectedWholesalerId);
        setChangingWholesaler(null);
        setConfirmation({
            kind: "wholesaler",
            row: changingWholesaler,
            wholesalerId: selectedWholesalerId,
            wholesalerName: selected?.businessName || selected?.name || "the selected wholesaler",
            title: "Change wholesaler?",
            description: `Connect ${changingWholesaler.businessName || changingWholesaler.name || "this retailer"} to ${selected?.businessName || selected?.name || "the selected wholesaler"}. This cannot be changed while unfinished orders exist with the current wholesaler.`,
        });
        setSelectedWholesalerId("");
    };

    const runConfirmedAction = async () => {
        if (!confirmation) return;
        setActionLoading(true);
        try {
            if (confirmation.kind === "status") {
                await apiPatch(`/admin/retailers/${confirmation.row.id}/status`, { status: confirmation.nextStatus });
                toast.success(`Retailer ${confirmation.nextStatus === "active" ? "activated" : "deactivated"} successfully`);
            } else if (confirmation.kind === "wholesaler") {
                await apiPatch(`/admin/retailers/${confirmation.row.id}/wholesaler`, { wholesalerId: confirmation.wholesalerId });
                toast.success("Retailer wholesaler changed successfully");
            } else {
                await apiDelete(`/admin/retailers/${confirmation.row.id}`);
                toast.success("Retailer deleted successfully");
            }
            setConfirmation(null);
            setRefreshKey((current) => current + 1);
        } catch (err) {
            toast.error(err.message || "Action failed");
        } finally {
            setActionLoading(false);
        }
    };

    const saveEdit = async () => {
        const required = ["name", "email", "phone", "company", "city", "state"];
        const errors = Object.fromEntries(required.filter((field) => !String(editForm[field] || "").trim()).map((field) => [field, "This field is required"]));
        setFormErrors(errors);
        if (Object.keys(errors).length) return;
        setActionLoading(true);
        try {
            await apiPut(`/admin/retailers/${editing.id}`, editForm);
            toast.success("Retailer updated successfully");
            setEditing(null);
            setRefreshKey((current) => current + 1);
        } catch (err) {
            if (err.details && typeof err.details === "object") setFormErrors((current) => ({ ...current, ...err.details }));
            toast.error(err.message || "Unable to save retailer");
        } finally {
            setActionLoading(false);
        }
    };

    const toggleSort = (key) => {
        if (sortBy === key) setSortOrder((current) => current === "asc" ? "desc" : "asc");
        else {
            setSortBy(key);
            setSortOrder("asc");
        }
        setPage(1);
    };
    const formatCurrency = (value) => `₹${Number(value || 0).toLocaleString("en-IN")}`;
    const formatDate = (value) => value ? new Date(value).toLocaleDateString("en-IN") : "—";
    const pages = Math.max(1, result.pagination.totalPages || 1);
    const filterOptions = result.filters || initialResult.filters;
    const activeWholesalers = wholesalers.filter((row) => row.status === "active");

    return (
        <div className="space-y-5">
            <div className="space-y-2 border-b border-border/80 pb-5">
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-primary">
                    <Users className="size-3.5" /> Retailer network
                </div>
                <PageHeader title="Retailers" description="Manage retailer accounts and connections." />
            </div>
            <section className="admin-card overflow-hidden shadow-sm">
                <div className="space-y-3 border-b bg-muted/15 p-4">
                    <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-[minmax(240px,1fr)_140px_minmax(170px,0.8fr)_140px_140px]">
                        <div className="relative min-w-0">
                            <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search retailers..." className="h-10 bg-card pl-9 shadow-none" />
                        </div>
                        <Select value={status} onValueChange={(value) => { setStatus(value); setPage(1); }}>
                            <SelectTrigger className="h-10 bg-card"><SelectValue placeholder="Status" /></SelectTrigger>
                            <SelectContent><SelectItem value="all">All</SelectItem>{Object.entries(statusLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
                        </Select>
                        <Select value={wholesaler} onValueChange={(value) => { setWholesaler(value); setPage(1); }}>
                            <SelectTrigger className="h-10 bg-card"><SelectValue placeholder="Wholesaler" /></SelectTrigger>
                            <SelectContent><SelectItem value="all">All</SelectItem>{wholesalers.map((row) => <SelectItem key={row.id} value={String(row.id)}>{row.businessName || row.name}</SelectItem>)}</SelectContent>
                        </Select>
                        <Select value={city} onValueChange={(value) => { setCity(value); setPage(1); }}>
                            <SelectTrigger className="h-10 bg-card"><SelectValue placeholder="City" /></SelectTrigger>
                            <SelectContent><SelectItem value="all">All</SelectItem>{(filterOptions.cities || []).map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent>
                        </Select>
                        <Select value={state} onValueChange={(value) => { setState(value); setPage(1); }}>
                            <SelectTrigger className="h-10 bg-card"><SelectValue placeholder="State" /></SelectTrigger>
                            <SelectContent><SelectItem value="all">All</SelectItem>{(filterOptions.states || []).map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                    <div className="flex flex-col gap-2 border-t border-border/70 pt-3 sm:flex-row sm:items-center">
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><CalendarDays className="size-3.5" /> Registered</span>
                        <Input type="date" value={dateFrom} onChange={(event) => { setDateFrom(event.target.value); setPage(1); }} aria-label="Registered from" className="h-9 bg-card sm:w-44" />
                        <span className="hidden text-xs text-muted-foreground sm:inline">to</span>
                        <Input type="date" value={dateTo} onChange={(event) => { setDateTo(event.target.value); setPage(1); }} aria-label="Registered to" className="h-9 bg-card sm:w-44" />
                        <span className="text-xs font-medium text-muted-foreground sm:ml-auto">{result.pagination.total} retailers</span>
                    </div>
                </div>
                {loading ? <div className="p-8 text-sm text-muted-foreground">Loading retailers...</div> : error ? <div className="p-8 text-sm text-destructive">{error}</div> : result.items.length === 0 ? <div className="p-8 text-sm text-muted-foreground">No retailers found.</div> : (
                    <div className="overflow-x-auto">
                        <Table className="min-w-[1250px]">
                            <TableHeader><TableRow className="bg-muted/30">{columns.map(([key, label]) => <TableHead key={key} className="whitespace-nowrap px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground"><button className="inline-flex items-center gap-1.5" onClick={() => toggleSort(key)}>{label}{sortBy === key && (sortOrder === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}</button></TableHead>)}<TableHead /></TableRow></TableHeader>
                            <TableBody>{result.items.map((row) => <TableRow key={String(row.id)} className="group transition-colors hover:bg-muted/20">
                                <TableCell className="min-w-52 px-4 py-3">
                                    <div className="flex items-center gap-3">
                                        <UserAvatar name={row.businessName || row.name || "Retailer"} className="size-9 rounded-lg border-0 bg-accent text-primary" />
                                        <div className="min-w-0">
                                            <Link to="/retailers/$id" params={{ id: String(row.id) }} className="hover:underline hover:text-primary">
                                                <p className="max-w-56 truncate text-sm font-bold text-foreground">{row.businessName || row.name || "—"}</p>
                                            </Link>
                                            <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Retailer account</p>
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell className="px-4 py-3 text-sm text-muted-foreground">{row.email || "—"}</TableCell>
                                <TableCell className="px-4 py-3 text-sm font-medium">{row.wholesaler?.businessName || row.wholesaler?.name || "—"}</TableCell>
                                <TableCell className="whitespace-nowrap px-4 py-3 text-sm">{row.city || "—"}</TableCell>
                                <TableCell className="whitespace-nowrap px-4 py-3 text-sm text-muted-foreground">{row.state || "—"}</TableCell>
                                <TableCell className="px-4 py-3 text-sm font-semibold tabular-nums">{row.totalOrders ?? 0}</TableCell>
                                <TableCell className="whitespace-nowrap px-4 py-3 text-sm font-semibold tabular-nums">{formatCurrency(row.totalAmountSpent)}</TableCell>
                                <TableCell className="px-4 py-3"><StatusBadge status={statusLabels[row.status] || row.status} className="tracking-normal" /></TableCell>
                                <TableCell className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">{formatDate(row.createdAt)}</TableCell>
                                <TableCell>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="opacity-70 transition-opacity group-hover:opacity-100" aria-label={`Actions for ${row.businessName || row.name}`}><MoreHorizontal /></Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem onSelect={() => openView(row)}>View</DropdownMenuItem>
                                            <DropdownMenuItem onSelect={() => openEdit(row)}>Edit</DropdownMenuItem>
                                            <DropdownMenuItem onSelect={() => openChangeWholesaler(row)}>Change Wholesaler</DropdownMenuItem>
                                            <DropdownMenuItem onSelect={() => confirmStatus(row)}>{row.status === "blocked" ? "Activate" : "Deactivate"}</DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem className="text-destructive" onSelect={() => confirmDelete(row)}>Delete</DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                            </TableRow>)}</TableBody>
                        </Table>
                    </div>
                )}
                <div className="flex items-center justify-between border-t bg-muted/10 px-4 py-3 text-xs text-muted-foreground">
                    <span>Showing <b className="font-semibold text-foreground">{result.items.length ? (page - 1) * 10 + 1 : 0}–{Math.min(page * 10, result.pagination.total)}</b> of <b className="font-semibold text-foreground">{result.pagination.total}</b></span>
                    <div className="flex items-center gap-2"><Button variant="outline" size="icon" disabled={page === 1 || loading} onClick={() => setPage((current) => Math.max(1, current - 1))} aria-label="Previous page"><ChevronLeft /></Button><span>Page {page} of {pages}</span><Button variant="outline" size="icon" disabled={page >= pages || loading} onClick={() => setPage((current) => Math.min(pages, current + 1))} aria-label="Next page"><ChevronRight /></Button></div>
                </div>
                <ConfirmationModal
                    open={Boolean(confirmation)}
                    title={confirmation?.title}
                    description={confirmation?.description}
                    confirmLabel={confirmation?.kind === "delete" ? "Delete" : confirmation?.kind === "wholesaler" ? "Change wholesaler" : confirmation?.nextStatus === "active" ? "Activate" : "Deactivate"}
                    variant={confirmation?.kind === "delete" ? "destructive" : "default"}
                    onCancel={() => !actionLoading && setConfirmation(null)}
                    onConfirm={runConfirmedAction}
                />
                <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && !actionLoading && setEditing(null)}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Edit Retailer</DialogTitle>
                            <DialogDescription>Update retailer profile details.</DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-3 sm:grid-cols-2">
                            {["name", "businessName", "company", "email", "phone", "city", "state"].map((field) => (
                                <label key={field} className="grid gap-1 text-xs font-medium capitalize">
                                    {field === "businessName" ? "Business name" : field}
                                    <Input type={field === "email" ? "email" : "text"} value={editForm[field] || ""} onChange={(event) => { setEditForm((current) => ({ ...current, [field]: event.target.value })); setFormErrors((current) => ({ ...current, [field]: undefined })); }} aria-invalid={Boolean(formErrors[field])} />
                                    {formErrors[field] && <span className="text-destructive">{formErrors[field]}</span>}
                                </label>
                            ))}
                        </div>
                        <DialogFooter><Button variant="outline" onClick={() => setEditing(null)} disabled={actionLoading}>Cancel</Button><Button onClick={saveEdit} disabled={actionLoading}>{actionLoading ? "Saving..." : "Save"}</Button></DialogFooter>
                    </DialogContent>
                </Dialog>
                <Dialog open={Boolean(changingWholesaler)} onOpenChange={(open) => !open && setChangingWholesaler(null)}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Change Wholesaler</DialogTitle>
                            <DialogDescription>Select an active wholesaler. Blocked if active orders remain.</DialogDescription>
                        </DialogHeader>
                        <Select value={selectedWholesalerId} onValueChange={setSelectedWholesalerId}>
                            <SelectTrigger><SelectValue placeholder="Choose wholesaler" /></SelectTrigger>
                            <SelectContent>{activeWholesalers.filter((row) => String(row.id) !== String(changingWholesaler?.wholesaler?.id)).map((row) => <SelectItem key={row.id} value={String(row.id)}>{row.businessName || row.name}</SelectItem>)}</SelectContent>
                        </Select>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setChangingWholesaler(null)}>Cancel</Button>
                            <Button onClick={requestWholesalerChange} disabled={!selectedWholesalerId}>Continue</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
                <Dialog open={Boolean(viewing)} onOpenChange={(open) => !open && setViewing(null)}>
                    <DialogContent>
                        <DialogHeader><DialogTitle>{viewing?.businessName || viewing?.name || "Retailer"}</DialogTitle><DialogDescription>Retailer profile and recent orders</DialogDescription></DialogHeader>
                        {viewing?.loading ? <p className="text-sm text-muted-foreground">Loading retailer details...</p> : <div className="grid gap-3 text-sm sm:grid-cols-2">
                            <p><strong>Owner:</strong> {viewing?.name || "—"}</p>
                            <p><strong>Email:</strong> {viewing?.email || "—"}</p>
                            <p><strong>Phone:</strong> {viewing?.phone || "—"}</p>
                            <p><strong>Wholesaler:</strong> {viewing?.wholesalerId?.businessName || viewing?.wholesalerId?.name || "—"}</p>
                            <p><strong>City:</strong> {viewing?.city || "—"}</p>
                            <p><strong>State:</strong> {viewing?.state || "—"}</p>
                            <p><strong>Status:</strong> {statusLabels[viewing?.status] || viewing?.status || "—"}</p>
                            <p><strong>Recent orders:</strong> {viewing?.recentOrders?.length || 0}</p>
                        </div>}
                        <DialogFooter><Button variant="outline" onClick={() => setViewing(null)}>Close</Button></DialogFooter>
                    </DialogContent>
                </Dialog>
            </section>
        </div>
    );
}