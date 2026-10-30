import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

type ProductImageProps = {
  src?: any;
  alt: string;
  className?: string;
  placeholderClassName?: string;
  onClick?: () => void;
  onMouseEnter?: () => void;
};

export function ProductImage({
  src,
  alt,
  className = '',
  placeholderClassName = '',
  onClick,
  onMouseEnter,
}: ProductImageProps) {
  const [failed, setFailed] = useState(false);

  const getSrcString = (val: any): string => {
    if (!val) return '';
    if (typeof val === 'string') return val.trim();
    if (typeof val === 'object') {
      if (val.url && typeof val.url === 'string') return val.url.trim();
      const keys = Object.keys(val).filter((k) => /^\d+$/.test(k)).sort((a, b) => Number(a) - Number(b));
      if (keys.length > 5) {
        return keys.map((k) => val[k]).join('').trim();
      }
    }
    return '';
  };

  const rawSrc = getSrcString(src);

  useEffect(() => {
    setFailed(false);
  }, [rawSrc]);

  if (!rawSrc || failed) {
    return (
      <div
        className={cn(
          'flex h-full w-full flex-col items-center justify-center gap-1.5 bg-muted/40 p-4 text-center rounded-xl border border-border/50 text-muted-foreground select-none',
          placeholderClassName
        )}
        onClick={onClick}
      >
        <svg className="size-8 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <span className="text-xs font-semibold">
          {failed ? 'Image failed to load' : 'No image'}
        </span>
      </div>
    );
  }

  return (
    <img
      src={rawSrc}
      alt={alt}
      className={className}
      onError={() => setFailed(true)}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      loading="lazy"
      decoding="async"
    />
  );
}
