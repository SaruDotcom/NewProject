import { Category as CategoryIcon, ChevronRight } from "@mui/icons-material";
import { Link } from "@/lib/router";

type CategoryCardProps = {
  name: string;
  imageUrl?: string | undefined;
  description?: string;
  subcategories: string[];
  itemCount: number;
  badge?: string;
  actionLabel: string;
  animationDelay?: number;
};

export function CategoryCard({
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
    <Link
      to="/products"
      search={{ category: name }}
      aria-label={`Find ${name} trade products`}
      className="group relative flex h-full min-h-[320px] flex-col overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/45 hover:shadow-xl focus-visible:border-primary focus-visible:outline-none motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2"
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
          {itemCount} items
        </span>
        <h3 className="absolute inset-x-5 bottom-4 truncate whitespace-nowrap text-xl font-extrabold leading-tight text-primary-foreground sm:text-2xl">
          {name}
        </h3>
      </div>
      <div className="flex min-h-0 flex-1 flex-col p-4 sm:p-5">
        <p className="min-h-10 shrink-0 line-clamp-2 text-sm leading-5 text-muted-foreground">
          {description || "Trade products from your connected wholesaler."}
        </p>
        {hasSubcategories && (
          <div className="mt-3 h-[190px] shrink-0 overflow-y-auto rounded-md border border-border/70 bg-background/60 p-2">
            <ul className="space-y-1">
              {subcategories.map((subcategory) => (
                <li
                  key={subcategory}
                  className="truncate rounded px-2 py-1.5 text-xs font-medium text-muted-foreground"
                  title={subcategory}
                >
                  {subcategory}
                </li>
              ))}
            </ul>
          </div>
        )}
        <span className="mt-auto inline-flex w-fit items-center gap-1.5 pt-3 text-sm font-bold text-primary">
          <span className="border-b border-primary/35 pb-0.5 transition-colors group-hover:border-primary">
            {actionLabel}
          </span>
          <ChevronRight className="size-4 transition-transform duration-200 group-hover:translate-x-1" />
        </span>
      </div>
    </Link>
  );
}
