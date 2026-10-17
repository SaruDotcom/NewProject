import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Bell,
  Search,
  Plus,
  Building2,
  X,
  ArrowRight,
  Check,
  MessageSquare,
  Headphones,
  PhoneCall,
} from 'lucide-react';
import { useWholesaler } from '@/context/WholesalerContext';
import { FeedbackModal } from './FeedbackModal';
import { SuperAdminHelpModal } from './SuperAdminHelpModal';

export const Header: React.FC = () => {
  const { profile, notifications, markNotificationsRead } = useWholesaler();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();
  const unreadCount = notifications.filter((notification) => !notification.isRead).length;

  return (
    <header className="fixed top-0 right-0 left-64 h-16 bg-tradeflow-navy text-white border-b border-tradeflow-navy-pressed flex items-center justify-between px-6 z-20 shadow-[0_1px_3px_rgba(18,48,74,0.18)]">
      {/* Search Input Bar */}
      <div className="relative w-96">
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-tradeflow-gray-200" />
        <input
          type="text"
          placeholder="Search products, orders, retailers, SKUs..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 text-xs text-white placeholder:text-tradeflow-gray-200 bg-tradeflow-navy-hover border border-tradeflow-navy-hover rounded-xl focus:outline-none focus:border-tradeflow-green focus:ring-1 focus:ring-tradeflow-green/20 transition-all"
        />
      </div>

      {/* Right Header Actions */}
      <div className="flex items-center gap-3">
        {/* Super Admin Direct Call & Help Button */}
        <button
          type="button"
          onClick={() => setShowHelpModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-tradeflow-navy-hover text-white border border-tradeflow-navy-hover text-xs font-semibold rounded-xl hover:bg-tradeflow-navy-pressed hover:border-tradeflow-green/30 shadow-2xs transition-all"
          title="Direct Call & Help from Super Admin"
        >
          <PhoneCall className="w-3.5 h-3.5 text-tradeflow-green" />
          <span>Call Super Admin</span>
        </button>

        {/* Quick Add Product Button */}
        <button
          type="button"
          onClick={() => navigate('/dashboard/products', { state: { openAddProduct: true } })}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-tradeflow-green text-white text-xs font-semibold rounded-xl hover:bg-tradeflow-green-hover shadow-xs transition-all"
        >
          <Plus className="w-4 h-4 text-white" />
          <span>Add Product</span>
        </button>

        {/* Feedback Button */}
        <button
          type="button"
          onClick={() => setShowFeedbackModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-tradeflow-navy-hover text-white border border-tradeflow-navy-hover rounded-xl text-xs font-medium hover:bg-tradeflow-navy-pressed hover:border-tradeflow-green/30 transition-colors"
          title="Submit Feedback & Review"
        >
          <MessageSquare className="w-3.5 h-3.5 text-[#78716C]" />
          <span>Feedback</span>
        </button>

        {/* Notifications Icon & Popover */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 text-tradeflow-gray-200 hover:text-tradeflow-green hover:bg-tradeflow-navy-hover rounded-xl transition-colors border border-transparent hover:border-tradeflow-navy-hover"
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-tradeflow-green px-1 text-[9px] font-bold text-white ring-2 ring-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-white text-[#1C1917] rounded-2xl shadow-xl border border-[#E7E5E4] p-4 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="flex items-center justify-between pb-3 border-b border-[#E7E5E4] mb-2">
                <span className="font-bold text-xs text-[#1C1917]">Notifications ({unreadCount} new)</span>
                <button
                  onClick={() => setShowNotifications(false)}
                  className="text-[#78716C] hover:text-[#1C1917] p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="max-h-72 space-y-2 overflow-y-auto">
                {notifications.length === 0 ? (
                  <p className="py-6 text-center text-xs text-[#78716C]">No updates yet.</p>
                ) : notifications.map((note) => (
                  <div
                    key={note.id}
                    className={`flex items-start gap-2.5 rounded-xl border p-2.5 text-xs text-[#1C1917] ${note.isRead ? 'border-[#E7E5E4] bg-white' : 'border-tradeflow-green/20 bg-tradeflow-green-50'}`}
                  >
                    <Bell className="mt-0.5 h-3.5 w-3.5 shrink-0 text-tradeflow-green" />
                    <div className="min-w-0">
                      <p className="font-bold">{note.title}</p>
                      <p className="mt-0.5 text-[#57534E]">{note.message}</p>
                      {note.createdAt && <p className="mt-1 text-[10px] text-[#A8A29E]">{new Date(note.createdAt).toLocaleString()}</p>}
                    </div>
                  </div>
                ))}
              </div>
              {unreadCount > 0 && (
                <div className="mt-3 text-center border-t border-[#E7E5E4] pt-2">
                  <button
                    onClick={() => void markNotificationsRead()}
                    className="inline-flex items-center gap-1 text-xs font-bold text-tradeflow-green hover:underline"
                  >
                    Mark all as read
                    <Check className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div
          className="relative border-l border-tradeflow-navy-hover pl-3"
          onMouseEnter={() => setShowProfile(true)}
          onMouseLeave={() => setShowProfile(false)}
        >
          <button
            type="button"
            onClick={() => setShowProfile((open) => !open)}
            className="flex max-w-56 items-center gap-2 rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-tradeflow-navy-hover"
            aria-expanded={showProfile}
            aria-label="Open business information"
          >
            {profile.businessLogoUrl ? (
              <img src={profile.businessLogoUrl} alt="" className="h-8 w-8 shrink-0 rounded-full border border-tradeflow-navy-hover bg-white object-contain" />
            ) : (
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-tradeflow-green text-xs font-bold text-white">
                {profile.businessName?.charAt(0) || <Building2 className="h-4 w-4" />}
              </span>
            )}
            <span className="hidden truncate text-xs font-bold text-white sm:block">
              {profile.businessName || 'Your business'}
            </span>
          </button>

          {showProfile && (
            <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-2xl border border-[#E7E5E4] bg-white p-4 text-[#1C1917] shadow-xl">
              <p className="truncate text-sm font-bold text-[#1C1917]">{profile.businessName || 'Business information'}</p>
              <p className="mt-1 truncate text-xs text-[#78716C]">{profile.ownerName || 'Owner details unavailable'}</p>
              {profile.email && <p className="mt-1 truncate text-xs text-[#78716C]">{profile.email}</p>}
              <p className="mt-2 break-all font-mono text-[10px] text-[#A8A29E]">ID: {profile.id || 'Loading'}</p>
              <Link
                to="/dashboard/profile"
                onClick={() => setShowProfile(false)}
                className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-tradeflow-green hover:underline"
              >
                View business details <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          )}
        </div>
      </div>
      <FeedbackModal isOpen={showFeedbackModal} onClose={() => setShowFeedbackModal(false)} />
      <SuperAdminHelpModal isOpen={showHelpModal} onClose={() => setShowHelpModal(false)} />
    </header>
  );
};
