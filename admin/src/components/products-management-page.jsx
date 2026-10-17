import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Download, MoreHorizontal, PackageSearch, Plus, RefreshCw, Search } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useDebounce } from "@/hooks/use-debounce";
import { Button } from "@/components/ui/button";
import { ConfirmationModal } from "@/components/ui/confirmation-modal";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader, StatusBadge } from "@/components/admin-ui";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiDelete, apiGet, apiPost, apiPatch } from "@/lib/api";
import { adminQueryKeys } from "@/lib/query-client";
import { toast } from "sonner";

const blank = { wholesaler: "", category: "", name: "", description: "", sku: "", unit: "", mrp: "", wholesalePrice: "", minOrderQty: "1", quantity: "0", lowStockThreshold: "10", imageUrl: "", status: "active" };
const labels = { active: "Active", inactive: "Inactive" };
const initial = { items: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 1 }, filters: { wholesalers: [], categories: [] } };

function ProductThumbnail({ product }) {
    const [imageFailed, setImageFailed] = useState(false);
    const image = product.imageUrl || product.images?.[0];
    return (
      <span className="mr-2 inline-flex size-9 shrink-0 items-center justify-center overflow-hidden rounded bg-muted align-middle">
        {image && !imageFailed ? (
          <img
            src={image}
            alt={product.name || "Product"}
            onError={() => setImageFailed(true)}
            className="size-full object-cover"
          />
        ) : (
          <PackageSearch className="size-4 text-muted-foreground" />
        )}
      </span>
    );
}

export function ProductsManagementPage() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [search, setSearch] = useState(""); const debouncedSearch = useDebounce(search, 350);
    const [status, setStatus] = useState("all"); const [wholesaler, setWholesaler] = useState("all"); const [category, setCategory] = useState("all"); const [dateFrom, setDateFrom] = useState(""); const [dateTo, setDateTo] = useState(""); const [sortBy, setSortBy] = useState("createdAt"); const [sortOrder, setSortOrder] = useState("desc"); const [page, setPage] = useState(1);
    const params = new URLSearchParams({ page: String(page), limit: "10", sortBy, sortOrder }); if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim()); if (status !== "all") params.set("status", status); if (wholesaler !== "all") params.set("wholesaler", wholesaler); if (category !== "all") params.set("category", category); if (dateFrom) params.set("dateFrom", dateFrom); if (dateTo) params.set("dateTo", dateTo);
    const listPath = `/admin/products?${params.toString()}`;
    const productsQuery = useQuery({
      queryKey: adminQueryKeys.collection("products", listPath),
      queryFn: async () => {
        const payload = await apiGet(listPath);
        const items = Array.isArray(payload) ? payload : (payload?.items || payload?.data || []);
        const pagination = payload?.pagination || payload?.meta || { page: 1, limit: 10, total: items.length, totalPages: Math.ceil(items.length / 10) || 1 };
        return { items, pagination, filters: payload?.filters || initial.filters };
      },
    });
    const result = productsQuery.data || initial;
    const loading = productsQuery.isLoading;
    const error = productsQuery.error?.message || null;
    const [editing, setEditing] = useState(null); const [form, setForm] = useState(blank); const [confirmation, setConfirmation] = useState(null); const [saving, setSaving] = useState(false);
    useEffect(() => setPage(1), [debouncedSearch, status, wholesaler, category, dateFrom, dateTo]);
    const refresh = async () => {
      await queryClient.invalidateQueries({ queryKey: adminQueryKeys.requestResource("products") });
      await productsQuery.refetch();
    };
    const openCreate = () => { setForm(blank); setEditing({ create: true }); };
    const openEdit = async (row) => { try { const payload = await apiGet(`/admin/products/${row._id || row.id}`); setForm({ ...blank, ...payload }); setEditing({ id: row._id || row.id }); } catch (err) { toast.error(err.message || "Unable to load product"); } };
    const save = async () => { const required = ["wholesaler", "name", "sku", "unit", "mrp", "wholesalePrice"]; if (required.some((key) => !String(form[key] ?? "").trim())) { toast.error("Wholesaler, name, SKU, unit, MRP, and wholesale price are required"); return; } setSaving(true); try { if (editing.create) await apiPost("/admin/products", form); else await apiPatch(`/admin/products/${editing.id}`, form); toast.success(editing.create ? "Product created successfully" : "Product updated successfully"); setEditing(null); refresh(); } catch (err) { toast.error(err.message || "Unable to save product"); } finally { setSaving(false); } };
    const runDelete = async () => { setSaving(true); try { await apiDelete(`/admin/products/${confirmation.id}`); toast.success("Product deleted successfully"); setConfirmation(null); refresh(); } catch (err) { toast.error(err.message || "Unable to delete product"); } finally { setSaving(false); } };
    const exportCsv = () => { const esc = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`; const csv = [["Product", "SKU", "Wholesaler", "Category", "Wholesale Price", "MRP", "Stock", "Status", "Created"], ...result.items.map((row) => [row.name, row.sku, row.wholesaler?.businessName || row.wholesaler?.name, row.category?.name, row.wholesalePrice, row.mrp, row.quantity, row.status, row.createdAt])].map((row) => row.map(esc).join(",")).join("\r\n"); const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); const link = document.createElement("a"); link.href = url; link.download = "products.csv"; link.click(); URL.revokeObjectURL(url); toast.success("Products exported"); };
    const toggleSort = (key) => { if (sortBy === key) setSortOrder((value) => value === "asc" ? "desc" : "asc"); else { setSortBy(key); setSortOrder("asc"); } setPage(1); };
    const filters = result.filters || initial.filters; const pages = Math.max(1, result.pagination.totalPages || 1); const money = (value) => `₹${Number(value || 0).toLocaleString("en-IN")}`; const fields = ["name", "businessName", "company", "email", "phone", "city", "state"];
    return (
      <div className="space-y-6">
        <PageHeader
          title="Product Management"
          description="Control catalog quality, stock visibility, and marketplace listings."
          action={
            <div className="flex gap-2">
              <Button variant="outline" onClick={exportCsv}>
                <Download /> Export
              </Button>
              <Button variant="outline" onClick={refresh}>
                <RefreshCw /> Refresh
              </Button>
              <Button onClick={openCreate}>
                <Plus /> Add Product
              </Button>
            </div>
          }
        />
        <section className="admin-card overflow-hidden">
          <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center lg:flex-wrap">
            <div className="relative min-w-56 flex-1">
              <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search product name or SKU..."
                className="pl-9"
              />
            </div>
            <Select
              value={status}
              onValueChange={(value) => {
                setStatus(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full lg:w-32">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {Object.entries(labels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={wholesaler}
              onValueChange={(value) => {
                setWholesaler(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full lg:w-44">
                <SelectValue placeholder="Wholesaler" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All wholesalers</SelectItem>
                {filters.wholesalers.map((item) => (
                  <SelectItem key={item.id} value={String(item.id)}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={category}
              onValueChange={(value) => {
                setCategory(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full lg:w-36">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {filters.categories.map((item) => (
                  <SelectItem key={item._id} value={String(item._id)}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={dateFrom}
              onChange={(event) => {
                setDateFrom(event.target.value);
                setPage(1);
              }}
              aria-label="Created from"
            />
            <Input
              type="date"
              value={dateTo}
              onChange={(event) => {
                setDateTo(event.target.value);
                setPage(1);
              }}
              aria-label="Created to"
            />
          </div>
          {loading ? (
            <div className="p-8 text-sm text-muted-foreground">
              Loading products...
            </div>
          ) : error ? (
            <div className="p-8 text-sm text-destructive">{error}</div>
          ) : result.items.length === 0 ? (
            <div className="p-8 text-sm text-muted-foreground">
              No products found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[1250px]">
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    {[
                      ["name", "Product"],
                      ["sku", "SKU"],
                      ["wholesaler", "Wholesaler"],
                      ["category", "Category"],
                      ["wholesalePrice", "Wholesale"],
                      ["mrp", "MRP"],
                      ["quantity", "Stock"],
                      ["status", "Status"],
                      ["createdAt", "Created"],
                    ].map(([key, label]) => (
                      <TableHead key={key}>
                        <button
                          className="inline-flex items-center gap-1"
                          onClick={() => toggleSort(key)}
                        >
                          {label}
                          {sortBy === key &&
                            (sortOrder === "asc" ? (
                              <ArrowUp className="size-3" />
                            ) : (
                              <ArrowDown className="size-3" />
                            ))}
                        </button>
                      </TableHead>
                    ))}
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.items.map((row) => (
                    <TableRow key={String(row._id || row.id)}>
                      <TableCell className="font-semibold">
                        <ProductThumbnail product={row} />
                        {row.name}
                      </TableCell>
                      <TableCell>{row.sku}</TableCell>
                      <TableCell>
                        {row.wholesaler?.businessName ||
                          row.wholesaler?.name ||
                          "—"}
                      </TableCell>
                      <TableCell>{row.category?.name || "—"}</TableCell>
                      <TableCell>{money(row.wholesalePrice)}</TableCell>
                      <TableCell>{money(row.mrp)}</TableCell>
                      <TableCell>{row.quantity ?? 0}</TableCell>
                      <TableCell>
                        <StatusBadge
                          status={labels[row.status] || row.status}
                        />
                      </TableCell>
                      <TableCell>
                        {row.createdAt
                          ? new Date(row.createdAt).toLocaleDateString("en-IN")
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Actions for ${row.name}`}
                            >
                              <MoreHorizontal />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onSelect={() =>
                                navigate({
                                  to: `/products/${row._id || row.id}`,
                                })
                              }
                            >
                              View details
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => openEdit(row)}>
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onSelect={() =>
                                setConfirmation({
                                  id: row._id || row.id,
                                  kind: "delete",
                                })
                              }
                            >
                              Delete
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onSelect={() => {
                                apiPatch(
                                  `/admin/products/${row._id || row.id}`,
                                  {
                                    status:
                                      row.status === "active"
                                        ? "inactive"
                                        : "active",
                                  },
                                )
                                  .then(() => {
                                    toast.success("Product status updated");
                                    refresh();
                                  })
                                  .catch((err) =>
                                    toast.error(
                                      err.message || "Unable to update status",
                                    ),
                                  );
                              }}
                            >
                              {row.status === "active"
                                ? "Deactivate"
                                : "Activate"}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <div className="flex items-center justify-between border-t px-4 py-3 text-xs text-muted-foreground">
            <span>
              Showing {result.items.length ? (page - 1) * 10 + 1 : 0}-
              {Math.min(page * 10, result.pagination.total)} of{" "}
              {result.pagination.total}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                disabled={page === 1 || loading}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
                aria-label="Previous page"
              >
                <ChevronLeft />
              </Button>
              <span>
                Page {page} of {pages}
              </span>
              <Button
                variant="outline"
                size="icon"
                disabled={page >= pages || loading}
                onClick={() => setPage((value) => Math.min(pages, value + 1))}
                aria-label="Next page"
              >
                <ChevronRight />
              </Button>
            </div>
          </div>
        </section>
        <Dialog
          open={Boolean(editing)}
          onOpenChange={(open) => !open && !saving && setEditing(null)}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editing?.create ? "Add product" : "Edit product"}
              </DialogTitle>
              <DialogDescription>
                Maintain product catalog and inventory data.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                "name",
                "sku",
                "unit",
                "mrp",
                "wholesalePrice",
                "minOrderQty",
                "quantity",
                "lowStockThreshold",
              ].map((field) => (
                <label
                  key={field}
                  className="grid gap-1 text-xs font-medium capitalize"
                >
                  {field}
                  <Input
                    type={
                      [
                        "mrp",
                        "wholesalePrice",
                        "minOrderQty",
                        "quantity",
                        "lowStockThreshold",
                      ].includes(field)
                        ? "number"
                        : "text"
                    }
                    value={form[field] || ""}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        [field]: event.target.value,
                      }))
                    }
                  />
                </label>
              ))}
              <label className="grid gap-1 text-xs font-medium sm:col-span-2">
                Wholesaler
                <Select
                  value={form.wholesaler}
                  onValueChange={(value) =>
                    setForm((current) => ({ ...current, wholesaler: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select active wholesaler" />
                  </SelectTrigger>
                  <SelectContent>
                    {filters.wholesalers.map((item) => (
                      <SelectItem key={item.id} value={String(item.id)}>
                        {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
              <label className="grid gap-1 text-xs font-medium sm:col-span-2">
                Category
                <Select
                  value={form.category || "none"}
                  onValueChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      category: value === "none" ? "" : value,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No category</SelectItem>
                    {filters.categories.map((item) => (
                      <SelectItem key={item._id} value={String(item._id)}>
                        {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setEditing(null)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button onClick={save} disabled={saving}>
                {saving ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <ConfirmationModal
          open={Boolean(confirmation)}
          title="Delete product?"
          description="This removes the product when no active orders reference it."
          confirmLabel="Delete"
          variant="destructive"
          onCancel={() => !saving && setConfirmation(null)}
          onConfirm={runDelete}
        />
      </div>
    );
}
