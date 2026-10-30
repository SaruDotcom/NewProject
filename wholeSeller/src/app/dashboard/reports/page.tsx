import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  FileText,
  Download,
  Printer,
  Search,
  Calendar,
  DollarSign,
  ShoppingBag,
  TrendingUp,
  Users,
  Package,
  Ticket,
  AlertCircle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  HandCoins,
  ShieldCheck,
  Building2,
} from 'lucide-react';
import {
  api,
  WholesalerAnalyticsReport,
} from '@/lib/api';
import {
  ExportReportModal,
  createPrintableReport,
  TopProductsByUnitsTable,
  TopRetailersTable,
  StockMovementWidget,
  CouponUsageWidget,
  ReturnsSummaryWidget,
} from '@/components/analytics/AnalyticsReportsShared';
import { useWholesaler } from '@/context/WholesalerContext';
import { wholesalerQueryKeys } from '@/lib/query-client';

type ReportTab =
  | 'ALL'
  | 'ORDERS'
  | 'SALES_PROFIT'
  | 'PRODUCTS_INVENTORY'
  | 'RETAILERS'
  | 'CREDIT_PAYMENTS'
  | 'COUPONS';

interface NormalizedOrder {
  id: string;
  orderNumber: string;
  retailerName: string;
  createdAt: string;
  items: Array<{
    id?: string;
    productTitle?: string;
    name?: string;
    sku?: string;
    category?: string;
    quantity: number;
    pricePerUnit?: number;
    unitPrice?: number;
    subtotal: number;
  }>;
  subtotal: number;
  discount: number;
  grandTotal: number;
  isCreditOrder: boolean;
  orderStatus: string;
  paymentStatus: string;
}

// Safe Date Extractor (Never throws RangeError)
function safeExtractDate(dateVal?: unknown): string {
  if (!dateVal) return '';
  if (dateVal instanceof Date) {
    if (!isNaN(dateVal.getTime())) return dateVal.toISOString().slice(0, 10);
    return '';
  }
  const s = String(dateVal).trim();
  // 1. Direct match for YYYY-MM-DD
  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

  // 2. Match DD/MM/YYYY or D/M/YYYY
  const dmyMatch = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    const year = dmyMatch[3];
    return `${year}-${month}-${day}`;
  }

  // 3. Fallback try new Date
  try {
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      return d.toISOString().slice(0, 10);
    }
  } catch {
    // Ignore error
  }
  return '';
}

// Safe Date Formatter (IST)
function safeFormatDateTime(dateStr?: unknown): string {
  if (!dateStr) return 'N/A';
  const str = String(dateStr).trim();
  if (str.includes('am') || str.includes('pm') || str.includes('AM') || str.includes('PM')) {
    return str;
  }
  try {
    const d = new Date(str);
    if (isNaN(d.getTime())) return str;
    return d.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return str;
  }
}

export default function ReportsPage() {
  const { profile, orders: contextOrders } = useWholesaler();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<ReportTab>('ALL');
  const [datePreset, setDatePreset] = useState<'WEEKLY' | 'MONTHLY' | 'YEARLY' | 'CUSTOM'>('MONTHLY');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  const [showExportModal, setShowExportModal] = useState<boolean>(false);

  // Pagination for Orders tab
  const [ordersPage, setOrdersPage] = useState<number>(1);
  const ordersPerPage = 10;

  // Initialize date range based on preset
  useEffect(() => {
    const now = new Date();
    const end = now.toISOString().slice(0, 10);
    let start = '';

    if (datePreset === 'WEEKLY') {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      start = d.toISOString().slice(0, 10);
    } else if (datePreset === 'MONTHLY') {
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      start = `${year}-${month}-01`;
    } else if (datePreset === 'YEARLY') {
      const year = now.getFullYear();
      start = `${year}-01-01`;
    }

    if (datePreset !== 'CUSTOM') {
      setStartDate(start);
      setEndDate(end);
    }
  }, [datePreset]);

  // Query Backend Analytics
  const reportQuery = useQuery({
    queryKey: wholesalerQueryKeys.resource(profile.id || 'unknown', 'analytics', startDate, endDate),
    queryFn: async () => {
      try {
        const response = await api.getWholesalerAnalytics({ startDate, endDate });
        if (response?.data?.report) {
          return response.data.report as WholesalerAnalyticsReport;
        }
      } catch (err) {
        console.warn('Backend analytics not available, computing locally:', err);
      }
      return null;
    },
    enabled: Boolean(startDate && endDate),
    retry: 1,
  });

  // Query Backend Orders
  const ordersQuery = useQuery({
    queryKey: wholesalerQueryKeys.resource(profile.id || 'unknown', 'orders'),
    queryFn: async () => {
      try {
        const response = await api.getOrders();
        const raw = Array.isArray(response?.data?.items)
          ? response.data.items
          : Array.isArray(response?.data)
          ? response.data
          : Array.isArray(response)
          ? response
          : [];
        return raw;
      } catch (err) {
        console.warn('Orders query failed, falling back to context orders:', err);
        return [];
      }
    },
    retry: 1,
  });

  // Normalize orders returned by the API or shared context.
  const allOrders = useMemo<NormalizedOrder[]>(() => {
    const apiOrders = ordersQuery.data || [];
    const rawList = apiOrders.length > 0 ? apiOrders : contextOrders;

    return rawList.map((order: any) => {
      const id = String(order._id || order.id || order.orderNumber || order.orderNo || '');
      const orderNumber = String(order.orderNumber || order.orderNo || id);
      const retailerName =
        order.retailerName ||
        (typeof order.retailerId === 'object' ? order.retailerId?.name || order.retailerId?.businessName : '') ||
        order.retailer?.businessName ||
        order.retailer?.name || '';

      const items = Array.isArray(order.items)
        ? order.items.map((it: any) => ({
            id: String(it._id || it.id || ''),
            productTitle: it.productTitle || it.name || '',
            name: it.name || it.productTitle || '',
            sku: it.sku || '',
            category: it.categoryName || it.category || '',
            quantity: Number(it.quantity ?? 0),
            pricePerUnit: Number(it.pricePerUnit ?? it.price ?? it.unitPrice ?? 0),
            unitPrice: Number(it.unitPrice ?? it.pricePerUnit ?? it.price ?? 0),
            subtotal: Number(it.subtotal ?? (Number(it.pricePerUnit ?? it.price ?? it.unitPrice ?? 0) * Number(it.quantity ?? 0))),
          }))
        : [];

      const subtotal = Number(order.subtotal ?? order.totalAmount ?? order.grandTotal ?? 0);
      const discount = Number(order.discount ?? order.discountAmount ?? 0);
      const grandTotal = Number(order.grandTotal ?? order.totalAmount ?? order.total ?? subtotal);
      const isCreditOrder = Boolean(
        order.isCreditOrder || order.paymentMethod === 'CREDIT' || order.paymentStatus === 'CREDIT'
      );
      const orderStatus = String(order.orderStatus || order.status || 'UNKNOWN').toUpperCase();
      const paymentStatus = String(order.paymentStatus || 'UNKNOWN').toUpperCase();

      return {
        id,
        orderNumber,
        retailerName,
        createdAt: order.createdAt || '',
        items,
        subtotal,
        discount,
        grandTotal,
        isCreditOrder,
        orderStatus,
        paymentStatus,
      };
    });
  }, [ordersQuery.data, contextOrders]);

  // Use database-backed analytics when available; the local fallback uses only actual orders.
  const effectiveReport = useMemo<WholesalerAnalyticsReport>(() => {
    if (reportQuery.data) return reportQuery.data;

    const activeOrders = allOrders.filter((order) => order.orderStatus !== 'CANCELLED');
    const revenue = activeOrders.reduce((total, order) => total + order.grandTotal, 0);
    const totalDiscount = activeOrders.reduce((total, order) => total + order.discount, 0);
    const deliveredCount = activeOrders.filter((order) => order.orderStatus === 'DELIVERED').length;
    const aov = activeOrders.length > 0 ? Math.round(revenue / activeOrders.length) : 0;
    const paymentsReceived = allOrders
      .filter((order) => order.paymentStatus === 'PAID')
      .reduce((total, order) => total + order.grandTotal, 0);

    const statusMap: Record<string, number> = {};
    allOrders.forEach((order) => {
      statusMap[order.orderStatus] = (statusMap[order.orderStatus] || 0) + 1;
    });
    const statusBreakdown = Object.entries(statusMap).map(([status, count]) => ({ status, count }));

    const productSalesMap: Record<string, { name: string; sku: string; category: string; unitsSold: number; revenue: number }> = {};
    allOrders.forEach((order) => {
      order.items.forEach((item) => {
        const key = item.productTitle || item.name || item.sku || item.id;
        if (!key) return;
        if (!productSalesMap[key]) {
          productSalesMap[key] = {
            name: item.productTitle || item.name || '',
            sku: item.sku || '',
            category: item.category || '',
            unitsSold: 0,
            revenue: 0,
          };
        }
        productSalesMap[key].unitsSold += item.quantity;
        productSalesMap[key].revenue += item.subtotal;
      });
    });

    const productsList = Object.entries(productSalesMap).map(([id, p]) => ({
      _id: id,
      name: p.name,
      sku: p.sku,
      category: p.category,
      unitsSold: p.unitsSold,
      revenue: p.revenue,
      profit: 0,
    }));

    const byRevenue = [...productsList].sort((a, b) => b.revenue - a.revenue);
    const byUnits = [...productsList].sort((a, b) => b.unitsSold - a.unitsSold);
    const totalUnitsSold = productsList.reduce((total, product) => total + product.unitsSold, 0);

    const retailerMap: Record<string, { name: string; orders: number; revenue: number }> = {};
    allOrders.forEach((order) => {
      const name = order.retailerName;
      if (!name) return;
      if (!retailerMap[name]) retailerMap[name] = { name, orders: 0, revenue: 0 };
      retailerMap[name].orders += 1;
      retailerMap[name].revenue += order.grandTotal;
    });
    const topRetailers = Object.entries(retailerMap).map(([id, r]) => ({
      _id: id,
      name: r.name,
      orders: r.orders,
      revenue: r.revenue,
    })).sort((a, b) => b.revenue - a.revenue);

    const categoryMap: Record<string, { revenue: number; unitsSold: number }> = {};
    allOrders.forEach((order) => order.items.forEach((item) => {
      if (!item.category) return;
      if (!categoryMap[item.category]) categoryMap[item.category] = { revenue: 0, unitsSold: 0 };
      categoryMap[item.category].revenue += item.subtotal;
      categoryMap[item.category].unitsSold += item.quantity;
    }));

    const trendMap: Record<string, { revenue: number; orders: number }> = {};
    allOrders.forEach((order) => {
      const date = safeExtractDate(order.createdAt);
      if (!date) return;
      if (!trendMap[date]) trendMap[date] = { revenue: 0, orders: 0 };
      trendMap[date].revenue += order.grandTotal;
      trendMap[date].orders += 1;
    });

    return {
      period: { startDate, endDate },
      growth: {
        revenueGrowth: 0,
        profitGrowth: 0,
        ordersGrowth: 0,
        aovGrowth: 0,
        retailersGrowth: 0,
      },
      insights: {
        returnRatePercent: 0,
        deliveredOrders: deliveredCount,
        returnedOrders: 0,
        cancelledOrders: statusMap.CANCELLED || 0,
        lowStockAlerts: [],
        fastMovingProducts: [],
        slowMovingProducts: [],
      },
      financial: {
        revenue,
        profit: 0,
        profitBasis: 'Unavailable without backend analytics',
        averageOrderValue: aov,
        averagePaymentPerOrder: paymentsReceived > 0 ? Math.round(paymentsReceived / allOrders.filter((order) => order.paymentStatus === 'PAID').length) : 0,
        paymentsReceived,
        totalDiscount,
        creditOutstanding: 0,
        overdueAmount: 0,
      },
      orders: {
        total: allOrders.length,
        pending: statusMap['PENDING'] || 0,
        confirmed: statusMap['CONFIRMED'] || 0,
        shipped: statusMap['SHIPPED'] || 0,
        delivered: statusMap['DELIVERED'] || 0,
        cancelled: statusMap['CANCELLED'] || 0,
        returned: 0,
        statusBreakdown,
        returnReasons: [],
      },
      products: {
        count: productsList.length,
        totalProducts: productsList.length,
        unitsSold: totalUnitsSold,
        byRevenue,
        byUnits,
      },
      categories: Object.entries(categoryMap).map(([_id, values]) => ({ _id, ...values })),
      retailers: {
        connected: 0,
        newConnected: 0,
        top: topRetailers,
      },
      inventory: {
        unitsAdded: 0,
        unitsSold: totalUnitsSold,
        movementTrend: [],
      },
      coupons: {
        totalDiscount,
        mostUsed: [],
      },
      trend: Object.entries(trendMap)
        .map(([date, values]) => ({ date, ...values }))
        .sort((a, b) => a.date.localeCompare(b.date)),
    };
  }, [reportQuery.data, allOrders, startDate, endDate]);

  const loading = reportQuery.isLoading && !effectiveReport;

  const fetchData = async () => {
    await queryClient.invalidateQueries({
      queryKey: wholesalerQueryKeys.resource(profile.id || 'unknown', 'analytics'),
    });
    await queryClient.invalidateQueries({
      queryKey: wholesalerQueryKeys.resource(profile.id || 'unknown', 'orders'),
    });
    await Promise.all([reportQuery.refetch(), ordersQuery.refetch()]);
  };

  // Filtered orders based on date range and search query
  const filteredOrders = useMemo(() => {
    return allOrders.filter((order) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        (order.orderNumber && order.orderNumber.toLowerCase().includes(q)) ||
        (order.retailerName && order.retailerName.toLowerCase().includes(q)) ||
        (order.orderStatus && order.orderStatus.toLowerCase().includes(q));

      const orderDate = safeExtractDate(order.createdAt);
      const matchesDate =
        (!startDate || !orderDate || orderDate >= startDate) &&
        (!endDate || !orderDate || orderDate <= endDate);

      return matchesSearch && matchesDate;
    });
  }, [allOrders, searchQuery, startDate, endDate]);

  // Paginated orders
  const totalOrdersPages = Math.ceil(filteredOrders.length / ordersPerPage) || 1;
  const paginatedOrders = useMemo(() => {
    const start = (ordersPage - 1) * ordersPerPage;
    return filteredOrders.slice(start, start + ordersPerPage);
  }, [filteredOrders, ordersPage]);

  // Format currency
  const formatCurrency = (val?: number) => {
    return `₹${(val || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
  };

  const handlePrint = () => {
    if (effectiveReport) {
      const html = createPrintableReport(effectiveReport, ['financial', 'orders', 'products', 'payments'], startDate, endDate);
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
      }
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto min-h-screen bg-gray-50/50">
      {/* Page Header */}
      <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-green-700 font-bold text-xs uppercase tracking-wider mb-1">
            <FileText className="w-4 h-4" />
            <span>Business Intelligence & Data Exports</span>
          </div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">
          Reports & Records
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Review detailed financial records, orders history, inventory movements, and export reports to CSV or PDF.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handlePrint}
            disabled={!effectiveReport || loading}
            className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 text-gray-800 rounded-xl font-bold text-sm hover:bg-gray-200 transition-all disabled:opacity-50"
          >
            <Printer className="w-4 h-4 text-gray-600" />
            <span>Print PDF</span>
          </button>

          <button
            type="button"
            onClick={() => setShowExportModal(true)}
            disabled={!effectiveReport || loading}
            className="flex items-center gap-2 px-5 py-2.5 bg-tradeflow-green text-tradeflow-navy rounded-xl font-bold text-sm hover:bg-tradeflow-green-hover transition-all shadow-md disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Date Range Filter Bar */}
      <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-green-700" />
          <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">Report Window:</span>
          
          <div className="flex bg-gray-100 p-1 rounded-xl gap-1 text-xs font-semibold">
            {(['WEEKLY', 'MONTHLY', 'YEARLY', 'CUSTOM'] as const).map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setDatePreset(preset)}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  datePreset === preset
                    ? 'bg-white text-green-700 font-bold shadow-xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {preset === 'WEEKLY' ? 'This Week' : preset === 'MONTHLY' ? 'This Month' : preset === 'YEARLY' ? 'This Year' : 'Custom'}
              </button>
            ))}
          </div>
        </div>

        {datePreset === 'CUSTOM' && (
          <div className="flex items-center gap-2 text-xs font-semibold">
            <span className="text-gray-500">From:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-tradeflow-green outline-none"
            />
            <span className="text-gray-500">To:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-tradeflow-green outline-none"
            />
          </div>
        )}

        <button
          type="button"
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs font-bold text-green-700 hover:text-tradeflow-navy px-3 py-1.5 rounded-lg hover:bg-tradeflow-green-50 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${reportQuery.isFetching ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Category Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {[
          { id: 'ALL', label: 'All Summary', icon: TrendingUp },
          { id: 'ORDERS', label: 'Orders & Transactions', icon: ShoppingBag },
          { id: 'SALES_PROFIT', label: 'Sales & Profit', icon: DollarSign },
          { id: 'PRODUCTS_INVENTORY', label: 'Products & Inventory', icon: Package },
          { id: 'RETAILERS', label: 'Retailers Performance', icon: Users },
          { id: 'CREDIT_PAYMENTS', label: 'Credit & Payments', icon: HandCoins },
          { id: 'COUPONS', label: 'Coupon Usage', icon: Ticket },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as ReportTab)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs whitespace-nowrap transition-all border ${
                isActive
                  ? 'bg-tradeflow-green text-tradeflow-navy border-tradeflow-green shadow-sm shadow-tradeflow-green/20'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Loading state */}
      {loading ? (
        <div className="bg-white rounded-2xl p-12 border border-gray-100 flex flex-col items-center justify-center gap-3">
          <RefreshCw className="w-8 h-8 text-green-700 animate-spin" />
          <p className="text-sm font-bold text-gray-600">Generating report data...</p>
        </div>
      ) : (
        <>
          {/* TAB 1: ALL SUMMARY / SALES & PROFIT */}
          {(activeTab === 'ALL' || activeTab === 'SALES_PROFIT') && effectiveReport && (
            <div className="space-y-6">
              {/* Financial KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                  <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Revenue</div>
                  <div className="text-2xl font-black text-gray-900 mt-1">{formatCurrency(effectiveReport.financial.revenue)}</div>
                  <div className="text-[11px] text-gray-500 mt-1">Excludes cancelled & returned orders</div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                  <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Profit</div>
                  <div className="text-2xl font-black text-emerald-600 mt-1">{formatCurrency(effectiveReport.financial.profit)}</div>
                  <div className="text-[11px] text-gray-500 mt-1">{effectiveReport.financial.profitBasis}</div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                  <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Avg. Order Value</div>
                  <div className="text-2xl font-black text-blue-600 mt-1">{formatCurrency(effectiveReport.financial.averageOrderValue)}</div>
                  <div className="text-[11px] text-gray-500 mt-1">Per delivered/confirmed order</div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                  <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Payments Received</div>
                  <div className="text-2xl font-black text-teal-600 mt-1">{formatCurrency(effectiveReport.financial.paymentsReceived)}</div>
                  <div className="text-[11px] text-gray-500 mt-1">Total collected in selected window</div>
                </div>
              </div>

              {/* Top Products & Top Retailers Tables */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <TopProductsByUnitsTable report={effectiveReport} />
                <TopRetailersTable report={effectiveReport} />
              </div>
            </div>
          )}

          {/* TAB 2: DETAILED ORDERS TABLE */}
          {(activeTab === 'ALL' || activeTab === 'ORDERS') && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden space-y-4 p-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-bold text-gray-900">Detailed Orders Records</h3>
                  <p className="text-xs text-gray-500">
                    Showing {filteredOrders.length} order records in the selected timeframe
                  </p>
                </div>

                {/* Search Input */}
                <div className="relative w-full md:w-64">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search Order #, Retailer..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setOrdersPage(1);
                    }}
                    className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-tradeflow-green outline-none"
                  />
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-y border-gray-100 text-[11px] font-extrabold text-gray-500 uppercase tracking-wider">
                      <th className="py-3 px-4">Order Number</th>
                      <th className="py-3 px-4">Retailer</th>
                      <th className="py-3 px-4">Date & Time (IST)</th>
                      <th className="py-3 px-4 text-center">Items</th>
                      <th className="py-3 px-4 text-right">Subtotal</th>
                      <th className="py-3 px-4 text-right">Discount</th>
                      <th className="py-3 px-4 text-right">Grand Total</th>
                      <th className="py-3 px-4 text-center">Payment</th>
                      <th className="py-3 px-4 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-xs font-medium text-gray-700">
                    {paginatedOrders.length ? (
                      paginatedOrders.map((order) => (
                        <tr key={order.id || order.orderNumber} className="hover:bg-gray-50/80 transition-colors">
                          <td className="py-3 px-4 font-bold text-gray-900">{order.orderNumber}</td>
                          <td className="py-3 px-4 font-semibold text-gray-800">{order.retailerName}</td>
                          <td className="py-3 px-4 text-gray-500">{safeFormatDateTime(order.createdAt)}</td>
                          <td className="py-3 px-4 text-center font-bold">{order.items?.length || 1}</td>
                          <td className="py-3 px-4 text-right font-medium">{formatCurrency(order.subtotal)}</td>
                          <td className="py-3 px-4 text-right text-gray-600 font-semibold">
                            {order.discount ? `-${formatCurrency(order.discount)}` : '₹0'}
                          </td>
                          <td className="py-3 px-4 text-right font-black text-gray-900">
                            {formatCurrency(order.grandTotal)}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              order.isCreditOrder ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                            }`}>
                              {order.isCreditOrder ? 'Credit' : 'Direct'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase ${
                              order.orderStatus === 'DELIVERED'
                                ? 'bg-emerald-100 text-emerald-800'
                                : order.orderStatus === 'CANCELLED'
                                ? 'bg-red-100 text-red-800'
                                : order.orderStatus === 'CONFIRMED'
                                ? 'bg-blue-100 text-blue-800'
                                : order.orderStatus === 'PENDING'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {order.orderStatus}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={9} className="py-8 text-center text-gray-400 text-xs">
                          No order records found matching the filter.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination controls */}
              {totalOrdersPages > 1 && (
                <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                  <span className="text-xs text-gray-500 font-medium">
                    Page {ordersPage} of {totalOrdersPages}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setOrdersPage((p) => Math.max(1, p - 1))}
                      disabled={ordersPage === 1}
                      className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setOrdersPage((p) => Math.min(totalOrdersPages, p + 1))}
                      disabled={ordersPage === totalOrdersPages}
                      className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: PRODUCTS & INVENTORY */}
          {(activeTab === 'PRODUCTS_INVENTORY' || (activeTab === 'ALL' && effectiveReport)) && effectiveReport && (
            <div className="space-y-6">
              <StockMovementWidget report={effectiveReport} />
              <ReturnsSummaryWidget report={effectiveReport} />
            </div>
          )}

          {/* TAB 4: RETAILERS */}
          {activeTab === 'RETAILERS' && effectiveReport && (
            <div className="space-y-6">
              <TopRetailersTable report={effectiveReport} />
            </div>
          )}

          {/* TAB 5: CREDIT & PAYMENTS */}
          {activeTab === 'CREDIT_PAYMENTS' && effectiveReport && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                  <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Payments Received</div>
                  <div className="text-3xl font-black text-emerald-600 mt-2">{formatCurrency(effectiveReport.financial.paymentsReceived)}</div>
                  <div className="text-xs text-gray-500 mt-1">Direct settlements & collections</div>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                  <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Credit Outstanding</div>
                  <div className="text-3xl font-black text-amber-600 mt-2">{formatCurrency(effectiveReport.financial.creditOutstanding)}</div>
                  <div className="text-xs text-gray-500 mt-1">Active BNPL & retailer balance</div>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                  <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Overdue Amount</div>
                  <div className="text-3xl font-black text-amber-700 mt-2">{formatCurrency(effectiveReport.financial.overdueAmount)}</div>
                  <div className="text-xs text-gray-500 mt-1">Past repayment deadline</div>
                </div>
              </div>

              {/* Credit Orders List */}
              <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <HandCoins className="w-5 h-5 text-green-700" />
                    <h3 className="font-bold text-gray-900">Credit Orders Breakdown</h3>
                  </div>
                  <span className="text-xs font-bold text-amber-700 bg-amber-50 px-3 py-1 rounded-full">
                    {allOrders.filter(o => o.isCreditOrder).length} Credit Orders
                  </span>
                </div>

                <div className="divide-y divide-gray-100">
                  {allOrders.filter(o => o.isCreditOrder).map(order => (
                    <div key={order.id} className="py-3 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-gray-900">{order.orderNumber}</span>
                        <span className="text-gray-400 mx-2">·</span>
                        <span className="font-medium text-gray-700">{order.retailerName}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-gray-500">{safeFormatDateTime(order.createdAt)}</span>
                        <span className="font-bold text-gray-900">{formatCurrency(order.grandTotal)}</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                          {order.paymentStatus}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: COUPONS */}
          {(activeTab === 'COUPONS' || (activeTab === 'ALL' && effectiveReport)) && effectiveReport && (
            <CouponUsageWidget report={effectiveReport} />
          )}
        </>
      )}

      {/* Export CSV Modal */}
      {effectiveReport && (
        <ExportReportModal
          isOpen={showExportModal}
          onClose={() => setShowExportModal(false)}
          startDate={startDate}
          endDate={endDate}
        />
      )}
    </div>
  );
}
