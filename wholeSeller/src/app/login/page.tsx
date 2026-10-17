import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Building2, Lock, Mail, ArrowRight, AlertTriangle, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { WholesalerProvider, useWholesaler } from '@/context/WholesalerContext';

type LoginFormProps = { onSuccess?: () => void; embedded?: boolean };

export function LoginForm({ onSuccess, embedded = false }: LoginFormProps) {
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
        setInfoMessage('Registration successful. Your account is ready to use.');
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
      if (onSuccess) onSuccess();
      else navigate('/dashboard');
    } catch (err: any) {
      setLoginError(err?.message || 'Invalid email/mobile or password');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`${embedded ? 'bg-white text-tradeflow-navy' : 'min-h-screen bg-tradeflow-gray-50 text-tradeflow-navy'} flex flex-col justify-center py-6 px-6 lg:px-8`}>
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-tradeflow-green text-tradeflow-navy flex items-center justify-center shadow-lg font-bold text-2xl">
          <Building2 className="w-8 h-8" />
        </div>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-tradeflow-navy">
          Wholesaler Portal Login
        </h1>
        <p className="mt-2 text-xs text-gray-600">
          Access catalog management, automated inventory, connected retailers & orders
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-8 shadow-xl rounded-3xl border border-tradeflow-gray-200">
          {loginError && (
            <div className="mb-5 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-tradeflow-navy flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
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
                  className="w-full pl-10 pr-4 py-2.5 bg-tradeflow-gray-50 border border-tradeflow-gray-200 rounded-xl focus:border-tradeflow-green focus:ring-1 focus:ring-tradeflow-green"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block font-bold text-gray-700">Password</label>
                <a href="#" className="text-xs text-green-700 font-bold hover:underline">
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
                  className="w-full pl-10 pr-11 py-2.5 bg-tradeflow-gray-50 border border-tradeflow-gray-200 rounded-xl focus:border-tradeflow-green focus:ring-1 focus:ring-tradeflow-green"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-gray-500 hover:bg-white hover:text-green-700"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 py-3 bg-tradeflow-green text-tradeflow-navy text-xs font-bold rounded-xl hover:bg-tradeflow-green-hover shadow-md transition-all disabled:opacity-50"
            >
              <span>{isSubmitting ? 'Signing in...' : 'Sign In to Dashboard'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

        </div>

        {!embedded && (
          <div className="text-center mt-6">
            <p className="text-xs text-gray-500">
              New Wholesaler?{' '}
              <Link to="/register" className="text-green-700 font-bold hover:underline">
                Register New Account
              </Link>
            </p>
          </div>
        )}
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
