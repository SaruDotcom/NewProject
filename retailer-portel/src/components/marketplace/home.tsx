import { useMemo } from "react";
import { Link } from "@/lib/router";
import {
  ArrowRight,
  VerifiedUser,
  LocalShipping,
  Refresh,
  Verified,
  Inventory2,
  WarningAmber,
} from "@mui/icons-material";
import { Button } from "@/components/ui/button";
import { useStore } from "@/state/store";
import { ProductGrid, SectionHeading } from "./primitives";
import { WholesalerBannerCarousel } from "./WholesalerBannerCarousel";

const trustSignals: Array<[typeof VerifiedUser, string, string]> = [
  [VerifiedUser, "Verified Supplier", "Authentic verified wholesale partner"],
  [LocalShipping, "Reliable Dispatch", "Direct dispatch to your retail store"],
  [Refresh, "Easy Reordering", "Fast repeat bulk orders & invoicing"],
  [Verified, "Direct Trade Rates", "Exclusive business-only trade pricing"],
];

export function HomePage() {
  const { recentlyViewed, linkedWholesaler, products, storefrontError } = useStore();

  const activeStoreTheme = linkedWholesaler?.activeStoreTheme || "DEFAULT";
  const wholesalerBusinessName = linkedWholesaler?.businessName?.trim() || linkedWholesaler?.name?.trim() || "Wholesaler Store";
  const wholesalerTagline = linkedWholesaler?.businessTagline?.trim() || "Wholesale essentials, chosen for your next great sale.";

  // Filter products: strictly isolated to the linked wholesaler
  const wholesalerProducts = useMemo(() => {
    if (!linkedWholesaler) return [];
    const wsId = String(linkedWholesaler.id);
    return products.filter((p) => {
      const pWsId = String(p.wholesalerId || "");
      return pWsId === wsId;
    });
  }, [products, linkedWholesaler]);

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
            <p className="inline-flex rounded-full border border-white/25 bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white/90 backdrop-blur">
              Your trusted wholesale storefront
            </p>
            <h1 className="mt-4 text-3xl font-black leading-tight sm:text-5xl lg:text-6xl tracking-tight text-white drop-shadow-sm">
              Stock your store with confidence.
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-white/85 sm:mx-0 sm:text-base sm:leading-7">
              {wholesalerTagline} Explore the latest collection from {wholesalerBusinessName}.
            </p>

            <div className="mt-7 flex flex-col sm:flex-row items-stretch sm:items-center justify-center sm:justify-start gap-3.5">
              <Button asChild size="lg" className="rounded-xl min-h-[46px] font-extrabold shadow-lg bg-emerald-600 hover:bg-emerald-700 text-white">
                <Link to="/products">
                  Explore products <ArrowRight className="size-4 ml-1" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="secondary" className="rounded-xl min-h-[46px] font-bold backdrop-blur">
                <Link to="/coupons">View current offers</Link>
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

      {/* Wholesaler Products Showcase */}
      <section className="bg-canvas py-10 sm:py-16">
        <div className="shell">
          <div className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <span className="inline-flex rounded-full bg-emerald-500/10 px-3 py-0.5 text-[10px] font-black uppercase tracking-[0.15em] text-emerald-700">
                SELECTED FOR YOUR STORE
              </span>
              <h2 className="mt-1.5 text-xl font-black text-ink sm:text-3xl">
                Shop the latest collection
              </h2>
              <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
                Live wholesale products from {wholesalerBusinessName}.
              </p>
            </div>
            <Button asChild variant="outline" className="shrink-0 rounded-xl font-bold">
              <Link to="/products">View full catalogue <ArrowRight className="ml-1 size-4" /></Link>
            </Button>
          </div>

          {/* Product Grid or Professional Empty State */}
          {wholesalerProducts.length > 0 ? (
            <ProductGrid
              products={wholesalerProducts}
              className="storefront-featured-products grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 lg:gap-5"
            />
          ) : (
            <div className="rounded-2xl border border-dashed border-border/80 bg-card/80 p-12 text-center shadow-xs">
              <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                <Inventory2 className="size-7" />
              </div>
              <h3 className="text-lg font-black text-ink">
                No products listed yet by {wholesalerBusinessName}
              </h3>
              <p className="mt-1.5 max-w-md mx-auto text-xs sm:text-sm text-muted-foreground leading-relaxed">
                {`${wholesalerBusinessName} has not added any products to their wholesale catalog yet. Please check back later or contact your supplier.`}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Live wholesaler banner with a route to the current offers */}
      <section className="shell py-8 sm:py-12">
        <div className="relative isolate overflow-hidden rounded-3xl bg-ink px-6 py-8 text-white shadow-xl sm:px-10 sm:py-10">
          <WholesalerBannerCarousel />
          <div className="relative z-10 max-w-2xl">
            <span className="inline-block rounded-full border border-white/25 bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider backdrop-blur">
              Offers for your business
            </span>
            <h2 className="mt-3 text-2xl font-black leading-tight sm:text-4xl">
              Make your next restock go further.
            </h2>
            <p className="mt-2.5 max-w-xl text-sm leading-relaxed text-white/85 sm:text-base">
              Explore current coupon offers published by {wholesalerBusinessName}.
            </p>
            <Button asChild variant="secondary" size="lg" className="mt-6 min-h-[46px] rounded-xl font-extrabold shadow-sm">
              <Link to="/coupons">
                View coupons &amp; offers <ArrowRight className="size-4 ml-1" />
              </Link>
            </Button>
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
