import { useState } from 'react';
import { isLegacyLocalProductImageUrl, resolveProductImageUrl } from '@/lib/api';

type ProductImageProps = {
  src?: any;
  alt: string;
  className?: string;
  placeholderClassName?: string;
};

export function ProductImage({ src, alt, className = '', placeholderClassName = '' }: ProductImageProps) {
  const [failed, setFailed] = useState(false);
  const getSrcString = (val: any): string => {
    if (!val) return '';
    if (typeof val === 'string') return val;
    if (typeof val === 'object') {
      if (val.url && typeof val.url === 'string') return val.url;
      if (Array.isArray(val) && val.length > 0) return getSrcString(val[0]);
    }
    return '';
  };
  const rawSrc = getSrcString(src);
  const legacyLocalUrl = isLegacyLocalProductImageUrl(rawSrc);
  const imageUrl = resolveProductImageUrl(rawSrc);

  if (!imageUrl || legacyLocalUrl || failed) {
    return (
      <div className={`flex h-full w-full flex-col items-center justify-center gap-1 bg-tradeflow-gray-50 px-3 text-center ${placeholderClassName}`}>
        <span className="text-xs font-semibold text-tradeflow-gray-700">No product image</span>
        <span className="text-[10px] text-tradeflow-gray-500">{failed ? 'Image failed to load' : 'Add an image'}</span>
      </div>
    );
  }

  return <img src={imageUrl} alt={alt} className={className} onError={() => setFailed(true)} />;
}
