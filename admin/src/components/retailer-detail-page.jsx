import { useEffect, useState } from "react";
import { ArrowLeft, Ban, Building2, Calendar, CheckCircle2, CircleDollarSign, CreditCard, Edit, Layers, Link as LinkIcon, Pencil, RefreshCw, ShoppingBag, Trash2, User, Users, XCircle } from "lucide-react";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { apiDelete, apiGet, apiPatch, apiPut } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { ConfirmationModal } from "@/components/ui/confirmation-modal";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KpiCard, PageHeader, SectionCard, StatusBadge } from "@/components/admin-ui";
import toast from "@/components/ui/toast";

const statusLabels = { pending: "Pending", active: "Active", blocked: "Blocked", PENDING: "Pending", ACTIVE: "Active", BLOCKED: "Blocked" };
const money = (value) => `₹${Number(value || 0).toLocaleString("en-IN")}`;
const date = (value) => value ? new Date(value).toLocaleDateString("en-IN") : "—";
const displayName = (user) => user?.businessName || user?.company || user?.name || "—";

export function RetailerDetailPage() {
    const navigate = useNavigate();
    const { id } = useParams({ strict: false });
    const [details, setDetails] = useState(null);
    const [wholesalers, setWholesalers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [refreshKey, setRefreshKey] = useState(0);
    const [confirmation, setConfirmation] = useState(null);
    const [saving, setSaving] = useState(false);

    // Edit Modal state
    const [editOpen, setEditOpen] = useState(false);
    const [editForm, setEditForm] = useState({});

    // Change Wholesaler Modal state
    const [changeWholesalerOpen, setChangeWholesalerOpen] = useState(false);
    const [selectedWholesalerId, setSelectedWholesalerId] = useState("");

    useEffect(() => {
        let mounted = true;
        async function load() {
            setLoading(true);
            setError(null);
            try {
                const [response, wholesalersRes] = await Promise.all([
                    apiGet(`/admin/retailers/${id}`),
                    apiGet(`/admin/wholesalers?limit=100`).catch(() => ({ items: [] })),
                ]);
                if (!mounted) return;
                setDetails(response || null);
                setWholesalers(wholesalersRes?.items || wholesalersRes?.wholesalers || []);
            } catch (err) {
                if (!mounted) return;
                setDetails(null);
                setError(err.message || "Unable to load retailer details");
            } finally {
                if (mounted) setLoading(false);
            }
        }
        load();
        return () => { mounted = false; };
    }, [id, refreshKey]);

    if (loading) return <div className="rounded-lg border border-dashed bg-card p-8 text-sm text-muted-foreground">Loading retailer details...</div>;
    if (error) return (
        <div className="space-y-4">
            <Button variant="ghost" onClick={() => navigate({ to: "/retailers" })}><ArrowLeft /> Back</Button>
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-8 text-sm text-destructive">{error}</div>
        </div>
    );

    const profile = details?.profile || details || {};
    const orders = details?.recentOrders || details?.orders || [];
    const payments = details?.payments || details?.paymentSummary || [];
    const relationships = details?.relationships || [];
    const wholesaler = profile.assignedWholesalerId || profile.wholesalerId || (relationships[0]?.wholesalerId) || {};
    const totalSpent = orders.reduce((total, order) => total + (order.status === "cancelled" || order.orderStatus === "CANCELLED" ? 0 : Number(order.totalAmount || order.grandTotal || order.total || 0)), 0);

    const openEditModal = () => {
        setEditForm({
            name: profile.name || "",
            businessName: profile.businessName || profile.company || "",
            company: profile.company || profile.businessName || "",
            email: profile.email || "",
            phone: profile.phone || "",
            city: profile.city || "",
            state: profile.state || "",
            pincode: profile.pincode || profile.postalCode || "",
            street: profile.street || profile.address?.street || "",
            businessType: profile.businessType || "Retail Store",
            gstin: profile.gstin || profile.gstNumber || "",
            gstStatus: profile.gstStatus || (profile.gstRegistered ? "REGISTERED" : "UNREGISTERED"),
        });
        setEditOpen(true);
    };

    const handleSaveEdit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            await apiPut(`/admin/retailers/${id}`, editForm);
            toast.success("Retailer profile updated successfully");
            setEditOpen(false);
            setRefreshKey((prev) => prev + 1);
        } catch (err) {
            toast.error(err.message || "Failed to update retailer profile");
        } finally {
            setSaving(false);
        }
    };

    const openChangeWholesaler = () => {
        setSelectedWholesalerId(String(wholesaler?._id || wholesaler?.id || ""));
        setChangeWholesalerOpen(true);
    };

    const handleSaveWholesalerChange = async () => {
        if (!selectedWholesalerId) return;
        setSaving(true);
        try {
            await apiPatch(`/admin/retailers/${id}/wholesaler`, { wholesalerId: selectedWholesalerId });
            toast.success("Retailer wholesaler changed successfully");
            setChangeWholesalerOpen(false);
            setRefreshKey((prev) => prev + 1);
        } catch (err) {
            toast.error(err.message || "Unable to change wholesaler");
        } finally {
            setSaving(false);
        }
    };

    const confirmStatusChange = () => {
        const nextStatus = profile.status === "blocked" || profile.status === "BLOCKED" ? "active" : "blocked";
        setConfirmation({
            kind: "status",
            nextStatus,
            title: nextStatus === "active" ? "Activate retailer?" : "Block retailer?",
            description: nextStatus === "active" ? "This retailer account will be activated and allowed to order." : "This retailer account will be blocked from placing orders.",
        });
    };

    const confirmDelete = () => setConfirmation({
        kind: "delete",
        title: "Delete retailer?",
        description: "This will soft-delete the retailer account and remove it from active views.",
    });

    const runConfirmedAction = async () => {
        if (!confirmation) return;
        setSaving(true);
        try {
            if (confirmation.kind === "delete") {
                await apiDelete(`/admin/retailers/${id}`);
                toast.success("Retailer deleted successfully");
                navigate({ to: "/retailers" });
                return;
            }

            await apiPatch(`/admin/retailers/${id}/status`, { status: confirmation.nextStatus });
            toast.success("Retailer status updated successfully");
            setConfirmation(null);
            setRefreshKey((prev) => prev + 1);
        } catch (err) {
            toast.error(err.message || "Action failed");
        } finally {
            setSaving(false);
        }
    };

    const activeWholesalersList = wholesalers.filter((row) => row.status === "active" || row.status === "ACTIVE");

    return (
        <div className="space-y-6">
            <PageHeader
                title={displayName(profile)}
                description={`${profile.city || ""}${profile.state ? `, ${profile.state}` : ""} · ${profile.email || "No email"} · ${profile.phone || "No phone"}`}
                action={
                    <div className="flex flex-wrap gap-2">
                        <Button variant="outline" onClick={openEditModal} className="border-primary/30 bg-primary/5 text-primary hover:bg-primary/10">
                            <Pencil className="size-4 mr-1.5" /> Edit Profile
                        </Button>
                        <Button
                            variant="outline"
                            onClick={openChangeWholesaler}
                            className="border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                        >
                            <Building2 className="size-4 mr-1.5" /> Change Wholesaler
                        </Button>
                        <Button
                            variant="outline"
                            className={profile.status === "blocked" || profile.status === "BLOCKED" ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100" : "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"}
                            onClick={confirmStatusChange}
                        >
                            {profile.status === "blocked" || profile.status === "BLOCKED" ? <CheckCircle2 className="size-4 mr-1.5" /> : <Ban className="size-4 mr-1.5" />}
                            {profile.status === "blocked" || profile.status === "BLOCKED" ? "Activate" : "Block"}
                        </Button>
                        <Button variant="outline" onClick={() => setRefreshKey((value) => value + 1)}><RefreshCw /> Refresh</Button>
                        <Button variant="outline" className="border-red-200 bg-red-50 text-red-700 hover:bg-red-100 hover:text-red-800" onClick={confirmDelete}><Trash2 /> Delete</Button>
                        <Button variant="ghost" onClick={() => navigate({ to: "/retailers" })}><ArrowLeft /> Back</Button>
                    </div>
                }
            />
            <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={statusLabels[profile.status] || profile.status} />
                <span className="text-sm text-muted-foreground">Registered {date(profile.createdAt)}</span>
                {wholesaler && (wholesaler.businessName || wholesaler.name) && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-foreground">
                        <Building2 className="size-3 text-primary" /> {displayName(wholesaler)}
                    </span>
                )}
            </div>
            <Tabs defaultValue="overview">
                <TabsList className="flex h-auto justify-start overflow-x-auto bg-transparent p-0">
                    {[
                        ["overview", "Overview"],
                        ["wholesaler", "Connected Wholesaler"],
                        ["orders", "Order History"],
                        ["payments", "Payments & Activity"],
                    ].map(([value, label]) => (
                        <TabsTrigger key={value} value={value} className="rounded-none border-b-2 border-transparent py-3 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary">
                            {label}
                        </TabsTrigger>
                    ))}
                </TabsList>
                <TabsContent value="overview" className="space-y-5">
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                        <KpiCard label="Orders Placed" value={String(orders.length)} icon={ShoppingBag} />
                        <KpiCard label="Total Spent" value={money(totalSpent)} icon={CircleDollarSign} />
                        <KpiCard label="Connected Wholesaler" value={displayName(wholesaler)} icon={Building2} />
                        <KpiCard label="Payments Logged" value={String(payments.length)} icon={CreditCard} />
                    </div>
                    <SectionCard
                        title="Profile information"
                        action={
                            <Button variant="outline" size="sm" onClick={openEditModal} className="h-8 gap-1.5 text-xs">
                                <Pencil className="size-3.5" /> Edit Profile
                            </Button>
                        }
                    >
                        <div className="grid gap-3 p-5 text-sm sm:grid-cols-2 lg:grid-cols-3">
                            <p><strong>Owner Name:</strong> {profile.name || "—"}</p>
                            <p><strong>Business Name:</strong> {displayName(profile)}</p>
                            <p><strong>Email:</strong> {profile.email || "—"}</p>
                            <p><strong>Phone:</strong> {profile.phone || "—"}</p>
                            <p><strong>Business Type:</strong> {profile.businessType || "Retailer Store"}</p>
                            <p><strong>GST Status:</strong> {profile.gstStatus || (profile.gstRegistered ? "REGISTERED" : "UNREGISTERED")}</p>
                            <p><strong>GSTIN:</strong> {profile.gstin || profile.gstNumber || "—"}</p>
                            <p><strong>Status:</strong> {statusLabels[profile.status] || profile.status || "Active"}</p>
                            <p><strong>Registered Date:</strong> {date(profile.createdAt)}</p>
                        </div>
                    </SectionCard>
                    <SectionCard title="Registered business address">
                        <div className="grid gap-3 p-5 text-sm sm:grid-cols-2 lg:grid-cols-4">
                            <p><strong>Street:</strong> {profile.street || profile.address?.street || "—"}</p>
                            <p><strong>City:</strong> {profile.city || profile.address?.city || "—"}</p>
                            <p><strong>State:</strong> {profile.state || profile.address?.state || "—"}</p>
                            <p><strong>Pincode:</strong> {profile.pincode || profile.postalCode || profile.address?.pincode || "—"}</p>
                        </div>
                    </SectionCard>
                    <SectionCard
                        title="Connected wholesaler"
                        action={
                            <Button variant="outline" size="sm" onClick={openChangeWholesaler} className="h-8 gap-1.5 text-xs">
                                <Building2 className="size-3.5" /> Change Wholesaler
                            </Button>
                        }
                    >
                        <div className="grid gap-3 p-5 text-sm sm:grid-cols-2 lg:grid-cols-3">
                            <p><strong>Wholesaler Business:</strong> {displayName(wholesaler)}</p>
                            <p><strong>Contact Email:</strong> {wholesaler?.email || "—"}</p>
                            <p><strong>Phone:</strong> {wholesaler?.phone || "—"}</p>
                            <p><strong>Location:</strong> {[wholesaler?.city, wholesaler?.state].filter(Boolean).join(", ") || "—"}</p>
                            <p><strong>Status:</strong> <StatusBadge status={wholesaler?.status || "Connected"} /></p>
                        </div>
                    </SectionCard>
                </TabsContent>
                <TabsContent value="wholesaler">
                    <SectionCard title="Connected Wholesalers" description={`${relationships.length || (wholesaler?.name || wholesaler?.businessName ? 1 : 0)} wholesaler relationship(s) linked`}>
                        <SimpleTable
                            headers={["Wholesaler", "Email", "Location", "Relationship Status", "Action"]}
                            rows={(relationships.length ? relationships : ((wholesaler?.name || wholesaler?.businessName) ? [{ wholesalerId: wholesaler, status: "ACTIVE" }] : [])).map((rel) => {
                                const wObj = rel.wholesalerId || wholesaler;
                                const wId = String(wObj?._id || wObj?.id || "");
                                return [
                                    <span key="name" className="font-semibold">{displayName(wObj)}</span>,
                                    wObj?.email || "—",
                                    [wObj?.city, wObj?.state].filter(Boolean).join(", ") || "—",
                                    <StatusBadge key="status" status={rel.status || "ACTIVE"} />,
                                    wId ? (
                                        <Button key="link" asChild variant="ghost" size="sm" className="h-8 gap-1 text-xs text-primary">
                                            <Link to="/wholesalers/$id" params={{ id: wId }}>
                                                View Wholesaler <Building2 className="size-3" />
                                            </Link>
                                        </Button>
                                    ) : "—",
                                ];
                            })}
                        />
                    </SectionCard>
                </TabsContent>
                <TabsContent value="orders">
                    <SectionCard title="Order History" description={`${orders.length} orders placed by this retailer`}>
                        <SimpleTable
                            headers={["Order", "Wholesaler", "Amount", "Status", "Payment", "Date", "Action"]}
                            rows={orders.map((order) => [
                                `#${order.orderNo || order.orderNumber || String(order.id || order._id).slice(-6)}`,
                                displayName(order.wholesaler || order.wholesalerId),
                                money(order.totalAmount || order.grandTotal || order.total),
                                <StatusBadge key="status" status={statusLabels[order.status || order.orderStatus] || order.status || order.orderStatus} />,
                                <StatusBadge key="payment" status={order.paymentStatus || "Unpaid"} />,
                                date(order.createdAt),
                                <Button key="link" asChild variant="ghost" size="sm" className="h-8 gap-1 text-xs text-primary">
                                    <Link to="/orders/$id" params={{ id: String(order.id || order._id) }}>
                                        View Details
                                    </Link>
                                </Button>,
                            ])}
                        />
                    </SectionCard>
                </TabsContent>
                <TabsContent value="payments">
                    <SectionCard title="Payment & Activity Summary" description={`${payments.length} payment record(s) logged`}>
                        <SimpleTable
                            headers={["Order", "Amount", "Method", "Status", "Transaction Ref", "Date"]}
                            rows={payments.map((payment) => [
                                payment.order?.orderNo ? `#${payment.order.orderNo}` : payment.orderId ? `#${String(payment.orderId).slice(-6)}` : "—",
                                money(payment.amount),
                                payment.method || payment.paymentMethod || "COD",
                                <StatusBadge key="status" status={payment.status || payment.paymentStatus || "COMPLETED"} />,
                                payment.transactionRef || payment.reference || "—",
                                date(payment.createdAt),
                            ])}
                        />
                    </SectionCard>
                </TabsContent>
            </Tabs>

            <ConfirmationModal
                open={Boolean(confirmation)}
                title={confirmation?.title}
                description={confirmation?.description}
                confirmLabel={confirmation?.kind === "delete" ? "Delete" : "Confirm"}
                variant={confirmation?.kind === "delete" ? "destructive" : "default"}
                onCancel={() => !saving && setConfirmation(null)}
                onConfirm={runConfirmedAction}
            />

            {/* Edit Retailer Profile Dialog */}
            {editOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-lg rounded-xl border bg-card p-6 shadow-xl max-h-[90vh] overflow-y-auto space-y-4">
                        <div className="flex items-center justify-between border-b pb-3">
                            <h3 className="text-lg font-bold">Edit Retailer Profile</h3>
                            <button type="button" className="text-muted-foreground hover:text-foreground text-lg font-bold" onClick={() => !saving && setEditOpen(false)}>✕</button>
                        </div>
                        <form onSubmit={handleSaveEdit} className="space-y-4 text-sm">
                            <div className="grid gap-3 sm:grid-cols-2">
                                <div>
                                    <label className="text-xs font-semibold text-muted-foreground">Owner Name</label>
                                    <input className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm" value={editForm.name || ""} onChange={(e) => setEditForm(f => ({ ...f, name: e.target.value }))} required />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-muted-foreground">Business Name</label>
                                    <input className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm" value={editForm.businessName || ""} onChange={(e) => setEditForm(f => ({ ...f, businessName: e.target.value, company: e.target.value }))} required />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-muted-foreground">Email</label>
                                    <input type="email" className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm" value={editForm.email || ""} onChange={(e) => setEditForm(f => ({ ...f, email: e.target.value }))} required />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-muted-foreground">Phone</label>
                                    <input className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm" value={editForm.phone || ""} onChange={(e) => setEditForm(f => ({ ...f, phone: e.target.value }))} required />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-muted-foreground">Business Type</label>
                                    <input className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm" value={editForm.businessType || ""} onChange={(e) => setEditForm(f => ({ ...f, businessType: e.target.value }))} placeholder="e.g. Retail Store / Supermarket" />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-muted-foreground">GST Status</label>
                                    <select className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm" value={editForm.gstStatus || ""} onChange={(e) => setEditForm(f => ({ ...f, gstStatus: e.target.value }))}>
                                        <option value="REGISTERED">REGISTERED</option>
                                        <option value="UNREGISTERED">UNREGISTERED</option>
                                    </select>
                                </div>
                                <div className="sm:col-span-2">
                                    <label className="text-xs font-semibold text-muted-foreground">GSTIN</label>
                                    <input className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm" value={editForm.gstin || ""} onChange={(e) => setEditForm(f => ({ ...f, gstin: e.target.value }))} placeholder="e.g. 08AAAAA0000A1Z5" />
                                </div>
                            </div>
                            <div className="border-t pt-3">
                                <h4 className="text-xs font-bold text-foreground mb-2">Registered Business Address</h4>
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <div>
                                        <label className="text-xs font-semibold text-muted-foreground">Street Address</label>
                                        <input className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm" value={editForm.street || ""} onChange={(e) => setEditForm(f => ({ ...f, street: e.target.value }))} />
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-muted-foreground">City</label>
                                        <input className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm" value={editForm.city || ""} onChange={(e) => setEditForm(f => ({ ...f, city: e.target.value }))} required />
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-muted-foreground">State</label>
                                        <input className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm" value={editForm.state || ""} onChange={(e) => setEditForm(f => ({ ...f, state: e.target.value }))} required />
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-muted-foreground">Pincode</label>
                                        <input className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm" value={editForm.pincode || ""} onChange={(e) => setEditForm(f => ({ ...f, pincode: e.target.value }))} />
                                    </div>
                                </div>
                            </div>
                            <div className="flex justify-end gap-2 border-t pt-3">
                                <Button type="button" variant="outline" onClick={() => setEditOpen(false)} disabled={saving}>Cancel</Button>
                                <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save Changes"}</Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Change Wholesaler Dialog */}
            {changeWholesalerOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-xl space-y-4">
                        <div className="flex items-center justify-between border-b pb-3">
                            <h3 className="text-lg font-bold">Change Wholesaler</h3>
                            <button type="button" className="text-muted-foreground hover:text-foreground text-lg font-bold" onClick={() => !saving && setChangeWholesalerOpen(false)}>✕</button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Select an active wholesaler to connect this retailer to. Unfinished orders with the current wholesaler will remain intact.
                        </p>
                        <div>
                            <label className="text-xs font-semibold text-muted-foreground">Select Active Wholesaler</label>
                            <select
                                className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm"
                                value={selectedWholesalerId}
                                onChange={(e) => setSelectedWholesalerId(e.target.value)}
                            >
                                <option value="">Select wholesaler...</option>
                                {activeWholesalersList.map((w) => (
                                    <option key={w.id || w._id} value={String(w.id || w._id)}>
                                        {w.businessName || w.name} ({w.city || "Wholesaler"})
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="flex justify-end gap-2 border-t pt-3">
                            <Button type="button" variant="outline" onClick={() => setChangeWholesalerOpen(false)} disabled={saving}>Cancel</Button>
                            <Button onClick={handleSaveWholesalerChange} disabled={saving || !selectedWholesalerId}>{saving ? "Saving..." : "Change Wholesaler"}</Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function SimpleTable({ headers, rows }) {
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
                <thead>
                    <tr className="border-b bg-muted/40">
                        {headers.map((header) => (
                            <th key={header} className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">{header}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.length ? rows.map((row, index) => (
                        <tr key={index} className="border-b last:border-0 hover:bg-muted/20">
                            {row.map((cell, cellIndex) => (
                                <td key={cellIndex} className="whitespace-nowrap px-4 py-3">{cell}</td>
                            ))}
                        </tr>
                    )) : (
                        <tr>
                            <td className="px-4 py-8 text-muted-foreground" colSpan={headers.length}>No records found.</td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}
