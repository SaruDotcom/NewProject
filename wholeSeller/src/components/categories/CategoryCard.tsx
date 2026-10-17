import React, { type ReactNode } from 'react';
import { FolderTree } from 'lucide-react';

type CategoryCardProps = {
  name: string;
  coverImage?: string;
  productCount: number;
  subcategoryCount: number;
  description?: string;
  headerActions: ReactNode;
  children?: ReactNode;
  footer: ReactNode;
};

export function CategoryCard({
  name,
  coverImage,
  productCount,
  subcategoryCount,
  description,
  headerActions,
  children,
  footer,
}: CategoryCardProps) {
  const hasSubcategories = subcategoryCount > 0;

  return (
    <article className="group flex h-[520px] w-full min-w-0 flex-col overflow-hidden rounded-2xl border border-[#E7E5E4] bg-white shadow-[0_2px_8px_rgba(0,0,0,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:border-tradeflow-green/30 hover:shadow-[0_8px_20px_rgba(0,0,0,0.06)]">
      {/* 1. Cover Image Header with Discreet Actions and Badge */}
      <div className="relative h-[140px] w-full shrink-0 overflow-hidden bg-[#FAF9F6]">
        {coverImage && (
          <>
            <img
              src={coverImage}
              alt={name}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-black/15" />
          </>
        )}
        
        {/* Discreet Edit & Delete Actions */}
        {headerActions}

        {/* Bottom Banner Title & Product Count Badge */}
        <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between gap-2">
          <h3 className={`min-w-0 truncate text-base font-bold leading-tight tracking-tight ${coverImage ? 'text-white drop-shadow-xs' : 'text-[#1C1917]'}`} title={name}>
            {name}
          </h3>
          <span className="shrink-0 rounded-full bg-white/95 px-2.5 py-0.5 text-[10px] font-bold text-[#1C1917] shadow-xs">
            {productCount} {productCount === 1 ? 'Product' : 'Products'}
          </span>
        </div>
      </div>

      {/* 2. Info Row & Clamped Description */}
      <div className="shrink-0 border-b border-[#F5F5F4] px-4 py-3 bg-white">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#78716C]">
          <span>{subcategoryCount} {subcategoryCount === 1 ? 'subcategory' : 'subcategories'}</span>
          <span className="text-gray-300">·</span>
          <span>{productCount} {productCount === 1 ? 'product' : 'products'}</span>
        </div>
        <p className="mt-1 h-10 line-clamp-2 text-xs leading-5 text-[#57534E] font-normal" title={description || undefined}>
          {description || 'Comprehensive catalog collection for retail buyers.'}
        </p>
      </div>

      {/* 3. Subcategory List with Internal Scroll & Friendly Empty State */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-2.5">
        {hasSubcategories ? (
          children
        ) : (
          <div className="flex h-full min-h-[140px] flex-col items-center justify-center rounded-xl border border-dashed border-[#E7E5E4] bg-[#FAF9F6] p-4 text-center">
            <div className="w-8 h-8 rounded-lg bg-[#F5F5F4] text-[#A8A29E] flex items-center justify-center mb-1.5">
              <FolderTree className="h-4 w-4" />
            </div>
            <span className="text-xs font-semibold text-[#44403C]">No subcategories yet</span>
            <span className="text-[10px] text-[#A8A29E] mt-0.5 max-w-[200px]">
              Add Level 2 departments to organize your wholesale catalog
            </span>
          </div>
        )}
      </div>

      {/* 4. Bottom Button Container perfectly aligned along the baseline */}
      <div className="mt-auto shrink-0 border-t border-[#F5F5F4] bg-[#FAF9F6]/80 p-3">
        {footer}
      </div>
    </article>
  );
}
