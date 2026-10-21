import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowDownLeft,
  ArrowDown,
  ArrowRight,
  BarChart3,
  Boxes,
  Building2,
  Check,
  ChevronDown,
  CircleDollarSign,
  CreditCard,
  FileSpreadsheet,
  Link2,
  Menu,
  Package,
  ReceiptText,
  RotateCcw,
  ShieldCheck,
  ShoppingBag,
  Store,
  Tag,
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
import { WHOLESALER_PLAN_PRICING } from '@/config/plans';
import { clearAuthToken, getAuthToken } from '@/lib/api';

const landingCopy = {
  hero: {
    label: 'B2B WHOLESALE PLATFORM',
    headline: 'Run Your B2B Wholesale Business Online. Add Retailers, Take Orders, Grow Faster.',
    subtext: 'Add your retailers with your own link, share your catalog, and receive orders, payments and bills in one place.',
    primaryButton: 'Register Free',
    secondaryButton: 'See How It Works',
  },
  metadata: {
    title: `${BRAND_NAME} · B2B Wholesale Business Online`,
    description: 'Add retailers online, share your wholesale catalog, and manage B2B orders, stock, payments and bills in one place.',
  },
  keyMessages: [
    { icon: Users, title: 'Add Your Retailers Online', text: 'Every retailer joins with your link and sees only your products.' },
    { icon: Package, title: 'Sell in Bulk, Your Way', text: 'Set bulk prices, minimum order quantity and credit terms for each retailer.' },
    { icon: Truck, title: 'Track Every Order', text: 'Follow each order from placement through delivery and payment.' },
  ],
  features: [
    { icon: Link2, title: 'Retailer onboarding by link', text: 'Share your link so retailers can join your business online.' },
    { icon: Package, title: 'Product catalog with categories and colors', text: 'Organize products so retailers can find the right items.' },
    { icon: Boxes, title: 'Automatic stock updates', text: 'Stock changes as you manage orders.' },
    { icon: CreditCard, title: 'Bulk pricing and minimum order quantity', text: 'Set prices and order quantities for bulk purchases.' },
    { icon: CircleDollarSign, title: 'Credit for trusted retailers', text: 'Set credit terms for retailers you trust.' },
    { icon: ReceiptText, title: 'GST invoices', text: 'Create GST invoices for retailer orders.' },
    { icon: FileSpreadsheet, title: 'Bulk Excel product upload', text: 'Add or update products using an Excel file.' },
    { icon: Tag, title: 'Coupons and offers', text: 'Share offers with your connected retailers.' },
    { icon: BarChart3, title: 'Reports and analytics', text: 'Review orders, sales and stock in clear reports.' },
    { icon: RotateCcw, title: 'Returns handling', text: 'Review and manage retailer return requests.' },
  ],
  steps: [
    { icon: Store, title: 'Register your business', text: 'Create an account for your wholesale business.' },
    { icon: Package, title: 'Add your products', text: 'Add products and prices after your business is approved.' },
    { icon: Users, title: 'Share your link with retailers', text: 'Send your link so your retailers can join.' },
    { icon: ShoppingBag, title: 'Receive and manage orders', text: 'Review retailer orders and manage their progress.' },
  ],
  faqs: [
    ['Who is this B2B service for?', 'Manufacturers, wholesalers, distributors and stockists can manage products, retailers and orders.'],
    ['When can I add products?', 'Your account is ready after registration. Add products after your business details are approved.'],
    ['How do retailers join my business?', 'Share your link. Retailers who join see your products and can order from your catalog.'],
    ['Can I upload products in bulk?', 'Yes. Use the Excel upload to add or update products in bulk.'],
  ],
};

const steps = landingCopy.steps;
const features = landingCopy.features;
const faqs = landingCopy.faqs;

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
  onSuccess: (registered: boolean) => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);

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
                ? <RegisterForm embedded inviteToken={inviteToken} onSuccess={() => onSuccess(true)} />
                : <LoginForm embedded onSuccess={() => onSuccess(false)} />}
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
  const loggedIn = authStatus === 'loggedIn';
  const inviteToken = new URLSearchParams(window.location.search).get('invite') || '';

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

  const authSuccess = (registered: boolean) => {
    setModalTab(null);
    navigate('/dashboard', { replace: true, state: registered ? { registrationSuccess: true } : undefined });
  };

  const showModal = (tab: 'register' | 'login') => {
    setModalTab(tab);
    setMobileMenuOpen(false);
  };

  return (
    <main className="min-h-screen bg-white text-tradeflow-navy">
      <style>{`
        .landing-reveal { opacity: 0; transform: translateY(14px); transition: opacity .45s ease, transform .45s ease; }
        .landing-reveal.is-visible { opacity: 1; transform: translateY(0); }
        @keyframes landingFloat { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-7px); } }
        .landing-float { animation: landingFloat 5s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .landing-reveal, .landing-reveal.is-visible { opacity: 1; transform: none; transition: none; }
          .landing-motion, .landing-float { animation: none !important; transition: none !important; }
        }
      `}</style>
      <header className="sticky top-0 z-40 border-b border-tradeflow-gray-200 bg-white/95 backdrop-blur">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3 lg:px-8" aria-label="Main navigation">
          <a href="#home" className="flex items-center gap-2.5" aria-label={`${BRAND_NAME} home`}>
            <span className="flex size-10 items-center justify-center rounded-xl bg-tradeflow-green text-tradeflow-navy"><Store className="size-5" /></span>
            <span className="font-heading text-lg font-extrabold tracking-tight">{BRAND_NAME}</span>
          </a>
          <button type="button" className="rounded-lg p-2 md:hidden" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'} aria-expanded={mobileMenuOpen}>
            {mobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
          <div className={`${mobileMenuOpen ? 'absolute left-0 right-0 top-full flex flex-col border-b bg-white p-4 shadow-lg' : 'hidden'} items-center gap-6 text-sm font-semibold md:static md:flex md:flex-row md:border-0 md:bg-transparent md:p-0 md:shadow-none`}>
            <a onClick={() => setMobileMenuOpen(false)} href="#features" className="hover:text-tradeflow-green">Features</a>
            <a onClick={() => setMobileMenuOpen(false)} href="#how-it-works" className="hover:text-tradeflow-green">How it works</a>
            <a onClick={() => setMobileMenuOpen(false)} href="#pricing" className="hover:text-tradeflow-green">Pricing</a>
            <a onClick={() => setMobileMenuOpen(false)} href="#faq" className="hover:text-tradeflow-green">FAQ</a>
            {loggedIn ? (
              <Link to="/dashboard" className="text-tradeflow-green hover:underline">Go to Dashboard</Link>
            ) : (
              <>
                <button type="button" onClick={() => showModal('login')} className="hover:text-tradeflow-green">Login</button>
                <button type="button" onClick={() => showModal('register')} className="rounded-xl bg-tradeflow-green px-4 py-2.5 font-bold text-tradeflow-navy transition hover:bg-tradeflow-green-hover">Register Free</button>
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
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-bold text-emerald-100 shadow-sm">{landingCopy.hero.label}</span>
            <h1 className="mt-6 max-w-2xl font-heading text-4xl font-bold leading-[1.14] tracking-[-0.035em] sm:text-5xl lg:text-[3.4rem]">{landingCopy.hero.headline}</h1>
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
                { icon: Users, text: 'Add retailers online' },
                { icon: Package, text: 'Catalog and stock in one place' },
                { icon: ReceiptText, text: 'GST bills and payments' },
              ].map(({ icon: Icon, text }) => <span key={text} className="inline-flex items-center gap-2"><Icon className="size-4 text-emerald-200" />{text}</span>)}
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-2xl landing-reveal" aria-label="Illustration of your online shop dashboard">
            <div className="relative z-10 rounded-3xl border border-white/20 bg-white/95 p-4 text-tradeflow-navy shadow-2xl sm:p-7">
              <div className="flex items-center justify-between gap-3">
                <div><p className="text-xs font-bold uppercase tracking-wider text-gray-500">Your shop</p><p className="mt-1 font-heading text-base font-bold sm:text-lg">Business overview</p></div>
                <span className="flex size-11 items-center justify-center rounded-xl bg-tradeflow-green/10 text-tradeflow-green"><Building2 className="size-6" /></span>
              </div>
              <div className="mt-5 grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-tradeflow-gray-200 bg-white p-3 sm:p-4"><Package className="size-5 text-tradeflow-green" /><p className="mt-2 text-sm font-bold">Products</p><p className="mt-1 text-xs text-gray-500">View details</p></div>
                <div className="rounded-xl border border-tradeflow-gray-200 bg-white p-3 sm:p-4"><ShoppingBag className="size-5 text-tradeflow-green" /><p className="mt-2 text-sm font-bold">Orders</p><p className="mt-1 text-xs text-gray-500">View details</p></div>
                <div className="rounded-xl border border-tradeflow-gray-200 bg-white p-3 sm:p-4"><Boxes className="size-5 text-tradeflow-green" /><p className="mt-2 text-sm font-bold">Stock</p><p className="mt-1 text-xs text-gray-500">View details</p></div>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-[1.2fr_.8fr]">
                <div className="rounded-xl border border-tradeflow-gray-200 p-4">
                  <div className="flex items-center justify-between"><p className="text-sm font-bold">Sales overview</p><TrendingUp className="size-5 text-tradeflow-green" /></div>
                  <div className="mt-4 flex h-24 items-end justify-around gap-2 border-b border-gray-100 px-2">
                    {[35, 58, 44, 78, 62, 92, 70].map((height, index) => <span key={index} className="w-5 rounded-t bg-gradient-to-t from-tradeflow-green to-sky-300" style={{ height: `${height}%` }} />)}
                  </div>
                  <div className="mt-2 flex justify-between text-xs text-gray-400"><span>Mon</span><span>Wed</span><span>Fri</span><span>Sun</span></div>
                </div>
                <div className="rounded-xl border border-tradeflow-gray-200 p-4">
                  <p className="text-sm font-bold">Recent orders</p>
                  {['New order', 'Packed', 'Delivered'].map((label, index) => <div key={label} className="mt-4 flex items-center gap-2"><span className={`size-2.5 rounded-full ${index === 0 ? 'bg-sky-400' : index === 1 ? 'bg-amber-400' : 'bg-tradeflow-green'}`} /><span className="text-xs text-gray-600">{label}</span></div>)}
                </div>
              </div>
            </div>
            {[
              { icon: ShoppingBag, label: 'New order received', style: '-left-5 top-7', color: 'bg-sky-100 text-sky-700' },
              { icon: Boxes, label: 'Stock updated', style: '-right-4 top-[37%]', color: 'bg-emerald-100 text-emerald-700' },
              { icon: Wallet, label: 'Payment received', style: '-left-3 bottom-[18%]', color: 'bg-amber-100 text-amber-700' },
              { icon: Users, label: 'New retailer joined', style: '-right-3 bottom-4', color: 'bg-violet-100 text-violet-700' },
            ].map(({ icon: Icon, label, style, color }) => <div key={label} className={`landing-motion landing-float absolute ${style} z-20 hidden items-center gap-2 rounded-xl border border-tradeflow-gray-200 bg-white px-4 py-3 text-tradeflow-navy shadow-xl sm:flex`}><span className={`flex size-10 items-center justify-center rounded-full ${color}`}><Icon className="size-5" /></span><span className="text-sm font-bold">{label}</span></div>)}
          </div>
        </div>
      </section>

      <section className="border-b border-tradeflow-gray-200 bg-white px-5 py-7" aria-label="B2B wholesale tools">
        <div className="mx-auto grid max-w-7xl gap-3 sm:grid-cols-3 sm:gap-4">
          {landingCopy.keyMessages.map(({ icon: Icon, title, text }) => (
            <article key={title} className="flex items-start gap-3 rounded-xl bg-tradeflow-gray-50 px-4 py-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-tradeflow-green/10 text-tradeflow-green"><Icon className="size-5" /></span>
              <div><h2 className="text-sm font-bold text-tradeflow-navy">{title}</h2><p className="mt-1 text-xs leading-5 text-gray-600">{text}</p></div>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-12 lg:px-8">
        <div className="landing-reveal flex flex-col items-start justify-between gap-4 rounded-2xl bg-gradient-to-r from-emerald-50 to-sky-50 p-6 sm:flex-row sm:items-center sm:px-8">
          <div>
            <h2 className="font-heading text-xl font-extrabold">Free to start</h2>
            <p className="mt-1 text-sm leading-5 text-gray-600">Create your account and see the current plan choices before subscribing.</p>
          </div>
          {!loggedIn && <button type="button" onClick={() => showModal('register')} className="shrink-0 rounded-xl bg-tradeflow-green px-5 py-3 text-sm font-bold text-tradeflow-navy shadow-sm transition hover:bg-tradeflow-green-hover">Register Free</button>}
        </div>
      </section>

      <section className="bg-tradeflow-gray-50 px-5 py-16">
        <div className="mx-auto max-w-7xl">
          <div className="landing-reveal mx-auto max-w-2xl text-center">
            <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-tradeflow-green">A clear view of your business</p>
            <h2 className="mt-3 font-heading text-3xl font-extrabold tracking-tight">Bring B2B retailer orders online</h2>
            <p className="mt-3 text-sm leading-5 text-gray-600">Share your catalog with retailers and manage their orders in one place.</p>
          </div>
          <div className="landing-reveal mt-9 grid gap-4 md:grid-cols-2">
            <article className="flex gap-4 rounded-2xl border border-tradeflow-gray-200 bg-white p-6 shadow-sm">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-800"><FileSpreadsheet className="size-5" /></span>
              <div><h3 className="font-heading font-bold">Add retailers with your link</h3><p className="mt-2 text-sm leading-5 text-gray-600">Retailers join your business and see your catalog.</p></div>
            </article>
            <article className="flex gap-4 rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-800"><Store className="size-5" /></span>
              <div><h3 className="font-heading font-bold">Receive and manage orders</h3><p className="mt-2 text-sm leading-5 text-gray-600">Follow orders, stock, payments and bills together.</p></div>
            </article>
          </div>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-7xl px-5 py-16 lg:px-8">
        <div className="landing-reveal mx-auto max-w-2xl text-center">
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-tradeflow-green">Tools for daily wholesale work</p>
          <h2 className="mt-3 font-heading text-3xl font-extrabold tracking-tight sm:text-4xl">B2B tools for wholesale businesses</h2>
          <p className="mt-3 text-sm leading-5 text-gray-600">Add retailers, share products and keep orders moving.</p>
        </div>
        <div className="landing-reveal mt-8 grid gap-3 rounded-2xl bg-tradeflow-navy p-5 text-white sm:grid-cols-3 sm:p-6">
          {[
          { icon: Package, text: 'Share your catalog with retailers.' },
          { icon: Users, text: 'Add retailers online with your link.' },
          { icon: CircleDollarSign, text: 'Track orders, payments and bills.' },
          ].map(({ icon: Icon, text }) => <div key={text} className="flex items-center gap-3 rounded-xl bg-white/5 p-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-tradeflow-green/15 text-emerald-200"><Icon className="size-5" /></span><p className="text-sm font-semibold leading-5">{text}</p></div>)}
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
            <h2 className="mt-3 font-heading text-3xl font-extrabold tracking-tight">How it works</h2>
            <p className="mt-3 text-sm leading-5 text-gray-600">Set up your business and start taking orders from retailers.</p>
          </div>
          <div className="relative mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="pointer-events-none absolute left-[12%] right-[12%] top-7 hidden border-t-2 border-dotted border-tradeflow-green/40 lg:block" />
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

      <section className="bg-gradient-to-br from-sky-50 via-white to-emerald-50 px-5 py-16">
        <div className="mx-auto max-w-5xl">
          <div className="landing-reveal mx-auto max-w-2xl text-center">
            <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-tradeflow-green">Who it is for</p>
            <h2 className="mt-3 font-heading text-3xl font-extrabold tracking-tight">For manufacturers and wholesale suppliers</h2>
            <p className="mt-3 max-w-lg text-sm leading-5 text-gray-600">For manufacturers, wholesalers, distributors and stockists.</p>
          </div>
          <div className="landing-reveal mt-8">
            <article className="landing-motion rounded-3xl bg-tradeflow-navy p-6 text-white shadow-xl transition hover:-translate-y-1 sm:p-8">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                <div className="flex items-center gap-4 sm:w-1/3"><span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-emerald-200"><Building2 className="size-7" /></span><div><p className="text-xs font-bold uppercase tracking-wider text-white/60">Your business</p><h3 className="mt-1 font-heading text-xl font-extrabold">Wholesaler</h3></div></div>
                <div className="grid gap-3 sm:flex-1 sm:grid-cols-3">
                  {['Add retailers with your link', 'Share products and bulk prices', 'Take orders and track payments'].map((text) => <p key={text} className="flex items-center gap-2 rounded-xl bg-white/5 p-3 text-sm font-semibold"><Check className="size-4 shrink-0 text-emerald-300" />{text}</p>)}
                </div>
              </div>
            </article>
            <div className="flex flex-col items-center py-3 text-center text-sm font-semibold text-tradeflow-navy">
              <span className="h-7 border-l-2 border-dotted border-tradeflow-green" />
              <span className="flex items-center gap-2 rounded-full bg-white px-4 py-2 shadow-sm"><Link2 className="size-4 text-tradeflow-green" />Retailers join with your link</span>
              <ArrowDown className="mt-1 size-5 text-tradeflow-green" />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {['Join with your link', 'See your products', 'Place and track orders'].map((text, index) => <article key={text} className="landing-motion flex items-center gap-4 rounded-2xl border border-tradeflow-gray-200 bg-white p-5 shadow-md transition hover:-translate-y-1"><span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-700"><Store className="size-6" /></span><div><p className="text-[10px] font-bold uppercase tracking-wider text-tradeflow-green">Retailer {index + 1}</p><h3 className="mt-1 font-heading font-bold">{text}</h3></div></article>)}
            </div>
          </div>
          <p className="mt-6 text-center text-sm font-medium leading-6 text-gray-600">Retailers see your catalog. You set your prices, minimum order quantities and credit terms.</p>
        </div>
      </section>

      <section id="pricing" className="mx-auto max-w-5xl px-5 py-16 lg:px-8">
        <div className="landing-reveal mx-auto max-w-2xl text-center">
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-tradeflow-green">Plans for your business</p>
          <h2 className="mt-3 font-heading text-3xl font-extrabold tracking-tight">Plans for your wholesale business</h2>
          <p className="mt-3 text-sm leading-5 text-gray-600">See the same monthly and yearly prices shown in your account.</p>
        </div>
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          {[
            ['Monthly Wholesaler Plan', WHOLESALER_PLAN_PRICING.MONTHLY, 'month'],
            ['Annual Pro Plan', WHOLESALER_PLAN_PRICING.ANNUAL, 'year'],
          ].map(([name, price, period]) => (
            <article key={name} className="landing-reveal rounded-2xl border border-tradeflow-gray-200 bg-white p-6 shadow-sm">
              <span className="flex size-10 items-center justify-center rounded-full bg-tradeflow-green/10 text-tradeflow-green"><CreditCard className="size-5" /></span>
              <h3 className="mt-4 font-heading text-lg font-bold">{name}</h3>
              <p className="mt-3 text-4xl font-extrabold tracking-tight">₹{Number(price).toLocaleString('en-IN')}<span className="ml-1 text-sm font-medium text-gray-500">/{period}</span></p>
              <p className="mt-3 text-sm leading-5 text-gray-600">Review plan details and available offers in your account.</p>
              {!loggedIn && <button type="button" onClick={() => showModal('register')} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-tradeflow-green px-4 py-2.5 text-sm font-bold text-tradeflow-navy">Register Free <ArrowRight className="size-4" /></button>}
            </article>
          ))}
        </div>
      </section>

      <section id="faq" className="bg-tradeflow-gray-50 px-5 py-16">
        <div className="mx-auto max-w-4xl">
          <div className="landing-reveal text-center">
            <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-tradeflow-green">Questions and answers</p>
            <h2 className="mt-3 font-heading text-3xl font-extrabold tracking-tight">Common questions</h2>
            <p className="mt-3 text-sm leading-5 text-gray-600">Answers about adding retailers, products and orders.</p>
          </div>
          <div className="mt-8 space-y-3">
            {faqs.map(([question, answer]) => (
              <details key={question} className="landing-reveal group rounded-xl border border-tradeflow-gray-200 bg-white p-5 open:border-tradeflow-green/40">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-bold"><span>{question}</span><ChevronDown className="size-4 shrink-0 transition group-open:rotate-180" /></summary>
                <p className="mt-3 text-sm leading-5 text-gray-600">{answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-gradient-to-r from-tradeflow-navy via-[#174a57] to-tradeflow-green px-5 py-16 text-center text-white">
        <div className="landing-reveal mx-auto max-w-3xl">
          <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-white/10 text-emerald-200"><ArrowDownLeft className="size-6" /></span>
          <h2 className="mt-4 font-heading text-3xl font-extrabold tracking-tight sm:text-4xl">Bring your retailers online today</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-5 text-white/80">Register your business, share your link and start receiving retailer orders online.</p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            {loggedIn ? (
              <Link to="/dashboard" className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 font-bold text-tradeflow-navy shadow-lg transition hover:-translate-y-0.5">Go to Dashboard <ArrowRight className="size-4" /></Link>
            ) : (
              <>
                <button type="button" onClick={() => showModal('register')} className="inline-flex items-center gap-2 rounded-xl bg-tradeflow-green px-6 py-3 font-bold text-tradeflow-navy shadow-lg transition hover:-translate-y-0.5 hover:bg-tradeflow-green-hover">Register Free <ArrowRight className="size-4" /></button>
                <button type="button" onClick={() => showModal('login')} className="rounded-xl border border-white/30 bg-white/10 px-6 py-3 font-bold text-white hover:bg-white/20">Login</button>
              </>
            )}
          </div>
        </div>
      </section>

      <footer className="border-t border-tradeflow-gray-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-8 text-sm text-gray-500 sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <a href="#home" className="font-heading font-extrabold text-tradeflow-navy">{BRAND_NAME}</a>
          <div className="flex flex-wrap gap-5"><a href="#features" className="hover:text-tradeflow-green">Features</a><a href="#faq" className="hover:text-tradeflow-green">Questions</a>{loggedIn ? <Link to="/dashboard" className="font-semibold text-tradeflow-green hover:underline">Go to Dashboard</Link> : <button type="button" onClick={() => showModal('login')} className="hover:text-tradeflow-green">Login</button>}</div>
          <span>Trust · Grow · Together</span>
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
