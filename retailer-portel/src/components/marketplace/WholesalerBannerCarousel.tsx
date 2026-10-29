import { useEffect, useMemo, useState } from "react";
import { useStore, type BannerSlide } from "@/state/store";

const FALLBACK_BANNER_BG = "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1200&q=80";

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
      className="storefront-theme-banner pointer-events-none absolute inset-0"
      data-store-theme={theme}
      aria-hidden="true"
    >
      <img
        src={currentBanner?.imageUrl || FALLBACK_BANNER_BG}
        alt=""
        className="absolute inset-0 h-full w-full object-cover object-center transition-opacity duration-700"
      />
      <div className="storefront-banner-overlay absolute inset-0 bg-gradient-to-r from-ink/90 via-ink/70 to-ink/35" />
    </div>
  );
}
