import { Link, useNavigate } from "@/lib/router";
import { Component, type ErrorInfo, type ReactNode, useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, ChevronRight, Favorite, FavoriteBorder, LocationOn, Inventory2, ShoppingCartOutlined, Verified, VerifiedUser, Lock, LocalShipping, Notifications, LocalOffer, ConfirmationNumber } from "@mui/icons-material";
import {
  Store,
  MapPin,
  Lock as LockIcon,
  Eye,
  EyeOff,
  ShieldCheck,
  AlertCircle,
  ArrowRight,
  RefreshCw,
  FileText,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Percent,
  Receipt,
  QrCode,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { type RetailerProfile } from "@/state/store";
import { useStore, getApiOrderItems, getCategoryHierarchy, mapOrder } from "@/state/store";
import { ApiError, api, setAuthToken } from "@/api/api";
import { cn } from "@/lib/utils";
import { retailerQueryKeys } from "@/lib/query-client";
import {
  clearStoredReferralAttribution,
  createReferralAttribution,
  getReferralAttributionFromUrl,
  getStoredReferralAttribution,
  markRetailerRegistrationComplete,
  saveReferralAttribution,
  type ReferralAttribution,
} from "@/lib/referral-attribution";
import { CartItem, EmptyState, OrderCard, ProductGrid, SectionHeading, StatusBadge, TradeFlowMark, money } from "./primitives";

export function DashboardPage() {
  const { currentUser, wishlist, orders, retailerProfile, linkedWholesalerId, linkedWholesaler, products } = useStore();
  const connectedProducts = products.filter((p) => p.wholesalerId === linkedWholesalerId);
  const safeOwnerName = retailerProfile.ownerName?.trim() || "Retailer";
  const firstName = safeOwnerName.split(/\s+/)[0] || "Retailer";
  const linkedSupplierName = linkedWholesaler?.name || "your supplier";

  const creditQuery = useQuery({
    queryKey: retailerQueryKeys.resource(currentUser?.id || "unknown", "credit"),
    queryFn: async () => (await api.getCreditInfo())?.data ?? null,
    enabled: Boolean(currentUser?.id),
    staleTime: 0,
    gcTime: 0,
    refetchInterval: 15000,
  });
  const creditInfo = creditQuery.data;
  useEffect(() => {
    if (creditQuery.error) console.error("Failed to load retailer credit data", creditQuery.error);
  }, [creditQuery.error]);

  const overdueCount = useMemo(() => {
    return orders.filter(o => o.isCreditOrder && o.creditPaymentStatus === "OVERDUE").length;
  }, [orders]);

  return (
    <main className="shell py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase text-primary">Retailer workspace</p>
          <h1 className="mt-2 text-3xl font-extrabold text-ink">Good morning, {firstName}</h1>
          <p className="mt-2 text-muted-foreground">{retailerProfile.businessName || "Your business"} is linked with <strong className="text-ink">{linkedSupplierName}</strong>.</p>
        </div>
        <Button asChild><Link to="/products">Continue shopping</Link></Button>
      </div>

      {creditInfo && (creditInfo.creditEnabled || Number(creditInfo.currentOutstandingAmount || 0) > 0) && (
        <div className="mt-6 rounded-2xl border border-tradeflow-green/20 bg-gradient-to-r from-tradeflow-green-50 via-white to-tradeflow-green-50 p-5 shadow-xs dark:border-tradeflow-green/30 dark:from-tradeflow-navy/70 dark:via-background dark:to-tradeflow-navy/70">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-tradeflow-green/20 pb-3 dark:border-tradeflow-green/30">
            <div className="flex items-center gap-2">
              <Badge className="bg-tradeflow-green text-tradeflow-navy font-bold">{creditInfo.creditEnabled ? "Credit Line Active" : "Credit Balance Due"}</Badge>
              <span className="text-xs font-semibold text-muted-foreground">Provided by {linkedSupplierName}</span>
            </div>
            <span className="text-xs text-muted-foreground">Pay within <strong>{creditInfo.creditPeriodDays} days</strong> of order</span>
          </div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-xl bg-white p-3.5 border border-tradeflow-gray-200 dark:bg-card dark:border-tradeflow-navy-hover/50">
              <span className="text-xs font-medium text-muted-foreground">Total Credit Limit</span>
              <p className="text-lg font-black text-ink mt-0.5">{money(creditInfo.effectiveLimit)}</p>
            </div>
            <div className="rounded-xl bg-white p-3.5 border border-tradeflow-gray-200 dark:bg-card dark:border-tradeflow-navy-hover/50">
              <span className="text-xs font-medium text-muted-foreground">Current Outstanding</span>
              <p className={cn("text-lg font-black mt-0.5", creditInfo.currentOutstandingAmount > 0 ? "text-amber-700 dark:text-amber-300" : "text-green-700 dark:text-tradeflow-green")}>
                {money(creditInfo.currentOutstandingAmount)}
              </p>
            </div>
            <div className="rounded-xl bg-white p-3.5 border border-tradeflow-gray-200 dark:bg-card dark:border-tradeflow-navy-hover/50">
              <span className="text-xs font-medium text-muted-foreground">Available Credit</span>
              <p className="text-lg font-black text-green-700 dark:text-tradeflow-green mt-0.5">{money(creditInfo.availableCredit)}</p>
            </div>
          </div>

          {overdueCount > 0 && (
            <div className="mt-4 flex items-center gap-2 rounded-xl bg-amber-100 p-3 text-xs font-bold text-amber-800 border border-amber-200">
              ⚠️ You have {overdueCount} overdue credit order{overdueCount > 1 ? "s" : ""}. Please settle your dues with {linkedSupplierName} to avoid late charges.
            </div>
          )}
          {Number(creditInfo?.currentOutstandingAmount || 0) > 0 && (
            <CreditRepaymentPanel outstanding={Number(creditInfo.currentOutstandingAmount)} />
          )}
        </div>
      )}

      <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Active orders", orders.filter(o => !["Delivered", "Cancelled"].includes(o.status)).length, "/orders"],
          ["Pending orders", orders.filter(o => o.status === "Pending").length, "/orders"],
          ["Linked Supplier", linkedSupplierName, "/products"],
          ["Wishlist items", wishlist.length, "/wishlist"],
        ].map(([label, value, to]) => (
          <Link key={label as string} to={to as "/orders" | "/products" | "/wishlist"} className="border bg-card p-5 interactive rounded-2xl">
            <span className="text-xs font-semibold text-muted-foreground">{label}</span>
            <strong className="mt-2 block text-xl sm:text-2xl text-ink font-black truncate">{value}</strong>
          </Link>
        ))}
      </div>
      <div className="mt-12 grid gap-12 lg:grid-cols-[1.4fr_1fr]">
        <section>
          <SectionHeading title="Recent orders" subtitle="Track your latest replenishment activity" href="/orders" />
          {orders.length > 0 ? (
            <div className="grid gap-3">
              {orders.slice(0, 3).map((order) => (
                <OrderCard key={order.id} order={order} />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border/80 p-6 text-center text-sm text-muted-foreground bg-card">
              No orders placed yet. Explore trade products to start ordering.
            </div>
          )}
        </section>
        <section>
          <SectionHeading title="Quick actions" />
          <div className="grid gap-3">
            {[
              [`Browse ${linkedSupplierName}`, "Shop trade catalog and place bulk orders", "/products"],
              ["Review wishlist", "Return to products you saved", "/wishlist"],
              ["Manage delivery addresses", "Keep your store details ready", "/addresses"],
            ].map(([t, d, to]) => (
              <Link key={t} to={to as "/products" | "/wishlist" | "/addresses"} className="flex items-center justify-between border bg-card p-4 interactive rounded-xl">
                <div>
                  <b className="block text-ink text-sm font-extrabold">{t}</b>
                  <span className="text-xs text-muted-foreground">{d}</span>
                </div>
                <ChevronRight className="size-4 text-primary" />
              </Link>
            ))}
          </div>
        </section>
      </div>
      <section className="mt-14">
        <SectionHeading title={`Catalogue from ${linkedSupplierName}`} subtitle="Direct wholesale trade catalog" href="/products" />
        <ProductGrid products={connectedProducts.slice(0, 4)} />
      </section>
    </main>
  );
}

function CreditRepaymentPanel({ outstanding }: { outstanding: number }) {
  const { currentUser } = useStore();
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const paymentOptionsQuery = useQuery({
    queryKey: retailerQueryKeys.resource(currentUser?.id || "unknown", "payment-options"),
    queryFn: async () => (await api.getRetailerPaymentOptions()).data,
    enabled: Boolean(currentUser?.id),
    staleTime: 0,
    gcTime: 0,
  });
  const options = paymentOptionsQuery.data;
  const reportsQuery = useQuery({
    queryKey: retailerQueryKeys.resource(currentUser?.id || "unknown", "payment-reports"),
    queryFn: async () => (await api.getRetailerPaymentReports()).data || [],
    enabled: Boolean(currentUser?.id),
    staleTime: 0,
    gcTime: 0,
  });

  useEffect(() => {
    if (!expiresAt) return;
    const timer = window.setInterval(() => {
      const remaining = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining === 0) setExpiresAt(null);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [expiresAt]);

  const submit = async () => {
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0 || numericAmount > outstanding) {
      toast.error(`Enter a repayment between ₹0.01 and ${money(outstanding)}.`);
      return;
    }
    if (reference.trim().length < 4) {
      toast.error("Enter the UPI transaction/reference ID.");
      return;
    }
    setSubmitting(true);
    try {
      await api.createPaymentReport({
        type: "CREDIT_REPAYMENT",
        amount: numericAmount.toFixed(2),
        transactionReference: reference.trim(),
        screenshot: screenshot || undefined,
      });
      setSubmitted(true);
      await queryClient.invalidateQueries({ queryKey: retailerQueryKeys.resource(currentUser?.id || "unknown", "payment-reports") });
      toast.success("Repayment submitted for wholesaler verification. Your outstanding balance changes after confirmation.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to submit repayment.");
    } finally {
      setSubmitting(false);
    }
  };

  const openQr = () => {
    setQrOpen(true);
    const end = Date.now() + Number(options?.qrSessionMinutes || 10) * 60_000;
    setExpiresAt(end);
    setSecondsLeft(Math.ceil((end - Date.now()) / 1000));
  };

  return (
    <section className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/60 p-5 dark:bg-amber-950/20">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-extrabold text-ink">Repay credit balance</h2>
          <p className="mt-1 text-xs text-muted-foreground">Outstanding: <strong>{money(outstanding)}</strong>. Pay any installment up to this amount; only wholesaler-confirmed payments update your balance.</p>
        </div>
        {options?.qrPaymentsEnabled && !qrOpen && <Button variant="outline" size="sm" onClick={openQr}>Show payment QR</Button>}
      </div>
      {qrOpen && options?.qrPaymentsEnabled && (
        <div className="mt-3 rounded-xl border bg-background p-3 text-center">
          {secondsLeft > 0 ? (
            <>
              <img src={options.qrDataUrl} alt="Wholesaler UPI QR code" className="mx-auto max-h-48 object-contain" />
              <p className="mt-2 text-xs text-muted-foreground">Session expires in {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, "0")}. Expiry only hides the QR in this app; the underlying QR remains valid.</p>
            </>
          ) : <Button size="sm" variant="outline" onClick={openQr}>Request fresh QR session</Button>}
        </div>
      )}
      {options?.upiIdPaymentsEnabled && (
        <div className="mt-3 flex items-center gap-2 text-sm">
          <strong>{options.upiId}</strong>
          <button type="button" className="text-xs font-bold text-primary" onClick={() => void navigator.clipboard.writeText(options.upiId).then(() => toast.success("UPI ID copied."))}>Copy</button>
        </div>
      )}
      {!submitted ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-bold">Installment amount (₹)
            <Input type="number" min="0.01" max={outstanding} step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} />
          </label>
          <label className="text-xs font-bold">UPI transaction/reference ID
            <Input value={reference} onChange={(event) => setReference(event.target.value)} />
          </label>
          <label className="text-xs font-bold sm:col-span-2">Screenshot (optional)
            <Input type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" onChange={(event) => setScreenshot(event.target.files?.[0] || null)} />
          </label>
          <Button type="button" onClick={() => void submit()} disabled={submitting || !(options?.qrPaymentsEnabled || options?.upiIdPaymentsEnabled)} className="sm:col-span-2">
            {submitting ? "Submitting…" : "Submit Repayment for Verification"}
          </Button>
          {!options?.qrPaymentsEnabled && !options?.upiIdPaymentsEnabled && (
            <p className="text-xs text-amber-800 sm:col-span-2">Your wholesaler has not enabled a UPI repayment method. Contact them to arrange repayment.</p>
          )}
        </div>
      ) : <p className="mt-3 rounded-lg bg-white p-3 text-sm font-bold text-amber-900">Payment report is Pending Verification.</p>}
      {(reportsQuery.data || []).filter((report: any) => report.isCreditRepayment).slice(0, 3).map((report: any) => (
        <p key={report._id} className="mt-2 text-xs text-muted-foreground">
          ₹{Number(report.amount).toLocaleString("en-IN")} · {report.status} · Ref {report.transactionReference}
          {report.reviewNote ? ` · ${report.reviewNote}` : ""}
        </p>
      ))}
    </section>
  );
}

export function OrdersPage() {
  const { currentUser, orders, products, linkedWholesaler, refreshOrders } = useStore();
  const ordersQuery = useQuery({
    queryKey: retailerQueryKeys.resource(currentUser?.id || "unknown", "orders"),
    queryFn: () => api.getOrders({ limit: 200 }),
    enabled: Boolean(currentUser?.id),
    refetchInterval: 30000,
    select: (response) => getApiOrderItems(response).map(mapOrder),
    staleTime: 0,
    refetchOnMount: "always",
  });
  const [activeTab, setActiveTab] = useState("All orders");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "highest" | "lowest">("newest");

  useEffect(() => {
    void refreshOrders();
  }, [refreshOrders]);

  const visibleOrders = (ordersQuery.data && ordersQuery.data.length > 0) ? ordersQuery.data : orders;
  const supplierName = linkedWholesaler?.name || linkedWholesaler?.businessName || "Connected wholesaler";

  const filteredOrders = useMemo(() => {
    return visibleOrders
      .filter((o) => {
        const matchesTab = activeTab === "All orders" || o.status.toLowerCase() === activeTab.toLowerCase();

        if (!matchesTab) return false;

        if (!search.trim()) return true;
        const q = search.toLowerCase();
        const matchesId = String(o.id).toLowerCase().includes(q) || (o.orderNumber ? o.orderNumber.toLowerCase().includes(q) : false);
        const matchesWholesaler = supplierName.toLowerCase().includes(q);
        const matchesProducts = o.items.some((item) => {
          const prod = products.find((p) => p.id === item.productId);
          return prod ? prod.name.toLowerCase().includes(q) : false;
        });

        return matchesId || matchesWholesaler || matchesProducts;
      })
      .sort((a, b) => {
        if (sortBy === "highest") return b.total - a.total;
        if (sortBy === "lowest") return a.total - b.total;
        if (sortBy === "oldest") return new Date(a.date).getTime() - new Date(b.date).getTime();
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      });
  }, [visibleOrders, activeTab, search, sortBy, supplierName, products]);

  const totalSpent = useMemo(() => filteredOrders.reduce((sum, o) => sum + o.total, 0), [filteredOrders]);

  return (
    <main className="shell py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-primary">Wholesale Order History</p>
          <h1 className="mt-1 text-3xl font-extrabold text-ink">Your Orders</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Track, filter, and manage your wholesale orders fulfilled by {supplierName}.
          </p>
        </div>
        <Button asChild variant="outline" className="rounded-xl font-bold">
          <Link to="/products">Browse Products</Link>
        </Button>
      </div>

      <div className="mt-6 flex flex-col gap-3 border-y py-4 sm:flex-row sm:items-center justify-between">
        <Input
          placeholder="Search orders..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:max-w-md"
        />
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap">Sort by:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="h-9 border bg-background px-3 text-xs rounded-xl font-bold"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="highest">Highest Total</option>
            <option value="lowest">Lowest Total</option>
          </select>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {["All orders", "Pending", "Confirmed", "Processing", "Shipped", "Delivered", "Cancelled"].map((tab) => {
          const count = tab === "All orders" ? visibleOrders.length : visibleOrders.filter((o) => o.status.toLowerCase() === tab.toLowerCase()).length;
          return (
            <Button
              key={tab}
              variant={activeTab === tab ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab(tab)}
              className="rounded-xl font-bold"
            >
              {tab} ({count})
            </Button>
          );
        })}
      </div>

      {ordersQuery.isLoading && orders.length === 0 ? (
        <div className="mt-8 rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground" role="status">
          Loading your orders…
        </div>
      ) : ordersQuery.error && orders.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-destructive/30 bg-destructive/5 p-8 text-center" role="alert">
          <p className="font-semibold text-destructive">We couldn’t load your orders.</p>
          <p className="mt-2 text-sm text-muted-foreground">{ordersQuery.error instanceof Error ? ordersQuery.error.message : "Please try again."}</p>
          <Button className="mt-4" variant="outline" onClick={() => void ordersQuery.refetch()}>Try again</Button>
        </div>
      ) : filteredOrders.length > 0 ? (
        <div className="mt-6 space-y-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Showing {filteredOrders.length} order{filteredOrders.length === 1 ? "" : "s"}</span>
            <span>Total value: <strong className="text-ink font-bold">{money(totalSpent)}</strong></span>
          </div>
          <div className="grid gap-4">
            {filteredOrders.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-10 grid min-h-64 place-items-center rounded-2xl border border-dashed bg-card p-10 text-center">
          <div>
            <Inventory2 className="mx-auto size-12 text-primary/60" />
            <h3 className="mt-4 text-xl font-bold text-ink">No orders found</h3>
            <p className="mt-2 text-sm text-muted-foreground max-w-sm mx-auto">
              {search ? `No orders match your search query "${search}".` : activeTab === "All orders" ? "You haven't placed any wholesale orders yet." : `No orders with status "${activeTab}".`}
            </p>
            <Button className="mt-5 rounded-xl font-bold" onClick={() => { setSearch(""); setActiveTab("All orders"); }}>
              Reset Search & Filters
            </Button>
          </div>
        </div>
      )}
    </main>
  );
}

export function OrderDetailsPage({ orderId }: { orderId: string }) {
  const { currentUser, orders, returns, retailerProfile, linkedWholesaler, products, categories, refreshOrders, refreshData } = useStore();
  const queryClient = useQueryClient();
  const orderQuery = useQuery({
    queryKey: retailerQueryKeys.resource(currentUser?.id || "unknown", "order-detail", orderId),
    queryFn: async () => {
      const response = await api.getOrderById(encodeURIComponent(orderId));
      const rawOrder = response?.data?.order;
      return rawOrder ? mapOrder(rawOrder) : null;
    },
    enabled: Boolean(currentUser?.id && orderId),
    refetchInterval: 30000,
  });
  const order = orderQuery.data ?? orders.find((candidate) => String(candidate.id) === String(orderId) || String(candidate.orderNumber) === String(orderId));
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [returnReason, setReturnReason] = useState("");
  const [returnNote, setReturnNote] = useState("");
  const [returnItems, setReturnItems] = useState<{productId: string, quantity: number}[]>([]);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelNote, setCancelNote] = useState("");

  if (!order) {
    return (
      <main className="shell py-16 text-center">
        {orderQuery.isLoading ? (
          <p className="text-muted-foreground" role="status">Loading order details…</p>
        ) : orderQuery.error ? (
          <>
            <h1 className="text-2xl font-bold">We couldn’t load this order</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {orderQuery.error instanceof Error ? orderQuery.error.message : "Please try again."}
            </p>
            <Button className="mt-4" onClick={() => void orderQuery.refetch()}>Try again</Button>
          </>
        ) : (
          <h1 className="text-2xl font-bold">Order not found</h1>
        )}
        <Button asChild className="mt-4"><Link to="/orders">Back to orders</Link></Button>
      </main>
    );
  }

  const wholesalerName = linkedWholesaler?.name || linkedWholesaler?.businessName || "Connected wholesaler";
  const returnReq = (returns || []).find((r: any) => String(r.orderId) === String(order.id) || String(r.orderId?._id) === String(order.id));

  const handleRequestReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnReason || returnItems.length === 0) {
      toast.error("Please select items and provide a reason");
      return;
    }
    
    try {
      await api.createReturn({
        orderId: order.id,
        items: returnItems,
        reason: returnReason,
        note: returnNote,
      });
      if (currentUser?.id) {
        await queryClient.invalidateQueries({ queryKey: retailerQueryKeys.resource(currentUser.id, "returns") });
        await queryClient.invalidateQueries({ queryKey: retailerQueryKeys.resource(currentUser.id, "orders") });
        await queryClient.invalidateQueries({ queryKey: retailerQueryKeys.resource(currentUser.id, "order-detail", orderId) });
        await refreshData(true);
      }
      toast.success("Return request submitted successfully");
      setReturnDialogOpen(false);
      setReturnItems([]);
      setReturnReason("");
      setReturnNote("");
    } catch (err: any) {
      toast.error(err?.message || "Failed to submit return request");
    }
  };

  const handleCancelOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelReason) {
      toast.error("Please select a cancellation reason");
      return;
    }

    try {
      await api.cancelOrder(order.id, cancelReason, cancelNote);
      if (currentUser?.id) {
        await queryClient.invalidateQueries({ queryKey: retailerQueryKeys.resource(currentUser.id, "orders") });
        await queryClient.invalidateQueries({ queryKey: retailerQueryKeys.resource(currentUser.id, "order-detail", orderId) });
        await queryClient.invalidateQueries({ queryKey: retailerQueryKeys.resource(currentUser.id, "dashboard") });
      }
      await refreshOrders();
      toast.success("Order cancelled successfully");
      setCancelDialogOpen(false);
    } catch (err: any) {
      toast.error(err?.message || "Failed to cancel order");
    }
  };

  const toggleReturnItem = (productId: string, quantity: number, checked: boolean) => {
    if (checked) {
      setReturnItems(prev => [...prev, { productId, quantity }]);
    } else {
      setReturnItems(prev => prev.filter(item => item.productId !== productId));
    }
  };

  return (
    <main className="shell py-10">
      <Link to="/orders" className="text-sm text-muted-foreground hover:text-primary">
        ← Back to orders
      </Link>
      <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs text-muted-foreground">Order {order.orderNumber || order.id} · {order.date}</p>
          <h1 className="mt-2 text-3xl font-extrabold text-ink">{wholesalerName}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge status={order.status} />
          {(order.status === "Pending" || order.status === "Confirmed") && (
            <Button variant="outline" className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground" onClick={() => setCancelDialogOpen(true)}>
              Cancel Order
            </Button>
          )}
          {order.status === "Delivered" && !returnReq && (
            <Button variant="outline" className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground" onClick={() => setReturnDialogOpen(true)}>
              Request Return
            </Button>
          )}
        </div>
      </div>

      {order.status === "Cancelled" && order.cancellationReason && (
        <div className="mt-6 rounded-xl border border-destructive/30 bg-destructive/5 p-5">
          <p className="text-xs font-bold uppercase text-destructive">Order Cancelled</p>
          <p className="mt-1 text-sm font-semibold text-ink">Reason: {order.cancellationReason}</p>
          {order.cancellationNote && <p className="mt-1 text-sm text-muted-foreground">Note: {order.cancellationNote}</p>}
        </div>
      )}

      {returnReq && (
        <div className="mt-6 rounded-2xl border border-warning/40 bg-warning/10 p-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-warning-foreground">Return Request</span>
            <h3 className="text-base font-bold text-ink mt-1">Reason: {returnReq.reason || "Return requested"}</h3>
            {returnReq.retailerNote && <p className="mt-1 text-sm text-muted-foreground">Note: {returnReq.retailerNote}</p>}
            <p className="text-xs text-muted-foreground mt-0.5">Reference: {returnReq.returnNumber || returnReq._id || returnReq.id || "RET-LOGGED"}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground">Status:</span>
            <span className={cn(
              "rounded-full px-3.5 py-1 text-xs font-extrabold uppercase",
              (String(returnReq.status).toUpperCase() === "APPROVED") ? "bg-success text-success-foreground" :
              (String(returnReq.status).toUpperCase() === "REJECTED") ? "bg-destructive text-destructive-foreground" :
              (String(returnReq.status).toUpperCase() === "COMPLETED") ? "bg-primary text-primary-foreground" :
              "bg-warning/20 text-warning-foreground border border-warning/30"
            )}>
              {String(returnReq.status).toUpperCase() === "REQUESTED" || String(returnReq.status).toUpperCase() === "PENDING"
                ? "Pending"
                : String(returnReq.status || "").toLowerCase().replace(/\b\w/g, (letter: string) => letter.toUpperCase())}
            </span>
          </div>
        </div>
      )}
      
      {cancelDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-card p-6 shadow-xl">
            <h2 className="text-xl font-bold">Cancel Order</h2>
            <form className="mt-4 space-y-4" onSubmit={handleCancelOrder}>
              <div>
                <label className="text-sm font-semibold" htmlFor="cancel-reason">Reason for cancellation</label>
                <select id="cancel-reason" className="mt-2 w-full rounded-lg border bg-background p-2" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} required>
                  <option value="">Select a reason...</option>
                  <option value="Ordered by mistake">Ordered by mistake</option>
                  <option value="Found better price">Found better price</option>
                  <option value="Delivery too slow">Delivery too slow</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-semibold" htmlFor="cancel-note">Note (optional)</label>
                <textarea id="cancel-note" className="mt-2 min-h-20 w-full rounded-lg border bg-background p-2 text-sm" value={cancelNote} onChange={(e) => setCancelNote(e.target.value)} maxLength={1000} />
              </div>
              <div className="flex justify-end gap-3">
                <Button type="button" variant="ghost" onClick={() => setCancelDialogOpen(false)}>Keep Order</Button>
                <Button type="submit" variant="destructive">Confirm Cancellation</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {returnDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-xl">
            <h2 className="text-xl font-bold mb-4">Request Return</h2>
            <form onSubmit={handleRequestReturn}>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-semibold">Select items to return</label>
                  <div className="mt-2 space-y-2 border p-3 rounded-xl max-h-48 overflow-y-auto bg-canvas/50">
                    {order.items.map(item => {
                      const p = item.product || products.find(prod => String(prod.id) === String(item.productId));
                      const name = item.name || p?.name || "Product";
                      return (
                        <label key={item.productId} className="flex items-center gap-3 text-sm cursor-pointer hover:bg-card p-1 rounded">
                          <input type="checkbox" onChange={(e) => toggleReturnItem(item.productId, item.quantity, e.target.checked)} />
                          <span>{name} (Qty: {item.quantity})</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-semibold">Reason for return</label>
                  <select 
                    className="w-full mt-2 p-2 border rounded-xl"
                    value={returnReason}
                    onChange={(e) => setReturnReason(e.target.value)}
                    required
                  >
                    <option value="">Select a reason...</option>
                    <option value="Damaged product">Damaged product</option>
                    <option value="Wrong item received">Wrong item received</option>
                    <option value="Quality issue">Quality issue</option>
                    <option value="Not as described">Not as described</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-semibold" htmlFor="return-note">Note (optional)</label>
                  <textarea id="return-note" className="mt-2 min-h-20 w-full rounded-lg border bg-background p-2 text-sm" value={returnNote} onChange={(e) => setReturnNote(e.target.value)} maxLength={1000} />
                </div>
              </div>
              <div className="mt-6 flex gap-3 justify-end">
                <Button type="button" variant="ghost" onClick={() => setReturnDialogOpen(false)}>Cancel</Button>
                <Button type="submit">Submit Request</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_320px]">
        <section className="border bg-card p-6 rounded-2xl shadow-xs">
          <h2 className="text-xl font-bold">Order timeline</h2>
          <div className="mt-6 grid gap-5">
            {["Order placed", "Confirmed", "Processing", "Packed", "Shipped", "Delivered"].map((step, i) => {
              const statusIdx = ["Pending", "Confirmed", "Processing", "Processing", "Shipped", "Delivered"].indexOf(order.status);
              const isCompleted = i <= (statusIdx >= 0 ? statusIdx : 0);
              return (
                <div key={step} className="flex items-center gap-4">
                  <span className={`grid size-8 place-items-center border rounded-full ${isCompleted ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
                    {isCompleted ? <Check className="size-4" /> : i + 1}
                  </span>
                  <div>
                    <b>{step}</b>
                    <p className="text-xs text-muted-foreground">{isCompleted ? "Completed" : "Awaiting update"}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
        <aside className="space-y-4">
          <div className="border bg-card p-5 rounded-2xl shadow-xs">
            <h2 className="font-bold">Order summary</h2>
            <div className="mt-4 flex justify-between text-sm">
              <span>{order.items.length} products ({order.items.reduce((s, i) => s + i.quantity, 0)} units)</span>
              <b>{money(order.total)}</b>
            </div>
            <Button className="mt-5 w-full rounded-xl font-bold" variant="outline">Download invoice</Button>
          </div>
          <div className="border bg-card p-5 rounded-2xl shadow-xs space-y-2">
            <h2 className="font-bold">Payment Information</h2>
            <div className="flex justify-between text-xs pt-1">
              <span className="text-muted-foreground">Payment Mode:</span>
              <strong className="text-ink">{order.isCreditOrder ? "Credit" : order.paymentMethod === "UPI" ? "Direct UPI" : order.paymentMethod === "ONLINE" ? "Legacy Online Payment" : "Cash on Delivery"}</strong>
            </div>
            {order.isCreditOrder && (
              <>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Credit Status:</span>
                  <Badge className={cn("font-bold text-[10px]", 
                    order.creditPaymentStatus === "PAID" ? "bg-emerald-100 text-emerald-800" :
                    "bg-amber-100 text-amber-800"
                  )}>
                    {order.creditPaymentStatus || "PENDING"}
                  </Badge>
                </div>
                {order.creditDueDate && (
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Due Date:</span>
                    <strong className="text-ink">{order.creditDueDate}</strong>
                  </div>
                )}
                {order.creditSettledAt && (
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Settled On:</span>
                    <strong className="text-emerald-600">{order.creditSettledAt}</strong>
                  </div>
                )}
              </>
            )}
          </div>
          <div className="border bg-card p-5 rounded-2xl shadow-xs">
            <h2 className="flex items-center gap-2 font-bold">
              <LocationOn className="size-4 text-primary" />
              Delivery address
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              <strong>{retailerProfile.businessName}</strong> ({retailerProfile.ownerName})<br />
              {retailerProfile.address}, {retailerProfile.city}, {retailerProfile.state} {retailerProfile.pincode}<br />
              {retailerProfile.phone}
            </p>
          </div>
        </aside>
      </div>

      <section className="mt-8 border bg-card p-6 rounded-2xl shadow-xs">
        <div className="flex items-center justify-between border-b pb-4">
          <h2 className="text-xl font-bold text-ink">Products in this order</h2>
          <span className="text-xs font-semibold text-muted-foreground">
            {order.items.length} product{order.items.length === 1 ? "" : "s"} · {order.items.reduce((s, i) => s + i.quantity, 0)} total units
          </span>
        </div>
        <div className="divide-y divide-border/60">
          {order.items.map((item, idx) => {
            const linkedProduct = item.product || products.find((p) => String(p.id) === String(item.productId));
            const name = item.name || linkedProduct?.name || "Product";
            const imageUrl =
              item.imageUrl ||
              (linkedProduct?.images && linkedProduct.images.length > 0 ? linkedProduct.images[0] : "") ||
              linkedProduct?.imageUrl ||
              "";

            const categoryHierarchy = getCategoryHierarchy(item, products, categories);
            const pricePerUnit = item.pricePerUnit || linkedProduct?.price || 0;
            const itemSubtotal = item.subtotal || pricePerUnit * item.quantity;
            const taxRate = Number(item.cgst || 0) + Number(item.sgst || 0) + Number(item.igst || 0);
            const taxAmount = Number(item.gstAmount || 0);
            const taxLabel = Number(item.igst || 0) > 0
              ? `IGST ${item.igst}%`
              : `CGST ${item.cgst || 0}% + SGST ${item.sgst || 0}%`;

            return (
              <div key={item.productId || idx} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-4">
                <div className="flex items-center gap-4">
                  <div className="relative size-14 sm:size-16 shrink-0 overflow-hidden rounded-xl border border-border/80 bg-muted shadow-2xs">
                    {imageUrl ? (
                      <img
                        src={imageUrl}
                        alt={name}
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = "none";
                          const sibling = (e.target as HTMLElement).nextElementSibling;
                          if (sibling) (sibling as HTMLElement).style.display = "flex";
                        }}
                      />
                    ) : null}
                    <div
                      className="h-full w-full items-center justify-center bg-primary/10 text-primary font-bold"
                      style={{ display: imageUrl ? "none" : "flex" }}
                    >
                      <Inventory2 className="size-6 text-primary/70" />
                    </div>
                  </div>
                  <div>
                    <h3 className="font-extrabold text-ink text-base">{name}</h3>
                    <p className="text-xs text-primary/80 font-bold mt-0.5">{categoryHierarchy}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Quantity: <strong className="text-ink">{item.quantity} units</strong> · {money(pricePerUnit)} per unit
                    </p>
                    {(item.hsnCode || taxRate > 0) && <p className="mt-1 text-xs text-muted-foreground">
                      {item.hsnCode && <>HSN: <strong className="text-ink">{item.hsnCode}</strong> · </>}
                      {taxRate > 0 && <>Tax: <strong className="text-ink">{taxLabel} ({money(taxAmount)})</strong></>}
                    </p>}
                  </div>
                </div>
                <div className="sm:text-right shrink-0">
                  <span className="text-xs text-muted-foreground block">Item Subtotal</span>
                  <strong className="text-lg font-black text-primary sm:text-ink">{money(itemSubtotal)}</strong>
                  {taxAmount > 0 && <span className="mt-1 block text-xs text-muted-foreground">Grand total {money(item.total || (item.priceIncludesTax ? itemSubtotal : itemSubtotal + taxAmount))}</span>}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}

export function CartPage() {
  const { cart, products, linkedWholesaler } = useStore();

  const groups = cart.reduce<Record<string, typeof cart>>((result, line) => {
    const product = products.find((item) => item.id === line.productId);
    if (!product) return result;
    const wholesalerId = product.wholesalerId;
    const current = result[wholesalerId] ?? [];
    result[wholesalerId] = [...current, line];
    return result;
  }, {});

  const total = cart.reduce((sum, line) => {
    const product = products.find((item) => item.id === line.productId);
    return sum + (product ? product.price * line.quantity : 0);
  }, 0);
  const savings = cart.reduce((sum, line) => {
    const product = products.find((item) => item.id === line.productId);
    if (!product) return sum;
    return sum + Math.max(0, product.mrp - product.price) * line.quantity;
  }, 0);
  const itemCount = cart.reduce((sum, line) => sum + line.quantity, 0);
  const wholesalerCount = Object.keys(groups).length;

  return (
    <main className="pb-16 sm:pb-20">
      <section className="border-b border-primary/10 bg-gradient-to-br from-canvas via-background to-primary/[0.045]">
        <div className="shell py-12 sm:py-16">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="max-w-2xl">
              <span className="inline-flex rounded-full bg-primary/10 px-3.5 py-1 text-[11px] font-extrabold uppercase tracking-[0.16em] text-primary">
                YOUR CART
              </span>
              <div className="mt-3 flex flex-wrap items-baseline gap-3">
                <h1 className="text-3xl font-black text-ink sm:text-4xl tracking-tight">Shopping Cart</h1>
                <span className="rounded-full bg-secondary px-3 py-1 text-xs font-extrabold text-secondary-foreground border border-border/80">
                  {itemCount} {itemCount === 1 ? "item" : "items"}
                </span>
              </div>
              <p className="mt-2.5 text-base text-muted-foreground">
                Review your items before checkout. Orders are split per wholesaler for direct fulfillment.
              </p>
              {cart.length > 0 && (
                <div className="mt-5 flex flex-wrap items-center gap-3 text-xs">
                  <span className="inline-flex items-center gap-1.5 rounded-xl bg-card border border-border/80 px-3.5 py-2 font-bold text-ink shadow-2xs">
                    <span className="text-primary font-black">{wholesalerCount}</span> {wholesalerCount === 1 ? "Wholesaler" : "Wholesalers"}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-xl bg-card border border-border/80 px-3.5 py-2 font-bold text-ink shadow-2xs">
                    <span className="text-primary font-black">{itemCount}</span> Total Items
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-xl bg-card border border-border/80 px-3.5 py-2 font-bold text-ink shadow-2xs">
                    <span className="text-primary font-black">{money(total)}</span> Subtotal
                  </span>
                </div>
              )}
            </div>

            <div className="grid gap-2.5 rounded-2xl border border-border/80 bg-card p-4 sm:p-5 shadow-xs shrink-0 max-w-xs text-xs">
              <div className="flex items-center gap-2.5">
                <Lock className="size-4 text-primary shrink-0" />
                <span className="font-bold text-ink">Secure wholesale checkout</span>
              </div>
              <div className="flex items-center gap-2.5">
                <VerifiedUser className="size-4 text-emerald-600 shrink-0" />
                <span className="text-muted-foreground">Verified suppliers only</span>
              </div>
              <div className="flex items-center gap-2.5">
                <LocalShipping className="size-4 text-primary shrink-0" />
                <span className="text-muted-foreground">Prices & SLA confirmed on approval</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="shell">
        {cart.length === 0 ? (
          <section className="mt-10 grid min-h-[420px] place-items-center rounded-2xl border border-dashed border-border/80 bg-card/60 p-8 text-center shadow-xs">
            <div className="max-w-md">
              <span className="mx-auto grid size-20 place-items-center rounded-full bg-primary/10 text-primary shadow-inner">
                <ShoppingCartOutlined className="size-10" />
              </span>
              <h2 className="mt-6 text-2xl font-black text-ink sm:text-3xl">Your cart is empty</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Add products from your connected wholesalers to get started.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-4">
                <Button asChild size="lg" className="rounded-xl bg-primary font-bold shadow-md">
                  <Link to="/products">Browse Products</Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="rounded-xl font-semibold">
                  <Link to="/wholesalers">View Wholesalers</Link>
                </Button>
              </div>
            </div>
          </section>
        ) : (
          <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1.85fr)_minmax(320px,1fr)] lg:gap-10">
            <section className="space-y-8">
              {Object.entries(groups).map(([wholesalerId, lines]) => {
                const wholesaler = linkedWholesaler || { id: wholesalerId, initials: "WS", name: "Connected wholesaler", verified: true, delivery: "Direct fulfillment" };
                const groupTotal = lines.reduce((sum, line) => {
                  const product = products.find((item) => item.id === line.productId);
                  return sum + (product ? product.price * line.quantity : 0);
                }, 0);

                return (
                  <article key={wholesalerId} className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm">
                    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border/70 bg-canvas/50 px-6 py-4.5 sm:px-7">
                      <div className="flex items-center gap-3.5">
                        <div className="grid size-11 place-items-center rounded-xl bg-gradient-to-br from-primary/15 to-ink/20 text-sm font-black text-primary border border-primary/20">
                          {wholesaler.initials}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <Link to="/wholesalers/$wholesalerId" params={{ wholesalerId: wholesaler.id }} className="font-black text-ink hover:text-primary sm:text-lg">
                              {wholesaler.name}
                            </Link>
                            {wholesaler.verified && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                                <Verified className="size-3 text-emerald-600" />
                                Verified
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 text-xs text-muted-foreground flex items-center gap-2">
                            <span>Orders fulfilled separately</span>
                            <span>•</span>
                            <span className="font-semibold text-foreground/80">{wholesaler.delivery}</span>
                          </p>
                        </div>
                      </div>
                      <span className="rounded-full bg-secondary px-3.5 py-1 text-xs font-bold text-secondary-foreground border border-border/60">
                        {lines.length} {lines.length === 1 ? "item" : "items"} ({money(groupTotal)})
                      </span>
                    </header>

                    <div className="px-6 sm:px-7">
                      {lines.map((line) => (
                        (() => {
                          const product = products.find((item) => item.id === line.productId);
                          return product ? <CartItem key={line.productId} product={product} quantity={line.quantity} /> : null;
                        })()
                      ))}
                    </div>
                  </article>
                );
              })}
            </section>

            <aside className="h-fit rounded-2xl border border-border/80 bg-card p-6 sm:p-7 shadow-sm lg:sticky lg:top-24 space-y-6">
              <div>
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-black text-ink">Order summary</h2>
                  <span className="rounded-full bg-primary/10 border border-primary/20 px-3 py-1 text-xs font-bold text-primary">
                    {wholesalerCount} {wholesalerCount === 1 ? "Wholesaler" : "Wholesalers"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Orders are split per wholesaler for direct fulfillment</p>
              </div>

              <div className="space-y-4 text-sm border-t border-border/70 pt-5">
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Subtotal</span>
                  <b className="font-bold text-ink">{money(total)}</b>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Estimated delivery</span>
                  <span className="text-right font-semibold text-emerald-600">Confirmed by each wholesaler</span>
                </div>
              </div>

              {savings > 0 && (
                <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/25 px-4 py-3 text-sm font-bold text-emerald-700 flex items-center gap-3">
                  <span className="grid size-6 place-items-center rounded-full bg-emerald-600 text-white font-black text-xs shrink-0">%</span>
                  <span>You’re saving {money(savings)} on this order</span>
                </div>
              )}

              <div className="border-t border-border/80 pt-5">
                <div className="flex items-baseline justify-between">
                  <div>
                    <span className="text-lg font-extrabold text-ink block">Total</span>
                    <span className="text-xs text-muted-foreground">All items & taxes included</span>
                  </div>
                  <strong className="text-2xl sm:text-3xl font-black text-primary">{money(total)}</strong>
                </div>
              </div>

              <Button asChild className="w-full rounded-xl bg-primary text-primary-foreground h-12 text-base font-extrabold" size="lg">
                <Link to="/checkout" className="flex items-center justify-center gap-2">Proceed to Checkout</Link>
              </Button>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}

export function CheckoutPage() {
  const { currentUser, cart, retailerProfile, placeOrder, products, refreshData, linkedWholesaler } = useStore();
  const checkoutIdempotencyRef = useRef<{ fingerprint: string; key: string } | null>(null);
  const [placed, setPlaced] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [paymentMode, setPaymentMode] = useState<"UPI" | "CREDIT" | "COD">("UPI");
  const [reportedOrder, setReportedOrder] = useState<{ id: string; number: string; amount: number } | null>(null);
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentScreenshot, setPaymentScreenshot] = useState<File | null>(null);
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const [qrSecondsLeft, setQrSecondsLeft] = useState(0);
  const [qrExpiresAt, setQrExpiresAt] = useState<number | null>(null);
  const [qrSessionImage, setQrSessionImage] = useState("");
  const [qrSessionLoading, setQrSessionLoading] = useState(false);
  const [qrImageError, setQrImageError] = useState(false);
  const queryClient = useQueryClient();

  const currentWholesalerId = useMemo(() => {
    if (linkedWholesaler?.id) return String(linkedWholesaler.id);
    if (linkedWholesaler?.userId) return String(linkedWholesaler.userId);
    const cartProduct = products.find((p) => cart.some((c) => c.productId === p.id));
    if (cartProduct?.wholesalerId) return String(cartProduct.wholesalerId);
    return "";
  }, [linkedWholesaler, products, cart]);

  const creditQuery = useQuery({
    queryKey: retailerQueryKeys.resource(currentUser?.id || "unknown", "credit"),
    queryFn: async () => (await api.getCreditInfo())?.data ?? null,
    enabled: Boolean(currentUser?.id),
    refetchInterval: 15000,
  });
  const creditInfo = creditQuery.data;
  const loadingCredit = creditQuery.isLoading;

  const paymentOptionsQuery = useQuery({
    queryKey: retailerQueryKeys.resource(currentUser?.id || "unknown", `payment-options-${currentWholesalerId || "default"}`),
    queryFn: async () => (await api.getRetailerPaymentOptions(currentWholesalerId || undefined)).data,
    enabled: Boolean(currentUser?.id),
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
  });
  const paymentOptions = paymentOptionsQuery.data;

  // Persistent QR image source:
  // Prioritizes session image, falls back to saved QR from payment options
  const activeQrImage = useMemo(() => {
    return qrSessionImage || paymentOptions?.qrDataUrl || paymentOptions?.qrImageUrl || "";
  }, [qrSessionImage, paymentOptions?.qrDataUrl, paymentOptions?.qrImageUrl]);

  const total = cart.reduce((sum, line) => {
    const product = products.find((item) => item.id === line.productId);
    return sum + (product ? product.price * line.quantity : 0);
  }, 0);

  useEffect(() => {
    if (creditQuery.error) console.error("Failed to load retailer credit data", creditQuery.error);
  }, [creditQuery.error]);

  const isCreditEnabled = Boolean(creditInfo?.creditEnabled);
  const availableCredit = Number(creditInfo?.availableCredit || 0);
  const minOrderForCredit = Number(creditInfo?.minOrderForCredit || 0);
  const creditPeriodDays = Number(creditInfo?.creditPeriodDays || 15);
  const effectiveLimit = Number(creditInfo?.effectiveLimit || 0);
  const outstanding = Number(creditInfo?.currentOutstandingAmount || 0);
  const [requestingCredit, setRequestingCredit] = useState(false);

  const meetsMinOrder = !minOrderForCredit || total >= minOrderForCredit;
  const isCreditEligible = isCreditEnabled && meetsMinOrder && availableCredit >= total;
  const hasDirectUpi = Boolean(paymentOptions?.qrPaymentsEnabled || paymentOptions?.upiIdPaymentsEnabled);

  useEffect(() => {
    if (!paymentOptionsQuery.isLoading && !hasDirectUpi && paymentMode === "UPI") setPaymentMode("COD");
  }, [paymentOptionsQuery.isLoading, hasDirectUpi, paymentMode]);

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + creditPeriodDays);
  const formattedDueDate = dueDate.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

  const [agreedToTerms, setAgreedToTerms] = useState(true);

  // Timer effect: counts down session seconds without wiping out the saved QR image
  useEffect(() => {
    if (!qrExpiresAt) return;
    const timer = window.setInterval(() => {
      const remaining = Math.max(0, Math.ceil((qrExpiresAt - Date.now()) / 1000));
      setQrSecondsLeft(remaining);
      if (remaining === 0) {
        setQrExpiresAt(null);
        // PERMANENT FIX: NEVER CLEAR THE QR IMAGE WHEN SESSION EXPIRES!
        // The QR code remains visible, and the retailer can scan or request a fresh timer.
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [qrExpiresAt]);

  const startQrSession = useCallback(async () => {
    if (!paymentOptions?.qrPaymentsEnabled || qrSessionLoading) return;
    setQrSessionLoading(true);
    setQrImageError(false);
    try {
      const session = (await api.createRetailerQrSession(currentWholesalerId || undefined)).data;
      const expiresAt = new Date(session.expiresAt).getTime();
      if (!session.qrDataUrl || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
        throw new Error("The wholesaler QR session could not be refreshed. Please try again.");
      }
      setQrSessionImage(session.qrDataUrl);
      setQrExpiresAt(expiresAt);
      setQrSecondsLeft(Math.ceil((expiresAt - Date.now()) / 1000));
    } catch (error) {
      // NOTE: Do NOT reset active QR image on error. The saved QR remains usable.
      toast.error(error instanceof Error ? error.message : "Unable to refresh QR session.");
    } finally {
      setQrSessionLoading(false);
    }
  }, [paymentOptions?.qrPaymentsEnabled, qrSessionLoading, currentWholesalerId]);

  // Automatically initialize session timer when QR payments are enabled and active QR is loaded
  useEffect(() => {
    if (paymentMode === "UPI" && paymentOptions?.qrPaymentsEnabled && !qrExpiresAt && !qrSessionLoading && activeQrImage) {
      void startQrSession();
    }
  }, [paymentMode, paymentOptions?.qrPaymentsEnabled, Boolean(activeQrImage)]);

  // Available Coupons & Offers State
  const [couponCodeInput, setCouponCodeInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [validatingCode, setValidatingCode] = useState<string | null>(null);
  const [showManualInput, setShowManualInput] = useState(false);

  const couponsQuery = useQuery({
    queryKey: retailerQueryKeys.resource(currentUser?.id || "unknown", "coupons"),
    queryFn: async () => {
      const res = await api.getCoupons();
      return (res?.data || []) as any[];
    },
    enabled: Boolean(currentUser?.id),
    staleTime: 30_000,
  });
  const availableCoupons = couponsQuery.data || [];
  const loadingCoupons = couponsQuery.isLoading;

  const handleApplyCoupon = async (codeToApply?: string) => {
    const rawCode = (codeToApply || couponCodeInput).trim().toUpperCase();
    if (!rawCode) {
      setCouponError("Please enter a coupon code");
      return;
    }
    setValidatingCode(rawCode);
    setCouponError(null);
    try {
      const res = await api.validateCoupon({
        code: rawCode,
        wholesalerId: linkedWholesaler?.id,
        subtotal: total,
      });
      if (res && res.success && res.data && res.data.valid) {
        setAppliedCoupon(res.data.coupon);
        setDiscountAmount(res.data.discountAmount);
        setCouponCodeInput(res.data.coupon.code);
        toast.success(`Coupon '${res.data.coupon.code}' applied! Saved ${money(res.data.discountAmount)}`);
      }
    } catch (err: any) {
      setCouponError(err?.message || "Invalid or ineligible coupon code");
      toast.error(err?.message || "Invalid or ineligible coupon code");
    } finally {
      setValidatingCode(null);
    }
  };

  const handleRemoveCoupon = () => {
    const prevCode = appliedCoupon?.code;
    setAppliedCoupon(null);
    setDiscountAmount(0);
    setCouponCodeInput("");
    setCouponError(null);
    if (prevCode) {
      toast.info(`Coupon '${prevCode}' removed`);
    }
  };

  const handleCreditRequest = async () => {
    setRequestingCredit(true);
    try {
      await api.requestCredit();
      await queryClient.invalidateQueries({ queryKey: retailerQueryKeys.resource(currentUser?.id || "unknown", "credit") });
      toast.success("Credit request sent to your wholesaler.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to request credit.");
    } finally {
      setRequestingCredit(false);
    }
  };

  useEffect(() => {
    if (appliedCoupon && appliedCoupon.minOrderValue > 0 && total < appliedCoupon.minOrderValue) {
      setAppliedCoupon(null);
      setDiscountAmount(0);
      setCouponError(`Coupon '${appliedCoupon.code}' was removed because order total is below ₹${appliedCoupon.minOrderValue}.`);
    }
  }, [total, appliedCoupon]);

  const finalTotal = Math.max(0, total - discountAmount);
  const checkoutStorageKey = `retailer-checkout-idempotency:${currentUser?.id || "unknown"}`;
  const clearCheckoutIdempotencyKey = () => {
    checkoutIdempotencyRef.current = null;
    try {
      sessionStorage.removeItem(checkoutStorageKey);
    } catch (error) {
      console.warn("Could not clear the saved checkout request key.", error);
    }
  };
  const getCheckoutIdempotencyKey = () => {
    const fingerprint = JSON.stringify({
      cart: cart.map((line) => [line.productId, line.quantity, line.color || ""]).sort(),
      paymentMode,
      couponCode: appliedCoupon?.code || "",
      address: [retailerProfile.address, retailerProfile.city, retailerProfile.state, retailerProfile.pincode],
    });
    if (checkoutIdempotencyRef.current?.fingerprint === fingerprint) return checkoutIdempotencyRef.current.key;

    try {
      const saved = sessionStorage.getItem(checkoutStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved) as { fingerprint?: string; key?: string };
        if (parsed.fingerprint === fingerprint && parsed.key) {
          checkoutIdempotencyRef.current = { fingerprint, key: parsed.key };
          return parsed.key;
        }
      }
    } catch (error) {
      console.warn("Could not read the saved checkout request key; using an in-memory key.", error);
    }

    const requestId = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const key = `retailer-checkout-${requestId}`;
    checkoutIdempotencyRef.current = { fingerprint, key };
    try {
      sessionStorage.setItem(checkoutStorageKey, JSON.stringify({ fingerprint, key }));
    } catch (error) {
      console.warn("Could not persist the checkout request key across reloads.", error);
    }
    return key;
  };

  const handlePlaceOrder = async () => {
    if (!agreedToTerms) {
      toast.error("Please agree to the Wholesaler Trade Terms & Privacy Policy.");
      return;
    }
    if (paymentMode === "CREDIT" && !isCreditEligible) {
      toast.error("You are not eligible for credit on this order.");
      return;
    }
    if (paymentMode === "UPI" && !hasDirectUpi) {
      toast.error("Your wholesaler has not configured UPI payments.");
      return;
    }
    setSubmitting(true);
    try {
      if (paymentMode === "CREDIT") {
        await placeOrder("CREDIT", appliedCoupon?.code);
        await refreshData(true);
        setPlaced(true);
        toast.success("Credit order placed successfully.");
      } else {
        const idempotencyKey = getCheckoutIdempotencyKey();
        const checkoutResponse = await api.checkout({
          items: cart.map((line) => ({ productId: line.productId, quantity: line.quantity })),
          shippingAddress: {
            addressLine1: retailerProfile.address || "Main Market Road",
            city: retailerProfile.city || "New Delhi",
            state: retailerProfile.state || "Delhi",
            postalCode: retailerProfile.pincode || "110001",
            pincode: retailerProfile.pincode || "110001",
            country: "India",
            contactName: retailerProfile.ownerName || "Retailer contact",
            phone: retailerProfile.phone || "",
          },
          paymentMethod: paymentMode,
          couponCode: appliedCoupon?.code,
          idempotencyKey,
        });
        await refreshData(true);
        const order = (checkoutResponse.data as any)?.order || checkoutResponse.data;
        if (paymentMode === "UPI") {
          const orderId = String(order?._id || order?.id || "");
          if (!orderId) throw new Error("The order was placed but its payment reference could not be loaded. Please check Orders.");
          clearCheckoutIdempotencyKey();
          setReportedOrder({
            id: orderId,
            number: String(order.orderNumber || orderId),
            amount: Number(order.grandTotal || order.total || finalTotal),
          });
          setPaymentAmount(Number(order.grandTotal || order.total || finalTotal).toFixed(2));
          toast.success("Order placed. Report your UPI payment for wholesaler verification.");
          if (paymentOptions?.qrPaymentsEnabled) void startQrSession();
          return;
        }
        clearCheckoutIdempotencyKey();
        toast.success("Order placed successfully.");
        setPlaced(true);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to complete checkout.");
    } finally {
      setSubmitting(false);
    }
  };

  const submitPaymentReport = async () => {
    if (!reportedOrder) return;
    if (paymentReference.trim().length < 4) {
      toast.error("Enter the UPI transaction/reference ID.");
      return;
    }
    setSubmitting(true);
    try {
      await api.createPaymentReport({
        orderId: reportedOrder.id,
        amount: paymentAmount || reportedOrder.amount.toFixed(2),
        transactionReference: paymentReference.trim(),
        screenshot: paymentScreenshot || undefined,
      });
      setReportSubmitted(true);
      await queryClient.invalidateQueries({ queryKey: retailerQueryKeys.resource(currentUser?.id || "unknown", "payment-reports") });
      toast.success("Payment report submitted. It remains pending until your wholesaler confirms receipt.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to submit payment report.");
    } finally {
      setSubmitting(false);
    }
  };

  const renderQrSection = () => {
    if (paymentOptionsQuery.isLoading) {
      return (
        <div className="flex items-center justify-center p-6 border rounded-xl bg-background/50 text-muted-foreground text-sm gap-2">
          <RefreshCw className="size-4 animate-spin text-primary" />
          <span>Loading wholesaler QR details…</span>
        </div>
      );
    }

    if (paymentOptionsQuery.isError) {
      return (
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-xs text-destructive flex items-center justify-between">
          <span>Failed to load payment options from wholesaler.</span>
          <button
            type="button"
            onClick={() => void paymentOptionsQuery.refetch()}
            className="font-bold underline ml-2"
          >
            Retry
          </button>
        </div>
      );
    }

    if (!paymentOptions?.qrPaymentsEnabled || !activeQrImage) {
      return (
        <div className="rounded-xl border bg-background p-4 text-xs text-muted-foreground space-y-1">
          <p className="font-semibold text-ink">QR Payments Not Available</p>
          <p>
            Your connected wholesaler has not uploaded or enabled a QR code.
            {paymentOptions?.upiIdPaymentsEnabled && paymentOptions.upiId
              ? " You can still pay using their verified UPI ID above."
              : " Please contact the wholesaler for alternate payment instructions."}
          </p>
        </div>
      );
    }

    return (
      <div className="rounded-xl border border-primary/20 bg-background p-4 space-y-3">
        <div className="flex items-center justify-between border-b pb-2">
          <div className="flex items-center gap-1.5">
            <QrCode className="size-4 text-primary" />
            <span className="text-xs font-bold text-ink">Wholesaler UPI QR Code</span>
          </div>
          {qrSecondsLeft > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-extrabold text-emerald-700 border border-emerald-500/20">
              <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Session: {Math.floor(qrSecondsLeft / 60)}:{String(qrSecondsLeft % 60).padStart(2, "0")}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-700 border border-amber-500/20">
              Session Expired
            </span>
          )}
        </div>

        <div className="text-center py-2">
          {qrImageError ? (
            <div className="p-4 border rounded-lg bg-destructive/5 text-destructive text-xs">
              <p className="font-bold">Unable to render QR image.</p>
              <button
                type="button"
                onClick={() => {
                  setQrImageError(false);
                  void startQrSession();
                }}
                className="mt-2 rounded bg-primary text-primary-foreground px-3 py-1 font-bold text-[11px]"
              >
                Retry Loading QR
              </button>
            </div>
          ) : (
            <div className="relative inline-block mx-auto">
              <img
                src={activeQrImage}
                alt="Wholesaler UPI QR code"
                onError={() => setQrImageError(true)}
                className="mx-auto max-h-56 max-w-full rounded-xl border bg-white p-2 shadow-xs object-contain"
              />
              {qrSessionLoading && (
                <div className="absolute inset-0 bg-white/70 backdrop-blur-xs flex items-center justify-center rounded-xl">
                  <RefreshCw className="size-6 text-primary animate-spin" />
                </div>
              )}
            </div>
          )}

          <div className="mt-3 space-y-1">
            <p className="text-xs font-semibold text-ink">
              Scan with any UPI app (GPay, PhonePe, Paytm, BHIM)
            </p>
            <p className="text-[11px] text-muted-foreground max-w-sm mx-auto">
              {qrSecondsLeft > 0
                ? `QR display expires in ${Math.floor(qrSecondsLeft / 60)}:${String(qrSecondsLeft % 60).padStart(2, "0")}. Display expiry only closes this session timer; your wholesaler's saved QR remains valid.`
                : "Display session expired. The saved QR code above is still valid to scan and pay. You can refresh the session timer below."}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-center pt-1 border-t">
          <button
            type="button"
            onClick={() => void startQrSession()}
            disabled={qrSessionLoading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/5 hover:bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary transition-colors disabled:opacity-60"
          >
            <RefreshCw className={`size-3.5 ${qrSessionLoading ? "animate-spin" : ""}`} />
            {qrSessionLoading
              ? "Refreshing Session…"
              : qrSecondsLeft > 0
              ? "Refresh Session Timer"
              : "Request Fresh QR Session"}
          </button>
        </div>
      </div>
    );
  };

  if (placed) {
    return (
      <main className="shell py-16">
        <div className="mx-auto max-w-xl border bg-card p-8 text-center rounded-2xl shadow-sm">
          <span className="mx-auto grid size-14 place-items-center bg-success text-success-foreground rounded-full"><Check /></span>
          <h1 className="mt-5 text-3xl font-extrabold text-ink">Order Placed Successfully</h1>
          <p className="mt-3 text-muted-foreground">
            {paymentMode === "CREDIT"
              ? `Your Credit order has been recorded with a payment due date of ${formattedDueDate}.`
              : "Your order has been placed."}
          </p>
          <Button asChild className="mt-6 rounded-xl font-extrabold"><Link to="/orders">View Orders</Link></Button>
        </div>
      </main>
    );
  }

  return (
    <main className="shell py-10">
      <h1 className="text-3xl font-extrabold text-ink">Checkout</h1>
      <p className="mt-1 text-sm text-muted-foreground">Select delivery address and payment method.</p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_380px]">
        <section className="space-y-6">
          <div className="border bg-card p-6 rounded-2xl shadow-2xs">
            <h2 className="text-xl font-bold text-ink">Delivery address</h2>
            <div className="mt-4 border border-primary/20 bg-primary/5 p-4 rounded-xl">
              <b className="text-ink">{retailerProfile.businessName}</b>
              <p className="mt-1 text-sm text-muted-foreground">
                {retailerProfile.ownerName}<br />
                {retailerProfile.address}, {retailerProfile.city}, {retailerProfile.state} {retailerProfile.pincode}<br />
                Phone: {retailerProfile.phone}
              </p>
            </div>
          </div>

          <div className="border bg-card p-6 rounded-2xl shadow-2xs space-y-4">
            <h2 className="text-xl font-bold text-ink">Payment Method</h2>

            <div
              className={`border p-4 rounded-xl transition-all ${
                paymentMode === "UPI" ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border/80"
              } ${hasDirectUpi ? "cursor-pointer hover:bg-muted/30" : "cursor-not-allowed opacity-60"}`}
              onClick={() => hasDirectUpi && setPaymentMode("UPI")}
            >
              <div className="flex items-start gap-3">
                <input
                  type="radio"
                  name="payment"
                  disabled={!hasDirectUpi}
                  checked={paymentMode === "UPI"}
                  onChange={() => hasDirectUpi && setPaymentMode("UPI")}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <b className="block text-ink text-sm">UPI / QR Code</b>
                    {hasDirectUpi && (
                      <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-extrabold text-emerald-700 border border-emerald-500/20">
                        Scan & Pay
                      </span>
                    )}
                  </div>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {hasDirectUpi
                      ? `Pay ${paymentOptions?.accountName || paymentOptions?.businessName || "wholesaler"} directly, then enter UPI reference.`
                      : "UPI / QR payment is not enabled by wholesaler."}
                  </span>

                  {paymentMode === "UPI" && hasDirectUpi && (
                    <div className="mt-4 pt-4 border-t border-primary/20 space-y-3" onClick={(e) => e.stopPropagation()}>
                      {paymentOptions?.upiId && (
                        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-background p-3">
                          <div>
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground block">Wholesaler UPI ID</span>
                            <span className="text-sm font-bold text-ink">{paymentOptions.upiId}</span>
                          </div>
                          {paymentOptions.upiIdPaymentsEnabled && (
                            <button
                              type="button"
                              className="rounded border border-primary/30 bg-primary/5 hover:bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary transition-colors"
                              onClick={() => {
                                void navigator.clipboard.writeText(paymentOptions.upiId).then(() => toast.success("UPI ID copied."));
                              }}
                            >
                              Copy UPI ID
                            </button>
                          )}
                        </div>
                      )}

                      {renderQrSection()}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <label
              className={`flex items-start gap-3 border p-4 rounded-xl cursor-pointer transition-all ${
                paymentMode === "COD" ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border/80 hover:bg-muted/30"
              }`}
              onClick={() => setPaymentMode("COD")}
            >
              <input type="radio" name="payment" checked={paymentMode === "COD"} onChange={() => setPaymentMode("COD")} className="mt-1" />
              <div>
                <b className="block text-ink text-sm">Cash on Delivery</b>
                <span className="mt-0.5 block text-xs text-muted-foreground">Pay on delivery.</span>
              </div>
            </label>

            <div
              className={`border p-4 rounded-xl transition-all ${
                paymentMode === "CREDIT"
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : isCreditEligible
                  ? "border-border/80 cursor-pointer hover:bg-muted/30"
                  : "border-border/40 bg-muted/20 opacity-70"
              }`}
              onClick={() => isCreditEligible && setPaymentMode("CREDIT")}
            >
              <div className="flex items-start gap-3">
                <input
                  type="radio"
                  name="payment"
                  disabled={!isCreditEligible}
                  checked={paymentMode === "CREDIT"}
                  onChange={() => isCreditEligible && setPaymentMode("CREDIT")}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <b className="text-ink text-sm">Credit</b>
                    {isCreditEligible ? (
                      <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-extrabold text-emerald-700 border border-emerald-500/20">
                        {creditPeriodDays} Days Credit
                      </span>
                    ) : (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                        Not Eligible
                      </span>
                    )}
                  </div>

                  <p className="mt-1 text-xs text-muted-foreground">
                    Buy now and pay within <strong>{creditPeriodDays} days</strong>.
                  </p>

                  {isCreditEligible && paymentMode === "CREDIT" && (
                    <div className="mt-3 rounded-xl border border-primary/20 bg-background p-3 text-xs space-y-1.5">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Due Date:</span>
                        <strong className="text-ink font-extrabold">{formattedDueDate}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Credit Limit:</span>
                        <b className="text-ink font-bold">{money(effectiveLimit)}</b>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Outstanding:</span>
                        <b className="text-ink font-bold">{money(outstanding)}</b>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Available Credit:</span>
                        <b className="text-emerald-600 font-bold">{money(availableCredit)}</b>
                      </div>
                      <div className="flex justify-between border-t pt-1.5">
                        <span className="text-muted-foreground">Remaining After Order:</span>
                        <b className="text-ink font-bold">{money(Math.max(0, availableCredit - finalTotal))}</b>
                      </div>

                    </div>
                  )}

                  {!loadingCredit && !isCreditEnabled && (
                    <div className="mt-2 text-[11px] font-semibold text-amber-700">
                      {creditInfo?.creditStatus === "PENDING_APPROVAL"
                        ? "Your credit request is pending wholesaler approval."
                        : "Credit is not currently enabled for your account."}
                      {creditInfo?.creditStatus !== "PENDING_APPROVAL" && (
                        <button type="button" onClick={() => void handleCreditRequest()} disabled={requestingCredit} className="ml-2 underline">
                          {requestingCredit ? "Requesting…" : "Request credit"}
                        </button>
                      )}
                    </div>
                  )}

                  {!loadingCredit && isCreditEnabled && !meetsMinOrder && (
                    <div className="mt-2 text-[11px] font-semibold text-amber-700">
                      ⚠️ Minimum order value for credit purchase is {money(minOrderForCredit)}.
                    </div>
                  )}

                  {!loadingCredit && isCreditEnabled && meetsMinOrder && availableCredit < finalTotal && (
                    <div className="mt-2 text-[11px] font-semibold text-amber-700">
                      🚫 Order total ({money(finalTotal)}) exceeds your available credit limit ({money(availableCredit)}). Outstanding: {money(outstanding)} / Limit: {money(effectiveLimit)}.
                    </div>
                  )}
                </div>
              </div>
            </div>
            {reportedOrder && (
              <div className="space-y-4 rounded-xl border border-primary/20 bg-primary/[0.03] p-4">
                <div>
                  <h3 className="font-bold text-ink">Pay your wholesaler directly</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Order {reportedOrder.number} · Exact order total {money(reportedOrder.amount)} · Account {paymentOptions?.accountName || paymentOptions?.businessName || "Wholesaler"}
                  </p>
                </div>
                {paymentOptions?.upiId && (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-background p-3">
                    <div>
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground block">Wholesaler UPI ID</span>
                      <span className="text-sm font-bold text-ink">{paymentOptions.upiId}</span>
                    </div>
                    {paymentOptions.upiIdPaymentsEnabled && (
                      <button
                        type="button"
                        className="rounded border border-primary/30 bg-primary/5 hover:bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary transition-colors"
                        onClick={() => {
                          void navigator.clipboard.writeText(paymentOptions.upiId).then(() => toast.success("UPI ID copied."));
                        }}
                      >
                        Copy UPI ID
                      </button>
                    )}
                  </div>
                )}
                {renderQrSection()}
                {!reportSubmitted ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="text-xs font-bold text-ink">Amount paid (₹)
                      <Input type="number" min="0.01" max={reportedOrder.amount} step="0.01" value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} />
                    </label>
                    <label className="text-xs font-bold text-ink">UPI transaction / reference ID
                      <Input value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} placeholder="Enter your UPI reference" />
                    </label>
                    <label className="text-xs font-bold text-ink sm:col-span-2">Payment screenshot (optional)
                      <Input type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" onChange={(event) => setPaymentScreenshot(event.target.files?.[0] || null)} />
                    </label>
                    <Button type="button" onClick={() => void submitPaymentReport()} disabled={submitting} className="sm:col-span-2">
                      {submitting ? "Submitting…" : "Report Payment for Verification"}
                    </Button>
                  </div>
                ) : (
                  <p className="rounded-lg bg-amber-50 p-3 text-sm font-semibold text-amber-900">Payment status: Pending Verification. The order will be marked paid only after your wholesaler confirms receipt.</p>
                )}
              </div>
            )}
          </div>
        </section>

        <aside className="h-fit border bg-card p-6 rounded-2xl shadow-2xs space-y-4">
          <h2 className="text-xl font-bold text-ink">Order summary</h2>

          {/* Available Coupons & Offers Section */}
          <div className="border border-primary/20 bg-primary/[0.03] p-4 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <LocalOffer className="!size-4 text-emerald-600" />
                <span className="text-xs font-extrabold uppercase tracking-wide text-ink">
                  Available Coupons & Offers
                </span>
              </div>
              {availableCoupons.length > 0 && (
                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-black text-emerald-700 dark:text-emerald-300">
                  {availableCoupons.length} offer{availableCoupons.length === 1 ? "" : "s"}
                </span>
              )}
            </div>

            {/* Active Applied Coupon Banner */}
            {appliedCoupon && (
              <div className="rounded-xl border border-emerald-500/40 bg-emerald-50/80 dark:bg-emerald-950/40 p-2.5 shadow-2xs">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-black text-white">
                      ✓
                    </span>
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono font-black text-xs uppercase text-emerald-900 dark:text-emerald-100">
                          {appliedCoupon.code}
                        </span>
                        <span className="rounded bg-emerald-600 px-1.5 py-0.5 text-[9px] font-extrabold text-white">
                          APPLIED
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11px] font-medium text-emerald-800 dark:text-emerald-200">
                        Saving <b className="font-bold">{money(discountAmount)}</b> on this order
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleRemoveCoupon}
                    className="text-xs font-bold text-rose-600 hover:text-rose-700 hover:underline shrink-0 px-1 py-0.5 cursor-pointer"
                  >
                    Remove
                  </button>
                </div>
              </div>
            )}

            {/* Coupons List */}
            {loadingCoupons ? (
              <div className="space-y-2">
                {[1, 2].map((i) => (
                  <div key={i} className="animate-pulse rounded-xl border border-border/60 bg-muted/40 p-3 h-16" />
                ))}
              </div>
            ) : availableCoupons.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/80 bg-muted/20 p-3.5 text-center">
                <LocalOffer className="mx-auto !size-5 text-muted-foreground/50" />
                <p className="mt-1 text-xs font-bold text-ink">No offers available for this order</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Check back later or enter a promo code below
                </p>
              </div>
            ) : (
              <div className="max-h-56 overflow-y-auto space-y-2 pr-1 -mr-1">
                {availableCoupons.map((coupon: any) => {
                  const isApplied = appliedCoupon?.code === coupon.code;
                  const meetsMinOrder = !coupon.minOrderValue || total >= coupon.minOrderValue;
                  const isDateValid = !coupon.validUntil || new Date(coupon.validUntil) >= new Date();
                  const isEligible = coupon.isAvailable && meetsMinOrder && isDateValid;
                  const isValidatingThis = validatingCode === coupon.code;

                  let discountBadge = "";
                  if (coupon.discountType === "PERCENTAGE" || coupon.discountType === "PERCENT") {
                    discountBadge = `${coupon.discountValue}% OFF`;
                  } else {
                    discountBadge = `₹${coupon.discountValue} FLAT OFF`;
                  }

                  const expiryFormatted = coupon.validUntil
                    ? new Date(coupon.validUntil).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })
                    : null;

                  return (
                    <div
                      key={coupon._id || coupon.code}
                      className={cn(
                        "relative rounded-xl border p-2.5 transition-all text-xs",
                        isApplied
                          ? "border-emerald-500 bg-emerald-500/5 ring-1 ring-emerald-500/20"
                          : isEligible
                          ? "border-border/80 bg-card hover:border-emerald-500/40 hover:shadow-2xs"
                          : "border-border/50 bg-muted/20 opacity-80"
                      )}
                    >
                      {/* Top Row: Code Badge, Discount Highlight, Action */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono text-xs font-black uppercase tracking-wider px-2 py-0.5 rounded border border-dashed border-emerald-600/50 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200">
                            {coupon.code}
                          </span>
                          <span className="text-[11px] font-extrabold text-emerald-600 dark:text-emerald-400">
                            {discountBadge}
                          </span>
                        </div>

                        {isApplied ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 dark:bg-emerald-900/60 dark:text-emerald-300 px-2 py-0.5 rounded-full">
                            <Check className="!size-3" /> Applied
                          </span>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            disabled={!isEligible || Boolean(validatingCode)}
                            onClick={() => handleApplyCoupon(coupon.code)}
                            className={cn(
                              "h-7 px-2.5 text-xs font-bold rounded-lg cursor-pointer transition-all",
                              isEligible
                                ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs active:scale-95"
                                : "opacity-50 cursor-not-allowed bg-muted text-muted-foreground"
                            )}
                          >
                            {isValidatingThis ? "Applying..." : "Apply"}
                          </Button>
                        )}
                      </div>

                      {/* Title & Description */}
                      <div className="mt-1">
                        <b className="block text-xs font-bold text-ink leading-tight">
                          {coupon.title}
                        </b>
                        {coupon.description && (
                          <p className="mt-0.5 text-[11px] text-muted-foreground leading-snug line-clamp-1">
                            {coupon.description}
                          </p>
                        )}
                      </div>

                      {/* Criteria summary */}
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[10px] text-muted-foreground font-medium pt-1 border-t border-border/40">
                        {coupon.minOrderValue > 0 && (
                          <span>Min order: <strong className="text-ink">{money(coupon.minOrderValue)}</strong></span>
                        )}
                        {coupon.maxDiscountCap > 0 && (
                          <span>Max cap: <strong className="text-ink">{money(coupon.maxDiscountCap)}</strong></span>
                        )}
                        {expiryFormatted && (
                          <span>Valid till: <strong className="text-ink">{expiryFormatted}</strong></span>
                        )}
                      </div>

                      {/* Ineligibility Reason */}
                      {!meetsMinOrder && (
                        <div className="mt-1.5 rounded-md bg-amber-500/10 px-2 py-1 text-[10px] font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-1">
                          <span>⚠️</span>
                          <span>
                            Add <strong>{money(coupon.minOrderValue - total)}</strong> more to unlock this offer
                          </span>
                        </div>
                      )}

                      {!coupon.isAvailable && coupon.unavailableReason && (
                        <div className="mt-1.5 rounded-md bg-rose-500/10 px-2 py-1 text-[10px] font-semibold text-rose-800 dark:text-rose-300">
                          ⚠️ {coupon.unavailableReason}
                        </div>
                      )}

                      {!isDateValid && (
                        <div className="mt-1.5 rounded-md bg-rose-500/10 px-2 py-1 text-[10px] font-semibold text-rose-800 dark:text-rose-300">
                          ⚠️ This offer has expired
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Manual Coupon Input Toggle */}
            <div className="pt-1">
              {!showManualInput ? (
                <button
                  type="button"
                  onClick={() => setShowManualInput(true)}
                  className="text-[11px] font-bold text-primary hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  <span>Have an unlisted promo code?</span>
                  <ChevronDown className="size-3" />
                </button>
              ) : (
                <div className="space-y-1.5 pt-1.5 border-t border-border/60">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-muted-foreground">Enter promo code</span>
                    <button
                      type="button"
                      onClick={() => {
                        setShowManualInput(false);
                        setCouponError(null);
                      }}
                      className="text-[10px] text-muted-foreground hover:text-ink font-semibold cursor-pointer"
                    >
                      Hide
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="e.g. DIWALI50"
                      value={couponCodeInput}
                      onChange={(e) => {
                        setCouponCodeInput(e.target.value.toUpperCase());
                        setCouponError(null);
                      }}
                      className="flex-1 rounded-lg border bg-background px-3 py-1 text-xs font-mono font-bold uppercase focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                    <Button
                      type="button"
                      onClick={() => handleApplyCoupon(couponCodeInput)}
                      disabled={Boolean(validatingCode) || !couponCodeInput.trim()}
                      size="sm"
                      className="h-8 px-3 rounded-lg font-bold text-xs"
                    >
                      {validatingCode === couponCodeInput ? "Applying..." : "Apply"}
                    </Button>
                  </div>
                  {couponError && (
                    <p className="text-[11px] font-semibold text-rose-600 dark:text-rose-400">⚠️ {couponError}</p>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-3 border-y border-border/80 py-4 max-h-60 overflow-y-auto">
            {cart.map((line) => {
              const p = products.find((product) => product.id === line.productId);
              if (!p) return null;
              return (
                <div key={line.productId} className="flex justify-between gap-4 text-xs">
                  <span className="truncate">{p.name} × {line.quantity}</span>
                  <b className="font-bold text-ink whitespace-nowrap">{money(p.price * line.quantity)}</b>
                </div>
              );
            })}
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal:</span>
              <strong className="text-ink">{money(total)}</strong>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-emerald-700 font-bold">
                <span>Discount ({appliedCoupon?.code}):</span>
                <span>-{money(discountAmount)}</span>
              </div>
            )}
          </div>

          <div className="flex justify-between items-baseline text-lg pt-2 border-t">
            <span className="font-extrabold text-ink">Total</span>
            <strong className="text-2xl font-black text-primary">{money(finalTotal)}</strong>
          </div>

          <label className="flex items-start gap-2 text-xs text-muted-foreground font-medium pt-1 cursor-pointer">
            <input
              type="checkbox"
              checked={agreedToTerms}
              onChange={(e) => setAgreedToTerms(e.target.checked)}
              className="mt-0.5 rounded border-gray-300 accent-primary cursor-pointer"
            />
            <span>
              I agree to trade terms, payment due dates & <strong className="text-ink">Privacy Policy</strong>.
            </span>
          </label>

          {!reportedOrder && (
            <Button className="w-full rounded-xl font-extrabold" size="lg" onClick={handlePlaceOrder} disabled={submitting}>
              {submitting ? "Processing..." : "Place Order"}
            </Button>
          )}
        </aside>
      </div>
    </main>
  );
}

export function WishlistPage() {
  const { wishlist, products } = useStore();
  const saved = products.filter((p) => wishlist.includes(p.id));
  const totalValue = saved.reduce((sum, p) => sum + p.price, 0);

  return (
    <main className="pb-16 sm:pb-20">
      <section className="border-b border-primary/10 bg-gradient-to-br from-canvas via-background to-primary/[0.045]">
        <div className="shell py-12 sm:py-16">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="max-w-2xl">
              <span className="inline-flex rounded-full bg-primary/10 px-3.5 py-1 text-[11px] font-extrabold uppercase tracking-[0.16em] text-primary">
                SAVED FOR LATER
              </span>
              <div className="mt-3 flex flex-wrap items-baseline gap-3">
                <h1 className="text-3xl font-black text-ink sm:text-4xl tracking-tight">Your Wishlist</h1>
                <span className="rounded-full bg-secondary px-3 py-1 text-xs font-extrabold text-secondary-foreground border border-border/80">
                  {saved.length} {saved.length === 1 ? "item" : "items"}
                </span>
              </div>
              <p className="mt-2.5 text-base text-muted-foreground">
                Products saved for your next store restock. Access pricing and stock anytime.
              </p>
              {saved.length > 0 && (
                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <div className="inline-flex items-center gap-2 rounded-xl bg-card border border-border/80 px-4 py-2 text-xs">
                    <span className="text-muted-foreground font-medium">Total estimated value:</span>
                    <strong className="text-sm font-black text-primary">{money(totalValue)}</strong>
                  </div>
                </div>
              )}
            </div>
            <div className="hidden md:grid size-24 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-primary/15 via-primary/5 to-ink/10 text-primary border border-primary/20">
              <Favorite className="size-12 fill-primary text-primary" />
            </div>
          </div>
        </div>
      </section>

      <div className="shell mt-10">
        {saved.length ? (
          <ProductGrid products={saved} premium />
        ) : (
          <section className="grid min-h-96 place-items-center rounded-2xl border border-dashed border-border/80 bg-canvas/60 p-8 text-center">
            <div>
              <span className="mx-auto grid size-16 place-items-center rounded-full bg-primary/10 text-primary">
                <FavoriteBorder className="size-8" />
              </span>
              <h2 className="mt-5 text-2xl font-extrabold text-ink">Your wishlist is empty</h2>
              <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
                Save products you want to reorder later by clicking the heart icon on any product card.
              </p>
              <Button asChild className="mt-6 rounded-xl font-bold">
                <Link to="/products">Browse Products</Link>
              </Button>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

export function NotificationsPage() {
  const { notifications, markRead, unread } = useStore();

  return (
    <main className="pb-16 sm:pb-20">
      <section className="border-b border-primary/10 bg-gradient-to-br from-canvas via-background to-primary/[0.045]">
        <div className="shell py-12 sm:py-16">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="max-w-2xl">
              <span className="inline-flex rounded-full bg-primary/10 px-3.5 py-1 text-[11px] font-extrabold uppercase tracking-[0.16em] text-primary">
                NOTIFICATIONS
              </span>
              <div className="mt-3 flex flex-wrap items-baseline gap-3">
                <h1 className="text-3xl font-black text-ink sm:text-4xl tracking-tight">Stay Updated</h1>
                {unread > 0 && (
                  <span className="rounded-full bg-primary text-primary-foreground px-3 py-1 text-xs font-extrabold">
                    {unread} new {unread === 1 ? "notification" : "notifications"}
                  </span>
                )}
              </div>
              <p className="mt-2.5 text-base text-muted-foreground">
                Updates about orders, connection access requests, price drops and trade terms.
              </p>
              <div className="mt-5">
                <Button variant="outline" size="sm" onClick={markRead} className="rounded-xl font-bold border-border">
                  Mark all as read
                </Button>
              </div>
            </div>

            <div className="hidden md:grid size-24 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-primary/15 via-primary/5 to-ink/10 text-primary border border-primary/20">
              <Notifications className="size-12 text-primary" />
            </div>
          </div>
        </div>
      </section>

      <div className="shell mt-8">
        <div className="grid gap-3 max-w-3xl">
          {notifications.length > 0 ? (
            notifications.map((n) => (
              <div
                key={n.id}
                className={`flex gap-4 rounded-2xl border p-5 transition-all ${
                  n.unread ? "bg-card border-primary/30 shadow-2xs" : "bg-canvas/60 border-border/70"
                }`}
              >
                <span className={`mt-1.5 size-2.5 shrink-0 rounded-full ${n.unread ? "bg-primary" : "bg-muted-foreground/30"}`} />
                <div className="flex-1">
                  <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 sm:gap-3">
                    <b className="font-extrabold text-ink text-base">{n.title}</b>
                    <span className="text-xs text-muted-foreground shrink-0">{n.time}</span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{n.body}</p>
                </div>
              </div>
            ))
          ) : (
            <div className="p-8 text-center text-sm text-muted-foreground border border-dashed rounded-2xl">
              No notifications yet.
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

export function ProfilePage({ setupMode = false }: { setupMode?: boolean }) {
  const { retailerProfile, saveProfile, linkedWholesaler, currentUser } = useStore();
  const navigate = useNavigate();
  const [form, setForm] = useState<RetailerProfile>(retailerProfile);
  const [identity, setIdentity] = useState<{
    pan: { number: string; last4: string; hasImage: boolean };
    aadhaar: { last4: string; hasFrontImage: boolean; hasBackImage: boolean };
    shopPhoto: { hasImage: boolean };
    consent: { accepted: boolean; at: string | null };
    verificationStatus: string;
    verificationNote: string;
    documentsSubmitted: boolean;
  } | null>(null);
  const [panDraft, setPanDraft] = useState("");
  const [aadhaarDraft, setAadhaarDraft] = useState("");
  const [identityConsent, setIdentityConsent] = useState(false);
  const [shopPhotoFile, setShopPhotoFile] = useState<File>();
  const [panImageFile, setPanImageFile] = useState<File>();
  const [aadhaarFrontFile, setAadhaarFrontFile] = useState<File>();
  const [aadhaarBackFile, setAadhaarBackFile] = useState<File>();
  const [identitySaving, setIdentitySaving] = useState(false);
  const setupBlankProfile = (profile: RetailerProfile): RetailerProfile => ({
    ...profile,
    businessName: "",
    ownerName: "",
    phone: "",
    gstNumber: "",
    businessType: "",
    category: "",
    address: "",
    city: "",
    state: "",
    pincode: "",
  });
  const isTemporaryProfile = setupMode && !retailerProfile.profileComplete && !retailerProfile.address?.trim();
  const categories = ["Grocery & Staples", "Garments & Fashion", "Electronics", "Home & Kitchen", "Mobile Accessories", "Footwear", "Stationery", "Hardware", "Pharmacy", "Beauty & Personal Care", "General Store", "Other"];
  const businessTypes = ["Kirana / General Store", "Independent retailer", "Supermarket", "Boutique", "Electronics store", "Mobile shop", "Distributor outlet", "Pharmacy", "Restaurant / Cafe", "Other"];

  useEffect(() => {
    setForm(isTemporaryProfile ? setupBlankProfile(retailerProfile) : retailerProfile);
  }, [retailerProfile, isTemporaryProfile]);

  useEffect(() => {
    const retailerId = currentUser?.id;
    if (!retailerId) return;
    let active = true;
    void api.getRetailerIdentityProfile(retailerId)
      .then((response) => {
        if (!active) return;
        setIdentity(response.data);
        setIdentityConsent(response.data.consent.accepted);
        setPanDraft(response.data.pan.number || "");
      })
      .catch((error: unknown) => {
        if (active) toast.error(error instanceof Error ? error.message : "Unable to load identity details.");
      });
    return () => {
      active = false;
    };
  }, [currentUser?.id]);

  const selectIdentityFile = (
    event: React.ChangeEvent<HTMLInputElement>,
    update: (file: File | undefined) => void,
  ) => {
    const file = event.target.files?.[0];
    if (!file) {
      update(undefined);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      event.target.value = "";
      update(undefined);
      toast.error("Each file must be 5 MB or smaller.");
      return;
    }
    update(file);
  };

  const saveIdentityDetails = async (event: React.FormEvent) => {
    event.preventDefault();
    if (
      (panDraft ||
        aadhaarDraft ||
        shopPhotoFile ||
        panImageFile ||
        aadhaarFrontFile ||
        aadhaarBackFile) &&
      !identityConsent
    ) {
      toast.error("Please accept the consent to save shop or identity documents.");
      return;
    }
    if (!currentUser?.id) {
      toast.error("Your retailer session is unavailable. Please sign in again.");
      return;
    }
    const data = new FormData();
    data.append("identityConsent", String(identityConsent));
    if (panDraft.trim()) data.append("panNumber", panDraft.trim().toUpperCase());
    if (aadhaarDraft.trim()) data.append("aadhaarNumber", aadhaarDraft.trim());
    if (shopPhotoFile) data.append("shopPhoto", shopPhotoFile);
    if (panImageFile) data.append("panImage", panImageFile);
    if (aadhaarFrontFile) data.append("aadhaarFront", aadhaarFrontFile);
    if (aadhaarBackFile) data.append("aadhaarBack", aadhaarBackFile);

    setIdentitySaving(true);
    try {
      const response = await api.updateRetailerIdentity(currentUser.id, data);
      setIdentity(response.data);
      setPanDraft("");
      setAadhaarDraft("");
      setShopPhotoFile(undefined);
      setPanImageFile(undefined);
      setAadhaarFrontFile(undefined);
      setAadhaarBackFile(undefined);
      toast.success("Identity details saved securely.");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Unable to save identity details.");
    } finally {
      setIdentitySaving(false);
    }
  };

  const completionItems = [
    ["Business name", Boolean(form.businessName)],
    ["Owner name", Boolean(form.ownerName)],
    ["Mobile number", Boolean(form.phone)],
    ["Email address", Boolean(form.email)],
    ["Shop address", Boolean(form.address)],
    ["City", Boolean(form.city)],
    ["State", Boolean(form.state)],
    ["Pincode", Boolean(form.pincode)],
    ["Business type (optional)", Boolean(form.businessType)],
    ["GSTIN (optional)", Boolean(form.gstNumber)],
    ["Shop photo (optional)", Boolean(identity?.shopPhoto.hasImage)],
    ["PAN number (optional)", Boolean(identity?.pan.last4)],
    ["PAN card image (optional)", Boolean(identity?.pan.hasImage)],
    ["Aadhaar number (optional)", Boolean(identity?.aadhaar.last4)],
    ["Aadhaar front (optional)", Boolean(identity?.aadhaar.hasFrontImage)],
    ["Aadhaar back (optional)", Boolean(identity?.aadhaar.hasBackImage)],
  ] as const;
  const completedItems = completionItems.filter(([, complete]) => complete).length;
  const completionPercent = Math.round((completedItems / completionItems.length) * 100);
  const missingItems = completionItems.filter(([, complete]) => !complete).map(([label]) => label);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await saveProfile(form);
      if (setupMode) navigate({ to: "/dashboard" });
    } catch (err: any) {
      toast.error(err?.message || "Unable to save business setup");
    }
  };

  return (
    <main className="shell py-10">
      <h1 className="text-3xl font-extrabold text-ink">{setupMode ? "Complete business setup" : "Business profile"}</h1>
      <p className="mt-2 text-muted-foreground">
        {setupMode
          ? "Apni business details complete karo. Iske baad store products, orders, cart aur baaki pages unlock honge."
          : "Keep your retailer details ready for every wholesale order."}
      </p>
      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_300px]">
        <section className="border bg-card p-6">
          <h2 className="text-xl font-bold">Business information</h2>
          <form className="mt-5 grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit}>
            <label className="text-sm font-semibold sm:col-span-2">
              Business name
              <Input
                className="mt-2"
                required
                value={form.businessName}
                onChange={(e) => setForm({ ...form, businessName: e.target.value })}
              />
            </label>
            <label className="text-sm font-semibold">
              Owner name
              <Input
                className="mt-2"
                required
                value={form.ownerName}
                onChange={(e) => setForm({ ...form, ownerName: e.target.value.replace(/[^a-zA-Z ]/g, "").slice(0, 80) })}
              />
            </label>
            <label className="text-sm font-semibold">
              Mobile number
              <Input
                className="mt-2"
                required
                inputMode="numeric"
                pattern="[0-9]{10}"
                maxLength={10}
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, "").slice(0, 10) })}
              />
            </label>
            <label className="text-sm font-semibold">
              Category
              <select
                className="mt-2 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                <option value="">Select category</option>
                {categories.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label className="text-sm font-semibold">
              Business type
              <select
                className="mt-2 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.businessType}
                onChange={(e) => setForm({ ...form, businessType: e.target.value })}
              >
                <option value="">Select business type</option>
                {businessTypes.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label className="text-sm font-semibold">
              GST status
              <select
                className="mt-2 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.gstRegistered ? "REGISTERED" : "UNREGISTERED"}
                onChange={(e) => setForm({ ...form, gstRegistered: e.target.value === "REGISTERED", gstNumber: e.target.value === "REGISTERED" ? form.gstNumber : "" })}
              >
                <option value="UNREGISTERED">Non GST</option>
                <option value="REGISTERED">GST registered</option>
              </select>
            </label>
            <label className="text-sm font-semibold">
              GST number
              <Input
                className="mt-2"
                disabled={!form.gstRegistered}
                maxLength={15}
                placeholder={form.gstRegistered ? "Enter GSTIN" : "Not required for Non GST"}
                value={form.gstNumber}
                onChange={(e) => setForm({ ...form, gstNumber: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 15) })}
              />
            </label>
            <label className="text-sm font-semibold sm:col-span-2">
              Email address
              <Input className="mt-2" type="email" value={form.email} disabled />
            </label>
            <label className="text-sm font-semibold">
              City
              <Input
                className="mt-2"
                required
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value.replace(/[^a-zA-Z ]/g, "").slice(0, 60) })}
              />
            </label>
            <label className="text-sm font-semibold">
              State
              <Input
                className="mt-2"
                required
                value={form.state}
                onChange={(e) => setForm({ ...form, state: e.target.value.replace(/[^a-zA-Z ]/g, "").slice(0, 60) })}
              />
            </label>
            <label className="text-sm font-semibold">
              Pincode
              <Input
                className="mt-2"
                required
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                value={form.pincode}
                onChange={(e) => setForm({ ...form, pincode: e.target.value.replace(/\D/g, "").slice(0, 6) })}
              />
            </label>
            <label className="text-sm font-semibold sm:col-span-2">
              Shop / Godown address
              <Input
                className="mt-2"
                required
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </label>
            <div className="sm:col-span-2">
              <Button type="submit" className="mt-2">{setupMode ? "Save & continue" : "Save changes"}</Button>
            </div>
          </form>
        </section>
        <section className="border bg-card p-6">
          <div>
            <h2 className="text-xl font-bold">Identity details</h2>
            <p className="mt-1 text-sm text-muted-foreground">Optional, you can add this later.</p>
          </div>
          <form className="mt-5 grid gap-4 sm:grid-cols-2" onSubmit={saveIdentityDetails}>
            <label className="text-sm font-semibold">
              PAN number
              <Input className="mt-2 uppercase" maxLength={10} pattern="[A-Za-z]{5}[0-9]{4}[A-Za-z]" value={panDraft} onChange={(event) => setPanDraft(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10))} placeholder={identity?.pan.last4 ? `On file ending ${identity.pan.last4}` : "ABCDE1234F"} />
            </label>
            <label className="text-sm font-semibold">
              PAN card image
              <input className="mt-2 block w-full text-sm font-normal" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(event) => selectIdentityFile(event, setPanImageFile)} />
              <span className="mt-1 block text-xs font-normal text-muted-foreground">{identity?.pan.hasImage ? "A PAN document is already on file." : "Not provided."}</span>
            </label>
            <label className="text-sm font-semibold">
              Aadhaar number
              <Input className="mt-2" inputMode="numeric" maxLength={12} pattern="[0-9]{12}" value={aadhaarDraft} onChange={(event) => setAadhaarDraft(event.target.value.replace(/\D/g, "").slice(0, 12))} placeholder={identity?.aadhaar.last4 ? `On file ending ${identity.aadhaar.last4}` : "12 digits"} />
              <span className="mt-1 block text-xs font-normal text-muted-foreground">Only the last 4 digits are shown to your wholesaler.</span>
            </label>
            <div className="grid gap-4">
              <label className="text-sm font-semibold">
                Aadhaar front
                <input className="mt-2 block w-full text-sm font-normal" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(event) => selectIdentityFile(event, setAadhaarFrontFile)} />
                <span className="mt-1 block text-xs font-normal text-muted-foreground">{identity?.aadhaar.hasFrontImage ? "Front document is on file." : "Not provided."}</span>
              </label>
              <label className="text-sm font-semibold">
                Aadhaar back
                <input className="mt-2 block w-full text-sm font-normal" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(event) => selectIdentityFile(event, setAadhaarBackFile)} />
                <span className="mt-1 block text-xs font-normal text-muted-foreground">{identity?.aadhaar.hasBackImage ? "Back document is on file." : "Not provided."}</span>
              </label>
            </div>
            <label className="text-sm font-semibold sm:col-span-2">
              Shop photo
              <input className="mt-2 block w-full text-sm font-normal" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => selectIdentityFile(event, setShopPhotoFile)} />
              <span className="mt-1 block text-xs font-normal text-muted-foreground">{identity?.shopPhoto.hasImage ? "A shop photo is already on file." : "Not provided."}</span>
            </label>
            <label className="flex items-start gap-2 text-sm font-medium leading-6 sm:col-span-2">
              <input className="mt-1" type="checkbox" checked={identityConsent} onChange={(event) => setIdentityConsent(event.target.checked)} />
              <span>I allow my wholesaler to view these details for verification.</span>
            </label>
            <p className="text-xs text-muted-foreground sm:col-span-2">JPG, JPEG, PNG, WEBP, or PDF; max 5 MB per file. Documents are saved only when this consent is ticked.</p>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={identitySaving}>{identitySaving ? "Saving..." : "Save identity details"}</Button>
            </div>
          </form>
        </section>
        <aside className="border bg-card p-6">
          <VerifiedUser className="size-7 text-success" />
          <h2 className="mt-4 font-bold">{setupMode ? "Setup checklist" : "Verified retailer account"}</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {setupMode ? "Complete these details once to unlock your connected wholesale store." : "Your business information is ready to share with connected wholesalers."}
          </p>
          <div className="mt-5 space-y-3 text-sm">
            <div>
              <div className="mb-2 flex items-center justify-between text-xs font-bold">
                <span>Profile completion</span>
                <span>{completionPercent}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={completionPercent} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${completionPercent}%` }} />
              </div>
              {missingItems.length > 0 && (
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  Still missing: {missingItems.join(", ")}.
                </p>
              )}
            </div>
            {[
              ["Business identity", Boolean(form.businessName && form.ownerName && form.phone)],
              ["Trade category", Boolean(form.category && form.businessType)],
              ["Tax preference", Boolean(!form.gstRegistered || form.gstNumber)],
              ["Store address", Boolean(form.address && form.city && form.state && form.pincode)],
            ].map(([label, done]) => (
              <div key={String(label)} className="flex items-center justify-between rounded-xl border bg-background px-3 py-2">
                <span className="font-semibold">{String(label)}</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${done ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>
                  {done ? "Done" : "Pending"}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-5 rounded-2xl border border-primary/20 bg-primary/5 p-4">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-primary">Connected wholesaler</p>
            <h3 className="mt-2 font-black text-ink">{linkedWholesaler?.businessName || linkedWholesaler?.name || "Your wholesaler"}</h3>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Setup complete hone ke baad isi wholesaler ke products, company details, cart aur orders unlock honge.
            </p>
          </div>
          <div className="mt-5 rounded-2xl border bg-canvas p-4 text-xs leading-6 text-muted-foreground">
            <strong className="text-ink">Note:</strong> Address ya category auto-fill nahi hoti. Retailer ko apni real store details fill karni hongi.
          </div>
        </aside>
      </div>
    </main>
  );
}

export function AddressesPage() {
  const { retailerProfile } = useStore();

  return (
    <main className="shell py-10">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-ink">Delivery addresses</h1>
          <p className="mt-2 text-muted-foreground">Choose where your wholesale orders should arrive.</p>
        </div>
        <Button>Add address</Button>
      </div>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <div className="border bg-card p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold">
              <LocationOn className="size-4 text-primary" /> Main Store Address
            </div>
            <Badge variant="secondary">Primary</Badge>
          </div>
          <h2 className="mt-5 font-bold">{retailerProfile.businessName}</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {retailerProfile.address}, {retailerProfile.city}, {retailerProfile.state} {retailerProfile.pincode}<br />
            Phone: {retailerProfile.phone}
          </p>
          <div className="mt-5 flex gap-2">
            <Button variant="outline" size="sm">Edit</Button>
          </div>
        </div>
      </div>
    </main>
  );
}

export function SettingsPage() {
  return (
    <main className="shell py-10">
      <h1 className="text-3xl font-extrabold text-ink">Settings</h1>
      <p className="mt-2 text-muted-foreground">Manage how NEXORA keeps you updated.</p>
      <div className="mt-8 max-w-2xl border bg-card p-6">
        <h2 className="text-xl font-bold">Notifications</h2>
        {[
          ["Order updates", "Get shipping and delivery updates"],
          ["Price alerts", "Know when saved products change price"],
          ["Wholesaler messages", "Receive catalogue and access updates"],
        ].map(([title, body], i) => (
          <label key={title} className="flex items-center justify-between gap-4 border-b py-5 last:border-0">
            <span>
              <b>{title}</b>
              <span className="mt-1 block text-sm text-muted-foreground">{body}</span>
            </span>
            <input type="checkbox" defaultChecked={i < 2} />
          </label>
        ))}
        <Button className="mt-5">Save preferences</Button>
      </div>
    </main>
  );
}

class OptionalIdentityFieldsBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  override state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Optional retailer identity fields failed to render", error, info);
  }

  override render() {
    if (this.state.hasError) {
      return (
        <p role="status" className="rounded-xl border bg-muted/20 p-4 text-xs text-muted-foreground">
          Optional identity details are unavailable right now. You can add them later from Profile.
        </p>
      );
    }
    return this.props.children;
  }
}

export function AuthPage({
  mode: initialMode,
  redirect,
}: {
  mode: "login" | "register" | "forgot";
  redirect?: string;
}) {
  const { login, isLoggedIn } = useStore();

  const queryRedirect = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("redirect") : null;
  const targetRedirect = redirect || queryRedirect || (typeof window !== "undefined" ? sessionStorage.getItem("nexora_auth_redirect") : null) || "/dashboard";

  useEffect(() => {
    if (redirect && typeof window !== "undefined") {
      try {
        sessionStorage.setItem("nexora_auth_redirect", redirect);
      } catch {}
    }
  }, [redirect]);

  const [mode, setMode] = useState<"login" | "register" | "forgot">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loginId, setLoginId] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [phone, setPhone] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [pincode, setPincode] = useState("");
  const [gstin, setGstin] = useState("");
  const [panNumber, setPanNumber] = useState("");
  const [aadhaarNumber, setAadhaarNumber] = useState("");
  const [identityConsent, setIdentityConsent] = useState(false);
  const [shopPhoto, setShopPhoto] = useState<File>();
  const [panImage, setPanImage] = useState<File>();
  const [aadhaarFront, setAadhaarFront] = useState<File>();
  const [aadhaarBack, setAadhaarBack] = useState<File>();
  const [referralAttribution, setReferralAttribution] = useState<ReferralAttribution | null>(() => {
    if (typeof window === "undefined") return null;
    return isLoggedIn
      ? getStoredReferralAttribution()
      : getReferralAttributionFromUrl(new URL(window.location.href)) || getStoredReferralAttribution();
  });
  const [referralCode, setReferralCode] = useState(referralAttribution?.code || "");
  const [referralStatus, setReferralStatus] = useState<"idle" | "checking" | "valid" | "invalid" | "error">(
    () => initialMode === "register" && Boolean(referralAttribution?.code) ? "checking" : "idle",
  );
  const [referralRetryCount, setReferralRetryCount] = useState(0);
  const [referralWholesaler, setReferralWholesaler] = useState<{
    code: string;
    businessName: string;
    logo: string;
    city: string;
  } | null>(null);
  const activeReferralWholesaler =
    referralWholesaler?.code === referralCode.toUpperCase() ? referralWholesaler : null;
  const canShowRegisterForm = Boolean(activeReferralWholesaler) && referralStatus === "valid";
  const [referralError, setReferralError] = useState("");
  const [isLookingUpReferral, setIsLookingUpReferral] = useState(
    () => initialMode === "register" && Boolean(referralAttribution?.code),
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showOptionalDocs, setShowOptionalDocs] = useState(false);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    const attribution = referralAttribution;
    const code = attribution?.code.trim().toUpperCase() || "";
    setReferralCode(code);
    setReferralWholesaler(null);
    if (!attribution || !code) {
      setIsLookingUpReferral(false);
      setReferralStatus("idle");
      return;
    }

    let isCurrentLookup = true;
    setReferralError("");
    setReferralStatus("checking");
    setIsLookingUpReferral(true);
    void api.getReferral(code)
      .then((response) => {
        if (!isCurrentLookup) return;
        if (!response?.data?.wholesaler?.businessName) {
          setReferralStatus("invalid");
          setReferralError("This link is not valid. Please ask your wholesaler for a new link.");
          return;
        }
        const savedAttribution = { ...attribution, code };
        saveReferralAttribution(savedAttribution);
        setReferralWholesaler({ ...response.data.wholesaler, code });
        setReferralStatus("valid");
      })
      .catch((error: unknown) => {
        if (!isCurrentLookup) return;
        const status = error instanceof ApiError ? error.status : undefined;
        if (status === 403 || status === 404) {
          if (getStoredReferralAttribution()?.code === code) clearStoredReferralAttribution();
          setReferralStatus("invalid");
          setReferralError("This link is not valid. Please ask your wholesaler for a new link.");
        } else {
          setReferralStatus("error");
          setReferralError("Could not verify the link. Please try again");
        }
      })
      .finally(() => {
        if (isCurrentLookup) setIsLookingUpReferral(false);
      });

    return () => {
      isCurrentLookup = false;
    };
  }, [mode, referralAttribution, referralRetryCount]);

  const clearReferral = () => {
    clearStoredReferralAttribution();
    setReferralAttribution(null);
    setReferralWholesaler(null);
    setReferralCode("");
    setReferralError("");
    setReferralStatus("idle");
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (mode === "login") {
        await login(email, password);
        markRetailerRegistrationComplete();
        toast.success("Login successful!");
        const dest = targetRedirect || "/dashboard";
        try {
          sessionStorage.removeItem("nexora_auth_redirect");
        } catch {}
        window.location.href = dest;
      } else if (mode === "register") {
        if (!activeReferralWholesaler) {
          setReferralError(
            referralStatus === "invalid"
              ? "This link is not valid. Please ask your wholesaler for a new link."
              : "Could not verify the link. Please try again",
          );
          return;
        }
        if (!/^[6-9]\d{9}$/.test(phone.trim())) {
          toast.error("Enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.");
          setIsSubmitting(false);
          return;
        }
        if (password.length < 6) {
          toast.error("Password must be at least 6 characters.");
          setIsSubmitting(false);
          return;
        }
        if (gstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstin)) {
          toast.error("Enter a valid 15-character GSTIN.");
          setIsSubmitting(false);
          return;
        }
        if (panNumber && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(panNumber)) {
          toast.error("Enter a valid PAN number (for example, ABCDE1234F).");
          setIsSubmitting(false);
          return;
        }
        if (aadhaarNumber && !/^\d{12}$/.test(aadhaarNumber)) {
          toast.error("Enter a valid 12-digit Aadhaar number.");
          setIsSubmitting(false);
          return;
        }
        if (
          (panNumber ||
            aadhaarNumber ||
            shopPhoto ||
            panImage ||
            aadhaarFront ||
            aadhaarBack) &&
          !identityConsent
        ) {
          toast.error("Please accept the consent to save shop or identity documents.");
          setIsSubmitting(false);
          return;
        }

        const res = await api.register({
          name: name.trim(),
          loginId: loginId.trim().toUpperCase(),
          businessName: businessName.trim(),
          businessType: businessType.trim(),
          address: address.trim(),
          city: city.trim(),
          state: state.trim(),
          pincode: pincode.trim(),
          gstin: gstin.trim().toUpperCase(),
          gstStatus: gstin ? "REGISTERED" : "UNREGISTERED",
          panNumber: panNumber.trim().toUpperCase(),
          aadhaarNumber: aadhaarNumber.trim(),
          identityConsent,
          shopPhoto,
          panImage,
          aadhaarFront,
          aadhaarBack,
          phone: phone.trim(),
          email: email.trim(),
          password,
          referralCode: referralCode.trim().toUpperCase(),
          utmSource: referralAttribution?.utmSource || "",
          utmMedium: referralAttribution?.utmMedium || "",
          utmCampaign: referralAttribution?.utmCampaign || "",
          utmTerm: referralAttribution?.utmTerm || "",
          utmContent: referralAttribution?.utmContent || "",
          firstLandingAt: referralAttribution?.firstLandingAt,
        });

        const token = res.data.token || res.data.accessToken;
        markRetailerRegistrationComplete();
        if (token) {
          setAuthToken(token);
          toast.success("Account created successfully! Welcome to NEXORA.");
          const dest = targetRedirect || "/dashboard";
          try {
            sessionStorage.removeItem("nexora_auth_redirect");
          } catch {}
          window.location.href = dest;
        } else {
          toast.success("Account created! Please sign in.");
          setMode("login");
        }
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error
        ? err.message
        : mode === "login"
          ? "Invalid retailer ID or password"
          : "Registration failed. Please check details.";
      toast.error(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const title = mode === "login" ? "Retailer Sign In" : mode === "register" ? "Retailer Registration" : "Reset Password";

  return (
    <main className="relative min-h-[calc(100vh-80px)] overflow-hidden bg-[#F4F7F8] px-4 py-8 sm:py-12 flex items-center justify-center">
      {/* Ambient background decoration */}
      <div className="pointer-events-none absolute -top-40 -left-40 size-[520px] rounded-full bg-[#20A66A]/10 blur-[110px]" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 size-[520px] rounded-full bg-[#12304A]/10 blur-[110px]" />

      <div className="relative w-full max-w-5xl rounded-3xl border border-[#D8E1E5]/80 bg-white shadow-[0_24px_60px_-12px_rgba(18,48,74,0.15)] overflow-hidden grid grid-cols-1 lg:grid-cols-12">
        {/* Left Column: Brand Showcase & Wholesaler Trust Badge */}
        <section className="bg-gradient-to-br from-[#12304A] via-[#0E273D] to-[#0A1D2E] text-white p-7 sm:p-10 flex flex-col justify-between relative overflow-hidden lg:col-span-5">
          {/* Decorative radial lighting */}
          <div className="pointer-events-none absolute -top-24 -right-24 size-64 rounded-full bg-emerald-500/15 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-24 size-64 rounded-full bg-sky-500/10 blur-2xl" />

          <div className="relative z-10">
            {/* Platform Brand */}
            <div className="flex items-center gap-3">
              <TradeFlowMark className="size-11 rounded-xl shadow-lg ring-1 ring-white/20" />
              <div>
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-300">
                  <Sparkles className="size-3 text-emerald-400" /> B2B Trade Network
                </span>
                <p className="text-xs font-semibold text-slate-300 mt-0.5">Verified Retailer Access</p>
              </div>
            </div>

            {/* Hero Copy */}
            <div className="mt-8">
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white leading-tight">
                {mode === "register"
                  ? "Direct Wholesale, Zero Middlemen."
                  : mode === "login"
                    ? "Welcome Back to Your Store."
                    : "Secure Account Recovery."}
              </h2>
              <p className="mt-2.5 text-xs sm:text-sm leading-relaxed text-slate-300">
                {mode === "register"
                  ? "Connect directly with authorized distributors for transparent wholesale rates, priority dispatch, and formal GST tax credits."
                  : mode === "login"
                    ? "Sign in to view your live distributor pricing, order history, credit lines, and real-time delivery status."
                    : "Reset your password securely to regain access to your retailer dashboard and supplier orders."}
              </p>
            </div>

            {/* Wholesaler Invite Highlight (When Link Is Valid) */}
            {activeReferralWholesaler && (
              <div className="mt-6 rounded-2xl border border-emerald-400/30 bg-gradient-to-br from-white/12 to-white/5 p-4.5 backdrop-blur-md shadow-xl">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-emerald-400">
                    <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                    Invited by Distributor
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-extrabold text-emerald-300">
                    <Verified fontSize="inherit" className="!size-3" />
                    Verified
                  </span>
                </div>
                <div className="mt-3.5 flex items-center gap-3.5">
                  {activeReferralWholesaler.logo ? (
                    <img
                      src={activeReferralWholesaler.logo}
                      alt={activeReferralWholesaler.businessName}
                      className="size-12 rounded-xl object-cover ring-2 ring-emerald-400/40 shadow-sm"
                    />
                  ) : (
                    <div className="flex size-12 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-600 to-emerald-400 font-black text-lg text-white shadow-md">
                      {activeReferralWholesaler.businessName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-medium text-slate-300">You are joining:</p>
                    <p className="truncate text-base font-extrabold text-white">
                      {activeReferralWholesaler.businessName}
                    </p>
                    {activeReferralWholesaler.city && (
                      <p className="flex items-center gap-1 text-xs text-slate-300/90 mt-0.5">
                        <LocationOn className="!size-3.5 text-emerald-400" />
                        {activeReferralWholesaler.city}
                      </p>
                    )}
                  </div>
                </div>
                {mode === "register" && (
                  <div className="mt-3.5 pt-3 border-t border-white/10 flex items-center justify-between">
                    <span className="text-[11px] text-slate-300">Not your wholesaler?</span>
                    <button
                      type="button"
                      onClick={clearReferral}
                      className="text-[11px] font-bold text-emerald-300 hover:text-emerald-200 underline underline-offset-2 cursor-pointer transition-colors"
                    >
                      Clear & switch
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Exclusive Gateway Notice (When Registering without Link) */}
            {mode === "register" && !activeReferralWholesaler && (
              <div className="mt-6 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 backdrop-blur-md">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="size-5 text-amber-300" />
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-200">
                    Exclusive Invitation Gate
                  </span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-slate-300">
                  To prevent unauthorized retail leakage and protect wholesale distributor margins, retailer registrations require an authorized wholesaler link.
                </p>
              </div>
            )}

            {/* 3 Core B2B Pillars */}
            <div className="mt-6 space-y-2.5">
              <div className="flex items-center gap-3 rounded-xl bg-white/5 p-2.5 border border-white/5">
                <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-300">
                  <Percent className="size-3.5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-white">Direct Wholesale Rates</p>
                  <p className="text-[11px] text-slate-300 truncate">Tier-1 distributor pricing with zero broker commission.</p>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-xl bg-white/5 p-2.5 border border-white/5">
                <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-300">
                  <LocalShipping className="!size-3.5 text-emerald-300" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-white">Store Doorstep Delivery</p>
                  <p className="text-[11px] text-slate-300 truncate">Fast order dispatch directly to your shop with live tracking.</p>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-xl bg-white/5 p-2.5 border border-white/5">
                <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-300">
                  <Receipt className="size-3.5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-white">100% Tax Compliant (ITC)</p>
                  <p className="text-[11px] text-slate-300 truncate">Automated GST tax invoices ready for monthly input credit.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Trust Badge */}
          <div className="relative z-10 mt-8 pt-6 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-300">
            <span className="flex items-center gap-1.5">
              <VerifiedUser className="!size-3.5 text-emerald-400" />
              256-Bit SSL Encrypted
            </span>
            <span>Official Retailer Portal</span>
          </div>
        </section>

        {/* Right Column: Dynamic Form & Status View */}
        <section className="bg-white p-7 sm:p-10 flex flex-col justify-between lg:col-span-7">
          <div>
            {/* Top Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="text-[11px] font-black uppercase tracking-wider text-emerald-700">
                  {mode === "register" ? "Retailer Onboarding" : mode === "login" ? "Retailer Portal" : "Security"}
                </span>
                <h1 className="text-2xl sm:text-3xl font-black text-[#12304A] tracking-tight mt-0.5">
                  {title}
                </h1>
                <p className="mt-1 text-xs text-muted-foreground">
                  {mode === "forgot"
                    ? "We'll send a reset link to your account email."
                    : mode === "register"
                      ? canShowRegisterForm
                        ? "Fill in your store details to activate your wholesale buying account."
                        : "Create your account using your wholesaler's invite link."
                      : "Sign in with your retailer ID or email and password."}
                </p>
              </div>
              {mode === "login" && (
                <button
                  type="button"
                  onClick={() => setMode("register")}
                  className="text-xs font-extrabold text-emerald-700 hover:text-emerald-800 underline underline-offset-4 cursor-pointer"
                >
                  Register New Shop →
                </button>
              )}
              {mode === "register" && (
                <button
                  type="button"
                  onClick={() => setMode("login")}
                  className="text-xs font-extrabold text-emerald-700 hover:text-emerald-800 underline underline-offset-4 cursor-pointer"
                >
                  Sign In →
                </button>
              )}
            </div>

            {/* State: Verifying link */}
            {mode === "register" && isLookingUpReferral && (
              <div role="status" aria-label="Verifying wholesaler invite" className="my-12 flex flex-col items-center justify-center gap-4 py-8 text-center">
                <div className="relative">
                  <div className="size-14 rounded-full border-4 border-emerald-100 border-t-emerald-600 animate-spin" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <ShieldCheck className="size-6 text-emerald-600" />
                  </div>
                </div>
                <div>
                  <p className="text-base font-bold text-[#12304A]">Verifying Wholesaler Invitation</p>
                  <span className="text-xs font-semibold text-muted-foreground">Verifying wholesaler link...</span>
                </div>
              </div>
            )}

            {/* State: Invitation Gate / Link Status */}
            {mode === "register" && !isLookingUpReferral && !canShowRegisterForm && (
              <div className="my-8 rounded-2xl border border-gray-200/80 bg-gradient-to-b from-[#F9FBFC] to-white p-6 sm:p-8 text-center shadow-xs">
                {referralStatus === "invalid" ? (
                  <div className="space-y-4">
                    <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-red-50 text-red-600 ring-8 ring-red-50/50">
                      <AlertCircle className="size-7" />
                    </div>
                    <div>
                      <h2 className="text-lg font-extrabold text-[#12304A]">Invitation Link Invalid</h2>
                      <p role="alert" className="mt-2 text-sm font-semibold leading-relaxed text-red-600">
                        This link is not valid. Please ask your wholesaler for a new link.
                      </p>
                      <p className="mt-2 text-xs text-muted-foreground max-w-md mx-auto">
                        Wholesaler invite links are single-use or unique. Please ask your distributor for an updated registration link.
                      </p>
                    </div>
                  </div>
                ) : referralStatus === "error" ? (
                  <div className="space-y-4">
                    <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 ring-8 ring-amber-50/50">
                      <RefreshCw className="size-7" />
                    </div>
                    <div>
                      <h2 className="text-lg font-extrabold text-[#12304A]">Connection Timeout</h2>
                      <div role="alert" className="mt-2 flex flex-wrap items-center justify-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                        <span>Could not verify the link. Please try again</span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setReferralRetryCount((count) => count + 1)}
                        >
                          Retry
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 ring-8 ring-emerald-50/50">
                      <LockIcon className="size-7" />
                    </div>
                    <div>
                      <h2 className="text-lg font-extrabold text-[#12304A]">Distributor Invitation Required</h2>
                      <p className="mt-2 text-sm font-semibold leading-relaxed text-muted-foreground">
                        Please open the registration link sent by your wholesaler.
                      </p>
                      <div className="mt-5 rounded-2xl border border-gray-100 bg-white p-4 text-left text-xs text-muted-foreground space-y-2.5">
                        <p className="font-bold text-[#12304A]">How to join your distributor:</p>
                        <div className="flex items-start gap-2.5">
                          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[10px] font-bold text-emerald-700">1</span>
                          <span>Request an invite link from your authorized FMCG or product wholesaler.</span>
                        </div>
                        <div className="flex items-start gap-2.5">
                          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[10px] font-bold text-emerald-700">2</span>
                          <span>Click the link received on WhatsApp or SMS to auto-verify your retailer account.</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                  <Link
                    to="/login"
                    className="inline-flex items-center justify-center rounded-xl bg-[#12304A] px-6 py-2.5 text-sm font-bold text-white hover:bg-[#1B4261] transition-colors"
                  >
                    Login
                  </Link>
                </div>
              </div>
            )}

            {/* State: Registration Form */}
            {mode === "register" && canShowRegisterForm && (
              <form className="mt-6 space-y-6" onSubmit={handleAuthSubmit}>
                {/* Section 1: Store & Owner Identity */}
                <div className="space-y-3.5">
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                    <Store className="size-4 text-emerald-600" />
                    <span className="text-xs font-bold uppercase tracking-wider text-[#12304A]">
                      1. Store & Owner Identity
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {/* Owner / Contact Name */}
                    <label className="block text-xs font-bold text-[#12304A]">
                      Owner / Contact Name <span className="text-red-500">*</span>
                      <Input
                        className="mt-1.5"
                        type="text"
                        placeholder="e.g. Rajesh Kumar"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                      />
                    </label>

                    {/* Retailer Login ID
                    <label className="block text-xs font-bold text-[#12304A]">
                      Retailer Login ID (Username) <span className="text-red-500">*</span>
                      <Input
                        className="mt-1.5 uppercase font-mono tracking-wide"
                        type="text"
                        autoComplete="username"
                        minLength={4}
                        maxLength={32}
                        pattern="[A-Za-z0-9_-]{4,32}"
                        placeholder="e.g. SARITA123 or FASHION_STORE"
                        value={loginId}
                        onChange={(e) => setLoginId(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 32))}
                        required
                      />
                      <span className="mt-1 block text-[11px] font-normal text-muted-foreground">
                        Letters, numbers, and dashes only (no @ or dots). This is your login username.
                      </span>
                    </label> */}

                    {/* Business / Store Name */}
                    <label className="block text-xs font-bold text-[#12304A]">
                      Business / Store Name <span className="text-red-500">*</span>
                      <Input
                        className="mt-1.5"
                        type="text"
                        placeholder="e.g. Kumar General Store"
                        value={businessName}
                        onChange={(e) => setBusinessName(e.target.value)}
                        required
                      />
                    </label>

                    {/* Business Type */}
                    <label className="block text-xs font-bold text-[#12304A]">
                      Business type (optional)
                      <Input
                        className="mt-1.5"
                        value={businessType}
                        onChange={(event) => setBusinessType(event.target.value)}
                        placeholder="e.g. General store"
                      />
                    </label>
                  </div>
                </div>

                {/* Section 2: Contact & Store Location */}
                <div className="space-y-3.5">
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                    <MapPin className="size-4 text-emerald-600" />
                    <span className="text-xs font-bold uppercase tracking-wider text-[#12304A]">
                      2. Contact & Store Location
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {/* Mobile Number */}
                    <label className="block text-xs font-bold text-[#12304A]">
                      10-Digit Mobile Number <span className="text-red-500">*</span>
                      <Input
                        className="mt-1.5"
                        type="tel"
                        inputMode="numeric"
                        maxLength={10}
                        pattern="[6-9][0-9]{9}"
                        title="Enter a 10-digit Indian mobile number starting with 6, 7, 8, or 9."
                        placeholder="e.g. 9876543210"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                        required
                      />
                      <span className="mt-1 block text-[11px] font-normal text-muted-foreground">Use a 10-digit Indian number starting with 6, 7, 8, or 9.</span>
                    </label>

                    {/* Email */}
                    <label className="block text-xs font-bold text-[#12304A]">
                      Email Address (Gmail / Email ID) <span className="text-red-500">*</span>
                      <Input
                        className="mt-1.5"
                        type="email"
                        autoComplete="email"
                        placeholder="e.g. sarita@gmail.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                      <span className="mt-1 block text-[11px] font-normal text-muted-foreground">
                        Enter your Gmail / Email address here (e.g. yourname@gmail.com).
                      </span>
                    </label>

                    {/* Shop address */}
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-[#12304A]">
                        Shop address <span className="text-red-500">*</span>
                        <Input
                          className="mt-1.5"
                          value={address}
                          onChange={(event) => setAddress(event.target.value)}
                          placeholder="Shop No., Market / Area, Street"
                          required
                        />
                      </label>
                    </div>

                    {/* City, State, Pincode */}
                    <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <label className="block text-xs font-bold text-[#12304A]">
                        City <span className="text-red-500">*</span>
                        <Input className="mt-1.5" value={city} onChange={(event) => setCity(event.target.value)} required />
                      </label>
                      <label className="block text-xs font-bold text-[#12304A]">
                        State <span className="text-red-500">*</span>
                        <Input className="mt-1.5" value={state} onChange={(event) => setState(event.target.value)} required />
                      </label>
                      <label className="block text-xs font-bold text-[#12304A]">
                        Pincode <span className="text-red-500">*</span>
                        <Input
                          className="mt-1.5"
                          inputMode="numeric"
                          maxLength={6}
                          pattern="[0-9]{6}"
                          value={pincode}
                          onChange={(event) => setPincode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                          required
                        />
                      </label>
                    </div>
                  </div>
                </div>

                {/* Section 3: Account Security */}
                <div className="space-y-3.5">
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                    <LockIcon className="size-4 text-emerald-600" />
                    <span className="text-xs font-bold uppercase tracking-wider text-[#12304A]">
                      3. Account Security
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#12304A]">
                      Password <span className="text-red-500">*</span>
                      <div className="relative mt-1.5 flex items-center">
                        <Input
                          type={showPassword ? "text" : "password"}
                          autoComplete="new-password"
                          placeholder="Create a strong password (min 6 chars)"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((prev) => !prev)}
                          className="absolute right-3.5 z-10 flex items-center text-muted-foreground hover:text-ink cursor-pointer transition-colors p-1"
                          aria-label={showPassword ? "Hide password" : "Show password"}
                        >
                          {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                        </button>
                      </div>
                      <span className="mt-1 block text-[11px] font-normal text-muted-foreground">
                        Minimum 6 characters. You will use this with your Retailer ID to sign in.
                      </span>
                    </label>
                  </div>
                </div>

                {/* Section 4: Optional Verification & Documents */}
                <div className="rounded-2xl border border-gray-200 bg-gray-50/60 p-4 transition-all">
                  <button
                    type="button"
                    onClick={() => setShowOptionalDocs((prev) => !prev)}
                    className="flex w-full items-center justify-between text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="flex size-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                        <FileText className="size-4" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-[#12304A]">
                          Verification & Tax Documents <span className="text-xs font-normal text-muted-foreground">(Optional)</span>
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          Add GSTIN, PAN or Shop photo now or anytime later from Profile
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700">
                      <span>{showOptionalDocs ? "Hide" : "Add details"}</span>
                      {showOptionalDocs ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                    </div>
                  </button>

                  {showOptionalDocs && (
                    <div className="mt-4 pt-4 border-t border-gray-200 space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* GSTIN */}
                        <label className="block text-xs font-bold text-[#12304A]">
                          GSTIN (optional)
                          <Input
                            className="mt-1.5 uppercase font-mono"
                            value={gstin}
                            onChange={(event) => setGstin(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 15))}
                            maxLength={15}
                            pattern="[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]"
                            placeholder="15-character GSTIN"
                          />
                          <span className="mt-1 block text-[11px] font-normal text-muted-foreground">
                            Required only if you claim GST input tax credit.
                          </span>
                        </label>

                        {/* Shop photo */}
                        <label className="block text-xs font-bold text-[#12304A]">
                          Shop photo (optional)
                          <input
                            className="mt-1.5 block w-full text-xs font-normal file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer"
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            onChange={(event) => setShopPhoto(event.target.files?.[0])}
                          />
                          <span className="mt-1 block text-[11px] font-normal text-muted-foreground">JPG, PNG, or WEBP; max 5 MB.</span>
                        </label>
                      </div>

                      <OptionalIdentityFieldsBoundary>
                        <section className="grid gap-3 rounded-xl border bg-white p-4">
                          <div>
                            <h2 className="font-bold text-ink">Identity details</h2>
                            <p className="mt-1 text-xs font-normal text-muted-foreground">Optional, you can add this later.</p>
                          </div>
                          <label className="text-xs font-bold text-ink">
                            PAN number
                            <Input className="mt-1.5 uppercase font-mono" maxLength={10} pattern="[A-Za-z]{5}[0-9]{4}[A-Za-z]" value={panNumber} onChange={(event) => setPanNumber(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10))} placeholder="ABCDE1234F" />
                          </label>
                          <label className="text-xs font-bold text-ink">
                            PAN card image
                            <input className="mt-1.5 block w-full text-xs font-normal file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(event) => setPanImage(event.target.files?.[0])} />
                          </label>
                          <label className="text-xs font-bold text-ink">
                            Aadhaar number
                            <Input className="mt-1.5 font-mono" inputMode="numeric" maxLength={12} pattern="[0-9]{12}" value={aadhaarNumber} onChange={(event) => setAadhaarNumber(event.target.value.replace(/\D/g, "").slice(0, 12))} />
                            <span className="mt-1 block text-[11px] font-normal text-muted-foreground">Only the last 4 digits are shown to your wholesaler.</span>
                          </label>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <label className="text-xs font-bold text-ink">
                              Aadhaar front
                              <input className="mt-1.5 block w-full text-xs font-normal file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(event) => setAadhaarFront(event.target.files?.[0])} />
                            </label>
                            <label className="text-xs font-bold text-ink">
                              Aadhaar back
                              <input className="mt-1.5 block w-full text-xs font-normal file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(event) => setAadhaarBack(event.target.files?.[0])} />
                            </label>
                          </div>
                          <label className="flex items-start gap-2 text-xs font-semibold leading-5 text-ink cursor-pointer">
                            <input className="mt-1" type="checkbox" checked={identityConsent} onChange={(event) => setIdentityConsent(event.target.checked)} />
                            <span>
                              I allow my wholesaler to view these details for verification.
                            </span>
                          </label>
                          <p className="text-[11px] font-normal text-muted-foreground">JPG, JPEG, PNG, WEBP, or PDF; max 5 MB per file. Identity documents and shop photos are saved only when you accept this consent.</p>
                        </section>
                      </OptionalIdentityFieldsBoundary>
                    </div>
                  )}
                </div>

                {/* Submit Button */}
                <div className="pt-2">
                  <Button
                    type="submit"
                    size="lg"
                    disabled={isSubmitting || !activeReferralWholesaler}
                    className="w-full rounded-2xl py-4 text-base font-extrabold bg-[#12304A] hover:bg-[#1B4261] text-white shadow-xl shadow-[#12304A]/15 cursor-pointer transition-all active:scale-[0.99]"
                  >
                    {isSubmitting ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="size-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                        Creating Account...
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-2">
                        Register & Connect to {activeReferralWholesaler?.businessName || "Wholesaler"}
                        <ArrowRight className="size-4" />
                      </span>
                    )}
                  </Button>
                  <p className="mt-2.5 text-center text-[11px] text-muted-foreground">
                    By registering, you agree to NEXORA's B2B Terms of Service and Privacy Policy.
                  </p>
                </div>
              </form>
            )}

            {/* State: Login Form */}
            {mode === "login" && (
              <form className="mt-6 space-y-4" onSubmit={handleAuthSubmit}>
                <label className="block text-xs font-bold text-[#12304A]">
                  Retailer ID / Email Address <span className="text-red-500">*</span>
                  <Input
                    className="mt-1.5"
                    type="text"
                    autoComplete="username"
                    placeholder="Enter retailer ID or email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value.toUpperCase().replace(/[^A-Z0-9@._-]/g, ""))}
                    required
                  />
                </label>

                <label className="block text-xs font-bold text-[#12304A]">
                  <div className="flex items-center justify-between">
                    <span>Password <span className="text-red-500">*</span></span>
                    <Link to="/forgot-password" className="text-xs font-bold text-emerald-700 hover:underline">
                      Forgot password?
                    </Link>
                  </div>
                  <div className="relative mt-1.5 flex items-center">
                    <Input
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute right-3.5 z-10 flex items-center text-muted-foreground hover:text-ink cursor-pointer transition-colors p-1"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </label>

                <div className="pt-2">
                  <Button
                    type="submit"
                    size="lg"
                    disabled={isSubmitting}
                    className="w-full rounded-2xl py-3.5 text-base font-extrabold bg-[#12304A] hover:bg-[#1B4261] text-white shadow-lg shadow-[#12304A]/10 cursor-pointer"
                  >
                    {isSubmitting ? "Signing in..." : "Sign In to Store"}
                  </Button>
                </div>
              </form>
            )}

            {/* State: Forgot Password Form */}
            {mode === "forgot" && (
              <form className="mt-6 space-y-4" onSubmit={handleAuthSubmit}>
                <label className="block text-xs font-bold text-[#12304A]">
                  Registered Email Address <span className="text-red-500">*</span>
                  <Input
                    className="mt-1.5"
                    type="email"
                    autoComplete="email"
                    placeholder="Enter your registered account email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                  <span className="mt-1 block text-[11px] font-normal text-muted-foreground">
                    We'll send password reset instructions to this email.
                  </span>
                </label>

                <div className="pt-2 space-y-3">
                  <Button
                    type="submit"
                    size="lg"
                    disabled={isSubmitting}
                    className="w-full rounded-2xl py-3.5 text-base font-extrabold bg-[#12304A] hover:bg-[#1B4261] text-white cursor-pointer"
                  >
                    {isSubmitting ? "Sending..." : "Send Reset Link"}
                  </Button>

                  <div className="text-center pt-2">
                    <button
                      type="button"
                      onClick={() => setMode("login")}
                      className="text-xs font-bold text-emerald-700 hover:underline cursor-pointer"
                    >
                      ← Back to Sign In
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>

          {/* Bottom Footer Switcher */}
          <div className="mt-8 pt-4 border-t border-slate-100 text-center text-xs text-muted-foreground">
            {mode === "login" ? (
              <>
                {activeReferralWholesaler ? (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3.5 text-center">
                    <p className="font-medium text-[#12304A]">New shop joining {activeReferralWholesaler.businessName}?</p>
                    <button
                      type="button"
                      onClick={() => setMode("register")}
                      className="mt-1.5 font-bold text-emerald-700 hover:underline cursor-pointer inline-flex items-center gap-1"
                    >
                      Register Free & Connect <ArrowRight className="size-3.5" />
                    </button>
                  </div>
                ) : (
                  <p>New here? Please open the registration link your wholesaler sent you.</p>
                )}
              </>
            ) : (
              mode === "register" && canShowRegisterForm && (
                <button
                  type="button"
                  onClick={() => setMode("login")}
                  className="text-primary hover:underline font-bold cursor-pointer"
                >
                  Already have an account? Sign in
                </button>
              )
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

export function CouponsPage() {
  const { currentUser } = useStore();
  const couponsQuery = useQuery({
    queryKey: retailerQueryKeys.resource(currentUser?.id || "unknown", "coupons"),
    queryFn: async () => {
      const response = await api.getCoupons();
      return Array.isArray(response?.data) ? response.data : [];
    },
    enabled: Boolean(currentUser?.id),
  });
  const coupons = couponsQuery.data ?? [];
  const loading = couponsQuery.isLoading;
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"ALL" | "AVAILABLE" | "EXPIRED">("ALL");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  useEffect(() => {
    if (couponsQuery.error) console.error("Failed to load retailer coupons", couponsQuery.error);
  }, [couponsQuery.error]);

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast.success(`Coupon code '${code}' copied to clipboard!`);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  const filteredCoupons = coupons.filter((c) => {
    const matchesSearch =
      c.code.toLowerCase().includes(search.toLowerCase()) ||
      c.title.toLowerCase().includes(search.toLowerCase());

    if (tab === "AVAILABLE") return matchesSearch && c.isAvailable;
    if (tab === "EXPIRED") return matchesSearch && !c.isAvailable;
    return matchesSearch;
  });

  return (
    <main className="shell py-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-primary">Exclusive Wholesale Deals</span>
          <h1 className="mt-1 text-3xl font-black text-ink">Coupons & Promotional Offers</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Browse and apply active discount coupons from your connected wholesaler to save on trade orders.
          </p>
        </div>
        <Button asChild className="rounded-xl font-bold">
          <Link to="/products">Browse Catalog</Link>
        </Button>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border bg-card p-4 rounded-2xl shadow-xs">
        <div className="flex items-center gap-2">
          {(["ALL", "AVAILABLE", "EXPIRED"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "rounded-xl px-4 py-2 text-xs font-extrabold transition-all",
                tab === t
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-muted/40 text-muted-foreground hover:bg-muted"
              )}
            >
              {t === "ALL" ? `All (${coupons.length})` : t === "AVAILABLE" ? `Available (${coupons.filter(c => c.isAvailable).length})` : `Unavailable (${coupons.filter(c => !c.isAvailable).length})`}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <input
            type="text"
            placeholder="Search coupons..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border bg-background px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>

      {loading ? (
        <div className="mt-8 text-center py-16 bg-card border rounded-2xl">
          <div className="size-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-3 text-xs font-semibold text-muted-foreground">Loading coupons...</p>
        </div>
      ) : filteredCoupons.length === 0 ? (
        <div className="mt-8 text-center py-16 bg-card border border-dashed rounded-2xl">
          <p className="text-base font-bold text-ink">No coupons available</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {search ? `No coupons matching "${search}"` : "Your connected wholesaler has not published any active coupons right now."}
          </p>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredCoupons.map((coupon) => (
            <div
              key={coupon._id}
              className={cn(
                "rounded-2xl border bg-card p-6 shadow-xs flex flex-col justify-between transition-all",
                coupon.isAvailable ? "hover:border-primary/40 hover:shadow-md" : "opacity-75 border-dashed bg-muted/20"
              )}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-black px-3 py-1 bg-primary/10 text-primary border border-primary/20 rounded-xl tracking-wider">
                      {coupon.code}
                    </span>
                    <button
                      onClick={() => copyCode(coupon.code)}
                      className="p-1.5 text-muted-foreground hover:text-ink hover:bg-muted rounded-lg transition-colors"
                      title="Copy code"
                    >
                      {copiedCode === coupon.code ? (
                        <Check className="size-4 text-emerald-600" />
                      ) : (
                        <span className="text-xs font-bold">Copy</span>
                      )}
                    </button>
                  </div>
                  <Badge className={cn("text-[10px] font-extrabold uppercase", coupon.isAvailable ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800")}>
                    {coupon.isAvailable ? "Active" : coupon.unavailableReason || "Limit Reached"}
                  </Badge>
                </div>

                <div>
                  <h3 className="font-extrabold text-base text-ink">{coupon.title}</h3>
                  {coupon.description && <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{coupon.description}</p>}
                </div>

                <div className="rounded-xl bg-muted/40 p-3 text-xs space-y-1 border">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Discount Value:</span>
                    <strong className="text-primary font-black">
                      {coupon.discountType === "PERCENTAGE" || coupon.discountType === "PERCENT"
                        ? `${coupon.discountValue}% OFF`
                        : `${money(coupon.discountValue)} FLAT OFF`}
                    </strong>
                  </div>

                  {coupon.maxDiscountCap > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Max Discount Cap:</span>
                      <strong className="text-ink">{money(coupon.maxDiscountCap)}</strong>
                    </div>
                  )}

                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Min Order Value:</span>
                    <strong className="text-ink">{coupon.minOrderValue > 0 ? money(coupon.minOrderValue) : "No Minimum"}</strong>
                  </div>
                </div>

                <div className="text-xs text-muted-foreground space-y-1">
                  {coupon.wholesalerId?.businessName && (
                    <div>Supplier: <strong className="text-ink">{coupon.wholesalerId.businessName}</strong></div>
                  )}
                  {coupon.perRetailerLimit > 0 && (
                    <div>Limit: <strong className="text-ink">{coupon.perRetailerLimit} use(s) per retailer</strong></div>
                  )}
                  {coupon.validUntil && (
                    <div>Valid Until: <strong className="text-ink">{new Date(coupon.validUntil).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</strong></div>
                  )}
                </div>
              </div>

              <div className="mt-5 pt-3 border-t flex items-center justify-between">
                <Button
                  onClick={() => copyCode(coupon.code)}
                  variant="outline"
                  size="sm"
                  className="rounded-xl font-bold w-full"
                >
                  Copy Code
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
