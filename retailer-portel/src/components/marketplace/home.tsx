import { useMemo } from "react";
import { Link } from "@/lib/router";
import {
  ArrowRight,
  VerifiedUser,
  LocalShipping,
  Refresh,
  Verified,
  AutoAwesome,
  ChevronRight,
} from "@mui/icons-material";
import { Button } from "@/components/ui/button";
import { useStore } from "@/state/store";
import { ProductGrid, SectionHeading, WholesalerCard } from "./primitives";
import { categoryImages } from "./storefront";
import { CategoryCard } from "./CategoryCard";
import { WholesalerBannerCarousel } from "./WholesalerBannerCarousel";

const trustSignals: Array<[typeof VerifiedUser, string, string]> = [
  [VerifiedUser, "Verified sellers", "Every supplier reviewed"],
  [LocalShipping, "Reliable delivery", "Clear dispatch timelines"],
  [Refresh, "Easy reordering", "Repeat orders in moments"],
  [Verified, "Trade pricing", "Business-only wholesale rates"],
];

export function HomePage() {
  const { connectedWholesalers, relationships, recentlyViewed, linkedWholesaler, products, categories, retailerProfile } = useStore();
  const activeStoreTheme = linkedWholesaler?.activeStoreTheme || "DEFAULT";

  const retailerName = retailerProfile?.businessName?.trim();
  const heroHeading = retailerName
    ? `Welcome to ${retailerName}'s Wholesale Store`
    : "Welcome to Your Wholesale Store";

  const connectedProducts = useMemo(
    () => products.filter((p) => relationships[p.wholesalerId] === "Connected"),
    [products, relationships]
  );

  const recentlyViewedProducts = useMemo(
    () => products.filter((p) => recentlyViewed.includes(p.id) && relationships[p.wholesalerId] === "Connected"),
    [products, recentlyViewed, relationships]
  );

  // Categories from connected wholesalers
  const connectedCategories = categories;

  const primaryWholesalerName = connectedWholesalers[0]?.name || "Verified Wholesalers";

  return (
    <main className="storefront-theme" data-store-theme={activeStoreTheme}>
      {/* Hero Banner */}
      <section className="storefront-hero relative min-h-[420px] sm:min-h-[430px] lg:min-h-[440px] overflow-hidden bg-ink">
        <WholesalerBannerCarousel />
        <div className="shell relative z-10 flex min-h-[420px] sm:min-h-[430px] lg:min-h-[610px] items-center py-10 sm:py-12">
          <div className="max-w-2xl text-primary-foreground text-center sm:text-left mx-auto sm:mx-0">
            <span className="inline-flex items-center gap-2 border border-primary-foreground/25 bg-ink/50 px-3 py-1.5 text-[11px] sm:text-xs font-bold uppercase backdrop-blur rounded-full">
              Direct Wholesaler Network • {connectedWholesalers.length} Connected Partner{connectedWholesalers.length === 1 ? "" : "s"}
            </span>
            <h1 className="mt-4 sm:mt-6 text-3xl font-black leading-tight sm:text-5xl lg:text-6xl tracking-tight">
              {heroHeading}
            </h1>
            <p className="mt-4 sm:mt-5 max-w-xl text-sm leading-relaxed text-primary-foreground/80 sm:text-lg mx-auto sm:mx-0">
              Shop trade-only pricing, place bulk orders, and receive direct delivery from your approved wholesale suppliers.
            </p>
            <div className="mt-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-center sm:justify-start gap-3">
              <Button asChild size="lg" className="rounded-xl min-h-[44px] font-extrabold shadow-md">
                <Link to="/products">
                  Explore products <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="secondary" className="rounded-xl min-h-[44px] font-bold">
                <Link to="/categories">Browse categories</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Signals */}
      <section className="border-b bg-card">
        <div className="shell grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 py-4 sm:py-6">
          {trustSignals.map(([I, t, b]) => (
            <div key={t} className="flex items-center gap-3">
              <I className="size-6 shrink-0 text-primary" />
              <div>
                <b className="block text-xs sm:text-sm font-bold text-ink">{t}</b>
                <span className="text-[11px] sm:text-xs text-muted-foreground">{b}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

       {/* Recommended from approved partners */}
      {connectedProducts.length > 0 && (
        <section className="border-t border-border/60 bg-card py-12 sm:py-16 lg:py-20">
          <div className="shell">
            <SectionHeading
              title="Recommended from approved partners"
              subtitle="Products from your connected wholesalers"
              href="/products"
            />
            <ProductGrid products={connectedProducts.slice(0, 8)} className="storefront-featured-products" />
          </div>
        </section>
      )}

      {/* Popular Categories */}
      <section className="bg-canvas py-12 sm:py-16 lg:py-20">
        <div className="shell">
          <div className="mb-8 sm:mb-10 flex flex-wrap items-end justify-between gap-4">
            <div>
              <span className="inline-flex rounded-full bg-primary/10 px-3.5 py-1 text-[11px] font-extrabold uppercase tracking-[0.16em] text-primary">
                POPULAR CATEGORIES
              </span>
              <h2 className="mt-2 text-2xl font-black text-ink sm:text-3xl">Categories from Your Network</h2>
              <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
                Browse trade categories available from your connected wholesalers.
              </p>
            </div>
            <Button asChild variant="ghost" size="sm" className="font-bold text-primary hover:bg-primary/10 hover:text-primary min-h-[44px]">
              <Link to="/categories" className="flex items-center gap-1">
                View all categories <ChevronRight className="size-4" />
              </Link>
            </Button>
          </div>

          <div className="storefront-category-grid grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:gap-8">
            {connectedCategories.slice(0, 6).map((c, i) => {
              const catProductsCount = connectedProducts.filter((p) => p.category === c.name).length;
              return (
                <CategoryCard
                  key={c.id}
                  name={c.name}
                  imageUrl={c.imageUrl || categoryImages[c.name] || categoryImages["Grocery & Staples"]}
                  description={c.description}
                  subcategories={categories.filter((child) => child.parentId === c.id).map((child) => child.name)}
                  itemCount={catProductsCount}
                  badge={i === 0 ? "Popular" : undefined}
                  actionLabel={`Browse ${catProductsCount} trade products`}
                  animationDelay={i * 70}
                />
              );
            })}
            {connectedCategories.length === 0 && (
              <div className="col-span-full rounded-2xl border border-dashed bg-card p-10 text-center">
                <h3 className="font-black text-ink">No categories yet</h3>
                <p className="mt-2 text-sm text-muted-foreground">Your connected wholesaler has not added products or categories yet.</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Featured from your connections */}
      {connectedWholesalers.length > 0 && (
        <section className="border-t border-border/60 bg-card py-12 sm:py-16 lg:py-20">
          <div className="shell">
            <div className="mb-8 sm:mb-10 flex flex-wrap items-end justify-between gap-4">
              <div>
                <span className="inline-flex rounded-full bg-primary/10 px-3.5 py-1 text-[11px] font-extrabold uppercase tracking-[0.16em] text-primary">
                  YOUR NETWORK
                </span>
                <h2 className="mt-2 text-2xl font-black text-ink sm:text-3xl">
                  Featured from your connections
                </h2>
                <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
                  Wholesalers you have connected with via invite links.
                </p>
              </div>
              <Button asChild variant="ghost" size="sm" className="font-bold text-primary hover:bg-primary/10 hover:text-primary min-h-[44px]">
                <Link to="/wholesalers" className="flex items-center gap-1">
                  View all <ChevronRight className="size-4" />
                </Link>
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:gap-8">
              {connectedWholesalers.map((w, index) => (
                <div
                  key={w.id}
                  className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2"
                  style={{ animationDelay: `${index * 70}ms` }}
                >
                  <WholesalerCard wholesaler={w} premium />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Promo Banner ("Save up to 18%") */}
      <section className="shell py-12 sm:py-16 lg:py-20">
        <div className="grid grid-cols-1 overflow-hidden rounded-2xl bg-primary text-primary-foreground md:grid-cols-[1.5fr_1fr] shadow-md">
          <div className="p-6 sm:p-10 md:p-12 text-center sm:text-left">
            <p className="text-xs font-extrabold uppercase tracking-wider opacity-90">Stock-up week</p>
            <h2 className="mt-3 text-2xl font-black sm:text-4xl leading-tight">
              Save up to 18% on everyday store essentials.
            </h2>
            <p className="mt-3 text-xs sm:text-base text-primary-foreground/85 leading-relaxed">
              Consolidate larger orders directly with {primaryWholesalerName} and protect your margins.
            </p>
            <Button asChild variant="secondary" className="mt-6 rounded-xl font-extrabold min-h-[44px] shadow-sm">
              <Link to="/products">
                Shop trade offers <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
          <div className="grid place-items-center bg-ink p-8 text-center border-t border-primary-foreground/10 md:border-t-0 md:border-l">
            <strong className="text-5xl sm:text-6xl font-black text-primary-foreground">18%</strong>
            <span className="mt-2 block text-xs sm:text-sm text-primary-foreground/70">
              select wholesale cases
            </span>
          </div>
        </div>
      </section>

      {/* Recently viewed products */}
      {recentlyViewedProducts.length > 0 && (
        <section className="bg-canvas py-12 sm:py-16 lg:py-20">
          <div className="shell">
            <SectionHeading title="Recently viewed from your network" subtitle="Items you recently looked at from approved partners" />
            <ProductGrid products={recentlyViewedProducts.slice(0, 4)} className="storefront-featured-products" />
          </div>
        </section>
      )}
    </main>
  );
}
