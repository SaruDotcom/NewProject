import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, CreditCard, Download, FileSpreadsheet, MoreHorizontal, Search } from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce";
import { Button } from "@/components/ui/button";
import { ConfirmationModal } from "@/components/ui/confirmation-modal";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { KpiCard, PageHeader, StatusBadge } from "@/components/admin-ui";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiGet, apiPatch, apiPost } from "@/lib/api";
import { toast } from "sonner";
import { downloadPaymentReceipt } from "@/components/order-detail-page";

const statusLabels = { success: "Success", pending: "Pending", failed: "Failed", refunded: "Refunded" };
const methods = ["cod", "upi", "card", "wallet", "credit"];
const methodLabels = { cod: "COD", upi: "UPI", card: "Card", wallet: "Wallet", credit: "Credit" };
const columns = [["transactionRef", "Transaction"], ["order", "Order"], ["retailer", "Retailer"], ["wholesaler", "Wholesaler"], ["amount", "Amount"], ["method", "Method"], ["status", "Status"], ["createdAt", "Date"]];
const initialResult = { items: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 1 }, filters: { wholesalers: [], retailers: [] } };
const initialSummary = { totalReceived: 0, pending: 0, failed: 0, refunded: 0 };

export function PaymentsManagementPage() {
    const [search, setSearch] = useState("");
    const debouncedSearch = useDebounce(search, 350);
    const [status, setStatus] = useState("all");
    const [method, setMethod] = useState("all");
    const [wholesaler, setWholesaler] = useState("all");
    const [retailer, setRetailer] = useState("all");
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");
    const [minAmount, setMinAmount] = useState("");
    const [maxAmount, setMaxAmount] = useState("");
    const [sortBy, setSortBy] = useState("createdAt");
    const [sortOrder, setSortOrder] = useState("desc");
    const [page, setPage] = useState(1);
    const [result, setResult] = useState(initialResult);
    const [summary, setSummary] = useState(initialSummary);
    const [loading, setLoading] = useState(true);
    const [summaryLoading, setSummaryLoading] = useState(true);
    const [error, setError] = useState(null);
    const [refreshKey, setRefreshKey] = useState(0);
    const navigate = useNavigate();
    const [refundPayment, setRefundPayment] = useState(null);
    const [refundAmount, setRefundAmount] = useState("");
    const [confirmation, setConfirmation] = useState(null);
    const [actionLoading, setActionLoading] = useState(false);

    useEffect(() => {
        setPage(1);
    }, [debouncedSearch, status, method, wholesaler, retailer, dateFrom, dateTo, minAmount, maxAmount]);

    useEffect(() => {
        let mounted = true;
        apiGet("/admin/payments/summary")
            .then((payload) => mounted && setSummary(payload || initialSummary))
            .catch(() => mounted && setSummary(initialSummary))
            .finally(() => mounted && setSummaryLoading(false));
        return () => { mounted = false; };
    }, [refreshKey]);

    useEffect(() => {
        let mounted = true;
        const params = new URLSearchParams({ page: String(page), limit: "10", sortBy, sortOrder });
        if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
        if (status !== "all") params.set("status", status);
        if (method !== "all") params.set("method", method);
        if (wholesaler !== "all") params.set("wholesaler", wholesaler);
        if (retailer !== "all") params.set("retailer", retailer);
        if (dateFrom) params.set("dateFrom", dateFrom);
        if (dateTo) params.set("dateTo", dateTo);
        if (minAmount) params.set("minAmount", minAmount);
        if (maxAmount) params.set("maxAmount", maxAmount);

        setLoading(true);
        setError(null);
        apiGet(`/admin/payments?${params.toString()}`)
            .then((payload) => {
                if (!mounted) return;
                setResult({ items: Array.isArray(payload?.items) ? payload.items : [], pagination: payload?.pagination || initialResult.pagination, filters: payload?.filters || initialResult.filters });
            })
            .catch((err) => {
                if (!mounted) return;
                setResult((current) => ({ ...current, items: [] }));
                setError(err.message || "Failed to load payments");
            })
            .finally(() => mounted && setLoading(false));
        return () => { mounted = false; };
    }, [debouncedSearch, status, method, wholesaler, retailer, dateFrom, dateTo, minAmount, maxAmount, sortBy, sortOrder, page, refreshKey]);

    const setFilter = (setter) => (value) => { setter(value); setPage(1); };
    const toggleSort = (key) => {
        if (sortBy === key) setSortOrder((current) => current === "asc" ? "desc" : "asc");
        else { setSortBy(key); setSortOrder("asc"); }
        setPage(1);
    };
    const money = (value) => `₹${Number(value || 0).toLocaleString("en-IN")}`;
    const date = (value) => value ? new Date(value).toLocaleDateString("en-IN") : "—";
    const pages = Math.max(1, result.pagination.totalPages || 1);
    const filters = result.filters || initialResult.filters;
    const buildQuery = (requestedPage = page, requestedLimit = 10) => {
        const params = new URLSearchParams({ page: String(requestedPage), limit: String(requestedLimit), sortBy, sortOrder });
        if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
        if (status !== "all") params.set("status", status);
        if (method !== "all") params.set("method", method);
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
                const payload = await apiGet(`/admin/payments?${buildQuery(exportPage, 100).toString()}`);
                rows.push(...(payload?.items || []));
                totalPages = payload?.pagination?.totalPages || 1;
                exportPage += 1;
            } while (exportPage <= totalPages);
            const escape = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
            const csv = [["Transaction", "Order", "Retailer", "Wholesaler", "Amount", "Method", "Status", "Date"], ...rows.map((row) => [row.transactionRef || row.id, row.order?.orderNo, row.retailer?.businessName || row.retailer?.name, row.wholesaler?.businessName || row.wholesaler?.name, row.amount, row.method, row.status, row.createdAt])].map((row) => row.map(escape).join(",")).join("\r\n");
            const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
            const link = document.createElement("a");
            link.href = url;
            link.download = "payments-export.csv";
            link.click();
            URL.revokeObjectURL(url);
            toast.success(`${rows.length} payment${rows.length === 1 ? "" : "s"} exported`);
        } catch (err) { toast.error(err.message || "Unable to export payments"); }
    };
    const openView = (row) => navigate({ to: "/payments/$id", params: { id: String(row.id) } });
    const openRefund = (row) => {
        setRefundPayment(row);
        setRefundAmount(String(row.amount || ""));
    };
    const requestRefund = () => {
        const amount = Number(refundAmount);
        if (!refundPayment || !Number.isFinite(amount) || amount <= 0 || amount > Number(refundPayment.amount || 0)) {
            toast.error(`Enter a refund amount between 0 and ${money(refundPayment?.amount)}`);
            return;
        }
        setRefundPayment(null);
        setConfirmation({ kind: "refund", row: refundPayment, amount });
    };
    const runAction = async () => {
        if (!confirmation) return;
        setActionLoading(true);
        try {
            if (confirmation.kind === "verify") await apiPatch(`/admin/payments/${confirmation.row.id}/verify`, { note: "Verified by admin" });
            else await apiPost(`/admin/payments/${confirmation.row.id}/refund`, { amount: confirmation.amount });
            toast.success(confirmation.kind === "verify" ? "Payment verified successfully" : "Payment refunded successfully");
            setConfirmation(null);
            setRefreshKey((value) => value + 1);
        } catch (err) { toast.error(err.message || "Payment action failed"); }
        finally { setActionLoading(false); }
    };
    const downloadReceipt = async (row) => {
        try {
            const payload = await apiGet(`/admin/payments/${row.id}/receipt`);
            downloadPaymentReceipt(payload);
            toast.success("Payment receipt downloaded");
        } catch (err) { toast.error(err.message || "Unable to download receipt"); }
    };

    return <div className="space-y-6">
        <PageHeader title="Payments" description="Track payments, pending dues, and refunds." action={<Button variant="outline" onClick={exportCsv}><FileSpreadsheet /> Export</Button>} />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard label="Total Received" value={summaryLoading ? "—" : money(summary.totalReceived)} icon={CreditCard} tone="success" />
            <KpiCard label="Pending" value={summaryLoading ? "—" : money(summary.pending)} icon={CreditCard} tone="warning" />
            <KpiCard label="Failed" value={summaryLoading ? "—" : money(summary.failed)} icon={CreditCard} />
            <KpiCard label="Refunded" value={summaryLoading ? "—" : money(summary.refunded)} icon={CreditCard} />
        </div>
        <section className="admin-card overflow-hidden">
            <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center lg:flex-wrap">
                <div className="relative min-w-56 flex-1"><Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search payments..." className="pl-9 shadow-none" /></div>
                <Select value={status} onValueChange={setFilter(setStatus)}><SelectTrigger className="w-full lg:w-36"><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value="all">All</SelectItem>{Object.entries(statusLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select>
                <Select value={method} onValueChange={setFilter(setMethod)}><SelectTrigger className="w-full lg:w-32"><SelectValue placeholder="Method" /></SelectTrigger><SelectContent><SelectItem value="all">All</SelectItem>{methods.map((value) => <SelectItem key={value} value={value}>{methodLabels[value]}</SelectItem>)}</SelectContent></Select>
                <Select value={wholesaler} onValueChange={setFilter(setWholesaler)}><SelectTrigger className="w-full lg:w-44"><SelectValue placeholder="Wholesaler" /></SelectTrigger><SelectContent><SelectItem value="all">All</SelectItem>{(filters.wholesalers || []).map((user) => <SelectItem key={user.id} value={String(user.id)}>{user.name}</SelectItem>)}</SelectContent></Select>
                <Select value={retailer} onValueChange={setFilter(setRetailer)}><SelectTrigger className="w-full lg:w-44"><SelectValue placeholder="Retailer" /></SelectTrigger><SelectContent><SelectItem value="all">All</SelectItem>{(filters.retailers || []).map((user) => <SelectItem key={user.id} value={String(user.id)}>{user.name}</SelectItem>)}</SelectContent></Select>
                <Input type="date" value={dateFrom} onChange={(event) => { setDateFrom(event.target.value); setPage(1); }} aria-label="Payment date from" />
                <Input type="date" value={dateTo} onChange={(event) => { setDateTo(event.target.value); setPage(1); }} aria-label="Payment date to" />
                <Input type="number" min="0" value={minAmount} onChange={(event) => { setMinAmount(event.target.value); setPage(1); }} placeholder="Min amount" aria-label="Minimum payment amount" />
                <Input type="number" min="0" value={maxAmount} onChange={(event) => { setMaxAmount(event.target.value); setPage(1); }} placeholder="Max amount" aria-label="Maximum payment amount" />
            </div>
            {loading ? <div className="p-8 text-sm text-muted-foreground">Loading payments...</div> : error ? <div className="p-8 text-sm text-destructive">{error}</div> : result.items.length === 0 ? <div className="p-8 text-sm text-muted-foreground">No payments found.</div> : <div className="overflow-x-auto"><Table className="min-w-[1350px]"><TableHeader><TableRow className="bg-muted/40">{columns.map(([key, label]) => <TableHead key={key} className="whitespace-nowrap px-3 text-xs font-semibold uppercase text-muted-foreground"><button className="inline-flex items-center gap-1" onClick={() => toggleSort(key)}>{label}{sortBy === key && (sortOrder === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}</button></TableHead>)}<TableHead /></TableRow></TableHeader><TableBody>{result.items.map((row) => <TableRow key={String(row.id)}><TableCell className="font-semibold text-primary">{row.transactionRef || row.id || "—"}</TableCell><TableCell>{row.order?.orderNo || "—"}</TableCell><TableCell>{row.retailer?.businessName || row.retailer?.name || "—"}</TableCell><TableCell>{row.wholesaler?.businessName || row.wholesaler?.name || "—"}</TableCell><TableCell>{money(row.amount)}</TableCell><TableCell>{methodLabels[row.method] || row.method || "—"}</TableCell><TableCell><StatusBadge status={statusLabels[row.status] || row.status} /></TableCell><TableCell>{date(row.createdAt)}</TableCell><TableCell><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label={`Actions for payment ${row.transactionRef || row.id}`}><MoreHorizontal /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onSelect={() => openView(row)}>View</DropdownMenuItem>{row.status === "pending" && <DropdownMenuItem onSelect={() => setConfirmation({ kind: "verify", row, title: "Verify payment?" })}>Verify</DropdownMenuItem>}{row.status === "success" && <DropdownMenuItem onSelect={() => openRefund(row)}>Refund</DropdownMenuItem>}<DropdownMenuSeparator /><DropdownMenuItem onSelect={() => downloadReceipt(row)}><Download /> Receipt</DropdownMenuItem></DropdownMenuContent></DropdownMenu></TableCell></TableRow>)}</TableBody></Table></div>}
            <div className="flex items-center justify-between border-t px-4 py-3 text-xs text-muted-foreground"><span>Showing {result.items.length ? (page - 1) * 10 + 1 : 0}–{Math.min(page * 10, result.pagination.total)} of {result.pagination.total}</span><div className="flex items-center gap-2"><Button variant="outline" size="icon" disabled={page === 1 || loading} onClick={() => setPage((current) => Math.max(1, current - 1))} aria-label="Previous page"><ChevronLeft /></Button><span>Page {page} of {pages}</span><Button variant="outline" size="icon" disabled={page >= pages || loading} onClick={() => setPage((current) => Math.min(pages, current + 1))} aria-label="Next page"><ChevronRight /></Button></div></div>
            <ConfirmationModal open={Boolean(confirmation)} title={confirmation?.kind === "verify" ? "Verify payment?" : "Refund payment?"} description={confirmation?.kind === "verify" ? "This will mark the payment as paid and update the related order." : `Refund ${money(confirmation?.amount)} for this payment? The related order payment status will be recalculated.`} confirmLabel={confirmation?.kind === "verify" ? "Verify" : "Refund"} variant={confirmation?.kind === "refund" ? "destructive" : "default"} onCancel={() => !actionLoading && setConfirmation(null)} onConfirm={runAction} />
            <Dialog open={Boolean(refundPayment)} onOpenChange={(open) => !open && setRefundPayment(null)}><DialogContent><DialogHeader><DialogTitle>Refund Payment</DialogTitle><DialogDescription>Enter an amount up to the remaining paid amount of {money(refundPayment?.amount)}.</DialogDescription></DialogHeader><Input type="number" min="0.01" max={refundPayment?.amount || undefined} value={refundAmount} onChange={(event) => setRefundAmount(event.target.value)} /><DialogFooter><Button variant="outline" onClick={() => setRefundPayment(null)}>Cancel</Button><Button variant="destructive" onClick={requestRefund}>Continue</Button></DialogFooter></DialogContent></Dialog>
        </section>
    </div>;
}
