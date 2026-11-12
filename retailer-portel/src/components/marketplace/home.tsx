import { useMemo } from "react";
import { Link } from "@/lib/router";
import {
  ArrowRight,
  Inventory2,
  LocalOffer,
  Refresh,
  VerifiedUser,
  WarningAmber,
} from "@mui/icons-material";
import { Button } from "@/components/ui/button";
import { useStore } from "@/state/store";
import { ProductGrid, SectionHeading } from "./primitives";
import { WholesalerBannerCarousel } from "./WholesalerBannerCarousel";

const trustSignals: Array<[typeof VerifiedUser, string, string]> = [
  [VerifiedUser, "Connected wholesaler", "Products from your linked supplier"],
  [
    Inventory2,
    "Live product catalog",
    "Prices and availability from the catalog",
  ],
  [Refresh, "Easy reordering", "Keep your restock workflow in one place"],
  [LocalOffer, "Wholesaler offers", "Coupons published by your supplier"],
  [Inventory2, "Order history", "Review your past purchases anytime"],
];

const collectionThemes = [
  { title: "Women's Fashion", keywords: /women|ladies|saree|kurti/i },
  { title: "Men's Style", keywords: /\bmen\b|mens|gents/i },
  {
    title: "Home Essentials",
    keywords: /home|decor|kitchen|furnish|household/i,
  },
];

export function HomePage() {
  const {
    recentlyViewed,
    linkedWholesaler,
    products,
    categories,
    storefrontError,
  } = useStore();

  const activeStoreTheme = linkedWholesaler?.activeStoreTheme || "DEFAULT";
  const wholesalerBusinessName =
    linkedWholesaler?.businessName?.trim() ||
    linkedWholesaler?.name?.trim() ||
    "your wholesaler";
  const wholesalerTagline = linkedWholesaler?.businessTagline?.trim();

  const wholesalerProducts = useMemo(() => {
    if (!linkedWholesaler) return [];
    const wholesalerId = String(linkedWholesaler.id);
    return products.filter(
      (product) => String(product.wholesalerId || "") === wholesalerId,
    );
  }, [products, linkedWholesaler]);

  const collectionCards = useMemo(() => {
    const usedCategoryIds = new Set<string>();
    return collectionThemes
      .map((theme) => {
        const category = categories.find(
          (item) =>
            !usedCategoryIds.has(item.id) &&
            theme.keywords.test(item.name) &&
            wholesalerProducts.some(
              (product) =>
                product.category.toLowerCase() === item.name.toLowerCase(),
            ),
        );
        if (!category) return null;
        usedCategoryIds.add(category.id);
        const productImage = wholesalerProducts.find(
          (product) =>
            product.category.toLowerCase() === category.name.toLowerCase() &&
            (product.imageUrl || product.images?.[0]),
        );
        return {
          ...theme,
          category,
          imageUrl:
            category.imageUrl ||
            productImage?.imageUrl ||
            productImage?.images?.[0],
        };
      })
      .filter((card) => card !== null);
  }, [categories, wholesalerProducts]);

  const recentlyViewedProducts = useMemo(
    () =>
      wholesalerProducts.filter((product) =>
        recentlyViewed.includes(product.id),
      ),
    [wholesalerProducts, recentlyViewed],
  );

  const maxDiscount = wholesalerProducts.reduce((discount, product) => {
    if (product.mrp <= product.price || product.mrp <= 0) return discount;
    return Math.max(
      discount,
      Math.round(((product.mrp - product.price) / product.mrp) * 100),
    );
  }, 0);

  if (storefrontError) {
    const isInvalidCode =
      storefrontError.toLowerCase().includes("invalid") ||
      storefrontError.toLowerCase().includes("not exist") ||
      storefrontError.toLowerCase().includes("not valid");

    return (
      <main className="shell py-16 sm:py-24">
        <section className="mx-auto max-w-lg rounded-3xl border border-destructive/20 bg-card p-8 text-center shadow-xl sm:p-10">
          <div className="mx-auto mb-5 flex size-16 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
            <WarningAmber className="size-9" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-ink">
            {isInvalidCode
              ? "Invalid Invitation Link"
              : "Wholesaler Unavailable"}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            {storefrontError}
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button
              asChild
              size="lg"
              className="w-full rounded-xl font-bold sm:w-auto"
            >
              <Link to="/login">Go to Login</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="w-full rounded-xl font-semibold sm:w-auto"
            >
              <Link to="/products">Browse Marketplace</Link>
            </Button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="storefront-theme" data-store-theme={activeStoreTheme}>
      <section className="storefront-hero relative min-h-[440px] overflow-hidden bg-ink sm:min-h-[500px]">
        <WholesalerBannerCarousel />
        <div className="shell relative z-10 flex min-h-[440px] items-center py-12 sm:min-h-[500px] sm:py-16">
          <div className="mx-auto max-w-3xl text-center text-primary-foreground sm:mx-0 sm:text-left">
            <p className="inline-flex rounded-full border border-white/25 bg-white/10 px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-white/90 backdrop-blur">
              {wholesalerBusinessName}
            </p>
            <h1 className="mt-5 font-heading text-3xl font-bold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
              Your One-Stop Destination for Trendy &amp; Premium Shopping
              Experience.
            </h1>
            <p className="mt-4 text-sm font-semibold tracking-wide text-white/90 sm:text-base">
              Shop. Save. Smile.
            </p>
            {wholesalerTagline && (
              <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-white/75 sm:mx-0 sm:text-base">
                {wholesalerTagline}
              </p>
            )}
            <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row sm:justify-start">
              <Button
                asChild
                size="lg"
                className="min-h-12 rounded-xl bg-primary px-6 font-bold text-primary-foreground shadow-lg hover:bg-primary/90"
              >
                <Link to="/products">
                  Start Shopping <ArrowRight className="ml-1 size-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="min-h-12 rounded-xl border-white/40 bg-white/10 px-6 font-bold text-white backdrop-blur hover:bg-white/20 hover:text-white"
              >
                <Link to="/coupons">Coupons &amp; Offers</Link>
              </Button>
            </div>
            {maxDiscount > 0 && (
              <p className="mt-6 inline-flex rounded-full bg-[#D9A441] px-4 py-2 text-xs font-extrabold uppercase tracking-wide text-[#351522] shadow-lg">
                Save up to {maxDiscount}% on listed products
              </p>
            )}
          </div>
        </div>
      </section>

      <section
        aria-label="Shopping benefits"
        className="border-b border-border/70 bg-card"
      >
        <div className="shell grid grid-cols-2 gap-4 py-5 sm:gap-6 lg:grid-cols-5 lg:py-7">
          {trustSignals.map(([Icon, title, description]) => (
            <div key={title} className="flex min-w-0 items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Icon className="size-5" />
              </div>
              <div className="min-w-0">
                <b className="block truncate text-xs font-bold text-ink sm:text-sm">
                  {title}
                </b>
                <span className="mt-0.5 block text-[10px] leading-4 text-muted-foreground sm:text-xs">
                  {description}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {collectionCards.length > 0 && (
        <section className="shell py-10 sm:py-14">
          <SectionHeading
            title="Curated collections"
            subtitle={`Explore categories carried by ${wholesalerBusinessName}.`}
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {collectionCards.map(({ title, category, imageUrl }) => (
              <Link
                key={category.id}
                to="/products"
                search={{ category: category.name }}
                className="group relative flex min-h-56 items-end overflow-hidden rounded-3xl border border-border/70 bg-gradient-to-br from-primary/20 via-secondary to-[#E8D6B2] p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-xl sm:min-h-64"
              >
                {imageUrl && (
                  <img
                    src={imageUrl}
                    alt=""
                    loading="lazy"
                    className="absolute inset-0 size-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[#28111D]/85 via-[#28111D]/10 to-transparent" />
                <div className="relative z-10">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/75">
                    {category.name}
                  </p>
                  <h3 className="mt-1 font-heading text-2xl font-bold text-white sm:text-3xl">
                    {title}
                  </h3>
                  <span className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-white">
                    Shop collection{" "}
                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="bg-[#F5EFE6] py-10 sm:py-16">
        <div className="shell">
          <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <span className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.16em] text-primary">
                Selected for your store
              </span>
              <h2 className="mt-2 font-heading text-2xl font-bold text-ink sm:text-3xl">
                Top products
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Live products from {wholesalerBusinessName}.
              </p>
            </div>
            <Button
              asChild
              variant="outline"
              className="min-h-11 shrink-0 rounded-xl font-bold"
            >
              <Link to="/products">
                View all products <ArrowRight className="ml-1 size-4" />
              </Link>
            </Button>
          </div>

          {wholesalerProducts.length > 0 ? (
            <ProductGrid
              products={wholesalerProducts.slice(0, 10)}
              className="storefront-featured-products grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 lg:gap-5 xl:grid-cols-5"
            />
          ) : (
            <div className="rounded-3xl border border-dashed border-border bg-card p-10 text-center sm:p-12">
              <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                <Inventory2 className="size-7" />
              </div>
              <h3 className="text-lg font-bold text-ink">
                No products listed yet
              </h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
                {wholesalerBusinessName} has not added products to this catalog
                yet. Please check back later.
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="shell py-10 sm:py-14">
        <div className="relative isolate overflow-hidden rounded-3xl bg-ink px-6 py-8 text-white shadow-xl sm:px-10 sm:py-10">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_85%_15%,rgba(217,164,65,0.28),transparent_35%)]" />
          <div className="relative z-10 max-w-2xl">
            <span className="inline-block rounded-full border border-white/25 bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider">
              Offers for your business
            </span>
            <h2 className="mt-3 font-heading text-2xl font-bold leading-tight sm:text-4xl">
              Make your next restock go further.
            </h2>
            <p className="mt-2.5 max-w-xl text-sm leading-relaxed text-white/80 sm:text-base">
              Explore current coupons and offers published by{" "}
              {wholesalerBusinessName}.
            </p>
            <Button
              asChild
              variant="secondary"
              size="lg"
              className="mt-6 min-h-12 rounded-xl font-bold"
            >
              <Link to="/coupons">
                View coupons &amp; offers <ArrowRight className="ml-1 size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {recentlyViewedProducts.length > 0 && (
        <section className="border-t border-border/60 bg-canvas py-10 sm:py-14">
          <div className="shell">
            <SectionHeading
              title="Recently viewed"
              subtitle={`Items you previously viewed from ${wholesalerBusinessName}.`}
            />
            <ProductGrid
              products={recentlyViewedProducts.slice(0, 4)}
              className="storefront-featured-products"
            />
          </div>
        </section>
      )}
    </main>
  );
}
