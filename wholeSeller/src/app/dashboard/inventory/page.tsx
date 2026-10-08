'use client';

import React, { useState, useMemo } from 'react';
import {
  Boxes,
  AlertTriangle,
  Plus,
  Minus,
  RefreshCw,
  Search,
  History,
  CheckCircle2,
  X,
  Sliders,
  ArrowDownRight,
  ArrowUpRight,
  ShieldCheck,
  AlertCircle,
  TrendingUp,
  DollarSign,
  ShoppingBag,
  ChevronDown,
  ChevronUp,
  PieChart,
  Layers,
  Eye
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useWholesaler } from '@/context/WholesalerContext';

export default function InventoryPage() {
  const { products, categories, orders = [], inventoryLogs, adjustStock } = useWholesaler();

  // Filters & Settings
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK'>('ALL');
  const [globalThreshold, setGlobalThreshold] = useState<number>(10);

  // Expanded Row State for Row-level Financial & Movement Inspection
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null);

  // Manual Stock Adjustment Modal
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [adjustAmount, setAdjustAmount] = useState<number>(50);
  const [adjustReason, setAdjustReason] = useState<string>('Restocked / Factory Arrival');

  // Compute real financial and movement details per product from real Order / OrderItem records
  const productMetricsMap = useMemo(() => {
    const map: Record<
      string,
      {
        unitsSold: number;
        ordersFulfilledCount: number;
        revenueEarned: number;
        profitEarned: number;
        costPrice: number;
        sellingPrice: number;
        marginUnit: number;
        marginPercent: number;
      }
    > = {};

    // Filter valid orders (Exclude Cancelled orders)
    const validOrders = orders.filter((o) => o.status !== 'CANCELLED');

    products.forEach((p) => {
      const cost = p.costPrice || (p.basePrice ? Math.round(p.basePrice * 0.7) : 0);
      const selling = p.sellingPrice || p.basePrice || 100;
      const marginUnit = selling - cost;
      const marginPercent = cost > 0 ? (marginUnit / cost) * 100 : (selling > 0 ? 100 : 0);

      let unitsSold = 0;
      let fulfilledOrdersCount = 0;

      validOrders.forEach((o) => {
        let containsProduct = false;
        (o.items || []).forEach((item) => {
          if (String(item.productId) === String(p.id)) {
            unitsSold += Number(item.quantity || 0);
            containsProduct = true;
          }
        });
        if (containsProduct) {
          fulfilledOrdersCount += 1;
        }
      });

      const revenueEarned = unitsSold * selling;
      const profitEarned = unitsSold * marginUnit;

      map[p.id] = {
        unitsSold,
        ordersFulfilledCount: fulfilledOrdersCount,
        revenueEarned,
        profitEarned,
        costPrice: cost,
        sellingPrice: selling,
        marginUnit,
        marginPercent,
      };
    });

    return map;
  }, [products, orders]);

  // Overall financial summary metrics across all products combined
  const overallStats = useMemo(() => {
    let totalRevenue = 0;
    let totalProfit = 0;
    let totalUnitsSold = 0;
    let totalOrdersFulfilled = 0;

    Object.values(productMetricsMap).forEach((m) => {
      totalRevenue += m.revenueEarned;
      totalProfit += m.profitEarned;
      totalUnitsSold += m.unitsSold;
      totalOrdersFulfilled += m.ordersFulfilledCount;
    });

    return {
      totalRevenue,
      totalProfit,
      totalUnitsSold,
      totalOrdersFulfilled,
    };
  }, [productMetricsMap]);

  // Filter products by Wholesaler scope, Category, Search, and Stock Status
  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'ALL' || p.category === selectedCategory;

    const isOutOfStock = p.stock === 0;
    const isLowStock = p.stock > 0 && p.stock <= (p.minOrderQty || globalThreshold);
    const isInStock = p.stock > (p.minOrderQty || globalThreshold);

    if (statusFilter === 'IN_STOCK') return matchesSearch && matchesCategory && isInStock;
    if (statusFilter === 'LOW_STOCK') return matchesSearch && matchesCategory && isLowStock;
    if (statusFilter === 'OUT_OF_STOCK') return matchesSearch && matchesCategory && isOutOfStock;

    return matchesSearch && matchesCategory;
  });

  // "Needs Restocking" Alert List (Low stock <= threshold OR out of stock)
  const needsRestockingList = products.filter((p) => p.stock <= (p.minOrderQty || globalThreshold));

  const handleApplyStockAdjust = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId) return;
    adjustStock(selectedProductId, Number(adjustAmount), adjustReason);
    setSelectedProductId(null);
  };

  const totalStockUnits = products.reduce((acc, p) => acc + p.stock, 0);
  const totalStockCostValue = products.reduce((acc, p) => {
    const m = productMetricsMap[p.id];
    return acc + (p.stock * (m?.costPrice || 0));
  }, 0);

  const formatCurrency = (val: number) => `₹${Math.round(val).toLocaleString('en-IN')}`;

  return (
    <div className="space-y-6">
      {/* Top Header & Auto-Deduction Engine Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#1F1F1F]">Automated Inventory & Financial Engine</h1>
          <p className="text-xs text-gray-500">
            Real order-based financial tracking, lifetime revenue & profit analytics, stock movement audit logging
          </p>
        </div>

        {/* Auto-Deduction Engine Status Tag */}
        <div className="px-3.5 py-1.5 bg-[#E8F5E9] text-[#2E7D32] border border-[#2E7D32]/20 rounded-xl text-xs font-bold flex items-center gap-1.5">
          <RefreshCw className="w-4 h-4 animate-spin text-[#2E7D32]" />
          <span>Auto-Deduction Active (On Order Confirm)</span>
        </div>
      </div>

      {/* TOP SUMMARY CARDS: LIFETIME REVENUE & PROFIT ANALYTICS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 bg-white rounded-2xl border border-[#E5E5E5] shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Total Stock Remaining</span>
            <div className="text-2xl font-extrabold text-[#1F1F1F]">{totalStockUnits.toLocaleString()} units</div>
            <div className="text-[11px] font-semibold text-gray-500">Valued at {formatCurrency(totalStockCostValue)} (Cost)</div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-[#E8F5E9] text-[#2E7D32] flex items-center justify-center font-bold">
            <Boxes className="w-5 h-5" />
          </div>
        </div>

        <div className="p-5 bg-white rounded-2xl border border-[#E5E5E5] shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Total Lifetime Revenue</span>
            <div className="text-2xl font-extrabold text-[#C62828]">{formatCurrency(overallStats.totalRevenue)}</div>
            <div className="text-[11px] font-semibold text-gray-500">
              From {overallStats.totalUnitsSold.toLocaleString()} units sold
            </div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-red-50 text-[#C62828] flex items-center justify-center font-bold">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>

        <div className="p-5 bg-white rounded-2xl border border-[#E5E5E5] shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Total Lifetime Profit</span>
            <div className="text-2xl font-extrabold text-[#2E7D32]">{formatCurrency(overallStats.totalProfit)}</div>
            <div className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Net profit from completed sales</span>
            </div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-[#E8F5E9] text-[#2E7D32] flex items-center justify-center font-bold">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        <div className="p-5 bg-white rounded-2xl border border-[#E5E5E5] shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Orders Fulfilled</span>
            <div className="text-2xl font-extrabold text-[#1F1F1F]">{overallStats.totalOrdersFulfilled.toLocaleString()}</div>
            <div className="text-[11px] font-semibold text-gray-500">Confirmed / Shipped / Delivered</div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
            <ShoppingBag className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* "NEEDS RESTOCKING" ALERT LIST BANNER */}
      {needsRestockingList.length > 0 && (
        <div className="p-5 rounded-2xl bg-[#FFF8E1] border border-[#FFE082] shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[#F9A825] font-extrabold text-sm">
              <AlertTriangle className="w-5 h-5 text-[#F9A825]" />
              <span>Needs Restocking Alert List ({needsRestockingList.length} Items Below Threshold)</span>
            </div>
            <span className="text-[11px] font-bold text-gray-600 bg-white px-2.5 py-0.5 rounded-full border border-[#FFE082]">
              Configured Threshold: ≤ {globalThreshold} units
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {needsRestockingList.map((p) => (
              <div key={p.id} className="p-3.5 bg-white rounded-xl border border-[#FFE082] flex items-center justify-between shadow-xs">
                <div className="flex items-center gap-3">
                  <img
                    src={p.imageUrl}
                    alt={p.title}
                    className="w-10 h-10 rounded-lg object-cover border border-[#E5E5E5] shrink-0"
                  />
                  <div>
                    <div className="font-bold text-xs text-[#1F1F1F] max-w-[150px] truncate">{p.title}</div>
                    <div className="text-[10px] font-mono text-gray-400">SKU: {p.sku}</div>
                    <div className="text-[10px] font-bold text-[#C62828] mt-0.5">
                      {p.stock === 0 ? 'OUT OF STOCK' : `Only ${p.stock} left in stock`}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setSelectedProductId(p.id);
                    setAdjustAmount(50);
                    setAdjustReason('Restocked / Factory Arrival');
                  }}
                  className="px-3 py-1.5 bg-[#C62828] text-white text-[11px] font-bold rounded-lg hover:bg-[#B71C1C] transition-colors shrink-0"
                >
                  Restock +
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="p-4 bg-white rounded-2xl border border-[#E5E5E5] flex flex-col md:flex-row items-center justify-between gap-4 shadow-xs">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search inventory by title or SKU..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs bg-[#FAF9F7] border border-[#E5E5E5] rounded-xl focus:outline-none focus:border-[#C62828]"
          />
        </div>

        {/* Category & Stock Status Filters */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Category Dropdown */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-1.5 text-xs font-bold bg-[#FAF9F7] border border-[#E5E5E5] rounded-xl focus:outline-none focus:border-[#C62828]"
          >
            <option value="ALL">All Categories ({products.length})</option>
            {categories.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Stock Status Pill Filters */}
          <div className="flex items-center gap-1 bg-[#FAF9F7] p-1 rounded-xl border border-[#E5E5E5]">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                statusFilter === 'ALL' ? 'bg-[#C62828] text-white' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              All Stock
            </button>
            <button
              onClick={() => setStatusFilter('IN_STOCK')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                statusFilter === 'IN_STOCK' ? 'bg-[#2E7D32] text-white' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              In Stock
            </button>
            <button
              onClick={() => setStatusFilter('LOW_STOCK')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                statusFilter === 'LOW_STOCK' ? 'bg-[#F9A825] text-white' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Low Stock
            </button>
            <button
              onClick={() => setStatusFilter('OUT_OF_STOCK')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                statusFilter === 'OUT_OF_STOCK' ? 'bg-[#C62828] text-white' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Out of Stock
            </button>
          </div>
        </div>
      </div>

      {/* Products Inventory Table (Full Width) */}
      <div className="bg-white rounded-2xl border border-[#E5E5E5] p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-[#1F1F1F]">Wholesaler Products Stock Table</h2>
            <p className="text-[11px] text-gray-500">
              Full financial & movement details per product from real orders. Click product name or &quot;View Details&quot; to open drill-down page.
            </p>
          </div>
          <span className="text-xs text-gray-500 font-mono">
            Total Stock: {totalStockUnits.toLocaleString()} units
          </span>
        </div>

        {/* Clean, Uncluttered Products Stock Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#E5E5E5] text-gray-400 font-bold uppercase tracking-wider text-[11px] bg-[#FAF9F7]/60">
                <th className="py-3.5 px-4 min-w-[240px]">Product / SKU</th>
                <th className="py-3.5 px-4 min-w-[130px]">Category</th>
                <th className="py-3.5 px-4 text-right min-w-[120px]">Cost Price</th>
                <th className="py-3.5 px-4 text-right min-w-[130px]">Selling Price</th>
                <th className="py-3.5 px-4 text-center min-w-[120px]">Current Stock</th>
                <th className="py-3.5 px-4 min-w-[140px]">Stock Status</th>
                <th className="py-3.5 px-4 text-right min-w-[220px]">Stock Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E5E5]">
              {filteredProducts.map((p) => {
                const metrics = productMetricsMap[p.id] || {
                  unitsSold: 0,
                  ordersFulfilledCount: 0,
                  revenueEarned: 0,
                  profitEarned: 0,
                  costPrice: 0,
                  sellingPrice: 0,
                  marginUnit: 0,
                  marginPercent: 0,
                };

                const isOutOfStock = p.stock === 0;
                const isLowStock = p.stock > 0 && p.stock <= (p.minOrderQty || globalThreshold);
                const isExpanded = expandedProductId === p.id;

                return (
                  <React.Fragment key={p.id}>
                    <tr className="hover:bg-[#FAF9F7] transition-colors">
                      <td className="py-3.5 px-4 flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setExpandedProductId(isExpanded ? null : p.id)}
                          className="p-1 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 shrink-0"
                          title="Toggle Quick Financial Breakdown"
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                        <Link to={`/dashboard/inventory/${p.id}`} className="shrink-0">
                          <img
                            src={p.imageUrl}
                            alt={p.title}
                            className="w-10 h-10 rounded-lg object-cover border border-[#E5E5E5] hover:opacity-80 transition-opacity"
                          />
                        </Link>
                        <div className="min-w-0">
                          <Link
                            to={`/dashboard/inventory/${p.id}`}
                            className="font-bold text-[#1F1F1F] hover:text-[#C62828] max-w-[200px] truncate block transition-colors text-xs"
                            title="Click to view full product performance details"
                          >
                            {p.title}
                          </Link>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] font-mono text-gray-400">SKU: {p.sku}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-gray-600 font-semibold">{p.category}</td>
                      <td className="py-3.5 px-4 text-right font-mono text-gray-500 font-medium whitespace-nowrap text-xs">
                        {formatCurrency(metrics.costPrice)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-extrabold text-[#C62828] text-sm whitespace-nowrap">
                        {formatCurrency(metrics.sellingPrice)}
                      </td>
                      <td className="py-3.5 px-4 text-center font-extrabold text-sm text-[#1F1F1F]">
                        {p.stock}
                      </td>
                      <td className="py-3.5 px-4">
                        {isOutOfStock ? (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase bg-red-50 text-red-600 border border-red-200 whitespace-nowrap inline-block">
                            Out of Stock (0)
                          </span>
                        ) : isLowStock ? (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase bg-[#FFF8E1] text-[#F9A825] border border-[#FFE082] inline-flex items-center gap-1 whitespace-nowrap">
                            <AlertTriangle className="w-3 h-3" />
                            <span>Low Stock ({p.stock})</span>
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase bg-[#E8F5E9] text-[#2E7D32] border border-[#2E7D32]/20 whitespace-nowrap inline-block">
                            In Stock Healthy
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                          <Link
                            to={`/dashboard/inventory/${p.id}`}
                            className="px-2.5 py-1.5 bg-[#FFEBEE] text-[#C62828] hover:bg-[#C62828] hover:text-white border border-[#C62828]/20 text-xs font-bold rounded-xl transition-all inline-flex items-center gap-1"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>View Details</span>
                          </Link>
                          <button
                            onClick={() => {
                              setSelectedProductId(p.id);
                              setAdjustAmount(50);
                              setAdjustReason('Restocked / Factory Arrival');
                            }}
                            className="px-2.5 py-1.5 bg-[#FAF9F7] border border-[#E5E5E5] hover:border-[#C62828] hover:text-[#C62828] text-xs font-bold rounded-xl transition-colors inline-flex items-center gap-1"
                          >
                            <Sliders className="w-3.5 h-3.5" />
                            <span>Adjust Stock</span>
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Expandable Product Financial & Movement Breakdown */}
                    {isExpanded && (
                      <tr className="bg-[#FAF9F7]/80">
                        <td colSpan={7} className="p-4">
                          <div className="p-4 bg-white rounded-xl border border-[#E5E5E5] space-y-3">
                            <div className="flex items-center justify-between border-b border-[#E5E5E5] pb-2">
                              <span className="font-bold text-xs text-[#1F1F1F] flex items-center gap-1.5">
                                <PieChart className="w-4 h-4 text-[#C62828]" />
                                Financial & Movement Breakdown for &quot;{p.title}&quot;
                              </span>
                              <span className="text-[11px] font-mono text-gray-400">SKU: {p.sku}</span>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                              <div className="p-3 bg-[#FAF9F7] rounded-lg border border-[#E5E5E5]">
                                <div className="text-[10px] font-bold text-gray-400 uppercase">Unit Cost vs Selling</div>
                                <div className="font-mono font-bold text-[#1F1F1F] mt-1">
                                  Cost: {formatCurrency(metrics.costPrice)} | Sell: {formatCurrency(metrics.sellingPrice)}
                                </div>
                                <div className="text-[10px] text-emerald-600 font-semibold mt-0.5">
                                  Unit Margin: +{formatCurrency(metrics.marginUnit)} ({metrics.marginPercent.toFixed(1)}%)
                                </div>
                              </div>

                              <div className="p-3 bg-[#FAF9F7] rounded-lg border border-[#E5E5E5]">
                                <div className="text-[10px] font-bold text-gray-400 uppercase">Lifetime Sales Volume</div>
                                <div className="font-mono font-bold text-[#1F1F1F] mt-1">
                                  {metrics.unitsSold.toLocaleString()} units sold
                                </div>
                                <div className="text-[10px] text-gray-500 font-semibold mt-0.5">
                                  Across {metrics.ordersFulfilledCount} fulfilled order(s)
                                </div>
                              </div>

                              <div className="p-3 bg-[#FAF9F7] rounded-lg border border-[#E5E5E5]">
                                <div className="text-[10px] font-bold text-gray-400 uppercase">Total Revenue Generated</div>
                                <div className="font-mono font-extrabold text-[#C62828] mt-1">
                                  {formatCurrency(metrics.revenueEarned)}
                                </div>
                                <div className="text-[10px] text-gray-500 font-semibold mt-0.5">
                                  {metrics.unitsSold} units × {formatCurrency(metrics.sellingPrice)}
                                </div>
                              </div>

                              <div className="p-3 bg-[#FAF9F7] rounded-lg border border-[#E5E5E5]">
                                <div className="text-[10px] font-bold text-gray-400 uppercase">Total Net Profit Earned</div>
                                <div className="font-mono font-extrabold text-[#2E7D32] mt-1">
                                  {formatCurrency(metrics.profitEarned)}
                                </div>
                                <div className="text-[10px] text-emerald-600 font-semibold mt-0.5">
                                  {metrics.unitsSold} units × +{formatCurrency(metrics.marginUnit)}
                                </div>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        </div>

      {/* MANUAL STOCK ADJUSTMENT MODAL */}
      {selectedProductId && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 border border-[#E5E5E5] shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5E5E5]">
              <h2 className="text-base font-bold text-[#1F1F1F]">Manual Stock Adjustment</h2>
              <button onClick={() => setSelectedProductId(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleApplyStockAdjust} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-gray-700 mb-1">Target Product</label>
                <div className="p-2.5 bg-[#FAF9F7] border border-[#E5E5E5] rounded-xl font-bold text-[#1F1F1F]">
                  {products.find((p) => p.id === selectedProductId)?.title}
                  <span className="block text-[10px] font-mono text-gray-400 mt-0.5">
                    Current Stock: {products.find((p) => p.id === selectedProductId)?.stock} units
                  </span>
                </div>
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Stock Adjustment Quantity (+ or -)</label>
                <input
                  type="number"
                  required
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(Number(e.target.value))}
                  placeholder="e.g. +50 for Restock, -10 for Damaged"
                  className="w-full px-3.5 py-2.5 border border-[#E5E5E5] rounded-xl bg-[#FAF9F7] font-bold text-sm text-[#1F1F1F]"
                />
                <span className="text-[10px] text-gray-400 mt-1 block">
                  Positive numbers add stock (e.g. 50), negative numbers deduct stock (e.g. -10).
                </span>
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Adjustment Reason *</label>
                <select
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-[#E5E5E5] rounded-xl bg-[#FAF9F7] font-medium text-xs"
                >
                  <option value="Restocked / Factory Arrival">Restocked / Factory Arrival</option>
                  <option value="Damaged Stock Audit Write-off">Damaged Stock Audit Write-off</option>
                  <option value="Inventory Count Correction">Inventory Count Correction</option>
                  <option value="Returned Order Stock Addition">Returned Order Stock Addition</option>
                </select>
              </div>

              <div className="pt-3 border-t border-[#E5E5E5] flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedProductId(null)}
                  className="px-4 py-2 font-bold text-gray-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#C62828] text-white font-bold rounded-xl hover:bg-[#B71C1C]"
                >
                  Apply Stock Update
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
