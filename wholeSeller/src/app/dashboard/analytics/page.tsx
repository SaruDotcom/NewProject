'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  CalendarDays,
  CheckCircle2,
  Clock3,
  CreditCard,
  DollarSign,
  Flame,
  Package,
  RefreshCw,
  ShieldCheck,
  ShoppingCart,
  Snail,
  Sparkles,
  TrendingUp,
  Users,
  Warehouse,
  type LucideIcon,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import api, { type WholesalerAnalyticsReport } from '@/lib/api';
import { useWholesaler } from '@/context/WholesalerContext';
import { wholesalerQueryKeys } from '@/lib/query-client';

type DatePreset = 'Today' | 'This Week' | 'This Month' | 'This Year' | 'Custom';

const PRESETS: Array<Exclude<DatePreset, 'Custom'>> = ['Today', 'This Week', 'This Month', 'This Year'];

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'var(--color-status-warning)',
  CONFIRMED: 'var(--color-tradeflow-sky)',
  PROCESSING: 'var(--color-tradeflow-navy-hover)',
  PACKED: 'var(--color-tradeflow-green)',
  SHIPPED: 'var(--color-tradeflow-sky)',
  OUT_FOR_DELIVERY: 'var(--color-tradeflow-navy)',
  DELIVERED: 'var(--color-status-success)',
  CANCELLED: 'var(--color-status-danger)',
  RETURN_REQUESTED: 'var(--color-status-warning)',
  RETURNED: 'var(--color-tradeflow-navy-hover)',
  REFUNDED: 'var(--color-tradeflow-gray-500)',
};

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getPresetRange(preset: Exclude<DatePreset, 'Custom'>) {
  const end = new Date();
  end.setHours(0, 0, 0, 0);
  const start = new Date(end);

  if (preset === 'Today') {
    // start is today
  } else if (preset === 'This Week') {
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  } else if (preset === 'This Month') {
    start.setDate(1);
  } else if (preset === 'This Year') {
    start.setMonth(0, 1);
  }

  return { startDate: toDateInputValue(start), endDate: toDateInputValue(end) };
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function formatCompactCurrency(value: number) {
  return `₹${new Intl.NumberFormat('en-IN', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value || 0)}`;
}

function formatTrendDate(value: string) {
  if (!value) return '';
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' }).format(
    new Date(`${value}T00:00:00Z`)
  );
}

function GrowthBadge({ value }: { value?: number }) {
  if (value === undefined || value === null) return null;
  const isPositive = value >= 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-extrabold ${
        isPositive ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
      }`}
    >
      {isPositive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {Math.abs(value)}% vs prev period
    </span>
  );
}

function MetricCard({
  title,
  value,
  growth,
  detail,
  icon: Icon,
  tone = 'red',
}: {
  title: string;
  value: string;
  growth?: number;
  detail?: string;
  icon: LucideIcon;
  tone?: 'red' | 'green' | 'blue' | 'amber';
}) {
  const tones = {
    red: 'bg-amber-50 text-amber-800',
    green: 'bg-green-50 text-green-700',
    blue: 'bg-blue-50 text-blue-700',
    amber: 'bg-amber-50 text-amber-700',
  };

  return (
    <article className="rounded-2xl border border-tradeflow-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-gray-500">{title}</p>
          <p className="mt-2 text-2xl font-extrabold tracking-tight text-tradeflow-navy">{value}</p>
        </div>
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tones[tone]}`}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <GrowthBadge value={growth} />
        {detail && <span className="text-[11px] font-semibold text-gray-400">{detail}</span>}
      </div>
    </article>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex h-full items-center justify-center text-sm text-gray-500 font-medium">
      {label}
    </div>
  );
}

export default function AnalyticsPage() {
  const { profile } = useWholesaler();
  const initialRange = getPresetRange('This Month');
  const [preset, setPreset] = useState<DatePreset>('This Month');
  const [startDate, setStartDate] = useState(initialRange.startDate);
  const [endDate, setEndDate] = useState(initialRange.endDate);
  const validRange = Boolean(startDate && endDate && startDate <= endDate);
  const reportQuery = useQuery({
    queryKey: wholesalerQueryKeys.resource(profile.id || 'unknown', 'analytics', startDate, endDate),
    queryFn: async () => {
      const response = await api.getWholesalerAnalytics(startDate, endDate);
      if (!response?.data?.report) {
        throw new Error('The analytics service returned an invalid report.');
      }
      return response.data.report as WholesalerAnalyticsReport;
    },
    enabled: validRange && Boolean(profile.id),
  });
  const report = reportQuery.data ?? null;
  const loading = reportQuery.isLoading;
  const error = !validRange
    ? 'Choose a valid date range. The start date must be on or before the end date.'
    : reportQuery.error?.message || '';

  const selectPreset = (nextPreset: Exclude<DatePreset, 'Custom'>) => {
    const range = getPresetRange(nextPreset);
    setPreset(nextPreset);
    setStartDate(range.startDate);
    setEndDate(range.endDate);
  };

  const setCustomDate = (field: 'start' | 'end', value: string) => {
    setPreset('Custom');
    if (field === 'start') setStartDate(value);
    else setEndDate(value);
  };

  const statusData = (report?.orders.statusBreakdown || []).map((item) => ({
    ...item,
    label: item.status.replace(/_/g, ' '),
    color: STATUS_COLORS[item.status] || 'var(--color-tradeflow-gray-400)',
  }));

  const topProducts = report?.products.byRevenue || [];
  const topCategories = report?.categories || [];
  const topRetailers = report?.retailers.top || [];
  const newRetailersTrend = report?.retailers.newRetailersTrend || [];
  const movementTrend = report?.inventory.movementTrend || [];
  const growth = report?.growth || { revenueGrowth: 0, profitGrowth: 0, ordersGrowth: 0, aovGrowth: 0, retailersGrowth: 0 };
  const insights = report?.insights || {
    returnRatePercent: 0,
    deliveredOrders: 0,
    returnedOrders: 0,
    cancelledOrders: 0,
    lowStockAlerts: [],
    fastMovingProducts: [],
    slowMovingProducts: [],
  };

  const rangeLabel = `${startDate} to ${endDate}`;

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <header className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end bg-white p-6 rounded-2xl border border-tradeflow-gray-200 shadow-xs">
        <div>
          <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-tradeflow-green/20 bg-tradeflow-green-50 px-3 py-1 text-[11px] font-extrabold uppercase text-green-700">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            Visual Performance Dashboard
          </div>
          <h1 className="text-2xl font-black tracking-tight text-tradeflow-navy">Analytics</h1>
          <p className="mt-1 text-sm text-gray-500">
            Real-time visual insights, trends, and growth indicators for {profile.businessName || 'your business'}.
          </p>
        </div>

        {/* Date Filter Control */}
        <div className="rounded-2xl border border-tradeflow-gray-200 bg-tradeflow-gray-50 p-3 shadow-xs">
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => selectPreset(item)}
                className={`rounded-xl px-3.5 py-1.5 text-xs font-extrabold transition-all ${
                  preset === item
                    ? 'bg-tradeflow-green text-tradeflow-navy shadow-xs'
                    : 'bg-white text-gray-700 border border-tradeflow-gray-200 hover:bg-tradeflow-green-50 hover:text-green-700'
                }`}
              >
                {item}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPreset('Custom')}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-extrabold transition-all ${
                preset === 'Custom'
                  ? 'bg-tradeflow-green text-tradeflow-navy shadow-xs'
                  : 'bg-white text-gray-700 border border-tradeflow-gray-200 hover:bg-tradeflow-green-50 hover:text-green-700'
              }`}
            >
              Custom Range
            </button>
          </div>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs font-bold text-gray-600">
              From
              <input
                type="date"
                value={startDate}
                max={endDate || undefined}
                onChange={(event) => setCustomDate('start', event.target.value)}
                className="rounded-lg border border-tradeflow-gray-200 bg-white px-2 py-1 text-xs text-gray-900 focus:border-tradeflow-green focus:outline-none"
              />
            </label>
            <label className="flex items-center gap-1.5 text-xs font-bold text-gray-600">
              To
              <input
                type="date"
                value={endDate}
                min={startDate || undefined}
                onChange={(event) => setCustomDate('end', event.target.value)}
                className="rounded-lg border border-tradeflow-gray-200 bg-white px-2 py-1 text-xs text-gray-900 focus:border-tradeflow-green focus:outline-none"
              />
            </label>
          </div>
        </div>
      </header>

      {/* Reporting Period Indicator */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <p className="flex items-center gap-2 text-xs font-extrabold text-gray-500">
          <CalendarDays className="h-4 w-4 text-green-700" aria-hidden="true" />
          Selected Window: <span className="text-gray-900 font-bold">{rangeLabel}</span>
        </p>
        {loading && (
          <span className="flex items-center gap-2 text-xs font-bold text-gray-500">
            <RefreshCw className="h-3.5 w-3.5 animate-spin text-green-700" aria-hidden="true" />
            Computing aggregation metrics…
          </span>
        )}
      </div>

      {error && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-800">
          ⚠️ {error}
        </div>
      )}

      {loading && !report ? (
        <div className="rounded-2xl border border-tradeflow-gray-200 bg-white p-16 text-center text-xs font-bold text-gray-500">
          <RefreshCw className="h-8 w-8 animate-spin text-green-700 mx-auto mb-3" />
          Aggregating wholesaler data in IST…
        </div>
      ) : report ? (
        <>
          {/* STAT CARDS (6 Key Metrics) */}
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Key Performance Indicators">
            <MetricCard
              title="Total Revenue"
              value={formatCurrency(report.financial.revenue)}
              growth={growth.revenueGrowth}
              detail={`${report.orders.total} orders`}
              icon={DollarSign}
            />
            <MetricCard
              title="Total Profit"
              value={formatCurrency(report.financial.profit)}
              growth={growth.profitGrowth}
              detail="Cost price snapshot basis"
              icon={TrendingUp}
              tone="green"
            />
            <MetricCard
              title="Avg. Order Value"
              value={formatCurrency(report.financial.averageOrderValue)}
              growth={growth.aovGrowth}
              detail="Non-cancelled orders"
              icon={ShoppingCart}
              tone="blue"
            />
            <MetricCard
              title="Total Orders"
              value={report.orders.total.toLocaleString('en-IN')}
              growth={growth.ordersGrowth}
              detail="All statuses included"
              icon={ShoppingCart}
              tone="amber"
            />
            <MetricCard
              title="Active Retailers"
              value={report.retailers.connected.toLocaleString('en-IN')}
              growth={growth.retailersGrowth}
              detail={`${report.retailers.newConnected} new in period`}
              icon={Users}
              tone="green"
            />
            <MetricCard
              title="Credit Outstanding"
              value={formatCurrency(report.financial.creditOutstanding)}
              detail={`Overdue: ${formatCurrency(report.financial.overdueAmount)}`}
              icon={CreditCard}
              tone="red"
            />
          </section>

          {/* INSIGHTS SUMMARY BANNER */}
          <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-tradeflow-sky/30 bg-gradient-to-br from-tradeflow-sky-50 to-white p-4 flex items-center gap-3">
              <div className="p-3 bg-tradeflow-sky-50 text-tradeflow-navy rounded-xl">
                <RefreshCw className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[11px] font-extrabold uppercase text-tradeflow-navy">Return Rate %</p>
                <p className="text-xl font-black text-tradeflow-navy mt-0.5">{insights.returnRatePercent}%</p>
                <p className="text-[10px] text-tradeflow-navy/75 font-semibold">{insights.returnedOrders} returns / {insights.deliveredOrders} delivered</p>
              </div>
            </div>

            <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-4 flex items-center gap-3">
              <div className="p-3 bg-amber-100 text-amber-800 rounded-xl">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[11px] font-extrabold uppercase text-amber-800">Low-Stock Alerts</p>
                <p className="text-xl font-black text-tradeflow-navy mt-0.5">{insights.lowStockAlerts.length} Products</p>
                <p className="text-[10px] text-amber-700 font-semibold">Stock &le; low-stock threshold</p>
              </div>
            </div>

            <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-4 flex items-center gap-3">
              <div className="p-3 bg-amber-100 text-amber-700 rounded-xl">
                <Flame className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[11px] font-extrabold uppercase text-amber-800">Fast-Moving Top Pick</p>
                <p className="text-sm font-extrabold text-amber-950 truncate max-w-[160px]">
                  {insights.fastMovingProducts[0]?.name || 'N/A'}
                </p>
                <p className="text-[10px] text-amber-700 font-semibold">
                  {insights.fastMovingProducts[0] ? `${insights.fastMovingProducts[0].unitsSold} units sold` : 'No sales'}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 to-white p-4 flex items-center gap-3">
              <div className="p-3 bg-blue-100 text-blue-700 rounded-xl">
                <Snail className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[11px] font-extrabold uppercase text-blue-800">Slow-Moving Watch</p>
                <p className="text-sm font-extrabold text-blue-950 truncate max-w-[160px]">
                  {insights.slowMovingProducts[0]?.name || 'N/A'}
                </p>
                <p className="text-[10px] text-blue-700 font-semibold">
                  {insights.slowMovingProducts[0] ? `${insights.slowMovingProducts[0].stock} in stock` : 'No inventory'}
                </p>
              </div>
            </div>
          </section>

          {/* CHARTS ROW 1: Revenue Trend & Order Status Breakdown */}
          <section className="grid grid-cols-1 gap-5 xl:grid-cols-3">
            <article className="rounded-2xl border border-tradeflow-gray-200 bg-white p-5 shadow-sm xl:col-span-2">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-extrabold text-tradeflow-navy">Revenue Trend (IST)</h2>
                  <p className="mt-0.5 text-xs text-gray-500">Daily revenue and orders formatted in Indian Standard Time</p>
                </div>
                <Activity className="h-5 w-5 text-green-700" aria-hidden="true" />
              </div>
              <div className="h-72">
                {report.trend.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={report.trend} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
                      <defs>
                        <linearGradient id="reportRevenueFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--color-tradeflow-green)" stopOpacity={0.24} />
                          <stop offset="95%" stopColor="var(--color-tradeflow-green)" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-tradeflow-gray-200)" />
                      <XAxis dataKey="date" tickFormatter={formatTrendDate} fontSize={11} />
                      <YAxis tickFormatter={formatCompactCurrency} fontSize={11} width={58} />
                      <Tooltip
                        labelFormatter={(label) => formatTrendDate(String(label))}
                        formatter={(value) => [formatCurrency(Number(value || 0)), 'Revenue']}
                      />
                      <Area type="monotone" dataKey="revenue" stroke="var(--color-tradeflow-green)" strokeWidth={2.5} fill="url(#reportRevenueFill)" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : <EmptyChart label="No revenue data for this period." />}
              </div>
            </article>

            <article className="rounded-2xl border border-tradeflow-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-4">
                <h2 className="font-extrabold text-tradeflow-navy">Orders by Status</h2>
                <p className="mt-0.5 text-xs text-gray-500">Order distribution across lifecycle</p>
              </div>
              <div className="h-52">
                {statusData.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={statusData} dataKey="count" nameKey="label" innerRadius={48} outerRadius={78} paddingAngle={2}>
                        {statusData.map((entry) => <Cell key={entry.status} fill={entry.color} />)}
                      </Pie>
                      <Tooltip formatter={(value) => [Number(value || 0), 'Orders']} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : <EmptyChart label="No orders for this period." />}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-tradeflow-gray-200 pt-3">
                {statusData.map((item) => (
                  <div key={item.status} className="flex min-w-0 items-center justify-between gap-2 text-xs">
                    <span className="flex min-w-0 items-center gap-1.5 capitalize text-gray-600">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="truncate">{item.label}</span>
                    </span>
                    <strong className="text-tradeflow-navy">{item.count}</strong>
                  </div>
                ))}
              </div>
            </article>
          </section>

          {/* CHARTS ROW 2: Top 10 Products & Top Categories */}
          <section className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <article className="rounded-2xl border border-tradeflow-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-4">
                <h2 className="font-extrabold text-tradeflow-navy">Top 10 Products by Revenue</h2>
                <p className="mt-0.5 text-xs text-gray-500">Highest grossing products in period</p>
              </div>
              <div className="h-72">
                {topProducts.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topProducts} layout="vertical" margin={{ top: 4, right: 12, left: 8, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--color-tradeflow-gray-200)" />
                      <XAxis type="number" tickFormatter={formatCompactCurrency} fontSize={11} />
                      <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(value) => [formatCurrency(Number(value || 0)), 'Revenue']} />
                      <Bar dataKey="revenue" fill="var(--color-tradeflow-green)" radius={[0, 5, 5, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <EmptyChart label="No product sales for this period." />}
              </div>
            </article>

            <article className="rounded-2xl border border-tradeflow-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-4">
                <h2 className="font-extrabold text-tradeflow-navy">Top Categories by Revenue</h2>
                <p className="mt-0.5 text-xs text-gray-500">Sales breakdown by product category</p>
              </div>
              <div className="h-72">
                {topCategories.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topCategories} layout="vertical" margin={{ top: 4, right: 12, left: 8, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--color-tradeflow-gray-200)" />
                      <XAxis type="number" tickFormatter={formatCompactCurrency} fontSize={11} />
                      <YAxis type="category" dataKey="_id" width={130} tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(value) => [formatCurrency(Number(value || 0)), 'Revenue']} />
                      <Bar dataKey="revenue" fill="var(--color-tradeflow-sky)" radius={[0, 5, 5, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <EmptyChart label="No category sales for this period." />}
              </div>
            </article>
          </section>

          {/* CHARTS ROW 3: Top Retailers & New Retailers Over Time */}
          <section className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <article className="rounded-2xl border border-tradeflow-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-4">
                <h2 className="font-extrabold text-tradeflow-navy">Top Retailers by Revenue</h2>
                <p className="mt-0.5 text-xs text-gray-500">Highest purchasing trade retailers</p>
              </div>
              <div className="h-72">
                {topRetailers.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topRetailers} margin={{ top: 8, right: 8, left: 4, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-tradeflow-gray-200)" />
                      <XAxis dataKey="name" fontSize={10} interval={0} angle={-15} textAnchor="end" />
                      <YAxis tickFormatter={formatCompactCurrency} fontSize={11} />
                      <Tooltip formatter={(value) => [formatCurrency(Number(value || 0)), 'Revenue']} />
                      <Bar dataKey="revenue" fill="var(--color-tradeflow-navy)" radius={[5, 5, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <EmptyChart label="No retailer sales for this period." />}
              </div>
            </article>

            <article className="rounded-2xl border border-tradeflow-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-4">
                <h2 className="font-extrabold text-tradeflow-navy">New Retailers Over Time</h2>
                <p className="mt-0.5 text-xs text-gray-500">Retailer connections added over time (IST)</p>
              </div>
              <div className="h-72">
                {newRetailersTrend.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={newRetailersTrend} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-tradeflow-gray-200)" />
                      <XAxis dataKey="date" tickFormatter={formatTrendDate} fontSize={11} />
                      <YAxis fontSize={11} />
                      <Tooltip formatter={(value) => [Number(value || 0), 'New Retailers']} />
                      <Line type="monotone" dataKey="count" stroke="var(--color-tradeflow-sky)" strokeWidth={2.5} dot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : <EmptyChart label="No new retailer connections in this period." />}
              </div>
            </article>
          </section>

          {/* CHARTS ROW 4: Stock Movement (Added vs Sold) */}
          <section className="grid grid-cols-1 gap-5">
            <article className="rounded-2xl border border-tradeflow-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-4">
                <h2 className="font-extrabold text-tradeflow-navy">Stock Movement (Units Added vs Sold)</h2>
                <p className="mt-0.5 text-xs text-gray-500">Inventory flow over time in Indian Standard Time</p>
              </div>
              <div className="h-72">
                {movementTrend.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={movementTrend} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-tradeflow-gray-200)" />
                      <XAxis dataKey="date" tickFormatter={formatTrendDate} fontSize={11} />
                      <YAxis fontSize={11} />
                      <Tooltip formatter={(value) => [Number(value || 0), 'Units']} />
                      <Legend />
                      <Bar dataKey="added" name="Units Added" fill="var(--color-tradeflow-green)" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="sold" name="Units Sold" fill="var(--color-tradeflow-sky)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <EmptyChart label="No inventory movement in this period." />}
              </div>
            </article>
          </section>

          {/* INSIGHT DETAILS CARDS */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Low-Stock Alerts Card */}
            <article className="rounded-2xl border border-tradeflow-gray-200 bg-white p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-700" />
                  <h3 className="font-extrabold text-tradeflow-navy">Low-Stock Alerts</h3>
                </div>
                <span className="text-xs font-bold bg-amber-50 text-amber-800 px-2.5 py-1 rounded-full">
                  {insights.lowStockAlerts.length} items
                </span>
              </div>
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {insights.lowStockAlerts.map((prod) => (
                  <div key={prod._id} className="flex items-center justify-between p-2.5 bg-amber-50/50 rounded-xl border border-amber-100 text-xs">
                    <div>
                      <p className="font-bold text-gray-900">{prod.name}</p>
                      <p className="text-[10px] text-gray-500">SKU: {prod.sku}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-amber-800">{prod.stock} in stock</p>
                      <p className="text-[10px] text-gray-500">Threshold: {prod.threshold}</p>
                    </div>
                  </div>
                ))}
                {!insights.lowStockAlerts.length && (
                  <p className="text-xs text-gray-500 text-center py-6">All products are healthy above low-stock threshold.</p>
                )}
              </div>
            </article>

            {/* Fast vs Slow Moving Products */}
            <article className="rounded-2xl border border-tradeflow-gray-200 bg-white p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center gap-2">
                  <Flame className="h-5 w-5 text-amber-600" />
                  <h3 className="font-extrabold text-tradeflow-navy">Fast &amp; Slow Moving Insights</h3>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[11px] font-extrabold uppercase text-emerald-800 mb-2">🔥 Fast-Moving</p>
                  <div className="space-y-1.5 text-xs">
                    {insights.fastMovingProducts.slice(0, 4).map((p) => (
                      <div key={p._id} className="p-2 bg-emerald-50/60 rounded-lg border border-emerald-100">
                        <p className="font-bold text-gray-900 truncate">{p.name}</p>
                        <p className="text-[10px] text-emerald-700 font-semibold">{p.unitsSold} sold / {p.stock} stock</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-[11px] font-extrabold uppercase text-blue-800 mb-2">🐢 Slow-Moving</p>
                  <div className="space-y-1.5 text-xs">
                    {insights.slowMovingProducts.slice(0, 4).map((p) => (
                      <div key={p._id} className="p-2 bg-blue-50/60 rounded-lg border border-blue-100">
                        <p className="font-bold text-gray-900 truncate">{p.name}</p>
                        <p className="text-[10px] text-blue-700 font-semibold">{p.unitsSold} sold / {p.stock} stock</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </article>
          </section>

          <footer className="text-xs text-gray-400 text-center pt-4">
            Profit estimates use historical cost price snapshots at order time. IST grouping (+05:30) applies to all dates.
          </footer>
        </>
      ) : null}
    </div>
  );
}
