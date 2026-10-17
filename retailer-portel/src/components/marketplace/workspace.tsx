import { Link, useNavigate } from "@/lib/router";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, ChevronRight, Favorite, FavoriteBorder, LocationOn, Inventory2, ShoppingCartOutlined, Verified, VerifiedUser, Lock, LocalShipping, Notifications } from "@mui/icons-material";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { type RetailerProfile } from "@/state/store";
import { useStore, getCategoryHierarchy, mapOrder } from "@/state/store";
import { ApiError, api, setAuthToken } from "@/api/api";
import { cn } from "@/lib/utils";
import { retailerQueryKeys } from "@/lib/query-client";
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

      {creditInfo?.creditEnabled && (
        <div className="mt-6 rounded-2xl border border-tradeflow-green/20 bg-gradient-to-r from-tradeflow-green-50 via-white to-tradeflow-green-50 p-5 shadow-xs dark:border-tradeflow-green/30 dark:from-tradeflow-navy/70 dark:via-background dark:to-tradeflow-navy/70">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-tradeflow-green/20 pb-3 dark:border-tradeflow-green/30">
            <div className="flex items-center gap-2">
              <Badge className="bg-tradeflow-green text-tradeflow-navy font-bold">Credit Line Active</Badge>
              <span className="text-xs font-semibold text-muted-foreground">Provided by {linkedSupplierName}</span>
            </div>
            <span className="text-xs text-muted-foreground">Pay within <strong>{creditInfo.creditPeriodDays} days</strong> of order</span>
          </div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-xl bg-white p-3.5 border border-tradeflow-gray-200 dark:bg-card dark:border-tradeflow-navy-hover/50">
              <span className="text-xs font-medium text-muted-foreground">Total Credit Limit</span>
              <p className="text-lg font-black text-ink mt-0.5">{money(creditInfo.creditLimit)}</p>
            </div>
            <div className="rounded-xl bg-white p-3.5 border border-tradeflow-gray-200 dark:bg-card dark:border-tradeflow-navy-hover/50">
              <span className="text-xs font-medium text-muted-foreground">Current Outstanding</span>
              <p className={cn("text-lg font-black mt-0.5", creditInfo.outstandingAmount > 0 ? "text-amber-700 dark:text-amber-300" : "text-green-700 dark:text-tradeflow-green")}>
                {money(creditInfo.outstandingAmount)}
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

export function OrdersPage() {
  const { currentUser, orders, products, linkedWholesaler, refreshOrders } = useStore();
  const ordersQuery = useQuery({
    queryKey: retailerQueryKeys.resource(currentUser?.id || "unknown", "orders"),
    queryFn: () => api.getOrders({ limit: 200 }),
    enabled: Boolean(currentUser?.id),
    refetchInterval: 30000,
    select: (response) => Array.isArray(response?.data) ? response.data.map(mapOrder) : [],
  });
  const [activeTab, setActiveTab] = useState("All orders");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "highest" | "lowest">("newest");

  useEffect(() => {
    void refreshOrders();
  }, [refreshOrders]);

  const visibleOrders = ordersQuery.data ?? orders;
  const supplierName = linkedWholesaler?.name || linkedWholesaler?.businessName || "Connected wholesaler";

  const filteredOrders = useMemo(() => {
    return visibleOrders
      .filter((o) => {
        const matchesTab = activeTab === "All orders" || o.status.toLowerCase() === activeTab.toLowerCase();

        if (!matchesTab) return false;

        if (!search.trim()) return true;
        const q = search.toLowerCase();
        const matchesId = String(o.id).toLowerCase().includes(q);
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
          placeholder="Search by Order ID, wholesaler, or product..."
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
  const order = orderQuery.data ?? orders.find((candidate) => String(candidate.id) === String(orderId));
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
          <p className="text-xs text-muted-foreground">Order {order.id} · {order.date}</p>
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
              <strong className="text-ink">{order.isCreditOrder ? "Credit" : order.paymentMethod === "ONLINE" ? "Online Payment" : "Cash on Delivery"}</strong>
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
  const { currentUser, cart, retailerProfile, placeOrder, products } = useStore();
  const [placed, setPlaced] = useState(false);
  const [paymentMode, setPaymentMode] = useState<"ONLINE" | "CREDIT">("ONLINE");
  const creditQuery = useQuery({
    queryKey: retailerQueryKeys.resource(currentUser?.id || "unknown", "credit"),
    queryFn: async () => (await api.getCreditInfo())?.data ?? null,
    enabled: Boolean(currentUser?.id),
  });
  const creditInfo = creditQuery.data;
  const loadingCredit = creditQuery.isLoading;

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

  const meetsMinOrder = !minOrderForCredit || total >= minOrderForCredit;
  const isCreditEligible = isCreditEnabled && meetsMinOrder && availableCredit >= total;

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + creditPeriodDays);
  const formattedDueDate = dueDate.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

  const [agreedToTerms, setAgreedToTerms] = useState(true);

  // Coupon State
  const [couponCodeInput, setCouponCodeInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [validatingCoupon, setValidatingCoupon] = useState(false);

  const handleApplyCoupon = async () => {
    if (!couponCodeInput.trim()) return;
    setValidatingCoupon(true);
    setCouponError(null);
    try {
      const res = await api.validateCoupon({
        code: couponCodeInput.trim(),
        subtotal: total,
      });
      if (res && res.success && res.data && res.data.valid) {
        setAppliedCoupon(res.data.coupon);
        setDiscountAmount(res.data.discountAmount);
        toast.success(`Coupon '${res.data.coupon.code}' applied! Saved ${money(res.data.discountAmount)}`);
      }
    } catch (err: any) {
      setAppliedCoupon(null);
      setDiscountAmount(0);
      setCouponError(err?.message || "Invalid or ineligible coupon code");
    } finally {
      setValidatingCoupon(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setDiscountAmount(0);
    setCouponCodeInput("");
    setCouponError(null);
  };

  const finalTotal = Math.max(0, total - discountAmount);

  const handlePlaceOrder = async () => {
    if (!agreedToTerms) {
      toast.error("Please agree to the Wholesaler Trade Terms & Privacy Policy.");
      return;
    }
    if (paymentMode === "CREDIT" && !isCreditEligible) {
      toast.error("You are not eligible for credit on this order.");
      return;
    }
    await placeOrder(paymentMode, appliedCoupon?.code);
    setPlaced(true);
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
              : "Your order has been split into separate requests for each wholesaler."}
          </p>
          <Button asChild className="mt-6 rounded-xl font-extrabold"><Link to="/orders">View Orders</Link></Button>
        </div>
      </main>
    );
  }

  return (
    <main className="shell py-10">
      <h1 className="text-3xl font-extrabold text-ink">Checkout</h1>
      <p className="mt-2 text-muted-foreground font-medium font-semibold">Complete your delivery details and choose your payment method.</p>

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
            <h2 className="text-xl font-bold text-ink">Select Payment Method</h2>

            <label
              className={`flex items-start gap-3 border p-4 rounded-xl cursor-pointer transition-all ${
                paymentMode === "ONLINE" ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border/80 hover:bg-muted/30"
              }`}
              onClick={() => setPaymentMode("ONLINE")}
            >
              <input type="radio" name="payment" checked={paymentMode === "ONLINE"} onChange={() => setPaymentMode("ONLINE")} className="mt-1" />
              <div>
                <b className="block text-ink text-sm">Online Payment (UPI / NetBanking / Cards)</b>
                <span className="mt-0.5 block text-xs text-muted-foreground">Instant payment via secure digital gateway.</span>
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
                    <b className="text-ink text-sm">Credit (Pay Later)</b>
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
                    Buy now and pay within <strong>{creditPeriodDays} days</strong> directly to your connected wholesaler.
                  </p>

                  {isCreditEligible && paymentMode === "CREDIT" && (
                    <div className="mt-3 rounded-xl border border-primary/20 bg-background p-3 text-xs space-y-1.5">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Payment Due Date:</span>
                        <strong className="text-ink font-extrabold">{formattedDueDate}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Available Credit Limit:</span>
                        <b className="text-emerald-600 font-bold">{money(availableCredit)}</b>
                      </div>
                      <div className="flex justify-between border-t pt-1.5">
                        <span className="text-muted-foreground">Remaining Limit After Order:</span>
                        <b className="text-ink font-bold">{money(Math.max(0, availableCredit - finalTotal))}</b>
                      </div>
                    </div>
                  )}

                  {!loadingCredit && !isCreditEnabled && (
                    <div className="mt-2 text-[11px] font-semibold text-amber-700">
                      ⚠️ Credit payment is currently not enabled by your connected wholesaler.
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
          </div>
        </section>

        <aside className="h-fit border bg-card p-6 rounded-2xl shadow-2xs space-y-4">
          <h2 className="text-xl font-bold text-ink">Order summary</h2>

          {/* Coupon Code Section */}
          <div className="border border-primary/20 bg-primary/[0.03] p-4 rounded-xl space-y-2">
            <span className="text-xs font-bold text-ink block">Apply Coupon Code</span>
            {appliedCoupon ? (
              <div className="flex items-center justify-between bg-emerald-50 text-emerald-800 border border-emerald-200 p-2.5 rounded-lg text-xs">
                <div>
                  <div className="font-extrabold text-status-success">✓ '{appliedCoupon.code}' Applied</div>
                  <div className="text-[11px] text-emerald-700">Saving {money(discountAmount)}</div>
                </div>
                <button
                  type="button"
                  onClick={handleRemoveCoupon}
                  className="text-xs font-bold text-rose-600 hover:underline"
                >
                  Remove
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. DIWALI50"
                    value={couponCodeInput}
                    onChange={(e) => {
                      setCouponCodeInput(e.target.value.toUpperCase());
                      setCouponError(null);
                    }}
                    className="flex-1 rounded-lg border bg-background px-3 py-1.5 text-xs font-mono font-bold uppercase focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  <Button
                    type="button"
                    onClick={handleApplyCoupon}
                    disabled={validatingCoupon || !couponCodeInput.trim()}
                    size="sm"
                    className="rounded-lg font-bold text-xs"
                  >
                    {validatingCoupon ? "Validating..." : "Apply"}
                  </Button>
                </div>
                {couponError && (
                  <p className="text-[11px] font-semibold text-rose-600">⚠️ {couponError}</p>
                )}
              </div>
            )}
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
                <span>Coupon Discount ({appliedCoupon?.code}):</span>
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
              I agree to the wholesaler's trade terms, payment due dates & <strong className="text-ink">Privacy Policy</strong>.
            </span>
          </label>

          <Button className="w-full rounded-xl font-extrabold" size="lg" onClick={handlePlaceOrder}>
            {paymentMode === "CREDIT" ? "Place Credit Order" : "Place Order"}
          </Button>
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
  const { retailerProfile, saveProfile, linkedWholesaler } = useStore();
  const navigate = useNavigate();
  const [form, setForm] = useState<RetailerProfile>(retailerProfile);
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
                required
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
                required
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
        <aside className="border bg-card p-6">
          <VerifiedUser className="size-7 text-success" />
          <h2 className="mt-4 font-bold">{setupMode ? "Setup checklist" : "Verified retailer account"}</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {setupMode ? "Complete these details once to unlock your connected wholesale store." : "Your business information is ready to share with connected wholesalers."}
          </p>
          <div className="mt-5 space-y-3 text-sm">
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

export function AuthPage({ mode: initialMode }: { mode: "login" | "register" | "forgot" }) {
  const { login } = useStore();

  const [mode, setMode] = useState<"login" | "register" | "forgot">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loginId, setLoginId] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [phone, setPhone] = useState("");
  const referralFromLink =
    new URLSearchParams(window.location.search).get("ref")?.trim() ||
    (typeof window !== "undefined" ? localStorage.getItem("nexora_retailer_referral_code")?.trim() : "") ||
    "";
  const [referralCode, setReferralCode] = useState(referralFromLink.toUpperCase());
  const [referralWholesaler, setReferralWholesaler] = useState<{
    code: string;
    businessName: string;
    logo: string;
    city: string;
  } | null>(null);
  const activeReferralWholesaler =
    referralWholesaler?.code === referralFromLink.toUpperCase() ? referralWholesaler : null;
  const [referralError, setReferralError] = useState("");
  const [isLookingUpReferral, setIsLookingUpReferral] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    const code = referralFromLink.toUpperCase();
    setReferralCode(code);
    setReferralWholesaler(null);
    setReferralError("");
    if (mode !== "register" || !code) {
      setIsLookingUpReferral(false);
      return;
    }

    let isCurrentLookup = true;
    setIsLookingUpReferral(true);
    void api.getReferral(code)
      .then((response) => {
        if (isCurrentLookup) setReferralWholesaler({ ...response.data.wholesaler, code });
      })
      .catch((error: unknown) => {
        if (!isCurrentLookup) return;
        const status = error instanceof ApiError ? error.status : undefined;
        setReferralError(
          status === 403 || status === 404
            ? "This invite link is invalid or inactive. Ask your wholesaler for a new invite link."
            : "Unable to verify this invite link. Please try again.",
        );
      })
      .finally(() => {
        if (isCurrentLookup) setIsLookingUpReferral(false);
      });

    return () => {
      isCurrentLookup = false;
    };
  }, [mode, referralFromLink]);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (mode === "login") {
        await login(email, password);
        toast.success("Login successful!");
        window.location.href = "/dashboard";
      } else if (mode === "register") {
        if (!activeReferralWholesaler) {
          setReferralError("This invite link is invalid or inactive. Ask your wholesaler for a new invite link.");
          return;
        }
        if (!phone || !/^\d{10}$/.test(phone.trim())) {
          toast.error("Please enter a valid 10-digit mobile number.");
          setIsSubmitting(false);
          return;
        }
        if (password.length < 6) {
          toast.error("Password must be at least 6 characters.");
          setIsSubmitting(false);
          return;
        }

        const res = await api.register({
          name: name.trim(),
          loginId: loginId.trim().toUpperCase(),
          businessName: businessName.trim(),
          phone: phone.trim(),
          email: email.trim(),
          password,
          referralCode: referralCode.trim().toUpperCase(),
        });

        const token = res.data.token || res.data.accessToken;
        if (token) {
          setAuthToken(token);
          toast.success("Account created successfully! Welcome to NEXORA.");
          window.location.href = "/dashboard";
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
    <main className="grid min-h-[calc(100vh-120px)] place-items-center bg-canvas px-4 py-12">
      <section className="w-full max-w-md border bg-card p-7 shadow-sm rounded-2xl">
        <div className="text-center">
          <TradeFlowMark className="mx-auto size-12 rounded-xl shadow-sm" />
          <h1 className="mt-4 text-2xl font-extrabold text-ink">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {mode === "forgot"
              ? "We'll send a reset link to your account email."
              : mode === "register"
              ? "Create your account using your wholesaler's invite link."
              : "Sign in with your retailer ID or email and password."}
          </p>
        </div>

        {(mode !== "register" || activeReferralWholesaler) ? (
        <form className="mt-6 grid gap-4" onSubmit={handleAuthSubmit}>
          {mode === "register" && (
              <div className="grid gap-3">
                <label className="text-xs font-bold text-ink">
                  Wholesaler Invite Code
                  <Input
                    className="mt-1.5 uppercase font-mono tracking-wider font-bold"
                    type="text"
                    value={referralCode}
                    readOnly
                  />
                </label>
                {isLookingUpReferral && (
                  <p className="text-xs text-muted-foreground">Checking referral link...</p>
                )}
              {referralError && (
                <p role="alert" className="text-xs font-semibold text-red-600">{referralError}</p>
              )}
              {activeReferralWholesaler && (
                <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                  {activeReferralWholesaler.logo && (
                    <img src={activeReferralWholesaler.logo} alt="" className="size-12 rounded-lg object-cover" />
                  )}
                  <div>
                    <p className="text-xs text-muted-foreground">You are joining:</p>
                    <p className="font-bold text-ink">{activeReferralWholesaler.businessName}</p>
                    {activeReferralWholesaler.city && (
                      <p className="text-xs text-muted-foreground">{activeReferralWholesaler.city}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {(mode === "login" || mode === "forgot" || (mode === "register" && activeReferralWholesaler)) && mode === "register" && (
            <>
              <label className="text-xs font-bold text-ink">
                Owner / Contact Name *
                <Input
                  className="mt-1.5"
                  type="text"
                  placeholder="e.g. Rajesh Kumar"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </label>
              <label className="text-xs font-bold text-ink">
                Retailer Login ID (Username) *
                <Input
                  className="mt-1.5 uppercase font-mono"
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
              </label>
              <label className="text-xs font-bold text-ink">
                Business / Store Name *
                <Input
                  className="mt-1.5"
                  type="text"
                  placeholder="e.g. Kumar General Store"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  required
                />
              </label>
              <label className="text-xs font-bold text-ink">
                10-Digit Mobile Number *
                <Input
                  className="mt-1.5"
                  type="tel"
                  maxLength={10}
                  placeholder="e.g. 9876543210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  required
                />
              </label>
            </>
          )}

          {(mode === "login" || mode === "forgot" || (mode === "register" && activeReferralWholesaler)) && (
            <label className="text-xs font-bold text-ink">
              {mode === "register" ? "Email Address (Gmail / Email ID) *" : "Retailer ID / Email"}
              <Input
                className="mt-1.5"
                type={mode === "register" || mode === "forgot" ? "email" : "text"}
                autoComplete="off"
                placeholder={mode === "register" ? "e.g. sarita@gmail.com" : "Enter retailer ID or email"}
                value={email}
                onChange={(e) => setEmail(mode === "login" ? e.target.value.toUpperCase().replace(/[^A-Z0-9@._-]/g, "") : e.target.value)}
                required
              />
              {mode === "register" && (
                <span className="mt-1 block text-[11px] font-normal text-muted-foreground">
                  Enter your Gmail / Email address here (e.g. yourname@gmail.com).
                </span>
              )}
            </label>
          )}

          {(mode === "login" || (mode === "register" && activeReferralWholesaler)) && (
            <label className="text-xs font-bold text-ink">
              Password *
              <Input
                className="mt-1.5"
                type="password"
                autoComplete={mode === "register" ? "new-password" : "current-password"}
                placeholder={mode === "register" ? "Create a strong password (min 6 chars)" : "Enter your password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>
          )}

          {(mode === "login" || mode === "forgot" || (mode === "register" && activeReferralWholesaler)) && (
            <Button type="submit" size="lg" disabled={isSubmitting} className="mt-2 rounded-xl font-extrabold">
            {isSubmitting
              ? mode === "login" ? "Signing in..." : "Creating Account..."
              : mode === "login" ? "Sign In" : mode === "register" ? "Register & Connect" : "Send Reset Link"}
            </Button>
          )}
        </form>
        ) : (
          <div className="mt-6 space-y-3 text-center" role="status">
            {!referralFromLink
              ? <p className="text-sm text-muted-foreground">Registration is by invitation only. Ask your wholesaler for an invite link.</p>
              : isLookingUpReferral
                ? <><p className="text-sm text-muted-foreground">Checking invite link...</p><Input className="text-center font-mono uppercase" value={referralCode} readOnly aria-label="Wholesaler invite code" /></>
                : <><Input className="text-center font-mono uppercase" value={referralCode} readOnly aria-label="Wholesaler invite code" /><p role="alert" className="text-sm font-semibold text-red-600">{referralError || "This invite link is invalid or inactive. Ask your wholesaler for a new invite link."}</p></>}
          </div>
        )}

        <div className="mt-6 text-center text-xs text-muted-foreground">
          {mode === "login" ? (
            <>
              <Link className="text-primary hover:underline font-bold" to="/forgot-password">Forgot password?</Link>
              <p className="mt-2">New here? Ask your wholesaler for an invite link to register.</p>
            </>
          ) : (
            mode === "register" && (
              <Link className="text-primary hover:underline font-bold" to="/login">Already have an account? Sign in</Link>
            )
          )}
        </div>
      </section>
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
              {t === "ALL" ? `All Offers (${coupons.length})` : t === "AVAILABLE" ? `Available (${coupons.filter(c => c.isAvailable).length})` : `Unavailable (${coupons.filter(c => !c.isAvailable).length})`}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <input
            type="text"
            placeholder="Search offer code or title..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border bg-background px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>

      {loading ? (
        <div className="mt-8 text-center py-16 bg-card border rounded-2xl">
          <div className="size-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-3 text-xs font-semibold text-muted-foreground">Loading exclusive offers...</p>
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
