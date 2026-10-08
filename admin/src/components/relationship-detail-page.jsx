import { useEffect, useState } from "react";
import { ArrowLeft, Ban, Building2, Calendar, CheckCircle2, CircleDollarSign, ExternalLink, Link2, RefreshCw, ShoppingBag, Store, Trash2 } from "lucide-react";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { apiDelete, apiGet, apiPatch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { ConfirmationModal } from "@/components/ui/confirmation-modal";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KpiCard, PageHeader, SectionCard, StatusBadge } from "@/components/admin-ui";
import toast from "@/components/ui/toast";

const statusLabels = { pending: "Pending", approved: "Connected", blocked: "Suspended", ACTIVE: "Connected", SUSPENDED: "Suspended" };
const money = (value) => `₹${Number(value || 0).toLocaleString("en-IN")}`;
const date = (value) => value ? new Date(value).toLocaleDateString("en-IN") : "—";

export function RelationshipDetailPage() {
    const navigate = useNavigate();
    const { id } = useParams({ strict: false });
    const [details, setDetails] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [refreshKey, setRefreshKey] = useState(0);
    const [confirmation, setConfirmation] = useState(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        let mounted = true;
        async function load() {
            setLoading(true);
            setError(null);
            try {
                const response = await apiGet(`/admin/relationships/${id}`);
                if (!mounted) return;
                setDetails(response || null);
            } catch (err) {
                if (!mounted) return;
                setDetails(null);
                setError(err.message || "Unable to load relationship details");
            } finally {
                if (mounted) setLoading(false);
            }
        }
        load();
        return () => { mounted = false; };
    }, [id, refreshKey]);

    if (loading) return <div className="rounded-lg border border-dashed bg-card p-8 text-sm text-muted-foreground">Loading relationship details...</div>;
    if (error) return (
        <div className="space-y-4">
            <Button variant="ghost" onClick={() => navigate({ to: "/relationships" })}><ArrowLeft /> Back to Relationships</Button>
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-8 text-sm text-destructive">{error}</div>
        </div>
    );

    const wholesaler = details?.wholesaler || {};
    const retailer = details?.retailer || {};
    const metrics = details?.metrics || { totalOrders: 0, totalTradeValue: 0 };
    const orders = details?.orders || [];

    const confirmStatusChange = () => {
        const nextStatus = details?.status === "blocked" || details?.status === "suspended" ? "approved" : "blocked";
        setConfirmation({
            kind: "status",
            nextStatus,
            title: nextStatus === "approved" ? "Re-connect relationship?" : "Suspend relationship?",
            description: nextStatus === "approved"
                ? "This will activate the trade relationship between this wholesaler and retailer."
                : "This will suspend ordering access between this wholesaler and retailer.",
        });
    };

    const confirmDelete = () => setConfirmation({
        kind: "delete",
        title: "Remove relationship?",
        description: "This will permanently remove the commercial connection between this wholesaler and retailer.",
    });

    const runConfirmedAction = async () => {
        if (!confirmation) return;
        setSaving(true);
        try {
            if (confirmation.kind === "delete") {
                await apiDelete(`/admin/relationships/${id}`);
                toast.success("Relationship removed successfully");
                navigate({ to: "/relationships" });
                return;
            }

            await apiPatch(`/admin/relationships/${id}/status`, { status: confirmation.nextStatus });
            toast.success("Relationship status updated successfully");
            setConfirmation(null);
            setRefreshKey((prev) => prev + 1);
        } catch (err) {
            toast.error(err.message || "Action failed");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            <PageHeader
                title={`${wholesaler.name || "Wholesaler"} ↔ ${retailer.name || "Retailer"}`}
                description={`Commercial Connection · Created ${date(details?.createdAt)}`}
                action={
                    <div className="flex flex-wrap gap-2">
                        <Button
                            variant="outline"
                            className={details?.status === "blocked" || details?.status === "suspended" ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100" : "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"}
                            onClick={confirmStatusChange}
                        >
                            {details?.status === "blocked" || details?.status === "suspended" ? <CheckCircle2 className="size-4 mr-1.5" /> : <Ban className="size-4 mr-1.5" />}
                            {details?.status === "blocked" || details?.status === "suspended" ? "Connect" : "Suspend"}
                        </Button>
                        <Button variant="outline" onClick={() => setRefreshKey((value) => value + 1)}><RefreshCw /> Refresh</Button>
                        <Button variant="outline" className="border-red-200 bg-red-50 text-red-700 hover:bg-red-100 hover:text-red-800" onClick={confirmDelete}><Trash2 /> Remove</Button>
                        <Button variant="ghost" onClick={() => navigate({ to: "/relationships" })}><ArrowLeft /> Back</Button>
                    </div>
                }
            />

            <div className="flex flex-wrap items-center gap-3">
                <StatusBadge status={statusLabels[details?.status] || details?.status || "Connected"} />
                <span className="text-sm text-muted-foreground">Location: {[retailer.city || wholesaler.city, retailer.state || wholesaler.state].filter(Boolean).join(", ") || "India"}</span>
            </div>

            {/* Entity Navigation Banner */}
            <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex items-center justify-between rounded-xl border bg-card p-4 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <Building2 className="size-5" />
                        </div>
                        <div>
                            <p className="text-xs font-semibold uppercase text-muted-foreground">Connected Wholesaler</p>
                            <h3 className="text-sm font-bold text-foreground">{wholesaler.name || "Wholesaler"}</h3>
                            <p className="text-xs text-muted-foreground">{wholesaler.city ? `${wholesaler.city}, ${wholesaler.state || ""}` : wholesaler.email}</p>
                        </div>
                    </div>
                    {wholesaler.id && (
                        <Button asChild variant="outline" size="sm" className="gap-1 text-xs">
                            <Link to="/wholesalers/$id" params={{ id: wholesaler.id }}>
                                Profile <ExternalLink className="size-3" />
                            </Link>
                        </Button>
                    )}
                </div>

                <div className="flex items-center justify-between rounded-xl border bg-card p-4 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-700">
                            <Store className="size-5" />
                        </div>
                        <div>
                            <p className="text-xs font-semibold uppercase text-muted-foreground">Connected Retailer</p>
                            <h3 className="text-sm font-bold text-foreground">{retailer.name || "Retailer"}</h3>
                            <p className="text-xs text-muted-foreground">{retailer.city ? `${retailer.city}, ${retailer.state || ""}` : retailer.email}</p>
                        </div>
                    </div>
                    {retailer.id && (
                        <Button asChild variant="outline" size="sm" className="gap-1 text-xs">
                            <Link to="/retailers/$id" params={{ id: retailer.id }}>
                                Profile <ExternalLink className="size-3" />
                            </Link>
                        </Button>
                    )}
                </div>
            </div>

            <Tabs defaultValue="overview">
                <TabsList className="flex h-auto justify-start overflow-x-auto bg-transparent p-0">
                    {[
                        ["overview", "Overview"],
                        ["wholesaler", "Wholesaler Details"],
                        ["retailer", "Retailer Details"],
                        ["orders", "Orders History"],
                    ].map(([value, label]) => (
                        <TabsTrigger key={value} value={value} className="rounded-none border-b-2 border-transparent py-3 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary">
                            {label}
                        </TabsTrigger>
                    ))}
                </TabsList>

                <TabsContent value="overview" className="space-y-5">
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                        <KpiCard label="Orders Placed" value={String(metrics.totalOrders || orders.length)} icon={ShoppingBag} />
                        <KpiCard label="Total Trade Value" value={money(metrics.totalTradeValue)} icon={CircleDollarSign} />
                        <KpiCard label="Connection Status" value={statusLabels[details?.status] || "Connected"} icon={Link2} />
                        <KpiCard label="Date Connected" value={date(details?.createdAt)} icon={Calendar} />
                    </div>

                    <div className="grid gap-5 lg:grid-cols-2">
                        <SectionCard
                            title="Wholesaler information"
                            action={
                                wholesaler.id && (
                                    <Button asChild variant="ghost" size="sm" className="h-8 gap-1 text-xs text-primary">
                                        <Link to="/wholesalers/$id" params={{ id: wholesaler.id }}>View Full Profile →</Link>
                                    </Button>
                                )
                            }
                        >
                            <div className="grid gap-2.5 p-4 text-sm sm:grid-cols-2">
                                <p><strong>Business Name:</strong> {wholesaler.name || "—"}</p>
                                <p><strong>Owner Name:</strong> {wholesaler.ownerName || "—"}</p>
                                <p><strong>Email:</strong> {wholesaler.email || "—"}</p>
                                <p><strong>Phone:</strong> {wholesaler.phone || "—"}</p>
                                <p><strong>City:</strong> {wholesaler.city || "—"}</p>
                                <p><strong>State:</strong> {wholesaler.state || "—"}</p>
                                <p><strong>Business Type:</strong> {wholesaler.businessType || "Wholesaler"}</p>
                                <p><strong>GSTIN:</strong> {wholesaler.gstin || "—"}</p>
                            </div>
                        </SectionCard>

                        <SectionCard
                            title="Retailer information"
                            action={
                                retailer.id && (
                                    <Button asChild variant="ghost" size="sm" className="h-8 gap-1 text-xs text-primary">
                                        <Link to="/retailers/$id" params={{ id: retailer.id }}>View Full Profile →</Link>
                                    </Button>
                                )
                            }
                        >
                            <div className="grid gap-2.5 p-4 text-sm sm:grid-cols-2">
                                <p><strong>Business Name:</strong> {retailer.name || "—"}</p>
                                <p><strong>Owner Name:</strong> {retailer.ownerName || "—"}</p>
                                <p><strong>Email:</strong> {retailer.email || "—"}</p>
                                <p><strong>Phone:</strong> {retailer.phone || "—"}</p>
                                <p><strong>City:</strong> {retailer.city || "—"}</p>
                                <p><strong>State:</strong> {retailer.state || "—"}</p>
                                <p><strong>GST Status:</strong> {retailer.gstStatus || "UNREGISTERED"}</p>
                                <p><strong>GSTIN:</strong> {retailer.gstin || "—"}</p>
                            </div>
                        </SectionCard>
                    </div>
                </TabsContent>

                <TabsContent value="wholesaler">
                    <SectionCard title="Wholesaler Business Profile">
                        <div className="grid gap-3 p-5 text-sm sm:grid-cols-2 lg:grid-cols-3">
                            <p><strong>Business Name:</strong> {wholesaler.name || "—"}</p>
                            <p><strong>Contact Owner:</strong> {wholesaler.ownerName || "—"}</p>
                            <p><strong>Email Address:</strong> {wholesaler.email || "—"}</p>
                            <p><strong>Phone Number:</strong> {wholesaler.phone || "—"}</p>
                            <p><strong>City / Location:</strong> {wholesaler.city || "—"}</p>
                            <p><strong>State:</strong> {wholesaler.state || "—"}</p>
                            <p><strong>Business Category:</strong> {wholesaler.businessType || "Wholesaler"}</p>
                            <p><strong>GSTIN:</strong> {wholesaler.gstin || "—"}</p>
                        </div>
                        {wholesaler.id && (
                            <div className="border-t p-4 flex justify-end">
                                <Button asChild variant="default" size="sm">
                                    <Link to="/wholesalers/$id" params={{ id: wholesaler.id }}>
                                        Open Wholesaler Dashboard Page <ExternalLink className="size-3.5 ml-1.5" />
                                    </Link>
                                </Button>
                            </div>
                        )}
                    </SectionCard>
                </TabsContent>

                <TabsContent value="retailer">
                    <SectionCard title="Retailer Business Profile">
                        <div className="grid gap-3 p-5 text-sm sm:grid-cols-2 lg:grid-cols-3">
                            <p><strong>Business Name:</strong> {retailer.name || "—"}</p>
                            <p><strong>Contact Owner:</strong> {retailer.ownerName || "—"}</p>
                            <p><strong>Email Address:</strong> {retailer.email || "—"}</p>
                            <p><strong>Phone Number:</strong> {retailer.phone || "—"}</p>
                            <p><strong>Street Address:</strong> {retailer.street || "—"}</p>
                            <p><strong>City:</strong> {retailer.city || "—"}</p>
                            <p><strong>State:</strong> {retailer.state || "—"}</p>
                            <p><strong>Pincode:</strong> {retailer.pincode || "—"}</p>
                            <p><strong>GST Status:</strong> {retailer.gstStatus || "UNREGISTERED"}</p>
                            <p><strong>GSTIN:</strong> {retailer.gstin || "—"}</p>
                        </div>
                        {retailer.id && (
                            <div className="border-t p-4 flex justify-end">
                                <Button asChild variant="default" size="sm">
                                    <Link to="/retailers/$id" params={{ id: retailer.id }}>
                                        Open Retailer Dashboard Page <ExternalLink className="size-3.5 ml-1.5" />
                                    </Link>
                                </Button>
                            </div>
                        )}
                    </SectionCard>
                </TabsContent>

                <TabsContent value="orders">
                    <SectionCard title="Commercial Orders History" description={`${orders.length} order(s) placed under this connection`}>
                        <SimpleTable
                            headers={["Order No", "Grand Total", "Items", "Order Status", "Payment Status", "Date", "Action"]}
                            rows={orders.map((o) => [
                                `#${o.orderNo || String(o.id).slice(-6)}`,
                                money(o.grandTotal),
                                `${o.itemCount || 1} item(s)`,
                                <StatusBadge key="status" status={o.orderStatus} />,
                                <StatusBadge key="payment" status={o.paymentStatus || "Unpaid"} />,
                                date(o.createdAt),
                                <Button key="link" asChild variant="ghost" size="sm" className="h-8 gap-1 text-xs text-primary">
                                    <Link to="/orders/$id" params={{ id: String(o.id) }}>
                                        View Order <ExternalLink className="size-3" />
                                    </Link>
                                </Button>,
                            ])}
                        />
                    </SectionCard>
                </TabsContent>
            </Tabs>

            <ConfirmationModal
                open={Boolean(confirmation)}
                title={confirmation?.title}
                description={confirmation?.description}
                confirmLabel={confirmation?.kind === "delete" ? "Remove" : "Confirm"}
                variant={confirmation?.kind === "delete" ? "destructive" : "default"}
                onCancel={() => !saving && setConfirmation(null)}
                onConfirm={runConfirmedAction}
            />
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
                            <td className="px-4 py-8 text-muted-foreground" colSpan={headers.length}>No orders found for this relationship.</td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}
