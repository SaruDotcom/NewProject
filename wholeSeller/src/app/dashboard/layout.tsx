import React, { Suspense, useCallback, useEffect, useState } from 'react';
import { useNavigate, Outlet } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { WholesalerProvider } from '@/context/WholesalerContext';
import api, { ApiError, clearAuthToken, getAuthToken } from '@/lib/api';
import { getWholesalerId, wholesalerQueryKeys } from '@/lib/query-client';
import { SuperAdminHelpModal } from '@/components/layout/SuperAdminHelpModal';
import { PhoneCall, Headphones, HelpCircle } from 'lucide-react';

function isAbortError(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'name' in error && error.name === 'AbortError');
}

function DashboardGuard({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<'checking' | 'allowed' | 'error'>('checking');
  const [retry, setRetry] = useState(0);

  const validateToken = useCallback(async (signal: AbortSignal) => {
    const token = getAuthToken();
    if (!token) {
      navigate('/login', { replace: true });
      return;
    }

    setStatus('checking');
    try {
      const result = await queryClient.fetchQuery({
        queryKey: wholesalerQueryKeys.resource(getWholesalerId(), 'profile'),
        queryFn: () => api.getMe(),
        staleTime: 0,
      });
      if (signal.aborted || getAuthToken() !== token) return;
      if (!result?.success || !result?.data) {
        clearAuthToken();
        navigate('/login', { replace: true });
        return;
      }
      setStatus('allowed');
    } catch (error) {
      if (signal.aborted || getAuthToken() !== token) return;
      if (isAbortError(error)) {
        setStatus('error');
        return;
      }
      console.error('Unable to validate the saved login.', error);
      if (error instanceof ApiError) {
        clearAuthToken();
        navigate('/login', { replace: true });
        return;
      }
      setStatus('error');
    }
  }, [navigate, queryClient]);

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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <DashboardGuard>
      <WholesalerProvider>
        <div className="min-h-screen bg-[#FAF9F6] text-[#1C1917] relative">
          <Sidebar isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />
          <Header isMenuOpen={isMobileMenuOpen} onToggleMenu={() => setIsMobileMenuOpen((prev) => !prev)} />
          <main className="ml-0 lg:ml-64 min-h-screen px-3 sm:px-6 lg:px-8 pb-8 pt-20 sm:pt-24 bg-[#FAF9F6] overflow-x-hidden">
            <div className="mx-auto max-w-[1440px] space-y-6">
              <Suspense fallback={<div className="animate-pulse space-y-5" role="status" aria-label="Loading page"><div className="h-8 w-56 rounded-lg bg-stone-200" /><div className="h-40 rounded-2xl bg-stone-100" /><div className="h-64 rounded-2xl bg-stone-100" /></div>}>
                {children || <Outlet />}
              </Suspense>
            </div>
          </main>

          {/* Floating Super Admin Help & Call Floating Widget */}
          <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40 flex flex-col items-end gap-2 group">
            <div className="hidden group-hover:flex items-center gap-2 px-3 py-1.5 bg-[#1C1917] text-white rounded-xl text-xs font-semibold shadow-lg animate-in fade-in slide-in-from-bottom-2">
              <span className="w-2 h-2 rounded-full bg-tradeflow-green animate-ping" />
              <span>Direct Super Admin Helpline (24/7)</span>
            </div>

            <button
              type="button"
              onClick={() => setShowHelpModal(true)}
              className="p-3 sm:p-3.5 bg-tradeflow-green hover:bg-tradeflow-green-hover text-white rounded-full shadow-2xl transition-all transform hover:scale-110 flex items-center justify-center border-2 border-white focus:outline-none ring-4 ring-tradeflow-green/20"
              title="Super Admin Help & Call Hotline"
            >
              <PhoneCall className="w-4 h-4 sm:w-5 sm:h-5 text-white animate-bounce" />
            </button>
          </div>

          <SuperAdminHelpModal isOpen={showHelpModal} onClose={() => setShowHelpModal(false)} />
        </div>
      </WholesalerProvider>
    </DashboardGuard>
  );
}
