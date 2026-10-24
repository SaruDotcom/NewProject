import { useState, useEffect, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { ProductImage } from './ProductImage';

type ProductImageGalleryProps = {
  images: string[];
  productName: string;
  className?: string;
};

export function ProductImageGallery({
  images,
  productName,
  className = '',
}: ProductImageGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [isTouch, setIsTouch] = useState(false);

  // Lens and zoom calculations
  const [lensPos, setLensPos] = useState({ x: 0, y: 0 });
  const [lensRatio, setLensRatio] = useState({ x: 0, y: 0 });
  const [lensDims, setLensDims] = useState({ w: 140, h: 140 });

  const mainImageRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  // Reset active index when images change
  useEffect(() => {
    setActiveIndex(0);
  }, [images]);

  // Detect touch device
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      setIsTouch(hasTouch);
    }
  }, []);

  const total = images.length;
  const currentImage = images[activeIndex] || images[0] || '';

  const goNext = useCallback(() => {
    if (total <= 1) return;
    setActiveIndex((prev) => (prev + 1) % total);
  }, [total]);

  const goPrev = useCallback(() => {
    if (total <= 1) return;
    setActiveIndex((prev) => (prev - 1 + total) % total);
  }, [total]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        goNext();
      } else if (e.key === 'ArrowLeft') {
        goPrev();
      } else if (e.key === 'Escape' && isLightboxOpen) {
        setIsLightboxOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goNext, goPrev, isLightboxOpen]);

  // Amazon-style lens & zoom tracking
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isTouch || !mainImageRef.current) return;
    const rect = mainImageRef.current.getBoundingClientRect();

    // Dynamically size lens to ~36% of main image width
    const lensWidth = Math.round(rect.width * 0.36);
    const lensHeight = Math.round(rect.height * 0.36);
    setLensDims({ w: lensWidth, h: lensHeight });

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Calculate clamped lens position
    const maxX = rect.width - lensWidth;
    const maxY = rect.height - lensHeight;

    const rawX = mouseX - lensWidth / 2;
    const rawY = mouseY - lensHeight / 2;

    const clampedX = Math.max(0, Math.min(maxX, rawX));
    const clampedY = Math.max(0, Math.min(maxY, rawY));

    setLensPos({ x: clampedX, y: clampedY });

    // Compute normalized ratio (0 to 1) for the magnified view
    const ratioX = maxX > 0 ? clampedX / maxX : 0;
    const ratioY = maxY > 0 ? clampedY / maxY : 0;
    setLensRatio({ x: ratioX, y: ratioY });
  };

  const handleMouseEnter = () => {
    if (!isTouch) setIsHovering(true);
  };

  const handleMouseLeave = () => {
    setIsHovering(false);
  };

  // Mobile touch swipe handlers
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    setIsTouch(true);
    setIsHovering(false);
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;

    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 40) {
      if (deltaX < 0) {
        goNext();
      } else {
        goPrev();
      }
    }
    touchStartX.current = null;
    touchStartY.current = null;
  };

  const hasMultipleImages = total > 1;
  const maxThumbnails = 6;
  const displayThumbnails = images.slice(0, maxThumbnails);
  const remainingCount = total - maxThumbnails;

  return (
    <div className={cn('relative flex flex-col-reverse md:flex-row gap-3 select-none', className)}>
      {/* Thumbnail Column (Desktop: Left column / Mobile: Bottom row) */}
      {hasMultipleImages && (
        <div className="flex md:flex-col gap-2 overflow-x-auto md:overflow-y-auto max-h-[480px] shrink-0 p-0.5 scrollbar-thin">
          {displayThumbnails.map((img, idx) => {
            const isSelected = idx === activeIndex;
            const isLastWithMore = idx === maxThumbnails - 1 && remainingCount > 0;

            return (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  if (isLastWithMore) {
                    setIsLightboxOpen(true);
                  } else {
                    setActiveIndex(idx);
                  }
                }}
                onMouseEnter={() => setActiveIndex(idx)}
                className={cn(
                  'relative size-14 md:size-16 shrink-0 rounded-lg overflow-hidden border-2 transition-all duration-150 cursor-pointer bg-card',
                  isSelected
                    ? 'border-emerald-600 shadow-xs ring-1 ring-emerald-600/50'
                    : 'border-border/70 hover:border-emerald-400 opacity-75 hover:opacity-100'
                )}
                aria-label={`View ${productName} image ${idx + 1}`}
              >
                <ProductImage
                  src={img}
                  alt={`${productName} thumbnail ${idx + 1}`}
                  className="size-full object-contain p-1"
                  placeholderClassName="size-full p-0 text-[8px]"
                />
                {isLastWithMore && (
                  <div className="absolute inset-0 bg-black/65 backdrop-blur-[1px] flex items-center justify-center text-white text-xs font-bold">
                    +{remainingCount + 1}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Main Image Container */}
      <div className="relative flex-1">
        <div
          ref={mainImageRef}
          className="relative aspect-square w-full rounded-2xl border border-border/80 bg-white dark:bg-card overflow-hidden group shadow-2xs cursor-crosshair flex items-center justify-center"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onMouseMove={handleMouseMove}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onClick={() => setIsLightboxOpen(true)}
          title="Click to view full screen"
        >
          {currentImage ? (
            <ProductImage
              src={currentImage}
              alt={productName}
              className="size-full object-contain p-4 select-none pointer-events-none"
            />
          ) : (
            <ProductImage
              src=""
              alt={productName}
              className="size-full object-contain p-4"
            />
          )}

          {/* Amazon-style Magnifying Lens (Visible on Desktop hover) */}
          {isHovering && !isTouch && (
            <div
              className="absolute pointer-events-none rounded-lg border-2 border-emerald-600/70 bg-emerald-500/15 backdrop-blur-[0.5px] shadow-sm z-20 transition-all duration-75"
              style={{
                left: `${lensPos.x}px`,
                top: `${lensPos.y}px`,
                width: `${lensDims.w}px`,
                height: `${lensDims.h}px`,
              }}
            />
          )}

          {/* Hover hint badge (Desktop only) */}
          <div className="absolute top-3 right-3 hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-background/85 backdrop-blur-xs text-[11px] font-medium text-muted-foreground border border-border/70 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-10">
            <svg className="size-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
            </svg>
            <span>Roll over image to zoom</span>
          </div>

          {/* Image count badge */}
          {hasMultipleImages && (
            <div className="absolute bottom-3 left-3 px-2 py-0.5 rounded-md bg-black/60 text-white text-[11px] font-semibold backdrop-blur-xs pointer-events-none z-10">
              {activeIndex + 1} / {total}
            </div>
          )}

          {/* Previous Arrow Button */}
          {hasMultipleImages && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                goPrev();
              }}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 size-8.5 rounded-full bg-background/90 hover:bg-background text-foreground shadow-md border border-border/80 flex items-center justify-center opacity-80 md:opacity-0 group-hover:opacity-100 transition-all duration-200 cursor-pointer hover:scale-105 active:scale-95 z-20"
              aria-label="Previous image"
            >
              <svg className="size-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}

          {/* Next Arrow Button */}
          {hasMultipleImages && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                goNext();
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 size-8.5 rounded-full bg-background/90 hover:bg-background text-foreground shadow-md border border-border/80 flex items-center justify-center opacity-80 md:opacity-0 group-hover:opacity-100 transition-all duration-200 cursor-pointer hover:scale-105 active:scale-95 z-20"
              aria-label="Next image"
            >
              <svg className="size-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}
        </div>

        {/* Amazon-Style Floating Zoom Preview Window (Desktop only) */}
        {isHovering && !isTouch && currentImage && (
          <div
            className="absolute left-[calc(100%+16px)] top-0 w-[460px] h-[460px] xl:w-[500px] xl:h-[500px] z-50 bg-white dark:bg-card rounded-2xl border border-border/90 shadow-2xl overflow-hidden pointer-events-none hidden lg:block animate-in fade-in zoom-in-95 duration-150"
            style={{
              backgroundImage: `url(${currentImage})`,
              backgroundPosition: `${lensRatio.x * 100}% ${lensRatio.y * 100}%`,
              backgroundSize: '280%',
              backgroundRepeat: 'no-repeat',
            }}
          >
            <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-black/60 text-white text-[10px] font-semibold backdrop-blur-xs">
              2.8x Zoom
            </div>
          </div>
        )}
      </div>

      {/* Full-Screen Lightbox Modal for Tapping / Full Screen View */}
      {isLightboxOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col items-center justify-between p-4 md:p-8 animate-in fade-in duration-200"
          onClick={() => setIsLightboxOpen(false)}
        >
          {/* Top Bar with title and close button */}
          <div className="w-full max-w-5xl flex items-center justify-between text-white pb-3 border-b border-white/10">
            <div className="flex items-center gap-3">
              <span className="font-semibold text-sm line-clamp-1">{productName}</span>
              {hasMultipleImages && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-white/15 text-white/90">
                  {activeIndex + 1} of {total}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setIsLightboxOpen(false)}
              className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
              aria-label="Close full-screen image view"
            >
              <svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Main Centered Image with Next/Prev Arrows */}
          <div
            className="relative flex-1 w-full max-w-4xl flex items-center justify-center my-4"
            onClick={(e) => e.stopPropagation()}
          >
            <ProductImage
              src={currentImage}
              alt={productName}
              className="max-h-[75vh] max-w-full object-contain rounded-lg shadow-2xl select-none"
            />

            {/* Lightbox Previous Button */}
            {hasMultipleImages && (
              <button
                type="button"
                onClick={goPrev}
                className="absolute left-2 md:-left-12 top-1/2 -translate-y-1/2 size-11 rounded-full bg-black/60 hover:bg-black/90 text-white border border-white/20 flex items-center justify-center transition-all cursor-pointer shadow-lg hover:scale-110 active:scale-95"
                aria-label="Previous image"
              >
                <svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}

            {/* Lightbox Next Button */}
            {hasMultipleImages && (
              <button
                type="button"
                onClick={goNext}
                className="absolute right-2 md:-right-12 top-1/2 -translate-y-1/2 size-11 rounded-full bg-black/60 hover:bg-black/90 text-white border border-white/20 flex items-center justify-center transition-all cursor-pointer shadow-lg hover:scale-110 active:scale-95"
                aria-label="Next image"
              >
                <svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )}
          </div>

          {/* Bottom Thumbnails Strip in Lightbox */}
          {hasMultipleImages && (
            <div
              className="w-full max-w-3xl flex gap-2 overflow-x-auto py-2 px-1 justify-center scrollbar-thin"
              onClick={(e) => e.stopPropagation()}
            >
              {images.map((img, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setActiveIndex(idx)}
                  className={cn(
                    'size-14 shrink-0 rounded-md overflow-hidden border-2 transition-all cursor-pointer bg-black/40',
                    idx === activeIndex
                      ? 'border-emerald-500 scale-105 shadow-md'
                      : 'border-white/20 hover:border-white/60 opacity-60 hover:opacity-100'
                  )}
                >
                  <ProductImage
                    src={img}
                    alt={`${productName} thumbnail ${idx + 1}`}
                    className="size-full object-contain p-0.5"
                    placeholderClassName="size-full p-0"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
