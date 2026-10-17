import { cn } from '@/lib/utils';
import { ProductImage } from './ProductImage';

const COLOR_MAP: Record<string, string> = {
  yellow: '#FACC15',
  blue: '#3B82F6',
  red: '#EF4444',
  green: '#10B981',
  black: '#1F2937',
  white: '#FFFFFF',
  magenta: '#D946EF',
  purple: '#A855F7',
  pink: '#EC4899',
  orange: '#F97316',
  gray: '#6B7280',
  grey: '#6B7280',
  brown: '#854D0E',
  navy: '#1E3A8A',
  maroon: '#800000',
  teal: '#14B8A6',
  olive: '#84CC16',
  gold: '#EAB308',
  silver: '#E5E7EB',
  beige: '#F5F5DC',
  peach: '#FFDAB9',
  lavender: '#E6E6FA',
  cream: '#FFFDD0',
};

export function getColorHex(colorName: string): string {
  const normalized = colorName.toLowerCase().trim();
  if (COLOR_MAP[normalized]) return COLOR_MAP[normalized];
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(normalized)) return normalized;
  return '#94A3B8';
}

export type ColorVariantInfo = {
  color: string;
  sku?: string;
  images?: string[];
};

type ColorSwatchesProps = {
  colors: string[];
  colorVariants?: ColorVariantInfo[];
  selectedColor: string;
  onSelectColor: (color: string) => void;
  className?: string;
};

export function ColorSwatches({
  colors,
  colorVariants = [],
  selectedColor,
  onSelectColor,
  className = '',
}: ColorSwatchesProps) {
  if (!colors || colors.length === 0) return null;

  return (
    <div className={cn('flex flex-wrap gap-2.5 items-center', className)}>
      {colors.map((color) => {
        const isSelected = selectedColor.toLowerCase() === color.toLowerCase();
        const variant = colorVariants.find(
          (v) => v.color.toLowerCase() === color.toLowerCase()
        );
        const variantImage = variant?.images?.[0];
        const hex = getColorHex(color);

        return (
          <button
            key={color}
            type="button"
            onClick={() => onSelectColor(color)}
            aria-label={`Select color ${color}`}
            className={cn(
              'group relative flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold transition-all duration-200 cursor-pointer shadow-2xs',
              isSelected
                ? 'border-emerald-600 bg-emerald-50 text-emerald-950 ring-2 ring-emerald-600 ring-offset-2'
                : 'border-border/80 bg-card text-foreground hover:border-emerald-500 hover:bg-muted/50'
            )}
          >
            {variantImage ? (
              <div className="size-6 shrink-0 rounded-full overflow-hidden border border-border/80 bg-muted/20">
                <ProductImage
                  src={variantImage}
                  alt={color}
                  className="size-full object-cover"
                  placeholderClassName="size-full p-0 text-[8px]"
                />
              </div>
            ) : (
              <span
                className="size-5 shrink-0 rounded-full border border-black/15 shadow-2xs"
                style={{ backgroundColor: hex }}
              />
            )}
            <span>{color}</span>
            {isSelected && (
              <span className="size-1.5 rounded-full bg-emerald-600" />
            )}
          </button>
        );
      })}
    </div>
  );
}
