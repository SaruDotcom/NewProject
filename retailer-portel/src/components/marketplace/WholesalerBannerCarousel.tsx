import { useEffect, useMemo, useState } from "react";
import { ArrowBackIosNew, ArrowForwardIos } from "@mui/icons-material";
import { useStore, type BannerSlide } from "@/state/store";

export function WholesalerBannerCarousel() {
  const { linkedWholesaler } = useStore();
  const theme = linkedWholesaler?.activeStoreTheme || "DEFAULT";
  const activeBanners: BannerSlide[] = useMemo(
    () =>
      (linkedWholesaler?.banners || []).filter(
        (banner) => banner.active !== false,
      ),
    [linkedWholesaler?.banners],
  );
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (activeBanners.length <= 1) return;
    const timer = setInterval(() => {
      setActiveIndex((previous) => (previous + 1) % activeBanners.length);
    }, 5500);
    return () => clearInterval(timer);
  }, [activeBanners.length]);

  useEffect(() => {
    if (activeIndex >= activeBanners.length) setActiveIndex(0);
  }, [activeBanners.length, activeIndex]);

  const currentBanner = activeBanners[activeIndex] || activeBanners[0];
  const showControls = activeBanners.length > 1;

  return (
    <div
      className="storefront-theme-banner absolute inset-0 bg-gradient-to-br from-ink via-ink/90 to-primary/65"
      data-store-theme={theme}
    >
      {currentBanner?.imageUrl && (
        <img
          src={currentBanner.imageUrl}
          alt=""
          fetchPriority="high"
          className="absolute inset-0 size-full object-cover object-center transition-opacity duration-700"
        />
      )}
      <div className="storefront-banner-overlay pointer-events-none absolute inset-0 bg-gradient-to-r from-ink/90 via-ink/70 to-ink/35" />
      {currentBanner &&
        (currentBanner.title ||
          currentBanner.subtitle ||
          currentBanner.tag ||
          currentBanner.discountBadge) && (
          <aside className="pointer-events-none absolute bottom-5 right-5 z-10 hidden max-w-xs rounded-2xl border border-white/20 bg-ink/55 p-4 text-right text-white shadow-xl backdrop-blur-md md:block lg:bottom-8 lg:right-8">
            {(currentBanner.tag || currentBanner.discountBadge) && (
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/75">
                {currentBanner.tag || currentBanner.discountBadge}
              </p>
            )}
            {currentBanner.title && (
              <p className="mt-1 text-base font-bold leading-snug">
                {currentBanner.title}
              </p>
            )}
            {currentBanner.subtitle && (
              <p className="mt-1 text-xs leading-5 text-white/80">
                {currentBanner.subtitle}
              </p>
            )}
          </aside>
        )}
      {showControls && (
        <div className="absolute inset-x-4 bottom-4 z-20 flex items-center justify-between sm:inset-x-6 sm:bottom-6">
          <button
            type="button"
            aria-label="Show previous wholesaler banner"
            onClick={() =>
              setActiveIndex(
                (index) =>
                  (index - 1 + activeBanners.length) % activeBanners.length,
              )
            }
            className="grid size-10 place-items-center rounded-full border border-white/35 bg-[#3B1727]/45 text-white shadow-lg backdrop-blur transition hover:bg-[#3B1727]/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <ArrowBackIosNew className="size-4" />
          </button>
          <div
            className="flex items-center gap-2"
            role="group"
            aria-label="Wholesaler banner slides"
          >
            {activeBanners.map((banner, index) => (
              <button
                key={banner.id}
                type="button"
                aria-label={`Show banner ${index + 1}`}
                aria-current={index === activeIndex ? "true" : undefined}
                onClick={() => setActiveIndex(index)}
                className={`h-2.5 rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
                  index === activeIndex
                    ? "w-7 bg-white"
                    : "w-2.5 bg-white/55 hover:bg-white/85"
                }`}
              />
            ))}
          </div>
          <button
            type="button"
            aria-label="Show next wholesaler banner"
            onClick={() =>
              setActiveIndex((index) => (index + 1) % activeBanners.length)
            }
            className="grid size-10 place-items-center rounded-full border border-white/35 bg-[#3B1727]/45 text-white shadow-lg backdrop-blur transition hover:bg-[#3B1727]/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <ArrowForwardIos className="size-4" />
          </button>
        </div>
      )}
    </div>
  );
}
