import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  LayoutDashboard,
  Package,
  FolderTree,
  Boxes,
  Users,
  ShoppingBag,
  TrendingUp,
  CreditCard,
  ShieldCheck,
  LogOut,
  Building2,
  Sparkles,
  MessageSquare,
  Sliders,
  Headphones,
  PhoneCall,
  HandCoins,
  Ticket,
  FileText,
  QrCode,
} from 'lucide-react';
import { useWholesaler } from '@/context/WholesalerContext';
import api, { clearAuthToken, type WholesalerSubscription } from '@/lib/api';
import { FeedbackModal } from './FeedbackModal';
import { SuperAdminHelpModal } from './SuperAdminHelpModal';

const NAV_ITEMS = [
  { name: 'Overview', path: '/dashboard', icon: LayoutDashboard },
  { name: 'Products', path: '/dashboard/products', icon: Package },
  { name: 'Categories', path: '/dashboard/categories', icon: FolderTree },
  { name: 'Inventory', path: '/dashboard/inventory', icon: Boxes },
  { name: 'Retailers', path: '/dashboard/retailers', icon: Users },
  { name: 'Credit Policy', path: '/dashboard/credit-policy', icon: HandCoins, badge: 'Credit' },
  { name: 'Payment Settings', path: '/dashboard/payment-settings', icon: QrCode },
  { name: 'Coupons & Offers', path: '/dashboard/coupons', icon: Ticket, badge: 'Offers' },
  { name: 'Retailer Banner Slides', path: '/dashboard/banner-slides', icon: Sliders, badge: 'New' },
  { name: 'Orders', path: '/dashboard/orders', icon: ShoppingBag, badge: 'New' },
  { name: 'Business Analytics', path: '/dashboard/analytics', icon: TrendingUp },
  { name: 'Reports', path: '/dashboard/reports', icon: FileText, badge: 'Export' },
  { name: 'Wallet & Earnings', path: '/dashboard/wallet', icon: CreditCard, badge: 'New' },
  { name: 'Subscription', path: '/dashboard/subscription', icon: CreditCard },
  { name: 'Security', path: '/dashboard/security', icon: ShieldCheck },
  { name: 'Help & Support', path: '/dashboard/support', icon: Headphones },
];

export const Sidebar: React.FC = () => {
  const location = useLocation();
  const pathname = location.pathname;
  const navigate = useNavigate();
  const { profile } = useWholesaler();
  const [showProfile, setShowProfile] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
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
    <aside className="fixed top-0 left-0 h-screen w-64 bg-tradeflow-navy text-white border-r border-tradeflow-navy-pressed flex flex-col z-30 select-none shadow-[2px_0_12px_rgba(18,48,74,0.18)]">
      {/* Brand Logo Header */}
      <div className="h-16 px-6 border-b border-tradeflow-navy-hover flex items-center justify-between bg-tradeflow-navy">
        <Link to="/dashboard" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-tradeflow-green text-white flex items-center justify-center font-bold text-xl shadow-xs group-hover:scale-105 transition-transform">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-base tracking-tight text-white">
              Apex<span className="text-tradeflow-green">Wholesale</span>
            </span>
            <span className="text-[10px] uppercase tracking-wider font-semibold text-tradeflow-green flex items-center gap-1">
              Verified Partner
            </span>
          </div>
        </Link>
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

      {/* User Profile & Super Admin Call Helpline Box */}
      <div className="p-3 border-t border-tradeflow-navy-hover bg-tradeflow-navy space-y-2">
        <button
          type="button"
          onClick={() => setShowHelpModal(true)}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-tradeflow-green text-white rounded-xl text-xs font-semibold hover:bg-tradeflow-green-hover transition-all shadow-xs"
        >
          <PhoneCall className="w-3.5 h-3.5 text-white animate-pulse" />
          <span>Call Super Admin Support</span>
        </button>
        <button
          type="button"
          onClick={() => setShowFeedbackModal(true)}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-[#FAF9F6] text-[#44403C] border border-[#E7E5E4] rounded-xl text-xs font-medium hover:bg-white hover:border-tradeflow-green/30 transition-colors"
        >
          <MessageSquare className="w-3.5 h-3.5 text-[#78716C]" />
          <span>Give Feedback & Review</span>
        </button>

        <div
          className="relative"
          onMouseEnter={() => setShowProfile(true)}
          onMouseLeave={() => setShowProfile(false)}
        >
          <div className="p-2 rounded-xl bg-[#FAF9F6] border border-[#E7E5E4] flex items-center justify-between">
            <button
              type="button"
              onClick={() => setShowProfile((open) => !open)}
              aria-expanded={showProfile}
              aria-label="Open wholesaler contact information"
              className="flex min-w-0 items-center gap-2.5 overflow-hidden text-left"
            >
              {profile.businessLogoUrl ? (
                <img src={profile.businessLogoUrl} alt="" className="h-8 w-8 shrink-0 rounded-full border border-[#E7E5E4] bg-white object-contain" />
              ) : (
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-tradeflow-green text-xs font-bold text-white">
                  {profile.businessName?.charAt(0) || profile.ownerName?.charAt(0) || 'W'}
                </span>
              )}
              <span className="flex min-w-0 flex-col truncate">
                <span className="truncate text-xs font-bold text-[#1C1917]">
                  {profile.businessName || profile.ownerName || 'Wholesaler'}
                </span>
                <span className="truncate text-[10px] text-[#78716C]">
                  {profile.businessName ? profile.ownerName : profile.email}
                </span>
              </span>
            </button>
            <button
              onClick={handleLogout}
              title="Log Out"
              aria-label="Log out"
              className="shrink-0 rounded-lg p-1.5 text-[#A8A29E] transition-colors hover:bg-gray-100 hover:text-tradeflow-green"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

          {showProfile && (
            <div className="absolute bottom-full left-0 z-50 mb-2 w-full rounded-xl border border-[#E7E5E4] bg-white p-4 text-[#1C1917] shadow-xl">
              <p className="truncate text-sm font-bold text-[#1C1917]">{profile.businessName || 'Business details'}</p>
              <dl className="mt-3 space-y-2 text-xs">
                <div>
                  <dt className="text-[#78716C]">Contact name</dt>
                  <dd className="font-semibold text-[#1C1917]">{profile.ownerName || 'Not provided'}</dd>
                </div>
                <div>
                  <dt className="text-[#78716C]">Email</dt>
                  <dd className="break-all font-semibold text-[#1C1917]">{profile.email || 'Not provided'}</dd>
                </div>
                <div>
                  <dt className="text-[#78716C]">Phone</dt>
                  <dd className="font-semibold text-[#1C1917]">{profile.phone || 'Not provided'}</dd>
                </div>
              </dl>
              <Link
                to="/dashboard/profile"
                onClick={() => setShowProfile(false)}
                className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-tradeflow-green hover:underline"
              >
                View details <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          )}
        </div>
      </div>

      <FeedbackModal isOpen={showFeedbackModal} onClose={() => setShowFeedbackModal(false)} />
      <SuperAdminHelpModal isOpen={showHelpModal} onClose={() => setShowHelpModal(false)} />
    </aside>
  );
};
