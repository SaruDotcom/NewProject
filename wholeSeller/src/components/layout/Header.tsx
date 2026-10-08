import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Bell,
  Search,
  Plus,
  Building2,
  CheckCircle2,
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
    <header className="fixed top-0 right-0 left-64 h-16 bg-white border-b border-[#E5E5E5] flex items-center justify-between px-6 z-20 shadow-xs">
      {/* Search Input Bar */}
      <div className="relative w-96">
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search products, orders, retailers, SKUs..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 text-sm bg-[#FAF9F7] border border-[#E5E5E5] rounded-xl focus:outline-none focus:border-[#C62828] focus:ring-1 focus:ring-[#C62828] transition-all"
        />
      </div>

      {/* Right Header Actions */}
      <div className="flex items-center gap-3">
        {/* Super Admin Direct Call & Help Button */}
        <button
          type="button"
          onClick={() => setShowHelpModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-700 text-white text-xs font-extrabold rounded-xl hover:from-emerald-700 hover:to-teal-800 shadow-sm transition-all animate-pulse"
          title="Direct Call & Help from Super Admin"
        >
          <PhoneCall className="w-3.5 h-3.5 text-amber-300" />
          <span>Call Super Admin</span>
        </button>

        {/* Quick Add Product Button */}
        <button
          type="button"
          onClick={() => navigate('/dashboard/products', { state: { openAddProduct: true } })}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-[#C62828] text-white text-xs font-bold rounded-xl hover:bg-[#B71C1C] shadow-sm transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Add Product</span>
        </button>

        {/* GSTIN Verification Badge */}
        <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 bg-[#E8F5E9] text-[#2E7D32] border border-[#A5D6A7] rounded-xl text-xs font-bold">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>GSTIN: {profile.gstin}</span>
        </div>

        {/* Feedback Button */}
        <button
          type="button"
          onClick={() => setShowFeedbackModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#FFF3E0] text-[#E65100] border border-[#FFE0B2] rounded-xl text-xs font-bold hover:bg-[#FFE0B2] transition-colors"
          title="Submit Feedback & Review"
        >
          <MessageSquare className="w-3.5 h-3.5 text-[#E65100]" />
          <span>Feedback</span>
        </button>

        {/* Notifications Icon & Popover */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 text-gray-600 hover:text-[#C62828] hover:bg-[#FAF9F7] rounded-xl transition-colors border border-transparent hover:border-[#E5E5E5]"
            title="Notifications"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute -right-1 -top-1 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-[#C62828] px-1 text-[9px] font-bold text-white ring-2 ring-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-[#E5E5E5] p-4 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="flex items-center justify-between pb-3 border-b border-[#E5E5E5] mb-2">
                <span className="font-bold text-sm text-[#1F1F1F]">Notifications ({unreadCount} new)</span>
                <button
                  onClick={() => setShowNotifications(false)}
                  className="text-gray-400 hover:text-gray-600 p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="max-h-72 space-y-2 overflow-y-auto">
                {notifications.length === 0 ? (
                  <p className="py-6 text-center text-xs text-gray-500">No updates yet.</p>
                ) : notifications.map((note) => (
                  <div
                    key={note.id}
                    className={`flex items-start gap-2.5 rounded-xl border p-2.5 text-xs text-[#1F1F1F] ${note.isRead ? 'border-[#E5E5E5] bg-white' : 'border-[#F2C2C4] bg-[#FFF7F7]'}`}
                  >
                    <Bell className="mt-0.5 h-4 w-4 shrink-0 text-[#C62828]" />
                    <div className="min-w-0">
                      <p className="font-bold">{note.title}</p>
                      <p className="mt-0.5 text-gray-600">{note.message}</p>
                      {note.createdAt && <p className="mt-1 text-[10px] text-gray-400">{new Date(note.createdAt).toLocaleString()}</p>}
                    </div>
                  </div>
                ))}
              </div>
              {unreadCount > 0 && <div className="mt-3 text-center">
                <button
                  onClick={() => void markNotificationsRead()}
                  className="inline-flex items-center gap-1 text-xs font-bold text-[#C62828] hover:underline"
                >
                  Mark all as read
                  <Check className="h-3.5 w-3.5" />
                </button>
              </div>}
            </div>
          )}
        </div>

        <div
          className="relative border-l border-[#E5E5E5] pl-3"
          onMouseEnter={() => setShowProfile(true)}
          onMouseLeave={() => setShowProfile(false)}
        >
          <button
            type="button"
            onClick={() => setShowProfile((open) => !open)}
            className="flex max-w-56 items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-[#FAF9F7]"
            aria-expanded={showProfile}
            aria-label="Open business information"
          >
            {profile.businessLogoUrl ? (
              <img src={profile.businessLogoUrl} alt="" className="h-9 w-9 shrink-0 rounded-lg border border-[#E5E5E5] object-contain" />
            ) : (
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#C62828] text-sm font-bold text-white">
                {profile.businessName?.charAt(0) || <Building2 className="h-4 w-4" />}
              </span>
            )}
            <span className="hidden truncate text-xs font-bold text-[#1F1F1F] sm:block">
              {profile.businessName || 'Your business'}
            </span>
          </button>

          {showProfile && (
            <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-xl border border-[#E5E5E5] bg-white p-4 shadow-xl">
              <p className="truncate text-sm font-extrabold text-[#1F1F1F]">{profile.businessName || 'Business information'}</p>
              <p className="mt-1 truncate text-xs text-gray-500">{profile.ownerName || 'Owner details unavailable'}</p>
              {profile.email && <p className="mt-1 truncate text-xs text-gray-500">{profile.email}</p>}
              <p className="mt-2 break-all font-mono text-[10px] text-gray-400">ID: {profile.id || 'Loading'}</p>
              <Link
                to="/dashboard/profile"
                onClick={() => setShowProfile(false)}
                className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-[#C62828] hover:underline"
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
