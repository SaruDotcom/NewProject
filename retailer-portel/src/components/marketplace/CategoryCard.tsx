import { Category as CategoryIcon, ChevronRight } from "@mui/icons-material";
import { Link } from "@/lib/router";

type CategoryCardProps = {
  categoryId: string;
  name: string;
  imageUrl?: string | undefined;
  description?: string;
  subcategories: Array<{ id: string; name: string; itemCount: number }>;
  itemCount: number;
  badge?: string;
  actionLabel: string;
  animationDelay?: number;
};

export function CategoryCard({
  categoryId,
  name,
  imageUrl,
  description,
  subcategories,
  itemCount,
  badge,
  actionLabel,
  animationDelay = 0,
}: CategoryCardProps) {
  const hasSubcategories = subcategories.length > 0;

  return (
    <article
      className="group flex h-full min-h-[280px] flex-col overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/45 hover:shadow-xl motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2"
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      <div className="relative h-40 shrink-0 overflow-hidden bg-gradient-to-br from-primary/20 via-accent to-secondary sm:h-48">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt=""
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="grid h-full place-items-center text-primary/50">
            <CategoryIcon className="size-16" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-ink/75 via-ink/5 to-transparent" />
        {badge && (
          <span className="absolute left-4 top-4 rounded-sm bg-primary px-2.5 py-1 text-[10px] font-bold uppercase text-primary-foreground">
            {badge}
          </span>
        )}
        <span className="absolute right-4 top-4 rounded-sm bg-card/95 px-2.5 py-1 text-[10px] font-bold text-ink">
          {itemCount} {itemCount === 1 ? "product" : "products"}
        </span>
        <Link
          to="/products"
          search={{ category: categoryId }}
          aria-label={`Find ${name} trade products`}
          className="absolute inset-x-5 bottom-4 truncate whitespace-nowrap text-xl font-extrabold leading-tight text-primary-foreground outline-none hover:underline focus-visible:underline sm:text-2xl"
        >
          {name}
        </Link>
      </div>
      <div className="flex min-h-0 flex-1 flex-col p-4 sm:p-5">
        <p className="line-clamp-2 min-h-10 shrink-0 text-sm leading-5 text-muted-foreground">
          {description || "Trade products from your connected wholesaler."}
        </p>
        {hasSubcategories && (
          <div className="mt-3 max-h-40 overflow-y-auto rounded-lg border border-border/70 bg-background/60 p-2">
            <ul className="grid gap-1 sm:grid-cols-2">
              {subcategories.map((subcategory) => (
                <li key={subcategory.id} className="min-w-0">
                  <Link
                    to="/products"
                    search={{ category: subcategory.id }}
                    className="flex min-w-0 items-center justify-between gap-2 rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    title={subcategory.name}
                  >
                    <span className="truncate">{subcategory.name}</span>
                    <span className="shrink-0 text-[10px] tabular-nums">{subcategory.itemCount}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
        <Link
          to="/products"
          search={{ category: categoryId }}
          className="mt-auto inline-flex w-fit items-center gap-1.5 pt-3 text-sm font-bold text-primary"
        >
          <span className="border-b border-primary/35 pb-0.5 transition-colors group-hover:border-primary">
            {actionLabel}
          </span>
          <ChevronRight className="size-4 transition-transform duration-200 group-hover:translate-x-1" />
        </Link>
      </div>
    </article>
  );
}
