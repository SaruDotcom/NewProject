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
  Building2,
  ClipboardList,
  CreditCard,
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
  StatCard,
  PageHeader,
  SectionCard,
  StatusBadge,
} from "@/components/admin-ui";
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

  const { stats, loading: statsLoading, error: statsError } = useAdminDashboardStats(refreshKey);
  const { charts, loading: chartsLoading, error: chartsError } = useAdminDashboardCharts(period, refreshKey);
  const { recent, loading: recentLoading, error: recentError } = useAdminDashboardRecent(refreshKey);

  const loading = statsLoading && chartsLoading && recentLoading;
  const recentOrders = recent.recentOrders || [];
  const recentRegistrations = recent.recentRegistrations || [];
  const pendingApprovals = recent.pendingApprovals || [];
  const topWholesalers = charts.topWholesalers || [];
  const topRetailers = charts.topRetailers || [];

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
  const formatCurrency = (value) => `₹${Number(value || 0).toLocaleString("en-IN")}`;

  const chartError = chartsError ? `Unable to load dashboard charts: ${chartsError}` : null;
  const chartLoading = chartsLoading;
  const recentErrorMessage = recentError ? `Unable to load recent records: ${recentError}` : null;

  const orderColumns = [
    {
      key: "id",
      label: "Order ID",
      render: (r) => (
        <span className="font-semibold text-primary">{r.id}</span>
      ),
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

  if (loading) {
    return (
      <div className="flex min-h-[280px] items-center justify-center rounded-xl border border-dashed bg-card text-sm font-medium text-muted-foreground">
        Loading live dashboard data...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Marketplace Overview"
        description="Complete visibility across your wholesale commerce network."
        action={
          <div className="flex items-center gap-2">
            <Select value={range} onValueChange={setRange}>
              <SelectTrigger className="w-36 bg-card text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["Today", "7 Days", "30 Days", "3 Months", "1 Year"].map((v) => (
                  <SelectItem key={v} value={v} className="text-xs">
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setRefreshKey((key) => key + 1)}
            >
              <RefreshCw className="size-3.5 mr-1.5" /> Refresh
            </Button>

            <Button
              size="sm"
              onClick={() => navigate({ to: "/wholesalers", search: { status: "Pending" } })}
            >
              Review approvals
            </Button>
          </div>
        }
      />

      {/* Top Metrics Cards Grid */}
      <div className="grid grid-cols-2 gap-3.5 md:grid-cols-3 xl:grid-cols-5">
        {statsLoading ? (
          Array.from({ length: 10 }, (_, index) => (
            <div
              key={`stats-loading-${index}`}
              className="admin-card h-28 animate-pulse bg-muted/40"
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
              onClick={() => navigate({ to: "/wholesalers", search: { status: "Active" } })}
            />
            <StatCard
              label="Pending Orders"
              value={formatNumber(stats.pendingOrders)}
              icon={TrendingUp}
              tone="warning"
              onClick={() => navigate({ to: "/orders", search: { status: "Pending" } })}
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
              onClick={() => navigate({ to: "/retailers", search: { status: "Active" } })}
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
              onClick={() => navigate({ to: "/orders" })}
            />
            <StatCard
              label="Transaction Amount"
              value={formatCurrency(stats.totalTransactionAmount)}
              icon={TrendingUp}
              tone="success"
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

      {/* Analytics Charts Grid */}
      <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <SectionCard
          title="Sales & Revenue Trend"
          description={`${range} · Total revenue overview`}
        >
          {chartLoading ? (
            <div className="h-72 animate-pulse rounded-lg bg-muted/40" />
          ) : chartError ? (
            <p className="flex h-72 items-center justify-center text-sm text-destructive">{chartError}</p>
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={salesTrend}>
                  <defs>
                    <linearGradient id="sales" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={11} stroke="var(--color-muted-foreground)" />
                  <YAxis tickLine={false} axisLine={false} fontSize={11} stroke="var(--color-muted-foreground)" />
                  <Tooltip
                    contentStyle={{
                      borderColor: "var(--color-border)",
                      borderRadius: 8,
                      boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                    }}
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
            <div className="h-72 animate-pulse rounded-lg bg-muted/40" />
          ) : chartError ? (
            <p className="flex h-72 items-center justify-center text-sm text-destructive">{chartError}</p>
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={salesTrend}>
                  <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={11} stroke="var(--color-muted-foreground)" />
                  <YAxis tickLine={false} axisLine={false} fontSize={11} stroke="var(--color-muted-foreground)" />
                  <Tooltip
                    contentStyle={{
                      borderColor: "var(--color-border)",
                      borderRadius: 8,
                      boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                    }}
                  />
                  <Bar dataKey="orders" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </SectionCard>
      </div>

      {/* Recent Orders & Approvals Section */}
      <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <div className="space-y-3">
          <h2 className="text-sm font-bold tracking-tight text-foreground">Recent Orders</h2>
          <DataTable
            data={recentOrders}
            columns={orderColumns}
            searchKeys={["id", "retailer", "wholesaler"]}
            filters={["Pending", "Processing", "Shipped", "Delivered"]}
            detailPath={(r) => `/orders/${r.id}`}
            pageSize={5}
            bulk={false}
          />
        </div>

        <SectionCard
          title="Pending Approvals"
          description="Wholesaler accounts awaiting verification"
        >
          <div className="space-y-3.5">
            {recentLoading ? (
              <p className="text-xs text-muted-foreground">Loading approvals...</p>
            ) : recentErrorMessage ? (
              <p className="text-xs text-destructive">{recentErrorMessage}</p>
            ) : pendingApprovals.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">No pending approvals</p>
            ) : (
              pendingApprovals.slice(0, 4).map((w) => (
                <div
                  key={w.id}
                  className="flex items-center justify-between gap-3 rounded-lg border p-3 hover:bg-muted/30 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-foreground">{w.business}</p>
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
              onClick={() => navigate({ to: "/wholesalers", search: { status: "Pending" } })}
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
            <p className="text-xs text-muted-foreground">Loading registrations...</p>
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
                    <p className="truncate text-xs font-bold text-foreground">{registration.name}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{registration.email}</p>
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
            <div className="h-40 animate-pulse rounded bg-muted/40" />
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
            <div className="h-40 animate-pulse rounded bg-muted/40" />
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
            <div className="h-40 animate-pulse rounded bg-muted/40" />
          ) : chartError ? (
            <p className="text-xs text-destructive">{chartError}</p>
          ) : (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={charts.ordersByStatus}
                    dataKey="orders"
                    nameKey="status"
                    innerRadius={42}
                    outerRadius={68}
                    paddingAngle={3}
                  >
                    {(charts.ordersByStatus || []).map((entry, index) => (
                      <Cell
                        key={`cell-${entry.status}`}
                        fill={statusColors[index % statusColors.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </SectionCard>
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
      <span className="min-w-0 flex-1 truncate text-xs font-semibold text-foreground">{name}</span>
      <span className="text-xs font-bold text-foreground">{value}</span>
    </div>
  );
}
