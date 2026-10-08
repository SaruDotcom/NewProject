import React, { useState, useEffect, useMemo } from 'react';
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

type ReportTab =
  | 'ALL'
  | 'ORDERS'
  | 'SALES_PROFIT'
  | 'PRODUCTS_INVENTORY'
  | 'RETAILERS'
  | 'CREDIT_PAYMENTS'
  | 'COUPONS';

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<ReportTab>('ALL');
  const [datePreset, setDatePreset] = useState<'WEEKLY' | 'MONTHLY' | 'YEARLY' | 'CUSTOM'>('MONTHLY');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  const [report, setReport] = useState<WholesalerAnalyticsReport | null>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
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

  // Fetch report analytics and orders data
  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const params: { startDate?: string; endDate?: string } = {};
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const [analyticsRes, ordersRes] = await Promise.all([
        api.getWholesalerAnalytics(params),
        api.getOrders().catch(() => ({ data: [] })),
      ]);

      if (analyticsRes?.data?.report) {
        setReport(analyticsRes.data.report);
      }
      const orderList = Array.isArray(ordersRes?.data) ? ordersRes.data : Array.isArray(ordersRes) ? ordersRes : [];
      setOrders(orderList);
    } catch (err: any) {
      console.error('Failed to fetch reports data:', err);
      setError(err?.message || 'Failed to load report data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (startDate && endDate) {
      fetchData();
    }
  }, [startDate, endDate]);

  // Filtered orders based on date range and search query
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const matchesSearch =
        !searchQuery ||
        (order.orderNumber && order.orderNumber.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (order.retailerName && order.retailerName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (order.orderStatus && order.orderStatus.toLowerCase().includes(searchQuery.toLowerCase()));

      const orderDate = order.createdAt ? new Date(order.createdAt).toISOString().slice(0, 10) : '';
      const matchesDate =
        (!startDate || orderDate >= startDate) && (!endDate || orderDate <= endDate);

      return matchesSearch && matchesDate;
    });
  }, [orders, searchQuery, startDate, endDate]);

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

  // Format IST Date Time
  const formatDateTime = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr).toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    } catch (e) {
      return dateStr;
    }
  };

  const handlePrint = () => {
    if (report) {
      const html = createPrintableReport(report, ['financial', 'orders', 'products', 'payments'], startDate, endDate);
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
          <div className="flex items-center gap-2 text-red-600 font-bold text-xs uppercase tracking-wider mb-1">
            <FileText className="w-4 h-4" />
            <span>Business Intelligence & Data Exports</span>
          </div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">
            Wholesaler Reports & Records
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Review detailed financial records, orders history, inventory movements, and export reports to CSV or PDF.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handlePrint}
            disabled={!report || loading}
            className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 text-gray-800 rounded-xl font-bold text-sm hover:bg-gray-200 transition-all disabled:opacity-50"
          >
            <Printer className="w-4 h-4 text-gray-600" />
            <span>Print PDF</span>
          </button>

          <button
            type="button"
            onClick={() => setShowExportModal(true)}
            disabled={!report || loading}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-red-600 to-rose-700 text-white rounded-xl font-bold text-sm hover:from-red-700 hover:to-rose-800 transition-all shadow-md shadow-red-200 disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Date Range Filter Bar */}
      <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-red-600" />
          <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">Report Window:</span>
          
          <div className="flex bg-gray-100 p-1 rounded-xl gap-1 text-xs font-semibold">
            {(['WEEKLY', 'MONTHLY', 'YEARLY', 'CUSTOM'] as const).map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setDatePreset(preset)}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  datePreset === preset
                    ? 'bg-white text-red-600 font-bold shadow-xs'
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
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-red-500 outline-none"
            />
            <span className="text-gray-500">To:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-red-500 outline-none"
            />
          </div>
        )}

        <button
          type="button"
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs font-bold text-red-600 hover:text-red-700 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
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
                  ? 'bg-red-600 text-white border-red-600 shadow-sm shadow-red-200'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading state */}
      {loading ? (
        <div className="bg-white rounded-2xl p-12 border border-gray-100 flex flex-col items-center justify-center gap-3">
          <RefreshCw className="w-8 h-8 text-red-600 animate-spin" />
          <p className="text-sm font-bold text-gray-600">Generating report data...</p>
        </div>
      ) : (
        <>
          {/* TAB 1: ALL SUMMARY */}
          {(activeTab === 'ALL' || activeTab === 'SALES_PROFIT') && report && (
            <div className="space-y-6">
              {/* Financial KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                  <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Revenue</div>
                  <div className="text-2xl font-black text-gray-900 mt-1">{formatCurrency(report.financial.revenue)}</div>
                  <div className="text-[11px] text-gray-500 mt-1">Excludes cancelled & returned orders</div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                  <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Profit</div>
                  <div className="text-2xl font-black text-emerald-600 mt-1">{formatCurrency(report.financial.profit)}</div>
                  <div className="text-[11px] text-gray-500 mt-1">{report.financial.profitBasis}</div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                  <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Avg. Order Value</div>
                  <div className="text-2xl font-black text-blue-600 mt-1">{formatCurrency(report.financial.averageOrderValue)}</div>
                  <div className="text-[11px] text-gray-500 mt-1">Per delivered/confirmed order</div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                  <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Payments Received</div>
                  <div className="text-2xl font-black text-teal-600 mt-1">{formatCurrency(report.financial.paymentsReceived)}</div>
                  <div className="text-[11px] text-gray-500 mt-1">Total collected in selected window</div>
                </div>
              </div>

              {/* Top Products & Top Retailers Tables */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <TopProductsByUnitsTable report={report} />
                <TopRetailersTable report={report} />
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
                    className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-red-500 outline-none"
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
                        <tr key={order._id || order.id || order.orderNumber} className="hover:bg-gray-50/80 transition-colors">
                          <td className="py-3 px-4 font-bold text-gray-900">{order.orderNumber}</td>
                          <td className="py-3 px-4 font-semibold text-gray-800">{order.retailerName || order.retailer?.businessName || 'Retailer'}</td>
                          <td className="py-3 px-4 text-gray-500">{formatDateTime(order.createdAt)}</td>
                          <td className="py-3 px-4 text-center font-bold">{order.items?.length || 0}</td>
                          <td className="py-3 px-4 text-right font-medium">{formatCurrency(order.subtotal)}</td>
                          <td className="py-3 px-4 text-right text-red-600 font-semibold">
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
          {(activeTab === 'PRODUCTS_INVENTORY' || (activeTab === 'ALL' && report)) && report && (
            <div className="space-y-6">
              <StockMovementWidget report={report} />
              <ReturnsSummaryWidget report={report} />
            </div>
          )}

          {/* TAB 4: RETAILERS */}
          {activeTab === 'RETAILERS' && report && (
            <div className="space-y-6">
              <TopRetailersTable report={report} />
            </div>
          )}

          {/* TAB 5: CREDIT & PAYMENTS */}
          {activeTab === 'CREDIT_PAYMENTS' && report && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Payments Received</div>
                <div className="text-3xl font-black text-emerald-600 mt-2">{formatCurrency(report.financial.paymentsReceived)}</div>
              </div>
              <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Credit Outstanding</div>
                <div className="text-3xl font-black text-amber-600 mt-2">{formatCurrency(report.financial.creditOutstanding)}</div>
              </div>
              <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Overdue Amount</div>
                <div className="text-3xl font-black text-red-600 mt-2">{formatCurrency(report.financial.overdueAmount)}</div>
              </div>
            </div>
          )}

          {/* TAB 6: COUPONS */}
          {(activeTab === 'COUPONS' || (activeTab === 'ALL' && report)) && report && (
            <CouponUsageWidget report={report} />
          )}
        </>
      )}

      {/* Export CSV Modal */}
      {report && (
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
