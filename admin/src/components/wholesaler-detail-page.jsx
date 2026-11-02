import { useEffect, useState } from "react";
import { ArrowLeft, Ban, CheckCircle2, Download, FileText, Pencil, RefreshCw, Star, Trash2, XCircle } from "lucide-react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { apiDelete, apiGet, apiGetKycDocument, apiPatch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { ConfirmationModal } from "@/components/ui/confirmation-modal";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KpiCard, PageHeader, SectionCard, StatusBadge } from "@/components/admin-ui";
import toast from "@/components/ui/toast";

const statusLabels = {
    pending: "Pending",
    active: "Active",
    blocked: "Blocked",
    PENDING: "Pending",
    ACTIVE: "Active",
    BLOCKED: "Blocked",
    SUSPENDED: "Rejected",
    SUBMITTED: "Submitted",
    APPROVED: "Approved",
    REJECTED: "Rejected",
};
const money = (value) => `₹${Number(value || 0).toLocaleString("en-IN")}`;
const date = (value) => value ? new Date(value).toLocaleDateString("en-IN") : "—";
const displayName = (user) => user?.businessName || user?.name || "—";
const getDisplayStatus = (profile) => {
    if (profile.status === "BLOCKED") return "Blocked";
    if (profile.status === "SUSPENDED") return "Suspended";
    if (profile.status === "ACTIVE") return "Active";
    return "Pending";
};
const isApproved = (profile) => profile.status === "ACTIVE" && profile.kycStatus === "APPROVED";
const feedbackRating = (ticket) => {
    if (ticket.rating) return ticket.rating;
    return Number(ticket.message?.match(/^\s*Rating:\s*([1-5])\/5/i)?.[1]) || null;
};
const feedbackComment = (ticket) =>
    String(ticket.message || "").replace(/^\s*Rating:\s*[1-5]\/5\s*\n*/i, "").trim() || "—";

export function WholesalerDetailPage() {
    const navigate = useNavigate();
    const { id } = useParams({ strict: false });
    const [details, setDetails] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [reviews, setReviews] = useState([]);
    const [reviewsLoading, setReviewsLoading] = useState(true);
    const [reviewsError, setReviewsError] = useState(null);
    const [feedback, setFeedback] = useState([]);
    const [feedbackLoading, setFeedbackLoading] = useState(true);
    const [feedbackError, setFeedbackError] = useState(null);
    const [openingDocument, setOpeningDocument] = useState("");
    const [refreshKey, setRefreshKey] = useState(0);
    const [confirmation, setConfirmation] = useState(null);
    const [saving, setSaving] = useState(false);
    const [editOpen, setEditOpen] = useState(false);
    const [editForm, setEditForm] = useState({});

    useEffect(() => {
        let mounted = true;
        async function load() {
            setLoading(true);
            setError(null);
            try {
                const response = await apiGet(`/admin/wholesalers/${id}`);
                if (!mounted) return;
                const payload = response?.data || response;
                setDetails(payload || null);
                const userId = payload?.profile?.userId;
                if (!userId) {
                    setReviews([]);
                    setReviewsError("Wholesaler account ID is missing from the profile response.");
                    setFeedback([]);
                    setFeedbackError("Wholesaler account ID is missing from the profile response.");
                    setReviewsLoading(false);
                    setFeedbackLoading(false);
                    return;
                }

                setReviewsLoading(true);
                setReviewsError(null);
                setFeedbackLoading(true);
                setFeedbackError(null);
                const reviewParams = new URLSearchParams({ wholesalerId: userId, page: "1", limit: "100" });
                const feedbackParams = new URLSearchParams({
                    creatorId: userId,
                    role: "WHOLESALER",
                    type: "Feedback",
                    page: "1",
                    limit: "100",
                });
                const [reviewResult, feedbackResult] = await Promise.allSettled([
                    apiGet(`/admin/reviews?${reviewParams.toString()}`),
                    apiGet(`/admin/support/tickets?${feedbackParams.toString()}`),
                ]);
                if (!mounted) return;
                if (reviewResult.status === "fulfilled") {
                    setReviews(Array.isArray(reviewResult.value?.items) ? reviewResult.value.items : []);
                } else {
                    setReviews([]);
                    setReviewsError(reviewResult.reason?.message || "Unable to load wholesaler reviews.");
                }
                if (feedbackResult.status === "fulfilled") {
                    setFeedback(Array.isArray(feedbackResult.value?.items) ? feedbackResult.value.items : []);
                } else {
                    setFeedback([]);
                    setFeedbackError(feedbackResult.reason?.message || "Unable to load submitted feedback.");
                }
            } catch (err) {
                if (!mounted) return;
                setDetails(null);
                setError(err.message || "Unable to load wholesaler details");
            } finally {
                if (mounted) {
                    setLoading(false);
                    setReviewsLoading(false);
                    setFeedbackLoading(false);
                }
            }
        }
        load();
        return () => { mounted = false; };
    }, [id, refreshKey]);

    if (loading) return (
        <div className="space-y-4">
            <Button variant="outline" onClick={() => navigate({ to: "/wholesalers" })}><ArrowLeft /> Back to Wholesalers</Button>
            <div className="rounded-lg border border-dashed bg-card p-8 text-sm text-muted-foreground">Loading wholesaler details...</div>
        </div>
    );
    if (error) return (
        <div className="space-y-4">
            <Button variant="outline" onClick={() => navigate({ to: "/wholesalers" })}><ArrowLeft /> Back to Wholesalers</Button>
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-8 text-sm text-destructive">{error}</div>
        </div>
    );

    const profile = details?.profile || {};
    const address = profile.address || {};
    const pickupAddress = profile.pickupAddress || {};
    const retailers = details?.connectedRetailers || [];
    const products = details?.products || [];
    const orders = details?.recentOrders || [];
    const payments = details?.paymentSummary || [];
    const paymentMetrics = details?.paymentMetrics || {};
    const kycApplication = details?.kycApplication || {};
    const documents = Array.isArray(kycApplication.documents) ? kycApplication.documents : [];
    const registeredAddress = kycApplication.registeredAddress || address;
    const pan = kycApplication.pan || profile.pan || profile.registrationDetails?.pan;

    const openEditModal = () => {
        setEditForm({
            businessName: profile.businessName || profile.company || "",
            name: profile.name || "",
            email: profile.email || "",
            phone: profile.phone || "",
            businessType: profile.businessType || "Proprietorship",
            gstStatus: profile.gstStatus || "UNREGISTERED",
            gstin: profile.gstin || "",
            commissionRate: profile.commissionRate ?? 5,
            street: address.street || profile.streetAddress || "",
            city: address.city || profile.city || "",
            state: address.state || profile.state || "",
            pincode: address.pincode || profile.pincode || "",
        });
        setEditOpen(true);
    };

    const handleSaveEdit = async (e) => {
        e.preventDefault();
        const commissionRate = Number(editForm.commissionRate);
        const normalizedPhone = String(editForm.phone || "").replace(/[\s()-]/g, "");
        if (!Number.isFinite(commissionRate) || commissionRate < 0 || commissionRate > 100) {
            toast.error("Enter a commission rate between 0 and 100.");
            return;
        }
        if (!/^\+?[1-9]\d{7,14}$/.test(normalizedPhone)) {
            toast.error("Enter a valid mobile number.");
            return;
        }
        setSaving(true);
        try {
            await apiPatch(`/admin/wholesalers/${id}`, editForm);
            toast.success("Wholesaler profile updated successfully");
            setEditOpen(false);
            setRefreshKey((value) => value + 1);
        } catch (err) {
            toast.error(err.message || "Unable to update wholesaler profile");
        } finally {
            setSaving(false);
        }
    };

    const confirmStatus = (nextStatus, options = {}) => setConfirmation({
        kind: "status",
        nextStatus,
        kycStatus: options.kycStatus,
        reason: options.reason,
        title: options.title,
        description: options.description,
    });

    const confirmDelete = () => setConfirmation({
        kind: "delete",
        title: "Delete wholesaler?",
        description: "This will soft-delete the wholesaler account and remove it from active management views.",
    });

    const runConfirmedAction = async () => {
        if (!confirmation) return;
        setSaving(true);
        try {
            if (confirmation.kind === "delete") {
                await apiDelete(`/admin/wholesalers/${id}`);
                toast.success("Wholesaler deleted successfully");
                navigate({ to: "/wholesalers" });
                return;
            }

            await apiPatch(`/admin/wholesalers/${id}/status`, {
                status: confirmation.nextStatus,
                kycStatus: confirmation.kycStatus,
                reason: confirmation.reason,
            });
            toast.success("Wholesaler status updated successfully");
            setConfirmation(null);
            setRefreshKey((value) => value + 1);
        } catch (err) {
            toast.error(err.message || "Action failed");
        } finally {
            setSaving(false);
        }
    };

    const displayStatus = getDisplayStatus(profile);
    const kycStatusLabel = statusLabels[profile.kycStatus] || profile.kycStatus;
    const downloadDocument = async (document) => {
        const documentId = String(document?._id || document?.id || "");
        if (!documentId || openingDocument) return;
        setOpeningDocument(documentId);
        try {
            const blob = await apiGetKycDocument(documentId);
            const url = URL.createObjectURL(blob);
            const link = window.document.createElement("a");
            link.href = url;
            link.download = document.originalName || document.documentType || "verification-document";
            link.click();
            window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch (err) {
            toast.error(err.message || "Unable to download verification document");
        } finally {
            setOpeningDocument("");
        }
    };

    return (
        <div className="space-y-6">
            <PageHeader
                title={profile.businessName || profile.company || profile.name || "Wholesaler"}
                description={`${profile.city || ""}${profile.state ? `, ${profile.state}` : ""} · Registered ${date(profile.createdAt)}`}
                action={
                    <div className="flex flex-wrap gap-2">
                        <Button variant="outline" onClick={openEditModal} className="border-primary/30 bg-primary/5 text-primary hover:bg-primary/10">
                            <Pencil className="size-4 mr-1.5" /> Edit
                        </Button>
                        {!isApproved(profile) && (
                            <Button
                                className="bg-emerald-600 text-white hover:bg-emerald-700"
                                onClick={() => confirmStatus("ACTIVE", {
                                    kycStatus: "APPROVED",
                                    title: "Approve wholesaler?",
                                    description: "This wholesaler will be approved and allowed to log in.",
                                })}
                            >
                                <CheckCircle2 /> Approve
                            </Button>
                        )}
                        <Button
                            variant="outline"
                            className="border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 hover:text-amber-800"
                            onClick={() => confirmStatus("SUSPENDED", {
                                kycStatus: "REJECTED",
                                reason: "Rejected by admin",
                                title: "Reject wholesaler?",
                                description: "This registration will be rejected and login will remain blocked.",
                            })}
                        >
                            <XCircle /> Reject
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => confirmStatus("BLOCKED", {
                                reason: "Blocked by admin",
                                title: "Block wholesaler?",
                                description: "This wholesaler will be blocked from logging in or operating.",
                            })}
                        >
                            <Ban /> Block
                        </Button>
                        <Button variant="outline" onClick={() => setRefreshKey((value) => value + 1)}><RefreshCw /> Refresh</Button>
                        <Button variant="outline" className="border-red-200 bg-red-50 text-red-700 hover:bg-red-100 hover:text-red-800" onClick={confirmDelete}><Trash2 /> Delete</Button>
                        <Button variant="outline" onClick={() => navigate({ to: "/wholesalers" })}><ArrowLeft /> Back to Wholesalers</Button>
                    </div>
                }
            />
            <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card px-4 py-3">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Wholesaler ID</span>
                <code className="break-all rounded bg-muted px-2 py-1 text-xs">{profile.id || id}</code>
            </div>
            <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={displayStatus} />
                <span className="text-xs font-medium text-muted-foreground">KYC</span>
                <StatusBadge status={kycStatusLabel || "Not submitted"} />
            </div>
            <Tabs defaultValue="overview">
                <TabsList className="flex h-auto justify-start overflow-x-auto bg-transparent p-0">
                    {[["overview", "Overview"], ["retailers", "Retailers"], ["products", "Products"], ["orders", "Orders"], ["payments", "Payments"], ["reviews", "Reviews"], ["feedback", "Submitted feedback"]].map(([value, label]) => <TabsTrigger key={value} value={value} className="whitespace-nowrap rounded-none border-b-2 border-transparent py-3 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary">{label}</TabsTrigger>)}
                </TabsList>
                <TabsContent value="overview" className="space-y-5">
                    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                        <KpiCard label="Associated retailers" value={String(details?.metrics?.connectedRetailers ?? retailers.length)} />
                        <KpiCard label="Products" value={String(details?.metrics?.totalProducts ?? products.length)} />
                        <KpiCard label="Categories" value={String(details?.metrics?.totalCategories || 0)} />
                        <KpiCard label="Total orders" value={String(details?.metrics?.totalOrders || 0)} />
                    </div>
                    <SectionCard
                        title="Business and contact information"
                        description="Registered account and primary contact details"
                        action={
                            <Button variant="outline" size="sm" onClick={openEditModal} className="h-8 gap-1.5 text-xs">
                                <Pencil className="size-3.5" /> Edit Profile
                            </Button>
                        }
                    >
                        <div className="grid gap-3 p-5 text-sm sm:grid-cols-2 lg:grid-cols-3">
                            <p className="break-words"><strong>Wholesaler ID:</strong> {profile.id || id}</p>
                            <p><strong>Owner:</strong> {profile.name || "—"}</p>
                            <p><strong>Business:</strong> {profile.businessName || profile.company || "—"}</p>
                            <p><strong>Email:</strong> {profile.email || "—"}</p>
                            <p><strong>Phone:</strong> {profile.phone || "—"}</p>
                            <p><strong>Business type:</strong> {profile.businessType || "—"}</p>
                            <p><strong>GST status:</strong> {profile.gstStatus || "—"}</p>
                            <p><strong>GSTIN:</strong> {profile.gstin || "—"}</p>
                            <p><strong>PAN:</strong> {pan || "—"}</p>
                            <p><strong>Registration date:</strong> {date(profile.createdAt)}</p>
                            <p><strong>Verified:</strong> {profile.isVerified ? "Yes" : "No"}</p>
                        </div>
                    </SectionCard>
                    <SectionCard title="Registered business address">
                        <div className="grid gap-3 p-5 text-sm sm:grid-cols-2 lg:grid-cols-4">
                            <p className="break-words"><strong>Street:</strong> {registeredAddress.street || profile.streetAddress || "—"}</p>
                            <p><strong>City:</strong> {registeredAddress.city || profile.city || "—"}</p>
                            <p><strong>State:</strong> {registeredAddress.state || profile.state || "—"}</p>
                            <p><strong>Pincode:</strong> {registeredAddress.pincode || profile.pincode || "—"}</p>
                        </div>
                    </SectionCard>
                    <SectionCard title="KYC verification" description={`Application status: ${statusLabels[kycApplication.status] || kycApplication.status || kycStatusLabel || "Not submitted"}`}>
                        <div className="space-y-4 p-5">
                            <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                                <p><strong>PAN:</strong> {pan || "—"}</p>
                                <p><strong>GSTIN:</strong> {kycApplication.gstin || profile.gstin || "—"}</p>
                                <p><strong>GST registered:</strong> {kycApplication.hasGst ? "Yes" : "No"}</p>
                                <p><strong>Submitted:</strong> {date(kycApplication.submittedAt)}</p>
                            </div>
                            {kycApplication.reviewNote && <p className="break-words rounded-md bg-muted/50 p-3 text-sm"><strong>Review note:</strong> {kycApplication.reviewNote}</p>}
                            <div>
                                <h4 className="mb-2 text-sm font-semibold">Uploaded verification documents</h4>
                                {documents.length ? (
                                    <ul className="grid gap-2 sm:grid-cols-2">
                                        {documents.map((document) => {
                                            const documentId = String(document._id || document.id || "");
                                            return (
                                                <li key={documentId || document.originalName} className="flex min-w-0 items-center justify-between gap-3 rounded-lg border p-3">
                                                    <div className="flex min-w-0 items-center gap-2">
                                                        <FileText className="size-4 shrink-0 text-muted-foreground" />
                                                        <div className="min-w-0">
                                                            <p className="break-words text-sm font-medium">{document.documentType?.replaceAll("_", " ") || "Verification document"}</p>
                                                            <p className="break-all text-xs text-muted-foreground">{document.originalName || "Uploaded file"}</p>
                                                        </div>
                                                        <StatusBadge status={document.isVerified ? "Verified" : "Pending"} />
                                                    </div>
                                                    <Button variant="outline" size="sm" className="shrink-0" disabled={!documentId || openingDocument === documentId} onClick={() => downloadDocument(document)}>
                                                        <Download /> {openingDocument === documentId ? "Loading" : "Download"}
                                                    </Button>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                ) : <p className="text-sm text-muted-foreground">No verification documents uploaded.</p>}
                            </div>
                        </div>
                    </SectionCard>
                    <SectionCard title="Pickup address">
                        <div className="grid gap-3 p-5 text-sm sm:grid-cols-2 lg:grid-cols-4">
                            <p><strong>Same as business:</strong> {pickupAddress.sameAsBusinessAddress ? "Yes" : "No"}</p>
                            <p className="break-words"><strong>Street:</strong> {pickupAddress.street || "—"}</p>
                            <p><strong>City:</strong> {pickupAddress.city || "—"}</p>
                            <p><strong>State:</strong> {pickupAddress.state || "—"}</p>
                            <p><strong>Pincode:</strong> {pickupAddress.pincode || "—"}</p>
                        </div>
                    </SectionCard>
                    <SectionCard title="Orders and payments" description="Financial totals are calculated from wholesaler-linked records">
                        <div className="grid grid-cols-2 gap-3 p-5 lg:grid-cols-4">
                            <KpiCard label="Orders" value={String(details?.metrics?.totalOrders || 0)} />
                            <KpiCard label="Gross sales" value={money(details?.metrics?.earnings?.totalGross)} />
                            <KpiCard label="Payment transactions" value={String(paymentMetrics.totalCount || 0)} />
                            <KpiCard label="Paid amount" value={money(paymentMetrics.paidAmount)} />
                        </div>
                    </SectionCard>
                </TabsContent>
                <TabsContent value="retailers"><SectionCard title="Connected retailers" description={`${retailers.length} linked records`}><SimpleTable headers={["Retailer", "Email", "Phone", "Status", "Connected"]} rows={retailers.map((retailer) => [displayName(retailer), retailer.email || "—", retailer.phone || "—", <StatusBadge key="status" status={statusLabels[retailer.status] || retailer.status} />, date(retailer.createdAt)])} /></SectionCard></TabsContent>
                <TabsContent value="products"><SectionCard title="Products" description={`${details?.metrics?.totalProducts ?? products.length} products across ${details?.metrics?.totalCategories || 0} categories; latest ${products.length} shown`}><SimpleTable headers={["Product", "SKU", "Category", "Price", "Stock", "Status"]} rows={products.map((product) => [product.name || "—", product.sku || "—", product.category?.name || "—", money(product.wholesalePrice), product.quantity ?? product.stockQuantity ?? product.stock ?? 0, <StatusBadge key="status" status={statusLabels[product.status] || product.status} />])} /></SectionCard></TabsContent>
                <TabsContent value="orders"><SectionCard title="Recent orders" description={`Latest ${orders.length} of ${details?.metrics?.totalOrders || 0} orders for this wholesaler`}><SimpleTable headers={["Order", "Retailer", "Amount", "Status", "Payment", "Date"]} rows={orders.map((order) => [`#${order.orderNumber || order.orderNo || order.id}`, displayName(order.retailer), money(order.totalAmount ?? order.grandTotal), <StatusBadge key="status" status={statusLabels[order.orderStatus || order.status] || order.orderStatus || order.status} />, <StatusBadge key="payment" status={order.paymentStatus || "Unpaid"} />, date(order.createdAt)])} /></SectionCard></TabsContent>
                <TabsContent value="payments"><SectionCard title="Payment summary" description={`${paymentMetrics.totalCount || 0} payment records · ${money(paymentMetrics.totalAmount)} total`}><div className="grid grid-cols-2 gap-3 p-5 lg:grid-cols-3"><KpiCard label="Paid" value={money(paymentMetrics.paidAmount)} /><KpiCard label="Pending / processing" value={money(paymentMetrics.pendingAmount)} /><KpiCard label="Total payments" value={String(paymentMetrics.totalCount || 0)} /></div><SimpleTable headers={["Order", "Method", "Reference", "Status", "Amount", "Date"]} rows={payments.map((payment) => [payment.order?.orderNumber || payment.orderId?.orderNumber || "—", payment.paymentMethod || "—", payment.transactionReference || "—", <StatusBadge key="status" status={payment.status} />, money(payment.amount), date(payment.createdAt)])} /></SectionCard></TabsContent>
                <TabsContent value="reviews">
                    <SectionCard title="Wholesaler reviews" description="Reviews associated with this wholesaler's account">
                        {reviewsLoading ? <div className="p-6 text-sm text-muted-foreground">Loading reviews...</div> : reviewsError ? <div className="p-6 text-sm text-destructive">{reviewsError}</div> : (
                            <SimpleTable
                                headers={["Reviewer", "Reviewer details", "Related wholesaler", "Rating", "Comment", "Status", "Date"]}
                                rows={reviews.map((review) => [
                                    review.reviewer?.name || "Anonymous",
                                    [review.reviewer?.email, review.reviewer?.phone].filter(Boolean).join(" · ") || "—",
                                    review.wholesaler?.name || profile.businessName || profile.name || "—",
                                    <span key="rating" className="inline-flex items-center gap-1 text-amber-600"><Star className="size-4 fill-current" /> {review.rating || 0}/5</span>,
                                    <span key="comment" className="block min-w-[180px] whitespace-normal break-words">{review.comment || "—"}</span>,
                                    <StatusBadge key="status" status={review.status || "pending"} />,
                                    date(review.createdAt),
                                ])}
                            />
                        )}
                    </SectionCard>
                </TabsContent>
                <TabsContent value="feedback">
                    <SectionCard title="Submitted feedback" description="Feedback tickets submitted by this wholesaler">
                        {feedbackLoading ? <div className="p-6 text-sm text-muted-foreground">Loading submissions...</div> : feedbackError ? <div className="p-6 text-sm text-destructive">{feedbackError}</div> : (
                            <SimpleTable
                                headers={["Subject", "Rating", "Comment", "Status", "Submitted"]}
                                rows={feedback.map((ticket) => [
                                    <span key="subject" className="block min-w-[150px] whitespace-normal break-words font-medium">{ticket.subject || "Feedback"}</span>,
                                    <span key="rating" className="inline-flex items-center gap-1 text-amber-600">{feedbackRating(ticket) ? <><Star className="size-4 fill-current" /> {feedbackRating(ticket)}/5</> : "—"}</span>,
                                    <span key="comment" className="block min-w-[220px] whitespace-normal break-words">{feedbackComment(ticket)}</span>,
                                    <StatusBadge key="status" status={ticket.status || "Open"} />,
                                    date(ticket.createdAt),
                                ])}
                            />
                        )}
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
            {editOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-lg rounded-xl border bg-card p-6 shadow-xl max-h-[90vh] overflow-y-auto space-y-4">
                        <div className="flex items-center justify-between border-b pb-3">
                            <h3 className="text-lg font-bold">Edit Wholesaler Profile</h3>
                            <button type="button" className="text-muted-foreground hover:text-foreground text-lg font-bold" onClick={() => !saving && setEditOpen(false)}>✕</button>
                        </div>
                        <form onSubmit={handleSaveEdit} className="space-y-4 text-sm">
                            <div className="grid gap-3 sm:grid-cols-2">
                                <div>
                                    <label className="text-xs font-semibold text-muted-foreground">Business Name</label>
                                    <input className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm" value={editForm.businessName || ""} onChange={(e) => setEditForm(f => ({ ...f, businessName: e.target.value }))} required />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-muted-foreground">Owner Name</label>
                                    <input className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm" value={editForm.name || ""} onChange={(e) => setEditForm(f => ({ ...f, name: e.target.value }))} required />
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
                                    <select className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm" value={editForm.businessType || ""} onChange={(e) => setEditForm(f => ({ ...f, businessType: e.target.value }))}>
                                        <option value="Proprietorship">Proprietorship</option>
                                        <option value="Partnership">Partnership</option>
                                        <option value="Pvt Ltd">Pvt Ltd</option>
                                        <option value="LLP">LLP</option>
                                        <option value="Individual">Individual</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-muted-foreground">Commission (%)</label>
                                    <input type="number" step="0.1" className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm" value={editForm.commissionRate ?? ""} onChange={(e) => setEditForm(f => ({ ...f, commissionRate: e.target.value }))} />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-muted-foreground">GST Status</label>
                                    <select className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm" value={editForm.gstStatus || ""} onChange={(e) => setEditForm(f => ({ ...f, gstStatus: e.target.value }))}>
                                        <option value="REGISTERED">REGISTERED</option>
                                        <option value="UNREGISTERED">UNREGISTERED</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-muted-foreground">GSTIN</label>
                                    <input className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm" value={editForm.gstin || ""} onChange={(e) => setEditForm(f => ({ ...f, gstin: e.target.value }))} placeholder="e.g. 08AAAAA0000A1Z5" />
                                </div>
                            </div>
                            <div className="border-t pt-3">
                                <h4 className="text-xs font-bold text-foreground mb-2">Registered Address</h4>
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <div>
                                        <label className="text-xs font-semibold text-muted-foreground">Street Address</label>
                                        <input className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm" value={editForm.street || ""} onChange={(e) => setEditForm(f => ({ ...f, street: e.target.value }))} />
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-muted-foreground">City</label>
                                        <input className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm" value={editForm.city || ""} onChange={(e) => setEditForm(f => ({ ...f, city: e.target.value }))} />
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-muted-foreground">State</label>
                                        <input className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm" value={editForm.state || ""} onChange={(e) => setEditForm(f => ({ ...f, state: e.target.value }))} />
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
        </div>
    );
}

function SimpleTable({ headers, rows }) {
    return <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b bg-muted/40">{headers.map((header) => <th key={header} className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">{header}</th>)}</tr></thead><tbody>{rows.length ? rows.map((row, index) => <tr key={index} className="border-b last:border-0">{row.map((cell, cellIndex) => <td key={cellIndex} className="whitespace-nowrap px-4 py-3">{cell}</td>)}</tr>) : <tr><td className="px-4 py-8 text-muted-foreground" colSpan={headers.length}>No records found.</td></tr>}</tbody></table></div>;
}
