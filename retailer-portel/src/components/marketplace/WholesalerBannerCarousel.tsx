import React, { useState, useEffect } from "react";
import { Link } from "@/lib/router";
import {
  ChevronLeft,
  ChevronRight,
  AutoAwesome,
  Tune,
  ArrowForward,
  CheckCircle,
  LocalOffer,
  Store,
  Verified,
} from "@mui/icons-material";
import { Button } from "@/components/ui/button";
import { useStore } from "@/state/store";

export type BannerSlide = {
  id: string;
  title: string;
  subtitle: string;
  badgeText: string;
  buttonText: string;
  imageUrl: string;
  targetCategory: string;
  discountBadge: string;
  gradient: string;
  isActive: boolean;
  targetRetailers?: string;
};

const DEFAULT_BANNER_SLIDES: BannerSlide[] = [
  {
    id: "slide-1",
    title: "Festive B2B Stock-Up Fair",
    subtitle: "Get up to 35% extra wholesale margin on bulk Saree & Kurti cases!",
    badgeText: "WHOLESALER OFFER",
    buttonText: "Shop Wholesale Offers",
    imageUrl: "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=1200&q=80",
    targetCategory: "Clothing",
    discountBadge: "35% EXTRA MARGIN",
    gradient: "from-tradeflow-navy via-tradeflow-navy-hover to-green-700",
    isActive: true,
  },
  {
    id: "slide-2",
    title: "Electronics & Gadgets Wholesale Deals",
    subtitle: "Direct factory pricing on smart devices with 1-year warranty & GST input credit.",
    badgeText: "DIRECT SUPPLIER PRICE",
    buttonText: "Explore Electronics",
    imageUrl: "https://images.unsplash.com/photo-1550009158-9ebf69173e03?auto=format&fit=crop&w=1200&q=80",
    targetCategory: "Electronics",
    discountBadge: "FLAT ₹500 OFF",
    gradient: "from-tradeflow-navy via-tradeflow-sky to-tradeflow-navy",
    isActive: true,
  },
  {
    id: "slide-3",
    title: "Grocery Staples Bulk Saver Week",
    subtitle: "Consolidate monthly inventory orders & get free door-step truck dispatch.",
    badgeText: "FREE TRUCK FREIGHT",
    buttonText: "Order Grocery Cases",
    imageUrl: "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1200&q=80",
    targetCategory: "Grocery & Staples",
    discountBadge: "FREE DELIVERY",
    gradient: "from-green-900 via-green-700 to-ink",
    isActive: true,
  },
];

function getThemeGradient(gradient: string) {
  return gradient.includes("tradeflow-") ? gradient : DEFAULT_BANNER_SLIDES[0].gradient;
}

export function WholesalerBannerCarousel() {
  const { retailerProfile, connectedWholesalers } = useStore();
  const [slides, setSlides] = useState<BannerSlide[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("wholesaler_banner_slides");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        } catch (e) {
          // ignore
        }
      }
    }
    return DEFAULT_BANNER_SLIDES;
  });

  const [enabledSlideIds, setEnabledSlideIds] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("retailer_enabled_banner_ids");
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          // ignore
        }
      }
    }
    return slides.map((s) => s.id);
  });

  const [activeIndex, setActiveIndex] = useState(0);
  const [showCustomizeModal, setShowCustomizeModal] = useState(false);

  // Sync slides if wholesaler updates localStorage
  useEffect(() => {
    const handleStorage = () => {
      const saved = localStorage.getItem("wholesaler_banner_slides");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setSlides(parsed);
          }
        } catch (e) {
          // ignore
        }
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const activeSlides = slides.filter((s) => s.isActive && enabledSlideIds.includes(s.id));
  const primaryWholesaler = connectedWholesalers[0]?.name || "ApexWholesale Partner";

  // Auto-play
  useEffect(() => {
    if (activeSlides.length <= 1) return;
    const timer = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % activeSlides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [activeSlides.length]);

  const currentSlide = activeSlides[activeIndex] || activeSlides[0] || slides[0];

  const handleToggleRetailerSlide = (id: string) => {
    const updated = enabledSlideIds.includes(id)
      ? enabledSlideIds.filter((item) => item !== id)
      : [...enabledSlideIds, id];
    setEnabledSlideIds(updated);
    localStorage.setItem("retailer_enabled_banner_ids", JSON.stringify(updated));
  };

  if (!currentSlide) return null;

  return (
    <section className="relative overflow-hidden bg-ink shadow-lg">
      {/* Background Banner Image */}
      <img
        src={currentSlide.imageUrl}
        alt=""
        className="absolute inset-0 h-full w-full object-cover transition-opacity duration-700"
      />
      <div className={`absolute inset-0 bg-gradient-to-r ${getThemeGradient(currentSlide.gradient || 'from-ink via-ink/85 to-ink/40')} opacity-90`} />

      <div className="shell relative z-10 py-10 sm:py-14 min-h-[340px] sm:min-h-[400px] flex flex-col justify-between">
        {/* Top Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 border border-primary-foreground/30 bg-ink/60 px-3 py-1 text-[11px] font-extrabold uppercase backdrop-blur rounded-full text-primary-foreground">
              <AutoAwesome className="size-3.5 text-amber-300" />
              {currentSlide.badgeText || "WHOLESALER BANNER OFFER"}
            </span>
            <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-bold text-primary-foreground/80 bg-white/10 px-2.5 py-1 rounded-full backdrop-blur">
              <Verified className="size-3.5 text-emerald-400" /> Provided by {primaryWholesaler}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={() => setShowCustomizeModal(true)}
              variant="outline"
              size="sm"
              className="rounded-full bg-ink/60 text-primary-foreground border-primary-foreground/30 hover:bg-white hover:text-ink text-xs font-bold gap-1 min-h-[36px]"
            >
              <Tune className="size-3.5" /> Customize Storefront Banners
            </Button>
          </div>
        </div>

        {/* Banner Main Content */}
        <div className="max-w-2xl text-primary-foreground my-auto py-4">
          {currentSlide.discountBadge && (
            <span className="inline-block mb-3 px-3 py-1 rounded-md text-xs font-black uppercase bg-amber-400 text-ink shadow-md">
              {currentSlide.discountBadge}
            </span>
          )}

          <h2 className="text-2xl sm:text-4xl font-black leading-tight tracking-tight drop-shadow-md">
            {currentSlide.title}
          </h2>
          <p className="mt-2 text-xs sm:text-base text-primary-foreground/85 line-clamp-2 leading-relaxed">
            {currentSlide.subtitle}
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Button asChild size="lg" className="rounded-xl font-extrabold shadow-md bg-primary hover:bg-primary/90 text-primary-foreground min-h-[44px]">
              <Link to="/products" search={{ category: currentSlide.targetCategory || "All" }}>
                {currentSlide.buttonText || "Shop Trade Deals"} <ArrowForward className="size-4 ml-1" />
              </Link>
            </Button>
            {retailerProfile?.businessName && (
              <span className="text-xs text-primary-foreground/75 font-medium flex items-center gap-1 bg-white/10 px-3 py-2 rounded-xl backdrop-blur">
                <Store className="size-3.5 text-amber-300" /> Custom for {retailerProfile.businessName}
              </span>
            )}
          </div>
        </div>

        {/* Carousel Footer Navigation */}
        <div className="flex items-center justify-between pt-3 border-t border-primary-foreground/20">
          <div className="flex items-center gap-2">
            {activeSlides.map((s, idx) => (
              <button
                key={s.id}
                onClick={() => setActiveIndex(idx)}
                aria-label={`Go to slide ${idx + 1}`}
                className={`h-2 rounded-full transition-all ${
                  idx === activeIndex ? "w-8 bg-amber-400" : "w-2 bg-primary-foreground/40"
                }`}
              />
            ))}
          </div>

          {activeSlides.length > 1 && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setActiveIndex((prev) => (prev - 1 + activeSlides.length) % activeSlides.length)}
                aria-label="Previous slide"
                className="p-1.5 rounded-lg bg-primary-foreground/20 hover:bg-primary-foreground/30 text-primary-foreground transition-all"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                onClick={() => setActiveIndex((prev) => (prev + 1) % activeSlides.length)}
                aria-label="Next slide"
                className="p-1.5 rounded-lg bg-primary-foreground/20 hover:bg-primary-foreground/30 text-primary-foreground transition-all"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Retailer Banner Customization Modal */}
      {showCustomizeModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 text-ink">
          <div className="bg-card rounded-2xl max-w-lg w-full p-6 space-y-4 border border-border shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div>
                <h3 className="text-base font-extrabold text-ink flex items-center gap-2">
                  <Tune className="size-5 text-primary" /> Select Active Banners for Your Business
                </h3>
                <p className="text-xs text-muted-foreground">
                  Choose which Wholesaler-provided banner slides appear on {retailerProfile?.businessName || "your shop"} homepage.
                </p>
              </div>
              <button
                onClick={() => setShowCustomizeModal(false)}
                className="text-muted-foreground hover:text-ink font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              {slides.map((slide) => {
                const isChecked = enabledSlideIds.includes(slide.id);
                return (
                  <div
                    key={slide.id}
                    onClick={() => handleToggleRetailerSlide(slide.id)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                      isChecked
                        ? "border-primary bg-primary/5 shadow-xs"
                        : "border-border bg-canvas opacity-70"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={slide.imageUrl}
                        alt=""
                        className="w-16 h-12 rounded-lg object-cover border border-border shrink-0"
                      />
                      <div>
                        <div className="font-extrabold text-xs text-ink line-clamp-1">{slide.title}</div>
                        <div className="text-[11px] text-muted-foreground line-clamp-1">{slide.subtitle}</div>
                        <span className="inline-block mt-1 text-[10px] font-bold text-primary">
                          Category: {slide.targetCategory}
                        </span>
                      </div>
                    </div>

                    <div className="shrink-0 ml-3">
                      {isChecked ? (
                        <span className="flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                          <CheckCircle className="size-3.5" /> Featured
                        </span>
                      ) : (
                        <span className="text-xs font-semibold text-muted-foreground bg-gray-200 px-2.5 py-1 rounded-full">
                          Hidden
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-3 border-t border-border flex items-center justify-between">
              <span className="text-xs text-muted-foreground font-semibold">
                {enabledSlideIds.length} of {slides.length} banners active
              </span>
              <Button onClick={() => setShowCustomizeModal(false)} className="rounded-xl font-bold text-xs">
                Save & Apply to Storefront
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
