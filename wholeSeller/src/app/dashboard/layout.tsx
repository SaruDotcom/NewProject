import React, { useEffect, useState } from 'react';
import { useNavigate, Outlet } from 'react-router-dom';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { WholesalerProvider } from '@/context/WholesalerContext';
import { clearAuthToken, getAuthToken, isDemoAuthToken } from '@/lib/api';
import { SuperAdminHelpModal } from '@/components/layout/SuperAdminHelpModal';
import { PhoneCall, Headphones, HelpCircle } from 'lucide-react';

function DashboardGuard({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const [allowed, setAllowed] = React.useState(false);

  useEffect(() => {
    const token = getAuthToken();
    if (!token || isDemoAuthToken(token)) {
      clearAuthToken();
      navigate('/login', { replace: true });
      return;
    }
    setAllowed(true);
  }, [navigate]);

  if (!allowed) return null;
  return <>{children}</>;
}

export default function DashboardLayout({
  children,
}: {
  children?: React.ReactNode;
}) {
  const [showHelpModal, setShowHelpModal] = useState(false);

  return (
    <WholesalerProvider>
      <DashboardGuard>
        <div className="min-h-screen bg-[#FAF9F7] text-[#1F1F1F] relative">
          <Sidebar />
          <Header />
          <main className="ml-64 min-h-screen px-8 pb-8 pt-24">
            <div className="mx-auto max-w-[1440px] space-y-6">
              {children || <Outlet />}
            </div>
          </main>

          {/* Floating Super Admin Help & Call Floating Widget */}
          <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-2 group">
            <div className="hidden group-hover:flex items-center gap-2 px-3 py-1.5 bg-slate-900 text-white rounded-xl text-xs font-extrabold shadow-lg animate-in fade-in slide-in-from-bottom-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>Direct Super Admin Helpline (24/7)</span>
            </div>

            <button
              type="button"
              onClick={() => setShowHelpModal(true)}
              className="p-3.5 bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-700 hover:to-rose-800 text-white rounded-full shadow-2xl transition-all transform hover:scale-110 flex items-center justify-center border-2 border-white focus:outline-none ring-4 ring-red-300/40"
              title="Super Admin Help & Call Hotline"
            >
              <PhoneCall className="w-6 h-6 text-white animate-bounce" />
            </button>
          </div>

          <SuperAdminHelpModal isOpen={showHelpModal} onClose={() => setShowHelpModal(false)} />
        </div>
      </DashboardGuard>
    </WholesalerProvider>
  );
}
