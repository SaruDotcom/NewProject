import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useLocation } from 'react-router-dom';
import {
  Package,
  Users,
  ShoppingBag,
  TrendingUp,
  ArrowUpRight,
  Plus,
  CheckCircle2,
  ChevronRight,
  Flame,
  ShieldCheck,
  Globe,
  Boxes,
  Zap,
  Lock,
  BarChart3,
  Sparkles,
  UserCheck,
  Share2,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip
} from 'recharts';
import { useWholesaler } from '@/context/WholesalerContext';
import { getWholesalerId, wholesalerQueryKeys } from '@/lib/query-client';
import api from '@/lib/api';
import { ProductImage } from '@/components/products/ProductImage';
import BusinessActivationNotice from '@/components/activation/BusinessActivationNotice';
import { BRAND_NAME } from '@/config/brand';

export default function OverviewPage() {
  const {
    profile,
    products,
    retailers,
    orders,
    updateOrderStatus,
    isProfileLoaded,
    isBusinessActivated,
  } = useWholesaler();
  const location = useLocation();
  const financialSummaryQuery = useQuery({
    queryKey: wholesalerQueryKeys.resource(profile.id || getWholesalerId(), 'financial-summary'),
    queryFn: async () => (await api.getFinancialSummary()).data,
    enabled: Boolean(profile.id || getWholesalerId() !== 'unknown'),
    refetchInterval: 60000,
    staleTime: 60 * 1000,
  });
  const financialSummary = financialSummaryQuery.data;
  const thisMonthIncome = Number(financialSummary?.thisMonthIncome || 0);
  const completedSales = Number(financialSummary?.completedSales || 0);
  const pendingPayments = financialSummary?.pendingPayments || [];
  const salesSnapshot = financialSummary?.salesByDate || [];
  const snapshotTotal = useMemo(() => salesSnapshot.reduce((sum, item) => sum + Number(item.revenue || 0), 0), [salesSnapshot]);
  const [showRegistrationSuccess, setShowRegistrationSuccess] = useState(
    Boolean((location.state as { registrationSuccess?: boolean } | null)?.registrationSuccess),
  );

  // Metrics Calculations
  const totalProductsCount = products.length;
  const connectedRetailersCount = retailers.length;
  const pendingOrdersCount = useMemo(() => orders.filter((o) => o.status === 'PENDING').length, [orders]);
  // Trending Products (top products sorted by stock / popularity)
  const trendingProducts = useMemo(() => products.slice(0, 6), [products]);

  // Recent Activity Feed slices
  const last5Orders = useMemo(() => orders.slice(0, 5), [orders]);

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="p-4 sm:p-6 rounded-2xl bg-gradient-to-r from-tradeflow-navy via-tradeflow-navy-hover to-tradeflow-navy text-white shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-gray-800">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-tradeflow-green text-tradeflow-navy tracking-wide flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              <span>
                {profile.subscriptionStatus === 'ACTIVE'
                  ? 'SUBSCRIPTION ACTIVE'
                  : 'SUBSCRIPTION OPTIONAL'}
              </span>
            </span>
            <span className="text-xs text-gray-300 font-semibold font-mono">
              GSTIN: {profile.gstin || 'Not provided'}
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
            Welcome to {BRAND_NAME}
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Track products, stock, retailers, and orders.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 w-full sm:w-auto">
          <Link
            to="/dashboard/products"
            onClick={(event) => {
              if (!isBusinessActivated) event.preventDefault();
            }}
            aria-disabled={!isBusinessActivated}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2.5 bg-tradeflow-green text-tradeflow-navy text-xs font-bold rounded-xl hover:bg-tradeflow-green-hover transition-all shadow-md ${isBusinessActivated ? '' : 'cursor-not-allowed opacity-50'}`}
          >
            <Plus className="w-4 h-4" />
            <span>Add Product</span>
          </Link>
          <Link
            to="/dashboard/orders"
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2.5 bg-white/10 text-white text-xs font-bold rounded-xl hover:bg-white/20 transition-all border border-white/10"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Orders ({orders.length})</span>
          </Link>
        </div>
      </div>

      {showRegistrationSuccess && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800" role="status">
          <span className="flex items-center gap-2 font-semibold"><CheckCircle2 className="size-4" /> Registration successful. Complete KYC and get a subscription approved to activate business features.</span>
          <button type="button" onClick={() => setShowRegistrationSuccess(false)} aria-label="Dismiss registration confirmation" className="rounded p-1 hover:bg-emerald-100"><span aria-hidden="true">×</span></button>
        </div>
      )}

      <BusinessActivationNotice
        kycStatus={profile.kycStatus}
        isProfileLoaded={isProfileLoaded}
      />

      {/* 1. TOP ROW: 4 Summary Stat Cards (Soft-tint circular badges, big bold number, small label, subtle shadow, hover lift) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
        {/* Stat Card 1: Total Products */}
        <div className="p-5 bg-white rounded-2xl border border-tradeflow-gray-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-200 flex flex-col justify-between group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-gray-500 uppercase tracking-wider">Total Products</span>
            <div className="w-12 h-12 rounded-full bg-tradeflow-green-50 text-green-700 flex items-center justify-center font-bold shadow-xs group-hover:scale-110 transition-transform">
              <Package className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-black text-tradeflow-navy tracking-tight">{totalProductsCount}</div>
            <div className="text-xs text-gray-500 font-medium mt-1">
              {products.reduce((acc, p) => acc + p.stock, 0)} total units
            </div>
          </div>
        </div>

        {/* Stat Card 2: Connected Retailers */}
        <div className="p-5 bg-white rounded-2xl border border-tradeflow-gray-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-200 flex flex-col justify-between group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-gray-500 uppercase tracking-wider">Connected Retailers</span>
            <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold shadow-xs group-hover:scale-110 transition-transform">
              <Users className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-black text-tradeflow-navy tracking-tight">{connectedRetailersCount}</div>
            <div className="flex items-center gap-1.5 text-xs text-status-success font-bold mt-1">
              <span className="px-2 py-0.5 rounded-full bg-tradeflow-green-50 text-status-success text-[10px]">
                Active
              </span>
            </div>
          </div>
        </div>

        {/* Stat Card 3: Pending Orders */}
        <div className="p-5 bg-white rounded-2xl border border-tradeflow-gray-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-200 flex flex-col justify-between group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-gray-500 uppercase tracking-wider">Pending Orders</span>
            <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-500 flex items-center justify-center font-bold shadow-xs group-hover:scale-110 transition-transform">
              <ShoppingBag className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-black text-tradeflow-navy tracking-tight">{pendingOrdersCount}</div>
            <div className="text-xs text-gray-500 font-medium mt-1">
              Awaiting packing & dispatch approval
            </div>
          </div>
        </div>

        <div className="p-5 bg-white rounded-2xl border border-tradeflow-gray-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-200 flex flex-col justify-between group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-gray-500 uppercase tracking-wider">Completed Sales</span>
            <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center font-bold shadow-xs">
              <ShoppingBag className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-black text-tradeflow-navy tracking-tight">₹{completedSales.toLocaleString('en-IN')}</div>
            <div className="text-xs text-gray-500 font-medium mt-1">Successfully delivered orders</div>
          </div>
        </div>

        {/* Stat Card 4: This Month's Income */}
        <div className="p-5 bg-white rounded-2xl border border-tradeflow-gray-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-200 flex flex-col justify-between group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-gray-500 uppercase tracking-wider">This Month&apos;s Income</span>
            <div className="w-12 h-12 rounded-full bg-tradeflow-green-50 text-status-success flex items-center justify-center font-bold shadow-xs group-hover:scale-110 transition-transform">
              <TrendingUp className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-black text-tradeflow-navy tracking-tight">₹{(thisMonthIncome || 0).toLocaleString('en-IN')}</div>
            <div className="flex items-center gap-1 text-xs text-status-success font-semibold mt-1">
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>Verified payments received this month</span>
            </div>
          </div>
        </div>
      </div>

      {financialSummaryQuery.isError && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {financialSummaryQuery.error instanceof Error
            ? financialSummaryQuery.error.message
            : 'Could not load current financial summary.'}
        </div>
      )}

      <section className="bg-white rounded-2xl border border-tradeflow-gray-200 p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-tradeflow-gray-200 pb-3">
          <div>
            <h2 className="text-base font-bold text-tradeflow-navy">Pending Payments</h2>
            <p className="text-xs text-gray-500">Outstanding balances, including orders delivered before full payment.</p>
          </div>
          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800">{pendingPayments.length} outstanding</span>
        </div>
        {financialSummaryQuery.isLoading ? (
          <p className="py-4 text-center text-sm text-gray-500">Loading payment balances…</p>
        ) : pendingPayments.length === 0 ? (
          <p className="py-4 text-center text-sm text-gray-500">No pending payments.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead className="text-[10px] uppercase tracking-wide text-gray-500">
                <tr className="border-b border-tradeflow-gray-200">
                  <th className="pb-3 pr-3">Retailer</th>
                  <th className="pb-3 pr-3">Order ID</th>
                  <th className="pb-3 pr-3 text-right">Order Total</th>
                  <th className="pb-3 pr-3 text-right">Amount Paid</th>
                  <th className="pb-3 pr-3 text-right">Remaining</th>
                  <th className="pb-3 text-right">Payment Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-tradeflow-gray-200">
                {pendingPayments.map((payment) => (
                  <tr key={payment.orderId}>
                    <td className="py-3 pr-3 font-semibold text-tradeflow-navy">{payment.retailerName}</td>
                    <td className="py-3 pr-3 font-mono text-gray-600">{payment.orderNumber}</td>
                    <td className="py-3 pr-3 text-right">₹{payment.totalAmount.toLocaleString('en-IN')}</td>
                    <td className="py-3 pr-3 text-right">₹{payment.amountPaid.toLocaleString('en-IN')}</td>
                    <td className="py-3 pr-3 text-right font-extrabold text-amber-800">₹{payment.remainingAmount.toLocaleString('en-IN')}</td>
                    <td className="py-3 text-right font-bold text-amber-800">{payment.paymentStatus}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 2 & 3. MIDDLE GRID: Sales Snapshot (Chart) + Your Benefits */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 3. "Sales Snapshot" — Recharts Area Chart for last 14 days */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-tradeflow-gray-200 p-6 shadow-sm hover:shadow-md transition-all space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-3 border-b border-tradeflow-gray-200">
            <div>
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-green-700" />
                <h2 className="text-base font-bold text-tradeflow-navy">Sales Snapshot (Last 14 Days)</h2>
              </div>
              <p className="text-xs text-gray-500">Daily wholesale order revenue trajectory</p>
            </div>
            <div className="flex items-center gap-2 bg-tradeflow-gray-50 px-3 py-1.5 rounded-xl border border-tradeflow-gray-200 text-xs font-bold text-gray-700">
              <span>Total Snapshot:</span>
              <span className="text-tradeflow-navy">₹{snapshotTotal.toLocaleString('en-IN')}</span>
            </div>
          </div>

          <div className="h-64 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={salesSnapshot} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevenueOverview" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-tradeflow-green)" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="var(--color-tradeflow-green)" stopOpacity={0.05}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-tradeflow-gray-200)" />
                <XAxis dataKey="date" stroke="var(--color-tradeflow-gray-500)" fontSize={11} tickLine={false} />
                <YAxis stroke="var(--color-tradeflow-gray-500)" fontSize={11} tickFormatter={(val) => `₹${val / 1000}k`} tickLine={false} />
                <Tooltip
                  formatter={(value: any) => [`₹${Number(value).toLocaleString('en-IN')}`, 'Gross Sales']}
                  contentStyle={{ backgroundColor: 'var(--color-tradeflow-white)', borderRadius: '12px', border: '1px solid var(--color-tradeflow-gray-200)', fontSize: '12px', fontWeight: 'bold' }}
                />
                <Area type="monotone" dataKey="revenue" stroke="var(--color-tradeflow-green)" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenueOverview)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 4. "Your Benefits" Section — 4 Highlight Cards */}
        <div className="bg-white rounded-2xl border border-tradeflow-gray-200 p-6 shadow-sm hover:shadow-md transition-all space-y-4 flex flex-col justify-between">
          <div className="pb-3 border-b border-tradeflow-gray-200">
            <h2 className="text-base font-bold text-tradeflow-navy flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-green-700" />
              <span>Wholesaler Platform Benefits</span>
            </h2>
            <p className="text-xs text-gray-500">Key capabilities unlocked for your business</p>
          </div>

          <div className="space-y-3">
            {/* Benefit 1 */}
            <div className="p-3 rounded-xl bg-tradeflow-gray-50 border border-tradeflow-gray-200 flex items-start gap-3 hover:border-tradeflow-green/40 transition-colors">
              <div className="w-8 h-8 rounded-lg bg-tradeflow-green-50 text-green-700 flex items-center justify-center shrink-0 mt-0.5">
                <Globe className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-extrabold text-tradeflow-navy">Reach More Retailers</h3>
                <p className="text-[11px] text-gray-500">Expand market presence with verified retail buyers nationwide.</p>
              </div>
            </div>

            {/* Benefit 2 */}
            <div className="p-3 rounded-xl bg-tradeflow-gray-50 border border-tradeflow-gray-200 flex items-start gap-3 hover:border-tradeflow-green/40 transition-colors">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">
                <Boxes className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-extrabold text-tradeflow-navy">Auto Inventory Tracking</h3>
                <p className="text-[11px] text-gray-500">Automatic stock reduction & low-stock restocking warnings.</p>
              </div>
            </div>

            {/* Benefit 3 */}
            <div className="p-3 rounded-xl bg-tradeflow-gray-50 border border-tradeflow-gray-200 flex items-start gap-3 hover:border-tradeflow-green/40 transition-colors">
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-500 flex items-center justify-center shrink-0 mt-0.5">
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-extrabold text-tradeflow-navy">Direct Order Management</h3>
                <p className="text-[11px] text-gray-500">Instant order confirmation, dispatch tracking & status workflow.</p>
              </div>
            </div>

            {/* Benefit 4 */}
            <div className="p-3 rounded-xl bg-tradeflow-gray-50 border border-tradeflow-gray-200 flex items-start gap-3 hover:border-tradeflow-green/40 transition-colors">
              <div className="w-8 h-8 rounded-lg bg-tradeflow-green-50 text-status-success flex items-center justify-center shrink-0 mt-0.5">
                <Lock className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-extrabold text-tradeflow-navy">Secure & Private Data</h3>
                <p className="text-[11px] text-gray-500">2FA protection, GSTIN compliance & encrypted wholesaler records.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. "TRENDING PRODUCTS" SECTION — Horizontal Scrollable Row */}
      <div className="bg-white rounded-2xl border border-tradeflow-gray-200 p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-tradeflow-gray-200">
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-amber-500" />
            <div>
              <h2 className="text-base font-bold text-tradeflow-navy">Trending Products</h2>
              <p className="text-xs text-gray-500">Top-selling & high-demand wholesale catalog items</p>
            </div>
          </div>
          <Link
            to="/dashboard/products"
            className="text-xs text-green-700 font-bold hover:underline flex items-center gap-1"
          >
            <span>View All ({products.length})</span>
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Horizontal Scrollable Container */}
        <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin">
          {trendingProducts.map((prod) => (
            <div
              key={prod.id}
              className="min-w-[240px] max-w-[240px] bg-tradeflow-gray-50 border border-tradeflow-gray-200 rounded-2xl p-3.5 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-200 flex flex-col justify-between shrink-0"
            >
              <div>
                <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-gray-100 mb-3 border border-gray-200">
                  <ProductImage src={prod.imageUrl} alt={prod.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                  <div className="absolute top-2 left-2">
                    <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-500 border border-amber-200 text-[10px] font-extrabold flex items-center gap-1 shadow-xs">
                      <Flame className="w-3 h-3 fill-amber-500" />
                      <span>Trending</span>
                    </span>
                  </div>
                </div>

                <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                  {prod.category}
                </div>
                <h3 className="text-xs font-bold text-tradeflow-navy line-clamp-2 leading-snug">
                  {prod.title}
                </h3>
              </div>

              <div className="mt-3 pt-3 border-t border-tradeflow-gray-200 flex items-center justify-between">
                <div>
                  <div className="text-xs font-extrabold text-tradeflow-navy">₹{(prod.basePrice || 0).toLocaleString('en-IN')}<span className="text-[10px] text-gray-500 font-normal"> /unit</span></div>
                  <div className="text-[10px] font-semibold text-gray-500">{prod.stock || 0} units left</div>
                </div>
                <Link
                  to="/dashboard/products"
                  className="px-2.5 py-1 bg-white border border-tradeflow-gray-200 text-[11px] font-bold text-tradeflow-navy rounded-lg hover:bg-tradeflow-green hover:text-tradeflow-navy transition-colors"
                >
                  Manage
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 5. RECENT ACTIVITY FEED SECTION — Last 5 Orders + Last 3 Retailer Requests */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Feed 1: Last 5 Orders (2 Cols) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-tradeflow-gray-200 p-6 shadow-sm hover:shadow-md transition-all space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-tradeflow-gray-200">
            <div>
              <h2 className="text-base font-bold text-tradeflow-navy">Recent Orders Workflow (Last 5)</h2>
              <p className="text-xs text-gray-500">Incoming buyer orders requiring packing, dispatch, or invoice updates</p>
            </div>
            <Link
              to="/dashboard/orders"
              className="text-xs text-green-700 font-bold hover:underline flex items-center gap-1"
            >
              <span>View All ({orders.length})</span>
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[550px]">
              <thead>
                <tr className="border-b border-tradeflow-gray-200 text-gray-400 font-bold uppercase tracking-wider">
                  <th className="pb-3">Order Number</th>
                  <th className="pb-3">Retailer Client</th>
                  <th className="pb-3">Amount</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-tradeflow-gray-200">
                {last5Orders.map((order) => (
                  <tr key={order.id} className="hover:bg-tradeflow-gray-50 transition-colors">
                    <td className="py-3.5 font-bold font-mono text-tradeflow-navy">
                      {order.orderNumber}
                    </td>
                    <td className="py-3.5">
                      <div className="font-bold text-tradeflow-navy">{order.retailerName}</div>
                      <div className="text-[10px] text-gray-400">{order.retailerCity}</div>
                    </td>
                    <td className="py-3.5 font-extrabold text-tradeflow-navy">
                      ₹{(order.totalAmount || 0).toLocaleString('en-IN')}
                    </td>
                    <td className="py-3.5">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase ${
                        order.status === 'PENDING' ? 'bg-amber-50 text-amber-500' :
                        order.status === 'CONFIRMED' ? 'bg-blue-50 text-blue-700' :
                        order.status === 'PROCESSING' ? 'bg-purple-50 text-purple-700' :
                        order.status === 'SHIPPED' || order.status === 'DISPATCHED' ? 'bg-indigo-50 text-indigo-700' :
                        order.status === 'DELIVERED' ? 'bg-tradeflow-green-50 text-status-success' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="py-3.5 text-right">
                      {order.status === 'PENDING' && (
                        <button
                          onClick={() => updateOrderStatus(order.id, 'CONFIRMED')}
                          className="px-2.5 py-1 bg-tradeflow-green text-tradeflow-navy text-[11px] font-bold rounded-lg hover:bg-tradeflow-green-hover transition-colors"
                        >
                          Confirm
                        </button>
                      )}
                      {order.status === 'CONFIRMED' && (
                        <button
                          onClick={() => updateOrderStatus(order.id, 'PROCESSING')}
                          className="px-2.5 py-1 bg-purple-600 text-white text-[11px] font-bold rounded-lg hover:bg-purple-700 transition-colors"
                        >
                          Process
                        </button>
                      )}
                      {order.status === 'PROCESSING' && (
                        <a
                          href="/dashboard/orders"
                          className="px-2.5 py-1 bg-blue-600 text-white text-[11px] font-bold rounded-lg hover:bg-blue-700 transition-colors inline-block"
                        >
                          Ship
                        </a>
                      )}
                      {(order.status === 'SHIPPED' || order.status === 'DISPATCHED') && (
                        <button
                          onClick={() => updateOrderStatus(order.id, 'DELIVERED')}
                          className="px-2.5 py-1 bg-emerald-600 text-white text-[11px] font-bold rounded-lg hover:bg-emerald-700 transition-colors"
                        >
                          Deliver
                        </button>
                      )}
                      {order.status === 'DELIVERED' && (
                        <span className="text-[11px] text-status-success font-semibold flex items-center justify-end gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Delivered</span>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Feed 2: Wholesaler Direct Invite Link Network */}
        <div className="bg-white rounded-2xl border border-tradeflow-gray-200 p-6 shadow-sm hover:shadow-md transition-all space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-tradeflow-gray-200">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-green-700" />
              <h2 className="text-base font-bold text-tradeflow-navy">Wholesaler Invite Link Network</h2>
            </div>
            <Link
              to="/dashboard/retailers"
              className="text-xs text-green-700 font-bold hover:underline"
            >
              View Network ({retailers.length})
            </Link>
          </div>

          <div className="p-4 rounded-xl bg-tradeflow-gray-50 border border-tradeflow-gray-200 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-bold text-xs text-tradeflow-navy">Instant Auto-Connection Active</div>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  Retailers who register or sign in via your direct shareable link are linked automatically with zero approval delay.
                </p>
              </div>
            </div>

            <div className="pt-2 border-t border-tradeflow-gray-200 flex items-center justify-between text-xs">
              <span className="font-bold text-status-success">{retailers.length} Connected Stores</span>
              <Link
                to="/dashboard/retailers"
                onClick={(event) => {
                  if (!isBusinessActivated) event.preventDefault();
                }}
                aria-disabled={!isBusinessActivated}
                className={`px-3 py-1 bg-tradeflow-green text-tradeflow-navy text-[11px] font-bold rounded-lg hover:bg-tradeflow-green-hover transition-colors flex items-center gap-1 ${isBusinessActivated ? '' : 'cursor-not-allowed opacity-50'}`}
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Share Invite Link</span>
              </Link>
            </div>
          </div>

          {/* Quick Wholesale Tip */}
          <div className="p-3.5 rounded-xl bg-tradeflow-green-50 border border-status-success/20 text-[11px] text-status-success font-medium flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>Retailers connected via your link get immediate access to your wholesale catalog & pricing.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
