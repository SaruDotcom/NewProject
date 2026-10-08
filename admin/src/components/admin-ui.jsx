import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Download,
  Inbox,
  MoreHorizontal,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

/**
 * StatusBadge - Color coded badge for status display across all modules
 */
export function StatusBadge({ status, className }) {
  const norm = String(status || "").trim().toLowerCase();
  
  let tone = "bg-muted text-muted-foreground border-border";
  if (["active", "approved", "connected", "completed", "delivered", "paid", "published", "verified"].includes(norm)) {
    tone = "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20";
  } else if (["pending", "processing", "packed", "shipped", "draft", "under_review", "submitted"].includes(norm)) {
    tone = "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/25";
  } else if (["rejected", "blocked", "cancelled", "failed", "suspended", "inactive"].includes(norm)) {
    tone = "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20";
  }

  const label = status ? status.charAt(0).toUpperCase() + status.slice(1).toLowerCase() : "Unknown";

  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold tracking-wide transition-colors", tone, className)}>
      {label}
    </span>
  );
}

/**
 * PageHeader - Standard header section for all admin pages
 */
export function PageHeader({ title, description, action, className }) {
  return (
    <div className={cn("flex flex-col justify-between gap-4 sm:flex-row sm:items-center", className)}>
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {action && <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">{action}</div>}
    </div>
  );
}

/**
 * StatCard / KpiCard - Reusable metric card with icon, value, change indicator, and tone
 */
export function StatCard({
  label,
  value,
  change,
  icon: Icon,
  tone = "primary",
  subtext,
  onClick,
  className,
}) {
  const tones = {
    primary: "bg-primary/10 text-primary border-primary/20",
    success: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
    warning: "bg-amber-500/10 text-amber-700 border-amber-500/20",
    info: "bg-sky-500/10 text-sky-700 border-sky-500/20",
  };

  return (
    <article
      className={cn(
        "admin-card min-w-0 p-4.5 transition-all duration-200",
        onClick ? "cursor-pointer hover:border-primary/40 hover:shadow-md" : "",
        className
      )}
      onClick={onClick}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        {Icon && (
          <div className={cn("flex size-9 items-center justify-center rounded-lg border", tones[tone] || tones.primary)}>
            <Icon className="size-4.5" />
          </div>
        )}
      </div>

      <div className="mt-3 flex items-baseline justify-between gap-2">
        <p className="text-2xl font-bold tracking-tight text-foreground">{value}</p>
        {change && (
          <span
            className={cn(
              "inline-flex items-center text-xs font-bold",
              change.startsWith("-") ? "text-rose-600" : "text-emerald-600"
            )}
          >
            {change.startsWith("-") ? (
              <ArrowDown className="mr-0.5 size-3.5" />
            ) : (
              <ArrowUp className="mr-0.5 size-3.5" />
            )}
            {change.replace("-", "")}
          </span>
        )}
      </div>

      {subtext && <p className="mt-1 text-xs text-muted-foreground">{subtext}</p>}
    </article>
  );
}

export const KpiCard = StatCard;

/**
 * FilterBar - Search input and filter select wrapper for control bars
 */
export function FilterBar({
  search,
  onSearchChange,
  searchPlaceholder = "Search...",
  children,
  className,
}) {
  return (
    <div className={cn("flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center lg:flex-wrap", className)}>
      {onSearchChange !== undefined && (
        <div className="relative min-w-56 flex-1">
          <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <Input
            value={search || ""}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="pl-9 shadow-none text-sm"
          />
        </div>
      )}
      {children}
    </div>
  );
}

/**
 * EmptyState - Empty data indicator with icon and message
 */
export function EmptyState({
  icon: Icon = Inbox,
  title = "No data found",
  description = "There are no records matching your request.",
  action,
  className,
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center p-12 text-center", className)}>
      <div className="flex size-12 items-center justify-center rounded-full bg-muted/60 text-muted-foreground border">
        <Icon className="size-6" />
      </div>
      <h3 className="mt-4 text-sm font-semibold text-foreground">{title}</h3>
      <p className="mt-1 max-w-sm text-xs text-muted-foreground">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/**
 * UserAvatar - Small initial avatar badge for business/user names
 */
export function UserAvatar({ name = "", className }) {
  const initials = String(name || "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase() || "?";

  return (
    <div className={cn("flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs border border-primary/20", className)}>
      {initials}
    </div>
  );
}

/**
 * SectionCard - Container card for page sections
 */
export function SectionCard({
  title,
  description,
  action,
  children,
  className,
}) {
  return (
    <section className={cn("admin-card overflow-hidden", className)}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 border-b px-5 py-4 bg-muted/20">
          <div>
            {title && <h2 className="text-sm font-bold text-foreground">{title}</h2>}
            {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
          </div>
          {action}
        </div>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

/**
 * DataTable - Shared data table component
 */
export function DataTable({
  data = [],
  columns = [],
  searchKeys = [],
  filters = [],
  detailPath,
  pageSize = 8,
  bulk = true,
  initialFilter = "All",
  emptyTitle,
  emptyDescription,
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState(initialFilter);
  const [sort, setSort] = useState("");
  const [ascending, setAscending] = useState(true);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState([]);

  const rows = useMemo(() => {
    const normalized = query.toLowerCase();
    const result = data
      .filter((row) =>
        searchKeys.length === 0 ||
        searchKeys.some((key) =>
          String(row[key] || "").toLowerCase().includes(normalized)
        )
      )
      .filter(
        (row) =>
          filter === "All" ||
          Object.values(row).some((value) => String(value) === filter)
      );

    if (sort) {
      result.sort(
        (a, b) =>
          String(a[sort] ?? "").localeCompare(
            String(b[sort] ?? ""),
            undefined,
            { numeric: true }
          ) * (ascending ? 1 : -1)
      );
    }
    return result;
  }, [data, query, searchKeys, filter, sort, ascending]);

  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const visible = rows.slice((page - 1) * pageSize, page * pageSize);

  const toggleSort = (key) => {
    if (sort === key) setAscending(!ascending);
    else {
      setSort(key);
      setAscending(true);
    }
  };

  return (
    <section className="admin-card overflow-hidden">
      <FilterBar search={query} onSearchChange={(v) => { setQuery(v); setPage(1); }}>
        {filters.length > 0 && (
          <Select
            value={filter}
            onValueChange={(val) => {
              setFilter(val);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-full shadow-none lg:w-44 text-xs">
              <SlidersHorizontal className="size-3.5 text-muted-foreground mr-1.5" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["All", ...filters].map((item) => (
                <SelectItem key={item} value={item} className="text-xs">
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {selected.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              toast.success(`${selected.length} records updated`);
              setSelected([]);
            }}
          >
            Bulk action ({selected.length})
          </Button>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            toast.success("Report generated", {
              description: "Your CSV export is ready.",
            })
          }
        >
          <Download className="size-3.5 mr-1" /> Export
        </Button>
      </FilterBar>

      {rows.length === 0 ? (
        <EmptyState title={emptyTitle} description={emptyDescription} />
      ) : (
        <>
          <div className="overflow-x-auto fine-scrollbar">
            <Table className="min-w-[900px]">
              <TableHeader>
                <TableRow className="bg-muted/40">
                  {bulk && (
                    <TableHead className="w-10 pl-4">
                      <Checkbox
                        checked={
                          visible.length > 0 &&
                          visible.every((r) => selected.includes(r.id))
                        }
                        onCheckedChange={() =>
                          setSelected(
                            visible.every((r) => selected.includes(r.id))
                              ? []
                              : visible.map((r) => r.id)
                          )
                        }
                        aria-label="Select visible records"
                      />
                    </TableHead>
                  )}

                  {columns.map((column) => (
                    <TableHead
                      key={String(column.key)}
                      className={cn(
                        "whitespace-nowrap px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground",
                        column.className
                      )}
                    >
                      {column.sortable ? (
                        <button
                          className="inline-flex items-center gap-1 hover:text-foreground"
                          onClick={() => toggleSort(String(column.key))}
                        >
                          {column.label}
                          {sort === column.key &&
                            (ascending ? (
                              <ArrowUp className="size-3" />
                            ) : (
                              <ArrowDown className="size-3" />
                            ))}
                        </button>
                      ) : (
                        column.label
                      )}
                    </TableHead>
                  ))}
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((row) => (
                  <TableRow key={row.id} className="hover:bg-muted/30 transition-colors">
                    {bulk && (
                      <TableCell className="pl-4">
                        <Checkbox
                          checked={selected.includes(row.id)}
                          onCheckedChange={() =>
                            setSelected((current) =>
                              current.includes(row.id)
                                ? current.filter((id) => id !== row.id)
                                : [...current, row.id]
                            )
                          }
                          aria-label={`Select ${row.id}`}
                        />
                      </TableCell>
                    )}

                    {columns.map((column) => (
                      <TableCell
                        key={String(column.key)}
                        className={cn("whitespace-nowrap px-3 py-3 text-xs text-foreground", column.className)}
                      >
                        {column.render
                          ? column.render(row)
                          : String(row[column.key] ?? "")}
                      </TableCell>
                    ))}

                    <TableCell>
                      {detailPath ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          asChild
                          aria-label="View details"
                        >
                          <Link to={detailPath(row)}>
                            <MoreHorizontal className="size-4" />
                          </Link>
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="More actions"
                          onClick={() => toast("Actions opened")}
                        >
                          <MoreHorizontal className="size-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-col gap-3 border-t px-4 py-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <span>
              Showing {visible.length ? (page - 1) * pageSize + 1 : 0}–
              {Math.min(page * pageSize, rows.length)} of {rows.length}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                disabled={page === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
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
                disabled={page === pages}
                onClick={() => setPage((p) => Math.min(pages, p + 1))}
                aria-label="Next page"
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
