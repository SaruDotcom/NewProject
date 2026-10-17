import { Link } from "@/lib/router";
import { useState, useEffect } from "react";
import { Favorite, ShoppingCart, Star, LocationOn, Verified, Remove, Add, Inventory2, ArrowRight, LocalShipping, VerifiedUser, Delete, WarningAmber } from "@mui/icons-material";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useStore, getCategoryHierarchy, type Product, type Wholesaler, type Order } from "@/state/store";

export const money = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number.isFinite(n) ? n : 0);

export function TradeFlowMark({ className = "size-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="512" height="512" rx="112" fill="#12304A" />
      <rect x="120" y="144" width="272" height="64" rx="16" fill="#20A66A" />
      <rect x="216" y="192" width="80" height="176" rx="16" fill="#20A66A"/>
    </svg>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const good = ["Connected", "Delivered", "Confirmed", "In stock"].includes(status);
  const warn = ["Pending", "Processing", "Request Pending", "Out of stock"].includes(status);
  const info = status === "Shipped";
  const danger = ["Cancelled", "Rejected"].includes(status);
  return (
    <Badge
      variant="outline"
      className={cn(
        "border-0 font-semibold",
        good && "bg-success/10 text-success",
        warn && "bg-warning/15 text-warning-foreground",
        info && "bg-status-info-50 text-status-info-foreground",
        danger && "bg-status-danger-50 text-status-danger",
        !good && !warn && !info && !danger && "bg-muted text-muted-foreground"
      )}
    >
      {status}
    </Badge>
  );
}

export function SectionHeading({
  title,
  subtitle,
  href,
}: {
  title: string;
  subtitle?: string;
  href?: "/products" | "/wholesalers" | "/orders";
}) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div>
        <h2 className="section-title">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {href && (
        <Button asChild variant="ghost" size="sm">
          <Link to={href}>
            View all <ArrowRight />
          </Link>
        </Button>
      )}
    </div>
  );
}

export function ProductVisual({ index, name, className }: { index: number; name: string; className?: string }) {
  void index;
  return (
    <div
      role="img"
      aria-label={name}
      className={cn("grid place-items-center bg-muted text-muted-foreground", className)}
    >
      <Inventory2 className="size-8" />
    </div>
  );
}

export function ProductCard({
  product,
  list = false,
  premium = false,
}: {
  product: Product;
  list?: boolean;
  premium?: boolean;
}) {
  const { wishlist, toggleWishlist, addToCart, addRecentlyViewed, linkedWholesaler } = useStore();
  const supplierName = linkedWholesaler?.name || linkedWholesaler?.businessName || "Connected wholesaler";
  const discount = Math.round((1 - product.price / product.mrp) * 100);
  const getProductImage = () => {
    if (product.imageUrl) return product.imageUrl;
    if (product.images && product.images.length > 0) return product.images[0];
    return undefined;
  };

  const productImg = getProductImage();

  if (premium)
    return (
      <article className="group relative flex h-full min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-xs transition-all duration-200 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg">
        <Link to="/products/$productId" params={{ productId: product.id }} onClick={() => addRecentlyViewed(product.id)} className="relative block aspect-[4/3] overflow-hidden bg-tradeflow-gray-50 p-3">
          {productImg ? (
            <img src={productImg} alt={product.name} className="h-full w-full object-contain mix-blend-multiply transition-transform duration-300 group-hover:scale-105" />
          ) : (
            <ProductVisual index={product.image} name={product.name} className="h-full w-full transition-transform duration-300 group-hover:scale-105" />
          )}
          {!productImg && <span className="absolute left-3 top-3 rounded-sm border border-border bg-card/90 px-2 py-1 text-[10px] font-bold text-muted-foreground">No image</span>}
          {discount > 0 && <span className="absolute bottom-3 left-3 rounded-sm bg-primary px-2 py-1 text-[10px] font-extrabold text-primary-foreground">{discount}% OFF</span>}
        </Link>
        <Button
          aria-label="Remove from wishlist"
          variant="secondary"
          size="icon"
          className="absolute right-3 top-3 rounded-full border border-border/70 bg-card/95 shadow-sm transition-transform duration-200 active:scale-90"
          onClick={() => toggleWishlist(product.id)}
        >
          <Favorite className={cn("fill-primary text-primary")} />
        </Button>
        <div className="flex flex-1 flex-col p-4">
          <p className="truncate text-[10px] font-extrabold uppercase tracking-[0.08em] text-muted-foreground">
            {product.brand} · {product.category}
          </p>
          <Link to="/products/$productId" params={{ productId: product.id }} className="mt-1.5 line-clamp-2 min-h-11 font-bold leading-snug text-ink transition-colors hover:text-primary">
            {product.name}
          </Link>
          <p className="mt-1 truncate text-[11px] text-muted-foreground">Sold by {supplierName}</p>
          <div className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <strong className="text-lg font-extrabold text-ink">{money(product.price)}</strong>
            <span className="text-xs text-muted-foreground line-through">{money(product.mrp)}</span>
            {discount >= 10 && <span className="text-[10px] font-bold text-success">Save {discount}%</span>}
          </div>
          <div className="mt-2 flex items-center justify-between gap-2 text-[11px]">
            <span className="text-muted-foreground">MOQ: <b className="text-foreground">{product.moq} × {product.unit || 'units'}</b></span>
            <span className={cn("rounded-sm px-2 py-1 font-bold", product.stock > 20 ? "bg-success/10 text-success" : "bg-warning/15 text-warning-foreground")}>
              {product.stock > 0 ? "In stock" : "Out of stock"}
            </span>
          </div>
          {product.pricingTiers && product.pricingTiers.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {product.pricingTiers.map((tier) => (
                <span key={tier.id || tier.minQty} className="text-[10px] font-medium bg-secondary/50 text-secondary-foreground px-1.5 py-0.5 rounded-sm">
                  {tier.minQty}+ : {money(tier.pricePerUnit)}
                </span>
              ))}
            </div>
          )}
          {product.categoryAttributes && Object.keys(product.categoryAttributes).length > 0 && (
            <div className="mt-2 flex flex-wrap gap-x-2 gap-y-1 text-[10px] text-muted-foreground">
              {Object.entries(product.categoryAttributes).slice(0, 3).map(([k, v]) => (
                <span key={k}>{k}: {String(v)}</span>
              ))}
            </div>
          )}
        </div>
        <div className="px-4 pb-4">
          <Button
            disabled={product.stock <= 0}
            className="w-full rounded-md font-bold transition-all hover:shadow-md active:scale-[0.98]"
            onClick={() => addToCart(product.id)}
          >
            <ShoppingCart /> {product.stock > 0 ? "Add to cart" : "Out of stock"}
          </Button>
        </div>
      </article>
    );
  return (
    <article className={cn("group relative flex h-full min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-xs transition-all duration-200 hover:border-primary/35 hover:shadow-md", list && "sm:grid sm:grid-cols-[180px_1fr_auto]")}>
      <Link to="/products/$productId" params={{ productId: product.id }} onClick={() => addRecentlyViewed(product.id)} className="relative block overflow-hidden bg-tradeflow-gray-50 p-3">
        {productImg ? (
          <img src={productImg} alt={product.name} className={cn("aspect-[4/3] w-full object-contain mix-blend-multiply transition-transform duration-300 group-hover:scale-[1.03]", list && "sm:aspect-square sm:h-full")} />
        ) : (
          <ProductVisual index={product.image} name={product.name} className={cn("aspect-[4/3] w-full transition-transform duration-300 group-hover:scale-[1.02]", list && "sm:aspect-square sm:h-full")} />
        )}
        {!productImg && <span className="absolute left-3 top-3 rounded-sm border border-border bg-card/90 px-2 py-1 text-[10px] font-bold text-muted-foreground">No image</span>}
        {discount > 0 && <span className="absolute bottom-3 left-3 rounded-sm bg-primary px-2 py-1 text-[10px] font-extrabold text-primary-foreground">{discount}% OFF</span>}
      </Link>
      <Button aria-label="Toggle wishlist" variant="secondary" size="icon" className="absolute right-3 top-3 border border-border/70 bg-card/95 shadow-sm" onClick={() => toggleWishlist(product.id)}>
        <Favorite className={cn(wishlist.includes(product.id) && "fill-primary text-primary")} />
      </Button>
      <div className="flex flex-1 flex-col p-4">
        <p className="truncate text-[10px] font-extrabold uppercase tracking-[0.08em] text-muted-foreground">
          {product.brand} · {product.category}
        </p>
        <Link to="/products/$productId" params={{ productId: product.id }} onClick={() => addRecentlyViewed(product.id)} className="mt-1.5 line-clamp-2 min-h-11 block font-bold leading-snug text-ink hover:text-primary">
          {product.name}
        </Link>
        <p className="mt-1 truncate text-[11px] text-muted-foreground">Sold by {supplierName}</p>
        <div className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <strong className="text-lg font-extrabold text-ink">{money(product.price)}</strong>
          <span className="text-xs text-muted-foreground line-through">{money(product.mrp)}</span>
          {discount >= 10 && <span className="text-[10px] font-bold text-success">Save {discount}%</span>}
        </div>
        <div className="mt-2 flex items-center justify-between gap-2 text-[11px]">
          <span className="text-muted-foreground">MOQ: <b>{product.moq} × {product.unit || 'units'}</b></span>
          <span className={cn("rounded-sm px-2 py-1 font-bold", product.stock > 20 ? "bg-success/10 text-success" : "bg-warning/15 text-warning-foreground")}>
            {product.stock > 0 ? "In stock" : "Out of stock"}
          </span>
        </div>
        {product.pricingTiers && product.pricingTiers.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {product.pricingTiers.map((tier) => (
              <span key={tier.id || tier.minQty} className="text-[10px] font-medium bg-secondary/50 text-secondary-foreground px-1.5 py-0.5 rounded-sm">
                {tier.minQty}+ : {money(tier.pricePerUnit)}
              </span>
            ))}
          </div>
        )}
        {product.categoryAttributes && Object.keys(product.categoryAttributes).length > 0 && (
          <div className="mt-2 flex flex-wrap gap-x-2 gap-y-1 text-[10px] text-muted-foreground">
            {Object.entries(product.categoryAttributes).slice(0, 3).map(([k, v]) => (
              <span key={k}>{k}: {String(v)}</span>
            ))}
          </div>
        )}
      </div>
      <div className={cn("mt-auto px-4 pb-4", list && "sm:flex sm:items-center sm:p-4")}>
        <Button
          disabled={product.stock <= 0}
          className="w-full rounded-md font-bold"
          onClick={() => addToCart(product.id)}
        >
          <ShoppingCart /> {product.stock > 0 ? "Add to cart" : "Out of stock"}
        </Button>
      </div>
    </article>
  );
}

export function ProductGrid({ products, list = false, premium = false }: { products: Product[]; list?: boolean; premium?: boolean }) {
  return (
    <div className={premium ? "grid auto-rows-fr grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8" : cn(list ? "grid gap-3" : "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4")}>
      {products.map((p, index) =>
        premium ? (
          <div key={p.id} className="h-full min-w-0 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2" style={{ animationDelay: `${index * 50}ms` }}>
            <ProductCard product={p} premium />
          </div>
        ) : (
          <ProductCard key={p.id} product={p} list={list} />
        )
      )}
    </div>
  );
}

export function WholesalerCard({ wholesaler, premium = false }: { wholesaler: Wholesaler; premium?: boolean }) {
  const { relationships } = useStore();
  const isConnected = relationships[wholesaler.id] === "Connected";
  if (!premium)
    return (
      <article className="group flex h-full flex-col border bg-card p-5 interactive rounded-2xl">
        <div className="grid size-14 place-items-center bg-ink text-lg font-extrabold text-primary-foreground rounded-xl">{wholesaler.initials}</div>
        <Link to="/wholesalers/$wholesalerId" params={{ wholesalerId: wholesaler.id }} className="mt-5 flex items-center gap-1 text-lg font-extrabold text-ink group-hover:text-primary">
          {wholesaler.name}
          {wholesaler.verified && <Verified className="size-5 text-primary" />}
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Star className="size-3.5 fill-warning text-warning" />
            <b className="text-foreground">{wholesaler.rating}</b> retailer rating
          </span>
          <span className="flex items-center gap-1">
            <LocationOn className="size-3.5" />
            {wholesaler.location}
          </span>
        </div>
        <p className="mt-4 line-clamp-2 text-sm leading-6 text-muted-foreground">{wholesaler.about}</p>
        <div className="mt-5 grid grid-cols-2 gap-2 border-y py-4 text-xs">
          <span className="flex items-center gap-2">
            <Inventory2 className="size-4 text-primary" />
            <span>
              <b className="block text-foreground">{wholesaler.products}+</b>Products
            </span>
          </span>
          <span className="flex items-center gap-2">
            <LocalShipping className="size-4 text-primary" />
            <span>
              <b className="block text-foreground">Reliable</b>
              {wholesaler.delivery}
            </span>
          </span>
        </div>
        <div className="mt-auto flex gap-2 pt-5">
          <Button asChild variant="outline" className="flex-1 rounded-xl">
            <Link to="/wholesalers/$wholesalerId" params={{ wholesalerId: wholesaler.id }}>
              Browse Catalog
            </Link>
          </Button>
          {isConnected && (
            <span className="grid size-9 shrink-0 place-items-center bg-success/10 text-success rounded-xl" title="Connected Wholesaler">
              <VerifiedUser className="size-4" />
            </span>
          )}
        </div>
      </article>
    );
  return (
    <article className="group flex h-full flex-col rounded-2xl border border-border bg-card p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/50 hover:shadow-lg">
      <div className="flex items-start gap-4">
        <div className="relative grid size-16 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-primary to-ink text-lg font-extrabold text-primary-foreground shadow-sm">
          <span>{wholesaler.initials}</span>
          {wholesaler.verified && (
            <span className="absolute -bottom-1 -right-1 grid size-6 place-items-center rounded-full border-2 border-card bg-primary text-primary-foreground" title="Verified partner">
              <Verified className="size-3.5" />
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <Link to="/wholesalers/$wholesalerId" params={{ wholesalerId: wholesaler.id }} className="block truncate text-lg font-extrabold text-ink transition-colors group-hover:text-primary">
            {wholesaler.name}
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2 py-1 font-bold text-warning-foreground">
              <Star className="size-3 fill-warning text-warning" />
              {wholesaler.rating}
            </span>
            <span className="flex items-center gap-1 text-muted-foreground">
              <LocationOn className="size-3.5" />
              {wholesaler.location}
            </span>
          </div>
        </div>
      </div>
      <p className="mt-5 line-clamp-2 text-sm leading-6 text-foreground/75">{wholesaler.about}</p>
      <div className="mt-5 grid grid-cols-2 rounded-xl bg-canvas p-3 text-xs">
        <span className="flex items-center gap-2 border-r border-border pr-3">
          <Inventory2 className="size-4 text-primary" />
          <span>
            <b className="block text-sm text-ink">{wholesaler.products}+</b>
            <span className="text-muted-foreground">Products</span>
          </span>
        </span>
        <span className="flex items-center gap-2 pl-3">
          <LocalShipping className="size-4 text-primary" />
          <span>
            <b className="block text-sm text-ink">Reliable</b>
            <span className="text-muted-foreground">{wholesaler.delivery}</span>
          </span>
        </span>
      </div>
      <div className="mt-auto flex items-center gap-2 pt-6">
        <Button asChild variant="outline" className="flex-1 rounded-xl border-primary/35 text-primary transition-colors hover:bg-primary hover:text-primary-foreground">
          <Link to="/wholesalers/$wholesalerId" params={{ wholesalerId: wholesaler.id }}>
            Browse Catalog <ArrowRight className="size-4" />
          </Link>
        </Button>
        {isConnected && (
          <span className="grid size-9 shrink-0 place-items-center bg-success/10 text-success rounded-xl" title="Connected Wholesaler">
            <VerifiedUser className="size-4" />
          </span>
        )}
      </div>
    </article>
  );
}

export function CartItem({ product, quantity }: { product: Product; quantity: number }) {
  const { setQuantity, removeCart } = useStore();
  const [isRemoving, setIsRemoving] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);

  const minAllowed = Math.max(1, product.moq || 1);
  const quantityUnit = product.unit || 'units';
  const [localVal, setLocalVal] = useState<string>(String(quantity));

  // Sync local input when store quantity changes externally
  useEffect(() => {
    setLocalVal(String(quantity));
  }, [quantity]);

  // Debounced API/store update (450ms delay while typing)
  useEffect(() => {
    const parsed = Number(localVal);
    if (!Number.isInteger(parsed)) return;

    const validatedQty = Math.max(minAllowed, parsed);

    const timer = setTimeout(() => {
      if (validatedQty !== quantity) {
        setQuantity(product.id, validatedQty);
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [localVal, product.id, minAllowed, quantity, setQuantity]);

  const parsedLocal = Number(localVal);
  const displayQty = Number.isInteger(parsedLocal) ? parsedLocal : quantity;
  const effectiveQty = Math.max(minAllowed, displayQty);
  const belowMoq = displayQty < minAllowed;
  const productImage = product.imageUrl || product.images?.[0];

  const handleStep = (delta: number) => {
    const current = Number.isInteger(parsedLocal) ? parsedLocal : quantity;
    const nextQty = Math.max(minAllowed, current + delta);
    setLocalVal(String(nextQty));
    setQuantity(product.id, nextQty);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setLocalVal(val);
    const parsed = Number(val);
    if (Number.isInteger(parsed) && parsed >= minAllowed) {
      // Immediate update to store for instant cart subtotal calculations
      setQuantity(product.id, parsed);
    }
  };

  const handleBlur = () => {
    if (!Number.isInteger(parsedLocal) || parsedLocal < minAllowed) {
      setLocalVal(String(minAllowed));
      setQuantity(product.id, minAllowed);
    } else {
      setQuantity(product.id, parsedLocal);
    }
  };

  const handleRemove = () => {
    setIsRemoving(true);
    setTimeout(() => {
      removeCart(product.id);
    }, 220);
  };

  return (
    <div
      className={cn(
        "group relative grid grid-cols-[68px_minmax(0,1fr)] gap-3.5 py-5 transition-all duration-300 sm:grid-cols-[80px_minmax(0,1fr)_auto_auto] sm:items-center sm:gap-6 border-b border-border/50 last:border-b-0",
        isRemoving && "opacity-0 -translate-x-4 scale-95 pointer-events-none max-h-0 py-0 my-0 overflow-hidden"
      )}
    >
      <Link to="/products/$productId" params={{ productId: product.id }} className="block shrink-0">
        {productImage && !imageFailed ? (
          <img
            src={productImage}
            alt={product.name}
            onError={() => setImageFailed(true)}
            className="aspect-square w-17 bg-card object-contain sm:w-20 rounded-xl shadow-xs border border-border/60 transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <ProductVisual
            index={product.image}
            name={product.name}
            className="aspect-square w-17 sm:w-20 rounded-xl shadow-xs border border-border/60 transition-transform duration-300 group-hover:scale-105"
          />
        )}
      </Link>

      <div className="min-w-0 pr-2 sm:pr-0">
        <span className="text-[10px] font-bold uppercase tracking-wider text-primary/80 block">
          {product.brand} · {product.category}
        </span>
        <Link
          to="/products/$productId"
          params={{ productId: product.id }}
          className="font-extrabold text-ink transition-colors hover:text-primary leading-snug sm:text-base block mt-0.5"
        >
          {product.name}
        </Link>
        <div className="mt-1 flex items-baseline gap-2 text-xs sm:text-sm">
          <span className="font-bold text-foreground">{money(product.price)}</span>
          <span className="text-muted-foreground">per unit</span>
          {product.mrp > product.price && (
            <span className="text-muted-foreground line-through text-xs ml-1">
              {money(product.mrp)}
            </span>
          )}
        </div>

        {belowMoq && (
          <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 border border-amber-500/25 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:text-amber-400">
            <WarningAmber className="size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
            <span>MOQ Warning: Below minimum order ({minAllowed} × {quantityUnit} required)</span>
          </div>
        )}
      </div>

      <div className="col-start-2 flex items-center gap-2 sm:col-start-auto">
        <div className="inline-flex h-9 items-center rounded-full border border-border/80 bg-canvas/90 p-0.5 shadow-xs transition-colors hover:border-primary/40">
          <Button
            type="button"
            aria-label="Decrease quantity"
            variant="ghost"
            size="icon"
            disabled={effectiveQty <= minAllowed}
            className="size-8 rounded-full text-muted-foreground transition-all duration-150 hover:bg-card hover:text-primary active:scale-90 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-muted-foreground cursor-pointer disabled:cursor-not-allowed"
            onClick={() => handleStep(-1)}
          >
            <Remove className="size-3.5" />
          </Button>
          <input
            type="number"
            min={minAllowed}
            step={1}
            value={localVal}
            onChange={handleInputChange}
            onBlur={handleBlur}
            className="w-14 text-center text-sm font-extrabold text-ink bg-transparent focus:outline-hidden focus:ring-1 focus:ring-primary rounded border border-transparent hover:border-border/60 py-0.5 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <Button
            type="button"
            aria-label="Increase quantity"
            variant="ghost"
            size="icon"
            className="size-8 rounded-full text-muted-foreground transition-all duration-150 hover:bg-card hover:text-primary active:scale-90 cursor-pointer"
            onClick={() => handleStep(1)}
          >
            <Add className="size-3.5" />
          </Button>
        </div>

        <Button
          aria-label={`Remove ${product.name} from cart`}
          variant="ghost"
          size="icon"
          className="size-9 rounded-full text-muted-foreground transition-all duration-200 hover:bg-destructive/10 hover:text-destructive active:scale-90"
          onClick={handleRemove}
        >
          <Delete className="size-4" />
        </Button>
      </div>

      <div className="flex items-center justify-between col-span-2 sm:col-span-1 sm:block sm:text-right pt-2 sm:pt-0 border-t border-border/40 sm:border-t-0">
        <span className="text-xs font-semibold text-muted-foreground sm:hidden">Item Total:</span>
        <div>
          <b className="text-base font-extrabold text-ink sm:text-lg block transition-all">
            {money(product.price * effectiveQty)}
          </b>
          <span className="text-[11px] text-muted-foreground hidden sm:block">
            {effectiveQty} × {money(product.price)}
          </span>
        </div>
      </div>
    </div>
  );
}

export function OrderCard({ order }: { order: Order }) {
  const { linkedWholesaler, products, categories } = useStore();
  const supplierName = linkedWholesaler?.name || linkedWholesaler?.businessName || "Connected wholesaler";
  const units = order.items.reduce((sum, item) => sum + item.quantity, 0);
  return (
    <article className="rounded-2xl border border-border/80 bg-card p-5 transition-all duration-200 hover:border-primary/40 shadow-xs">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-bold uppercase tracking-wider text-primary">{order.id}</p>
          <span className="text-xs font-medium text-muted-foreground">Placed {order.date}</span>
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-1.5 font-extrabold text-ink text-base sm:text-lg">
            {supplierName}
            {linkedWholesaler?.verified && <Verified className="size-4 text-primary" />}
          </h3>
          <div className="flex items-center gap-2">
            {order.isCreditOrder ? (
              <Badge className="bg-tradeflow-navy text-white dark:bg-tradeflow-navy-hover dark:text-white font-bold border-tradeflow-navy/20">
                Credit
              </Badge>
            ) : (
              <Badge variant="outline" className="font-semibold text-xs">
                {order.paymentMethod === "ONLINE" ? "Online" : "Cash on Delivery"}
              </Badge>
            )}
            <StatusBadge status={order.status} />
          </div>
        </div>
        {order.isCreditOrder && (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <span className="font-medium text-muted-foreground">Credit Payment Status:</span>
            {order.creditPaymentStatus === "PAID" ? (
              <Badge className="bg-emerald-100 text-emerald-800 font-bold">PAID</Badge>
            ) : order.creditPaymentStatus === "OVERDUE" ? (
              <Badge className="bg-amber-100 text-amber-800 font-bold animate-pulse">OVERDUE</Badge>
            ) : (
              <Badge className="bg-amber-100 text-amber-800 font-bold">PAYMENT PENDING</Badge>
            )}
            {order.creditDueDate && (
              <span className="text-muted-foreground font-medium">
                • Due by <strong className="text-ink">{order.creditDueDate}</strong>
              </span>
            )}
          </div>
        )}
        <p className="mt-1 text-xs text-muted-foreground">Separate fulfilment by this wholesaler</p>
      </div>

      <div className="mt-4 divide-y divide-border/60 border-y border-border/60 py-2">
        {order.items.map((item, idx) => {
          const linkedProduct = item.product || products.find((p) => String(p.id) === String(item.productId));
          const name = item.name || linkedProduct?.name || "Product";
          const imageUrl =
            item.imageUrl ||
            (linkedProduct?.images && linkedProduct.images.length > 0 ? linkedProduct.images[0] : "") ||
            linkedProduct?.imageUrl ||
            "";

          const categoryHierarchy = getCategoryHierarchy(item, products, categories);
          const pricePerUnit = item.pricePerUnit || linkedProduct?.price || 0;
          const itemSubtotal = item.subtotal || pricePerUnit * item.quantity;

          return (
            <div key={item.productId || idx} className="flex items-center gap-3.5 py-3">
              <div className="relative size-12 sm:size-14 shrink-0 overflow-hidden rounded-xl border border-border/80 bg-muted shadow-2xs">
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt={name}
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = "none";
                      const sibling = (e.target as HTMLElement).nextElementSibling;
                      if (sibling) (sibling as HTMLElement).style.display = "flex";
                    }}
                  />
                ) : null}
                <div
                  className="h-full w-full items-center justify-center bg-primary/10 text-primary font-bold"
                  style={{ display: imageUrl ? "none" : "flex" }}
                >
                  <Inventory2 className="size-5 text-primary/70" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-ink text-sm sm:text-base truncate">{name}</h4>
                <p className="text-xs text-primary/80 font-semibold truncate mt-0.5">{categoryHierarchy}</p>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-xs text-muted-foreground">
                  <span>Qty: <strong className="text-ink">{item.quantity}</strong> units</span>
                  <span>•</span>
                  <span>{money(pricePerUnit)} / unit</span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <span className="text-[11px] font-medium text-muted-foreground block">Subtotal</span>
                <strong className="text-sm sm:text-base font-extrabold text-ink">{money(itemSubtotal)}</strong>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <LocalShipping className="size-4 shrink-0 text-primary" />
            {order.status === "Delivered"
              ? "Delivered successfully"
              : order.status === "Cancelled"
              ? "Order closed"
              : "Tracking updates available"}
          </span>
          <span>•</span>
          <span className="font-semibold text-ink">
            Total ({order.items.length} product{order.items.length === 1 ? "" : "s"} · {units} units):{" "}
            <strong className="text-primary font-black text-sm sm:text-base">{money(order.total)}</strong>
          </span>
        </div>
        <Button asChild variant="outline" size="sm" className="rounded-xl font-bold min-h-[44px] sm:min-h-9">
          <Link to="/orders/$orderId" params={{ orderId: order.id }}>
            View details <ArrowRight className="size-4" />
          </Link>
        </Button>
      </div>
    </article>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="grid min-h-72 place-items-center border border-dashed bg-card p-8 text-center">
      <div>
        <Inventory2 className="mx-auto size-10 text-muted-foreground" />
        <h3 className="mt-3 font-bold text-ink">{title}</h3>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{body}</p>
        {action && <div className="mt-5">{action}</div>}
      </div>
    </div>
  );
}
