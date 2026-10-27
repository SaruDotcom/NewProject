import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  Boxes,
  Building2,
  Check,
  CircleDollarSign,
  CreditCard,
  Link2,
  Menu,
  Package,
  ShieldCheck,
  ShoppingBag,
  Store,
  Truck,
  TrendingUp,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { WholesalerProvider } from '@/context/WholesalerContext';
import { LoginForm } from '@/app/login/page';
import { RegisterForm } from '@/app/register/page';
import { BRAND_NAME } from '@/config/brand';
import { clearAuthToken, getAuthToken, resolveProductImageUrl, type SubscriptionPlan, default as api } from '@/lib/api';

const landingCopy = {
  hero: {
    label: 'Private B2B Business Platform',
    headline: 'Your Business.\nYour Store.\nYour Way.',
    subtext: 'Create your own online wholesale store, manage your retailers, track orders and simplify your daily business operations.',
    primaryButton: 'Create Your Store',
    secondaryButton: 'See How It Works',
  },
  metadata: {
    title: `${BRAND_NAME} · B2B Wholesale Business Online`,
    description: 'Add retailers online, share your wholesale catalog, and manage B2B orders, stock, payments and bills in one place.',
  },
  features: [
    { icon: Store, title: 'Private Online Store', text: 'Your own business identity and store link.' },
    { icon: Users, title: 'Retailer Management', text: 'Manage your own retailer network.' },
    { icon: Package, title: 'Orders & Inventory', text: 'Track stock and orders in one place.' },
    { icon: CreditCard, title: 'Sales & Credit', text: 'Manage sales, credit and outstanding payments.' },
    { icon: BarChart3, title: 'Business Reports', text: 'Get insights to make better decisions.' },
    { icon: ShieldCheck, title: 'Secure & Private', text: 'Your data stays with you. Always.' },
  ],
  steps: [
    { icon: Users, title: 'Register', text: 'Create your business account.' },
    { icon: Store, title: 'Build Your Store', text: 'Set up your online store with your brand.' },
    { icon: Package, title: 'Add Products', text: 'Upload your products, prices and stock.' },
    { icon: Link2, title: 'Share Your Link', text: 'Share with retailers via WhatsApp, social media or email.' },
    { icon: TrendingUp, title: 'Manage & Grow', text: 'Track orders, sales, payments and more.' },
  ],
  benefits: [
    { icon: ShieldCheck, title: 'Complete Privacy', text: 'Your store, products and customers are only yours.' },
    { icon: Store, title: 'Easy Store Setup', text: 'Create your online store in minutes without technical skills.' },
    { icon: Users, title: 'Find New Customers', text: 'Share your store link and get new retailers through social media.' },
    { icon: CreditCard, title: 'Cash & Credit Orders', text: 'Sell on cash or approved credit with payment tracking.' },
    { icon: Building2, title: 'Business Management', text: 'Inventory, orders, payments and reports in one dashboard.' },
    { icon: Truck, title: 'Dedicated Support', text: 'We are here to help you at every step.' },
  ],
};

const steps = landingCopy.steps;
const features = landingCopy.features;

function setMeta(name: string, content: string, property = false) {
  const selector = property ? `meta[property="${name}"]` : `meta[name="${name}"]`;
  let element = document.head.querySelector<HTMLMetaElement>(selector);
  if (!element) {
    element = document.createElement('meta');
    if (property) element.setAttribute('property', name);
    else element.name = name;
    document.head.appendChild(element);
  }
  element.content = content;
}

function AuthModal({
  tab,
  setTab,
  inviteToken,
  onClose,
  onSuccess,
}: {
  tab: 'welcome' | 'register' | 'login';
  setTab: (value: 'welcome' | 'register' | 'login') => void;
  inviteToken: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [registrationEmail, setRegistrationEmail] = useState('');

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.querySelector<HTMLElement>('button, input, a[href], select, textarea')?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
      if (event.key !== 'Tab') return;
      const nodes = [...dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), a[href], select:not([disabled]), textarea:not([disabled])',
      )];
      if (!nodes.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, tab]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-tradeflow-navy/70 p-3 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-heading"
        className="relative max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white shadow-2xl"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-tradeflow-gray-200 bg-white/95 px-5 py-3 backdrop-blur">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-tradeflow-green">Welcome to {BRAND_NAME}</p>
            <h2 id="auth-modal-heading" className="text-lg font-extrabold text-tradeflow-navy">
              {tab === 'welcome' ? 'Welcome! Start selling online in minutes' : 'Sign in or create an account'}
            </h2>
          </div>
          <div className="relative z-0 mx-auto -mt-px h-2 w-[96%] rounded-b-xl bg-gradient-to-b from-gray-300 to-gray-400 shadow-lg" />
          <div className="landing-float absolute -bottom-7 right-2 z-30 hidden w-40 rounded-[1.8rem] border-[5px] border-tradeflow-navy bg-white p-2 text-tradeflow-navy shadow-2xl sm:block md:right-0 md:w-48">
            <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-tradeflow-gray-200" />
            <div className="rounded-xl bg-sky-50 p-2.5">
              <div className="flex items-center justify-between"><Store className="size-4 text-tradeflow-green" /><span className="text-[8px] font-bold">Your Store</span><ShoppingBag className="size-3.5" /></div>
              <div className="mt-2 rounded-lg bg-gradient-to-br from-blue-100 to-emerald-100 p-3 text-center"><Package className="mx-auto size-8 text-tradeflow-green" /><span className="mt-1 block text-[8px] font-bold">New arrivals</span></div>
              <div className="mt-2 grid grid-cols-2 gap-1.5"><div className="rounded-md border bg-white p-2"><span className="block h-7 rounded bg-amber-100" /><span className="mt-1 block h-1.5 w-4/5 rounded bg-gray-200" /></div><div className="rounded-md border bg-white p-2"><span className="block h-7 rounded bg-sky-100" /><span className="mt-1 block h-1.5 w-4/5 rounded bg-gray-200" /></div></div>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close sign-in dialog" className="rounded-full p-2 text-tradeflow-navy hover:bg-tradeflow-gray-100">
            <X className="size-5" />
          </button>
        </div>
        {tab === 'welcome' ? (
          <div className="grid gap-3 p-6 sm:grid-cols-2 sm:p-8">
            <button type="button" onClick={() => setTab('register')} className="rounded-xl bg-tradeflow-green px-5 py-3 font-bold text-tradeflow-navy transition hover:bg-tradeflow-green-hover">
              Register Free
            </button>
            <button type="button" onClick={() => setTab('login')} className="rounded-xl border border-tradeflow-gray-200 px-5 py-3 font-bold text-tradeflow-navy transition hover:bg-tradeflow-gray-50">
              Login
            </button>
            <p className="sm:col-span-2 text-center text-xs text-gray-500">
              Already have an account? <Link to="/login" className="font-bold text-tradeflow-green underline underline-offset-2">Open the login page</Link>
            </p>
          </div>
        ) : (
          <>
            <div className="sticky top-[65px] z-[9] flex border-b border-tradeflow-gray-200 bg-white">
              {(['register', 'login'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTab(value)}
                  aria-pressed={tab === value}
                  className={`flex-1 border-b-2 px-4 py-3 text-sm font-bold capitalize transition-colors ${
                    tab === value ? 'border-tradeflow-green text-tradeflow-navy' : 'border-transparent text-gray-500 hover:text-tradeflow-navy'
                  }`}
                >
                  {value}
                </button>
              ))}
            </div>
            <div className="p-2 sm:p-4">
              {tab === 'register'
                ? <RegisterForm embedded inviteToken={inviteToken} onGoToLogin={(email) => {
                    setRegistrationEmail(email);
                    setTab('login');
                  }} />
                : <LoginForm
                    embedded
                    initialEmail={registrationEmail}
                    registrationComplete={Boolean(registrationEmail)}
                    onSuccess={onSuccess}
                  />}
              <p className="pb-3 text-center text-xs text-gray-500">
                Trouble opening this form? <Link to="/login" className="font-bold text-tradeflow-green underline underline-offset-2">Open the login page</Link>
              </p>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function LandingContent() {
  const navigate = useNavigate();
  const [modalTab, setModalTab] = useState<'welcome' | 'register' | 'login' | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [authStatus, setAuthStatus] = useState<'checking' | 'loggedIn' | 'loggedOut'>(getAuthToken() ? 'checking' : 'loggedOut');
  const [subscriptionPlans, setSubscriptionPlans] = useState<SubscriptionPlan[]>([]);
  const [subscriptionPlanError, setSubscriptionPlanError] = useState('');
  const [subscriptionPlanLoading, setSubscriptionPlanLoading] = useState(true);
  const loggedIn = authStatus === 'loggedIn';
  const inviteToken = new URLSearchParams(window.location.search).get('invite') || '';

  useEffect(() => {
    let active = true;
    void api.getPublicSubscriptionPlan()
      .then((response) => {
        if (active) setSubscriptionPlans(response.data.plans);
      })
      .catch((error: unknown) => {
        if (!active) return;
        console.error('Unable to load subscription plan for the landing page.', error);
        setSubscriptionPlanError('Subscription plan details are temporarily unavailable.');
      })
      .finally(() => {
        if (active) setSubscriptionPlanLoading(false);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      setAuthStatus('loggedOut');
      return;
    }

    let active = true;
    const baseUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/+$/, '');
    if (!baseUrl) {
      console.error('Cannot validate the saved login: VITE_API_BASE_URL is not configured.');
      setAuthStatus('loggedOut');
      return;
    }

    void fetch(`${baseUrl}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (response) => {
        if (!response.ok) {
          clearAuthToken();
          if (active) {
            setAuthStatus('loggedOut');
            navigate('/register', { replace: true });
          }
          return;
        }
        const result = await response.json();
        if (active) {
          if (result?.success && result?.data) setAuthStatus('loggedIn');
          else {
            clearAuthToken();
            setAuthStatus('loggedOut');
            navigate('/register', { replace: true });
          }
        }
      })
      .catch((error: unknown) => {
        if (!active) return;
        console.error('Unable to validate the saved login.', error);
        setAuthStatus('loggedOut');
      });

    return () => { active = false; };
  }, [navigate]);

  useEffect(() => {
    document.title = landingCopy.metadata.title;
    setMeta('description', landingCopy.metadata.description);
    setMeta('og:title', landingCopy.metadata.title, true);
    setMeta('og:description', landingCopy.metadata.description, true);
    setMeta('og:type', 'website', true);

    const params = new URLSearchParams(window.location.search);
    const values = {
      wholesaler_utm_source: params.get('utm_source')?.slice(0, 100),
      wholesaler_utm_medium: params.get('utm_medium')?.slice(0, 100),
      wholesaler_utm_campaign: params.get('utm_campaign')?.slice(0, 100),
    };
    try {
      for (const [key, value] of Object.entries(values)) {
        if (value) localStorage.setItem(key, value);
      }
    } catch (error) {
      console.error('Unable to save campaign attribution in local storage.', error);
    }
  }, []);

  useEffect(() => {
    const elements = [...document.querySelectorAll<HTMLElement>('.landing-reveal')];
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
      elements.forEach((element) => element.classList.add('is-visible'));
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (authStatus !== 'loggedOut' || modalTab !== null) return;
    let lastDismissedAt = 0;
    try {
      lastDismissedAt = Number(localStorage.getItem('wholesaler-auth-dismissed-at') || 0);
    } catch (error) {
      console.error('Unable to read the authentication dialog dismissal.', error);
    }
    if (lastDismissedAt && Date.now() - lastDismissedAt < 24 * 60 * 60 * 1000) return;
    const timer = window.setTimeout(() => setModalTab('welcome'), 3000);
    return () => window.clearTimeout(timer);
  }, [authStatus, modalTab]);

  const dismissModal = () => {
    try {
      localStorage.setItem('wholesaler-auth-dismissed-at', String(Date.now()));
    } catch (error) {
      console.error('Unable to save the authentication dialog dismissal.', error);
    }
    setModalTab(null);
  };

  const authSuccess = () => {
    setModalTab(null);
    navigate('/dashboard', { replace: true });
  };

  const showModal = (tab: 'register' | 'login') => {
    setModalTab(tab);
    setMobileMenuOpen(false);
  };

  return (
    <main className="min-h-screen bg-white text-tradeflow-navy">
      <style>{`
        html { scroll-behavior: smooth; scroll-padding-top: 4rem; }
        section[id] { scroll-margin-top: 4rem; }
        .landing-reveal { opacity: 0; transform: translateY(14px); transition: opacity .45s ease, transform .45s ease; }
        .landing-reveal.is-visible { opacity: 1; transform: translateY(0); }
        @keyframes landingFloat { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-7px); } }
        .landing-float { animation: landingFloat 5s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          html { scroll-behavior: auto; }
          .landing-reveal, .landing-reveal.is-visible { opacity: 1; transform: none; transition: none; }
          .landing-motion, .landing-float { animation: none !important; transition: none !important; }
        }
      `}</style>
      <header className="sticky top-0 z-40 border-b border-tradeflow-gray-200 bg-white/95 backdrop-blur">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3 lg:px-8" aria-label="Main navigation">
          <a href="#home" className="flex items-center gap-2.5" aria-label={`${BRAND_NAME} home`}>
            <span className="flex size-10 items-center justify-center rounded-xl bg-tradeflow-green text-tradeflow-navy"><Store className="size-5" /></span>
            <span><span className="block font-heading text-lg font-extrabold tracking-tight">{BRAND_NAME}</span><span className="block text-[8px] font-medium leading-3 text-gray-500 sm:text-[10px]">Your Business. Your Store. Your Way.</span></span>
          </a>
          <button type="button" className="rounded-lg p-2 md:hidden" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'} aria-expanded={mobileMenuOpen}>
            {mobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
          <div className={`${mobileMenuOpen ? 'absolute left-0 right-0 top-full flex flex-col border-b bg-white p-4 shadow-lg' : 'hidden'} items-center gap-6 text-sm font-semibold md:static md:flex md:flex-row md:border-0 md:bg-transparent md:p-0 md:shadow-none`}>
            <a onClick={() => setMobileMenuOpen(false)} href="#home" className="hover:text-tradeflow-green">Home</a>
            <a onClick={() => setMobileMenuOpen(false)} href="#features" className="hover:text-tradeflow-green">Features</a>
            <a onClick={() => setMobileMenuOpen(false)} href="#pricing" className="hover:text-tradeflow-green">Pricing</a>
            <a onClick={() => setMobileMenuOpen(false)} href="#how-it-works" className="hover:text-tradeflow-green">How It Works</a>
            <a onClick={() => setMobileMenuOpen(false)} href="#about" className="hover:text-tradeflow-green">About</a>
            {loggedIn ? (
              <Link to="/dashboard" className="text-tradeflow-green hover:underline">Go to Dashboard</Link>
            ) : (
              <>
                <button type="button" onClick={() => showModal('login')} className="hover:text-tradeflow-green">Login</button>
                <button type="button" onClick={() => showModal('register')} className="rounded-xl bg-tradeflow-green px-4 py-2.5 font-bold text-tradeflow-navy transition hover:bg-tradeflow-green-hover">Get Started</button>
              </>
            )}
          </div>
        </nav>
      </header>

      <section id="home" className="relative isolate overflow-hidden bg-gradient-to-br from-tradeflow-navy via-[#174a57] to-tradeflow-green text-white">
        <div className="pointer-events-none absolute -right-24 -top-28 size-96 rounded-full bg-sky-300/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-44 left-[38%] size-96 rounded-full bg-tradeflow-green/25 blur-3xl" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.08]" style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,.8) 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
        <div className="pointer-events-none absolute inset-0 hidden overflow-hidden text-white/[0.08] lg:block" aria-hidden="true">
          <Package className="absolute left-[6%] top-1/4 size-9" />
          <Truck className="absolute right-[7%] top-1/4 size-12" />
          <BarChart3 className="absolute bottom-1/4 left-[46%] size-10" />
          <CircleDollarSign className="absolute bottom-1/3 right-[41%] size-8" />
        </div>
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 py-16 md:py-24 lg:grid-cols-[1.05fr_0.95fr] lg:px-8">
          <div className="relative z-10 landing-reveal">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-bold text-emerald-100 shadow-sm"><ShieldCheck className="size-4" />{landingCopy.hero.label}</span>
            <h1 className="mt-6 max-w-2xl whitespace-pre-line font-heading text-4xl font-extrabold leading-[1.14] tracking-[-0.035em] sm:text-5xl lg:text-[3.8rem]">{landingCopy.hero.headline}</h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-white/80 sm:text-lg">{landingCopy.hero.subtext}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              {loggedIn ? (
                <Link to="/dashboard" className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 font-bold text-tradeflow-navy shadow-lg transition hover:-translate-y-0.5 hover:bg-emerald-50">Go to Dashboard <ArrowRight className="size-4" /></Link>
              ) : (
                <>
                  <button type="button" onClick={() => showModal('register')} className="inline-flex items-center gap-2 rounded-xl bg-tradeflow-green px-5 py-3 font-bold text-tradeflow-navy shadow-lg transition hover:-translate-y-0.5 hover:bg-tradeflow-green-hover">{landingCopy.hero.primaryButton} <ArrowRight className="size-4" /></button>
                  <a href="#how-it-works" className="inline-flex items-center rounded-xl border border-white/30 bg-white/10 px-5 py-3 font-bold text-white transition hover:bg-white/20">{landingCopy.hero.secondaryButton}</a>
                </>
              )}
            </div>
            <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs font-semibold text-white/85">
              {[
                { icon: ShieldCheck, text: 'Private Store' },
                { icon: Package, text: 'Easy Management' },
                { icon: CircleDollarSign, text: 'Affordable Plans' },
              ].map(({ icon: Icon, text }) => <span key={text} className="inline-flex items-center gap-2"><Icon className="size-4 text-emerald-200" />{text}</span>)}
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-2xl landing-reveal" aria-label="Laptop wholesaler dashboard with mobile storefront preview">
            <div className="relative z-10 w-[91%] pt-4 sm:w-[94%]">
              <div className="rounded-t-[1.25rem] border-[5px] border-b-0 border-slate-800 bg-slate-800 p-[3px] shadow-[0_24px_55px_rgba(4,18,31,0.42)] sm:rounded-t-[1.6rem] sm:border-[7px] sm:p-1">
                <div className="overflow-hidden rounded-t-lg bg-slate-50 text-slate-700 sm:rounded-t-xl">
                  <div className="flex h-7 items-center justify-between border-b border-slate-200 bg-white px-3 sm:h-9 sm:px-4">
                    <span className="flex items-center gap-1.5"><i className="size-1.5 rounded-full bg-rose-400" /><i className="size-1.5 rounded-full bg-amber-300" /><i className="size-1.5 rounded-full bg-emerald-400" /></span>
                    <span className="rounded-md bg-slate-100 px-3 py-1 text-[6px] text-slate-400 sm:px-8 sm:text-[8px]">app.vyapaardwaar.in/dashboard</span>
                    <span className="size-3 rounded-full bg-slate-100 sm:size-4" />
                  </div>
                  <div className="grid min-h-[225px] grid-cols-[78px_1fr] sm:min-h-[300px] sm:grid-cols-[112px_1fr]">
                    <aside className="bg-[#102c45] px-2 py-2.5 text-white sm:px-3 sm:py-4">
                      <div className="mb-3 flex items-center gap-1.5 border-b border-white/10 pb-2 sm:mb-4 sm:gap-2 sm:pb-3"><span className="flex size-4 items-center justify-center rounded bg-emerald-400 text-[8px] font-black text-slate-900 sm:size-5 sm:text-[10px]">V</span><span className="truncate text-[6px] font-bold sm:text-[8px]">VyapaarDwaar</span></div>
                      {[
                        { icon: Building2, label: 'Dashboard' },
                        { icon: Package, label: 'Products' },
                        { icon: ShoppingBag, label: 'Orders' },
                        { icon: Users, label: 'Retailers' },
                        { icon: Boxes, label: 'Inventory' },
                        { icon: CircleDollarSign, label: 'Sales' },
                        { icon: BarChart3, label: 'Reports' },
                        { icon: ShieldCheck, label: 'Settings' },
                      ].map(({ icon: Icon, label }, index) => <div key={label} className={`mb-1 flex items-center gap-1.5 rounded px-1.5 py-1 text-[6px] sm:mb-1.5 sm:gap-2 sm:px-2 sm:py-1.5 sm:text-[8px] ${index === 0 ? 'bg-emerald-400/15 font-bold text-emerald-200' : 'text-slate-300'}`}><Icon className="size-2.5 shrink-0 sm:size-3" /><span className="truncate">{label}</span></div>)}
                    </aside>
                    <div className="min-w-0 p-2 sm:p-4">
                      <div className="flex items-center justify-between">
                        <div><p className="text-[6px] text-slate-400 sm:text-[8px]">MONDAY, 24 JUNE 2025</p><p className="mt-0.5 text-[9px] font-extrabold text-slate-800 sm:text-sm">Business Dashboard</p></div>
                        <div className="flex size-5 items-center justify-center rounded-full bg-emerald-100 text-[7px] font-bold text-emerald-800 sm:size-7 sm:text-[9px]">AK</div>
                      </div>
                      <div className="mt-2 grid grid-cols-3 gap-1 sm:mt-3 sm:gap-2">
                        {[
                          { icon: ShoppingBag, label: 'Total Orders', value: '1,248', tint: 'bg-sky-50 text-sky-600' },
                          { icon: CircleDollarSign, label: 'Total Sales', value: '₹8.42L', tint: 'bg-emerald-50 text-emerald-600' },
                          { icon: Users, label: 'Retailers', value: '386', tint: 'bg-violet-50 text-violet-600' },
                        ].map(({ icon: Icon, label, value, tint }) => <div key={label} className="min-w-0 rounded-md border border-slate-200 bg-white p-1 sm:rounded-lg sm:p-2"><span className={`flex size-4 items-center justify-center rounded ${tint} sm:size-6`}><Icon className="size-2.5 sm:size-3.5" /></span><p className="mt-1 truncate text-[5px] text-slate-400 sm:text-[7px]">{label}</p><p className="text-[8px] font-extrabold text-slate-800 sm:text-xs">{value}</p></div>)}
                      </div>
                      <div className="mt-2 overflow-hidden rounded-md border border-slate-200 bg-white sm:mt-3 sm:rounded-lg">
                        <div className="flex items-center justify-between border-b border-slate-100 px-1.5 py-1 sm:px-2.5 sm:py-2"><p className="text-[7px] font-bold text-slate-700 sm:text-[9px]">Recent Orders</p><span className="text-[5px] font-semibold text-emerald-700 sm:text-[7px]">View all</span></div>
                        <div className="grid grid-cols-[1fr_1.1fr_.8fr_.8fr] gap-1 border-b border-slate-100 bg-slate-50 px-1.5 py-1 text-[5px] font-semibold text-slate-400 sm:px-2.5 sm:text-[6px]"><span>ORDER</span><span>RETAILER</span><span>AMOUNT</span><span>STATUS</span></div>
                        {[
                          ['#VD-2481', 'Shree Traders', '₹24,500', 'Delivered', 'bg-emerald-100 text-emerald-700'],
                          ['#VD-2480', 'Milan Fashion', '₹18,200', 'Processing', 'bg-amber-100 text-amber-700'],
                          ['#VD-2479', 'City Collection', '₹32,750', 'Shipped', 'bg-sky-100 text-sky-700'],
                        ].map(([id, retailer, amount, status, statusColor]) => <div key={id} className="grid grid-cols-[1fr_1.1fr_.8fr_.8fr] items-center gap-1 border-b border-slate-50 px-1.5 py-1.5 text-[5px] last:border-0 sm:px-2.5 sm:py-2 sm:text-[7px]"><span className="font-bold text-slate-600">{id}</span><span className="truncate text-slate-500">{retailer}</span><span className="font-semibold text-slate-700">{amount}</span><span className={`w-fit rounded-full px-1 py-0.5 text-[4px] font-bold sm:px-1.5 sm:text-[6px] ${statusColor}`}>{status}</span></div>)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="relative -mt-px h-2 w-full rounded-b-[50%] border-t border-slate-500 bg-gradient-to-b from-slate-300 via-slate-400 to-slate-500 shadow-[0_14px_18px_rgba(4,18,31,0.28)] sm:h-3"><div className="mx-auto h-1 w-1/5 rounded-b-md bg-slate-500/60 sm:h-1.5" /></div>
            </div>

            <div className="absolute right-0 top-8 z-20 w-[34%] min-w-[112px] max-w-[190px] rounded-[1.5rem] border-[4px] border-slate-800 bg-slate-800 p-1 shadow-[0_22px_45px_rgba(4,18,31,0.5)] sm:right-0 sm:top-12 sm:w-[33%] sm:min-w-[155px] sm:rounded-[2rem] sm:border-[6px] sm:p-1.5">
              <div className="relative overflow-hidden rounded-[1.15rem] bg-white text-slate-800 sm:rounded-[1.5rem]">
                <div className="flex h-5 items-center justify-between bg-white px-2 text-[6px] font-bold sm:h-7 sm:px-3 sm:text-[8px]"><span>9:41</span><span className="h-1 w-7 rounded-full bg-slate-800 sm:w-9" /><span>● ●</span></div>
                <div className="px-2 pb-2 sm:px-3 sm:pb-3">
                  <div className="flex items-center justify-between"><div className="flex items-center gap-1"><span className="flex size-4 items-center justify-center rounded bg-emerald-500 text-[7px] font-black text-white sm:size-5 sm:text-[9px]">V</span><span className="text-[7px] font-extrabold sm:text-[9px]">VyapaarDwaar Store</span></div><ShoppingBag className="size-3 text-slate-600 sm:size-3.5" /></div>
                  <div className="mt-1.5 flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-[6px] text-slate-400 sm:mt-2 sm:py-1.5 sm:text-[7px]"><Store className="size-2.5 sm:size-3" />Search products</div>
                  <div className="relative mt-2 overflow-hidden rounded-lg bg-gradient-to-br from-[#0f4c5c] to-emerald-700 px-2 py-2.5 text-white sm:mt-3 sm:rounded-xl sm:px-3 sm:py-4">
                    <p className="relative z-10 text-[6px] font-bold uppercase tracking-wide text-emerald-100 sm:text-[8px]">Wholesale picks</p><p className="relative z-10 mt-0.5 text-[9px] font-extrabold leading-tight sm:text-sm">Fresh styles,<br />better margins</p><span className="relative z-10 mt-1 inline-flex rounded-full bg-white px-1.5 py-0.5 text-[5px] font-bold text-emerald-800 sm:text-[6px]">Explore collection</span>
                    <Package className="absolute -bottom-1 -right-1 size-10 rotate-12 text-white/15 sm:size-14" />
                  </div>
                  <div className="mt-2 flex items-center justify-between sm:mt-3"><p className="text-[7px] font-extrabold sm:text-[9px]">Featured products</p><span className="text-[5px] font-semibold text-emerald-700 sm:text-[6px]">See all</span></div>
                  <div className="mt-1.5 grid grid-cols-2 gap-1.5 sm:mt-2 sm:gap-2">
                    {[
                      { image: '/uploads/products/0b2576f4-6f78-4a57-ae2b-ffefa95a9938.webp', name: 'Classic Collection', price: '₹1,250' },
                      { image: '/uploads/products/4f0b7afc-ada9-40d1-9a87-e7ade720cc12.webp', name: 'Everyday Essentials', price: '₹890' },
                    ].map(({ image, name, price }) => <article key={image} className="overflow-hidden rounded-md border border-slate-100 bg-white sm:rounded-lg"><div className="h-12 overflow-hidden bg-amber-50 sm:h-16"><img src={resolveProductImageUrl(image) ?? undefined} alt={name} className="size-full object-cover" /></div><div className="p-1 sm:p-1.5"><p className="truncate text-[5px] font-semibold sm:text-[7px]">{name}</p><p className="mt-0.5 text-[6px] font-extrabold text-emerald-700 sm:text-[8px]">{price}</p></div></article>)}
                  </div>
                </div>
                <div className="mx-auto mb-1 h-1 w-8 rounded-full bg-slate-300 sm:w-10" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-7xl px-5 py-16 lg:px-8">
        <div className="landing-reveal mx-auto max-w-2xl text-center">
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-tradeflow-green">Built for your business</p>
          <h2 className="mt-3 font-heading text-3xl font-extrabold tracking-tight sm:text-4xl">Everything Your Business Needs</h2>
          <p className="mt-3 text-sm leading-5 text-gray-600">Powerful tools to help you grow and manage your wholesale business — all in one place.</p>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: Icon, title, text }, index) => (
            <article key={title} className={`landing-reveal landing-motion rounded-2xl border border-tradeflow-gray-200 p-5 shadow-sm transition duration-200 hover:-translate-y-1 hover:border-tradeflow-green/40 hover:shadow-lg ${index % 2 ? 'bg-tradeflow-gray-50' : 'bg-white'}`}>
              <span className="flex size-11 items-center justify-center rounded-full bg-tradeflow-green/10 text-tradeflow-green"><Icon className="size-5" /></span>
              <h3 className="mt-4 font-heading text-base font-bold">{title}</h3>
              <p className="mt-2 text-sm leading-5 text-gray-600">{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="how-it-works" className="bg-white px-5 py-16">
        <div className="mx-auto max-w-7xl">
          <div className="landing-reveal mx-auto max-w-2xl text-center">
            <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-tradeflow-green">Get started</p>
            <h2 className="mt-3 font-heading text-3xl font-extrabold tracking-tight">How It Works</h2>
            <p className="mt-3 text-sm leading-5 text-gray-600">Get started in just a few simple steps.</p>
          </div>
          <div className="relative mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
            <div className="pointer-events-none absolute left-[10%] right-[10%] top-7 hidden border-t-2 border-dotted border-tradeflow-green/40 lg:block" />
            {steps.map(({ icon: Icon, title, text }, index) => (
              <article key={title} className="landing-reveal relative z-10 flex flex-col items-center rounded-2xl border border-tradeflow-gray-200 bg-tradeflow-gray-50 p-5 text-center shadow-sm">
                <span className="relative flex size-14 items-center justify-center rounded-full bg-white text-tradeflow-green shadow-md ring-4 ring-tradeflow-green/10">
                  <Icon className="size-6" />
                  <span className="absolute -right-2 -top-2 flex size-6 items-center justify-center rounded-full bg-tradeflow-navy text-[10px] font-extrabold text-white">{index + 1}</span>
                </span>
                <h3 className="mt-4 font-heading font-bold">{title}</h3>
                <p className="mt-2 text-sm leading-5 text-gray-600">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* <section id="pricing" className="bg-tradeflow-gray-50 px-5 py-16 lg:px-8">
        <div className="mx-auto max-w-7xl">
        <div className="landing-reveal mx-auto max-w-2xl text-center">
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-tradeflow-green">Straightforward plans</p>
          <h2 className="mt-3 font-heading text-3xl font-extrabold tracking-tight">Simple &amp; Transparent Pricing</h2>
          <p className="mt-3 text-sm leading-5 text-gray-600">Choose the plan that fits your business. Cancel anytime.</p>
        </div>
        <div className="mx-auto mt-8 grid max-w-6xl gap-5 md:grid-cols-2 xl:grid-cols-3">
          {subscriptionPlans.length ? subscriptionPlans.map((subscriptionPlan) => (
            <article key={subscriptionPlan.id} className={`landing-reveal rounded-2xl border bg-white p-6 shadow-sm ${subscriptionPlan.recommended ? 'border-tradeflow-green ring-2 ring-tradeflow-green/20' : 'border-tradeflow-gray-200'}`}>
              {subscriptionPlan.recommended && <span className="inline-flex rounded-full bg-tradeflow-green/10 px-3 py-1 text-xs font-bold text-tradeflow-green">Recommended</span>}
              <span className="flex size-10 items-center justify-center rounded-full bg-tradeflow-green/10 text-tradeflow-green"><CreditCard className="size-5" /></span>
              <h3 className="mt-4 font-heading text-lg font-bold">{subscriptionPlan.name}</h3>
              <p className="mt-3 text-4xl font-extrabold tracking-tight">₹{subscriptionPlan.price.toLocaleString('en-IN')}<span className="ml-1 text-sm font-medium text-gray-500">/{subscriptionPlan.billingPeriod === 'YEARLY' ? 'year' : 'month'}</span></p>
              <p className="mt-3 text-sm leading-5 text-gray-600">{subscriptionPlan.description}</p>
              <ul className="mt-5 space-y-2 text-sm text-gray-700">
                {subscriptionPlan.features.filter((feature) => feature.enabled).map((feature) => (
                  <li key={feature.id} className="flex items-center gap-2"><Check className="size-4 text-tradeflow-green" />{feature.title}</li>
                ))}
              </ul>
              <p className="mt-4 text-xs text-gray-500">{subscriptionPlan.taxNote}</p>
              {!loggedIn && <button type="button" onClick={() => showModal('register')} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-tradeflow-green px-4 py-2.5 text-sm font-bold text-tradeflow-navy">Get Started <ArrowRight className="size-4" /></button>}
            </article>
          )) : (
            <p role={subscriptionPlanError ? 'alert' : 'status'} className="rounded-xl border border-tradeflow-gray-200 bg-white p-6 text-center text-sm text-gray-600">
              {subscriptionPlanError || (subscriptionPlanLoading ? 'Loading subscription plans...' : 'No subscription plans are currently available.')}
            </p>
          )}
        </div>
        <p className="mx-auto mt-5 max-w-3xl text-center text-xs leading-5 text-gray-500">Plans and prices shown are the active options configured for this platform.</p>
        </div>
      </section> */}

      <section id="about" className="bg-sky-50 px-5 py-16">
        <div className="mx-auto max-w-7xl">
          <div className="landing-reveal mx-auto max-w-2xl text-center">
            <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-tradeflow-green">Made for Indian wholesale businesses</p>
            <h2 className="mt-3 font-heading text-3xl font-extrabold tracking-tight">Why Choose {BRAND_NAME}?</h2>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {landingCopy.benefits.map(({ icon: Icon, title, text }) => (
              <article key={title} className="landing-reveal flex gap-4 rounded-xl border border-sky-100 bg-white p-5 shadow-sm">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-700"><Icon className="size-5" /></span>
                <div><h3 className="font-heading font-bold">{title}</h3><p className="mt-1 text-sm leading-5 text-gray-600">{text}</p></div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-tradeflow-navy px-5 py-14 text-white sm:py-16">
        <div className="mx-auto grid max-w-7xl items-center gap-9 lg:grid-cols-[1fr_1.2fr_0.9fr]">
          <div className="landing-reveal relative flex min-h-52 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-sky-900 via-slate-800 to-tradeflow-navy p-6">
            <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-slate-950/60" />
            <div className="relative flex h-32 w-full max-w-xs items-end justify-center gap-2 rounded-t-lg border border-white/20 bg-white/10 px-4 pt-5">
              <span className="absolute left-3 top-3 flex items-center gap-1.5 text-[9px] font-bold text-white/80"><Building2 className="size-3.5 text-emerald-300" /> WHOLESALE</span>
              {[36, 58, 44, 76, 54].map((height, index) => <span key={index} className="w-1/6 rounded-t bg-gradient-to-t from-tradeflow-green/80 to-sky-200/80" style={{ height: `${height}%` }} />)}
              <span className="absolute -bottom-2 left-0 right-0 h-2 rounded bg-slate-950" />
            </div>
            <span className="absolute right-5 top-5 flex size-12 items-center justify-center rounded-xl bg-white/10 text-emerald-200"><Boxes className="size-6" /></span>
            <span className="absolute bottom-5 left-5 flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold"><Truck className="size-4 text-emerald-300" />Built for wholesale</span>
          </div>
          <div className="landing-reveal">
            <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-emerald-300">Take your business online</p>
            <h2 className="mt-3 font-heading text-3xl font-extrabold tracking-tight sm:text-4xl">Start Your Private B2B Store Today</h2>
            <p className="mt-3 text-sm leading-6 text-white/75">Take your wholesale business online and manage your retailers easily with {BRAND_NAME}.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              {loggedIn ? (
                <Link to="/dashboard" className="inline-flex items-center gap-2 rounded-xl bg-tradeflow-green px-5 py-3 font-bold text-tradeflow-navy shadow-lg transition hover:-translate-y-0.5">Go to Dashboard <ArrowRight className="size-4" /></Link>
              ) : (
                <>
                  <button type="button" onClick={() => showModal('register')} className="inline-flex items-center gap-2 rounded-xl bg-tradeflow-green px-5 py-3 font-bold text-tradeflow-navy shadow-lg transition hover:-translate-y-0.5 hover:bg-tradeflow-green-hover">Create Your Store <ArrowRight className="size-4" /></button>
                  <button type="button" onClick={() => showModal('login')} className="rounded-xl border border-white/30 bg-white/10 px-5 py-3 font-bold text-white hover:bg-white/20">Login</button>
                </>
              )}
            </div>
          </div>
          <div className="landing-reveal space-y-4 rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="flex items-start gap-3"><ShieldCheck className="mt-0.5 size-5 shrink-0 text-emerald-300" /><span><strong className="block text-xl">100%</strong><span className="text-sm text-white/70">Private &amp; Secure</span></span></p>
            <p className="flex items-start gap-3"><Building2 className="mt-0.5 size-5 shrink-0 text-emerald-300" /><span><strong className="block text-sm">All Business Types</strong><span className="text-xs leading-5 text-white/70">Manufacturers, Wholesalers, Distributors, Stockists</span></span></p>
            <p className="flex items-start gap-3"><Check className="mt-0.5 size-5 shrink-0 text-emerald-300" /><span><strong className="block text-sm">Trusted Platform</strong><span className="text-xs text-white/70">Built for Indian Businesses</span></span></p>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 bg-slate-950 text-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-10 md:grid-cols-[1.3fr_2fr] lg:px-8">
          <div><a href="#home" className="font-heading text-xl font-extrabold">{BRAND_NAME}</a><p className="mt-2 text-sm text-white/65">Your Business. Your Store. Your Way.</p></div>
          <nav className="flex flex-wrap gap-x-6 gap-y-3 text-sm text-white/75" aria-label="Footer navigation">
            <a href="#home" className="hover:text-tradeflow-green">Home</a>
            <a href="#features" className="hover:text-tradeflow-green">Features</a>
            <a href="#pricing" className="hover:text-tradeflow-green">Pricing</a>
            <a href="#how-it-works" className="hover:text-tradeflow-green">How It Works</a>
            <a href="#about" className="hover:text-tradeflow-green">About</a>
            <Link to="/dashboard/support" className="hover:text-tradeflow-green">Contact</Link>
            {loggedIn ? <Link to="/dashboard" className="font-semibold text-tradeflow-green hover:underline">Go to Dashboard</Link> : <button type="button" onClick={() => showModal('login')} className="hover:text-tradeflow-green">Login</button>}
          </nav>
          <div className="flex flex-col gap-2 border-t border-white/10 pt-5 text-xs text-white/55 sm:flex-row sm:items-center sm:justify-between md:col-span-2">
            <span>© {new Date().getFullYear()} {BRAND_NAME}. All rights reserved.</span>
            <span>Private B2B business platform for India</span>
          </div>
        </div>
      </footer>

      {modalTab && !loggedIn && authStatus === 'loggedOut' && (
        <WholesalerProvider>
          <AuthModal
            tab={modalTab}
            setTab={setModalTab}
            inviteToken={inviteToken}
            onClose={dismissModal}
            onSuccess={authSuccess}
          />
        </WholesalerProvider>
      )}
    </main>
  );
}

export default function LandingPage() {
  return <LandingContent />;
}
