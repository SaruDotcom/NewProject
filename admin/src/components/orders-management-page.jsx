import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, FileSpreadsheet, MoreHorizontal, Printer, Search } from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ConfirmationModal } from "@/components/ui/confirmation-modal";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader, StatusBadge } from "@/components/admin-ui";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiGet, apiPatch } from "@/lib/api";
import { adminQueryKeys } from "@/lib/query-client";
import { toast } from "sonner";
import { downloadOrderInvoice } from "@/components/order-detail-page";

const statusLabels = { pending: "Pending", confirmed: "Processing", shipped: "Shipped", out_for_delivery: "Out for delivery", delivered: "Delivered", delayed: "Delayed", cancelled: "Cancelled" };
const paymentLabels = { unpaid: "Unpaid", paid: "Paid", partial: "Partial" };
const columns = [["orderNo", "Order ID"], ["retailer", "Retailer"], ["wholesaler", "Wholesaler"], ["itemsCount", "Items"], ["totalAmount", "Total amount"], ["paymentStatus", "Payment"], ["status", "Status"], ["createdAt", "Date"]];
const initialResult = { items: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 1 }, filters: { wholesalers: [], retailers: [] } };

export function OrdersManagementPage() {
    const navigate = useNavigate();
    const [search, setSearch] = useState("");
    const debouncedSearch = useDebounce(search, 350);
    const [status, setStatus] = useState("all");
    const [paymentStatus, setPaymentStatus] = useState("all");
    const [wholesaler, setWholesaler] = useState("all");
    const [retailer, setRetailer] = useState("all");
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");
    const [minAmount, setMinAmount] = useState("");
    const [maxAmount, setMaxAmount] = useState("");
    const [sortBy, setSortBy] = useState("createdAt");
    const [sortOrder, setSortOrder] = useState("desc");
    const [page, setPage] = useState(1);
    const [cancelOrder, setCancelOrder] = useState(null);
    const [actionLoading, setActionLoading] = useState(false);
    const params = new URLSearchParams({ page: String(page), limit: "10", sortBy, sortOrder });
    if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
    if (status !== "all") params.set("status", status);
    if (paymentStatus !== "all") params.set("paymentStatus", paymentStatus);
    if (wholesaler !== "all") params.set("wholesaler", wholesaler);
    if (retailer !== "all") params.set("retailer", retailer);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    if (minAmount) params.set("minAmount", minAmount);
    if (maxAmount) params.set("maxAmount", maxAmount);
    const listPath = `/admin/orders?${params.toString()}`;
    const ordersQuery = useQuery({
        queryKey: adminQueryKeys.collection("orders", listPath),
        queryFn: async () => {
            const payload = await apiGet(listPath);
            const items = Array.isArray(payload) ? payload : (payload?.items || payload?.data || []);
            const pagination = payload?.pagination || payload?.meta || { page: 1, limit: 10, total: items.length, totalPages: Math.ceil(items.length / 10) || 1 };
            return { items, pagination, filters: payload?.filters || initialResult.filters };
        },
    });
    const result = ordersQuery.data || initialResult;
    const loading = ordersQuery.isLoading;
    const error = ordersQuery.error?.message || null;

    useEffect(() => {
        setPage(1);
    }, [debouncedSearch, status, paymentStatus, wholesaler, retailer, dateFrom, dateTo, minAmount, maxAmount]);

    const toggleSort = (key) => {
        if (sortBy === key) setSortOrder((current) => current === "asc" ? "desc" : "asc");
        else { setSortBy(key); setSortOrder("asc"); }
        setPage(1);
    };
    const updateFilter = (setter) => (value) => { setter(value); setPage(1); };
    const formatCurrency = (value) => `₹${Number(value || 0).toLocaleString("en-IN")}`;
    const formatDate = (value) => value ? new Date(value).toLocaleDateString("en-IN") : "—";
    const pages = Math.max(1, result.pagination.totalPages || 1);
    const filters = result.filters || initialResult.filters;
    const cancelSelectedOrder = async () => {
        if (!cancelOrder) return;
        setActionLoading(true);
        try {
            await apiPatch(`/admin/orders/${cancelOrder.id}/status`, { status: "cancelled", note: "Cancelled by admin" });
            toast.success(`Order #${cancelOrder.orderNo} cancelled successfully`);
            setCancelOrder(null);
        } catch (err) {
            toast.error(err.message || "Unable to cancel order");
        } finally { setActionLoading(false); }
    };
    const downloadInvoice = async (row) => {
        try {
            const details = await apiGet(`/admin/orders/${row.id}`);
            downloadOrderInvoice(details);
            toast.success(`Invoice for #${row.orderNo} downloaded`);
        } catch (err) { toast.error(err.message || "Unable to download invoice"); }
    };
    const buildQuery = (requestedPage = page, requestedLimit = 10) => {
        const params = new URLSearchParams({ page: String(requestedPage), limit: String(requestedLimit), sortBy, sortOrder });
        if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
        if (status !== "all") params.set("status", status);
        if (paymentStatus !== "all") params.set("paymentStatus", paymentStatus);
        if (wholesaler !== "all") params.set("wholesaler", wholesaler);
        if (retailer !== "all") params.set("retailer", retailer);
        if (dateFrom) params.set("dateFrom", dateFrom);
        if (dateTo) params.set("dateTo", dateTo);
        if (minAmount) params.set("minAmount", minAmount);
        if (maxAmount) params.set("maxAmount", maxAmount);
        return params;
    };
    const exportCsv = async () => {
        try {
            const rows = [];
            let exportPage = 1;
            let totalPages = 1;
            do {
                const payload = await apiGet(`/admin/orders?${buildQuery(exportPage, 100).toString()}`);
                rows.push(...(payload?.items || []));
                totalPages = payload?.pagination?.totalPages || 1;
                exportPage += 1;
            } while (exportPage <= totalPages);
            const escape = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
            const csv = [
                ["Order ID", "Retailer", "Wholesaler", "Items", "Total Amount", "Payment Status", "Order Status", "Date"],
                ...rows.map((row) => [row.orderNo, row.retailer?.businessName || row.retailer?.name, row.wholesaler?.businessName || row.wholesaler?.name, row.itemsCount, row.totalAmount, row.paymentStatus, row.status, row.createdAt]),
            ].map((row) => row.map(escape).join(",")).join("\r\n");
            const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
            const link = document.createElement("a");
            link.href = url;
            link.download = "orders-export.csv";
            link.click();
            URL.revokeObjectURL(url);
            toast.success(`${rows.length} filtered order${rows.length === 1 ? "" : "s"} exported`);
        } catch (err) { toast.error(err.message || "Unable to export orders"); }
    };
    const printOrders = () => window.print();

    return (
        <div className="space-y-6">
            <PageHeader title="Order Management" description="Track every order from placement to delivery across the marketplace." action={<div className="flex flex-wrap gap-2"><Button variant="outline" onClick={exportCsv}><FileSpreadsheet /> Export CSV</Button><Button variant="outline" onClick={printOrders}><Printer /> Print</Button></div>} />
            <section className="admin-card overflow-hidden">
                <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center lg:flex-wrap">
                    <div className="relative min-w-56 flex-1"><Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search order ID, retailer, or wholesaler..." className="pl-9 shadow-none" /></div>
                    <Select value={status} onValueChange={updateFilter(setStatus)}><SelectTrigger className="w-full lg:w-40"><SelectValue placeholder="Order status" /></SelectTrigger><SelectContent><SelectItem value="all">All order statuses</SelectItem>{Object.entries(statusLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select>
                    <Select value={paymentStatus} onValueChange={updateFilter(setPaymentStatus)}><SelectTrigger className="w-full lg:w-36"><SelectValue placeholder="Payment" /></SelectTrigger><SelectContent><SelectItem value="all">All payments</SelectItem>{Object.entries(paymentLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select>
                    <Select value={wholesaler} onValueChange={updateFilter(setWholesaler)}><SelectTrigger className="w-full lg:w-44"><SelectValue placeholder="Wholesaler" /></SelectTrigger><SelectContent><SelectItem value="all">All wholesalers</SelectItem>{(filters.wholesalers || []).map((user) => <SelectItem key={user.id} value={String(user.id)}>{user.name}</SelectItem>)}</SelectContent></Select>
                    <Select value={retailer} onValueChange={updateFilter(setRetailer)}><SelectTrigger className="w-full lg:w-44"><SelectValue placeholder="Retailer" /></SelectTrigger><SelectContent><SelectItem value="all">All retailers</SelectItem>{(filters.retailers || []).map((user) => <SelectItem key={user.id} value={String(user.id)}>{user.name}</SelectItem>)}</SelectContent></Select>
                    <Input type="date" value={dateFrom} onChange={(event) => { setDateFrom(event.target.value); setPage(1); }} aria-label="Order date from" />
                    <Input type="date" value={dateTo} onChange={(event) => { setDateTo(event.target.value); setPage(1); }} aria-label="Order date to" />
                    <Input type="number" min="0" value={minAmount} onChange={(event) => { setMinAmount(event.target.value); setPage(1); }} placeholder="Min amount" aria-label="Minimum amount" />
                    <Input type="number" min="0" value={maxAmount} onChange={(event) => { setMaxAmount(event.target.value); setPage(1); }} placeholder="Max amount" aria-label="Maximum amount" />
                </div>
                {loading ? <div className="p-8 text-sm text-muted-foreground">Loading orders...</div> : error ? <div className="p-8 text-sm text-destructive">{error}</div> : result.items.length === 0 ? <div className="p-8 text-sm text-muted-foreground">No orders found.</div> : (
                    <div className="overflow-x-auto"><Table className="min-w-[1250px]"><TableHeader><TableRow className="bg-muted/40">{columns.map(([key, label]) => <TableHead key={key} className="whitespace-nowrap px-3 text-xs font-semibold uppercase text-muted-foreground"><button className="inline-flex items-center gap-1" onClick={() => toggleSort(key)}>{label}{sortBy === key && (sortOrder === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}</button></TableHead>)}<TableHead /></TableRow></TableHeader><TableBody>{result.items.map((row) => <TableRow key={String(row.id)}><TableCell className="font-semibold text-primary">#{row.orderNo}</TableCell><TableCell>{row.retailer?.businessName || row.retailer?.name || "—"}</TableCell><TableCell>{row.wholesaler?.businessName || row.wholesaler?.name || "—"}</TableCell><TableCell>{row.itemsCount ?? 0}</TableCell><TableCell>{formatCurrency(row.totalAmount)}</TableCell><TableCell><StatusBadge status={paymentLabels[row.paymentStatus] || row.paymentStatus} /></TableCell><TableCell><StatusBadge status={statusLabels[row.status] || row.status} /></TableCell><TableCell>{formatDate(row.createdAt)}</TableCell><TableCell><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label={`Actions for order ${row.orderNo}`}><MoreHorizontal /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onSelect={() => navigate({ to: `/orders/${row.id}` })}>View</DropdownMenuItem><DropdownMenuItem onSelect={() => navigate({ to: `/orders/${row.id}` })}>Update Status</DropdownMenuItem><DropdownMenuItem onSelect={() => setCancelOrder(row)} disabled={!(["pending", "confirmed", "shipped", "out_for_delivery", "delayed"].includes(row.status))}>Cancel</DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem onSelect={() => downloadInvoice(row)}>Download Invoice</DropdownMenuItem></DropdownMenuContent></DropdownMenu></TableCell></TableRow>)}</TableBody></Table></div>
                )}
                <div className="flex items-center justify-between border-t px-4 py-3 text-xs text-muted-foreground"><span>Showing {result.items.length ? (page - 1) * 10 + 1 : 0}–{Math.min(page * 10, result.pagination.total)} of {result.pagination.total}</span><div className="flex items-center gap-2"><Button variant="outline" size="icon" disabled={page === 1 || loading} onClick={() => setPage((current) => Math.max(1, current - 1))} aria-label="Previous page"><ChevronLeft /></Button><span>Page {page} of {pages}</span><Button variant="outline" size="icon" disabled={page >= pages || loading} onClick={() => setPage((current) => Math.min(pages, current + 1))} aria-label="Next page"><ChevronRight /></Button></div></div>
                <ConfirmationModal open={Boolean(cancelOrder)} title="Cancel order?" description={`Order #${cancelOrder?.orderNo || ""} will be cancelled and the change will be recorded in its status timeline.`} confirmLabel="Cancel order" variant="destructive" onCancel={() => !actionLoading && setCancelOrder(null)} onConfirm={cancelSelectedOrder} />
            </section>
        </div>
    );
}
