import React, { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
const LoginPage = lazy(() => import('./app/login/page'));
const RegisterPage = lazy(() => import('./app/register/page'));
const DashboardLayout = lazy(() => import('./app/dashboard/layout'));
const DashboardPage = lazy(() => import('./app/dashboard/page'));
const ProductsPage = lazy(() => import('./app/dashboard/products/page'));
const CategoriesPage = lazy(() => import('./app/dashboard/categories/page'));
const InventoryPage = lazy(() => import('./app/dashboard/inventory/page'));
const ProductDetailPage = lazy(() => import('./app/dashboard/inventory/ProductDetailPage'));
const RetailersPage = lazy(() => import('./app/dashboard/retailers/page'));
const OrdersPage = lazy(() => import('./app/dashboard/orders/page'));
const AnalyticsPage = lazy(() => import('./app/dashboard/analytics/page'));
const ReportsPage = lazy(() => import('./app/dashboard/reports/page'));
const SubscriptionPage = lazy(() => import('./app/dashboard/subscription/page'));
const SecurityPage = lazy(() => import('./app/dashboard/security/page'));
const WalletPage = lazy(() => import('./app/dashboard/wallet/page'));
const WholesalerProfilePage = lazy(() => import('./app/dashboard/profile/page'));
const BannerSlidesPage = lazy(() => import('./app/dashboard/banner-slides/page'));
const CreditPolicyPage = lazy(() => import('./app/dashboard/credit-policy/page'));
const CouponsPage = lazy(() => import('./app/dashboard/coupons/page'));
const SupportPage = lazy(() => import('./app/dashboard/support/page'));
const PaymentSettingsPage = lazy(() => import('./app/dashboard/payment-settings/page'));
const KhataBookPage = lazy(() => import('./app/dashboard/khata-book/page'));
const StoreThemePage = lazy(() => import('./app/dashboard/store-theme/page'));

const LandingPage = lazy(() => import('./app/landing/page'));

function PageLoadingFallback() {
  return (
    <div className="min-h-screen bg-[#FAF9F6] p-6" role="status" aria-label="Loading page" aria-busy="true">
      <div className="mx-auto max-w-[1440px] animate-pulse space-y-5">
        <div className="h-8 w-56 rounded-lg bg-stone-200" />
        <div className="h-40 rounded-2xl bg-stone-100" />
        <div className="h-72 rounded-2xl bg-stone-100" />
      </div>
    </div>
  );
}

function LandingRoute() {
  const location = useLocation();
  const referralCode = new URLSearchParams(location.search).get('ref')?.trim();
  const retailerPortalUrl = import.meta.env.VITE_RETAILER_URL?.trim();
  let retailerRedirectUrl = '';
  let referralError = '';

  if (referralCode) {
    if (!retailerPortalUrl) {
      referralError = 'Retailer portal URL is not configured. Please open this link from the retailer portal.';
    } else {
      try {
        const retailerUrl = new URL(retailerPortalUrl);
        if (retailerUrl.protocol !== 'http:' && retailerUrl.protocol !== 'https:') {
          throw new Error('Unsupported retailer portal URL protocol');
        }
        const destination = new URL('/', retailerUrl);
        destination.search = location.search;
        destination.searchParams.set('ref', referralCode);
        retailerRedirectUrl = destination.toString();
      } catch {
        referralError = 'Retailer portal URL is invalid. Please open this link from the retailer portal.';
      }
    }
  }

  useEffect(() => {
    if (retailerRedirectUrl) window.location.replace(retailerRedirectUrl);
  }, [retailerRedirectUrl]);

  if (referralCode) {
    return referralError ? (
      <main role="alert" className="flex min-h-screen items-center justify-center p-6 text-center text-sm font-semibold text-red-700">
        {referralError}
      </main>
    ) : (
      <main className="flex min-h-screen items-center justify-center p-6 text-sm text-gray-600">
        Opening the retailer portal...
      </main>
    );
  }

  return <Suspense fallback={<div className="min-h-screen bg-white" />}><LandingPage /></Suspense>;
}

export function App() {
  return (
    <Suspense fallback={<PageLoadingFallback />}>
      <Routes>
        <Route path="/" element={<LandingRoute />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        <Route path="/dashboard" element={<DashboardLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="products" element={<ProductsPage />} />
          <Route path="categories" element={<CategoriesPage />} />
          <Route path="inventory" element={<InventoryPage />} />
          <Route path="inventory/:productId" element={<ProductDetailPage />} />
          <Route path="retailers" element={<RetailersPage />} />
          <Route path="banner-slides" element={<BannerSlidesPage />} />
          <Route path="orders" element={<OrdersPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="credit-policy" element={<CreditPolicyPage />} />
          <Route path="payment-settings" element={<PaymentSettingsPage />} />
          <Route path="store-theme" element={<StoreThemePage />} />
          <Route path="khata-book" element={<KhataBookPage />} />
          <Route path="coupons" element={<CouponsPage />} />
          <Route path="wallet" element={<WalletPage />} />
          <Route path="profile" element={<WholesalerProfilePage />} />
          <Route path="kyc" element={<Navigate to="/dashboard/profile?tab=kyc" replace />} />
          <Route path="subscription" element={<SubscriptionPage />} />
          <Route path="security" element={<SecurityPage />} />
          <Route path="support" element={<SupportPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Suspense>
  );
}

export default App;
