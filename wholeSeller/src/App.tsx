import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
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

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Suspense fallback={<div className="min-h-screen bg-white" />}><LandingPage /></Suspense>} />
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
