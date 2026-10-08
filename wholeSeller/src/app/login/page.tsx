import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Building2, Lock, Mail, ArrowRight, AlertTriangle, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { WholesalerProvider, useWholesaler } from '@/context/WholesalerContext';

function LoginForm() {
  const navigate = useNavigate();
  const { login } = useWholesaler();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const queryId = params.get('email') || params.get('mobile') || params.get('phone');
      if (queryId) setEmail(queryId);
      if (params.get('registered')) {
        setInfoMessage('Registration submitted. Please wait for admin approval before logging in.');
      } else if (params.get('expired')) {
        setInfoMessage('Your session has expired. Please sign in again to access the dashboard.');
      }
    }
  }, []);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setIsSubmitting(true);

    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err: any) {
      setLoginError(err?.message || 'Invalid email/mobile or password');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF9F7] text-[#1F1F1F] flex flex-col justify-center py-12 px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-[#C62828] text-white flex items-center justify-center shadow-lg font-bold text-2xl">
          <Building2 className="w-8 h-8" />
        </div>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-[#1F1F1F]">
          Wholesaler Portal Login
        </h1>
        <p className="mt-2 text-xs text-gray-600">
          Access catalog management, automated inventory, connected retailers & orders
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-8 shadow-xl rounded-3xl border border-[#E5E5E5]">
          {loginError && (
            <div className="mb-5 p-3.5 rounded-xl bg-[#FFF8E1] border border-[#FFE082] text-xs text-[#1F1F1F] flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-[#F9A825] shrink-0 mt-0.5" />
              <span>{loginError}</span>
            </div>
          )}
          {infoMessage && (
            <div className="mb-5 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{infoMessage}</span>
            </div>
          )}

          <form onSubmit={handleLoginSubmit} className="space-y-5 text-xs">
            <div>
              <label className="block font-bold text-gray-700 mb-1">Registered Wholesaler Email</label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3.5 top-3 text-gray-400" />
                <input
                  type="email"
                  required
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value.trim().toLowerCase())}
                  placeholder="Enter your registered email"
                  className="w-full pl-10 pr-4 py-2.5 bg-[#FAF9F7] border border-[#E5E5E5] rounded-xl focus:border-[#C62828] focus:ring-1 focus:ring-[#C62828]"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block font-bold text-gray-700">Password</label>
                <a href="#" className="text-xs text-[#C62828] font-bold hover:underline">
                  Forgot password?
                </a>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-3 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full pl-10 pr-11 py-2.5 bg-[#FAF9F7] border border-[#E5E5E5] rounded-xl focus:border-[#C62828] focus:ring-1 focus:ring-[#C62828]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-gray-500 hover:bg-white hover:text-[#C62828]"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 py-3 bg-[#C62828] text-white text-xs font-bold rounded-xl hover:bg-[#B71C1C] shadow-md transition-all disabled:opacity-50"
            >
              <span>{isSubmitting ? 'Signing in...' : 'Sign In to Dashboard'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="mt-6 rounded-xl border border-[#E5E5E5] bg-[#FAF9F7] p-3 text-xs text-gray-600">
            New registrations become visible to the admin first. Dashboard login starts after approval.
          </div>
        </div>

        <div className="text-center mt-6">
          <p className="text-xs text-gray-500">
            New Wholesaler?{' '}
            <Link to="/register" className="text-[#C62828] font-bold hover:underline">
              Register New Account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <WholesalerProvider>
      <LoginForm />
    </WholesalerProvider>
  );
}
