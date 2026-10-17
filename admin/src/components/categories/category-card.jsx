import {
  Edit,
  Layers,
  MoreHorizontal,
  ShoppingBag,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function CategoryCard({
  row,
  isRoot,
  subCount,
  prodCount,
  subcategories,
  onEdit,
  onDelete,
}) {
  const displayImage = row.imageUrl?.trim();
  const hasSubcategories = subCount > 0;

  return (
    <article className={`group relative flex ${hasSubcategories ? "h-[500px]" : "h-auto self-start"} flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xs transition-all duration-200 hover:-translate-y-1 hover:border-primary/40 hover:shadow-md`}>
      <div className="relative h-[120px] w-full shrink-0 overflow-hidden bg-muted">
        {displayImage && (
          <>
            <img
              src={displayImage}
              alt={row.name}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              onError={(event) => {
                event.currentTarget.hidden = true;
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          </>
        )}
        <div className="absolute left-3 top-3 flex items-center gap-1.5">
          <span
            className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider backdrop-blur-md ${
              isRoot
                ? "bg-primary/90 text-primary-foreground"
                : "bg-tradeflow-navy/90 text-white"
            }`}
          >
            {isRoot
              ? "Root Category"
              : `Sub of ${row.parent?.name || "Parent"}`}
          </span>
        </div>
        <div className="absolute right-3 top-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="secondary"
                size="icon"
                className="size-8 rounded-full bg-black/50 text-white backdrop-blur-md hover:bg-black/70"
                aria-label={`Actions for ${row.name}`}
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onSelect={onEdit}>
                <Edit className="mr-2 size-3.5" /> Edit Category
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="font-semibold text-destructive"
                onSelect={onDelete}
              >
                <Trash2 className="mr-2 size-3.5" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <h3 className={`absolute bottom-3 left-3 right-3 truncate whitespace-nowrap text-base font-black tracking-tight ${displayImage ? "text-white drop-shadow-sm" : "text-foreground"}`}>
          {row.name}
        </h3>
      </div>

      <div className="flex min-h-0 flex-1 flex-col p-4">
        <p className="h-10 shrink-0 line-clamp-2 text-xs text-muted-foreground">
          {row.description || "No category description provided."}
        </p>
        <div className="mt-3 grid h-11 shrink-0 grid-cols-2 gap-2 border-t pt-2 text-xs">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <ShoppingBag className="size-3.5 shrink-0 text-primary" />
            <div>
              <span className="block text-[10px] font-bold uppercase leading-none">
                Products
              </span>
              <span className="text-sm font-extrabold text-foreground">
                {prodCount}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Layers className="size-3.5 shrink-0 text-amber-500" />
            <div>
              <span className="block text-[10px] font-bold uppercase leading-none">
                Subcategories
              </span>
              <span className="text-sm font-extrabold text-foreground">
                {subCount}
              </span>
            </div>
          </div>
        </div>
        {hasSubcategories && (
          <div className="mt-3 h-[190px] shrink-0 overflow-y-auto rounded-lg border border-border/70 bg-background/60 p-2">
            {subcategories.length > 0 ? (
              <ul className="space-y-1">
                {subcategories.map((subcategory) => (
                  <li
                    key={subcategory.id}
                    className="truncate rounded px-2 py-1.5 text-xs font-medium text-muted-foreground"
                  >
                    {subcategory.name}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="flex h-full items-center justify-center text-center text-xs text-muted-foreground">
                {subCount} subcategories
              </p>
            )}
          </div>
        )}
        <Button
          variant="outline"
          size="sm"
          className="mt-auto w-full rounded-xl text-xs font-bold hover:bg-accent hover:text-primary"
          onClick={onEdit}
        >
          <Edit className="mr-1.5 size-3.5" /> Manage & Edit
        </Button>
      </div>
    </article>
  );
}
