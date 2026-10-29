import { useEffect, useState } from "react";
import {
  TrendingUp,
  Download,
  RefreshCw,
  IndianRupee,
  ShoppingBag,
  Package,
  CheckCircle2,
  AlertTriangle,
  Award,
  CreditCard,
  FileText,
  FileSpreadsheet,
  Building2,
  Store,
  Layers,
  Percent,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KpiCard, PageHeader, SectionCard, StatusBadge } from "@/components/admin-ui";
import { apiGet } from "@/lib/api";
import { toast } from "sonner";

const initial = {
  summary: {
    totalSales: 0,
    taxableAmount: 0,
    totalGst: 0,
    cgst: 0,
    sgst: 0,
    igst: 0,
    totalTds: 0,
    orders: 0,
    completedOrders: 0,
    cancelledOrders: 0,
    avgOrderValue: 0,
    totalProducts: 0,
    lowStockCount: 0,
    zeroStockCount: 0,
  },
  daily: [],
  topWholesalers: [],
  topRetailers: [],
  topProducts: [],
  categorySales: [],
  payouts: [],
  tdsLedger: [],
};

export function ReportsManagementPage() {
  const [days, setDays] = useState("30");
  const [activeTab, setActiveTab] = useState("sales");
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);

    apiGet(`/admin/reports?days=${days}`)
      .then((payload) => {
        if (mounted) {
          setData(payload || initial);
        }
      })
      .catch((err) => {
        if (mounted) {
          setError(err.message || "Failed to load report analytics");
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [days, refreshKey]);

  const money = (value) => `₹${Number(value || 0).toLocaleString("en-IN")}`;
  const number = (value) => Number(value || 0).toLocaleString("en-IN");

  const exportCurrentTabCsv = () => {
    const esc = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    let filename = `report_${activeTab}_${days}d.csv`;
    let csvRows = [];

    if (activeTab === "sales") {
      csvRows = [
        ["Date", "Orders Count", "Sales GMV (INR)", "GST Collected (18%)", "TDS Deducted (1%)"],
        ...data.daily.map((row) => [
          row._id,
          row.orders,
          row.sales,
          Math.round(row.sales * 0.1525),
          Math.round(row.sales * 0.01),
        ]),
      ];
    } else if (activeTab === "products") {
      csvRows = [
        ["Product Name", "SKU", "Category", "Wholesale Price (INR)", "Available Stock"],
        ...data.topProducts.map((row) => [row.name, row.sku, row.category || "General", row.price, row.stock]),
      ];
    } else if (activeTab === "gst") {
      csvRows = [
        ["Date / Period", "Gross Sales", "Taxable Amount", "Total GST (18%)", "CGST (9%)", "SGST (9%)"],
        ...data.daily.map((row) => [
          row._id,
          row.sales,
          Math.round(row.sales * 0.8475),
          Math.round(row.sales * 0.1525),
          Math.round(row.sales * 0.07625),
          Math.round(row.sales * 0.07625),
        ]),
      ];
    } else if (activeTab === "tds") {
      csvRows = [
        ["Wholesaler Business Name", "PAN Number", "GSTIN", "Gross Trade Amount", "TDS Deducted (1%)", "Net Remitted"],
        ...data.tdsLedger.map((row) => [row.name, row.pan, row.gstin, row.grossTrade, row.tdsDeducted, row.netPayable]),
      ];
    } else if (activeTab === "earners") {
      csvRows = [
        ["Rank", "Wholesaler Name", "Email", "Total Orders", "Gross Sales GMV", "TDS Deducted (1%)", "Net Earnings"],
        ...data.topWholesalers.map((w, idx) => [
          idx + 1,
          w.name,
          w.email,
          w.totalOrders,
          w.totalSales,
          w.tdsDeducted,
          w.netEarnings,
        ]),
      ];
    } else if (activeTab === "payouts") {
      csvRows = [
        ["Reference ID", "Wholesaler Name", "Amount (INR)", "Status", "Date"],
        ...data.payouts.map((p) => [p.referenceId, p.wholesaler, p.amount, p.status, p.createdAt]),
      ];
    }

    const csvContent = csvRows.map((row) => row.map(esc).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csvContent], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${activeTab.toUpperCase()} report successfully`);
  };

  const summary = data.summary || initial.summary;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Track sales, tax ledgers, payouts, and performance."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={days} onValueChange={setDays}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
                <SelectItem value="365">Last 1 year</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline" onClick={exportCurrentTabCsv}>
              <Download className="size-4 mr-1.5" /> Export
            </Button>
            <Button variant="outline" onClick={() => setRefreshKey((prev) => prev + 1)}>
              <RefreshCw className="size-4 mr-1.5" /> Refresh
            </Button>
          </div>
        }
      />

      {loading ? (
        <div className="p-12 text-center rounded-xl border border-dashed bg-card text-sm text-muted-foreground">
          Loading reports...
        </div>
      ) : error ? (
        <div className="p-6 rounded-xl border border-destructive/30 bg-destructive/5 text-sm text-destructive">
          {error}
        </div>
      ) : (
        <Tabs defaultValue="sales" value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="flex h-auto w-full justify-start overflow-x-auto rounded-xl border bg-card p-1 shadow-xs">
            <TabsTrigger value="sales" className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold">
              <TrendingUp className="size-4 text-primary" />
              <span>Sales</span>
            </TabsTrigger>
            <TabsTrigger value="products" className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold">
              <Package className="size-4 text-status-info" />
              <span>Products</span>
            </TabsTrigger>
            <TabsTrigger value="gst" className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold">
              <FileText className="size-4 text-emerald-600" />
              <span>GST</span>
            </TabsTrigger>
            <TabsTrigger value="tds" className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold">
              <Percent className="size-4 text-amber-600" />
              <span>TDS</span>
            </TabsTrigger>
            <TabsTrigger value="earners" className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold">
              <Award className="size-4 text-amber-600" />
              <span>Top Earners</span>
            </TabsTrigger>
            <TabsTrigger value="payouts" className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold">
              <CreditCard className="size-4 text-blue-600" />
              <span>Payouts</span>
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: SALES REPORT */}
          <TabsContent value="sales" className="space-y-6">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <KpiCard label="Gross Sales GMV" value={money(summary.totalSales)} icon={IndianRupee} tone="primary" />
              <KpiCard label="Total Orders" value={number(summary.orders)} icon={ShoppingBag} tone="success" />
              <KpiCard label="Completed Orders" value={number(summary.completedOrders)} icon={CheckCircle2} tone="success" />
              <KpiCard label="Avg Order Value (AOV)" value={money(summary.avgOrderValue)} icon={TrendingUp} tone="primary" />
            </div>

            <SectionCard title="Daily Sales Trend" description={`Performance breakdown for the last ${days} days`}>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b bg-muted/40 font-bold uppercase text-muted-foreground">
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Orders Count</th>
                      <th className="px-4 py-3">Gross Sales (GMV)</th>
                      <th className="px-4 py-3">Est. GST Collected</th>
                      <th className="px-4 py-3">TDS (1%)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {data.daily.length ? (
                      data.daily.map((row) => (
                        <tr key={row._id} className="hover:bg-muted/30">
                          <td className="px-4 py-3 font-semibold">{row._id}</td>
                          <td className="px-4 py-3">{number(row.orders)}</td>
                          <td className="px-4 py-3 font-bold text-foreground">{money(row.sales)}</td>
                          <td className="px-4 py-3 text-emerald-700 font-medium">{money(row.gst || row.sales * 0.1525)}</td>
                          <td className="px-4 py-3 text-amber-700 font-medium">{money(row.tds || row.sales * 0.01)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="5" className="px-4 py-8 text-center text-muted-foreground">
                          No sales data for this period.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          </TabsContent>

          {/* TAB 2: PRODUCTS REPORT */}
          <TabsContent value="products" className="space-y-6">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <KpiCard label="Total Listed Products" value={number(summary.totalProducts)} icon={Package} tone="primary" />
              <KpiCard label="Low Stock Products" value={number(summary.lowStockCount)} icon={AlertTriangle} tone="warning" />
              <KpiCard label="Out of Stock Products" value={number(summary.zeroStockCount)} icon={AlertTriangle} tone="destructive" />
              <KpiCard label="Top Category Sales" value={data.categorySales[0]?.name || "Clothing"} icon={Layers} tone="success" />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <SectionCard title="Top Performing Products" description="Products with highest available inventory and sales velocity">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b bg-muted/40 font-bold uppercase text-muted-foreground">
                        <th className="px-4 py-3">Product Name</th>
                        <th className="px-4 py-3">SKU</th>
                        <th className="px-4 py-3">Price</th>
                        <th className="px-4 py-3">Stock</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {data.topProducts.length ? (
                        data.topProducts.map((p) => (
                          <tr key={p.id} className="hover:bg-muted/30">
                            <td className="px-4 py-3 font-semibold text-foreground">{p.name}</td>
                            <td className="px-4 py-3 font-mono text-muted-foreground">{p.sku}</td>
                            <td className="px-4 py-3 font-bold text-emerald-700">{money(p.price)}</td>
                            <td className="px-4 py-3 font-semibold">{number(p.stock)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="4" className="px-4 py-8 text-center text-muted-foreground">
                            No product data found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </SectionCard>

              <SectionCard title="Category Revenue Distribution" description="Gross trade value breakdown by main product category">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b bg-muted/40 font-bold uppercase text-muted-foreground">
                        <th className="px-4 py-3">Category Name</th>
                        <th className="px-4 py-3">Items Sold</th>
                        <th className="px-4 py-3">Total Sales</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {data.categorySales.length ? (
                        data.categorySales.map((c, idx) => (
                          <tr key={`cat-${idx}`} className="hover:bg-muted/30">
                            <td className="px-4 py-3 font-semibold text-foreground">{c.name}</td>
                            <td className="px-4 py-3">{number(c.itemsSold)}</td>
                            <td className="px-4 py-3 font-bold text-primary">{money(c.sales)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="3" className="px-4 py-8 text-center text-muted-foreground">
                            No category distribution data.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </SectionCard>
            </div>
          </TabsContent>

          {/* TAB 3: GST REPORT (18%) */}
          <TabsContent value="gst" className="space-y-6">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <KpiCard label="Taxable Sales Amount" value={money(summary.taxableAmount)} icon={FileText} tone="primary" />
              <KpiCard label="Total GST (18%)" value={money(summary.totalGst)} icon={IndianRupee} tone="success" />
              <KpiCard label="CGST (9%)" value={money(summary.cgst)} icon={Percent} tone="warning" />
              <KpiCard label="SGST (9%)" value={money(summary.sgst)} icon={Percent} tone="warning" />
            </div>

            <SectionCard
              title="GST Compliance & B2B Tax Ledger"
              description="Gross Taxable Value, CGST, SGST, and IGST breakup for Form GSTR-1 return filing"
            >
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b bg-muted/40 font-bold uppercase text-muted-foreground">
                      <th className="px-4 py-3">Date / Period</th>
                      <th className="px-4 py-3">Gross Invoice Amount</th>
                      <th className="px-4 py-3">Taxable Value</th>
                      <th className="px-4 py-3">Total GST (18%)</th>
                      <th className="px-4 py-3">CGST (9%)</th>
                      <th className="px-4 py-3">SGST (9%)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {data.daily.length ? (
                      data.daily.map((row) => {
                        const taxable = Math.round(row.sales * 0.8475);
                        const gst = Math.round(row.sales * 0.1525);
                        const halfGst = Math.round(gst / 2);
                        return (
                          <tr key={`gst-${row._id}`} className="hover:bg-muted/30">
                            <td className="px-4 py-3 font-semibold">{row._id}</td>
                            <td className="px-4 py-3 font-bold">{money(row.sales)}</td>
                            <td className="px-4 py-3">{money(taxable)}</td>
                            <td className="px-4 py-3 font-bold text-emerald-700">{money(gst)}</td>
                            <td className="px-4 py-3">{money(halfGst)}</td>
                            <td className="px-4 py-3">{money(halfGst)}</td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan="6" className="px-4 py-8 text-center text-muted-foreground">
                          No GST transaction data for this period.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          </TabsContent>

          {/* TAB 4: TDS REPORT (Section 194-O) */}
          <TabsContent value="tds" className="space-y-6">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <KpiCard label="Gross Trade Subject to TDS" value={money(summary.totalSales)} icon={IndianRupee} tone="primary" />
              <KpiCard label="Total TDS Deducted (1%)" value={money(summary.totalTds)} icon={Percent} tone="warning" />
              <KpiCard label="Section Applicable" value="Section 194-O" icon={FileText} tone="success" />
              <KpiCard label="Wholesalers Covered" value={number(data.tdsLedger.length)} icon={Building2} tone="primary" />
            </div>

            <SectionCard
              title="TDS Deduction Ledger (Form 26Q)"
              description="1% TDS deducted at source under Section 194-O on e-commerce transactions for wholesaler PANs"
            >
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b bg-muted/40 font-bold uppercase text-muted-foreground">
                      <th className="px-4 py-3">Wholesaler Name</th>
                      <th className="px-4 py-3">PAN Number</th>
                      <th className="px-4 py-3">GSTIN</th>
                      <th className="px-4 py-3">Gross Sales</th>
                      <th className="px-4 py-3">TDS Deducted (1%)</th>
                      <th className="px-4 py-3">Net Remitted</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {data.tdsLedger.length ? (
                      data.tdsLedger.map((row) => (
                        <tr key={`tds-${row.id}`} className="hover:bg-muted/30">
                          <td className="px-4 py-3 font-semibold text-foreground">{row.name}</td>
                          <td className="px-4 py-3 font-mono text-muted-foreground">{row.pan}</td>
                          <td className="px-4 py-3 font-mono text-muted-foreground">{row.gstin}</td>
                          <td className="px-4 py-3 font-bold">{money(row.grossTrade)}</td>
                          <td className="px-4 py-3 font-bold text-amber-700">{money(row.tdsDeducted)}</td>
                          <td className="px-4 py-3 font-bold text-emerald-700">{money(row.netPayable)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="6" className="px-4 py-8 text-center text-muted-foreground">
                          No TDS ledger records found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          </TabsContent>

          {/* TAB 5: TOP EARNERS & BUYERS */}
          <TabsContent value="earners" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <SectionCard title="🏆 Top Wholesalers (Earners Leaderboard)" description="Highest earning wholesalers by gross trade volume">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b bg-muted/40 font-bold uppercase text-muted-foreground">
                        <th className="px-4 py-3">Rank & Name</th>
                        <th className="px-4 py-3">Orders</th>
                        <th className="px-4 py-3">Gross GMV</th>
                        <th className="px-4 py-3">Net Earnings</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {data.topWholesalers.length ? (
                        data.topWholesalers.map((w, idx) => (
                          <tr key={`w-${w.id}`} className="hover:bg-muted/30">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <span className="flex size-5 items-center justify-center rounded-full bg-amber-100 text-[10px] font-extrabold text-amber-800">
                                  #{idx + 1}
                                </span>
                                <div>
                                  <p className="font-bold text-foreground">{w.name}</p>
                                  <p className="text-[10px] text-muted-foreground">{w.email}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 font-semibold">{number(w.totalOrders)}</td>
                            <td className="px-4 py-3 font-bold">{money(w.totalSales)}</td>
                            <td className="px-4 py-3 font-bold text-emerald-700">{money(w.netEarnings)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="4" className="px-4 py-8 text-center text-muted-foreground">
                            No top wholesalers data.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </SectionCard>

              <SectionCard title="🛒 Top Retailers (Highest Buyers)" description="Top commercial retail stores by total order spend">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b bg-muted/40 font-bold uppercase text-muted-foreground">
                        <th className="px-4 py-3">Rank & Retailer Name</th>
                        <th className="px-4 py-3">Orders Placed</th>
                        <th className="px-4 py-3">Total Spend</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {data.topRetailers.length ? (
                        data.topRetailers.map((r, idx) => (
                          <tr key={`r-${r.id}`} className="hover:bg-muted/30">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <span className="flex size-5 items-center justify-center rounded-full bg-blue-100 text-[10px] font-extrabold text-blue-800">
                                  #{idx + 1}
                                </span>
                                <div>
                                  <p className="font-bold text-foreground">{r.name}</p>
                                  <p className="text-[10px] text-muted-foreground">{r.email}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 font-semibold">{number(r.totalOrders)}</td>
                            <td className="px-4 py-3 font-bold text-primary">{money(r.totalSpent)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="3" className="px-4 py-8 text-center text-muted-foreground">
                            No top retailers data.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </SectionCard>
            </div>
          </TabsContent>

          {/* TAB 6: PAYOUTS REPORT */}
          <TabsContent value="payouts" className="space-y-6">
            <SectionCard title="Wholesaler Bank Payout Transactions" description="Settlement & payout disbursements to wholesaler bank accounts">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b bg-muted/40 font-bold uppercase text-muted-foreground">
                      <th className="px-4 py-3">Reference ID</th>
                      <th className="px-4 py-3">Wholesaler</th>
                      <th className="px-4 py-3">Amount</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {data.payouts.length ? (
                      data.payouts.map((p) => (
                        <tr key={p.id} className="hover:bg-muted/30">
                          <td className="px-4 py-3 font-mono font-bold text-foreground">{p.referenceId}</td>
                          <td className="px-4 py-3 font-semibold">{p.wholesaler}</td>
                          <td className="px-4 py-3 font-bold text-emerald-700">{money(p.amount)}</td>
                          <td className="px-4 py-3">
                            <StatusBadge status={p.status} />
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {p.createdAt ? new Date(p.createdAt).toLocaleDateString("en-IN") : "—"}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="5" className="px-4 py-8 text-center text-muted-foreground">
                          No payout transactions found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
