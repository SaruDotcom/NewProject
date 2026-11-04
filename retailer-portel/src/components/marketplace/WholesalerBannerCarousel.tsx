import { useEffect, useMemo, useState } from "react";
import { useStore, type BannerSlide } from "@/state/store";

export function WholesalerBannerCarousel() {
  const { linkedWholesaler } = useStore();
  const theme = linkedWholesaler?.activeStoreTheme || "DEFAULT";
  const activeBanners: BannerSlide[] = useMemo(
    () => (linkedWholesaler?.banners || []).filter((banner) => banner.active !== false),
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

  return (
    <div
      className="storefront-theme-banner absolute inset-0 bg-gradient-to-br from-ink via-ink/90 to-primary/65"
      data-store-theme={theme}
    >
      {currentBanner?.imageUrl && (
        <img
          src={currentBanner.imageUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-center transition-opacity duration-700"
        />
      )}
      <div className="storefront-banner-overlay pointer-events-none absolute inset-0 bg-gradient-to-r from-ink/90 via-ink/70 to-ink/35" />
      {currentBanner && (currentBanner.title || currentBanner.subtitle || currentBanner.tag || currentBanner.discountBadge) && (
        <aside className="pointer-events-none absolute bottom-5 right-5 z-10 hidden max-w-xs rounded-2xl border border-white/20 bg-ink/55 p-4 text-right text-white shadow-xl backdrop-blur-md md:block lg:bottom-8 lg:right-8">
          {(currentBanner.tag || currentBanner.discountBadge) && (
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/75">
              {currentBanner.tag || currentBanner.discountBadge}
            </p>
          )}
          {currentBanner.title && <p className="mt-1 text-base font-bold leading-snug">{currentBanner.title}</p>}
          {currentBanner.subtitle && <p className="mt-1 text-xs leading-5 text-white/80">{currentBanner.subtitle}</p>}
        </aside>
      )}
    </div>
  );
}
