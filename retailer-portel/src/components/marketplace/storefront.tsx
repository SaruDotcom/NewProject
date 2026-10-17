import { Link, useNavigate } from "@/lib/router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Tune, GridView, List, Star, Verified, LocationOn, LocalShipping, VerifiedUser, ChevronRight, ChevronLeft, Remove, Add, Search, HowToReg, Inventory2, Schedule, Store, Inventory, CheckCircle, HeadsetMic, CurrencyRupee, Business, Handshake } from "@mui/icons-material";
import { ProductCard, ProductGrid, ProductVisual, SectionHeading, StatusBadge, WholesalerCard, money } from "./primitives";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet,SheetContent,SheetHeader,SheetTitle,SheetTrigger } from "@/components/ui/sheet";
import { useStore } from "@/state/store";
import { cn } from "@/lib/utils";
import { CategoryCard } from "./CategoryCard";
import { toast } from "sonner";
import { ProductImage } from "./ProductImage";
import { ColorSwatches } from "./ColorSwatches";
import { ProductImageGallery } from "./ProductImageGallery";

function Filters({
  categories,
  selectedCategories,
  onToggleCategory,
  availability,
  onToggleAvailability,
  minPrice,
  onMinPriceChange,
  maxPrice,
  onMaxPriceChange,
  minRating,
  onMinRatingChange,
  onResetAll,
}: {
  categories: string[];
  selectedCategories: string[];
  onToggleCategory: (cat: string) => void;
  availability: { inStock: boolean; lowStock: boolean; verifiedSellers: boolean };
  onToggleAvailability: (key: "inStock" | "lowStock" | "verifiedSellers") => void;
  minPrice: string;
  onMinPriceChange: (val: string) => void;
  maxPrice: string;
  onMaxPriceChange: (val: string) => void;
  minRating: number | null;
  onMinRatingChange: (rating: number | null) => void;
  onResetAll: () => void;
}) {
  const categoryOptions: string[] = ["All", ...categories];
  const isAll = selectedCategories.includes("All") || selectedCategories.length === 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <b className="text-sm font-bold text-ink">Category</b>
        <button
          onClick={onResetAll}
          className="text-xs text-primary font-semibold hover:underline cursor-pointer"
        >
          Reset all
        </button>
      </div>
      <div className="grid gap-1 max-h-56 overflow-y-auto pr-1">
        {categoryOptions.map((c) => {
          const isChecked = c === "All" ? isAll : selectedCategories.includes(c);
          return (
            <label key={c} className="flex min-h-7 cursor-pointer items-center gap-2 text-sm select-none hover:text-primary">
              <Checkbox
                checked={isChecked}
                onCheckedChange={() => onToggleCategory(c)}
              />
              <span className="truncate">{c}</span>
            </label>
          );
        })}
      </div>

      <div className="border-t pt-4">
        <b className="text-sm font-bold text-ink">Availability</b>
        <div className="mt-3 grid gap-2">
          {[
            { key: "inStock" as const, label: "In stock" },
            { key: "lowStock" as const, label: "Low stock (≤ 20)" },
            { key: "verifiedSellers" as const, label: "Verified sellers" },
          ].map((item) => (
            <label key={item.key} className="flex cursor-pointer items-center gap-2 text-sm select-none hover:text-primary">
              <Checkbox
                checked={availability[item.key]}
                onCheckedChange={() => onToggleAvailability(item.key)}
              />
              <span>{item.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="border-t pt-4">
        <b className="text-sm font-bold text-ink">Price range</b>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Input
            type="number"
            placeholder="Min ₹"
            value={minPrice}
            onChange={(e) => onMinPriceChange(e.target.value)}
          />
          <Input
            type="number"
            placeholder="Max ₹"
            value={maxPrice}
            onChange={(e) => onMaxPriceChange(e.target.value)}
          />
        </div>
      </div>

      <div className="border-t pt-4">
        <b className="text-sm font-bold text-ink">Minimum rating</b>
        <div className="mt-3 flex gap-2">
          {[3, 4, 4.5].map((r) => (
            <Button
              key={r}
              variant={minRating === r ? "default" : "outline"}
              size="sm"
              onClick={() => onMinRatingChange(minRating === r ? null : r)}
              className="rounded-lg font-semibold"
            >
              <Star className={cn("size-3.5 mr-1", minRating === r ? "fill-white text-white" : "fill-warning text-warning")} />
              {r}+
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}

export const categoryImages: Record<string, string> = {
  "Grocery & Staples": "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1200&q=80",
  Beverages: "https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=1200&q=80",
  "Snacks & Foods": "https://images.unsplash.com/photo-1621939514649-280e2ee25f60?auto=format&fit=crop&w=1200&q=80",
  "Home Care": "https://images.unsplash.com/photo-1585421514738-01798e348b17?auto=format&fit=crop&w=1200&q=80",
  "Personal Care": "https://images.unsplash.com/photo-1556228578-0d85b1a4d571?auto=format&fit=crop&w=1200&q=80",
  Kitchenware: "https://images.unsplash.com/photo-1556911220-bff31c812dba?auto=format&fit=crop&w=1200&q=80",
  Stationery: "https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=1200&q=80",
  Electricals: "https://images.unsplash.com/photo-1558002038-1055907df827?auto=format&fit=crop&w=1200&q=80",
  Packaging: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1200&q=80",
  "Health & Wellness": "https://images.unsplash.com/photo-1505751172876-fa1923c5c528?auto=format&fit=crop&w=1200&q=80",
};

export function ProductsPage({ initialCategory = "All" }: { initialCategory?: string }) {
  const [search, setSearch] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>(() =>
    initialCategory && initialCategory !== "All" ? [initialCategory] : ["All"]
  );
  const [availability, setAvailability] = useState({
    inStock: false,
    lowStock: false,
    verifiedSellers: false,
  });
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [minRating, setMinRating] = useState<number | null>(null);

  const [sort, setSort] = useState("popular");
  const [list, setList] = useState(false);
  const { relationships, connectedWholesalers, products, categories } = useStore();

  useEffect(() => {
    if (initialCategory && initialCategory !== "All") {
      setSelectedCategories([initialCategory]);
    }
  }, [initialCategory]);

  const handleToggleCategory = (cat: string) => {
    if (cat === "All") {
      setSelectedCategories(["All"]);
      return;
    }

    setSelectedCategories((prev) => {
      const withoutAll = prev.filter((c) => c !== "All");
      if (withoutAll.includes(cat)) {
        const next = withoutAll.filter((c) => c !== cat);
        return next.length === 0 ? ["All"] : next;
      } else {
        return [...withoutAll, cat];
      }
    });
  };

  const handleToggleAvailability = (key: "inStock" | "lowStock" | "verifiedSellers") => {
    setAvailability((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleResetAll = () => {
    setSearch("");
    setSelectedCategories(["All"]);
    setAvailability({ inStock: false, lowStock: false, verifiedSellers: false });
    setMinPrice("");
    setMaxPrice("");
    setMinRating(null);
  };

  const connectedProducts = useMemo(() => products.filter((p) => relationships[p.wholesalerId] === "Connected"), [products, relationships]);

  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    categories.forEach((c) => {
      if (c.name && !/^[0-9a-fA-F]{24}$/.test(c.name)) set.add(c.name);
    });
    connectedProducts.forEach((p) => {
      if (p.category && !/^[0-9a-fA-F]{24}$/.test(p.category)) set.add(p.category);
    });
    return Array.from(set);
  }, [categories, connectedProducts]);

  const isAllSelected = selectedCategories.includes("All") || selectedCategories.length === 0;

  const shown = useMemo(
    () =>
      connectedProducts
        .filter((p) => {
          const matchesCategory =
            isAllSelected ||
            selectedCategories.some(
              (cat) =>
                cat.toLowerCase() === p.category.toLowerCase() ||
                p.category.toLowerCase().includes(cat.toLowerCase()) ||
                cat.toLowerCase().includes(p.category.toLowerCase())
            );
          const matchesSearch =
            !search ||
            `${p.name} ${p.brand} ${p.category}`.toLowerCase().includes(search.toLowerCase());

          const matchesInStock = !availability.inStock || p.stock > 0;
          const matchesLowStock = !availability.lowStock || (p.stock > 0 && p.stock <= 20);
          const matchesVerified = !availability.verifiedSellers || true;

          const minP = Number(minPrice);
          const matchesMinPrice = !minPrice || isNaN(minP) || p.price >= minP;

          const maxP = Number(maxPrice);
          const matchesMaxPrice = !maxPrice || isNaN(maxP) || p.price <= maxP;

          const matchesRating = !minRating || p.rating >= minRating;

          return (
            matchesCategory &&
            matchesSearch &&
            matchesInStock &&
            matchesLowStock &&
            matchesVerified &&
            matchesMinPrice &&
            matchesMaxPrice &&
            matchesRating
          );
        })
        .sort((a, b) =>
          sort === "low"
            ? a.price - b.price
            : sort === "high"
            ? b.price - a.price
            : b.rating - a.rating
        ),
    [connectedProducts, search, selectedCategories, isAllSelected, availability, minPrice, maxPrice, minRating, sort]
  );

  const filterProps = {
    categories: categoryOptions,
    selectedCategories,
    onToggleCategory: handleToggleCategory,
    availability,
    onToggleAvailability: handleToggleAvailability,
    minPrice,
    onMinPriceChange: setMinPrice,
    maxPrice,
    onMaxPriceChange: setMaxPrice,
    minRating,
    onMinRatingChange: setMinRating,
    onResetAll: handleResetAll,
  };

  const hasActiveFilters =
    !isAllSelected ||
    availability.inStock ||
    availability.lowStock ||
    availability.verifiedSellers ||
    minPrice !== "" ||
    maxPrice !== "" ||
    minRating !== null ||
    search !== "";

  return (
    <main className="shell py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase text-primary">Connected Wholesale Network</p>
          <h1 className="mt-1 text-3xl font-extrabold text-ink">Products</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {shown.length} product{shown.length === 1 ? "" : "s"} available from {connectedWholesalers.length} connected wholesaler{connectedWholesalers.length === 1 ? "" : "s"}
          </p>
        </div>

        <div className="flex gap-2">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" className="lg:hidden">
                <Tune /> Filters
              </Button>
            </SheetTrigger>
            <SheetContent side="left">
              <SheetHeader>
                <SheetTitle>Filter products</SheetTitle>
              </SheetHeader>
              <div className="mt-6 overflow-y-auto">
                <Filters {...filterProps} />
              </div>
            </SheetContent>
          </Sheet>

          <Button
            aria-label="Grid view"
            variant={!list ? "default" : "outline"}
            size="icon"
            onClick={() => setList(false)}
          >
            <GridView />
          </Button>
          <Button
            aria-label="List view"
            variant={list ? "default" : "outline"}
            size="icon"
            onClick={() => setList(true)}
          >
            <List />
          </Button>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3 border-y py-4 sm:flex-row sm:items-center">
        <Input
          placeholder="Search connected products..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:max-w-md"
        />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="h-9 border bg-background px-3 text-sm rounded-lg sm:ml-auto"
          aria-label="Sort products"
        >
          <option value="popular">Most popular</option>
          <option value="low">Price: low to high</option>
          <option value="high">Price: high to low</option>
        </select>
      </div>

      {hasActiveFilters && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="font-bold text-muted-foreground">Active filters:</span>
          {!isAllSelected &&
            selectedCategories.map((cat) => (
              <Badge key={cat} variant="secondary" className="gap-1 rounded-md">
                Category: {cat}
                <button onClick={() => handleToggleCategory(cat)} className="ml-1 font-bold hover:text-destructive">×</button>
              </Badge>
            ))}
          {availability.inStock && (
            <Badge variant="secondary" className="gap-1 rounded-md">
              In Stock
              <button onClick={() => handleToggleAvailability("inStock")} className="ml-1 font-bold hover:text-destructive">×</button>
            </Badge>
          )}
          {availability.lowStock && (
            <Badge variant="secondary" className="gap-1 rounded-md">
              Low Stock
              <button onClick={() => handleToggleAvailability("lowStock")} className="ml-1 font-bold hover:text-destructive">×</button>
            </Badge>
          )}
          {minPrice && (
            <Badge variant="secondary" className="gap-1 rounded-md">
              Min ₹{minPrice}
              <button onClick={() => setMinPrice("")} className="ml-1 font-bold hover:text-destructive">×</button>
            </Badge>
          )}
          {maxPrice && (
            <Badge variant="secondary" className="gap-1 rounded-md">
              Max ₹{maxPrice}
              <button onClick={() => setMaxPrice("")} className="ml-1 font-bold hover:text-destructive">×</button>
            </Badge>
          )}
          {minRating !== null && (
            <Badge variant="secondary" className="gap-1 rounded-md">
              Rating: {minRating}+ ★
              <button onClick={() => setMinRating(null)} className="ml-1 font-bold hover:text-destructive">×</button>
            </Badge>
          )}
          <Button variant="ghost" size="sm" onClick={handleResetAll} className="h-6 text-xs text-primary p-1">
            Clear all
          </Button>
        </div>
      )}

      <div className="mt-7 grid gap-8 lg:grid-cols-[220px_1fr]">
        <aside className="hidden border-r pr-6 lg:block">
          <Filters {...filterProps} />
        </aside>

        {shown.length ? (
          <ProductGrid products={shown} list={list} />
        ) : (
          <div className="border border-dashed bg-card p-10 text-center rounded-2xl">
            <Inventory2 className="mx-auto size-10 text-primary" />
            <h2 className="mt-4 text-xl font-bold text-ink">No products match your search or filters</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              Try selecting a different category or clearing your filter criteria.
            </p>
            <Button className="mt-5 rounded-xl font-bold" onClick={handleResetAll}>
              Reset filters
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}
export function ProductDetailPage({ productId }: { productId: string }) {
  const {
    products,
    linkedWholesaler,
    addToCart,
    toggleWishlist,
    wishlist,
    relationships,
    addRecentlyViewed,
  } = useStore();
  const product = products.find((item) => item.id === productId);
  const w = linkedWholesaler;
  
  useEffect(() => {
    if (product?.id) addRecentlyViewed(product.id);
  }, [product?.id, addRecentlyViewed]);
  
  const [quantity, setQuantity] = useState(1);
  const [selectedColor, setSelectedColor] = useState<string>('');
  const [colorError, setColorError] = useState(false);
  useEffect(() => {
    if (product) setQuantity(product.moq);
  }, [product?.id, product?.moq]);
  
  const navigate = useNavigate();
  
  if (!product || !w)
    return (
      <main className="shell py-16">
        <div className="mx-auto max-w-xl border border-dashed bg-card p-8 text-center rounded-2xl">
          <Inventory2 className="mx-auto size-12 text-muted-foreground" />
          <h1 className="mt-5 text-2xl font-extrabold text-ink">Product not found</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">This product is not available in your connected wholesaler catalog.</p>
          <Button asChild className="mt-6 font-bold rounded-xl">
            <Link to="/products">Browse products</Link>
          </Button>
        </div>
      </main>
    );
    
  const saving = Math.max(0, Math.round((1 - product.price / product.mrp) * 100));
  const orderValue = product.price * quantity;
  const sizeChartRows = product.sizeChart?.measurements || [];
  const sizeChartColumns = [...new Set(sizeChartRows.flatMap((row) => Object.keys(row.measurements || {})))];
  
  if (relationships[product.wholesalerId] !== "Connected")
    return (
      <main className="shell py-16">
        <div className="mx-auto max-w-xl border bg-card p-8 text-center rounded-2xl">
          <HowToReg className="mx-auto size-12 text-primary" />
          <h1 className="mt-5 text-2xl font-extrabold text-ink">Product not unlocked</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">You are not connected with {w.name}. Use the retailer ID shared by this wholesaler to unlock their trade catalogue.</p>
          <Button asChild className="mt-6 font-bold rounded-xl">
            <Link to="/products">Browse connected products</Link>
          </Button>
        </div>
      </main>
    );
    
  const selectedVariant = product.colorVariants?.find(
    (variant) => variant.color.toLowerCase() === selectedColor.toLowerCase()
  );
  const galleryImages = useMemo(() => {
    if (selectedVariant && selectedVariant.images && selectedVariant.images.length > 0) {
      return selectedVariant.images;
    }
    const list = product.images && product.images.length > 0 ? product.images : (product.imageUrl ? [product.imageUrl] : []);
    return list;
  }, [selectedVariant, product.images, product.imageUrl]);

  const activeSku = selectedVariant?.sku || product.specs?.SKU || product.specs?.sku || '';

  const handleAddToCart = () => {
    if (product.colors && product.colors.length > 0 && !selectedColor) {
      setColorError(true);
      toast.error("Please choose a color before adding to cart");
      return;
    }
    addToCart(product.id, quantity, selectedColor || undefined);
  };

  const handleBuyNow = () => {
    if (product.colors && product.colors.length > 0 && !selectedColor) {
      setColorError(true);
      toast.error("Please choose a color before proceeding");
      return;
    }
    addToCart(product.id, quantity, selectedColor || undefined);
    navigate({ to: "/checkout" });
  };

  return (
    <main className="shell py-8">
      <nav className="mb-6 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Link to="/products">Products</Link>
        <ChevronRight className="size-3" />
        <span>{product.category}</span>
        <ChevronRight className="size-3" />
        <span className="text-foreground">{product.name}</span>
      </nav>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(420px,.95fr)]">
        <div>
          <ProductImageGallery
            images={galleryImages}
            productName={product.name}
          />
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Verified className="size-4 text-primary" />
            <span className="text-sm font-bold text-primary">{product.brand}</span>
            <span className="text-sm text-muted-foreground">in {product.category}</span>
          </div>
          <h1 className="mt-3 text-3xl font-extrabold text-ink sm:text-4xl">{product.name}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
            <span className="flex items-center gap-1 font-bold">
              <Star className="size-4 fill-warning text-warning" />
              {product.rating}
            </span>
            <span className="text-muted-foreground">Verified retailer catalog</span>
            <span className={cn("font-semibold", product.stock > 10 ? "text-success" : product.stock > 0 ? "text-warning" : "text-destructive")}>
              {product.stock > 10 ? "In Stock" : product.stock > 0 ? "Low Stock" : "Out of Stock"}
            </span>
          </div>
          <div className="mt-7 border-y py-6">
            <div className="flex flex-wrap items-baseline gap-3">
              <strong className="text-3xl text-ink">{money(product.price)}</strong>
              <span className="text-sm text-muted-foreground">per unit</span>
              <span className="text-muted-foreground line-through">MRP {money(product.mrp)}</span>
              {saving > 0 && <Badge className="bg-success text-success-foreground">Save {saving}%</Badge>}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Wholesale price inclusive of applicable taxes. Final invoice issued by {w.name}.</p>
          </div>
          {product.colors && product.colors.length > 0 && (
            <div className="mt-5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-ink flex items-center gap-2">
                  <span>Color:</span>
                  {selectedColor ? (
                    <span className="text-emerald-700 font-extrabold">{selectedColor}</span>
                  ) : (
                    <span className="text-xs font-normal text-muted-foreground">(Select a color option below)</span>
                  )}
                </p>
                {activeSku && (
                  <span className="text-xs text-muted-foreground font-medium">
                    SKU: <strong className="text-ink">{activeSku}</strong>
                  </span>
                )}
              </div>
              <div className="mt-2.5">
                <ColorSwatches
                  colors={product.colors}
                  colorVariants={product.colorVariants}
                  selectedColor={selectedColor}
                  onSelectColor={(color) => {
                    setSelectedColor(color);
                    setColorError(false);
                  }}
                />
                {colorError && (
                  <p className="mt-2 text-xs font-semibold text-destructive flex items-center gap-1.5 animate-in fade-in">
                    <span>* Please select a color variant before adding to cart.</span>
                  </p>
                )}
              </div>
            </div>
          )}
          
          {product.pricingTiers && product.pricingTiers.length > 0 && (
            <div className="mt-5 border bg-canvas p-4 rounded-xl">
              <h3 className="font-bold text-sm mb-2 text-ink">Bulk Pricing</h3>
              <div className="grid gap-2">
                {product.pricingTiers.map((tier, idx) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{tier.minQty}+ units</span>
                    <strong className="text-ink">{money(tier.pricePerUnit)}</strong>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-5 grid grid-cols-3 gap-2 text-sm">
            <div className="border bg-card p-3 rounded-xl">
              <Inventory2 className="mb-2 size-4 text-primary" />
              <b className="block">MOQ</b>
              <span className="text-muted-foreground">{product.moq} × {product.unit || 'units'}</span>
            </div>
            <div className="border bg-card p-3 rounded-xl">
              <Inventory className="mb-2 size-4 text-success" />
              <b className="block">Availability</b>
              <span className="text-success">{product.stock > 0 ? "In stock" : "Out of stock"}</span>
            </div>
            <div className="border bg-card p-3 rounded-xl">
              <Schedule className="mb-2 size-4 text-primary" />
              <b className="block">Dispatch</b>
              <span className="text-muted-foreground">Within 24h</span>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <label className="text-sm font-bold">Order quantity</label>
              <div className="mt-2 flex h-11 w-fit items-center border bg-card rounded-xl overflow-hidden shadow-2xs">
                <Button aria-label="Decrease quantity" variant="ghost" size="icon" onClick={() => setQuantity((q) => Math.max(product.moq, q - 1))}>
                  <Remove />
                </Button>
                <input
                  type="number"
                  min={product.moq}
                  value={quantity}
                  step={1}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    if (Number.isInteger(val) && val >= product.moq) {
                      setQuantity(val);
                    } else if (e.target.value === "") {
                      setQuantity(product.moq);
                    }
                  }}
                  className="w-20 text-center font-extrabold text-ink text-base bg-transparent focus:outline-hidden focus:ring-1 focus:ring-primary py-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <Button aria-label="Increase quantity" variant="ghost" size="icon" onClick={() => setQuantity((q) => q + 1)}>
                  <Add />
                </Button>
              </div>

              <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] font-semibold text-muted-foreground mr-1">Quick Add:</span>
                {[10, 50, 100, 500].map((inc) => (
                  <button
                    key={inc}
                    type="button"
                    className="px-2 py-0.5 text-xs font-bold rounded-md bg-muted/80 hover:bg-primary hover:text-white transition-all border border-border/50 cursor-pointer"
                    onClick={() => setQuantity((q) => q + inc)}
                  >
                    +{inc}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">Minimum {product.moq} × {product.unit || 'units'}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Order value</p>
              <strong className="text-xl text-ink">{money(orderValue)}</strong>
            </div>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <Button size="lg" onClick={handleAddToCart} className="rounded-xl font-bold cursor-pointer">
              Add to cart
            </Button>
            <Button size="lg" variant="outline" onClick={handleBuyNow} className="rounded-xl font-bold cursor-pointer">
              Buy now
            </Button>
          </div>
          <Button variant="ghost" className="mt-2 w-full rounded-xl" onClick={() => toggleWishlist(product.id)}>
            {wishlist.includes(product.id) ? "Remove from" : "Save to"} wishlist
          </Button>
          <div className="mt-5 border bg-canvas p-5 rounded-xl">
            <div className="flex items-center gap-3">
              <span className="grid size-12 place-items-center rounded-xl bg-ink font-extrabold text-primary-foreground">{w.initials}</span>
              <div className="min-w-0 flex-1 font-bold text-ink flex items-center gap-1">
                {w.businessName || w.name}
                <Verified className="size-4 text-primary" />
                <p className="mt-1 text-xs text-muted-foreground">{w.rating} rating · {w.location}</p>
              </div>
              <StatusBadge status="Connected" />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 border-t pt-4 text-xs">
              <span className="flex gap-2">
                <VerifiedUser className="size-4 text-success" />
                Verified supplier
              </span>
              <span className="flex gap-2">
                <LocalShipping className="size-4 text-success" />
                {w.delivery}
              </span>
            </div>
          </div>
        </div>
      </div>
      <section className="mt-14 grid gap-10 lg:grid-cols-[1fr_360px]">
        <div>
          <h2 className="section-title">Product information</h2>
          <p className="mt-4 leading-7 text-muted-foreground">{product.description}</p>
          <div className="mt-6 divide-y border bg-card rounded-xl overflow-hidden">
            {Object.entries(product.specs).map(([k, v]) => (
              <div key={k} className="grid grid-cols-2 gap-4 p-4 text-sm hover:bg-muted/30">
                <span className="text-muted-foreground">{k}</span>
                <b>{v}</b>
              </div>
            ))}
            {product.sizes && product.sizes.length > 0 && (
              <div className="grid grid-cols-2 gap-4 p-4 text-sm hover:bg-muted/30">
                <span className="text-muted-foreground">Sizes</span>
                <b>{product.sizes.join(", ")}</b>
              </div>
            )}
            {product.colors && product.colors.length > 0 && (
              <div className="grid grid-cols-2 gap-4 p-4 text-sm hover:bg-muted/30">
                <span className="text-muted-foreground">Colors</span>
                <b>{product.colors.join(", ")}</b>
              </div>
            )}
            {product.categoryAttributes && Object.entries(product.categoryAttributes).map(([k, v]) => (
              <div key={k} className="grid grid-cols-2 gap-4 p-4 text-sm hover:bg-muted/30">
                <span className="text-muted-foreground capitalize">{k.replace(/([A-Z])/g, ' $1')}</span>
                <b>{String(v)}</b>
              </div>
            ))}
            {product.additionalOptions && product.additionalOptions.map((opt, idx) => (
              <div key={idx} className="grid grid-cols-2 gap-4 p-4 text-sm hover:bg-muted/30">
                <span className="text-muted-foreground">{opt.name}</span>
                <b>{opt.value}</b>
              </div>
            ))}
          </div>
          {sizeChartRows.length > 0 && sizeChartColumns.length > 0 && (
            <div className="mt-6 overflow-hidden rounded-xl border bg-card">
              <div className="border-b bg-muted/40 px-4 py-3">
                <h3 className="font-bold text-ink">Size chart</h3>
                <p className="mt-1 text-xs text-muted-foreground">Measurements in {product.sizeChart?.unit || 'cm'}</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-max text-left text-sm">
                  <thead className="bg-muted/30 text-xs text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Size</th>
                      {sizeChartColumns.map((column) => <th key={column} className="px-4 py-3 font-semibold">{column}</th>)}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {sizeChartRows.map((row) => (
                      <tr key={row.size}>
                        <th className="px-4 py-3 font-semibold text-ink">{row.size}</th>
                        {sizeChartColumns.map((column) => (
                          <td key={column} className="px-4 py-3 text-muted-foreground">{row.measurements[column] ?? '—'}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
        <aside className="border bg-card p-6 rounded-2xl h-fit">
          <h2 className="text-xl font-bold text-ink">Trade assurance</h2>
          <div className="mt-5 space-y-5">
            {[
              [VerifiedUser, "Verified source", "Business credentials checked"],
              [Inventory, "Quality ready", "Retail-ready packaging"],
              [LocalShipping, "Reliable fulfilment", w.delivery],
              [HeadsetMic, "Retailer support", "Order assistance available"],
            ].map(([Icon, title, body]) => (
              <div key={String(title)} className="flex gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-success/10 text-success">
                  <Icon className="size-4" />
                </span>
                <div>
                  <b className="text-sm">{String(title)}</b>
                  <p className="mt-1 text-xs text-muted-foreground">{String(body)}</p>
                </div>
              </div>
            ))}
          </div>
        </aside>
      </section>
      <section className="mt-14">
        <SectionHeading title="More from this category" subtitle={`Available from ${w.name}`} />
        <ProductGrid products={products.filter((p) => p.category === product.category && p.id !== product.id && relationships[p.wholesalerId] === "Connected").slice(0, 4)} />
      </section>
    </main>
  );
}
export function CategoriesPage() {
  const { relationships, products, categories } = useStore();
  const connectedProducts = useMemo(() => products.filter((p) => relationships[p.wholesalerId] === "Connected"), [products, relationships]);
  const totalProducts = connectedProducts.length;

  return (
    <main>
      <section className="border-y border-primary/10 bg-primary/[0.045]">
        <div className="shell py-16 sm:py-20">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Trade Catalogue</p>
          <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-ink sm:text-5xl">Shop by category</h1>
          <div className="mt-5 h-px w-16 bg-primary" />
          <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground">Explore trade categories supplied by your connected wholesalers.</p>
          <p className="mt-4 text-sm font-semibold text-ink"><span className="text-primary">{categories.length} categories</span><span className="mx-2 text-border">•</span>{totalProducts} trade products available</p>
        </div>
      </section>
      <section className="shell py-12 sm:py-14">
        <div className="mb-10 border-b border-border/80 pb-6"><p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Store catalogue</p><h2 className="mt-2 text-2xl font-extrabold text-ink">Category Directory</h2></div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:gap-5">
          {categories.map((c, i) => {
            const catProductsCount = connectedProducts.filter((p) => p.category === c.name).length;
            const lead = c.name === "Grocery & Staples";
            const featured = lead || c.name === "Home Care";
            return (
              <CategoryCard
                key={c.id}
                name={c.name}
                imageUrl={c.imageUrl || categoryImages[c.name] || categoryImages["Grocery & Staples"]}
                description={c.description}
                subcategories={categories.filter((child) => child.parentId === c.id).map((child) => child.name)}
                itemCount={catProductsCount}
                badge={featured ? (c.name === "Home Care" ? "Trending" : "Popular") : undefined}
                actionLabel="Shop category"
                animationDelay={i * 50}
              />
            );
          })}
          {categories.length === 0 && (
            <div className="col-span-full rounded-2xl border border-dashed bg-card p-12 text-center">
              <Store className="mx-auto size-12 text-muted-foreground" />
              <h2 className="mt-4 font-bold text-ink text-xl">No categories added yet</h2>
              <p className="mt-2 text-sm text-muted-foreground">Your connected wholesaler has not added live categories yet.</p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
// ===== COMMENTED OUT: multi-wholesaler discovery & connection-request flow =====
// Reason: switched to single-wholesaler-per-retailer model (wholesaler sends direct registration link)
// Kept for potential future use — do not delete
/*
export function MultiWholesalersPage({initialCategory="All"}:{initialCategory?:string}) {
  const [q,setQ]=useState("");
  const [category,setCategory]=useState(initialCategory);
  const chipListRef=useRef<HTMLDivElement>(null);
  const {relationships}=useStore();
  const shown=wholesalers.filter(w=>(category==="All"||w.categories.includes(category))&&`${w.name} ${w.location} ${w.categories.join(" ")}`.toLowerCase().includes(q.toLowerCase()));
  const connected=Object.values(relationships).filter(value=>value==="Connected").length;
  const stats=[[Handshake,wholesalers.length,"Partners"],[VerifiedUser,connected,"Connected"],[GridView,categories.length,"Categories"]] as const;

  return <main className="pb-16 sm:pb-20">
    <section className="border-y border-primary/10 bg-gradient-to-br from-canvas via-background to-primary/[0.045]">
      <div className="shell py-10 sm:py-16">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_390px] lg:items-end">
          <div><span className="inline-flex rounded-full bg-primary/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-primary">Verified wholesale network</span><h1 className="mt-4 sm:mt-5 text-3xl sm:text-5xl font-extrabold tracking-tight text-ink"><span className="mr-3 inline-block size-2 rounded-full bg-primary align-middle"/>Find the right wholesaler for every aisle</h1><div className="mt-4 sm:mt-5 h-px w-16 bg-primary"/><p className="mt-4 sm:mt-5 max-w-2xl text-sm sm:text-base leading-relaxed text-muted-foreground">Search by category, review business credentials, and request a connection. Wholesale prices and products unlock only after approval.</p><div className="group relative mt-6 sm:mt-7 max-w-2xl"><Search className="pointer-events-none absolute left-4 sm:left-5 top-1/2 size-5 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary"/><input aria-label="Search wholesaler, city or category" value={q} onChange={e=>setQ(e.target.value)} placeholder="Search wholesaler, city or category" className="h-12 sm:h-14 w-full rounded-full border border-border bg-card pl-11 sm:pl-13 pr-5 text-sm text-ink shadow-sm outline-none transition-all placeholder:text-muted-foreground focus:border-primary focus:ring-4 focus:ring-primary/10"/></div></div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">{stats.map(([Icon,value,label])=><div key={label} className="rounded-2xl border border-border bg-card p-4 shadow-sm"><Icon className="size-5 text-primary"/><strong className="mt-3 block text-2xl text-ink font-black">{value}</strong><span className="mt-0.5 block text-xs font-semibold text-muted-foreground">{label}</span></div>)}</div>
        </div>
      </div>
    </section>
    <section className="shell py-8 sm:py-12"><div className="flex items-end justify-between gap-4"><div><h2 className="text-xl font-extrabold text-ink">Shop by category</h2><p className="mt-1 text-sm text-muted-foreground">Choose a category to see specialists</p></div><Button asChild variant="ghost" size="sm" className="min-h-[44px]"><Link to="/categories">View all <ChevronRight className="size-4"/></Link></Button></div><div className="mt-5 flex items-center gap-3"><button type="button" aria-label="Scroll categories left" onClick={()=>chipListRef.current?.scrollBy({left:-220,behavior:"smooth"})} className="hidden sm:grid size-9 shrink-0 place-items-center rounded-full border bg-card text-muted-foreground shadow-sm transition-colors hover:border-primary hover:text-primary min-h-[44px] min-w-[44px]"><ChevronLeft className="size-4"/></button><div ref={chipListRef} className="flex flex-1 gap-2 overflow-x-auto scroll-smooth pb-2 [scrollbar-width:none]"><Button className="shrink-0 rounded-full px-4 shadow-sm min-h-[44px]" size="sm" variant={category==="All"?"default":"outline"} onClick={()=>setCategory("All")}>All wholesalers</Button>{categories.map(c=><Button className="shrink-0 rounded-full border-border bg-card px-4 transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary min-h-[44px]" key={c.id} size="sm" variant={category===c.name?"default":"outline"} onClick={()=>setCategory(c.name ?? "")}>{c.name}</Button>)}</div><button type="button" aria-label="Scroll categories right" onClick={()=>chipListRef.current?.scrollBy({left:220,behavior:"smooth"})} className="hidden sm:grid size-9 shrink-0 place-items-center rounded-full border bg-card text-muted-foreground shadow-sm transition-colors hover:border-primary hover:text-primary min-h-[44px] min-w-[44px]"><ChevronRight className="size-4"/></button></div></section>
    <section className="shell"><div className="flex flex-wrap items-center justify-between gap-3 border-y py-5 text-sm"><span className="font-semibold text-ink">{shown.length} verified match{shown.length===1?"":"es"} {category!=="All"?`for “${category}”`:"across all categories"}</span><span className="flex items-center gap-2 text-muted-foreground"><VerifiedUser className="size-4 text-success"/>Catalogue access stays private until connected</span></div><div className="mt-8 grid grid-cols-1 items-stretch gap-6 md:grid-cols-2 lg:grid-cols-3 xl:gap-8">{shown.map((w,index)=><div key={w.id} className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2" style={{animationDelay:`${index*50}ms`}}><WholesalerCard wholesaler={w} premium/></div>)}</div>{shown.length===0&&<div className="mt-8 border border-dashed bg-card p-12 text-center"><Search className="mx-auto size-9 text-muted-foreground"/><h2 className="mt-4 font-bold text-ink">No matching wholesalers</h2><p className="mt-2 text-sm text-muted-foreground">Try another category, location or business name.</p><Button className="mt-5 min-h-[44px]" variant="outline" onClick={()=>{setQ("");setCategory("All")}}>Clear search</Button></div>}</section>
  </main>
}
*/
export function WholesalersPage() {
  const { connectedWholesalers } = useStore();

  return (
    <main className="shell py-10 sm:py-16">
      <div className="mb-8 border-b pb-6">
        <span className="inline-flex rounded-full bg-primary/10 px-3.5 py-1 text-[11px] font-extrabold uppercase tracking-[0.16em] text-primary">
          APPROVED PARTNERS
        </span>
        <h1 className="mt-2 text-3xl font-extrabold text-ink sm:text-4xl">My Wholesalers</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {connectedWholesalers.length} wholesaler partner{connectedWholesalers.length === 1 ? "" : "s"} linked to your store via direct invite
        </p>
      </div>

      {connectedWholesalers.length > 0 ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:gap-8">
          {connectedWholesalers.map((w, index) => (
            <div
              key={w.id}
              className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <WholesalerCard wholesaler={w} premium />
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-8 rounded-2xl border border-dashed border-border/80 bg-card p-12 text-center shadow-xs">
          <Store className="mx-auto size-12 text-muted-foreground" />
          <h2 className="mt-4 font-bold text-ink text-xl">No wholesaler connections yet</h2>
          <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
            Use an invite link shared directly by a wholesaler to connect and unlock their trade catalogue.
          </p>
        </div>
      )}
    </main>
  );
}

export function WholesalerProfilePage({ wholesalerId }: { wholesalerId: string }) {
  const { linkedWholesalerId, linkedWholesaler, products } = useStore();
  const targetId = wholesalerId || linkedWholesalerId;
  const w = linkedWholesaler && (!targetId || linkedWholesaler.id === targetId || targetId === "connected-wholesaler") ? linkedWholesaler : linkedWholesaler;
  if (!w) {
    return (
      <main className="shell py-16 text-center">
        <Store className="mx-auto size-12 text-muted-foreground" />
        <h1 className="mt-4 text-2xl font-bold">Wholesaler not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">No live wholesaler is connected to this retailer account.</p>
      </main>
    );
  }
  const visibleProducts = products.filter((p) => p.wholesalerId === w.id);
  const productCategories = Array.from(new Set(visibleProducts.map((item) => item.category).filter(Boolean)));

  return (
    <main className="min-h-screen bg-canvas pb-16">
      {/* Dark Header Section with Subtle Radial Gradient */}
      <section className="relative overflow-hidden border-b border-primary/20 bg-gradient-to-br from-ink via-ink/95 to-ink/90 text-primary-foreground shadow-lg">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/20 via-transparent to-transparent opacity-70 pointer-events-none" />

        <div className="shell relative py-10 sm:py-12">
          {/* Breadcrumbs */}
          <Link
            to="/products"
            className="text-xs font-semibold text-primary-foreground/70 transition-colors hover:text-primary-foreground"
          >
            ← Store catalogue
          </Link>

          {/* Business Banner Info */}
          <div className="mt-6 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
              <span className="grid size-20 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-primary via-primary/90 to-ink text-2xl font-black text-primary-foreground shadow-md border border-primary-foreground/20">
                {w.initials}
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-3xl font-black sm:text-4xl text-primary-foreground tracking-tight">
                    {w.name}
                  </h1>
                  {w.verified && (
                    <Verified className="size-6 text-warning" title="Verified Trade Wholesaler" />
                  )}
                </div>
                <p className="mt-2.5 flex flex-wrap items-center gap-4 text-sm text-primary-foreground/80">
                  <span className="flex items-center gap-1">
                    <LocationOn className="size-4 text-primary" />
                    {w.location}
                  </span>
                  <span className="flex items-center gap-1">
                    <Star className="size-4 fill-warning text-warning" />
                    {w.rating} from 286 retailers
                  </span>
                  <span className="flex items-center gap-1">
                    <Schedule className="size-4 text-primary-foreground/70" />
                    Usually responds within 4 hours
                  </span>
                </p>
              </div>
            </div>

            {/* Action Button: Single "Browse catalog" button */}
            <div>
              <Button asChild size="lg" className="rounded-xl font-bold shadow-md">
                <Link to="/products">
                  Browse full catalog
                </Link>
              </Button>
            </div>
          </div>

          {/* 4 Stat Cards in Header */}
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
            <div className="rounded-xl border border-primary-foreground/15 bg-primary-foreground/[0.06] backdrop-blur-xs p-4 transition-colors hover:bg-primary-foreground/[0.1]">
              <strong className="block text-2xl font-black text-primary-foreground">{w.products}+</strong>
              <span className="text-xs font-semibold text-primary-foreground/70">Products Available</span>
            </div>
            <div className="rounded-xl border border-primary-foreground/15 bg-primary-foreground/[0.06] backdrop-blur-xs p-4 transition-colors hover:bg-primary-foreground/[0.1]">
              <strong className="block text-2xl font-black text-primary-foreground">{w.rating}/5</strong>
              <span className="text-xs font-semibold text-primary-foreground/70">Retailer Rating</span>
            </div>
            <div className="rounded-xl border border-primary-foreground/15 bg-primary-foreground/[0.06] backdrop-blur-xs p-4 transition-colors hover:bg-primary-foreground/[0.1]">
              <strong className="block text-2xl font-black text-primary-foreground">98%</strong>
              <span className="text-xs font-semibold text-primary-foreground/70">On-time Dispatch</span>
            </div>
            <div className="rounded-xl border border-primary-foreground/15 bg-primary-foreground/[0.06] backdrop-blur-xs p-4 transition-colors hover:bg-primary-foreground/[0.1]">
              <strong className="block text-2xl font-black text-primary-foreground">18 yrs</strong>
              <span className="text-xs font-semibold text-primary-foreground/70">Trade Experience</span>
            </div>
          </div>
        </div>
      </section>

      {/* Main Body */}
      <div className="shell py-10 sm:py-12">
        {/* 3 Trust Badges */}
        <section className="grid gap-5 border-b border-border/60 pb-10 md:grid-cols-3">
          <div className="group flex items-start gap-3.5 rounded-xl border border-border/50 bg-card p-4 shadow-2xs transition-all duration-200 hover:border-primary/30 hover:bg-primary/[0.02] hover:shadow-xs">
            <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-brand-soft text-primary transition-transform duration-200 group-hover:scale-105">
              <VerifiedUser className="size-5" />
            </span>
            <div>
              <b className="block font-bold text-ink">Verified trade partner</b>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                Business credentials and catalogue reviewed
              </p>
            </div>
          </div>

          <div className="group flex items-start gap-3.5 rounded-xl border border-border/50 bg-card p-4 shadow-2xs transition-all duration-200 hover:border-primary/30 hover:bg-primary/[0.02] hover:shadow-xs">
            <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-brand-soft text-primary transition-transform duration-200 group-hover:scale-105">
              <LocalShipping className="size-5" />
            </span>
            <div>
              <b className="block font-bold text-ink">Delivery promise</b>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                {w.delivery}
              </p>
            </div>
          </div>

          <div className="group flex items-start gap-3.5 rounded-xl border border-border/50 bg-card p-4 shadow-2xs transition-all duration-200 hover:border-primary/30 hover:bg-primary/[0.02] hover:shadow-xs">
            <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-brand-soft text-primary transition-transform duration-200 group-hover:scale-105">
              <HeadsetMic className="size-5" />
            </span>
            <div>
              <b className="block font-bold text-ink">Retailer support</b>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                Dedicated help for orders and claims
              </p>
            </div>
          </div>
        </section>

        {/* Content & Sidebar Grid */}
        <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_320px]">
          {/* Main Wholesale Catalogue Column */}
          <section>
            <SectionHeading
              title="Wholesale catalogue"
              subtitle={`${visibleProducts.length} products available directly from ${w.name}`}
            />

            {/* Category Filter Tab Pills */}
            <div className="mb-6 flex flex-wrap gap-2">
              {productCategories.map((category) => (
                <Button
                  key={category}
                  asChild
                  size="sm"
                  variant="outline"
                  className="rounded-full border-border/80 bg-card px-4 text-xs font-bold text-foreground shadow-2xs transition-all hover:border-primary hover:bg-primary hover:text-primary-foreground"
                >
                  <Link
                    to="/products"
                    search={{ category }}
                  >
                    {category}
                  </Link>
                </Button>
              ))}
            </div>

            {/* Product Grid with Premium Cards */}
            <ProductGrid products={visibleProducts.slice(0, 8)} premium />

            <Button asChild size="lg" className="mt-8 rounded-xl font-bold shadow-md">
              <Link to="/products">
                Browse full catalog →
              </Link>
            </Button>
          </section>

          {/* Business Profile & Feedback Sidebar */}
          <aside className="space-y-6">
            {/* Highlighted Business Profile Card with Red Left Accent Border */}
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm border-l-4 border-l-primary transition-shadow hover:shadow-md">
              <div className="flex items-center gap-2.5">
                <Business className="size-5 text-primary" />
                <h2 className="font-extrabold text-ink text-base">Business profile</h2>
              </div>
              <p className="mt-3.5 text-xs leading-relaxed text-muted-foreground">
                {w.about}
              </p>
              <dl className="mt-5 divide-y border-t border-border/60 text-xs">
                <div className="flex justify-between gap-4 py-3">
                  <dt className="text-muted-foreground">Established</dt>
                  <dd className="font-bold text-ink">2008</dd>
                </div>
                <div className="flex justify-between gap-4 py-3">
                  <dt className="text-muted-foreground">Service area</dt>
                  <dd className="text-right font-bold text-ink">North & West India</dd>
                </div>
                <div className="flex justify-between gap-4 py-3">
                  <dt className="text-muted-foreground">Minimum order</dt>
                  <dd className="font-bold text-ink">₹5,000</dd>
                </div>
                <div className="flex justify-between gap-4 py-3">
                  <dt className="text-muted-foreground">Payment terms</dt>
                  <dd className="font-bold text-ink">7–15 days</dd>
                </div>
              </dl>
            </div>

            {/* Retailer Feedback Card */}
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <h2 className="font-extrabold text-ink text-base">Retailer feedback</h2>
              <div className="mt-4 flex items-end gap-3">
                <span className="text-4xl font-black text-ink">{w.rating}</span>
                <div>
                  <div className="text-warning text-sm">★★★★★</div>
                  <p className="text-xs text-muted-foreground font-medium">286 verified reviews</p>
                </div>
              </div>
              <blockquote className="mt-4 rounded-r-lg border-l-3 border-primary bg-primary/[0.03] p-3 text-xs leading-relaxed text-muted-foreground">
                “Reliable stock, transparent pricing and clear communication on every order.”
              </blockquote>
            </div>

            {/* Trade Terms Card */}
            <div className="rounded-2xl border border-primary/20 bg-brand-soft/40 p-6 shadow-sm">
              <div className="flex items-center gap-2">
                <CurrencyRupee className="size-5 text-primary" />
                <h2 className="font-extrabold text-ink text-base">Trade terms</h2>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                Invoices include applicable taxes. MOQ and payment terms can vary by product.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

export function WholesalerCatalogPage({ wholesalerId }: { wholesalerId: string }) {
  const { relationships, linkedWholesaler, products } = useStore();
  const w = linkedWholesaler && (!wholesalerId || linkedWholesaler.id === wholesalerId || wholesalerId === "connected-wholesaler") ? linkedWholesaler : linkedWholesaler;

  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [maxPrice, setMaxPrice] = useState<string>("");
  const [sort, setSort] = useState("popular");

  const relationship = w ? relationships[w.id] ?? w.relationship : undefined;

  // Fetch ALL products belonging ONLY to this wholesaler
  const wholesalerProducts = useMemo(
    () => products.filter((p) => p.wholesalerId === w?.id),
    [products, w?.id]
  );

  // Categories this wholesaler actually has products in
  const wholesalerCategories = useMemo(() => {
    const cats = Array.from(new Set(wholesalerProducts.map((p) => p.category)));
    return cats;
  }, [wholesalerProducts]);

  // Filtered products based on search, price range, category, and sort
  const filteredProducts = useMemo(() => {
    return wholesalerProducts
      .filter((p) => {
        const matchesSearch =
          !search ||
          `${p.name} ${p.brand} ${p.category}`.toLowerCase().includes(search.toLowerCase());
        const matchesCat =
          selectedCategory === "All" || p.category === selectedCategory;
        const matchesPrice = !maxPrice || p.price <= Number(maxPrice);
        return matchesSearch && matchesCat && matchesPrice;
      })
      .sort((a, b) => {
        if (sort === "low") return a.price - b.price;
        if (sort === "high") return b.price - a.price;
        return b.rating - a.rating;
      });
  }, [wholesalerProducts, search, selectedCategory, maxPrice, sort]);

  // Group products by category, omitting empty categories
  const groupedSections = useMemo(() => {
    const catsToInclude =
      selectedCategory === "All" ? wholesalerCategories : [selectedCategory];

    return catsToInclude
      .map((catName) => ({
        category: catName,
        products: filteredProducts.filter((p) => p.category === catName),
      }))
      .filter((group) => group.products.length > 0);
  }, [wholesalerCategories, selectedCategory, filteredProducts]);

  if (!w) {
    return (
      <main className="shell py-16 text-center">
        <Store className="mx-auto size-12 text-muted-foreground" />
        <h1 className="mt-4 text-2xl font-bold">Wholesaler not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">No live wholesaler is connected to this retailer account.</p>
      </main>
    );
  }

  // Access Guard
  if (relationship !== "Connected") {
    return (
      <main className="shell py-16 sm:py-24">
        <div className="mx-auto max-w-xl rounded-2xl border border-border bg-card p-10 text-center shadow-md">
          <div className="mx-auto grid size-16 place-items-center rounded-full bg-primary/10 text-primary">
            <HowToReg className="size-8" />
          </div>
          <span className="mt-4 inline-flex rounded-full bg-warning/15 px-3 py-1 text-xs font-bold text-warning-foreground">
            Connection Required
          </span>
          <h1 className="mt-4 text-2xl font-black text-ink sm:text-3xl">
            Access denied — connect with this wholesaler first
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            {w.name}’s trade catalog, wholesale pricing, and inventory details are restricted to connected retailer partners. Please use an invite link provided by {w.name} to connect.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" className="rounded-xl font-bold">
              <Link to="/wholesalers">
                View My Wholesalers
              </Link>
            </Button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-canvas pb-20">
      {/* 1. Wholesaler Business Profile Header (Full-width Banner Strip) */}
      <section className="relative overflow-hidden bg-gradient-to-br from-ink via-ink/95 to-ink/90 text-primary-foreground border-b border-primary/20 shadow-lg">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/25 via-transparent to-transparent opacity-80 pointer-events-none" />
        
        <div className="shell relative py-10 sm:py-12">
          {/* Breadcrumbs */}
          <nav className="mb-6 flex flex-wrap items-center gap-2 text-xs text-primary-foreground/70">
            <Link to="/wholesalers" className="hover:text-primary-foreground transition-colors">
              Wholesalers
            </Link>
            <ChevronRight className="size-3" />
            <Link to="/wholesalers/$wholesalerId" params={{ wholesalerId: w.id }} className="hover:text-primary-foreground transition-colors">
              {w.name}
            </Link>
            <ChevronRight className="size-3" />
            <span className="font-extrabold text-primary-foreground">Browse Storefront</span>
          </nav>

          {/* Profile Banner Card Header */}
          <div className="rounded-2xl border border-primary-foreground/15 bg-card/10 p-6 sm:p-8 backdrop-blur-md shadow-xl">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                {/* Large Avatar with Overlapping Verified Badge */}
                <div className="relative grid size-20 sm:size-24 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-primary via-primary/90 to-ink text-2xl sm:text-3xl font-black text-primary-foreground shadow-lg border-2 border-primary-foreground/20">
                  <span>{w.initials}</span>
                  {w.verified && (
                    <span className="absolute -bottom-2 -right-2 grid size-7 place-items-center rounded-full bg-primary text-primary-foreground border-2 border-ink shadow-md" title="Verified Trade Supplier">
                      <Verified className="size-4" />
                    </span>
                  )}
                </div>

                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-primary-foreground">{w.name}</h1>
                    {w.verified && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/25 border border-primary/40 px-3 py-1 text-xs font-extrabold text-primary-foreground shadow-sm">
                        <Verified className="size-3.5 text-warning" /> Verified Supplier
                      </span>
                    )}
                  </div>

                  <p className="mt-2 text-sm text-primary-foreground/80 max-w-2xl leading-relaxed">
                    {w.about}
                  </p>

                  {/* Key Stats Row */}
                  <div className="mt-4 flex flex-wrap items-center gap-2.5 text-xs">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-warning/20 border border-warning/30 px-3 py-1 font-bold text-warning">
                      <Star className="size-3.5 fill-warning text-warning" />
                      {w.rating} Rating (286 reviews)
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-foreground/10 border border-primary-foreground/15 px-3 py-1 font-medium text-primary-foreground/90">
                      <LocationOn className="size-3.5 text-primary" />
                      {w.location}
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-foreground/10 border border-primary-foreground/15 px-3 py-1 font-medium text-primary-foreground/90">
                      <Inventory2 className="size-3.5 text-primary" />
                      {wholesalerProducts.length}+ Trade Products
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-foreground/10 border border-primary-foreground/15 px-3 py-1 font-medium text-primary-foreground/90">
                      <LocalShipping className="size-3.5 text-success" />
                      {w.delivery}
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-foreground/10 border border-primary-foreground/15 px-3 py-1 font-medium text-primary-foreground/90">
                      <VerifiedUser className="size-3.5 text-success" />
                      18 Yrs Trade Exp.
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap sm:flex-col gap-3 shrink-0">
                <Button asChild variant="secondary" className="rounded-xl font-bold shadow-md">
                  <Link to="/wholesalers/$wholesalerId" params={{ wholesalerId: w.id }}>
                    View Business Profile
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Category Navigation (Sticky Horizontal Tab Bar) */}
      <div className="sticky top-16 z-30 border-y border-border/80 bg-card/95 backdrop-blur-md shadow-sm">
        <div className="shell py-3.5 flex items-center justify-between gap-4">
          <div className="flex flex-1 items-center gap-2 overflow-x-auto pb-1 sm:pb-0 [scrollbar-width:none]">
            <Button
              size="sm"
              variant={selectedCategory === "All" ? "default" : "outline"}
              className={cn(
                "rounded-full px-4 text-xs font-extrabold shrink-0 transition-all duration-200",
                selectedCategory === "All"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "border-border hover:border-primary/40 text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setSelectedCategory("All")}
            >
              All Products
              <span className={cn("ml-2 rounded-full px-2 py-0.5 text-[10px] font-extrabold", selectedCategory === "All" ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground")}>
                {wholesalerProducts.length}
              </span>
            </Button>

            {wholesalerCategories.map((cat) => {
              const count = wholesalerProducts.filter((p) => p.category === cat).length;
              const isSelected = selectedCategory === cat;
              return (
                <Button
                  key={cat}
                  size="sm"
                  variant={isSelected ? "default" : "outline"}
                  className={cn(
                    "rounded-full px-4 text-xs font-extrabold shrink-0 transition-all duration-200",
                    isSelected
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "border-border hover:border-primary/40 text-muted-foreground hover:text-foreground"
                  )}
                  onClick={() => {
                    setSelectedCategory(cat);
                    const el = document.getElementById(`cat-${cat.replace(/\s+/g, "-")}`);
                    if (el) {
                      el.scrollIntoView({ behavior: "smooth", block: "start" });
                    }
                  }}
                >
                  {cat}
                  <span
                    className={cn(
                      "ml-2 rounded-full px-2 py-0.5 text-[10px] font-extrabold",
                      isSelected
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {count}
                  </span>
                </Button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Scoped Search & Filter Toolbar */}
      <div className="shell py-6">
        <div className="flex flex-col sm:flex-row flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={`Search within ${w.name}'s products...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 h-10 rounded-xl bg-canvas"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
              <span>Max Price:</span>
              <Input
                type="number"
                placeholder="Max ₹"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                className="h-9 w-24 rounded-lg text-xs bg-canvas"
              />
            </div>

            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="h-9 rounded-lg border border-border bg-canvas px-3 text-xs font-bold text-ink outline-none"
              aria-label="Sort products"
            >
              <option value="popular">Most popular</option>
              <option value="low">Price: Low to High</option>
              <option value="high">Price: High to Low</option>
            </select>

            {(search || selectedCategory !== "All" || maxPrice) && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs font-bold text-primary hover:bg-primary/10"
                onClick={() => {
                  setSearch("");
                  setSelectedCategory("All");
                  setMaxPrice("");
                }}
              >
                Reset filters
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* 3. Category Sections with Accent Headers & Alternating Background Tints */}
      <div className="shell space-y-12 py-4 pb-20">
        {groupedSections.length > 0 ? (
          groupedSections.map(({ category: catName, products: catProds }, sectionIdx) => (
            <section
              key={catName}
              id={`cat-${catName.replace(/\s+/g, "-")}`}
              className={cn(
                "scroll-mt-36 rounded-2xl border border-border/80 p-6 sm:p-8 shadow-sm transition-all duration-300",
                sectionIdx % 2 === 0 ? "bg-card" : "bg-canvas"
              )}
            >
              {/* Category Header with Red Accent Underline */}
              <div className="mb-8 border-b border-border/60 pb-5">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <span className="inline-flex rounded-full bg-primary/10 px-3.5 py-1 text-[11px] font-extrabold uppercase tracking-[0.16em] text-primary">
                      CATEGORY
                    </span>
                    <h2 className="mt-1.5 text-2xl sm:text-3xl font-black text-ink">{catName}</h2>
                    <div className="mt-2.5 h-1 w-12 rounded-full bg-primary" />
                  </div>
                  <span className="rounded-full bg-primary/10 border border-primary/20 px-3.5 py-1.5 text-xs font-extrabold text-primary">
                    {catProds.length} trade product{catProds.length === 1 ? "" : "s"}
                  </span>
                </div>
              </div>

              {/* Product Grid with Stagger Fade Animation */}
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
                {catProds.map((p, index) => (
                  <div
                    key={p.id}
                    className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2"
                    style={{ animationDelay: `${index * 60}ms` }}
                  >
                    <ProductCard product={p} premium />
                  </div>
                ))}
              </div>
            </section>
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-card p-14 text-center shadow-sm">
            <Search className="mx-auto size-12 text-muted-foreground" />
            <h3 className="mt-4 text-xl font-bold text-ink">No matching products found</h3>
            <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
              Try adjusting your search query or price filter for {w.name}.
            </p>
            <Button
              className="mt-6 rounded-xl font-bold"
              variant="outline"
              onClick={() => {
                setSearch("");
                setSelectedCategory("All");
                setMaxPrice("");
              }}
            >
              Clear filters
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}
