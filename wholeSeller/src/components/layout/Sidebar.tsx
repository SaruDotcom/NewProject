import React, { useState } from 'react';
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
  FileCheck2,
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
} from 'lucide-react';
import { useWholesaler } from '@/context/WholesalerContext';
import { FeedbackModal } from './FeedbackModal';
import { SuperAdminHelpModal } from './SuperAdminHelpModal';

const NAV_ITEMS = [
  { name: 'Overview', path: '/dashboard', icon: LayoutDashboard },
  { name: 'Products', path: '/dashboard/products', icon: Package },
  { name: 'Categories', path: '/dashboard/categories', icon: FolderTree },
  { name: 'KYC Verification', path: '/dashboard/kyc', icon: FileCheck2 },
  { name: 'Inventory', path: '/dashboard/inventory', icon: Boxes },
  { name: 'Retailers', path: '/dashboard/retailers', icon: Users },
  { name: 'Credit Policy', path: '/dashboard/credit-policy', icon: HandCoins, badge: 'Credit' },
  { name: 'Coupons & Offers', path: '/dashboard/coupons', icon: Ticket, badge: 'Offers' },
  { name: 'Retailer Banner Slides', path: '/dashboard/banner-slides', icon: Sliders, badge: 'New' },
  { name: 'Orders', path: '/dashboard/orders', icon: ShoppingBag, badge: 'New' },
  { name: 'Business Analytics', path: '/dashboard/analytics', icon: TrendingUp },
  { name: 'Reports', path: '/dashboard/reports', icon: FileText, badge: 'Export' },
  { name: 'Wallet & Earnings', path: '/dashboard/wallet', icon: CreditCard, badge: 'New' },
  { name: 'Subscription', path: '/dashboard/subscription', icon: CreditCard, badge: '₹300/mo' },
  { name: 'Security', path: '/dashboard/security', icon: ShieldCheck },
];

export const Sidebar: React.FC = () => {
  const location = useLocation();
  const pathname = location.pathname;
  const navigate = useNavigate();
  const { profile } = useWholesaler();
  const [showProfile, setShowProfile] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);

  const handleLogout = () => {
    navigate('/login');
  };

  return (
    <aside className="fixed top-0 left-0 h-screen w-64 bg-white border-r border-[#E5E5E5] flex flex-col z-30 select-none shadow-sm">
      {/* Brand Logo Header */}
      <div className="h-16 px-6 border-b border-[#E5E5E5] flex items-center justify-between bg-white">
        <Link to="/dashboard" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-[#C62828] text-white flex items-center justify-center font-bold text-xl shadow-md group-hover:scale-105 transition-transform">
            <Building2 className="w-6 h-6" />
          </div>
          <div className="flex flex-col">
            <span className="font-extrabold text-lg tracking-tight text-[#1F1F1F]">
              Apex<span className="text-[#C62828]">Wholesale</span>
            </span>
            <span className="text-[10px] uppercase tracking-wider font-semibold text-[#2E7D32]">
              Verified Partner
            </span>
          </div>
        </Link>
      </div>

      {/* Subscription Plan Badge */}
      <div className="mx-4 mt-4 p-3 rounded-xl bg-[#FAF9F7] border border-[#E5E5E5] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#C62828]" />
          <div>
            <div className="text-xs font-bold text-[#1F1F1F]">
              {profile.subscriptionPlan === 'ANNUAL' ? 'Annual Pro Plan' : 'Monthly Plan'}
            </div>
            <div className="text-[11px] text-gray-5-00 text-[#2E7D32] font-semibold">
              Status: {profile.subscriptionStatus}
            </div>
          </div>
        </div>
        <Link
          to="/dashboard/subscription"
          className="text-[10px] bg-[#C62828] text-white font-bold px-2 py-1 rounded hover:bg-[#B71C1C] transition-colors"
        >
          Manage
        </Link>
      </div>

      {/* Sidebar Nav Links */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-1">
        <div className="px-3 text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
          Main Menu
        </div>
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.path || (item.path !== '/dashboard' && pathname?.startsWith(item.path));
          
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all group ${
                isActive
                  ? 'bg-[#FFEBEE] text-[#C62828] font-semibold border-l-4 border-[#C62828]'
                  : 'text-[#1F1F1F] hover:bg-[#FAF9F7] hover:text-[#C62828]'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-5 h-5 transition-colors ${isActive ? 'text-[#C62828]' : 'text-gray-500 group-hover:text-[#C62828]'}`} />
                <span>{item.name}</span>
              </div>
              
              {item.badge && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  item.badge.includes('Pending')
                    ? 'bg-[#FFF8E1] text-[#F9A825]'
                    : isActive ? 'bg-[#C62828] text-white' : 'bg-[#E5E5E5] text-gray-700'
                }`}>
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User Profile & Super Admin Call Helpline Box */}
      <div className="p-3 border-t border-[#E5E5E5] bg-white space-y-2">
        <button
          type="button"
          onClick={() => setShowHelpModal(true)}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-gradient-to-r from-emerald-600 to-teal-700 text-white rounded-xl text-xs font-extrabold hover:from-emerald-700 hover:to-teal-800 transition-all shadow-xs"
        >
          <PhoneCall className="w-4 h-4 text-amber-300 animate-pulse" />
          <span>Call Super Admin Support</span>
        </button>
        <button
          type="button"
          onClick={() => setShowFeedbackModal(true)}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-[#FFF3E0] text-[#E65100] border border-[#FFE0B2] rounded-xl text-xs font-bold hover:bg-[#FFE0B2] transition-colors"
        >
          <MessageSquare className="w-4 h-4 text-[#E65100]" />
          <span>Give Feedback & Review</span>
        </button>

        <div
          className="relative"
          onMouseEnter={() => setShowProfile(true)}
          onMouseLeave={() => setShowProfile(false)}
        >
          <div className="p-2.5 rounded-xl bg-[#FAF9F7] border border-[#E5E5E5] flex items-center justify-between">
            <button
              type="button"
              onClick={() => setShowProfile((open) => !open)}
              aria-expanded={showProfile}
              aria-label="Open wholesaler contact information"
              className="flex min-w-0 items-center gap-2.5 overflow-hidden text-left"
            >
              {profile.businessLogoUrl ? (
                <img src={profile.businessLogoUrl} alt="" className="h-9 w-9 shrink-0 rounded-full border border-[#E5E5E5] bg-white object-contain" />
              ) : (
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#C62828] text-sm font-bold text-white">
                  {profile.businessName?.charAt(0) || profile.ownerName?.charAt(0) || 'W'}
                </span>
              )}
              <span className="flex min-w-0 flex-col truncate">
                <span className="truncate text-xs font-bold text-[#1F1F1F]">
                  {profile.businessName || profile.ownerName || 'Wholesaler'}
                </span>
                <span className="truncate text-[11px] text-gray-500">
                  {profile.businessName ? profile.ownerName : profile.email}
                </span>
              </span>
            </button>
            <button
              onClick={handleLogout}
              title="Log Out"
              aria-label="Log out"
              className="shrink-0 rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-[#FFEBEE] hover:text-[#C62828]"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

          {showProfile && (
            <div className="absolute bottom-full left-0 z-50 mb-2 w-full rounded-xl border border-[#E5E5E5] bg-white p-4 shadow-xl">
              <p className="truncate text-sm font-extrabold text-[#1F1F1F]">{profile.businessName || 'Business details'}</p>
              <dl className="mt-3 space-y-2 text-xs">
                <div>
                  <dt className="text-gray-400">Contact name</dt>
                  <dd className="font-semibold text-gray-700">{profile.ownerName || 'Not provided'}</dd>
                </div>
                <div>
                  <dt className="text-gray-400">Email</dt>
                  <dd className="break-all font-semibold text-gray-700">{profile.email || 'Not provided'}</dd>
                </div>
                <div>
                  <dt className="text-gray-400">Phone</dt>
                  <dd className="font-semibold text-gray-700">{profile.phone || 'Not provided'}</dd>
                </div>
              </dl>
              <Link
                to="/dashboard/profile"
                onClick={() => setShowProfile(false)}
                className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-[#C62828] hover:underline"
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
