import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, Outlet } from 'react-router-dom';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { WholesalerProvider } from '@/context/WholesalerContext';
import { clearAuthToken, getAuthToken } from '@/lib/api';
import { SuperAdminHelpModal } from '@/components/layout/SuperAdminHelpModal';
import { PhoneCall, Headphones, HelpCircle } from 'lucide-react';

function DashboardGuard({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const [status, setStatus] = useState<'checking' | 'allowed' | 'error'>('checking');
  const [retry, setRetry] = useState(0);

  const validateToken = useCallback(async (signal: AbortSignal) => {
    const token = getAuthToken();
    if (!token) {
      navigate('/register', { replace: true });
      return;
    }

    const baseUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/+$/, '');
    if (!baseUrl) {
      setStatus('error');
      console.error('Cannot validate the saved login: VITE_API_BASE_URL is not configured.');
      return;
    }

    setStatus('checking');
    try {
      const response = await fetch(`${baseUrl}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
        signal,
      });
      if (!response.ok) {
        clearAuthToken();
        navigate('/register', { replace: true });
        return;
      }
      const result = await response.json();
      if (!result?.success || !result?.data) {
        clearAuthToken();
        navigate('/register', { replace: true });
        return;
      }
      setStatus('allowed');
    } catch (error) {
      if (signal.aborted) return;
      console.error('Unable to validate the saved login.', error);
      setStatus('error');
    }
  }, [navigate]);

  useEffect(() => {
    const controller = new AbortController();
    void validateToken(controller.signal);
    return () => controller.abort();
  }, [retry, validateToken]);

  if (status === 'checking') {
    return <div className="flex min-h-screen items-center justify-center bg-[#FAF9F6] text-sm font-medium text-tradeflow-navy" role="status">Checking your login…</div>;
  }
  if (status === 'error') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#FAF9F6] px-5 text-center text-tradeflow-navy">
        <p role="alert">We could not check your login. Please try again.</p>
        <button type="button" onClick={() => setRetry((value) => value + 1)} className="rounded-lg bg-tradeflow-green px-4 py-2 font-semibold">Try again</button>
        <button type="button" onClick={() => navigate('/register', { replace: true })} className="text-sm font-semibold text-tradeflow-green underline">Go to Register</button>
      </div>
    );
  }
  return <>{children}</>;
}

export default function DashboardLayout({
  children,
}: {
  children?: React.ReactNode;
}) {
  const [showHelpModal, setShowHelpModal] = useState(false);

  return (
    <DashboardGuard>
      <WholesalerProvider>
        <div className="min-h-screen bg-[#FAF9F6] text-[#1C1917] relative">
          <Sidebar />
          <Header />
          <main className="ml-64 min-h-screen px-8 pb-8 pt-24 bg-[#FAF9F6]">
            <div className="mx-auto max-w-[1440px] space-y-6">
              {children || <Outlet />}
            </div>
          </main>

          {/* Floating Super Admin Help & Call Floating Widget */}
          <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-2 group">
            <div className="hidden group-hover:flex items-center gap-2 px-3 py-1.5 bg-[#1C1917] text-white rounded-xl text-xs font-semibold shadow-lg animate-in fade-in slide-in-from-bottom-2">
              <span className="w-2 h-2 rounded-full bg-tradeflow-green animate-ping" />
              <span>Direct Super Admin Helpline (24/7)</span>
            </div>

            <button
              type="button"
              onClick={() => setShowHelpModal(true)}
              className="p-3.5 bg-tradeflow-green hover:bg-tradeflow-green-hover text-white rounded-full shadow-2xl transition-all transform hover:scale-110 flex items-center justify-center border-2 border-white focus:outline-none ring-4 ring-tradeflow-green/20"
              title="Super Admin Help & Call Hotline"
            >
              <PhoneCall className="w-5 h-5 text-white animate-bounce" />
            </button>
          </div>

          <SuperAdminHelpModal isOpen={showHelpModal} onClose={() => setShowHelpModal(false)} />
        </div>
      </WholesalerProvider>
    </DashboardGuard>
  );
}
