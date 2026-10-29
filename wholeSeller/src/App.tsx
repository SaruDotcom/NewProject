import React, { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import LoginPage from './app/login/page';
import RegisterPage from './app/register/page';
import DashboardLayout from './app/dashboard/layout';
import DashboardPage from './app/dashboard/page';
import ProductsPage from './app/dashboard/products/page';
import CategoriesPage from './app/dashboard/categories/page';
import InventoryPage from './app/dashboard/inventory/page';
import ProductDetailPage from './app/dashboard/inventory/ProductDetailPage';
import RetailersPage from './app/dashboard/retailers/page';
import OrdersPage from './app/dashboard/orders/page';
import AnalyticsPage from './app/dashboard/analytics/page';
import ReportsPage from './app/dashboard/reports/page';
import SubscriptionPage from './app/dashboard/subscription/page';
import SecurityPage from './app/dashboard/security/page';
import WalletPage from './app/dashboard/wallet/page';
import WholesalerProfilePage from './app/dashboard/profile/page';
import BannerSlidesPage from './app/dashboard/banner-slides/page';
import CreditPolicyPage from './app/dashboard/credit-policy/page';
import CouponsPage from './app/dashboard/coupons/page';
import SupportPage from './app/dashboard/support/page';
import PaymentSettingsPage from './app/dashboard/payment-settings/page';
import KhataBookPage from './app/dashboard/khata-book/page';
import StoreThemePage from './app/dashboard/store-theme/page';

const LandingPage = lazy(() => import('./app/landing/page'));

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
  );
}

export default App;
