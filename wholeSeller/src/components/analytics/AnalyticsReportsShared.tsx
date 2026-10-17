import React from 'react';
import {
  CheckCircle2,
  Package,
  RefreshCw,
  Tag,
  Users,
  Warehouse,
  XCircle,
  X,
  FileDown,
  Printer,
  FileSpreadsheet,
} from 'lucide-react';
import { type WholesalerAnalyticsReport, api } from '@/lib/api';
import { tradeflowChartTokens } from '@/theme/tokens';

export type ExportSection = 'financial' | 'orders' | 'products' | 'payments';

export const EXPORT_OPTIONS: Array<{ id: ExportSection; label: string; description: string }> = [
  { id: 'financial', label: 'Financial summary', description: 'Revenue, profit, payments, discounts, and credit' },
  { id: 'orders', label: 'Orders', description: 'Order totals, status, retailer, and payment details' },
  { id: 'products', label: 'Products', description: 'All products sold, units, SKUs, and sales' },
  { id: 'payments', label: 'Payments', description: 'Payment transactions and settlement statuses' },
];

export function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value || 0);
}

export function formatTrendDate(value: string) {
  if (!value) return '';
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' }).format(
    new Date(`${value}T00:00:00Z`)
  );
}

function escapeHtml(value: unknown) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character] || character);
}

export function createPrintableReport(
  report: WholesalerAnalyticsReport,
  sections: ExportSection[],
  startDate: string,
  endDate: string
) {
  const table = (headers: string[], rows: string[][]) => `
    <table><thead><tr>${headers.map((item) => `<th>${escapeHtml(item)}</th>`).join('')}</tr></thead>
    <tbody>${rows.map((row) => `<tr>${row.map((item) => `<td>${escapeHtml(item)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  const includes = (section: ExportSection) => sections.includes(section);
  const maxTrendRevenue = Math.max(1, ...report.trend.map((item) => item.revenue));
  const trendPoints = report.trend.map((item, index) => {
    const x = report.trend.length < 2 ? 300 : 20 + (index * 560) / (report.trend.length - 1);
    const y = 160 - (item.revenue / maxTrendRevenue) * 130;
    return `${x},${y}`;
  }).join(' ');
  const maxOrderCount = Math.max(1, ...report.orders.statusBreakdown.map((item) => item.count));
  const maxProductRevenue = Math.max(1, ...report.products.byRevenue.map((item) => item.revenue));
  const sectionsHtml: string[] = [];

  if (includes('financial')) {
    sectionsHtml.push(`
      <section><h2>Financial summary</h2>
        ${table(['Metric', 'Value'], [
          ['Total revenue', formatCurrency(report.financial.revenue)],
          ['Total profit', formatCurrency(report.financial.profit)],
          ['Average order value', formatCurrency(report.financial.averageOrderValue)],
          ['Average payment per order', formatCurrency(report.financial.averagePaymentPerOrder)],
          ['Payments received', formatCurrency(report.financial.paymentsReceived)],
          ['Discount given', formatCurrency(report.financial.totalDiscount)],
          ['Outstanding credit', formatCurrency(report.financial.creditOutstanding)],
          ['Overdue credit', formatCurrency(report.financial.overdueAmount)],
          ['Total orders', report.orders.total.toLocaleString('en-IN')],
          ['Units sold', report.products.unitsSold.toLocaleString('en-IN')],
          ['New retailers connected', report.retailers.newConnected.toLocaleString('en-IN')],
        ])}
        <h3>Daily revenue trend</h3>
        ${report.trend.length
          ? `<svg class="trend" viewBox="0 0 600 180" role="img" aria-label="Daily revenue trend">
              <line x1="20" y1="160" x2="580" y2="160" stroke="${tradeflowChartTokens.gray300}" />
              <polyline points="${trendPoints}" fill="none" stroke="${tradeflowChartTokens.green}" stroke-width="3" />
            </svg>
            ${table(['Date', 'Revenue', 'Orders'], report.trend.map((item) => [
              formatTrendDate(item.date),
              formatCurrency(item.revenue),
              item.orders.toLocaleString('en-IN'),
            ]))}`
          : '<p>No revenue data for this period.</p>'}
      </section>`);
  }

  if (includes('orders')) {
    sectionsHtml.push(`
      <section><h2>Orders</h2>
        <h3>Order status breakdown</h3>
        <div class="bars">${report.orders.statusBreakdown.map((item) => `
          <div class="bar-row"><span>${escapeHtml(item.status.replace(/_/g, ' '))}</span>
            <div class="bar-track"><span style="width:${Math.max(2, (item.count / maxOrderCount) * 100)}%"></span></div>
            <strong>${item.count.toLocaleString('en-IN')}</strong>
          </div>`).join('')}</div>
        <h3>Return reasons</h3>
        ${table(['Reason', 'Returns', 'Units'], report.orders.returnReasons.map((item) => [
          item.reason,
          item.returns.toLocaleString('en-IN'),
          item.units.toLocaleString('en-IN'),
        ]))}
      </section>`);
  }

  if (includes('products')) {
    sectionsHtml.push(`
      <section><h2>Products and categories</h2>
        <h3>Top products by revenue</h3>
        <div class="bars">${report.products.byRevenue.map((item) => `
          <div class="bar-row product-bar"><span>${escapeHtml(item.name)} (${escapeHtml(item.sku)})</span>
            <div class="bar-track"><span style="width:${Math.max(2, (item.revenue / maxProductRevenue) * 100)}%"></span></div>
            <strong>${escapeHtml(formatCurrency(item.revenue))}</strong>
          </div>`).join('')}</div>
        ${table(['Top products by units', 'SKU', 'Units', 'Revenue'], report.products.byUnits.map((item) => [
          item.name,
          item.sku,
          item.unitsSold.toLocaleString('en-IN'),
          formatCurrency(item.revenue),
        ]))}
        <h3>Category sales</h3>
        ${table(['Category', 'Revenue', 'Units sold'], report.categories.map((item) => [
          item._id,
          formatCurrency(item.revenue),
          item.unitsSold.toLocaleString('en-IN'),
        ]))}
      </section>`);
  }

  if (includes('payments')) {
    sectionsHtml.push(`
      <section><h2>Payments</h2>
        ${table(['Metric', 'Value'], [
          ['Payments received', formatCurrency(report.financial.paymentsReceived)],
          ['Average payment per order', formatCurrency(report.financial.averagePaymentPerOrder)],
        ])}
        <p>Payment transaction details are included in the CSV export.</p>
      </section>`);
  }

  return `<!doctype html><html><head><meta charset="utf-8"><title>Business report ${escapeHtml(startDate)} to ${escapeHtml(endDate)}</title>
    <style>
      :root{--color-tradeflow-navy:${tradeflowChartTokens.navy};--color-tradeflow-green:${tradeflowChartTokens.green};--color-tradeflow-sky:${tradeflowChartTokens.sky};--color-tradeflow-gray-100:${tradeflowChartTokens.gray100};--color-tradeflow-gray-200:${tradeflowChartTokens.gray200};--color-tradeflow-gray-500:${tradeflowChartTokens.gray500}}
      *{box-sizing:border-box}body{font:13px Inter,system-ui,sans-serif;color:var(--color-tradeflow-navy);margin:28px}
      h1,h2,h3{font-family:Poppins,Inter,system-ui,sans-serif}h1{font-size:24px;margin:0 0 6px}h2{font-size:18px;margin:0 0 14px;border-bottom:2px solid var(--color-tradeflow-green);padding-bottom:7px}
      h3{font-size:14px;margin:20px 0 10px}header{margin-bottom:24px}header p,.note{color:var(--color-tradeflow-gray-500)}
      section{margin:0 0 28px;page-break-inside:avoid}table{border-collapse:collapse;width:100%;margin:8px 0 16px}
      th,td{border:1px solid var(--color-tradeflow-gray-200);padding:7px 9px;text-align:left;vertical-align:top}
      th{background:var(--color-tradeflow-gray-100);font-size:11px;text-transform:uppercase}.trend{height:160px;width:100%;margin:8px 0}
      .bars{display:grid;gap:8px;margin:10px 0 18px}.bar-row{display:grid;grid-template-columns:150px 1fr 100px;gap:10px;align-items:center}
      .bar-row>span{overflow-wrap:anywhere;text-transform:capitalize}.bar-track{height:12px;background:var(--color-tradeflow-gray-100);border-radius:8px;overflow:hidden}
      .bar-track span{display:block;height:100%;background:var(--color-tradeflow-green);border-radius:8px}.product-bar .bar-track span{background:var(--color-tradeflow-sky)}
      .bar-row strong{text-align:right}.note{font-size:11px;margin-top:24px}
      @media print{body{margin:14mm}section{page-break-inside:avoid}h2,h3{page-break-after:avoid}}
    </style></head><body>
      <header><h1>Business Performance Report</h1>
        <p>${escapeHtml(startDate)} to ${escapeHtml(endDate)} · Generated ${escapeHtml(new Date().toLocaleString('en-IN'))}</p>
      </header>
      ${sectionsHtml.join('')}
      <p class="note">Profit uses product cost price snapshot at order time; cancelled/returned orders are excluded from revenue.</p>
    </body></html>`;
}

export function TopProductsByUnitsTable({ report }: { report: WholesalerAnalyticsReport }) {
  return (
    <article className="overflow-hidden rounded-2xl border border-tradeflow-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-tradeflow-gray-200 p-5">
        <div>
          <h2 className="font-bold text-tradeflow-navy">Top products by units</h2>
          <p className="mt-1 text-xs text-gray-500">Ranked by quantity sold</p>
        </div>
        <Package className="h-5 w-5 text-green-700" aria-hidden="true" />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-tradeflow-gray-50 text-xs uppercase text-gray-500">
            <tr><th className="px-5 py-3">Product</th><th className="px-5 py-3">Units</th><th className="px-5 py-3 text-right">Revenue</th></tr>
          </thead>
          <tbody className="divide-y divide-tradeflow-gray-200">
            {report.products.byUnits.map((product) => (
              <tr key={product._id}>
                <td className="px-5 py-3">
                  <p className="font-semibold text-tradeflow-navy">{product.name}</p>
                  <p className="text-xs text-gray-500">{product.sku}</p>
                </td>
                <td className="px-5 py-3 font-semibold">{product.unitsSold.toLocaleString('en-IN')}</td>
                <td className="px-5 py-3 text-right font-semibold">{formatCurrency(product.revenue)}</td>
              </tr>
            ))}
            {!report.products.byUnits.length && (
              <tr><td colSpan={3} className="px-5 py-8 text-center text-sm text-gray-500">No product sales for this period.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </article>
  );
}

export function TopRetailersTable({ report }: { report: WholesalerAnalyticsReport }) {
  return (
    <article className="overflow-hidden rounded-2xl border border-tradeflow-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-tradeflow-gray-200 p-5">
        <div>
          <h2 className="font-bold text-tradeflow-navy">Top retailers</h2>
          <p className="mt-1 text-xs text-gray-500">Ranked by order volume, with revenue</p>
        </div>
        <Users className="h-5 w-5 text-green-700" aria-hidden="true" />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-tradeflow-gray-50 text-xs uppercase text-gray-500">
            <tr><th className="px-5 py-3">Retailer</th><th className="px-5 py-3">Orders</th><th className="px-5 py-3 text-right">Revenue</th></tr>
          </thead>
          <tbody className="divide-y divide-tradeflow-gray-200">
            {report.retailers.top.map((retailer) => (
              <tr key={retailer._id}>
                <td className="px-5 py-3 font-semibold text-tradeflow-navy">{retailer.name}</td>
                <td className="px-5 py-3">{retailer.orders}</td>
                <td className="px-5 py-3 text-right font-semibold">{formatCurrency(retailer.revenue)}</td>
              </tr>
            ))}
            {!report.retailers.top.length && (
              <tr><td colSpan={3} className="px-5 py-8 text-center text-sm text-gray-500">No retailer orders for this period.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </article>
  );
}

export function StockMovementWidget({ report }: { report: WholesalerAnalyticsReport }) {
  return (
    <article className="rounded-2xl border border-tradeflow-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <Warehouse className="h-5 w-5 text-green-700" aria-hidden="true" />
        <h2 className="font-bold text-tradeflow-navy">Stock movement</h2>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-green-50 p-4">
          <p className="text-xs font-semibold text-green-800">Units added</p>
          <p className="mt-1 text-2xl font-extrabold text-green-900">{report.inventory.unitsAdded.toLocaleString('en-IN')}</p>
        </div>
        <div className="rounded-xl bg-tradeflow-green-50 p-4">
          <p className="text-xs font-semibold text-tradeflow-navy">Units sold</p>
          <p className="mt-1 text-2xl font-extrabold text-tradeflow-navy">{report.inventory.unitsSold.toLocaleString('en-IN')}</p>
        </div>
      </div>
    </article>
  );
}

export function CouponUsageWidget({ report }: { report: WholesalerAnalyticsReport }) {
  return (
    <article className="rounded-2xl border border-tradeflow-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <Tag className="h-5 w-5 text-green-700" aria-hidden="true" />
        <h2 className="font-bold text-tradeflow-navy">Coupon usage</h2>
      </div>
      <p className="mt-4 text-xs text-gray-500">Discount given in the selected period</p>
      <p className="mt-1 text-2xl font-extrabold text-tradeflow-navy">{formatCurrency(report.coupons.totalDiscount)}</p>
      <div className="mt-4 space-y-2">
        {report.coupons.mostUsed.slice(0, 5).map((coupon) => (
          <div key={coupon._id} className="flex items-center justify-between gap-3 text-sm">
            <span className="font-semibold text-gray-700">{coupon._id}</span>
            <span className="text-gray-500">{coupon.uses} uses · {formatCurrency(coupon.discount)}</span>
          </div>
        ))}
        {!report.coupons.mostUsed.length && <p className="text-sm text-gray-500">No coupons used in this period.</p>}
      </div>
    </article>
  );
}

export function ReturnsSummaryWidget({ report }: { report: WholesalerAnalyticsReport }) {
  return (
    <article className="rounded-2xl border border-tradeflow-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <RefreshCw className="h-5 w-5 text-green-700" aria-hidden="true" />
        <h2 className="font-bold text-tradeflow-navy">Returns &amp; cancellations</h2>
      </div>
      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        <span className="flex items-center gap-1.5 text-gray-600"><CheckCircle2 className="h-4 w-4 text-status-info" aria-hidden="true" />Returned: <strong>{report.orders.returned}</strong></span>
        <span className="flex items-center gap-1.5 text-gray-600"><XCircle className="h-4 w-4 text-red-600" aria-hidden="true" />Cancelled: <strong>{report.orders.cancelled}</strong></span>
      </div>
      <div className="mt-4 space-y-2 border-t border-tradeflow-gray-200 pt-3">
        <p className="text-xs font-bold uppercase text-gray-500">Return reasons</p>
        {report.orders.returnReasons.map((item) => (
          <div key={item.reason} className="flex items-center justify-between gap-3 text-sm">
            <span className="truncate text-gray-700">{item.reason}</span>
            <span className="shrink-0 text-gray-500">{item.returns} · {item.units} units</span>
          </div>
        ))}
        {!report.orders.returnReasons.length && <p className="text-sm text-gray-500">No returns in this period.</p>}
      </div>
    </article>
  );
}

export function ExportReportModal({
  isOpen,
  onClose,
  startDate,
  endDate,
}: {
  isOpen: boolean;
  onClose: () => void;
  startDate: string;
  endDate: string;
}) {
  const [selectedSections, setSelectedSections] = React.useState<ExportSection[]>([
    'financial',
    'orders',
    'products',
    'payments',
  ]);
  const [downloading, setDownloading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (!isOpen) return null;

  const toggleSection = (id: ExportSection) => {
    setSelectedSections((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const handleDownloadCsv = async () => {
    try {
      setDownloading(true);
      setError(null);
      const blob = await api.downloadWholesalerAnalyticsCsv(
        startDate,
        endDate,
        selectedSections
      );
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `wholesaler-report-${startDate}-to-${endDate}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      onClose();
    } catch (err: any) {
      console.error('Failed to export CSV:', err);
      setError(err?.message || 'Failed to download CSV export');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 pb-4">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-green-700" />
            <h3 className="font-bold text-gray-900">Export CSV Data</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mt-4 text-xs text-gray-500">
          Select data sections to include in the CSV export file ({startDate} to {endDate}):
        </p>

        <div className="mt-4 space-y-3">
          {EXPORT_OPTIONS.map((opt) => {
            const checked = selectedSections.includes(opt.id);
            return (
              <label
                key={opt.id}
                className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-all ${
                  checked
                    ? 'border-tradeflow-green bg-tradeflow-green-50/40 text-tradeflow-navy'
                    : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleSection(opt.id)}
                  className="mt-0.5 rounded text-green-700 focus:ring-tradeflow-green"
                />
                <div>
                  <p className="text-xs font-bold">{opt.label}</p>
                  <p className="text-[11px] text-gray-500">{opt.description}</p>
                </div>
              </label>
            );
          })}
        </div>

        {error && (
          <p className="mt-3 text-xs font-semibold text-red-600">{error}</p>
        )}

        <div className="mt-6 flex items-center justify-end gap-3 border-t border-gray-100 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDownloadCsv}
            disabled={downloading || !selectedSections.length}
            className="flex items-center gap-2 rounded-xl bg-tradeflow-green px-5 py-2 text-xs font-bold text-tradeflow-navy hover:bg-tradeflow-green-hover disabled:opacity-50"
          >
            {downloading ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <FileDown className="h-4 w-4" />
            )}
            <span>{downloading ? 'Exporting...' : 'Download CSV'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
