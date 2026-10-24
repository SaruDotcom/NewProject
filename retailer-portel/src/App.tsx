import { useSyncExternalStore } from "react";
import { MarketplaceShell } from "@/components/marketplace/shell";
import { PortalPage } from "@/components/marketplace/portal-page";
import { HomePage } from "@/components/marketplace/home";
import {
  CategoriesPage,
  ProductDetailPage,
  ProductsPage,
  WholesalerCatalogPage,
  WholesalerProfilePage,
  WholesalersPage,
} from "@/components/marketplace/storefront";
import {
  AddressesPage,
  AuthPage,
  CartPage,
  CheckoutPage,
  CouponsPage,
  DashboardPage,
  NotificationsPage,
  OrderDetailsPage,
  OrdersPage,
  ProfilePage,
  SettingsPage,
  WishlistPage,
} from "@/components/marketplace/workspace";

import { useStore } from "@/state/store";
import { getAuthToken } from "@/api/api";
import { HelpSupportPage } from "@/components/marketplace/support";
import { LandingPage } from "@/components/marketplace/landing";

function isBusinessSetupComplete(profile: ReturnType<typeof useStore>["retailerProfile"]) {
  if (profile.profileComplete) return true;
  return Boolean(
    profile.businessName?.trim() &&
    profile.ownerName?.trim() &&
    profile.address?.trim() &&
    profile.city?.trim() &&
    profile.state?.trim() &&
    profile.pincode?.trim()
  );
}

function subscribe(callback: () => void) {
  window.addEventListener("popstate", callback);
  return () => window.removeEventListener("popstate", callback);
}

function getRouteSnapshot() {
  return window.location.href;
}

function RouterView() {
  const href = useSyncExternalStore(subscribe, getRouteSnapshot, () => "/");
  const url = new URL(href);
  const path = url.pathname.replace(/\/+$/, "") || "/";
  const { isLoggedIn, isLoading, retailerProfile } = useStore();
  const token = getAuthToken();
  const authenticated = isLoggedIn && Boolean(token);

  // Validate token with backend before showing store: prevent flash of store content
  if (isLoading && Boolean(token) && !isLoggedIn) {
    return (
      <div className="min-h-screen bg-[#F4F7F8] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="size-8 border-3 border-[#D8E1E5] border-t-[#20A66A] rounded-full animate-spin" />
          <span className="text-xs font-semibold text-[#647782]">Verifying wholesale session...</span>
        </div>
      </div>
    );
  }

  // Public Landing Page: logged-out visitors who open "/" see a landing page, not the store
  if (path === "/" && !authenticated) {
    const searchParams = new URLSearchParams(url.search);
    const hasRef = searchParams.has("ref");
    if (hasRef) {
      return <AuthPage key={`${path}${url.search}`} mode="register" />;
    }
    return <LandingPage />;
  }
  if (path === "/landing") {
    return <LandingPage />;
  }

  // Public authentication routes
  if (/^\/r\/[^/]+$/.test(path)) {
    return authenticated
      ? <HomePage />
      : <AuthPage key={`${path}${url.search}`} mode="register" />;
  }
  const isRefPath = path === "/register";
  if (path === "/login") {
    const searchParams = new URLSearchParams(url.search);
    const hasRef = searchParams.has("ref");
    if (authenticated && hasRef) return <HomePage />;
    return <AuthPage key={`${path}${url.search}`} mode={hasRef ? "register" : "login"} />;
  }
  if (isRefPath) {
    return <AuthPage key={`${path}${url.search}`} mode="register" />;
  }
  if (path === "/forgot-password") return <AuthPage key={`${path}${url.search}`} mode="forgot" />;

  // Route Guard: Require authentication for all protected store pages
  if (!authenticated) {
    const searchParams = new URLSearchParams(url.search);
    const hasRef = searchParams.has("ref");
    return <AuthPage key={`${path}${url.search}`} mode={hasRef || isRefPath ? "register" : "login"} />;
  }

  if (!isLoading && !isBusinessSetupComplete(retailerProfile) && path !== "/profile" && path !== "/setup") {
    return <ProfilePage setupMode />;
  }

  // Logged-in retailers keep seeing their store home as today
  if (path === "/") return <HomePage />;
  if (path === "/products") return <ProductsPage initialCategory={url.searchParams.get("category") ?? "All"} />;
  if (path.startsWith("/products/")) return <ProductDetailPage productId={decodeURIComponent(path.split("/")[2] ?? "")} />;
  if (path === "/categories") return <CategoriesPage />;
  if (path === "/wholesalers") return <WholesalersPage initialCategory={url.searchParams.get("category") ?? "All"} />;
  if (path.startsWith("/wholesalers/")) {
    const parts = path.split("/");
    if (parts.length >= 4 && parts[3] === "catalog") {
      return <WholesalerCatalogPage wholesalerId={decodeURIComponent(parts[2] ?? "")} />;
    }
    return <WholesalerProfilePage wholesalerId={decodeURIComponent(parts[2] ?? "")} />;
  }
  if (path === "/dashboard") return <DashboardPage />;
  if (path === "/orders") return <OrdersPage />;
  if (path.startsWith("/orders/")) return <OrderDetailsPage orderId={decodeURIComponent(path.split("/")[2] ?? "")} />;
  if (path === "/cart") return <CartPage />;
  if (path === "/checkout") return <CheckoutPage />;
  if (path === "/wishlist") return <WishlistPage />;
  if (path === "/notifications") return <NotificationsPage />;
  if (path === "/support") return <HelpSupportPage />;
  if (path === "/coupons") return <CouponsPage />;
  if (path === "/profile" || path === "/setup") return <ProfilePage setupMode={!isBusinessSetupComplete(retailerProfile)} />;
  if (path === "/addresses") return <AddressesPage />;
  if (path === "/settings") return <SettingsPage />;

  return <PortalPage title="Page not found" body="The page you are looking for does not exist or has moved." />;
}

export default function App() {
  return (
    <MarketplaceShell>
      <RouterView />
    </MarketplaceShell>
  );
}
