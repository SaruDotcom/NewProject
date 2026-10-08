import { Link, useRouterState, useNavigate } from "@/lib/router";
import {
  Search,
  Favorite,
  FavoriteBorder,
  Notifications,
  NotificationsNone,
  ShoppingCart,
  ShoppingCartOutlined,
  Person,
  Dashboard,
  Inventory2,
  Store,
  Assignment,
  LocationOn,
  Settings,
  Logout,
  KeyboardArrowDown,
  Menu as MenuIcon,
  ChevronRight,
  CheckCircle,
  RateReview,
  LocalOffer,
} from "@mui/icons-material";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useStore } from "@/state/store";
import { cn } from "@/lib/utils";
import { money } from "./primitives";
import { FeedbackModal } from "./FeedbackModal";

const primary = [
  { to: "/products" as const, label: "Products" },
  { to: "/categories" as const, label: "Categories" },
  { to: "/coupons" as const, label: "Coupons & Offers" },
  { to: "/orders" as const, label: "Orders" },
];

const account = [
  { to: "/dashboard" as const, label: "Dashboard", icon: Dashboard },
  { to: "/coupons" as const, label: "Coupons & Offers", icon: LocalOffer },
  { to: "/orders" as const, label: "Orders", icon: Assignment },
  { to: "/wishlist" as const, label: "Wishlist", icon: Favorite },
  {
    to: "/notifications" as const,
    label: "Notifications",
    icon: Notifications,
  },
  { to: "/profile" as const, label: "Business profile", icon: Person },
  { to: "/addresses" as const, label: "Addresses", icon: LocationOn },
  { to: "/settings" as const, label: "Settings", icon: Settings },
];

export function SearchBar({ hero = false }: { hero?: boolean }) {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      navigate({ to: "/products" });
    }
  };

  return (
    <form onSubmit={handleSearch} className="relative w-full">
      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search trade products..."
        className={cn(
          "w-full rounded-xl border border-input bg-background pl-10 pr-4 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 transition-all min-h-[44px]",
          hero && "py-3 text-base rounded-2xl shadow-lg border-primary/20"
        )}
      />
    </form>
  );
}

export function Logo() {
  const { retailerProfile } = useStore();
  const logoUrl = retailerProfile?.logo?.trim();
  const retailerName = retailerProfile?.businessName?.trim() || "My Store";
  const initials = retailerName.slice(0, 2).toUpperCase();

  if (logoUrl) {
    return (
      <Link to="/" className="flex items-center gap-2.5 group focus-visible:outline-none">
        <img
          src={logoUrl}
          alt={retailerName}
          className="size-9 sm:size-10 rounded-xl object-contain border border-border bg-white p-0.5 shadow-sm transition-transform group-hover:scale-105"
        />
        <div className="flex flex-col">
          <span className="font-black text-ink tracking-tight text-lg sm:text-xl leading-none truncate max-w-[180px]">
            {retailerName}
          </span>
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-primary leading-none mt-0.5">
            Wholesale Store
          </span>
        </div>
      </Link>
    );
  }

  return (
    <Link to="/" className="flex items-center gap-2.5 group focus-visible:outline-none">
      <span className="grid size-9 sm:size-10 place-items-center rounded-xl bg-gradient-to-br from-primary to-ink text-primary-foreground font-black text-lg shadow-sm transition-transform group-hover:scale-105">
        {initials}
      </span>
      <div className="flex flex-col">
        <span className="font-black text-ink tracking-tight text-lg sm:text-xl leading-none truncate max-w-[180px]">
          {retailerName}
        </span>
        <span className="text-[10px] font-extrabold uppercase tracking-widest text-primary leading-none mt-0.5">
          Wholesale Store
        </span>
      </div>
    </Link>
  );
}

export function IconLink({
  to,
  label,
  children,
  hoverChildren,
}: {
  to: "/wishlist" | "/notifications" | "/cart";
  label: string;
  children: React.ReactNode;
  hoverChildren: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      aria-label={label}
      className="group relative grid size-10 place-items-center rounded-xl text-foreground transition-colors duration-200 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 min-h-[44px] min-w-[44px]"
    >
      <span className="transition-opacity duration-200 group-hover:opacity-0">
        {children}
      </span>
      <span className="absolute opacity-0 transition-opacity duration-200 group-hover:opacity-100">
        {hoverChildren}
      </span>
    </Link>
  );
}

export function MarketplaceShell({ children }: { children: React.ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const { retailerProfile, logout, isLoggedIn, linkedWholesaler, isLoading } = useStore();
  const auth = ["/login", "/register", "/forgot-password"].includes(path);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const safeRetailerProfile = retailerProfile ?? null;
  const retailerOwnerName = safeRetailerProfile?.ownerName?.trim() || "Retailer";
  const retailerBusinessName = safeRetailerProfile?.businessName?.trim() || "Your business";
  const linkedWholesalerName = linkedWholesaler?.name?.trim() || "NEXORA";
  const linkedWholesalerOwner = linkedWholesaler?.ownerName?.trim() || linkedWholesaler?.name?.trim() || "Supplier";
  const linkedWholesalerLocation = linkedWholesaler?.location?.trim() || "India";

  if (auth) return <>{children}</>;

  const getInitials = (name: string) => {
    const safeName = name?.trim() || "Retailer";
    const parts = safeName.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
    return (safeName.slice(0, 2) || "RT").toUpperCase();
  };

  const initials = getInitials(safeRetailerProfile?.ownerName || safeRetailerProfile?.businessName || "Retailer");

  const profileLabel = isLoading && !safeRetailerProfile ? "Loading profile…" : retailerOwnerName;

  const handleSignOut = () => {
    logout();
    navigate({ to: "/login" });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top Banner */}
      <div className="bg-ink py-2 px-4 text-center text-xs font-semibold text-primary-foreground flex items-center justify-center gap-2">
        <span>Direct B2B Wholesale Marketplace • Free delivery on orders above ₹15,000</span>
      </div>

      {/* Header */}
      <header className="premium-header sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="shell flex h-16 sm:h-18 items-center justify-between gap-3 sm:gap-6">
          <div className="flex items-center gap-3 lg:gap-5">
            <Logo />
            {/* Desktop Navigation Links */}
            <nav className="hidden lg:flex shrink-0 items-center gap-1 ml-1">
              {primary.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  activeProps={{ className: "bg-accent text-primary" }}
                  className="rounded-lg px-3 py-2 text-sm font-extrabold transition-colors hover:bg-accent hover:text-primary"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>

          {/* Desktop Search Bar */}
          <div className="hidden lg:block min-w-0 flex-1 max-w-md">
            <SearchBar />
          </div>

          {/* Header Action Icons */}
          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <IconLink to="/wishlist" label="Wishlist" hoverChildren={<Favorite />}>
              <FavoriteBorder />
            </IconLink>
            <IconLink to="/notifications" label="Notifications" hoverChildren={<Notifications />}>
              <NotificationsNone />
            </IconLink>
            <IconLink to="/cart" label="Cart" hoverChildren={<ShoppingCart />}>
              <ShoppingCartOutlined />
            </IconLink>

            {/* Desktop Profile Dropdown */}
            <div className="group relative hidden lg:block">
              <Button
                variant="ghost"
                className="min-h-[44px] gap-2 rounded-xl px-2 transition-colors duration-200 hover:bg-secondary hover:text-primary"
              >
                <span className="grid size-8 place-items-center rounded-lg border border-border bg-secondary text-xs font-black">
                  {initials}
                </span>
                <KeyboardArrowDown className="size-4 text-muted-foreground" />
              </Button>
              <div className="invisible absolute right-0 top-full w-60 translate-y-1 border rounded-2xl bg-popover p-2 opacity-0 elevated transition-all group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 shadow-lg">
                <div className="px-3 py-2 border-b border-border/60 mb-1">
                  <p className="text-xs font-bold text-ink truncate">{profileLabel}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{retailerBusinessName}</p>
                  <div className="mt-1 text-[10px] font-extrabold text-primary bg-primary/10 px-2 py-0.5 rounded-full inline-block truncate">
                    Linked to: {linkedWholesalerName}
                  </div>
                </div>
                {account.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold hover:bg-accent min-h-[40px]"
                  >
                    <item.icon className="size-4 text-primary" />
                    {item.label}
                  </Link>
                ))}
                <button
                  type="button"
                  onClick={() => setFeedbackModalOpen(true)}
                  className="w-full text-left flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold hover:bg-accent min-h-[40px] text-amber-600 font-bold"
                >
                  <RateReview className="size-4 text-amber-500" />
                  Give Feedback & Review
                </button>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="w-full text-left mt-1 flex items-center gap-3 rounded-xl border-t px-3 py-2.5 text-sm font-bold text-primary hover:bg-accent min-h-[44px]"
                >
                  <Logout className="size-4" />
                  Sign out
                </button>
              </div>
            </div>

            {/* Mobile / Tablet Hamburger Menu Button */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="lg:hidden size-11 rounded-xl min-h-[44px] min-w-[44px]"
                  aria-label="Open mobile menu"
                >
                  <MenuIcon className="size-6 text-ink" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[85vw] max-w-sm p-6 overflow-y-auto">
                <SheetHeader className="text-left border-b pb-4">
                  <SheetTitle className="flex items-center justify-between">
                    <Logo />
                  </SheetTitle>
                </SheetHeader>

                <div className="mt-4 space-y-6">
                  {/* Linked Wholesaler Badge in Drawer */}
                  <div className="flex items-center gap-3 rounded-2xl border border-primary/25 bg-primary/5 p-3.5 text-xs">
                    <Store className="size-5 text-primary shrink-0" />
                    <div>
                      <p className="text-[10px] uppercase font-extrabold text-primary tracking-wider">Shopping With</p>
                      <p className="font-extrabold text-ink text-sm">{linkedWholesalerName}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {linkedWholesalerOwner} • {linkedWholesalerLocation}
                      </p>
                    </div>
                  </div>

                  {/* Search in Drawer */}
                  <SearchBar />

                  {/* Main Nav Links */}
                  <div>
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground mb-2">
                      Navigation
                    </h3>
                    <div className="grid gap-1">
                      <Link
                        to="/"
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex items-center justify-between rounded-xl px-3.5 py-3 text-sm font-extrabold text-ink hover:bg-accent min-h-[44px]"
                      >
                        <span>Home</span>
                        <ChevronRight className="size-4 text-muted-foreground" />
                      </Link>
                      {primary.map((item) => (
                        <Link
                          key={item.to}
                          to={item.to}
                          onClick={() => setMobileMenuOpen(false)}
                          className="flex items-center justify-between rounded-xl px-3.5 py-3 text-sm font-extrabold text-ink hover:bg-accent min-h-[44px]"
                        >
                          <span>{item.label}</span>
                          <ChevronRight className="size-4 text-muted-foreground" />
                        </Link>
                      ))}
                    </div>
                  </div>

                  {/* Account Links */}
                  <div className="border-t pt-4">
                    <div className="mb-3 px-1">
                      <h3 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                        My Retailer Account
                      </h3>
                      <p className="text-xs font-bold text-ink truncate mt-1">{profileLabel}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{retailerBusinessName}</p>
                    </div>
                    <div className="grid gap-1">
                      {account.map((item) => (
                        <Link
                          key={item.to}
                          to={item.to}
                          onClick={() => setMobileMenuOpen(false)}
                          className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-foreground hover:bg-accent min-h-[44px]"
                        >
                          <item.icon className="size-4 text-primary" />
                          <span>{item.label}</span>
                        </Link>
                      ))}
                      <button
                        type="button"
                        onClick={() => {
                          setMobileMenuOpen(false);
                          setFeedbackModalOpen(true);
                        }}
                        className="w-full text-left flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-bold text-amber-600 hover:bg-accent min-h-[44px]"
                      >
                        <RateReview className="size-4 text-amber-500" />
                        <span>Give Feedback & Review</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMobileMenuOpen(false);
                          handleSignOut();
                        }}
                        className="w-full text-left mt-2 flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-3.5 py-3 text-sm font-extrabold text-primary hover:bg-primary/10 min-h-[44px]"
                      >
                        <Logout className="size-4" />
                        <span>Sign out</span>
                      </button>
                    </div>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>

        {/* Mobile Sub-Header Search Bar (visible on mobile screens when drawer is closed) */}
        <div className="lg:hidden border-t border-border/60 bg-card px-4 py-2.5">
          <SearchBar />
        </div>
      </header>

      {/* Main Page Content */}
      <div className="flex-1">{children}</div>

      {/* Footer */}
      <footer className="border-t border-border bg-ink text-primary-foreground mt-auto">
        <div className="shell py-12 sm:py-16">
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 md:grid-cols-4">
            <div>
              <Logo />
              <p className="mt-4 text-xs leading-relaxed text-primary-foreground/70">
                Empowering independent retailers across India with direct access to verified B2B wholesale suppliers.
              </p>
            </div>
            <div>
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-primary-foreground/90">Marketplace</h4>
              <ul className="mt-4 space-y-2 text-xs text-primary-foreground/70">
                <li><Link to="/products" className="hover:text-primary transition-colors min-h-[44px] inline-flex items-center">All Products</Link></li>
                <li><Link to="/categories" className="hover:text-primary transition-colors min-h-[44px] inline-flex items-center">Browse Categories</Link></li>
                {/* ===== COMMENTED OUT: multi-wholesaler discovery & connection-request flow ===== */}
                {/* Reason: switched to single-wholesaler-per-retailer model (wholesaler sends direct registration link) */}
                {/* Kept for potential future use — do not delete */}
                {/* <li><Link to="/wholesalers" className="hover:text-primary transition-colors min-h-[44px] inline-flex items-center">Verified Wholesalers</Link></li> */}
                {/* ===== END COMMENTED OUT SECTION ===== */}
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-primary-foreground/90">Account</h4>
              <ul className="mt-4 space-y-2 text-xs text-primary-foreground/70">
                <li><Link to="/dashboard" className="hover:text-primary transition-colors min-h-[44px] inline-flex items-center">Workspace Dashboard</Link></li>
                <li><Link to="/orders" className="hover:text-primary transition-colors min-h-[44px] inline-flex items-center">Order History</Link></li>
                <li><Link to="/wishlist" className="hover:text-primary transition-colors min-h-[44px] inline-flex items-center">Saved Items</Link></li>
                <li><Link to="/profile" className="hover:text-primary transition-colors min-h-[44px] inline-flex items-center">Business Profile</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-primary-foreground/90">Retailer Support</h4>
              <p className="mt-4 text-xs leading-relaxed text-primary-foreground/70">
                Have questions about wholesale terms or connection requests?
              </p>
              <Button asChild size="sm" variant="secondary" className="mt-4 rounded-xl font-bold min-h-[44px]">
                <Link to="/login">Sign in to workspace</Link>
              </Button>
            </div>
          </div>
          <div className="mt-12 border-t border-primary-foreground/10 pt-6 text-center text-xs text-primary-foreground/50">
            © 2026 NEXORA Retailer Portal. All rights reserved. Trade rates reserved for verified retailers.
          </div>
        </div>
      </footer>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-border/80 bg-background/95 backdrop-blur p-1 md:hidden shadow-lg">
        {[
          { to: "/" as const, label: "Home", icon: Store },
          { to: "/products" as const, label: "Products", icon: Inventory2 },
          { to: "/cart" as const, label: "Cart", icon: ShoppingCart },
          { to: "/orders" as const, label: "Orders", icon: Assignment },
          { to: "/dashboard" as const, label: "Account", icon: Person },
        ].map((i) => (
          <Link
            key={i.to}
            to={i.to}
            className="flex flex-col items-center justify-center gap-1 py-1.5 text-[10px] font-bold min-h-[44px]"
            activeProps={{ className: "text-primary" }}
          >
            <i.icon className="size-5" />
            <span>{i.label}</span>
          </Link>
        ))}
      </nav>

      <AddToCartModal />
      <FeedbackModal open={feedbackModalOpen} onOpenChange={setFeedbackModalOpen} />
    </div>
  );
}

export function AddToCartModal() {
  const { addedToCartProduct, clearAddedToCartProduct, cart, products } = useStore();
  const navigate = useNavigate();

  if (!addedToCartProduct) return null;

  const { product, quantity } = addedToCartProduct;

  const totalItemsCount = cart.reduce((acc, item) => acc + item.quantity, 0);
  const cartTotalPrice = cart.reduce((acc, item) => {
    const p = products.find((pr) => pr.id === item.productId);
    return acc + (p ? p.price * item.quantity : 0);
  }, 0);

  const productImg = product.imageUrl || product.images?.[0];

  return (
    <Dialog open={Boolean(addedToCartProduct)} onOpenChange={(open) => { if (!open) clearAddedToCartProduct(); }}>
      <DialogContent className="max-w-md rounded-2xl p-6 shadow-2xl">
        <DialogHeader className="flex flex-col items-center text-center space-y-2">
          <div className="flex size-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
            <CheckCircle className="size-8" />
          </div>
          <DialogTitle className="text-xl font-extrabold text-ink">
            Item Added to Cart!
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Product has been successfully added to your wholesale cart page.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 flex items-center gap-3.5 rounded-xl border border-border bg-card/60 p-3.5">
          {productImg ? (
            <img src={productImg} alt={product.name} className="size-16 rounded-lg object-contain bg-white p-1 border" />
          ) : (
            <div className="size-16 rounded-lg bg-secondary flex items-center justify-center font-bold text-xs text-muted-foreground">
              {product.brand || "Trade"}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h4 className="font-bold text-sm text-ink truncate">{product.name}</h4>
            <p className="text-xs text-muted-foreground mt-0.5">{product.brand} · {product.category}</p>
            <div className="mt-1 flex items-center gap-2 text-xs">
              <span className="font-extrabold text-primary">{money(product.price)}</span>
              <span className="text-muted-foreground">x {quantity} units</span>
            </div>
          </div>
          <div className="text-right shrink-0">
            <span className="text-[10px] uppercase font-bold text-muted-foreground block">Subtotal</span>
            <div className="font-extrabold text-sm text-ink">{money(product.price * quantity)}</div>
          </div>
        </div>

        <div className="mt-3 rounded-xl bg-secondary/50 p-3 flex justify-between items-center text-xs">
          <span className="text-muted-foreground">Cart Total ({totalItemsCount} item{totalItemsCount === 1 ? "" : "s"})</span>
          <span className="font-extrabold text-ink text-sm">{money(cartTotalPrice)}</span>
        </div>

        <DialogFooter className="mt-4 flex flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            className="w-full sm:w-1/2 rounded-xl font-semibold"
            onClick={clearAddedToCartProduct}
          >
            Continue Shopping
          </Button>
          <Button
            className="w-full sm:w-1/2 rounded-xl font-extrabold bg-primary hover:bg-primary/90 text-primary-foreground"
            onClick={() => {
              clearAddedToCartProduct();
              navigate({ to: "/cart" });
            }}
          >
            <ShoppingCart className="mr-1.5 size-4" /> Go to Cart Page
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FooterGroup({ title, links }: { title: string; links: Array<{ label: string; to: string }> }) {
  return (
    <div>
      <h3 className="font-extrabold text-base text-primary-foreground">{title}</h3>
      <ul className="mt-3 grid gap-2 text-sm text-primary-foreground/75">
        {links.map((l) => (
          <li key={l.label}>
            <Link to={l.to as "/products"} className="hover:text-primary transition-colors">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
