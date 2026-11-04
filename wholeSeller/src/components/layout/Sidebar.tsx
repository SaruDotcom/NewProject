import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  FolderTree,
  Boxes,
  Users,
  Star,
  ShoppingBag,
  TrendingUp,
  CreditCard,
  ShieldCheck,
  LogOut,
  Sparkles,
  Sliders,
  Headphones,
  HandCoins,
  Ticket,
  FileText,
  QrCode,
  BookOpen,
  Palette,
  X,
} from 'lucide-react';
import { useWholesaler } from '@/context/WholesalerContext';
import BusinessLogo from '@/components/BusinessLogo';
import ThokStoreBrand from '@/components/ThokStoreBrand';
import api, { clearAuthToken, type WholesalerSubscription } from '@/lib/api';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

const NAV_ITEMS = [
  { name: 'Overview', path: '/dashboard', icon: LayoutDashboard },
  { name: 'Products', path: '/dashboard/products', icon: Package },
  { name: 'Categories', path: '/dashboard/categories', icon: FolderTree },
  { name: 'Inventory', path: '/dashboard/inventory', icon: Boxes },
  { name: 'Retailers', path: '/dashboard/retailers', icon: Users },
  { name: 'Partner Reviews', path: '/dashboard/reviews', icon: Star },
  { name: 'Credit Policy', path: '/dashboard/credit-policy', icon: HandCoins, badge: 'Credit' },
  { name: 'Payment Settings', path: '/dashboard/payment-settings', icon: QrCode },
  // { name: 'Store Theme', path: '/dashboard/store-theme', icon: Palette },
  { name: 'Khata Book', path: '/dashboard/khata-book', icon: BookOpen },
  { name: 'Coupons & Offers', path: '/dashboard/coupons', icon: Ticket, badge: 'Offers' },
  { name: 'Retailer Banner Slides', path: '/dashboard/banner-slides', icon: Sliders, badge: 'New' },
  { name: 'Orders', path: '/dashboard/orders', icon: ShoppingBag, badge: 'New' },
  { name: 'Business Analytics', path: '/dashboard/analytics', icon: TrendingUp },
  { name: 'Reports', path: '/dashboard/reports', icon: FileText, badge: 'Export' },
  // { name: 'Wallet & Earnings', path: '/dashboard/wallet', icon: CreditCard, badge: 'New' },
  { name: 'Subscription', path: '/dashboard/subscription', icon: CreditCard },
  { name: 'Security', path: '/dashboard/security', icon: ShieldCheck },
  { name: 'Help & Support', path: '/dashboard/support', icon: Headphones },
];

export const Sidebar: React.FC<SidebarProps> = ({ isOpen = false, onClose }) => {
  const location = useLocation();
  const pathname = location.pathname;
  const navigate = useNavigate();
  const { profile } = useWholesaler();
  const [subscription, setSubscription] = useState<WholesalerSubscription | null>(null);

  useEffect(() => {
    let active = true;
    const loadSubscription = async () => {
      try {
        const response = await api.getWholesalerSubscription();
        if (active) setSubscription(response.data.subscription);
      } catch (error) {
        console.warn('Unable to load subscription details for the sidebar.', error);
      }
    };
    void loadSubscription();
    window.addEventListener('wholesaler-subscription-updated', loadSubscription);
    return () => {
      active = false;
      window.removeEventListener('wholesaler-subscription-updated', loadSubscription);
    };
  }, []);

  const handleLogout = () => {
    clearAuthToken();
    navigate('/', { replace: true });
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs lg:hidden transition-opacity duration-300"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed top-0 left-0 h-screen w-72 sm:w-64 bg-tradeflow-navy text-white border-r border-tradeflow-navy-pressed flex flex-col z-50 lg:z-30 select-none shadow-[2px_0_12px_rgba(18,48,74,0.22)] transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Logo Header */}
        <div className="h-16 px-5 sm:px-6 border-b border-tradeflow-navy-hover flex items-center justify-between bg-tradeflow-navy">
          <Link to="/dashboard" onClick={onClose} className="group text-white">
            <ThokStoreBrand />
          </Link>

          {/* Close button on mobile */}
          <button
            type="button"
            onClick={onClose}
            className="lg:hidden p-2 rounded-xl text-tradeflow-gray-200 hover:text-white hover:bg-tradeflow-navy-hover transition-colors"
            aria-label="Close navigation menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Subscription Plan Badge */}
        <div className="mx-3.5 mt-3.5 p-3 rounded-xl bg-tradeflow-navy-hover border border-tradeflow-navy-hover flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-tradeflow-green" />
            <div>
              <div className="text-xs font-semibold text-white">
                {subscription?.planName || 'Subscription'}
              </div>
              {subscription && (
                <div className="text-[11px] text-tradeflow-gray-200 font-medium">
                  ₹{subscription.amount.toLocaleString('en-IN')} / {subscription.billingPeriod === 'YEARLY' ? 'year' : 'month'}
                </div>
              )}
              <div className="text-[11px] text-tradeflow-gray-200 font-medium">
                Status: {subscription?.status || profile.subscriptionStatus || 'Not subscribed'}
              </div>
            </div>
          </div>
          <Link
            to="/dashboard/subscription"
            onClick={onClose}
            className="text-[10px] bg-tradeflow-green text-white font-semibold px-2.5 py-1 rounded-lg hover:bg-tradeflow-green-hover transition-colors"
          >
            Manage
          </Link>
        </div>

        {/* Sidebar Nav Links */}
        <nav className="flex-1 px-3 py-3 overflow-y-auto space-y-0.5">
          <div className="px-3 text-[10px] font-bold text-tradeflow-gray-200 uppercase tracking-wider mb-2">
            Main Menu
          </div>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.path || (item.path !== '/dashboard' && pathname?.startsWith(item.path));
            
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={onClose}
                className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all group relative ${
                  isActive
                    ? 'bg-tradeflow-green text-tradeflow-navy font-bold border-l-4 border-tradeflow-green-100'
                    : 'text-tradeflow-gray-100 hover:bg-tradeflow-navy-hover hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 transition-colors ${isActive ? 'text-tradeflow-navy' : 'text-tradeflow-gray-200 group-hover:text-white'}`} />
                  <span>{item.name}</span>
                </div>
                
                {item.badge && (
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                    item.badge.includes('Pending')
                      ? 'bg-amber-50 text-amber-700 border border-amber-200'
                      : isActive ? 'bg-tradeflow-green text-white' : 'bg-[#F5F5F4] text-[#78716C]'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

      {/* User Profile */}
      <div className="p-3 border-t border-tradeflow-navy-hover bg-tradeflow-navy">
          <div className="p-2 rounded-xl bg-[#FAF9F6] border border-[#E7E5E4] flex items-center justify-between">
            <Link
              to="/dashboard/profile"
              onClick={onClose}
              aria-label="Open business profile"
              className="flex min-w-0 items-center gap-2.5 overflow-hidden text-left"
            >
              <BusinessLogo
                src={profile.businessLogoUrl}
                name={profile.businessName || 'Your business'}
                className="h-8 w-8 rounded-full border border-[#E7E5E4] bg-white text-tradeflow-green"
              />
              <span className="flex min-w-0 flex-col truncate">
                <span className="truncate text-xs font-bold text-[#1C1917]">
                  {profile.businessName || profile.ownerName || 'Wholesaler'}
                </span>
                <span className="truncate text-[10px] text-[#78716C]">
                  {profile.businessName ? profile.ownerName : profile.email}
                </span>
              </span>
            </Link>
            <button
              onClick={handleLogout}
              title="Log Out"
              aria-label="Log out"
              className="shrink-0 rounded-lg p-1.5 text-[#A8A29E] transition-colors hover:bg-gray-100 hover:text-tradeflow-green"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

      </div>

    </aside>
    </>
  );
};
