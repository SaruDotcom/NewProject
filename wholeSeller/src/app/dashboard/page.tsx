import React from 'react';
import { Link } from 'react-router-dom';
import {
  Package,
  Users,
  ShoppingBag,
  TrendingUp,
  ArrowUpRight,
  Plus,
  CheckCircle2,
  Clock,
  ChevronRight,
  AlertTriangle,
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

// 14-Day Sales Snapshot Data
const SALES_SNAPSHOT_DATA = [
  { date: 'Sep 02', revenue: 14500, orders: 1 },
  { date: 'Sep 03', revenue: 22000, orders: 2 },
  { date: 'Sep 04', revenue: 18000, orders: 1 },
  { date: 'Sep 05', revenue: 35000, orders: 3 },
  { date: 'Sep 06', revenue: 29000, orders: 2 },
  { date: 'Sep 07', revenue: 41000, orders: 4 },
  { date: 'Sep 08', revenue: 32000, orders: 3 },
  { date: 'Sep 09', revenue: 48000, orders: 4 },
  { date: 'Sep 10', revenue: 26000, orders: 2 },
  { date: 'Sep 11', revenue: 54000, orders: 5 },
  { date: 'Sep 12', revenue: 38000, orders: 3 },
  { date: 'Sep 13', revenue: 42500, orders: 4 },
  { date: 'Sep 14', revenue: 61000, orders: 5 },
  { date: 'Sep 15', revenue: 48600, orders: 4 },
];

export default function OverviewPage() {
  const { profile, products, retailers, orders, updateOrderStatus } = useWholesaler();

  // Metrics Calculations
  const totalProductsCount = products.length;
  const connectedRetailersCount = retailers.length;
  const pendingOrdersCount = orders.filter(o => o.status === 'PENDING').length;
  const thisMonthIncome = orders
    .filter(o => o.status !== 'CANCELLED')
    .reduce((acc, o) => acc + (o.totalAmount || 0), 0);

  // Trending Products (top products sorted by stock / popularity)
  const trendingProducts = products.slice(0, 6);

  // Recent Activity Feed slices
  const last5Orders = orders.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-[#1F1F1F] via-[#2D2D2D] to-[#1F1F1F] text-white shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-gray-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-[#C62828] text-white tracking-wide flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              <span>{profile.subscriptionPlan} PLAN ACTIVE</span>
            </span>
            <span className="text-xs text-gray-300 font-semibold font-mono">
              GSTIN: {profile.gstin}
            </span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">
            Welcome back, {profile.businessName}
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Wholesale operational dashboard: track catalog, stock, retailer network, orders, and sales performance.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <Link
            to="/dashboard/products"
            className="flex items-center gap-1.5 px-4 py-2.5 bg-[#C62828] text-white text-xs font-bold rounded-xl hover:bg-[#B71C1C] transition-all shadow-md"
          >
            <Plus className="w-4 h-4" />
            <span>Add Product</span>
          </Link>
          <Link
            to="/dashboard/orders"
            className="flex items-center gap-1.5 px-4 py-2.5 bg-white/10 text-white text-xs font-bold rounded-xl hover:bg-white/20 transition-all border border-white/10"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Orders ({orders.length})</span>
          </Link>
        </div>
      </div>

      {/* 1. TOP ROW: 4 Summary Stat Cards (Soft-tint circular badges, big bold number, small label, subtle shadow, hover lift) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Stat Card 1: Total Products */}
        <div className="p-5 bg-white rounded-2xl border border-[#E5E5E5] shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-200 flex flex-col justify-between group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-gray-500 uppercase tracking-wider">Total Products</span>
            <div className="w-12 h-12 rounded-full bg-[#FFEBEE] text-[#C62828] flex items-center justify-center font-bold shadow-xs group-hover:scale-110 transition-transform">
              <Package className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-black text-[#1F1F1F] tracking-tight">{totalProductsCount}</div>
            <div className="text-xs text-gray-500 font-medium mt-1">
              {products.reduce((acc, p) => acc + p.stock, 0)} total stock units across categories
            </div>
          </div>
        </div>

        {/* Stat Card 2: Connected Retailers */}
        <div className="p-5 bg-white rounded-2xl border border-[#E5E5E5] shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-200 flex flex-col justify-between group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-gray-500 uppercase tracking-wider">Connected Retailers</span>
            <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold shadow-xs group-hover:scale-110 transition-transform">
              <Users className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-black text-[#1F1F1F] tracking-tight">{connectedRetailersCount}</div>
            <div className="flex items-center gap-1.5 text-xs text-[#2E7D32] font-bold mt-1">
              <span className="px-2 py-0.5 rounded-full bg-[#E8F5E9] text-[#2E7D32] text-[10px]">
                Instant Auto-Connected
              </span>
            </div>
          </div>
        </div>

        {/* Stat Card 3: Pending Orders */}
        <div className="p-5 bg-white rounded-2xl border border-[#E5E5E5] shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-200 flex flex-col justify-between group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-gray-500 uppercase tracking-wider">Pending Orders</span>
            <div className="w-12 h-12 rounded-full bg-[#FFF8E1] text-[#F9A825] flex items-center justify-center font-bold shadow-xs group-hover:scale-110 transition-transform">
              <ShoppingBag className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-black text-[#1F1F1F] tracking-tight">{pendingOrdersCount}</div>
            <div className="text-xs text-gray-500 font-medium mt-1">
              Awaiting packing & dispatch approval
            </div>
          </div>
        </div>

        {/* Stat Card 4: This Month's Income */}
        <div className="p-5 bg-white rounded-2xl border border-[#E5E5E5] shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-200 flex flex-col justify-between group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-gray-500 uppercase tracking-wider">This Month&apos;s Income</span>
            <div className="w-12 h-12 rounded-full bg-[#E8F5E9] text-[#2E7D32] flex items-center justify-center font-bold shadow-xs group-hover:scale-110 transition-transform">
              <TrendingUp className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-black text-[#1F1F1F] tracking-tight">₹{(thisMonthIncome || 0).toLocaleString('en-IN')}</div>
            <div className="flex items-center gap-1 text-xs text-[#2E7D32] font-semibold mt-1">
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>+18.4% growth vs last month</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2 & 3. MIDDLE GRID: Sales Snapshot (Chart) + Your Benefits */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 3. "Sales Snapshot" — Recharts Area Chart for last 14 days */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-[#E5E5E5] p-6 shadow-sm hover:shadow-md transition-all space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-3 border-b border-[#E5E5E5]">
            <div>
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-[#C62828]" />
                <h2 className="text-base font-bold text-[#1F1F1F]">Sales Snapshot (Last 14 Days)</h2>
              </div>
              <p className="text-xs text-gray-500">Daily wholesale order revenue trajectory</p>
            </div>
            <div className="flex items-center gap-2 bg-[#FAF9F7] px-3 py-1.5 rounded-xl border border-[#E5E5E5] text-xs font-bold text-gray-700">
              <span>Total Snapshot:</span>
              <span className="text-[#C62828]">₹5,09,600</span>
            </div>
          </div>

          <div className="h-64 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={SALES_SNAPSHOT_DATA} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevenueOverview" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#C62828" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#C62828" stopOpacity={0.05}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" stroke="#888" fontSize={11} tickLine={false} />
                <YAxis stroke="#888" fontSize={11} tickFormatter={(val) => `₹${val / 1000}k`} tickLine={false} />
                <Tooltip
                  formatter={(value: any) => [`₹${Number(value).toLocaleString('en-IN')}`, 'Gross Sales']}
                  contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #E5E5E5', fontSize: '12px', fontWeight: 'bold' }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#C62828" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenueOverview)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 4. "Your Benefits" Section — 4 Highlight Cards */}
        <div className="bg-white rounded-2xl border border-[#E5E5E5] p-6 shadow-sm hover:shadow-md transition-all space-y-4 flex flex-col justify-between">
          <div className="pb-3 border-b border-[#E5E5E5]">
            <h2 className="text-base font-bold text-[#1F1F1F] flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#C62828]" />
              <span>Wholesaler Platform Benefits</span>
            </h2>
            <p className="text-xs text-gray-500">Key capabilities unlocked for your business</p>
          </div>

          <div className="space-y-3">
            {/* Benefit 1 */}
            <div className="p-3 rounded-xl bg-[#FAF9F7] border border-[#E5E5E5] flex items-start gap-3 hover:border-[#C62828]/40 transition-colors">
              <div className="w-8 h-8 rounded-lg bg-[#FFEBEE] text-[#C62828] flex items-center justify-center shrink-0 mt-0.5">
                <Globe className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-extrabold text-[#1F1F1F]">Reach More Retailers</h3>
                <p className="text-[11px] text-gray-500">Expand market presence with verified retail buyers nationwide.</p>
              </div>
            </div>

            {/* Benefit 2 */}
            <div className="p-3 rounded-xl bg-[#FAF9F7] border border-[#E5E5E5] flex items-start gap-3 hover:border-[#C62828]/40 transition-colors">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">
                <Boxes className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-extrabold text-[#1F1F1F]">Auto Inventory Tracking</h3>
                <p className="text-[11px] text-gray-500">Automatic stock reduction & low-stock restocking warnings.</p>
              </div>
            </div>

            {/* Benefit 3 */}
            <div className="p-3 rounded-xl bg-[#FAF9F7] border border-[#E5E5E5] flex items-start gap-3 hover:border-[#C62828]/40 transition-colors">
              <div className="w-8 h-8 rounded-lg bg-[#FFF8E1] text-[#F9A825] flex items-center justify-center shrink-0 mt-0.5">
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-extrabold text-[#1F1F1F]">Direct Order Management</h3>
                <p className="text-[11px] text-gray-500">Instant order confirmation, dispatch tracking & status workflow.</p>
              </div>
            </div>

            {/* Benefit 4 */}
            <div className="p-3 rounded-xl bg-[#FAF9F7] border border-[#E5E5E5] flex items-start gap-3 hover:border-[#C62828]/40 transition-colors">
              <div className="w-8 h-8 rounded-lg bg-[#E8F5E9] text-[#2E7D32] flex items-center justify-center shrink-0 mt-0.5">
                <Lock className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-extrabold text-[#1F1F1F]">Secure & Private Data</h3>
                <p className="text-[11px] text-gray-500">2FA protection, GSTIN compliance & encrypted wholesaler records.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. "TRENDING PRODUCTS" SECTION — Horizontal Scrollable Row */}
      <div className="bg-white rounded-2xl border border-[#E5E5E5] p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#E5E5E5]">
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-[#F9A825]" />
            <div>
              <h2 className="text-base font-bold text-[#1F1F1F]">Trending Products</h2>
              <p className="text-xs text-gray-500">Top-selling & high-demand wholesale catalog items</p>
            </div>
          </div>
          <Link
            to="/dashboard/products"
            className="text-xs text-[#C62828] font-bold hover:underline flex items-center gap-1"
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
              className="min-w-[240px] max-w-[240px] bg-[#FAF9F7] border border-[#E5E5E5] rounded-2xl p-3.5 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-200 flex flex-col justify-between shrink-0"
            >
              <div>
                <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-gray-100 mb-3 border border-gray-200">
                  <img
                    src={prod.imageUrl}
                    alt={prod.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                  <div className="absolute top-2 left-2">
                    <span className="px-2 py-0.5 rounded-full bg-[#FFF8E1] text-[#F9A825] border border-[#FFE082] text-[10px] font-extrabold flex items-center gap-1 shadow-xs">
                      <Flame className="w-3 h-3 fill-[#F9A825]" />
                      <span>Trending</span>
                    </span>
                  </div>
                </div>

                <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                  {prod.category}
                </div>
                <h3 className="text-xs font-bold text-[#1F1F1F] line-clamp-2 leading-snug">
                  {prod.title}
                </h3>
              </div>

              <div className="mt-3 pt-3 border-t border-[#E5E5E5] flex items-center justify-between">
                <div>
                  <div className="text-xs font-extrabold text-[#C62828]">₹{(prod.basePrice || 0).toLocaleString('en-IN')}<span className="text-[10px] text-gray-500 font-normal"> /unit</span></div>
                  <div className="text-[10px] font-semibold text-gray-500">{prod.stock || 0} units left</div>
                </div>
                <Link
                  to="/dashboard/products"
                  className="px-2.5 py-1 bg-white border border-[#E5E5E5] text-[11px] font-bold text-[#1F1F1F] rounded-lg hover:bg-[#C62828] hover:text-white transition-colors"
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
        <div className="lg:col-span-2 bg-white rounded-2xl border border-[#E5E5E5] p-6 shadow-sm hover:shadow-md transition-all space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#E5E5E5]">
            <div>
              <h2 className="text-base font-bold text-[#1F1F1F]">Recent Orders Workflow (Last 5)</h2>
              <p className="text-xs text-gray-500">Incoming buyer orders requiring packing, dispatch, or invoice updates</p>
            </div>
            <Link
              to="/dashboard/orders"
              className="text-xs text-[#C62828] font-bold hover:underline flex items-center gap-1"
            >
              <span>View All ({orders.length})</span>
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#E5E5E5] text-gray-400 font-bold uppercase tracking-wider">
                  <th className="pb-3">Order Number</th>
                  <th className="pb-3">Retailer Client</th>
                  <th className="pb-3">Amount</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E5E5]">
                {last5Orders.map((order) => (
                  <tr key={order.id} className="hover:bg-[#FAF9F7] transition-colors">
                    <td className="py-3.5 font-bold font-mono text-[#1F1F1F]">
                      {order.orderNumber}
                    </td>
                    <td className="py-3.5">
                      <div className="font-bold text-[#1F1F1F]">{order.retailerName}</div>
                      <div className="text-[10px] text-gray-400">{order.retailerCity}</div>
                    </td>
                    <td className="py-3.5 font-extrabold text-[#1F1F1F]">
                      ₹{(order.totalAmount || 0).toLocaleString('en-IN')}
                    </td>
                    <td className="py-3.5">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase ${
                        order.status === 'PENDING' ? 'bg-[#FFF8E1] text-[#F9A825]' :
                        order.status === 'PROCESSING' ? 'bg-blue-50 text-blue-600' :
                        order.status === 'DISPATCHED' ? 'bg-purple-50 text-purple-600' :
                        order.status === 'DELIVERED' ? 'bg-[#E8F5E9] text-[#2E7D32]' :
                        'bg-red-50 text-red-600'
                      }`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="py-3.5 text-right">
                      {order.status === 'PENDING' && (
                        <button
                          onClick={() => updateOrderStatus(order.id, 'PROCESSING')}
                          className="px-2.5 py-1 bg-[#C62828] text-white text-[11px] font-bold rounded-lg hover:bg-[#B71C1C] transition-colors"
                        >
                          Approve
                        </button>
                      )}
                      {order.status === 'PROCESSING' && (
                        <button
                          onClick={() => updateOrderStatus(order.id, 'DISPATCHED', 'BLUEDART-88201')}
                          className="px-2.5 py-1 bg-blue-600 text-white text-[11px] font-bold rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          Dispatch
                        </button>
                      )}
                      {order.status === 'DISPATCHED' && (
                        <span className="text-[10px] font-mono text-gray-400">
                          {order.trackingNumber}
                        </span>
                      )}
                      {order.status === 'DELIVERED' && (
                        <span className="text-[11px] text-[#2E7D32] font-semibold flex items-center justify-end gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Done</span>
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
        <div className="bg-white rounded-2xl border border-[#E5E5E5] p-6 shadow-sm hover:shadow-md transition-all space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#E5E5E5]">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-[#C62828]" />
              <h2 className="text-base font-bold text-[#1F1F1F]">Wholesaler Invite Link Network</h2>
            </div>
            <Link
              to="/dashboard/retailers"
              className="text-xs text-[#C62828] font-bold hover:underline"
            >
              View Network ({retailers.length})
            </Link>
          </div>

          <div className="p-4 rounded-xl bg-[#FAF9F7] border border-[#E5E5E5] space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-bold text-xs text-[#1F1F1F]">Instant Auto-Connection Active</div>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  Retailers who register or sign in via your direct shareable link are linked automatically with zero approval delay.
                </p>
              </div>
            </div>

            <div className="pt-2 border-t border-[#E5E5E5] flex items-center justify-between text-xs">
              <span className="font-bold text-[#2E7D32]">{retailers.length} Connected Stores</span>
              <Link
                to="/dashboard/retailers"
                className="px-3 py-1 bg-[#C62828] text-white text-[11px] font-bold rounded-lg hover:bg-[#B71C1C] transition-colors flex items-center gap-1"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Share Invite Link</span>
              </Link>
            </div>
          </div>

          {/* Quick Wholesale Tip */}
          <div className="p-3.5 rounded-xl bg-[#E8F5E9] border border-[#2E7D32]/20 text-[11px] text-[#2E7D32] font-medium flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>Retailers connected via your link get immediate access to your wholesale catalog & pricing.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
