import { useEffect, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Download,
  Edit,
  FolderOpen,
  FolderTree,
  Image as ImageIcon,
  Layers,
  LayoutGrid,
  List,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  ShoppingBag,
  Sparkles,
  Tag,
  Trash2,
} from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce";
import { Button } from "@/components/ui/button";
import { ConfirmationModal } from "@/components/ui/confirmation-modal";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { KpiCard, PageHeader, StatusBadge } from "@/components/admin-ui";
import { CategoryCard } from "@/components/categories/category-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api";
import { toast } from "sonner";

const initial = {
  items: [],
  pagination: { page: 1, limit: 12, total: 0, totalPages: 1 },
  filters: { parents: [] },
};

export function CategoriesManagementPage() {
  const [viewMode, setViewMode] = useState("GRID"); // 'GRID' | 'TABLE'
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 350);
  const [parent, setParent] = useState("all");
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState("desc");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState(initial);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", parent: "", imageUrl: "", description: "" });
  const [confirmation, setConfirmation] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, parent]);

  useEffect(() => {
    let mounted = true;
    const params = new URLSearchParams({
      page: String(page),
      limit: viewMode === "GRID" ? "12" : "10",
      sortBy,
      sortOrder,
    });

    if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
    if (parent !== "all") params.set("parent", parent);

    setLoading(true);
    setError(null);

    apiGet(`/admin/categories?${params.toString()}`)
      .then((payload) => {
        if (!mounted) return;
        const rawItems = Array.isArray(payload)
          ? payload
          : payload?.items || payload?.data || [];
        const parentOptions = rawItems.map((c) => ({
          _id: String(c._id || c.id),
          name: c.name,
        }));
        const limitNum = viewMode === "GRID" ? 12 : 10;
        const pagination = payload?.pagination || payload?.meta || {
          page: 1,
          limit: limitNum,
          total: rawItems.length,
          totalPages: Math.ceil(rawItems.length / limitNum) || 1,
        };
        const filters = payload?.filters || { parents: parentOptions };
        setResult({ items: rawItems, pagination, filters });
      })
      .catch((err) => {
        if (mounted) setError(err.message || "Failed to load categories");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [debouncedSearch, parent, sortBy, sortOrder, page, viewMode, refreshKey]);

  const refresh = () => setRefreshKey((value) => value + 1);
  const filters = result.filters || initial.filters;
  const pages = Math.max(1, result.pagination.totalPages || 1);

  const save = async () => {
    if (!form.name.trim()) {
      toast.error("Category name is required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        parentId: form.parent || null,
        imageUrl: form.imageUrl.trim() || null,
        description: form.description.trim() || "",
      };

      if (editing.create) {
        await apiPost("/admin/categories", payload);
      } else {
        await apiPatch(`/admin/categories/${editing.id}`, payload);
      }
      toast.success(editing.create ? "Category created successfully" : "Category updated successfully");
      setEditing(null);
      refresh();
    } catch (err) {
      toast.error(err.message || "Unable to save category");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setSaving(true);
    try {
      await apiDelete(`/admin/categories/${confirmation.id}`);
      toast.success("Category deleted successfully");
      setConfirmation(null);
      refresh();
    } catch (err) {
      toast.error(err.message || "Unable to delete category");
    } finally {
      setSaving(false);
    }
  };

  const exportCsv = () => {
    const esc = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const csv = [
      ["Category Name", "Parent Category", "Subcategories Count", "Products Count", "Image URL", "Description", "Created Date"],
      ...result.items.map((row) => [
        row.name,
        row.parent?.name || "Root",
        row.subcategories || 0,
        row.products || row.productCount || 0,
        row.imageUrl || "",
        row.description || "",
        row.createdAt ? new Date(row.createdAt).toLocaleDateString("en-IN") : "",
      ]),
    ]
      .map((row) => row.map(esc).join(","))
      .join("\r\n");

    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "categories.csv";
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Categories exported successfully");
  };

  const openEdit = (row) => {
    setForm({
      name: row.name || "",
      parent: row.parent?._id || row.parentId || "",
      imageUrl: row.imageUrl || "",
      description: row.description || "",
    });
    setEditing({ id: row._id || row.id, name: row.name });
  };

  const openAdd = () => {
    setForm({ name: "", parent: "", imageUrl: "", description: "" });
    setEditing({ create: true });
  };

  // Compute KPI metrics
  const totalCategories = result.pagination.total || result.items.length;
  const rootCategoriesCount = result.items.filter((c) => !c.parent && !c.parentId).length;
  const totalSubcategoriesCount = result.items.reduce((acc, c) => acc + (c.subcategories || 0), 0);
  const totalProductsCount = result.items.reduce((acc, c) => acc + (c.products || c.productCount || 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Categories"
        description="Organize marketplace categories and hierarchy."
        action={
          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex items-center rounded-xl border bg-card p-1">
              <Button
                variant={viewMode === "GRID" ? "secondary" : "ghost"}
                size="sm"
                className="h-8 px-2.5 text-xs font-bold"
                onClick={() => setViewMode("GRID")}
                title="Grid View"
              >
                <LayoutGrid className="mr-1.5 size-3.5" /> Grid
              </Button>
              <Button
                variant={viewMode === "TABLE" ? "secondary" : "ghost"}
                size="sm"
                className="h-8 px-2.5 text-xs font-bold"
                onClick={() => setViewMode("TABLE")}
                title="Table View"
              >
                <List className="mr-1.5 size-3.5" /> Table
              </Button>
            </div>

            <Button variant="outline" size="sm" onClick={exportCsv}>
              <Download className="mr-1.5 size-3.5" /> Export
            </Button>
            <Button variant="outline" size="sm" onClick={refresh}>
              <RefreshCw className="mr-1.5 size-3.5" /> Refresh
            </Button>
            <Button size="sm" className="font-extrabold" onClick={openAdd}>
              <Plus className="mr-1.5 size-4" /> Add Category
            </Button>
          </div>
        }
      />

      {/* KPI Cards Header */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Total Categories" value={String(totalCategories)} icon={FolderTree} />
        <KpiCard label="Root Categories" value={String(rootCategoriesCount)} icon={FolderOpen} tone="primary" />
        <KpiCard label="Subcategories" value={String(totalSubcategoriesCount)} icon={Layers} tone="warning" />
        <KpiCard label="Assigned Products" value={String(totalProductsCount)} icon={ShoppingBag} tone="success" />
      </div>

      <section className="admin-card overflow-hidden">
        {/* Filters & Search Header */}
        <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search categories..."
              className="pl-9"
            />
          </div>

          <Select
            value={parent}
            onValueChange={(value) => {
              setParent(value);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-full lg:w-48">
              <SelectValue placeholder="Parent" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="root">Root only</SelectItem>
              {filters.parents.map((item) => (
                <SelectItem key={item._id} value={String(item._id)}>
                  {item.displayPath || item.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Loading / Error States */}
        {loading ? (
          <div className="p-12 text-center text-sm text-muted-foreground">Loading categories catalog...</div>
        ) : error ? (
          <div className="p-12 text-center text-sm text-destructive">{error}</div>
        ) : result.items.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground space-y-2">
            <FolderOpen className="mx-auto size-10 text-muted-foreground/60" />
            <p className="font-bold">No categories found.</p>
            <p className="text-xs text-muted-foreground">Try adjusting your search query or filter settings.</p>
          </div>
        ) : (
          <>
            {/* VIEW MODE 1: GRID CARDS VIEW WITH IMAGES */}
            {viewMode === "GRID" && (
              <div className="grid grid-cols-1 gap-5 p-5 sm:grid-cols-2 lg:grid-cols-3">
                {result.items.map((row, idx) => {
                  const isRoot = !row.parent && !row.parentId;
                  const subCount = row.subcategories || 0;
                  const prodCount = row.products || row.productCount || 0;
                  const categoryId = String(row._id || row.id || "");
                  const subcategories = result.items
                    .filter((candidate) => String(candidate.parentId?._id || candidate.parentId || "") === categoryId)
                    .map((candidate) => ({
                      id: String(candidate._id || candidate.id),
                      name: candidate.name,
                    }));

                  return (
                    <CategoryCard
                      key={String(row._id || row.id || idx)}
                      row={row}
                      isRoot={isRoot}
                      subCount={subCount}
                      prodCount={prodCount}
                      subcategories={subcategories}
                      onEdit={() => openEdit(row)}
                      onDelete={() => setConfirmation({ id: row._id || row.id, name: row.name })}
                    />
                  );
                })}
              </div>
            )}

            {/* VIEW MODE 2: TABLE VIEW */}
            {viewMode === "TABLE" && (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead>Category Image & Name</TableHead>
                      <TableHead>Parent Category</TableHead>
                      <TableHead>Subcategories</TableHead>
                      <TableHead>Products</TableHead>
                      <TableHead>Created Date</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.items.map((row, idx) => {
                      const prodCount = row.products || row.productCount || 0;
                      const subCount = row.subcategories || 0;

                      return (
                        <TableRow key={String(row._id || row.id || idx)}>
                          <TableCell className="font-semibold">
                            <div className="flex items-center gap-3">
                              {row.imageUrl?.trim() ? (
                                <img
                                  src={row.imageUrl}
                                  alt={row.name}
                                  className="size-10 rounded-xl object-cover border bg-muted shrink-0"
                                  onError={(event) => {
                                    event.currentTarget.hidden = true;
                                  }}
                                />
                              ) : (
                                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border bg-muted text-muted-foreground">
                                  <Layers className="size-4" />
                                </div>
                              )}
                              <div>
                                <span className="font-bold text-foreground block">{row.name}</span>
                                {row.slug && <span className="text-[10px] font-mono text-muted-foreground">/{row.slug}</span>}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${
                                !row.parent && !row.parentId
                                  ? "bg-primary/10 text-primary"
                                  : "bg-tradeflow-sky-50 text-tradeflow-navy dark:bg-tradeflow-navy-hover dark:text-tradeflow-sky"
                              }`}
                            >
                              {row.parent?.name || "Root Category"}
                            </span>
                          </TableCell>
                          <TableCell className="font-bold">{subCount}</TableCell>
                          <TableCell className="font-bold">{prodCount}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {row.createdAt ? new Date(row.createdAt).toLocaleDateString("en-IN") : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" aria-label={`Actions for ${row.name}`}>
                                  <MoreHorizontal className="size-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onSelect={() => openEdit(row)}>
                                  <Edit className="mr-2 size-3.5" /> Edit
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive font-semibold"
                                  onSelect={() => setConfirmation({ id: row._id || row.id, name: row.name })}
                                >
                                  <Trash2 className="mr-2 size-3.5" /> Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </>
        )}

        {/* Pagination Footer */}
        <div className="flex items-center justify-between border-t px-4 py-3 text-xs text-muted-foreground">
          <span>
            Showing {result.items.length ? (page - 1) * (viewMode === "GRID" ? 12 : 10) + 1 : 0}-
            {Math.min(page * (viewMode === "GRID" ? 12 : 10), result.pagination.total)} of {result.pagination.total}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              disabled={page === 1 || loading}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              aria-label="Previous page"
            >
              <ChevronLeft className="size-4" />
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
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      </section>

      {/* Add / Edit Category Dialog Modal */}
      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && !saving && setEditing(null)}>
        <DialogContent className="max-w-md rounded-2xl p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle>{editing?.create ? "Add New Category" : `Edit Category: ${editing?.name}`}</DialogTitle>
            <DialogDescription>
              Configure category name, parent hierarchy, image banner URL, and description.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Category Name */}
            <div>
              <label className="block text-xs font-bold text-foreground mb-1">
                Category Name <span className="text-destructive">*</span>
              </label>
              <Input
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="Category name"
                required
              />
            </div>

            {/* Parent Category */}
            <div>
              <label className="block text-xs font-bold text-foreground mb-1">Parent Hierarchy</label>
              <Select
                value={form.parent || "none"}
                onValueChange={(value) => setForm((current) => ({ ...current, parent: value === "none" ? "" : value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose parent" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Root (No Parent)</SelectItem>
                  {filters.parents
                    .filter((item) => String(item._id) !== String(editing?.id))
                    .map((item) => (
                      <SelectItem key={item._id} value={String(item._id)}>
                        {item.displayPath || item.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* Category Image URL */}
            <div>
              <label className="block text-xs font-bold text-foreground mb-1 flex items-center justify-between">
                <span>Category Image URL</span>
                <span className="text-[10px] text-muted-foreground font-normal">Optional</span>
              </label>
              <Input
                value={form.imageUrl}
                onChange={(event) => setForm((current) => ({ ...current, imageUrl: event.target.value }))}
                placeholder="https://..."
              />
              {form.imageUrl && (
                <div className="mt-2 relative h-24 w-full rounded-xl overflow-hidden border bg-muted">
                  <img
                    src={form.imageUrl}
                    alt="Category Banner Preview"
                    className="h-full w-full object-cover"
                    onError={(event) => {
                      event.currentTarget.hidden = true;
                    }}
                  />
                  <span className="absolute bottom-1 right-2 text-[10px] bg-black/60 text-white px-2 py-0.5 rounded-md">
                    Banner Preview
                  </span>
                </div>
              )}
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-bold text-foreground mb-1">Description</label>
              <textarea
                rows={3}
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                placeholder="Category description..."
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 resize-none"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditing(null)} disabled={saving} className="rounded-xl">
              Cancel
            </Button>
            <Button onClick={save} disabled={saving} className="rounded-xl font-bold">
              {saving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Modal for Deletion */}
      <ConfirmationModal
        open={Boolean(confirmation)}
        title={`Delete ${confirmation?.name || "category"}?`}
        description="Categories with active products or subcategories cannot be deleted."
        confirmLabel="Delete"
        variant="destructive"
        onCancel={() => !saving && setConfirmation(null)}
        onConfirm={remove}
      />
    </div>
  );
}
