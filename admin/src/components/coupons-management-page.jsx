import { useEffect, useState } from "react";
import {
  Tag,
  Plus,
  Search,
  Download,
  RefreshCw,
  MoreHorizontal,
  Copy,
  Check,
  Percent,
  IndianRupee,
  Calendar,
  Sparkles,
  Zap,
  ShieldCheck,
  Gift,
  AlertCircle,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Edit3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmationModal } from "@/components/ui/confirmation-modal";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { KpiCard, PageHeader, StatusBadge } from "@/components/admin-ui";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api";
import { toast } from "sonner";

const blankForm = {
  code: "",
  title: "",
  description: "",
  discountType: "PERCENTAGE",
  discountValue: "50",
  maxDiscount: "2000",
  minPlanAmount: "500",
  usageLimit: "500",
  validUntil: "",
  applicableFor: "WHOLESALER_SUBSCRIPTION",
};

const initial = {
  items: [],
  pagination: { page: 1, limit: 10, total: 0, totalPages: 1 },
};

export function CouponsManagementPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [result, setResult] = useState(initial);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Modals
  const [editing, setEditing] = useState(null); // null or { create: true } or { id: string, ... }
  const [form, setForm] = useState(blankForm);
  const [confirmation, setConfirmation] = useState(null);
  const [saving, setSaving] = useState(false);
  const [copiedCode, setCopiedCode] = useState(null);

  useEffect(() => {
    let mounted = true;
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (status !== "all") params.set("status", status);

    setLoading(true);
    setError(null);

    apiGet(`/admin/coupons?${params.toString()}`)
      .then((payload) => {
        if (mounted) {
          setResult(payload || initial);
        }
      })
      .catch((err) => {
        if (mounted) setError(err.message || "Failed to load coupons");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [search, status, refreshKey]);

  const refresh = () => setRefreshKey((prev) => prev + 1);

  const handleCopyCode = (code) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast.success(`Coupon code ${code} copied!`);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.code.trim() || !form.title.trim() || !form.discountValue) {
      toast.error("Code, Title, and Discount Value are required");
      return;
    }

    setSaving(true);
    try {
      if (editing?.create) {
        await apiPost("/admin/coupons", form);
        toast.success(`Coupon ${form.code.toUpperCase()} created successfully!`);
      } else {
        await apiPatch(`/admin/coupons/${editing.id}`, form);
        toast.success(`Coupon ${form.code.toUpperCase()} updated successfully!`);
      }
      setEditing(null);
      setForm(blankForm);
      refresh();
    } catch (err) {
      toast.error(err.message || "Unable to save coupon code");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (row) => {
    try {
      await apiPatch(`/admin/coupons/${row.id}/status`, { isActive: !row.isActive });
      toast.success(`Coupon ${row.code} is now ${!row.isActive ? "ACTIVE" : "INACTIVE"}`);
      refresh();
    } catch (err) {
      toast.error(err.message || "Failed to update coupon status");
    }
  };

  const handleDelete = async () => {
    if (!confirmation?.id) return;
    setSaving(true);
    try {
      await apiDelete(`/admin/coupons/${confirmation.id}`);
      toast.success(`Coupon ${confirmation.code} deleted`);
      setConfirmation(null);
      refresh();
    } catch (err) {
      toast.error(err.message || "Failed to delete coupon");
    } finally {
      setSaving(false);
    }
  };

  const exportCsv = () => {
    const esc = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const csv = [
      ["Code", "Title", "Discount Type", "Value", "Min Plan Amount", "Max Cap", "Redemptions", "Status", "Created At"],
      ...result.items.map((row) => [
        row.code,
        row.title,
        row.discountType,
        row.discountType === "PERCENTAGE" ? `${row.discountValue}%` : `₹${row.discountValue}`,
        `₹${row.minPlanAmount}`,
        row.maxDiscount ? `₹${row.maxDiscount}` : "No Cap",
        `${row.usedCount} / ${row.usageLimit}`,
        row.isActive ? "Active" : "Inactive",
        row.createdAt,
      ]),
    ]
      .map((row) => row.map(esc).join(","))
      .join("\r\n");

    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "coupons_offers.csv";
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Coupons exported to CSV");
  };

  const money = (val) => `₹${Number(val || 0).toLocaleString("en-IN")}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Coupons"
        description="Manage promotional codes and discounts for wholesalers."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={exportCsv}>
              <Download className="size-4 mr-1.5" /> Export
            </Button>
            <Button variant="outline" onClick={refresh}>
              <RefreshCw className="size-4 mr-1.5" /> Refresh
            </Button>
            <Button
              className="bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
              onClick={() => {
                setForm(blankForm);
                setEditing({ create: true });
              }}
            >
              <Plus className="size-4 mr-1.5" /> Add Coupon
            </Button>
          </div>
        }
      />

      {/* KPI Banner Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Active Coupon Offers"
          value={String(result.items.filter((c) => c.isActive).length)}
          icon={Tag}
          tone="primary"
        />
        <KpiCard
          label="Wholesaler Plan Redemptions"
          value={String(result.items.reduce((acc, c) => acc + (c.usedCount || 0), 0))}
          icon={Zap}
          tone="success"
        />
        <KpiCard
          label="Default Promo Code"
          value="WELCOME50"
          icon={Sparkles}
          tone="warning"
        />
        <KpiCard
          label="Max Discount Offer"
          value="70% OFF"
          icon={Gift}
          tone="primary"
        />
      </div>

      {/* Colorful Featured Coupon Banner Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {result.items.slice(0, 3).map((coupon, idx) => {
          const bgGradients = [
            "from-green-700 to-green-900 text-white",
            "from-amber-300 to-amber-500 text-tradeflow-navy",
            "from-tradeflow-navy to-tradeflow-navy-hover text-white",
          ];
          const grad = bgGradients[idx % bgGradients.length];

          return (
            <div
              key={coupon.id}
              className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${grad} p-5 shadow-lg transition-transform hover:-translate-y-1`}
            >
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-white/20 px-3 py-1 text-[10px] font-extrabold uppercase backdrop-blur-xs">
                  {coupon.applicableFor === "WHOLESALER_SUBSCRIPTION" ? "Wholesaler Subscription" : "All Plans"}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopyCode(coupon.code)}
                  className="inline-flex items-center gap-1 rounded-lg bg-white/25 px-2.5 py-1 text-xs font-bold hover:bg-white/40 transition"
                  title="Copy code"
                >
                  {copiedCode === coupon.code ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                  <span>{copiedCode === coupon.code ? "COPIED" : "COPY"}</span>
                </button>
              </div>

              <div className="mt-4 space-y-1">
                <div className="text-3xl font-black tracking-tight drop-shadow-xs">{coupon.code}</div>
                <div className="text-sm font-bold opacity-95">{coupon.title}</div>
                <p className="text-xs opacity-80 line-clamp-2">{coupon.description}</p>
              </div>

              <div className="mt-5 flex items-center justify-between border-t border-white/20 pt-3 text-xs">
                <div>
                  <span className="opacity-75 block text-[10px] font-semibold uppercase">Discount</span>
                  <span className="text-base font-black">
                    {coupon.discountType === "PERCENTAGE" ? `${coupon.discountValue}% OFF` : money(coupon.discountValue)}
                  </span>
                </div>
                <div className="text-right">
                  <span className="opacity-75 block text-[10px] font-semibold uppercase">Status</span>
                  <span className="font-extrabold">{coupon.isActive ? "ACTIVE" : "INACTIVE"}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Coupon List Table Section */}
      <section className="admin-card overflow-hidden">
        <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search coupons..."
              className="pl-9"
            />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-full lg:w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading coupons...</div>
        ) : error ? (
          <div className="p-8 text-center text-sm text-destructive">{error}</div>
        ) : result.items.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">No coupon codes found.</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 font-bold uppercase text-xs text-muted-foreground">
                  <TableHead>Code & Title</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Discount Value</TableHead>
                  <TableHead>Min. Plan Price</TableHead>
                  <TableHead>Max Cap</TableHead>
                  <TableHead>Redemptions</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.items.map((row) => (
                  <TableRow key={row.id} className="hover:bg-muted/30 text-xs">
                    <TableCell>
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-extrabold text-sm text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-md">
                            {row.code}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyCode(row.code)}
                            className="text-gray-400 hover:text-gray-600"
                            title="Copy Code"
                          >
                            <Copy className="size-3.5" />
                          </button>
                        </div>
                        <p className="font-semibold text-gray-800">{row.title}</p>
                        <p className="text-[10px] text-gray-500 line-clamp-1">{row.description}</p>
                      </div>
                    </TableCell>

                    <TableCell>
                      <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[10px] font-bold text-gray-700">
                        {row.discountType === "PERCENTAGE" ? "% Percentage" : "₹ Flat Off"}
                      </span>
                    </TableCell>

                    <TableCell className="font-extrabold text-sm text-emerald-700">
                      {row.discountType === "PERCENTAGE" ? `${row.discountValue}% OFF` : money(row.discountValue)}
                    </TableCell>

                    <TableCell className="font-semibold text-gray-700">
                      {row.minPlanAmount ? money(row.minPlanAmount) : "None (Any)"}
                    </TableCell>

                    <TableCell className="font-semibold text-gray-700">
                      {row.maxDiscount ? money(row.maxDiscount) : "No Cap"}
                    </TableCell>

                    <TableCell className="font-semibold">
                      <span className="text-gray-800">{row.usedCount}</span>
                      <span className="text-gray-400"> / {row.usageLimit || "∞"}</span>
                    </TableCell>

                    <TableCell>
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(row)}
                        className="inline-flex items-center gap-1 focus:outline-none"
                      >
                        {row.isActive ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-extrabold text-emerald-800 border border-emerald-200">
                            <Check className="size-3" /> Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-[10px] font-extrabold text-gray-600 border border-gray-200">
                            Inactive
                          </span>
                        )}
                      </button>
                    </TableCell>

                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setForm({
                              code: row.code,
                              title: row.title,
                              description: row.description || "",
                              discountType: row.discountType || "PERCENTAGE",
                              discountValue: String(row.discountValue || ""),
                              maxDiscount: String(row.maxDiscount || "0"),
                              minPlanAmount: String(row.minPlanAmount || "0"),
                              usageLimit: String(row.usageLimit || "1000"),
                              validUntil: row.validUntil ? row.validUntil.substring(0, 10) : "",
                              applicableFor: row.applicableFor || "WHOLESALER_SUBSCRIPTION",
                            });
                            setEditing({ id: row.id });
                          }}
                          title="Edit Coupon"
                        >
                          <Edit3 className="size-4 text-gray-600 hover:text-primary" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:bg-red-50"
                          onClick={() => setConfirmation({ id: row.id, code: row.code })}
                          title="Delete Coupon"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      {/* CREATE / EDIT COUPON MODAL */}
      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && !saving && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2">
              <Sparkles className="size-5 text-primary" />
              <span>{editing?.create ? "Create Coupon Code & Offer" : `Edit Coupon: ${editing?.code || ""}`}</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              Configure promo discount code for Wholesaler Subscription plan checkout.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-gray-700 mb-1">Coupon Code *</label>
                <Input
                  required
                  placeholder="e.g. WELCOME50, FESTIVE200"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  className="font-mono font-bold uppercase bg-background"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Discount Type *</label>
                <Select
                  value={form.discountType}
                  onValueChange={(val) => setForm({ ...form, discountType: val })}
                >
                  <SelectTrigger className="bg-background font-bold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PERCENTAGE">Percentage (%)</SelectItem>
                    <SelectItem value="FLAT">Flat Amount (₹)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="block font-bold text-gray-700 mb-1">Offer Title *</label>
              <Input
                required
                placeholder="Offer title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="bg-background"
              />
            </div>

            <div>
              <label className="block font-bold text-gray-700 mb-1">Description</label>
              <Input
                placeholder="Coupon description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="bg-background"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  {form.discountType === "PERCENTAGE" ? "Discount % *" : "Discount Amount (₹) *"}
                </label>
                <Input
                  type="number"
                  required
                  min="1"
                  placeholder={form.discountType === "PERCENTAGE" ? "50" : "200"}
                  value={form.discountValue}
                  onChange={(e) => setForm({ ...form, discountValue: e.target.value })}
                  className="bg-background font-bold text-success"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Max Cap (₹)</label>
                <Input
                  type="number"
                  placeholder="0 = No Cap"
                  value={form.maxDiscount}
                  onChange={(e) => setForm({ ...form, maxDiscount: e.target.value })}
                  className="bg-background"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Min Plan Amount (₹)</label>
                <Input
                  type="number"
                  placeholder="0 = Any Plan"
                  value={form.minPlanAmount}
                  onChange={(e) => setForm({ ...form, minPlanAmount: e.target.value })}
                  className="bg-background"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-gray-700 mb-1">Total Usage Limit</label>
                <Input
                  type="number"
                  placeholder="1000"
                  value={form.usageLimit}
                  onChange={(e) => setForm({ ...form, usageLimit: e.target.value })}
                  className="bg-background"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Expiry Date (Optional)</label>
                <Input
                  type="date"
                  value={form.validUntil}
                  onChange={(e) => setForm({ ...form, validUntil: e.target.value })}
                  className="bg-background"
                />
              </div>
            </div>

            <DialogFooter className="pt-2 border-t border-border">
              <Button type="button" variant="outline" onClick={() => setEditing(null)} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving} className="bg-primary text-primary-foreground hover:bg-primary/90">
                {saving ? "Saving..." : editing?.create ? "Add Coupon" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmationModal
        open={Boolean(confirmation)}
        title={`Delete Coupon Code ${confirmation?.code || ""}?`}
        description="This coupon code will be permanently deleted and will no longer be redeemable at checkout."
        confirmLabel="Delete"
        variant="destructive"
        onCancel={() => !saving && setConfirmation(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
