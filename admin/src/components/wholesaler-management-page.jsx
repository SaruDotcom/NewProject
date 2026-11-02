import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Ban, CheckCircle2, ChevronLeft, ChevronRight, Eye, Plus, Search } from "lucide-react";
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
    SUSPENDED: "Suspended",
};
const accountStatusOptions = [["pending", "Pending"], ["active", "Active"], ["blocked", "Blocked"], ["suspended", "Suspended"]];
const kycStatusOptions = [["draft", "Not submitted"], ["submitted", "Submitted"], ["pending", "Pending"], ["under_review", "Under review"], ["approved", "Approved"], ["rejected", "Rejected"], ["resubmission_required", "Resubmission required"], ["resubmit_requested", "Resubmission requested"], ["suspended", "Suspended"]];
const subscriptionStatusOptions = [["active", "Active"], ["expired", "Expired"], ["cancelled", "Cancelled"], ["no_subscription", "No Subscription"]];
const blankForm = { name: "", businessName: "", company: "", email: "", phone: "", city: "", state: "", password: "" };
import { apiGet, apiPatch, apiPost, apiPut } from "@/lib/api";
const columns = [
    ["id", "Wholesaler ID"],
    ["businessName", "Business Name"],
    ["name", "Contact Details"],
    ["subscriptionStatus", "Subscription Status"],
    ["kycStatus", "KYC Status"],
    ["status", "Account Status"],
];

const columnWidths = {
    id: "min-w-[150px]",
    businessName: "min-w-[180px]",
    name: "min-w-[220px]",
    subscriptionStatus: "min-w-[180px]",
    kycStatus: "min-w-[130px]",
    status: "min-w-[130px]",
};

const formatStatus = (status) => String(status || "").replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
const accountStatus = (row) => statusLabels[row.status] || formatStatus(row.status) || "Pending";
const kycStatus = (row) => !row.kycStatus || row.kycStatus === "DRAFT" ? "Not submitted" : formatStatus(row.kycStatus);
const subscriptionStatus = (row) => row.subscription
    ? formatStatus(row.subscription.status)
    : "No Subscription";
const renderSubscription = (row) => row.subscription
    ? <div className="flex flex-col items-start gap-1"><span className="max-w-full break-words text-sm font-medium">{row.subscription.planName || "Plan name unavailable"}</span><StatusBadge status={subscriptionStatus(row)} /></div>
    : <span className="text-sm text-muted-foreground">No Subscription</span>;

export function WholesalerManagementPage() {
    const [search, setSearch] = useState("");
    const debouncedSearch = useDebounce(search, 350);
    const [status, setStatus] = useState(() => {
        if (typeof window === "undefined") return "all";
        const value = new URLSearchParams(window.location.search).get("status")?.toLowerCase();
        return ["pending", "active", "blocked", "suspended"].includes(value) ? value : "all";
    });
    const [kycFilter, setKycFilter] = useState("all");
    const [subscriptionFilter, setSubscriptionFilter] = useState("all");
    const [sortBy, setSortBy] = useState("businessName");
    const [sortOrder, setSortOrder] = useState("asc");
    const [page, setPage] = useState(1);
    const [refreshKey, setRefreshKey] = useState(0);
    const [confirmation, setConfirmation] = useState(null);
    const [editing, setEditing] = useState(null);
    const [formMode, setFormMode] = useState("create");
    const [formErrors, setFormErrors] = useState({});
    const [editForm, setEditForm] = useState({});
    const [actionLoading, setActionLoading] = useState(false);
    const [result, setResult] = useState({ items: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 1 } });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        setPage(1);
    }, [debouncedSearch, status, kycFilter, subscriptionFilter]);

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
        if (kycFilter !== "all") params.set("kycStatus", kycFilter);
        if (subscriptionFilter !== "all") params.set("subscriptionStatus", subscriptionFilter);

        async function load() {
            setLoading(true);
            setError(null);
            try {
                const payload = await apiGet(`/admin/wholesalers?${params.toString()}`);
                if (!mounted) return;
                setResult({
                    items: Array.isArray(payload?.items) ? payload.items : [],
                    pagination: payload?.pagination || { page: 1, limit: 10, total: 0, totalPages: 1 },
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
    }, [debouncedSearch, status, kycFilter, subscriptionFilter, sortBy, sortOrder, page, refreshKey]);

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
    const renderRowActions = (row) => (
        <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm" className="h-8 px-2 text-xs" title="View full profile">
                <Link to={`/wholesalers/${row.id}`}><Eye className="size-3.5" />View</Link>
            </Button>
            {row.status === "BLOCKED" ? (
                <Button variant="outline" size="sm" className="h-8 border-emerald-200 bg-emerald-50 px-2 text-xs text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800" title="Unblock wholesaler" onClick={() => confirmBlocked(row, false)}>
                    <CheckCircle2 className="size-3.5" />Unblock
                </Button>
            ) : row.status === "ACTIVE" ? (
                <Button variant="outline" size="sm" className="h-8 border-slate-200 bg-slate-50 px-2 text-xs text-slate-700 hover:bg-slate-100" title="Block wholesaler" onClick={() => confirmBlocked(row, true)}>
                    <Ban className="size-3.5" />Block
                </Button>
            ) : null}
        </div>
    );
    const pages = Math.max(1, result.pagination.totalPages || 1);

    return (
        <div className="space-y-6">
            <PageHeader
                title="Wholesalers"
                description="Manage wholesaler accounts, subscriptions and verification."
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
                    <Select value={subscriptionFilter} onValueChange={(value) => { setSubscriptionFilter(value); setPage(1); }}>
                        <SelectTrigger className="w-full lg:w-48"><SelectValue placeholder="Subscription" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All subscriptions</SelectItem>
                            {subscriptionStatusOptions.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <Select value={kycFilter} onValueChange={(value) => { setKycFilter(value); setPage(1); }}>
                        <SelectTrigger className="w-full lg:w-40"><SelectValue placeholder="KYC status" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All KYC statuses</SelectItem>
                            {kycStatusOptions.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <Select value={status} onValueChange={(value) => { setStatus(value); setPage(1); }}>
                        <SelectTrigger className="w-full lg:w-40"><SelectValue placeholder="Account status" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All accounts</SelectItem>
                            {accountStatusOptions.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                {loading ? (
                    <div className="p-8 text-sm text-muted-foreground">Loading wholesalers...</div>
                ) : error ? (
                    <div className="p-8 text-sm text-destructive">{error}</div>
                ) : result.items.length === 0 ? (
                    <div className="p-8 text-sm text-muted-foreground">No wholesalers found.</div>
                ) : (
                    <>
                        <div className="space-y-3 p-3 xl:hidden">
                            {result.items.map((row) => (
                                <article key={String(row.id)} className="space-y-4 rounded-lg border bg-card p-4">
                                    <div className="flex flex-col gap-1">
                                        <span className="font-semibold">{row.businessName || row.name || "—"}</span>
                                        <Link to={`/wholesalers/${row.id}`} className="break-all text-xs font-medium text-primary underline-offset-2 hover:underline">
                                            ID: {row.id}
                                        </Link>
                                    </div>
                                    <div className="grid gap-3 text-sm sm:grid-cols-2">
                                        <div className="min-w-0"><span className="text-xs font-semibold uppercase text-muted-foreground">Contact details</span><p className="break-words">{row.name || "—"}</p><p className="break-all text-muted-foreground">{row.email || "—"}</p><p className="text-muted-foreground">{row.phone || "—"}</p></div>
                                        <div><span className="text-xs font-semibold uppercase text-muted-foreground">Subscription</span><div className="mt-1">{renderSubscription(row)}</div></div>
                                        <div><span className="text-xs font-semibold uppercase text-muted-foreground">KYC status</span><div className="mt-1"><StatusBadge status={kycStatus(row)} /></div></div>
                                        <div><span className="text-xs font-semibold uppercase text-muted-foreground">Account status</span><div className="mt-1"><StatusBadge status={accountStatus(row)} /></div></div>
                                    </div>
                                    <div className="border-t pt-3">{renderRowActions(row)}</div>
                                </article>
                            ))}
                        </div>
                        <div className="hidden overflow-x-auto xl:block">
                            <Table className="min-w-[1120px] w-full table-fixed">
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
                                        <TableHead className="min-w-[180px] whitespace-nowrap px-3 text-xs font-semibold uppercase text-muted-foreground">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {result.items.map((row) => (
                                        <TableRow key={String(row.id)}>
                                            <TableCell className="break-all font-mono text-xs">
                                                <Link to={`/wholesalers/${row.id}`} className="text-primary underline-offset-2 hover:underline">ID: {row.id}</Link>
                                            </TableCell>
                                            <TableCell className="whitespace-normal break-words font-semibold">{row.businessName || "—"}</TableCell>
                                            <TableCell className="whitespace-normal">
                                                <div className="space-y-1">
                                                    <p className="break-words font-medium">{row.name || "—"}</p>
                                                    <p className="break-all text-xs text-muted-foreground">{row.email || "—"}</p>
                                                    <p className="text-xs text-muted-foreground">{row.phone || "—"}</p>
                                                </div>
                                            </TableCell>
                                            <TableCell>{renderSubscription(row)}</TableCell>
                                            <TableCell><StatusBadge status={kycStatus(row)} /></TableCell>
                                            <TableCell><StatusBadge status={accountStatus(row)} /></TableCell>
                                            <TableCell>{renderRowActions(row)}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </>
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
            </section>
        </div>
    );
}
