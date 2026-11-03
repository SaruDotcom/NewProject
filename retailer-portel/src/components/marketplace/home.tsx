import { useMemo } from "react";
import { Link } from "@/lib/router";
import {
  ArrowRight,
  VerifiedUser,
  LocalShipping,
  Refresh,
  Verified,
} from "@mui/icons-material";
import { Button } from "@/components/ui/button";
import { useStore } from "@/state/store";
import { ProductGrid, SectionHeading, WholesalerLogo } from "./primitives";
import { categoryImages } from "./storefront";
import { WholesalerBannerCarousel } from "./WholesalerBannerCarousel";

const trustSignals: Array<[typeof VerifiedUser, string, string]> = [
  [VerifiedUser, "Verified sellers", "Every supplier reviewed"],
  [LocalShipping, "Reliable delivery", "Clear dispatch timelines"],
  [Refresh, "Easy reordering", "Repeat orders in moments"],
  [Verified, "Trade pricing", "Business-only wholesale rates"],
];

export function HomePage() {
  const { relationships, recentlyViewed, linkedWholesaler, products, categories, storefrontError } = useStore();
  const activeStoreTheme = linkedWholesaler?.activeStoreTheme || "DEFAULT";

  const wholesalerBusinessName = linkedWholesaler?.businessName?.trim() || "";
  const wholesalerTagline = linkedWholesaler?.businessTagline?.trim();

  const connectedProducts = useMemo(
    () => products.filter((p) => relationships[p.wholesalerId] === "Connected"),
    [products, relationships]
  );

  const recentlyViewedProducts = useMemo(
    () => products.filter((p) => recentlyViewed.includes(p.id) && relationships[p.wholesalerId] === "Connected"),
    [products, recentlyViewed, relationships]
  );

  const wholesalerCategories = categories.filter((category) => !category.parentId);
  const primaryWholesalerName = wholesalerBusinessName;

  if (storefrontError) {
    return (
      <main className="shell py-16">
        <section className="mx-auto max-w-xl rounded-2xl border border-destructive/30 bg-card p-8 text-center shadow-sm">
          <h1 className="text-xl font-black text-ink">Store unavailable</h1>
          <p className="mt-2 text-sm text-muted-foreground">{storefrontError}</p>
        </section>
      </main>
    );
  }

  return (
    <main className="storefront-theme" data-store-theme={activeStoreTheme}>
      {/* Hero Banner */}
      <section className="storefront-hero relative min-h-[420px] sm:min-h-[430px] lg:min-h-[440px] overflow-hidden bg-ink">
        <WholesalerBannerCarousel />
        <div className="shell relative z-10 flex min-h-[420px] sm:min-h-[430px] lg:min-h-[610px] items-center py-10 sm:py-12">
          <div className="max-w-2xl text-primary-foreground text-center sm:text-left mx-auto sm:mx-0">
            <span className="inline-flex items-center gap-2 border border-primary-foreground/25 bg-ink/50 px-3 py-1.5 text-[11px] sm:text-xs font-bold uppercase backdrop-blur rounded-full">
              WHOLESALER STOREFRONT
            </span>
            {linkedWholesaler && (
              <div className="mt-4 inline-flex max-w-full items-center gap-2.5 rounded-xl border border-primary-foreground/20 bg-ink/50 p-2.5 text-left backdrop-blur">
                <WholesalerLogo
                  src={linkedWholesaler.logo || ""}
                  name={linkedWholesaler.businessName || linkedWholesaler.name}
                  className="size-10 rounded-lg bg-white text-sm"
                />
                <div className="min-w-0">
                  <span className="block text-[10px] font-semibold uppercase tracking-wide text-primary-foreground/70">Business</span>
                  <span className="block truncate text-xs font-extrabold text-primary-foreground sm:text-sm">
                    {linkedWholesaler ? `Welcome to ${wholesalerBusinessName}` : "Your wholesaler"}
                  </span>
                </div>
              </div>
            )}
            <h1 className="mt-4 sm:mt-6 text-3xl font-black leading-tight sm:text-5xl lg:text-6xl tracking-tight">
              {wholesalerBusinessName}
            </h1>
            {wholesalerTagline && (
              <p className="mt-2 max-w-xl text-base font-semibold leading-relaxed text-primary-foreground/90 sm:text-xl mx-auto sm:mx-0">
                {wholesalerTagline}
              </p>
            )}
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
              <h2 className="mt-2 text-2xl font-black text-ink sm:text-3xl">Shop by category</h2>
              <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
                Browse categories from {wholesalerBusinessName}.
              </p>
            </div>
            <Button asChild variant="ghost" size="sm" className="font-bold text-primary hover:bg-primary/10 hover:text-primary min-h-[44px]">
              <Link to="/categories" className="flex items-center gap-1">
                View all categories
              </Link>
            </Button>
          </div>

          <div className="-mx-4 overflow-x-auto px-4 pb-4 sm:mx-0 sm:px-0" role="list" aria-label="Wholesaler product categories">
            {wholesalerCategories.length > 0 ? (
              <div className="flex min-w-0 snap-x snap-mandatory gap-3">
                {wholesalerCategories.map((category) => (
                  <Link
                    key={category.id}
                    to="/products"
                    search={{ category: category.name }}
                    role="listitem"
                    aria-label={`Browse ${category.name} products`}
                    className="group w-32 shrink-0 snap-start overflow-hidden rounded-xl border border-border bg-card shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md sm:w-40"
                  >
                    <div className="aspect-[4/3] overflow-hidden bg-muted">
                      <img
                        src={category.imageUrl || categoryImages[category.name] || categoryImages["Grocery & Staples"] || ""}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        onError={(event) => {
                          event.currentTarget.onerror = null;
                          event.currentTarget.src = categoryImages[category.name] || categoryImages["Grocery & Staples"] || "";
                        }}
                      />
                    </div>
                    <div className="p-2.5">
                      <h3 className="truncate text-xs font-extrabold text-ink sm:text-sm">{category.name}</h3>
                      <p className="mt-1 line-clamp-2 min-h-7 text-[11px] text-muted-foreground">
                        {category.description || "Browse available products"}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed bg-card p-10 text-center">
                <h3 className="font-black text-ink">No categories yet</h3>
                <p className="mt-2 text-sm text-muted-foreground">{wholesalerBusinessName} has not published any active categories yet.</p>
              </div>
            )}
          </div>
        </div>
      </section>

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
            <SectionHeading title="Recently viewed" subtitle={`Products from ${wholesalerBusinessName}`} />
            <ProductGrid products={recentlyViewedProducts.slice(0, 4)} className="storefront-featured-products" />
          </div>
        </section>
      )}
    </main>
  );
}
