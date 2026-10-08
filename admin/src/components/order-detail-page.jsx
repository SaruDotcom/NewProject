import { useEffect, useState } from "react";
import { ArrowLeft, CircleDollarSign, ClipboardList, Download, RefreshCw, Store, Users } from "lucide-react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { toast } from "sonner";
import { apiGet, apiPatch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { ConfirmationModal } from "@/components/ui/confirmation-modal";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KpiCard, PageHeader, SectionCard, StatusBadge } from "@/components/admin-ui";

const statusLabels = { pending: "Pending", confirmed: "Processing", shipped: "Shipped", out_for_delivery: "Out for delivery", delivered: "Delivered", delayed: "Delayed", cancelled: "Cancelled" };
const money = (value) => `₹${Number(value || 0).toLocaleString("en-IN")}`;
const date = (value) => value ? new Date(value).toLocaleString("en-IN") : "—";
const displayName = (user) => user?.businessName || user?.company || user?.name || "—";

export function downloadOrderInvoice(details) {
    const order = details?.order || details;
    if (!order) return;
    const lines = [
        `INVOICE #${order.orderNo || "-"}`,
        `Retailer: ${displayName(order.retailer)}`,
        `Wholesaler: ${displayName(order.wholesaler)}`,
        `Date: ${date(order.createdAt)}`,
        "",
        "Product                         Qty       Price       Total",
        ...(order.items || []).map((item) => `${item.product?.name || "Product"}                         ${item.quantity || 0}       ${money(item.pricePerUnit)}       ${money(item.totalPrice)}`),
        "",
        `TOTAL: ${money(order.totalAmount)}`,
    ];
    const pdf = createPdf(lines);
    const url = URL.createObjectURL(new Blob([pdf], { type: "application/pdf" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `invoice-${order.orderNo || "order"}.pdf`;
    link.click();
    URL.revokeObjectURL(url);
}

export function downloadPaymentReceipt(details) {
    const payment = details?.payment || details;
    if (!payment) return;
    const order = payment.order || {};
    const lines = [
        `PAYMENT RECEIPT ${payment.transactionRef || payment._id || "-"}`,
        `Order: ${order.orderNo || "-"}`,
        `Retailer: ${displayName(order.retailer)}`,
        `Wholesaler: ${displayName(order.wholesaler)}`,
        `Amount: ${money(payment.amount)}`,
        `Method: ${payment.method || "-"}`,
        `Status: ${payment.status || "-"}`,
        `Date: ${date(payment.createdAt)}`,
        payment.refundedAmount ? `Refunded: ${money(payment.refundedAmount)}` : "",
    ];
    const url = URL.createObjectURL(new Blob([createPdf(lines)], { type: "application/pdf" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `receipt-${payment.transactionRef || payment._id || "payment"}.pdf`;
    link.click();
    URL.revokeObjectURL(url);
}

function pdfText(value) {
    return String(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)").replace(/[^\x20-\x7E]/g, "");
}

function createPdf(lines) {
    const content = ["BT", "/F1 10 Tf", "50 760 Td", ...lines.flatMap((line, index) => [index ? "0 -16 Td" : "", `(${pdfText(line)}) Tj`]), "ET"].filter(Boolean).join("\n");
    const objects = [
        "<< /Type /Catalog /Pages 2 0 R >>",
        "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
        `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ];
    let output = "%PDF-1.4\n";
    const offsets = [0];
    objects.forEach((object, index) => {
        offsets.push(output.length);
        output += `${index + 1} 0 obj\n${object}\nendobj\n`;
    });
    const xrefOffset = output.length;
    output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    offsets.slice(1).forEach((offset) => { output += `${String(offset).padStart(10, "0")} 00000 n \n`; });
    output += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
    return output;
}

export function OrderDetailPage() {
    const navigate = useNavigate();
    const { id } = useParams({ strict: false });
    const [details, setDetails] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [refreshKey, setRefreshKey] = useState(0);
    const [statusDialog, setStatusDialog] = useState(false);
    const [selectedStatus, setSelectedStatus] = useState("");
    const [note, setNote] = useState("");
    const [cancelOpen, setCancelOpen] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);

    useEffect(() => {
        let mounted = true;
        async function load() {
            setLoading(true);
            setError(null);
            try {
                const response = await apiGet(`/admin/orders/${id}`);
                if (mounted) setDetails(response || null);
            } catch (err) {
                if (mounted) { setDetails(null); setError(err.message || "Unable to load order details"); }
            } finally {
                if (mounted) setLoading(false);
            }
        }
        load();
        return () => { mounted = false; };
    }, [id, refreshKey]);

    if (loading) return <div className="rounded-lg border border-dashed bg-card p-8 text-sm text-muted-foreground">Loading order details...</div>;
    if (error) return <div className="space-y-4"><Button variant="ghost" onClick={() => navigate({ to: "/orders" })}><ArrowLeft /> Back</Button><div className="rounded-lg border border-destructive/30 bg-destructive/5 p-8 text-sm text-destructive">{error}</div></div>;

    const order = details?.order || {};
    const items = order.items || [];
    const payments = details?.payments || [];
    const timeline = details?.timeline || [];
    const allowedTransitions = details?.allowedTransitions || [];
    const updateStatus = async (nextStatus) => {
        setActionLoading(true);
        try {
            await apiPatch(`/admin/orders/${id}/status`, { status: nextStatus, note });
            toast.success(`Order status updated to ${statusLabels[nextStatus] || nextStatus}`);
            setStatusDialog(false);
            setCancelOpen(false);
            setNote("");
            setSelectedStatus("");
            setRefreshKey((value) => value + 1);
        } catch (err) {
            toast.error(err.message || "Unable to update order status");
        } finally { setActionLoading(false); }
    };

    return <div className="space-y-6">
        <PageHeader title={`Order #${order.orderNo || "—"}`} description={`${displayName(order.retailer)} · ${date(order.createdAt)}`} action={<div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => downloadOrderInvoice(details)}><Download /> Download Invoice</Button><Button variant="outline" onClick={() => setRefreshKey((value) => value + 1)}><RefreshCw /> Refresh</Button><Button variant="ghost" onClick={() => navigate({ to: "/orders" })}><ArrowLeft /> Back</Button></div>} />
        <div className="flex items-center gap-2"><StatusBadge status={statusLabels[order.status] || order.status} /><span className="text-sm text-muted-foreground">Payment: {order.paymentStatus || "unpaid"}</span></div>
        <div className="flex flex-wrap gap-2"><Button onClick={() => setStatusDialog(true)} disabled={!allowedTransitions.length}>Update Status</Button><Button variant="destructive" onClick={() => setCancelOpen(true)} disabled={!allowedTransitions.includes("cancelled")}>Cancel Order</Button></div>
        <Tabs defaultValue="overview">
            <TabsList className="flex h-auto justify-start overflow-x-auto bg-transparent p-0">{[["overview", "Overview"], ["items", "Items"], ["payments", "Payments"], ["timeline", "Status Timeline"]].map(([value, label]) => <TabsTrigger key={value} value={value} className="rounded-none border-b-2 border-transparent py-3 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary">{label}</TabsTrigger>)}</TabsList>
            <TabsContent value="overview" className="space-y-5"><div className="grid grid-cols-2 gap-3 md:grid-cols-4"><KpiCard label="Items" value={String(details?.totals?.itemsCount || 0)} icon={ClipboardList} /><KpiCard label="Quantity" value={String(details?.totals?.totalQuantity || 0)} icon={Users} /><KpiCard label="Total" value={money(order.totalAmount)} icon={CircleDollarSign} /><KpiCard label="Retailer" value={displayName(order.retailer)} icon={Store} /></div><div className="grid gap-5 lg:grid-cols-2"><SectionCard title="Retailer"><InfoGrid user={order.retailer} /></SectionCard><SectionCard title="Wholesaler"><InfoGrid user={order.wholesaler} /></SectionCard></div></TabsContent>
            <TabsContent value="items"><SectionCard title="Order items" description={`${items.length} line items`}><SimpleTable headers={["Product", "SKU", "Qty", "Price", "Total"]} rows={items.map((item) => [item.product?.name || "—", item.product?.sku || "—", item.quantity, money(item.pricePerUnit), money(item.totalPrice)])} /></SectionCard></TabsContent>
            <TabsContent value="payments"><SectionCard title="Payment information" description={`${payments.length} payment records`}><SimpleTable headers={["Amount", "Method", "Status", "Transaction", "Date"]} rows={payments.map((payment) => [money(payment.amount), payment.method || "—", <StatusBadge key="status" status={payment.status} />, payment.transactionRef || "—", date(payment.createdAt)])} /></SectionCard></TabsContent>
            <TabsContent value="timeline"><SectionCard title="Status timeline" description="Every recorded order status change"><SimpleTable headers={["Status", "Changed by", "Note", "Date"]} rows={timeline.map((entry) => [<StatusBadge key="status" status={statusLabels[entry.status] || entry.status} />, entry.changedBy?.name || "System", entry.note || "—", date(entry.createdAt)])} /></SectionCard></TabsContent>
        </Tabs>
        <Dialog open={statusDialog} onOpenChange={(open) => !open && !actionLoading && setStatusDialog(false)}><DialogContent><DialogHeader><DialogTitle>Update order status</DialogTitle><DialogDescription>Only valid next statuses are available for this order.</DialogDescription></DialogHeader><Select value={selectedStatus} onValueChange={setSelectedStatus}><SelectTrigger><SelectValue placeholder="Select next status" /></SelectTrigger><SelectContent>{allowedTransitions.map((value) => <SelectItem key={value} value={value}>{statusLabels[value] || value}</SelectItem>)}</SelectContent></Select><Textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optional note" /><DialogFooter><Button variant="outline" onClick={() => setStatusDialog(false)} disabled={actionLoading}>Cancel</Button><Button onClick={() => updateStatus(selectedStatus)} disabled={!selectedStatus || actionLoading}>{actionLoading ? "Updating..." : "Update status"}</Button></DialogFooter></DialogContent></Dialog>
        <ConfirmationModal open={cancelOpen} title="Cancel order?" description="This records a cancellation in the order status timeline. It cannot be reversed." confirmLabel="Cancel order" variant="destructive" onCancel={() => !actionLoading && setCancelOpen(false)} onConfirm={() => updateStatus("cancelled")} />
    </div>;
}

function InfoGrid({ user }) { return <div className="grid gap-3 p-5 text-sm sm:grid-cols-2"><p><strong>Business:</strong> {displayName(user)}</p><p><strong>Name:</strong> {user?.name || "—"}</p><p><strong>Email:</strong> {user?.email || "—"}</p><p><strong>Phone:</strong> {user?.phone || "—"}</p><p><strong>Location:</strong> {[user?.city, user?.state].filter(Boolean).join(", ") || "—"}</p></div>; }
function SimpleTable({ headers, rows }) { return <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b bg-muted/40">{headers.map((header) => <th key={header} className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">{header}</th>)}</tr></thead><tbody>{rows.length ? rows.map((row, index) => <tr key={index} className="border-b last:border-0">{row.map((cell, cellIndex) => <td key={cellIndex} className="whitespace-nowrap px-4 py-3">{cell}</td>)}</tr>) : <tr><td className="px-4 py-8 text-muted-foreground" colSpan={headers.length}>No records found.</td></tr>}</tbody></table></div>; }
