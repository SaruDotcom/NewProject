import { useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowUpRight,
  Building2,
  CalendarDays,
  CircleAlert,
  ClipboardList,
  FileCheck2,
  Headphones,
  PackageSearch,
  Store,
  TrendingUp,
  Users,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DataTable,
  EmptyState,
  StatCard,
  SectionCard,
  StatusBadge,
} from "@/components/admin-ui";
import { getAdminUser } from "@/lib/auth";
import {
  useAdminDashboardCharts,
  useAdminDashboardRecent,
  useAdminDashboardStats,
} from "@/hooks/use-live-data";
import { useNavigate } from "@tanstack/react-router";

export function DashboardPage() {
  const navigate = useNavigate();
  const [range, setRange] = useState("30 Days");
  const [refreshKey, setRefreshKey] = useState(0);

  const period =
    {
      Today: "today",
      "7 Days": "7d",
      "30 Days": "30d",
      "3 Months": "3m",
      "1 Year": "1y",
    }[range] || "30d";

  const {
    stats,
    loading: statsLoading,
    error: statsError,
  } = useAdminDashboardStats(refreshKey);
  const {
    charts,
    loading: chartsLoading,
    error: chartsError,
  } = useAdminDashboardCharts(period, refreshKey);
  const {
    recent,
    loading: recentLoading,
    error: recentError,
  } = useAdminDashboardRecent(refreshKey);

  const recentOrders = recent.recentOrders || [];
  const recentRegistrations = recent.recentRegistrations || [];
  const pendingApprovals = recent.pendingApprovals || [];
  const topWholesalers = charts.topWholesalers || [];
  const topRetailers = charts.topRetailers || [];
  const adminName = getAdminUser()?.name?.trim().split(/\s+/)[0] || "Admin";
  const pendingKycCount =
    stats?.pendingKyc ??
    (pendingApprovals.length >= 5 ? "5+" : pendingApprovals.length);
  const lowStockCount =
    stats?.lowStockCount ??
    (recent.lowStock.length >= 5 ? "5+" : recent.lowStock.length);
  const openSupportCount =
    stats?.openSupportTickets ?? recent.openSupportTickets?.length;

  const salesTrend = (charts.revenueOverTime || []).map((row, index) => ({
    month: row.label,
    revenue: row.revenue,
    orders: (charts.ordersOverTime || [])[index]?.orders || 0,
  }));

  const statusColors = [
    "var(--color-primary)",
    "var(--color-success)",
    "var(--color-warning)",
    "var(--color-destructive)",
    "var(--color-muted-foreground)",
  ];

  const formatNumber = (value) => Number(value || 0).toLocaleString("en-IN");
  const formatCurrency = (value) =>
    `₹${Number(value || 0).toLocaleString("en-IN")}`;

  const chartError = chartsError
    ? `Unable to load dashboard charts: ${chartsError}`
    : null;
  const chartLoading = chartsLoading;
  const recentErrorMessage = recentError
    ? `Unable to load recent records: ${recentError}`
    : null;

  const orderColumns = [
    {
      key: "id",
      label: "Order ID",
      render: (r) => <span className="font-semibold text-primary">{r.id}</span>,
    },
    {
      key: "retailer",
      label: "Retailer",
    },
    {
      key: "wholesaler",
      label: "Wholesaler",
    },
    {
      key: "amountLabel",
      label: "Amount",
      className: "text-right font-medium",
    },
    {
      key: "status",
      label: "Status",
      render: (r) => <StatusBadge status={r.status} />,
    },
  ];

  return (
    <div className="space-y-6">
      <section className="dashboard-hero relative isolate overflow-hidden rounded-2xl bg-tradeflow-navy p-5 text-white shadow-[0_14px_40px_rgba(18,48,74,0.15)] sm:p-7">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-10 -top-24 -z-10 size-80 rounded-full bg-emerald-400/10 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute bottom-[-12rem] right-1/3 -z-10 size-96 rounded-full bg-sky-400/10 blur-3xl"
        />
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-200">
              <CalendarDays className="size-3.5" />
              <span>
                {new Date().toLocaleDateString("en-IN", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </span>
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
              Good morning, {adminName}
            </h1>
            <p className="mt-2 text-sm text-white/70">
              {statsLoading ? (
                "Refreshing your marketplace overview…"
              ) : (
                <>
                  {formatNumber(stats?.pendingOrders)} pending orders
                  <span className="mx-2 text-white/35">·</span>
                  {pendingKycCount} KYC pending
                  <span className="mx-2 text-white/35">·</span>
                  {lowStockCount} low-stock alerts
                  <span className="mx-2 text-white/35">·</span>
                  {openSupportCount == null
                    ? "Support inbox ready to review"
                    : `${formatNumber(openSupportCount)} open tickets`}
                </>
              )}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button
                size="sm"
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={() => navigate({ to: "/kyc" })}
              >
                <FileCheck2 className="size-4" /> Review KYC
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-white/20 bg-white/10 text-white hover:bg-white/15 hover:text-white"
                onClick={() => navigate({ to: "/orders" })}
              >
                <ClipboardList className="size-4" /> View Orders
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-white/20 bg-white/10 text-white hover:bg-white/15 hover:text-white"
                onClick={() => navigate({ to: "/support" })}
              >
                <Headphones className="size-4" /> Support
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="border-white/20 bg-white/10 text-white hover:bg-white/15 hover:text-white"
              onClick={() =>
                navigate({ to: "/wholesalers", search: { status: "Pending" } })
              }
            >
              Review approvals
            </Button>
            <Select value={range} onValueChange={setRange}>
              <SelectTrigger className="w-36 border-white/15 bg-white/10 text-xs text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["Today", "7 Days", "30 Days", "3 Months", "1 Year"].map(
                  (v) => (
                    <SelectItem key={v} value={v} className="text-xs">
                      {v}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>

            <Button
              variant="secondary"
              size="sm"
              className="bg-white/10 text-white hover:bg-white/15 hover:text-white"
              onClick={() => setRefreshKey((key) => key + 1)}
            >
              <RefreshCw className="size-3.5 mr-1.5" /> Refresh
            </Button>
          </div>
        </div>
      </section>

      {/* Top Metrics Cards Grid */}
      <div className="grid grid-cols-2 gap-3.5 md:grid-cols-3 xl:grid-cols-5">
        {statsLoading ? (
          Array.from({ length: 10 }, (_, index) => (
            <div
              key={`stats-loading-${index}`}
              className="admin-card skeleton-shimmer h-28"
              aria-label="Loading statistic"
            />
          ))
        ) : statsError ? (
          <div className="col-span-full rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            Unable to load dashboard statistics: {statsError}
          </div>
        ) : (
          <>
            <StatCard
              label="Total Wholesalers"
              value={formatNumber(stats.totalWholesalers)}
              icon={Building2}
              tone="primary"
              onClick={() => navigate({ to: "/wholesalers" })}
            />
            <StatCard
              label="Active Wholesalers"
              value={formatNumber(stats.activeWholesalers)}
              icon={Users}
              tone="success"
              onClick={() =>
                navigate({ to: "/wholesalers", search: { status: "Active" } })
              }
            />
            <StatCard
              label="Pending Orders"
              value={formatNumber(stats.pendingOrders)}
              icon={TrendingUp}
              tone="warning"
              sparkline={salesTrend.map((row) => row.orders)}
              change={percentChange(salesTrend.map((row) => row.orders))}
              onClick={() =>
                navigate({ to: "/orders", search: { status: "Pending" } })
              }
            />
            <StatCard
              label="Total Retailers"
              value={formatNumber(stats.totalRetailers)}
              icon={Store}
              tone="primary"
              onClick={() => navigate({ to: "/retailers" })}
            />
            <StatCard
              label="Active Retailers"
              value={formatNumber(stats.activeRetailers)}
              icon={Users}
              tone="success"
              onClick={() =>
                navigate({ to: "/retailers", search: { status: "Active" } })
              }
            />
            <StatCard
              label="Total Products"
              value={formatNumber(stats.totalProducts)}
              icon={PackageSearch}
              tone="info"
              onClick={() => navigate({ to: "/products" })}
            />
            <StatCard
              label="Total Orders"
              value={formatNumber(stats.totalOrders)}
              icon={ClipboardList}
              tone="primary"
              sparkline={salesTrend.map((row) => row.orders)}
              change={percentChange(salesTrend.map((row) => row.orders))}
              onClick={() => navigate({ to: "/orders" })}
            />
            <StatCard
              label="Transaction Amount"
              value={formatCurrency(stats.totalTransactionAmount)}
              icon={TrendingUp}
              tone="success"
              sparkline={salesTrend.map((row) => row.revenue)}
              change={percentChange(salesTrend.map((row) => row.revenue))}
              onClick={() => navigate({ to: "/reports" })}
            />
            <StatCard
              label="Total Users"
              value={formatNumber(stats.totalUsers)}
              icon={Users}
              tone="info"
              onClick={() => navigate({ to: "/admin-users" })}
            />
            <StatCard
              label="Active Users"
              value={formatNumber(stats.activeUsers)}
              icon={Users}
              tone="success"
              onClick={() => navigate({ to: "/admin-users" })}
            />
          </>
        )}
      </div>

      <SectionCard
        title="Needs attention"
        description="A quick look at the queues that may need your review."
        className="attention-panel"
      >
        <div className="grid gap-3 md:grid-cols-3">
          <AttentionItem
            icon={FileCheck2}
            label="KYC awaiting review"
            count={pendingKycCount}
            detail={
              pendingApprovals.length
                ? `${pendingApprovals.length} recent application${pendingApprovals.length === 1 ? "" : "s"}`
                : "No recent applications"
            }
            onClick={() => navigate({ to: "/kyc" })}
          />
          <AttentionItem
            icon={Headphones}
            label="Open support tickets"
            count={
              openSupportCount == null ? "—" : formatNumber(openSupportCount)
            }
            detail={
              openSupportCount == null
                ? "Open the support inbox"
                : "Tickets awaiting resolution"
            }
            onClick={() => navigate({ to: "/support" })}
          />
          <AttentionItem
            icon={CircleAlert}
            label="Low-stock alerts"
            count={lowStockCount}
            detail={
              recent.lowStock.length
                ? `${recent.lowStock.length} recent products`
                : "No recent alerts"
            }
            onClick={() => navigate({ to: "/products" })}
          />
        </div>
      </SectionCard>

      {/* Analytics Charts Grid */}
      <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <SectionCard
          title="Sales & Revenue Trend"
          description={`${range} · Total revenue overview`}
        >
          {chartLoading ? (
            <div className="skeleton-shimmer h-72 rounded-lg" />
          ) : chartError ? (
            <p className="flex h-72 items-center justify-center text-sm text-destructive">
              {chartError}
            </p>
          ) : salesTrend.length === 0 ? (
            <EmptyState
              title="No orders in this period"
              description="Try a different date range or check back after orders are placed."
              className="h-72 !p-4"
            />
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={salesTrend}>
                  <defs>
                    <linearGradient id="sales" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="5%"
                        stopColor="var(--color-primary)"
                        stopOpacity={0.2}
                      />
                      <stop
                        offset="95%"
                        stopColor="var(--color-primary)"
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    stroke="var(--color-border)"
                    strokeDasharray="3 5"
                    vertical={false}
                    opacity={0.65}
                  />
                  <XAxis
                    dataKey="month"
                    tickLine={false}
                    axisLine={false}
                    fontSize={11}
                    stroke="var(--color-muted-foreground)"
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    fontSize={11}
                    stroke="var(--color-muted-foreground)"
                  />
                  <Tooltip
                    content={<RoundedTooltip formatValue={formatCurrency} />}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="var(--color-primary)"
                    fill="url(#sales)"
                    strokeWidth={2.5}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Orders Overview"
          description={`${range} · Total order volume`}
        >
          {chartLoading ? (
            <div className="skeleton-shimmer h-72 rounded-lg" />
          ) : chartError ? (
            <p className="flex h-72 items-center justify-center text-sm text-destructive">
              {chartError}
            </p>
          ) : salesTrend.length === 0 ? (
            <EmptyState
              title="No orders in this period"
              description="Try a different date range or check back after orders are placed."
              className="h-72 !p-4"
            />
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={salesTrend}>
                  <CartesianGrid
                    stroke="var(--color-border)"
                    strokeDasharray="3 5"
                    vertical={false}
                    opacity={0.65}
                  />
                  <XAxis
                    dataKey="month"
                    tickLine={false}
                    axisLine={false}
                    fontSize={11}
                    stroke="var(--color-muted-foreground)"
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    fontSize={11}
                    stroke="var(--color-muted-foreground)"
                  />
                  <Tooltip
                    content={<RoundedTooltip formatValue={formatNumber} />}
                  />
                  <Bar
                    dataKey="orders"
                    fill="var(--color-primary)"
                    radius={[8, 8, 0, 0]}
                    maxBarSize={42}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </SectionCard>
      </div>

      {/* Recent Orders & Approvals Section */}
      <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <div className="space-y-3">
          <h2 className="text-sm font-bold tracking-tight text-foreground">
            Recent Orders
          </h2>
          <DataTable
            data={recentOrders}
            columns={orderColumns}
            searchKeys={["id", "retailer", "wholesaler"]}
            filters={["Pending", "Processing", "Shipped", "Delivered"]}
            detailPath={(r) => `/orders/${r.id}`}
            pageSize={5}
            bulk={false}
            emptyTitle="No recent orders yet"
            emptyDescription="Orders will appear here once retailers place them."
          />
        </div>

        <SectionCard
          title="Pending Approvals"
          description="Wholesaler accounts awaiting verification"
        >
          <div className="space-y-3.5">
            {recentLoading ? (
              <p className="text-xs text-muted-foreground">
                Loading approvals...
              </p>
            ) : recentErrorMessage ? (
              <p className="text-xs text-destructive">{recentErrorMessage}</p>
            ) : pendingApprovals.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">
                No pending approvals
              </p>
            ) : (
              pendingApprovals.slice(0, 4).map((w) => (
                <div
                  key={w.id}
                  className="flex items-center justify-between gap-3 rounded-lg border p-3 hover:bg-muted/30 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-foreground">
                      {w.business}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {w.location} · {w.registered}
                    </p>
                  </div>
                  <StatusBadge status="Pending" />
                </div>
              ))
            )}
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs font-medium"
              onClick={() =>
                navigate({ to: "/wholesalers", search: { status: "Pending" } })
              }
            >
              View all approvals
            </Button>
          </div>
        </SectionCard>
      </div>

      {/* Bottom Lists & Rankings */}
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <SectionCard
          title="Recent Registrations"
          description="Latest platform user accounts"
        >
          {recentLoading ? (
            <p className="text-xs text-muted-foreground">
              Loading registrations...
            </p>
          ) : recentErrorMessage ? (
            <p className="text-xs text-destructive">{recentErrorMessage}</p>
          ) : (
            <div className="space-y-2.5">
              {recentRegistrations.slice(0, 5).map((registration) => (
                <div
                  key={String(registration.id)}
                  className="flex items-center justify-between gap-3 border-b border-border/60 pb-2 last:border-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-foreground">
                      {registration.name}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {registration.email}
                    </p>
                  </div>
                  <StatusBadge status={registration.status} />
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs font-medium mt-2"
                onClick={() => navigate({ to: "/retailers" })}
              >
                View all registrations
              </Button>
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Top Wholesalers"
          description={`${range} · by sales volume`}
        >
          {chartLoading ? (
            <div className="skeleton-shimmer h-40 rounded" />
          ) : chartError ? (
            <p className="text-xs text-destructive">{chartError}</p>
          ) : (
            topWholesalers.map((w, i) => (
              <Rank
                key={String(w.id)}
                rank={i + 1}
                name={w.name || "Unknown wholesaler"}
                value={formatCurrency(w.sales)}
              />
            ))
          )}
        </SectionCard>

        <SectionCard
          title="Top Retailers"
          description={`${range} · by order volume`}
        >
          {chartLoading ? (
            <div className="skeleton-shimmer h-40 rounded" />
          ) : chartError ? (
            <p className="text-xs text-destructive">{chartError}</p>
          ) : (
            topRetailers.map((retailer, i) => (
              <Rank
                key={String(retailer.id)}
                rank={i + 1}
                name={retailer.name || "Unknown retailer"}
                value={formatNumber(retailer.orders)}
              />
            ))
          )}
        </SectionCard>

        <SectionCard
          title="Orders Distribution"
          description={`${range} · by status`}
        >
          {chartLoading ? (
            <div className="skeleton-shimmer h-40 rounded" />
          ) : chartError ? (
            <p className="text-xs text-destructive">{chartError}</p>
          ) : (
            <div>
              <div className="relative h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={charts.ordersByStatus}
                      dataKey="orders"
                      nameKey="status"
                      innerRadius={48}
                      outerRadius={70}
                      paddingAngle={3}
                      cornerRadius={5}
                    >
                      {(charts.ordersByStatus || []).map((entry, index) => (
                        <Cell
                          key={`cell-${entry.status}`}
                          fill={statusColors[index % statusColors.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      content={<RoundedTooltip formatValue={formatNumber} />}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xl font-bold tracking-tight text-foreground">
                    {formatNumber(
                      (charts.ordersByStatus || []).reduce(
                        (total, item) => total + Number(item.orders || 0),
                        0,
                      ),
                    )}
                  </span>
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Orders
                  </span>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
                {(charts.ordersByStatus || []).map((entry, index) => (
                  <div
                    key={entry.status}
                    className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground"
                  >
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{
                        backgroundColor:
                          statusColors[index % statusColors.length],
                      }}
                    />
                    <span className="truncate">{entry.status}</span>
                    <span className="ml-auto font-semibold text-foreground">
                      {formatNumber(entry.orders)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

function percentChange(values) {
  if (values.length < 2) return undefined;
  const previous = Number(values.at(-2));
  const current = Number(values.at(-1));
  if (!Number.isFinite(previous) || !Number.isFinite(current) || previous === 0)
    return undefined;
  const change = ((current - previous) / Math.abs(previous)) * 100;
  return `${change > 0 ? "+" : ""}${change.toFixed(1)}%`;
}

function AttentionItem({ icon: Icon, label, count, detail, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex min-h-24 items-center gap-3 rounded-xl border border-border/80 bg-card p-4 text-left transition-all hover:-translate-y-0.5 hover:border-primary/35 hover:bg-accent/30"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-bold text-foreground">
          {label}
        </span>
        <span className="mt-1 block truncate text-[11px] text-muted-foreground">
          {detail}
        </span>
      </span>
      <span className="text-xl font-bold tracking-tight text-foreground">
        {count}
      </span>
      <ArrowUpRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
    </button>
  );
}

function RoundedTooltip({
  active,
  payload,
  label,
  formatValue = (value) => value,
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border/80 bg-card/95 px-3 py-2.5 text-xs shadow-xl backdrop-blur">
      <p className="mb-1.5 font-semibold text-foreground">{label}</p>
      <div className="space-y-1.5">
        {payload.map((item) => (
          <div key={item.dataKey} className="flex items-center gap-2">
            <span
              className="size-2 rounded-full"
              style={{ backgroundColor: item.color || item.fill }}
            />
            <span className="text-muted-foreground">
              {item.name || item.dataKey}
            </span>
            <span className="ml-3 font-bold text-foreground">
              {formatValue(item.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Rank({ rank, name, value }) {
  return (
    <div className="flex items-center gap-3 border-b border-border/50 py-2.5 last:border-0">
      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground">
        {rank}
      </span>
      <span className="min-w-0 flex-1 truncate text-xs font-semibold text-foreground">
        {name}
      </span>
      <span className="text-xs font-bold text-foreground">{value}</span>
    </div>
  );
}
