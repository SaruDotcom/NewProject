import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Ban, CheckCircle2, ChevronLeft, ChevronRight, Eye, Plus, Search, XCircle } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useDebounce } from "@/hooks/use-debounce";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmationModal } from "@/components/ui/confirmation-modal";
import toast from "@/components/ui/toast";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { PageHeader, StatusBadge } from "@/components/admin-ui";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

const statusLabels = {
    pending: "Pending",
    active: "Active",
    blocked: "Blocked",
    PENDING: "Pending",
    ACTIVE: "Active",
    BLOCKED: "Blocked",
    SUSPENDED: "Rejected",
};
const statusOptions = [
    ["pending", "Pending"],
    ["active", "Active"],
    ["blocked", "Blocked"],
    ["suspended", "Rejected"],
];
const blankForm = { name: "", businessName: "", company: "", email: "", phone: "", city: "", state: "", password: "" };
import { apiGet, apiPatch, apiPost, apiPut } from "@/lib/api";
const columns = [
    ["businessName", "Business"],
    ["email", "Email"],
    ["phone", "Phone"],
    ["city", "City"],
    ["state", "State"],
    ["totalConnectedRetailers", "Retailers"],
    ["totalOrders", "Orders"],
    ["totalSalesAmount", "Sales"],
    ["status", "Status"],
    ["registrationSource", "Registration source"],
    ["createdAt", "Registered"],
];

const columnWidths = {
    businessName: "min-w-[190px]",
    email: "min-w-[220px]",
    phone: "min-w-[130px]",
    city: "min-w-[110px]",
    state: "min-w-[130px]",
    totalConnectedRetailers: "min-w-[90px] text-center",
    totalOrders: "min-w-[80px] text-center",
    totalSalesAmount: "min-w-[110px]",
    status: "min-w-[130px]",
    registrationSource: "min-w-[170px]",
    createdAt: "min-w-[130px]",
};

const getDisplayStatus = (row) => {
    if (row.status === "BLOCKED") return "Blocked";
    if (row.status === "SUSPENDED") return "Suspended";
    if (row.status === "ACTIVE") return "Active";
    return "Pending";
};

const isApproved = (row) => row.status === "ACTIVE" && row.kycStatus === "APPROVED";

export function WholesalerManagementPage() {
    const [search, setSearch] = useState("");
    const debouncedSearch = useDebounce(search, 350);
    const [status, setStatus] = useState(() => {
        if (typeof window === "undefined") return "all";
        const value = new URLSearchParams(window.location.search).get("status")?.toLowerCase();
        return ["pending", "active", "blocked"].includes(value) ? value : "all";
    });
    const [city, setCity] = useState("all");
    const [state, setState] = useState("all");
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");
    const [sortBy, setSortBy] = useState("createdAt");
    const [sortOrder, setSortOrder] = useState("desc");
    const [page, setPage] = useState(1);
    const [refreshKey, setRefreshKey] = useState(0);
    const [confirmation, setConfirmation] = useState(null);
    const [editing, setEditing] = useState(null);
    const [formMode, setFormMode] = useState("create");
    const [formErrors, setFormErrors] = useState({});
    const [viewing, setViewing] = useState(null);
    const [editForm, setEditForm] = useState({});
    const [actionLoading, setActionLoading] = useState(false);
    const [result, setResult] = useState({ items: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 1 }, cities: [], states: [] });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        setPage(1);
    }, [debouncedSearch, status, city, state, dateFrom, dateTo]);

    useEffect(() => {
        let mounted = true;
        const params = new URLSearchParams({
            page: String(page),
            limit: "10",
            sortBy,
            sortOrder,
        });
        if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
        if (status !== "all") params.set("status", status);
        if (city !== "all") params.set("city", city);
        if (state !== "all") params.set("state", state);
        if (dateFrom) params.set("dateFrom", dateFrom);
        if (dateTo) params.set("dateTo", dateTo);

        async function load() {
            setLoading(true);
            setError(null);
            try {
                const payload = await apiGet(`/admin/wholesalers?${params.toString()}`);
                if (!mounted) return;
                setResult({
                    items: Array.isArray(payload?.items) ? payload.items : [],
                    pagination: payload?.pagination || { page: 1, limit: 10, total: 0, totalPages: 1 },
                    cities: payload?.filters?.cities || [],
                    states: payload?.filters?.states || [],
                });
            } catch (err) {
                if (!mounted) return;
                setResult((current) => ({ ...current, items: [] }));
                setError(err.message || "Failed to load wholesalers");
            } finally {
                if (mounted) setLoading(false);
            }
        }

        load();
        return () => {
            mounted = false;
        };
    }, [debouncedSearch, status, city, state, dateFrom, dateTo, sortBy, sortOrder, page, refreshKey]);

    const confirmStatus = (row, nextStatus, options = {}) => setConfirmation({
        kind: "status",
        row,
        nextStatus,
        kycStatus: options.kycStatus,
        reason: options.reason,
        title: options.title,
        description: options.description,
    });

    const confirmBlocked = (row, blocked) => setConfirmation({
        kind: "blocked",
        row,
        blocked,
        title: blocked ? "Block wholesaler?" : "Unblock wholesaler?",
        description: blocked
            ? `Block ${row.businessName || row.name || "this wholesaler"}? They will lose account and business access, and retailers will no longer be able to browse or order from this wholesaler. No business data or order history will be deleted.`
            : `Unblock ${row.businessName || row.name || "this wholesaler"}? Account and retailer catalog access will be restored without changing KYC or business information.`,
    });

    const runConfirmedAction = async () => {
        if (!confirmation || actionLoading) return;
        setActionLoading(true);
        try {
            if (confirmation.kind === "blocked") {
                await apiPatch(`/admin/wholesalers/${confirmation.row.id}/block`, {
                    blocked: confirmation.blocked,
                });
                toast.success(confirmation.blocked ? "Wholesaler blocked successfully" : "Wholesaler unblocked successfully");
            } else {
                await apiPatch(`/admin/wholesalers/${confirmation.row.id}/status`, {
                    status: confirmation.nextStatus,
                    kycStatus: confirmation.kycStatus,
                    reason: confirmation.reason,
                });
                toast.success("Wholesaler status updated successfully");
            }
            setConfirmation(null);
            setRefreshKey((current) => current + 1);
        } catch (err) {
            toast.error(err.message || "Action failed");
        } finally {
            setActionLoading(false);
        }
    };

    const openEdit = (row) => {
        setFormMode("edit");
        setFormErrors({});
        setEditing(row);
        apiGet(`/admin/wholesalers/${row.id}`).then((response) => {
            const profile = response?.profile || response || row;
            setEditForm({
                name: profile.name || "",
                businessName: profile.businessName || "",
                company: profile.company || "",
                email: profile.email || "",
                phone: profile.phone || "",
                city: profile.city || "",
                state: profile.state || "",
                password: "",
            });
        }).catch((err) => {
            toast.error(err.message || "Unable to load wholesaler for editing");
            setEditing(null);
        });
    };

    const openCreate = () => {
        setFormMode("create");
        setEditing({ id: "new" });
        setEditForm(blankForm);
        setFormErrors({});
    };

    const closeForm = () => {
        if (actionLoading) return;
        setEditing(null);
        setEditForm(blankForm);
        setFormErrors({});
    };

    const validateForm = () => {
        const errors = {};
        ["name", "businessName", "email", "phone", "city", "state", "company"].forEach((field) => {
            if (!editForm[field]?.trim()) errors[field] = "This field is required";
        });
        if (formMode === "create" && editForm.password.length < 8) errors.password = "Password must be at least 8 characters";
        if (editForm.email && !/^\S+@\S+\.\S+$/.test(editForm.email)) errors.email = "Enter a valid email address";
        if (editForm.phone && !/^\+?[1-9]\d{7,14}$/.test(editForm.phone.replace(/[\s()-]/g, ""))) errors.phone = "Enter a valid phone number";
        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const saveForm = async () => {
        if (!validateForm()) return;
        setActionLoading(true);
        try {
            const payload = { ...editForm, phone: editForm.phone.replace(/[\s()-]/g, "") };
            if (formMode === "create") await apiPost("/admin/wholesalers", payload);
            else await apiPut(`/admin/wholesalers/${editing.id}`, payload);
            toast.success(formMode === "create" ? "Wholesaler created successfully" : "Wholesaler updated successfully");
            closeForm();
            setRefreshKey((current) => current + 1);
        } catch (err) {
            if (err.details && typeof err.details === "object") setFormErrors((current) => ({ ...current, ...err.details }));
            toast.error(err.message || "Unable to save wholesaler");
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
    const formatCurrency = (value) => `₹${Number(value || 0).toLocaleString("en-IN")
        }`;
    const formatDate = (value) => value ? new Date(value).toLocaleDateString("en-IN") : "—";
    const pages = Math.max(1, result.pagination.totalPages || 1);

    return (
        <div className="space-y-6">
            <PageHeader
                title="Wholesalers"
                description="Manage and approve wholesalers."
                action={<Button onClick={openCreate}><Plus /> Add Wholesaler</Button>}
            />
            <section className="admin-card overflow-hidden">
                <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                        <Input
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Search wholesalers..."
                            className="pl-9 shadow-none"
                        />
                    </div>
                    <Select value={status} onValueChange={(value) => { setStatus(value); setPage(1); }}>
                        <SelectTrigger className="w-full lg:w-36"><SelectValue placeholder="Status" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All</SelectItem>
                            {statusOptions.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <Select value={city} onValueChange={(value) => { setCity(value); setPage(1); }}>
                        <SelectTrigger className="w-full lg:w-36"><SelectValue placeholder="City" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All</SelectItem>
                            {result.cities.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <Select value={state} onValueChange={(value) => { setState(value); setPage(1); }}>
                        <SelectTrigger className="w-full lg:w-36"><SelectValue placeholder="State" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All</SelectItem>
                            {result.states.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <Input type="date" value={dateFrom} onChange={(event) => { setDateFrom(event.target.value); setPage(1); }} aria-label="Registered from" />
                    <Input type="date" value={dateTo} onChange={(event) => { setDateTo(event.target.value); setPage(1); }} aria-label="Registered to" />
                </div>
                {loading ? (
                    <div className="p-8 text-sm text-muted-foreground">Loading wholesalers...</div>
                ) : error ? (
                    <div className="p-8 text-sm text-destructive">{error}</div>
                ) : result.items.length === 0 ? (
                    <div className="p-8 text-sm text-muted-foreground">No wholesalers found.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <Table className="min-w-[1730px] table-fixed">
                            <TableHeader>
                                <TableRow className="bg-muted/40">
                                    {columns.map(([key, label]) => (
                                        <TableHead key={key} className={`whitespace-nowrap px-3 text-xs font-semibold uppercase text-muted-foreground ${columnWidths[key] || ""}`}>
                                            <button className="inline-flex items-center gap-1" onClick={() => toggleSort(key)}>
                                                {label}
                                                {sortBy === key && (sortOrder === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
                                            </button>
                                        </TableHead>
                                    ))}
                                    <TableHead className="min-w-[360px] whitespace-nowrap px-3 text-xs font-semibold uppercase text-muted-foreground">
                                        Actions
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {result.items.map((row) => (
                                    <TableRow key={String(row.id)}>
                                        <TableCell className="truncate font-semibold" title={row.businessName || row.name || ""}>{row.businessName || row.name || "—"}</TableCell>
                                        <TableCell className="truncate" title={row.email || ""}>{row.email || "—"}</TableCell>
                                        <TableCell>{row.phone || "—"}</TableCell>
                                        <TableCell className="truncate" title={row.city || ""}>{row.city || "—"}</TableCell>
                                        <TableCell className="truncate" title={row.state || ""}>{row.state || "—"}</TableCell>
                                        <TableCell className="text-center">{row.totalConnectedRetailers ?? 0}</TableCell>
                                        <TableCell className="text-center">{row.totalOrders ?? 0}</TableCell>
                                        <TableCell>{formatCurrency(row.totalSalesAmount)}</TableCell>
                                        <TableCell><StatusBadge status={getDisplayStatus(row)} /></TableCell>
                                        <TableCell><StatusBadge status={(row.registrationSource || "DIRECT").replaceAll("_", " ")} /></TableCell>
                                        <TableCell>{formatDate(row.createdAt)}</TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-1.5">
                                                <Button asChild variant="outline" size="sm" className="h-8 px-2 text-xs" title="View full profile">
                                                    <Link to={`/wholesalers/${row.id}`}>
                                                        <Eye className="size-3.5" />
                                                        View
                                                    </Link>
                                                </Button>
                                                {!isApproved(row) && row.status !== "BLOCKED" && (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-8 border-emerald-200 bg-emerald-50 px-2 text-xs text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800"
                                                        title="Approve wholesaler"
                                                        onClick={() => confirmStatus(row, "ACTIVE", {
                                                            kycStatus: "APPROVED",
                                                            title: "Approve wholesaler?",
                                                            description: "This wholesaler will be approved and allowed to log in to the wholesaler dashboard.",
                                                        })}
                                                    >
                                                        <CheckCircle2 className="size-3.5" />
                                                        Approve
                                                    </Button>
                                                )}
                                                <Button
                                                    variant="outline"
                                                    size="icon"
                                                    className="h-8 w-8 border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 hover:text-amber-800"
                                                    title="Reject wholesaler"
                                                    aria-label={`Reject ${row.businessName || row.name}`}
                                                    onClick={() => confirmStatus(row, "SUSPENDED", {
                                                        kycStatus: "REJECTED",
                                                        reason: "Rejected by admin",
                                                        title: "Reject wholesaler?",
                                                        description: "The wholesaler registration will be rejected and dashboard login will remain blocked.",
                                                    })}
                                                >
                                                    <XCircle className="size-3.5" />
                                                </Button>
                                                {row.status === "BLOCKED" ? (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-8 border-emerald-200 bg-emerald-50 px-2 text-xs text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800"
                                                        title="Unblock wholesaler"
                                                        onClick={() => confirmBlocked(row, false)}
                                                    >
                                                        <CheckCircle2 className="size-3.5" />
                                                        Unblock
                                                    </Button>
                                                ) : row.status === "ACTIVE" ? (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-8 border-slate-200 bg-slate-50 px-2 text-xs text-slate-700 hover:bg-slate-100"
                                                        title="Block wholesaler"
                                                        onClick={() => confirmBlocked(row, true)}
                                                    >
                                                        <Ban className="size-3.5" />
                                                        Block
                                                    </Button>
                                                ) : row.status === "SUSPENDED" ? (
                                                    <Button
                                                        variant="outline"
                                                        size="icon"
                                                        className="h-8 w-8 border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800"
                                                        title="Reactivate wholesaler"
                                                        aria-label={`Reactivate ${row.businessName || row.name}`}
                                                        onClick={() => confirmStatus(row, "ACTIVE", {
                                                            kycStatus: "APPROVED",
                                                            title: "Reactivate wholesaler?",
                                                            description: "This wholesaler will be active again.",
                                                        })}
                                                    >
                                                        <CheckCircle2 className="size-3.5" />
                                                    </Button>
                                                ) : null}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
                <div className="flex items-center justify-between border-t px-4 py-3 text-xs text-muted-foreground">
                    <span>Showing {result.items.length ? (page - 1) * 10 + 1 : 0}–{Math.min(page * 10, result.pagination.total)} of {result.pagination.total}</span>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="icon" disabled={page === 1 || loading} onClick={() => setPage((current) => Math.max(1, current - 1))} aria-label="Previous page"><ChevronLeft /></Button>
                        <span>Page {page} of {pages}</span>
                        <Button variant="outline" size="icon" disabled={page >= pages || loading} onClick={() => setPage((current) => Math.min(pages, current + 1))} aria-label="Next page"><ChevronRight /></Button>
                    </div>
                </div>
                <ConfirmationModal
                    open={Boolean(confirmation)}
                    title={confirmation?.title}
                    description={confirmation?.description}
                    confirmLabel={confirmation?.kind === "blocked" ? (confirmation.blocked ? "Block" : "Unblock") : "Confirm"}
                    variant={confirmation?.kind === "blocked" && confirmation.blocked ? "destructive" : "default"}
                    onCancel={() => !actionLoading && setConfirmation(null)}
                    onConfirm={runConfirmedAction}
                />
                <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && closeForm()}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>{formMode === "create" ? "Add wholesaler" : "Edit wholesaler"}</DialogTitle>
                            <DialogDescription>{formMode === "create" ? "Create a supply partner account." : "Update the wholesaler profile details."}</DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-3 sm:grid-cols-2">
                            {["name", "businessName", "company", "email", "phone", "city", "state", ...(formMode === "create" ? ["password"] : [])].map((field) => (
                                <label key={field} className="grid gap-1 text-xs font-medium capitalize">
                                    {field === "businessName" ? "Business name" : field}
                                    <Input type={field === "password" ? "password" : field === "email" ? "email" : "text"} value={editForm[field] || ""} onChange={(event) => { setEditForm((current) => ({ ...current, [field]: event.target.value })); setFormErrors((current) => ({ ...current, [field]: undefined })); }} aria-invalid={Boolean(formErrors[field])} />
                                    {formErrors[field] && <span className="text-destructive">{formErrors[field]}</span>}
                                </label>
                            ))}
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={closeForm} disabled={actionLoading}>Cancel</Button>
                            <Button onClick={saveForm} disabled={actionLoading}>{actionLoading ? "Saving..." : formMode === "create" ? "Create wholesaler" : "Save changes"}</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
                <Dialog open={Boolean(viewing)} onOpenChange={(open) => !open && setViewing(null)}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>{viewing?.businessName || viewing?.name || "Wholesaler"}</DialogTitle>
                            <DialogDescription>Wholesaler profile</DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-3 text-sm sm:grid-cols-2">
                            <p><strong>Owner:</strong> {viewing?.name || "—"}</p>
                            <p><strong>Email:</strong> {viewing?.email || "—"}</p>
                            <p><strong>Phone:</strong> {viewing?.phone || "—"}</p>
                            <p><strong>Company:</strong> {viewing?.company || "—"}</p>
                            <p><strong>City:</strong> {viewing?.city || "—"}</p>
                            <p><strong>State:</strong> {viewing?.state || "—"}</p>
                            <p><strong>Status:</strong> {statusLabels[viewing?.status] || viewing?.status || "—"}</p>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setViewing(null)}>Close</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </section>
        </div>
    );
}
