import { useMemo, useState } from "react";
import { Link } from "@/lib/router";
import {
  ArrowRight,
  VerifiedUser,
  LocalShipping,
  Refresh,
  Verified,
  Category as CategoryIcon,
  Inventory2,
  WarningAmber,
  ChevronRight,
  FilterList,
} from "@mui/icons-material";
import { Button } from "@/components/ui/button";
import { useStore } from "@/state/store";
import { ProductGrid, SectionHeading } from "./primitives";
import { categoryImages } from "./storefront";
import { WholesalerBannerCarousel } from "./WholesalerBannerCarousel";
import { cn } from "@/lib/utils";

const trustSignals: Array<[typeof VerifiedUser, string, string]> = [
  [VerifiedUser, "Verified Supplier", "Authentic verified wholesale partner"],
  [LocalShipping, "Reliable Dispatch", "Direct dispatch to your retail store"],
  [Refresh, "Easy Reordering", "Fast repeat bulk orders & invoicing"],
  [Verified, "Direct Trade Rates", "Exclusive business-only trade pricing"],
];

export function HomePage() {
  const { recentlyViewed, linkedWholesaler, products, categories, storefrontError } = useStore();
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>("All");

  const activeStoreTheme = linkedWholesaler?.activeStoreTheme || "DEFAULT";
  const wholesalerBusinessName = linkedWholesaler?.businessName?.trim() || linkedWholesaler?.name?.trim() || "Wholesaler Store";

  // Filter products: strictly isolated to the linked wholesaler
  const wholesalerProducts = useMemo(() => {
    if (!linkedWholesaler) return [];
    const wsId = String(linkedWholesaler.id);
    return products.filter((p) => {
      const pWsId = String(p.wholesalerId || "");
      return pWsId === wsId;
    });
  }, [products, linkedWholesaler]);

  // Wholesaler categories
  const wholesalerCategories = useMemo(() => {
    return categories.filter((category) => !category.parentId);
  }, [categories]);

  // Filtered products based on active category pill
  const displayedProducts = useMemo(() => {
    if (selectedCategoryFilter === "All") return wholesalerProducts;
    return wholesalerProducts.filter((p) => {
      const pCat = String(p.category || "").toLowerCase();
      const targetCat = selectedCategoryFilter.toLowerCase();
      return pCat === targetCat || pCat.includes(targetCat);
    });
  }, [wholesalerProducts, selectedCategoryFilter]);

  const displayedCategorySections = useMemo(() => {
    const categoryNames = Array.from(
      new Set(displayedProducts.map((product) => product.category.trim() || "Other products")),
    );

    return categoryNames.map((category) => ({
      category,
      products: displayedProducts.filter(
        (product) => (product.category.trim() || "Other products") === category,
      ),
    }));
  }, [displayedProducts]);

  // Recently viewed products strictly for this wholesaler
  const recentlyViewedProducts = useMemo(() => {
    return wholesalerProducts.filter((p) => recentlyViewed.includes(p.id));
  }, [wholesalerProducts, recentlyViewed]);

  // Error State Handling (Requirement 6)
  if (storefrontError) {
    const isInvalidCode =
      storefrontError.toLowerCase().includes("invalid") ||
      storefrontError.toLowerCase().includes("not exist") ||
      storefrontError.toLowerCase().includes("not valid");

    return (
      <main className="shell py-16 sm:py-24">
        <section className="mx-auto max-w-lg rounded-3xl border border-destructive/20 bg-card p-8 sm:p-10 text-center shadow-xl">
          <div className="mx-auto mb-5 flex size-16 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
            <WarningAmber className="size-9" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-ink">
            {isInvalidCode ? "Invalid Invitation Link" : "Wholesaler Unavailable"}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            {storefrontError}
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button asChild size="lg" className="w-full sm:w-auto rounded-xl font-bold">
              <Link to="/login">Go to Login</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="w-full sm:w-auto rounded-xl font-semibold">
              <Link to="/products">Browse Marketplace</Link>
            </Button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="storefront-theme" data-store-theme={activeStoreTheme}>
      {/* 1. Dynamic Wholesaler Hero & Branding Banner */}
      <section className="storefront-hero relative min-h-[440px] sm:min-h-[480px] lg:min-h-[520px] overflow-hidden bg-ink">
        <WholesalerBannerCarousel />
        <div className="shell relative z-10 flex min-h-[440px] sm:min-h-[480px] lg:min-h-[520px] items-center py-10 sm:py-14">
          <div className="max-w-3xl text-primary-foreground text-center sm:text-left mx-auto sm:mx-0">
            <h1 className="text-3xl font-black leading-tight sm:text-5xl lg:text-6xl tracking-tight text-white drop-shadow-sm">
              Welcome to {wholesalerBusinessName}
            </h1>

            <div className="mt-7 flex flex-col sm:flex-row items-stretch sm:items-center justify-center sm:justify-start gap-3.5">
              <Button asChild size="lg" className="rounded-xl min-h-[46px] font-extrabold shadow-lg bg-emerald-600 hover:bg-emerald-700 text-white">
                <Link to="/products">
                  Shop Wholesale Products <ArrowRight className="size-4 ml-1" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="secondary" className="rounded-xl min-h-[46px] font-bold backdrop-blur">
                <Link to="/categories">Browse Categories</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Trust Signals Strip */}
      <section className="border-b bg-card">
        <div className="shell grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 py-4 sm:py-6">
          {trustSignals.map(([I, t, b]) => (
            <div key={t} className="flex items-center gap-2.5 sm:gap-3">
              <div className="flex size-9 sm:size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
                <I className="size-5" />
              </div>
              <div className="min-w-0">
                <b className="block text-xs sm:text-sm font-bold text-ink truncate">{t}</b>
                <span className="text-[10px] sm:text-xs text-muted-foreground truncate block">{b}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 3. Amazon / Flipkart-Style Category Rail */}
      <section className="bg-canvas py-8 sm:py-12 border-b border-border/60">
        <div className="shell">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <span className="inline-flex rounded-full bg-emerald-500/10 px-3 py-0.5 text-[10px] font-black uppercase tracking-[0.15em] text-emerald-700">
                EXPLORE COLLECTIONS
              </span>
              <h2 className="mt-1.5 text-xl font-black text-ink sm:text-2xl">Shop by Category</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Browse verified wholesale product categories from {wholesalerBusinessName}.
              </p>
            </div>
            {wholesalerCategories.length > 0 && (
              <Button asChild variant="ghost" size="sm" className="font-bold text-xs text-primary hover:text-primary min-h-[38px] shrink-0">
                <Link to="/categories" className="flex items-center gap-1">
                  View all <ChevronRight className="size-3.5" />
                </Link>
              </Button>
            )}
          </div>

          {/* Amazon / Flipkart Horizontal Scrolling Category Rail */}
          {wholesalerCategories.length > 0 ? (
            <div className="relative -mx-4 px-4 sm:mx-0 sm:px-0">
              <div
                className="flex items-center gap-3.5 sm:gap-5 overflow-x-auto pb-3 pt-1 scroll-smooth no-scrollbar snap-x snap-mandatory"
                role="list"
                aria-label="Wholesaler product categories"
              >
                {wholesalerCategories.map((category) => {
                  const categoryImg =
                    category.imageUrl ||
                    categoryImages[category.name] ||
                    categoryImages[category.name.toLowerCase()] ||
                    categoryImages["clothes"] ||
                    categoryImages["Grocery & Staples"] ||
                    "";

                  return (
                    <Link
                      key={category.id}
                      to="/products"
                      search={{ category: category.name }}
                      role="listitem"
                      aria-label={`Browse ${category.name} products`}
                      className="group flex flex-col items-center shrink-0 w-22 sm:w-28 snap-start text-center focus-visible:outline-none"
                    >
                      {/* Compact Circular / Rounded Card (Amazon / Flipkart App style) */}
                      <div className="relative size-18 sm:size-22 rounded-full overflow-hidden border-2 border-border/80 bg-white p-0.5 shadow-sm transition-all duration-300 group-hover:scale-105 group-hover:border-emerald-600 group-hover:shadow-md">
                        <img
                          src={categoryImg}
                          alt={category.name}
                          loading="lazy"
                          className="size-full rounded-full object-cover transition-transform duration-300 group-hover:scale-110"
                          onError={(event) => {
                            event.currentTarget.onerror = null;
                            event.currentTarget.src =
                              categoryImages[category.name] ||
                              categoryImages["clothes"] ||
                              categoryImages["Grocery & Staples"] ||
                              "";
                          }}
                        />
                      </div>
                      {/* Clear Category Name */}
                      <span className="mt-2 text-xs sm:text-sm font-extrabold text-ink group-hover:text-emerald-700 transition-colors line-clamp-2 text-center w-full">
                        {category.name}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border bg-card/60 p-8 text-center">
              <CategoryIcon className="size-8 text-muted-foreground/60 mb-2" />
              <h3 className="font-bold text-sm text-ink">No categories published yet</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {wholesalerBusinessName} has not published categories to their storefront yet.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* 4. Wholesaler Products Showcase (Amazon / Flipkart-Style Grid) */}
      <section className="bg-canvas py-10 sm:py-16">
        <div className="shell">
          <div className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <span className="inline-flex rounded-full bg-emerald-500/10 px-3 py-0.5 text-[10px] font-black uppercase tracking-[0.15em] text-emerald-700">
                WHOLESALE STOREFRONT
              </span>
              <h2 className="mt-1.5 text-xl font-black text-ink sm:text-3xl">
                Products from {wholesalerBusinessName}
              </h2>
              <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
                Verified wholesale items available for direct retail bulk purchase.
              </p>
            </div>

            {/* Quick Category Filter Pills */}
            {wholesalerCategories.length > 0 && (
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar shrink-0">
                <button
                  type="button"
                  onClick={() => setSelectedCategoryFilter("All")}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-bold transition-all cursor-pointer whitespace-nowrap",
                    selectedCategoryFilter === "All"
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "bg-card text-muted-foreground hover:bg-muted border border-border/80"
                  )}
                >
                  All ({wholesalerProducts.length})
                </button>
                {wholesalerCategories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategoryFilter(cat.name)}
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-bold transition-all cursor-pointer whitespace-nowrap",
                      selectedCategoryFilter === cat.name
                        ? "bg-emerald-600 text-white shadow-xs"
                        : "bg-card text-muted-foreground hover:bg-muted border border-border/80"
                    )}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Grid or Professional Empty State */}
          {displayedProducts.length > 0 ? (
            <div className="space-y-10 sm:space-y-12">
              {displayedCategorySections.map(({ category, products: categoryProducts }) => (
                <section key={category} aria-label={`${category} products`}>
                  <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-extrabold text-ink sm:text-xl">{category}</h3>
                      <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
                        Related wholesale products · {categoryProducts.length} item{categoryProducts.length === 1 ? "" : "s"}
                      </p>
                    </div>
                    <Button asChild variant="ghost" size="sm" className="min-h-10 shrink-0 font-bold text-primary">
                      <Link to="/products" search={category === "Other products" ? undefined : { category }}>
                        View all <ChevronRight className="size-4" />
                      </Link>
                    </Button>
                  </div>
                  <ProductGrid
                    products={categoryProducts.slice(0, 8)}
                    className="storefront-featured-products grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 lg:gap-5"
                  />
                </section>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border/80 bg-card/80 p-12 text-center shadow-xs">
              <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                <Inventory2 className="size-7" />
              </div>
              <h3 className="text-lg font-black text-ink">
                {selectedCategoryFilter !== "All"
                  ? `No products in ${selectedCategoryFilter}`
                  : `No products listed yet by ${wholesalerBusinessName}`}
              </h3>
              <p className="mt-1.5 max-w-md mx-auto text-xs sm:text-sm text-muted-foreground leading-relaxed">
                {selectedCategoryFilter !== "All"
                  ? `There are no products listed under ${selectedCategoryFilter} by this supplier right now.`
                  : `${wholesalerBusinessName} has not added any products to their wholesale catalog yet. Please check back later or contact your supplier.`}
              </p>
              {selectedCategoryFilter !== "All" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedCategoryFilter("All")}
                  className="mt-4 rounded-xl text-xs font-bold"
                >
                  Show all products ({wholesalerProducts.length})
                </Button>
              )}
            </div>
          )}
        </div>
      </section>

      {/* 5. Trade Savings Promo Banner */}
      <section className="shell py-8 sm:py-12">
        <div className="grid grid-cols-1 overflow-hidden rounded-3xl bg-primary text-primary-foreground md:grid-cols-[1.5fr_1fr] shadow-xl">
          <div className="p-6 sm:p-10 md:p-12 text-center sm:text-left">
            <span className="inline-block rounded-full bg-primary-foreground/15 px-3 py-1 text-[10px] font-black uppercase tracking-wider">
              TRADE DEAL OF THE WEEK
            </span>
            <h2 className="mt-3 text-2xl font-black sm:text-4xl leading-tight">
              Save up to 18% on bulk store stock.
            </h2>
            <p className="mt-2.5 text-xs sm:text-base text-primary-foreground/85 leading-relaxed max-w-xl">
              Consolidate your orders directly with {wholesalerBusinessName} to maximize your profit margins and enjoy prioritized dispatch.
            </p>
            <Button asChild variant="secondary" size="lg" className="mt-6 rounded-xl font-extrabold min-h-[46px] shadow-sm">
              <Link to="/products">
                Shop Trade Deals <ArrowRight className="size-4 ml-1" />
              </Link>
            </Button>
          </div>
          <div className="grid place-items-center bg-ink p-8 text-center border-t border-primary-foreground/10 md:border-t-0 md:border-l">
            <strong className="text-5xl sm:text-6xl font-black text-emerald-400">18%</strong>
            <span className="mt-1.5 block text-xs sm:text-sm font-semibold text-primary-foreground/75">
              Wholesale Bulk Discount
            </span>
          </div>
        </div>
      </section>

      {/* 6. Recently Viewed Products */}
      {recentlyViewedProducts.length > 0 && (
        <section className="bg-canvas py-10 sm:py-14 border-t border-border/60">
          <div className="shell">
            <SectionHeading title="Recently Viewed" subtitle={`Items you previously viewed from ${wholesalerBusinessName}`} />
            <ProductGrid products={recentlyViewedProducts.slice(0, 4)} className="storefront-featured-products" />
          </div>
        </section>
      )}
    </main>
  );
}
