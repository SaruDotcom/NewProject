import React, { useState, useEffect, useRef, useCallback } from "react";
import { Link, useNavigate } from "@/lib/router";
import {
  CheckCircle,
  ShieldCheck,
  Truck,
  FileText,
  CreditCard,
  Tag,
  RotateCcw,
  Heart,
  ChevronDown,
  X,
  Store,
  ShoppingBag,
  ArrowRight,
  Menu,
  Building2,
  Package,
  Clock,
  Sparkles,
  PhoneCall,
  Laptop,
} from "lucide-react";
import { useStore } from "@/state/store";
import { api, setAuthToken, ApiError } from "@/api/api";
import { TradeFlowMark } from "./primitives";
import { toast } from "sonner";
import {
  clearStoredReferralAttribution,
  createReferralAttribution,
  getReferralAttributionFromUrl,
  getStoredReferralAttribution,
  markRetailerRegistrationComplete,
  saveReferralAttribution,
  type ReferralAttribution,
} from "@/lib/referral-attribution";

export interface WholesalerPublicInfo {
  businessName: string;
  logo: string;
  city: string;
  categories?: string[];
  code: string;
}

export function LandingPage() {
  const navigate = useNavigate();
  const { isLoggedIn } = useStore();

  // Mobile menu
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Referral State
  const [referralCode, setReferralCode] = useState("");
  const [referralAttribution, setReferralAttribution] = useState<ReferralAttribution | null>(null);
  const [supplier, setSupplier] = useState<WholesalerPublicInfo | null>(null);
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
  const [referralError, setReferralError] = useState("");

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"welcome" | "register" | "login">("welcome");

  // Register Form State
  const [regName, setRegName] = useState("");
  const [regLoginId, setRegLoginId] = useState("");
  const [regBusinessName, setRegBusinessName] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [isSubmittingReg, setIsSubmittingReg] = useState(false);

  // Login Form State
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [isSubmittingLogin, setIsSubmittingLogin] = useState(false);

  // Accordion State for FAQ
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // Focus trap ref
  const modalRef = useRef<HTMLDivElement>(null);

  // Update SEO Meta Tags
  useEffect(() => {
    document.title = "TradeFlow - Order Wholesale From Your Trusted Supplier";
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute("content", "Simple online ordering portal for retail shop owners to buy direct from verified wholesale suppliers with transparent pricing and fast delivery.");
    }
  }, []);

  const verifyCode = useCallback(async (
    code: string,
    attribution = createReferralAttribution(code, new URL(window.location.href)),
  ): Promise<boolean> => {
    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode) return false;

    setIsVerifyingCode(true);
    setReferralError("");

    try {
      const response = await api.getReferral(cleanCode);
      const data = response?.data?.wholesaler;
      if (data && data.businessName) {
        const wholesalerInfo: WholesalerPublicInfo = {
          businessName: data.businessName,
          logo: data.logo || "",
          city: data.city || "",
          categories: data.categories || [],
          code: cleanCode,
        };
        setSupplier(wholesalerInfo);
        setReferralCode(cleanCode);
        const savedAttribution = { ...attribution, code: cleanCode };
        setReferralAttribution(savedAttribution);
        saveReferralAttribution(savedAttribution);
        setReferralError("");
        return true;
      } else {
        setSupplier(null);
        if (getStoredReferralAttribution()?.code === cleanCode) {
          clearStoredReferralAttribution();
          setReferralAttribution(null);
          setReferralCode("");
        }
        setReferralError("This link is not valid. Please ask your wholesaler for a new link.");
        return false;
      }
    } catch (err) {
      setSupplier(null);
      const status = err instanceof ApiError ? err.status : undefined;
      if (status === 403 || status === 404) {
        if (getStoredReferralAttribution()?.code === cleanCode) {
          clearStoredReferralAttribution();
          setReferralAttribution(null);
          setReferralCode("");
        }
        setReferralError(
          err instanceof ApiError && err.message.includes("currently unavailable")
            ? err.message
            : "This link is not valid. Please ask your wholesaler for a new link.",
        );
      } else {
        setReferralError("Unable to verify this invite link. Please try again.");
      }
      return false;
    } finally {
      setIsVerifyingCode(false);
    }
  }, []);

  // Focus trap and ESC close
  useEffect(() => {
    if (!modalOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeModal();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [modalOpen]);

  const openModal = (mode?: "welcome" | "register" | "login") => {
    if (mode === "login") {
      navigate({ to: "/login" });
      return;
    }
    const code =
      supplier?.code ||
      getReferralAttributionFromUrl(new URL(window.location.href))?.code ||
      getStoredReferralAttribution()?.code;
    if (code) {
      navigate({ to: "/", search: { ref: code } });
    } else {
      navigate({ to: "/register" });
    }
  };

  const closeModal = () => {
    setModalOpen(false);
  };

  const clearReferral = () => {
    clearStoredReferralAttribution();
    setReferralAttribution(null);
    setReferralCode("");
    setSupplier(null);
    setReferralError("");
    closeModal();
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!referralCode || !supplier) {
      setReferralError("Please open the registration link your wholesaler sent you.");
      closeModal();
      navigate({ to: "/register" });
      return;
    }
    if (!/^\d{10}$/.test(regPhone.trim())) {
      toast.error("Please enter a valid 10-digit mobile number.");
      return;
    }
    if (regPassword.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }

    setIsSubmittingReg(true);
    try {
      const res = await api.register({
        name: regName.trim(),
        loginId: regLoginId.trim().toUpperCase(),
        businessName: regBusinessName.trim() || `${regName.trim()}'s Store`,
        phone: regPhone.trim(),
        email: regEmail.trim(),
        password: regPassword,
        referralCode: referralCode.trim().toUpperCase(),
        utmSource: referralAttribution?.utmSource || "",
        utmMedium: referralAttribution?.utmMedium || "",
        utmCampaign: referralAttribution?.utmCampaign || "",
        utmTerm: referralAttribution?.utmTerm || "",
        utmContent: referralAttribution?.utmContent || "",
        firstLandingAt: referralAttribution?.firstLandingAt,
      });

      const token = res.data?.token || res.data?.accessToken;
      markRetailerRegistrationComplete();
      if (token) {
        setAuthToken(token);
        toast.success(`Registration Successful. You are now connected to ${supplier.businessName}`);
        closeModal();
        window.location.href = "/";
      } else {
        toast.success("Account created! Please sign in.");
        setModalMode("login");
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Registration failed.";
      toast.error(errorMsg);
    } finally {
      setIsSubmittingReg(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingLogin(true);
    try {
      const res = await api.login({
        email: loginEmail.trim(),
        password: loginPassword,
      });
      const token = res.data?.token || res.data?.accessToken;
      if (token) {
        setAuthToken(token);
        markRetailerRegistrationComplete();
        toast.success("Login successful!");
        closeModal();
        window.location.href = "/";
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Invalid retailer ID or password";
      toast.error(errorMsg);
    } finally {
      setIsSubmittingLogin(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F7F8] text-[#12304A] font-sans antialiased selection:bg-[#20A66A]/20 selection:text-[#12304A]">
      {/* 1. NAVBAR */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#D8E1E5] shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 focus:outline-hidden">
            <TradeFlowMark className="size-9 rounded-xl shadow-xs" />
            <div className="flex flex-col">
              <span className="font-heading font-black text-xl text-[#12304A] leading-none">
                Trade<span className="text-[#20A66A]">Flow</span>
              </span>
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#20A66A] leading-none mt-0.5">
                Retailer Portal
              </span>
            </div>
          </Link>

          {/* Desktop Nav Items */}
          <nav className="hidden md:flex items-center gap-8">
            <a href="#how-it-works" className="text-sm font-semibold text-[#647782] hover:text-[#12304A] transition-colors">
              How it works
            </a>
            <a href="#benefits" className="text-sm font-semibold text-[#647782] hover:text-[#12304A] transition-colors">
              Benefits
            </a>
            <a href="#faq" className="text-sm font-semibold text-[#647782] hover:text-[#12304A] transition-colors">
              FAQ
            </a>
          </nav>

          {/* Action Buttons */}
          <div className="hidden md:flex items-center gap-3">
            {isLoggedIn ? (
              <button
                type="button"
                onClick={() => navigate({ to: "/" })}
                className="px-5 py-2.5 bg-[#20A66A] hover:bg-[#198957] text-white text-sm font-bold rounded-xl shadow-sm transition-all flex items-center gap-2 cursor-pointer"
              >
                <span>Go to Store</span>
                <ArrowRight className="size-4" />
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => openModal("login")}
                  className="px-4 py-2 text-sm font-bold text-[#12304A] hover:text-[#20A66A] transition-colors cursor-pointer"
                >
                  Login
                </button>
                <button
                  type="button"
                  onClick={() => openModal("register")}
                  className="px-5 py-2.5 bg-[#20A66A] hover:bg-[#198957] text-white text-sm font-bold rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Register Free</span>
                </button>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-[#12304A] hover:bg-[#EAF0F2] rounded-lg transition-colors cursor-pointer"
            aria-label="Toggle Navigation Menu"
          >
            {mobileMenuOpen ? <X className="size-6" /> : <Menu className="size-6" />}
          </button>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-b border-[#D8E1E5] px-4 pt-3 pb-6 flex flex-col gap-3 shadow-lg animate-in slide-in-from-top-2">
            <a
              href="#how-it-works"
              onClick={() => setMobileMenuOpen(false)}
              className="py-2 text-sm font-semibold text-[#344B58]"
            >
              How it works
            </a>
            <a
              href="#benefits"
              onClick={() => setMobileMenuOpen(false)}
              className="py-2 text-sm font-semibold text-[#344B58]"
            >
              Benefits
            </a>
            <a
              href="#faq"
              onClick={() => setMobileMenuOpen(false)}
              className="py-2 text-sm font-semibold text-[#344B58]"
            >
              FAQ
            </a>
            <div className="pt-2 border-t border-[#D8E1E5] flex flex-col gap-2">
              {isLoggedIn ? (
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    navigate({ to: "/" });
                  }}
                  className="w-full py-2.5 bg-[#20A66A] text-white text-sm font-bold rounded-xl text-center cursor-pointer"
                >
                  Go to Store
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      openModal("login");
                    }}
                    className="w-full py-2.5 bg-[#EAF0F2] text-[#12304A] text-sm font-bold rounded-xl text-center cursor-pointer"
                  >
                    Login
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      openModal("register");
                    }}
                    className="w-full py-2.5 bg-[#20A66A] text-white text-sm font-bold rounded-xl text-center cursor-pointer"
                  >
                    Register Free
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      {/* 2. HERO SECTION */}
      <section className="relative overflow-hidden pt-12 pb-20 lg:pt-18 lg:pb-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            {/* Left Content Column */}
            <div className="lg:col-span-7 flex flex-col gap-6">
              
              {/* Optional Supplier Card in Hero when ref code is valid */}
              {supplier ? (
                <div className="p-4 bg-white rounded-2xl border-2 border-[#20A66A]/30 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    {supplier.logo ? (
                      <img
                        src={supplier.logo}
                        alt={supplier.businessName}
                        className="size-13 rounded-xl object-contain border border-[#D8E1E5] p-1 bg-white shrink-0"
                      />
                    ) : (
                      <div className="size-13 rounded-xl bg-[#E9F7F0] text-[#20A66A] font-heading font-black text-xl flex items-center justify-center shrink-0">
                        {supplier.businessName.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-heading font-bold text-base text-[#12304A]">{supplier.businessName}</span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-[#E9F7F0] text-[#20A66A]">
                          <ShieldCheck className="size-3" />
                          Verified supplier
                        </span>
                      </div>
                      <p className="text-xs text-[#647782] mt-0.5">
                        You are invited by <strong className="text-[#12304A]">{supplier.businessName}</strong>
                        {supplier.city ? ` • ${supplier.city}` : ""}
                      </p>
                    </div>
                  </div>

                  {supplier.categories && supplier.categories.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 self-start sm:self-center">
                      {supplier.categories.slice(0, 3).map((cat) => (
                        <span key={cat} className="px-2 py-0.5 bg-[#F4F7F8] border border-[#D8E1E5] text-[11px] font-semibold text-[#647782] rounded-md">
                          {cat}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ) : referralError ? (
                <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-semibold flex items-center gap-2">
                  <span>{referralError}</span>
                </div>
              ) : null}

              {/* Headline */}
              <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-extrabold text-[#12304A] tracking-tight leading-[1.12]">
                Order wholesale from your trusted supplier, online
              </h1>

              {/* Subtext (one sentence, <= 15 words) */}
              <p className="text-lg text-[#647782] font-normal leading-relaxed max-w-2xl">
                Buy products directly from verified suppliers with transparent pricing and fast store delivery.
              </p>

              {/* Hero Action Buttons */}
              <div className="flex flex-wrap items-center gap-4 pt-2">
                {isLoggedIn ? (
                  <button
                    type="button"
                    onClick={() => navigate({ to: "/" })}
                    className="px-8 py-3.5 bg-[#20A66A] hover:bg-[#198957] text-white text-base font-bold rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
                  >
                    <span>Go to Store</span>
                    <ArrowRight className="size-5" />
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => openModal("register")}
                      className="px-8 py-3.5 bg-[#20A66A] hover:bg-[#198957] text-white text-base font-bold rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
                    >
                      <span>Register Free</span>
                      <ArrowRight className="size-5" />
                    </button>
                    <a
                      href="#how-it-works"
                      className="px-6 py-3.5 bg-white hover:bg-[#EAF0F2] text-[#12304A] text-base font-bold rounded-xl border border-[#D8E1E5] transition-all cursor-pointer"
                    >
                      How it works
                    </a>
                  </>
                )}
              </div>

              {/* Quick trust metrics */}
              <div className="flex items-center gap-6 pt-4 text-xs font-bold text-[#647782]">
                <div className="flex items-center gap-1.5">
                  <CheckCircle className="size-4 text-[#20A66A]" />
                  <span>Verified B2B Suppliers</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle className="size-4 text-[#20A66A]" />
                  <span>Live Wholesale Prices</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle className="size-4 text-[#20A66A]" />
                  <span>GST Invoices Included</span>
                </div>
              </div>
            </div>

            {/* Right Graphic Banner Column */}
            <div className="lg:col-span-5 relative">
              {/* Graphic container with navy-to-green gradient */}
              <div className="relative rounded-3xl bg-linear-to-br from-[#12304A] via-[#1B4261] to-[#20A66A] p-6 sm:p-8 shadow-2xl overflow-hidden min-h-[460px] flex items-center justify-center">
                
                {/* Soft shapes and low opacity background commerce icons */}
                <div className="absolute top-0 right-0 -mr-16 -mt-16 size-64 rounded-full bg-[#38BDF8]/10 blur-2xl pointer-events-none" />
                <div className="absolute bottom-0 left-0 -ml-16 -mb-16 size-64 rounded-full bg-[#20A66A]/20 blur-2xl pointer-events-none" />
                
                <Package className="absolute top-8 left-8 size-14 text-white/10 pointer-events-none" />
                <Store className="absolute bottom-10 right-8 size-16 text-white/10 pointer-events-none" />
                <ShoppingBag className="absolute bottom-14 left-10 size-12 text-white/10 pointer-events-none" />

                {/* HTML & CSS Phone & Store Mockup */}
                <div className="relative z-10 w-full max-w-[290px] bg-white rounded-3xl shadow-2xl border-4 border-white/20 overflow-hidden text-[#12304A]">
                  {/* Mock phone status bar */}
                  <div className="bg-[#12304A] text-white px-4 py-2 flex items-center justify-between text-[11px] font-medium">
                    <span>9:41 AM</span>
                    <div className="flex items-center gap-1 text-[10px]">
                      <span>5G</span>
                      <div className="w-3.5 h-2 border border-white rounded-xs relative">
                        <div className="w-2 h-1 bg-white absolute top-0.5 left-0.5" />
                      </div>
                    </div>
                  </div>

                  {/* Mock app header */}
                  <div className="bg-[#12304A] text-white p-3.5 border-t border-white/10 flex items-center justify-between">
                    <div>
                      <div className="text-[10px] text-[#38BDF8] font-bold uppercase">Wholesale Store</div>
                      <div className="text-sm font-bold truncate max-w-[170px]">{supplier?.businessName || "Verified Supplier"}</div>
                    </div>
                    <div className="size-7 rounded-full bg-[#20A66A] text-white text-[11px] font-bold flex items-center justify-center">
                      🛒 3
                    </div>
                  </div>

                  {/* Mock product catalog list */}
                  <div className="p-3 bg-[#F4F7F8] flex flex-col gap-2">
                    <div className="p-2.5 bg-white rounded-xl border border-[#D8E1E5] flex items-center gap-2.5">
                      <div className="size-11 rounded-lg bg-[#EAF0F2] flex items-center justify-center text-xs font-bold text-[#647782]">
                        📦
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-[#12304A] truncate">Fortune Sunlite Oil 1L</div>
                        <div className="text-[11px] text-[#20A66A] font-extrabold">₹118 <span className="text-[9px] text-[#647782] line-through">₹145</span></div>
                      </div>
                      <span className="text-[10px] bg-[#E9F7F0] text-[#20A66A] font-bold px-1.5 py-0.5 rounded-sm">MOQ: 12</span>
                    </div>

                    <div className="p-2.5 bg-white rounded-xl border border-[#D8E1E5] flex items-center gap-2.5">
                      <div className="size-11 rounded-lg bg-[#EAF0F2] flex items-center justify-center text-xs font-bold text-[#647782]">
                        🌾
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-[#12304A] truncate">Aashirvaad Atta 10kg</div>
                        <div className="text-[11px] text-[#20A66A] font-extrabold">₹390 <span className="text-[9px] text-[#647782] line-through">₹460</span></div>
                      </div>
                      <span className="text-[10px] bg-[#E9F7F0] text-[#20A66A] font-bold px-1.5 py-0.5 rounded-sm">MOQ: 5</span>
                    </div>

                    {/* Quick checkout bar */}
                    <div className="mt-1 p-2 bg-[#12304A] text-white rounded-xl flex items-center justify-between text-xs font-bold">
                      <span>Total: ₹3,366</span>
                      <span className="text-[#38BDF8] flex items-center gap-1 text-[11px]">Bill Ready →</span>
                    </div>
                  </div>
                </div>

                {/* Floating Card 1: Order Placed */}
                <div className="absolute -top-4 -left-4 z-20 bg-white/95 backdrop-blur-md px-3.5 py-2.5 rounded-2xl shadow-xl border border-white/60 flex items-center gap-2.5 animate-bounce-short">
                  <div className="size-7 rounded-full bg-[#E9F7F0] text-[#20A66A] flex items-center justify-center">
                    <CheckCircle className="size-4" />
                  </div>
                  <div>
                    <div className="text-[10px] text-[#647782] font-semibold">Status</div>
                    <div className="text-xs font-extrabold text-[#12304A]">Order placed</div>
                  </div>
                </div>

                {/* Floating Card 2: Bulk price applied */}
                <div className="absolute top-1/2 -right-5 z-20 bg-white/95 backdrop-blur-md px-3.5 py-2.5 rounded-2xl shadow-xl border border-white/60 flex items-center gap-2.5">
                  <div className="size-7 rounded-full bg-[#EAF8FE] text-[#38BDF8] flex items-center justify-center">
                    <Tag className="size-4" />
                  </div>
                  <div>
                    <div className="text-[10px] text-[#647782] font-semibold">Trade Discount</div>
                    <div className="text-xs font-extrabold text-[#12304A]">Bulk price applied</div>
                  </div>
                </div>

                {/* Floating Card 3: Order on the way */}
                <div className="absolute -bottom-4 left-6 z-20 bg-white/95 backdrop-blur-md px-3.5 py-2.5 rounded-2xl shadow-xl border border-white/60 flex items-center gap-2.5">
                  <div className="size-7 rounded-full bg-[#12304A] text-white flex items-center justify-center">
                    <Truck className="size-4 text-[#38BDF8]" />
                  </div>
                  <div>
                    <div className="text-[10px] text-[#647782] font-semibold">Dispatch</div>
                    <div className="text-xs font-extrabold text-[#12304A]">Order on the way</div>
                  </div>
                </div>

              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 3. "WHAT IS THIS?" STRIP */}
      <section className="py-14 bg-white border-y border-[#D8E1E5]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <h2 className="font-heading text-2xl sm:text-3xl font-extrabold text-[#12304A]">
              What is TradeFlow?
            </h2>
            <p className="text-sm sm:text-base text-[#647782] mt-2">
              A simple online portal to order trade stock from your existing wholesale supplier.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-6 rounded-2xl bg-[#F4F7F8] border border-[#D8E1E5] flex flex-col items-center text-center">
              <div className="size-14 rounded-2xl bg-[#E9F7F0] text-[#20A66A] flex items-center justify-center mb-4">
                <Store className="size-7" />
              </div>
              <h3 className="font-heading font-bold text-base text-[#12304A]">
                See your wholesaler&apos;s full catalog
              </h3>
              <p className="text-xs text-[#647782] mt-2 leading-relaxed">
                Browse every item, brand, variant, and stock count without calling on phone.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-[#F4F7F8] border border-[#D8E1E5] flex flex-col items-center text-center">
              <div className="size-14 rounded-2xl bg-[#EAF8FE] text-[#38BDF8] flex items-center justify-center mb-4">
                <Tag className="size-7" />
              </div>
              <h3 className="font-heading font-bold text-base text-[#12304A]">
                Order in bulk at wholesale prices
              </h3>
              <p className="text-xs text-[#647782] mt-2 leading-relaxed">
                Enjoy transparent tiered bulk rates and promotional deal discounts directly on screen.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-[#F4F7F8] border border-[#D8E1E5] flex flex-col items-center text-center">
              <div className="size-14 rounded-2xl bg-[#EAF0F2] text-[#12304A] flex items-center justify-center mb-4">
                <Truck className="size-7" />
              </div>
              <h3 className="font-heading font-bold text-base text-[#12304A]">
                Track orders and returns in one place
              </h3>
              <p className="text-xs text-[#647782] mt-2 leading-relaxed">
                Follow order dispatch timelines, download bills, and initiate easy item return requests.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. "HOW IT WORKS" (4 Numbered Steps) */}
      <section id="how-it-works" className="py-20 bg-[#F4F7F8]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <h2 className="font-heading text-2xl sm:text-3xl font-extrabold text-[#12304A]">
              How it works
            </h2>
            <p className="text-sm sm:text-base text-[#647782] mt-2">
              Order all your shop stock in four simple steps right from your phone.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            
            {/* Step 1 */}
            <div className="relative p-6 bg-white rounded-2xl border border-[#D8E1E5] shadow-xs flex flex-col">
              <div className="size-10 rounded-xl bg-[#12304A] text-white font-heading font-extrabold text-base flex items-center justify-center mb-4">
                1
              </div>
              <h3 className="font-heading font-bold text-base text-[#12304A]">
                Open your wholesaler&apos;s link
              </h3>
              <p className="text-xs text-[#647782] mt-2 leading-relaxed">
                Click your supplier&apos;s WhatsApp invite link to register and connect directly.
              </p>
            </div>

            {/* Step 2 */}
            <div className="relative p-6 bg-white rounded-2xl border border-[#D8E1E5] shadow-xs flex flex-col">
              <div className="size-10 rounded-xl bg-[#20A66A] text-white font-heading font-extrabold text-base flex items-center justify-center mb-4">
                2
              </div>
              <h3 className="font-heading font-bold text-base text-[#12304A]">
                Register in 1 minute
              </h3>
              <p className="text-xs text-[#647782] mt-2 leading-relaxed">
                Enter your mobile number, shop name, and set a quick password to start.
              </p>
            </div>

            {/* Step 3 */}
            <div className="relative p-6 bg-white rounded-2xl border border-[#D8E1E5] shadow-xs flex flex-col">
              <div className="size-10 rounded-xl bg-[#12304A] text-white font-heading font-extrabold text-base flex items-center justify-center mb-4">
                3
              </div>
              <h3 className="font-heading font-bold text-base text-[#12304A]">
                Choose products and quantity
              </h3>
              <p className="text-xs text-[#647782] mt-2 leading-relaxed">
                Add cartons and cases with clear minimum order quantity guidance.
              </p>
            </div>

            {/* Step 4 */}
            <div className="relative p-6 bg-white rounded-2xl border border-[#D8E1E5] shadow-xs flex flex-col">
              <div className="size-10 rounded-xl bg-[#20A66A] text-white font-heading font-extrabold text-base flex items-center justify-center mb-4">
                4
              </div>
              <h3 className="font-heading font-bold text-base text-[#12304A]">
                Place your order
              </h3>
              <p className="text-xs text-[#647782] mt-2 leading-relaxed">
                Review your GST bill total and confirm dispatch directly to your store.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* 5. BENEFITS GRID */}
      <section id="benefits" className="py-20 bg-white border-y border-[#D8E1E5]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <h2 className="font-heading text-2xl sm:text-3xl font-extrabold text-[#12304A]">
              Built for shop owners
            </h2>
            <p className="text-sm sm:text-base text-[#647782] mt-2">
              Get direct wholesale advantages and complete control over your regular shop stock purchasing.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            
            {/* 1. Wholesale and bulk prices */}
            <div className="p-5 rounded-2xl border border-[#D8E1E5] bg-[#F4F7F8] hover:border-[#20A66A] transition-all">
              <div className="size-11 rounded-xl bg-[#E9F7F0] text-[#20A66A] flex items-center justify-center mb-3">
                <Tag className="size-5" />
              </div>
              <h3 className="font-heading font-bold text-sm text-[#12304A]">Wholesale and bulk prices</h3>
              <p className="text-xs text-[#647782] mt-1.5 leading-normal">
                Locked-in B2B margins and tiered volume discounts on every product.
              </p>
            </div>

            {/* 2. Minimum order shown clearly */}
            <div className="p-5 rounded-2xl border border-[#D8E1E5] bg-[#F4F7F8] hover:border-[#20A66A] transition-all">
              <div className="size-11 rounded-xl bg-[#EAF8FE] text-[#38BDF8] flex items-center justify-center mb-3">
                <Package className="size-5" />
              </div>
              <h3 className="font-heading font-bold text-sm text-[#12304A]">Minimum order shown clearly</h3>
              <p className="text-xs text-[#647782] mt-1.5 leading-normal">
                Never guess case sizes or order limits with visible MOQ tags.
              </p>
            </div>

            {/* 3. GST bills */}
            <div className="p-5 rounded-2xl border border-[#D8E1E5] bg-[#F4F7F8] hover:border-[#20A66A] transition-all">
              <div className="size-11 rounded-xl bg-[#EAF0F2] text-[#12304A] flex items-center justify-center mb-3">
                <FileText className="size-5" />
              </div>
              <h3 className="font-heading font-bold text-sm text-[#12304A]">GST bills with every purchase</h3>
              <p className="text-xs text-[#647782] mt-1.5 leading-normal">
                Proper tax invoices generated instantly for easy input tax credit claims.
              </p>
            </div>

            {/* 4. Order tracking */}
            <div className="p-5 rounded-2xl border border-[#D8E1E5] bg-[#F4F7F8] hover:border-[#20A66A] transition-all">
              <div className="size-11 rounded-xl bg-[#E9F7F0] text-[#20A66A] flex items-center justify-center mb-3">
                <Truck className="size-5" />
              </div>
              <h3 className="font-heading font-bold text-sm text-[#12304A]">Live order tracking</h3>
              <p className="text-xs text-[#647782] mt-1.5 leading-normal">
                Know the exact status from packaging to arrival at your shop door.
              </p>
            </div>

            {/* 5. Credit from your wholesaler */}
            <div className="p-5 rounded-2xl border border-[#D8E1E5] bg-[#F4F7F8] hover:border-[#20A66A] transition-all">
              <div className="size-11 rounded-xl bg-[#EAF8FE] text-[#38BDF8] flex items-center justify-center mb-3">
                <CreditCard className="size-5" />
              </div>
              <h3 className="font-heading font-bold text-sm text-[#12304A]">Credit from your wholesaler</h3>
              <p className="text-xs text-[#647782] mt-1.5 leading-normal">
                Use your pre-approved supplier credit line and pay on due dates.
              </p>
            </div>

            {/* 6. Coupons and offers */}
            <div className="p-5 rounded-2xl border border-[#D8E1E5] bg-[#F4F7F8] hover:border-[#20A66A] transition-all">
              <div className="size-11 rounded-xl bg-[#E9F7F0] text-[#20A66A] flex items-center justify-center mb-3">
                <Sparkles className="size-5" />
              </div>
              <h3 className="font-heading font-bold text-sm text-[#12304A]">Coupons and offers</h3>
              <p className="text-xs text-[#647782] mt-1.5 leading-normal">
                Apply exclusive supplier coupon codes at checkout to save extra money.
              </p>
            </div>

            {/* 7. Easy returns */}
            <div className="p-5 rounded-2xl border border-[#D8E1E5] bg-[#F4F7F8] hover:border-[#20A66A] transition-all">
              <div className="size-11 rounded-xl bg-[#EAF0F2] text-[#12304A] flex items-center justify-center mb-3">
                <RotateCcw className="size-5" />
              </div>
              <h3 className="font-heading font-bold text-sm text-[#12304A]">Easy returns</h3>
              <p className="text-xs text-[#647782] mt-1.5 leading-normal">
                Hassle-free online return requests for broken or expired inventory.
              </p>
            </div>

            {/* 8. Wishlist */}
            <div className="p-5 rounded-2xl border border-[#D8E1E5] bg-[#F4F7F8] hover:border-[#20A66A] transition-all">
              <div className="size-11 rounded-xl bg-[#E9F7F0] text-[#20A66A] flex items-center justify-center mb-3">
                <Heart className="size-5" />
              </div>
              <h3 className="font-heading font-bold text-sm text-[#12304A]">Save to wishlist</h3>
              <p className="text-xs text-[#647782] mt-1.5 leading-normal">
                Bookmark top-selling items to reorder in seconds whenever stock is low.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* 6. "BEFORE AND AFTER" STRIP */}
      <section className="py-20 bg-[#F4F7F8]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <h2 className="font-heading text-2xl sm:text-3xl font-extrabold text-[#12304A]">
              Old way vs new way
            </h2>
            <p className="text-sm sm:text-base text-[#647782] mt-2">
              Replace endless phone calls and paper notebooks with clear digital wholesale ordering.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* The Old Way */}
            <div className="p-6 sm:p-8 bg-white rounded-3xl border border-[#D8E1E5] shadow-xs flex flex-col">
              <div className="flex items-center gap-3 mb-6">
                <div className="size-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center font-bold">
                  <PhoneCall className="size-5" />
                </div>
                <div>
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-red-600">The Old Way</span>
                  <h3 className="font-heading font-bold text-lg text-[#12304A]">Calling and writing paper orders</h3>
                </div>
              </div>

              <ul className="flex flex-col gap-3.5 text-xs text-[#647782]">
                <li className="flex items-start gap-2.5">
                  <span className="text-red-500 font-bold shrink-0">✕</span>
                  <span>Calling supplier repeatedly to ask if stock is available</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-red-500 font-bold shrink-0">✕</span>
                  <span>Writing item lists by hand in paper notebooks with errors</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-red-500 font-bold shrink-0">✕</span>
                  <span>Unclear rate confirmation until delivery truck arrives</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-red-500 font-bold shrink-0">✕</span>
                  <span>Waiting days for paper bills and losing track of credit dues</span>
                </li>
              </ul>
            </div>

            {/* The New Way */}
            <div className="p-6 sm:p-8 bg-white rounded-3xl border-2 border-[#20A66A] shadow-md flex flex-col relative">
              <div className="absolute top-4 right-4">
                <span className="px-2.5 py-1 bg-[#E9F7F0] text-[#20A66A] text-[11px] font-extrabold rounded-full">
                  Recommended
                </span>
              </div>
              <div className="flex items-center gap-3 mb-6">
                <div className="size-10 rounded-xl bg-[#E9F7F0] text-[#20A66A] flex items-center justify-center font-bold">
                  <Laptop className="size-5" />
                </div>
                <div>
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#20A66A]">TradeFlow Way</span>
                  <h3 className="font-heading font-bold text-lg text-[#12304A]">Instant online wholesale ordering</h3>
                </div>
              </div>

              <ul className="flex flex-col gap-3.5 text-xs text-[#12304A]">
                <li className="flex items-start gap-2.5">
                  <CheckCircle className="size-4 text-[#20A66A] shrink-0 mt-0.5" />
                  <span>See full live catalog and real-time stock 24/7 on your phone</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle className="size-4 text-[#20A66A] shrink-0 mt-0.5" />
                  <span>Transparent bulk prices with discounts calculated instantly</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle className="size-4 text-[#20A66A] shrink-0 mt-0.5" />
                  <span>Accurate digital GST bills generated immediately upon checkout</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle className="size-4 text-[#20A66A] shrink-0 mt-0.5" />
                  <span>Track delivery progress and reorder past baskets in one tap</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* 7. FAQ SECTION */}
      <section id="faq" className="py-20 bg-white border-t border-[#D8E1E5]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="font-heading text-2xl sm:text-3xl font-extrabold text-[#12304A]">
              Frequently asked questions
            </h2>
            <p className="text-sm sm:text-base text-[#647782] mt-2">
              Quick answers to common questions about joining and buying on our wholesale platform.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            {[
              {
                q: "How do I join?",
                a: "Ask your current wholesaler for their invite link or 6-character referral code.",
              },
              {
                q: "What is a referral code?",
                a: "It connects your shop directly to your wholesaler's private catalog and prices.",
              },
              {
                q: "Is it free?",
                a: "Yes, creating an account and ordering on the platform is completely free.",
              },
              {
                q: "How do I pay?",
                a: "Pay by UPI, bank transfer, cash on delivery, or approved wholesaler credit.",
              },
              {
                q: "Can I return items?",
                a: "Yes, submit return requests online with photos for damaged or incorrect goods.",
              },
            ].map((faq, index) => {
              const isOpen = openFaq === index;
              return (
                <div
                  key={faq.q}
                  className="rounded-2xl border border-[#D8E1E5] bg-[#F4F7F8] overflow-hidden transition-all"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : index)}
                    className="w-full p-4 sm:p-5 text-left flex items-center justify-between gap-4 font-heading font-bold text-sm sm:text-base text-[#12304A] cursor-pointer"
                  >
                    <span>{faq.q}</span>
                    <ChevronDown className={`size-5 text-[#647782] transition-transform duration-200 ${isOpen ? "rotate-180 text-[#20A66A]" : ""}`} />
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-4 sm:px-5 sm:pb-5 text-xs sm:text-sm text-[#647782] leading-relaxed border-t border-[#D8E1E5]/60 pt-3">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 8. FINAL CALL TO ACTION BANNER */}
      <section className="py-16 bg-linear-to-r from-[#12304A] to-[#1B4261] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center flex flex-col items-center">
          <h2 className="font-heading text-3xl sm:text-4xl font-extrabold tracking-tight">
            Ready to order online?
          </h2>
          <p className="text-base sm:text-lg text-[#D5F1FD] mt-2 max-w-xl">
            Connect with your wholesaler today and start placing orders in under two minutes.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            {isLoggedIn ? (
              <button
                type="button"
                onClick={() => navigate({ to: "/" })}
                className="px-8 py-3.5 bg-[#20A66A] hover:bg-[#198957] text-white text-base font-bold rounded-xl shadow-lg transition-all flex items-center gap-2 cursor-pointer"
              >
                <span>Go to Store</span>
                <ArrowRight className="size-5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => openModal("register")}
                className="px-8 py-3.5 bg-[#20A66A] hover:bg-[#198957] text-white text-base font-bold rounded-xl shadow-lg transition-all flex items-center gap-2 cursor-pointer"
              >
                <span>Register Free</span>
                <ArrowRight className="size-5" />
              </button>
            )}
          </div>
        </div>
      </section>

      {/* 9. FOOTER */}
      <footer className="bg-white border-t border-[#D8E1E5] py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <TradeFlowMark className="size-8 rounded-lg" />
            <div className="flex flex-col">
              <span className="font-heading font-black text-base text-[#12304A] leading-none">
                Trade<span className="text-[#20A66A]">Flow</span>
              </span>
              <span className="text-[9px] font-bold text-[#647782] mt-0.5">
                Simple digital tools connecting shop owners directly to verified wholesale suppliers.
              </span>
            </div>
          </div>

          <div className="flex items-center gap-6 text-xs font-semibold text-[#647782]">
            <Link to="/support" className="hover:text-[#12304A] transition-colors">
              Help &amp; Support
            </Link>
            <span>•</span>
            <span>© {new Date().getFullYear()} TradeFlow</span>
          </div>
        </div>
      </footer>

      {/* 3. AUTO POPUP MODAL (Focus-Trapped & Accessible) */}
      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div
            ref={modalRef}
            className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-[#D8E1E5] overflow-hidden p-6 sm:p-8 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto"
          >
            {/* Close Button */}
            <button
              type="button"
              onClick={closeModal}
              className="absolute top-5 right-5 p-1.5 text-[#647782] hover:text-[#12304A] hover:bg-[#EAF0F2] rounded-full transition-colors cursor-pointer"
              aria-label="Close modal"
            >
              <X className="size-5" />
            </button>

            {/* MODAL VIEW 1: WELCOME & SUPPLIER CARD */}
            {modalMode === "welcome" && supplier && (
              <div className="flex flex-col gap-6">
                <div>
                  <span className="px-2.5 py-1 bg-[#E9F7F0] text-[#20A66A] text-[11px] font-extrabold rounded-full">
                    Exclusive Wholesaler Invitation
                  </span>
                  <h2 id="modal-title" className="font-heading text-2xl font-extrabold text-[#12304A] mt-2">
                    Welcome! Order from {supplier.businessName}
                  </h2>
                  <p className="text-xs text-[#647782] mt-1">
                    Connect directly to their wholesale catalog and trade pricing.
                  </p>
                </div>

                {/* Safe Supplier Card */}
                <div className="p-4 bg-[#F4F7F8] rounded-2xl border border-[#D8E1E5] flex items-center gap-3.5">
                  {supplier.logo ? (
                    <img
                      src={supplier.logo}
                      alt={supplier.businessName}
                      className="size-14 rounded-xl object-contain border border-[#D8E1E5] p-1 bg-white shrink-0"
                    />
                  ) : (
                    <div className="size-14 rounded-xl bg-[#E9F7F0] text-[#20A66A] font-heading font-black text-xl flex items-center justify-center shrink-0">
                      {supplier.businessName.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-heading font-bold text-base text-[#12304A] truncate">{supplier.businessName}</span>
                      <ShieldCheck className="size-4 text-[#20A66A] shrink-0" />
                    </div>
                    <div className="text-xs text-[#647782] mt-0.5">
                      Verified Wholesaler {supplier.city ? `• ${supplier.city}` : ""}
                    </div>
                    {supplier.categories && supplier.categories.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {supplier.categories.slice(0, 3).map((c) => (
                          <span key={c} className="text-[10px] bg-white border border-[#D8E1E5] px-1.5 py-0.5 rounded-sm font-semibold text-[#344B58]">
                            {c}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => openModal("register")}
                    className="w-full py-3.5 bg-[#20A66A] hover:bg-[#198957] text-white text-sm font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Register Free</span>
                    <ArrowRight className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalMode("login")}
                    className="w-full py-2.5 bg-[#EAF0F2] hover:bg-[#D8E1E5] text-[#12304A] text-sm font-bold rounded-xl transition-all cursor-pointer"
                  >
                    Already have an account? Login
                  </button>
                </div>
              </div>
            )}


            {/* MODAL VIEW 3: REGISTER TAB */}
            {modalMode === "register" && supplier && (
              <div className="flex flex-col gap-5">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-extrabold uppercase text-[#20A66A]">Step 2 of 2</span>
                    <button
                      type="button"
                      onClick={() => setModalMode("welcome")}
                      className="text-xs text-[#647782] hover:text-[#12304A] font-bold cursor-pointer"
                    >
                      ← Back
                    </button>
                  </div>
                  <h2 id="modal-title" className="font-heading text-xl font-extrabold text-[#12304A] mt-1">
                    Create your Retailer account
                  </h2>
                  <p className="text-xs text-[#647782]">
                    Connecting directly to <strong className="text-[#12304A]">{supplier.businessName}</strong>
                  </p>
                </div>

                <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                  {supplier.logo ? (
                    <img src={supplier.logo} alt="" className="size-12 rounded-lg object-cover" />
                  ) : (
                    <div className="flex size-12 items-center justify-center rounded-lg bg-white text-[#20A66A]">
                      <Building2 className="size-6" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-[#647782]">You are joining:</p>
                    <p className="truncate font-bold text-[#12304A]">{supplier.businessName}{supplier.city ? `, ${supplier.city}` : ""}</p>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white px-2 py-1 text-[10px] font-bold text-[#198957]">
                    <ShieldCheck className="size-3.5" />
                    Verified
                  </span>
                </div>
                <button
                  type="button"
                  onClick={clearReferral}
                  className="self-start text-xs font-semibold text-[#647782] underline underline-offset-2 hover:text-[#12304A]"
                >
                  Not your wholesaler?
                </button>

                <form onSubmit={handleRegisterSubmit} className="flex flex-col gap-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-[#12304A] mb-1">
                        Owner Full Name *
                      </label>
                      <input
                        type="text"
                        value={regName}
                        onChange={(e) => setRegName(e.target.value)}
                        placeholder="e.g. Ramesh Kumar"
                        className="w-full px-3 py-2 bg-[#F4F7F8] border border-[#D8E1E5] rounded-lg text-xs text-[#12304A] focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#20A66A]"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-[#12304A] mb-1">
                        Retailer Login ID *
                      </label>
                      <input
                        type="text"
                        value={regLoginId}
                        onChange={(e) => setRegLoginId(e.target.value.toUpperCase())}
                        placeholder="e.g. RAMESH01"
                        className="w-full px-3 py-2 bg-[#F4F7F8] border border-[#D8E1E5] rounded-lg text-xs uppercase font-mono text-[#12304A] focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#20A66A]"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[#12304A] mb-1">
                      Shop / Business Name *
                    </label>
                    <input
                      type="text"
                      value={regBusinessName}
                      onChange={(e) => setRegBusinessName(e.target.value)}
                      placeholder="e.g. Ramesh Kirana Store"
                      className="w-full px-3 py-2 bg-[#F4F7F8] border border-[#D8E1E5] rounded-lg text-xs text-[#12304A] focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#20A66A]"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-[#12304A] mb-1">
                        Mobile Number (10 Digits) *
                      </label>
                      <input
                        type="tel"
                        maxLength={10}
                        value={regPhone}
                        onChange={(e) => setRegPhone(e.target.value.replace(/\D/g, ""))}
                        placeholder="9876543210"
                        className="w-full px-3 py-2 bg-[#F4F7F8] border border-[#D8E1E5] rounded-lg text-xs text-[#12304A] focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#20A66A]"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-[#12304A] mb-1">
                        Email Address *
                      </label>
                      <input
                        type="email"
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        placeholder="shop@example.com"
                        className="w-full px-3 py-2 bg-[#F4F7F8] border border-[#D8E1E5] rounded-lg text-xs text-[#12304A] focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#20A66A]"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[#12304A] mb-1">
                      Password (min 6 characters) *
                    </label>
                    <input
                      type="password"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-3 py-2 bg-[#F4F7F8] border border-[#D8E1E5] rounded-lg text-xs text-[#12304A] focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#20A66A]"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmittingReg}
                    className="w-full mt-2 py-3 bg-[#20A66A] hover:bg-[#198957] disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer"
                  >
                    {isSubmittingReg ? "Creating account..." : "Register Free & Open Store"}
                  </button>
                </form>

                <div className="text-center pt-2 border-t border-[#D8E1E5]">
                  <button
                    type="button"
                    onClick={() => setModalMode("login")}
                    className="text-xs font-bold text-[#20A66A] hover:underline cursor-pointer"
                  >
                    Already have an account? Login
                  </button>
                </div>
              </div>
            )}

            {/* MODAL VIEW 4: LOGIN TAB */}
            {modalMode === "login" && (
              <div className="flex flex-col gap-5">
                <div>
                  <h2 id="modal-title" className="font-heading text-xl font-extrabold text-[#12304A]">
                    Sign in to Retailer Portal
                  </h2>
                  <p className="text-xs text-[#647782] mt-1">
                    Enter your email or Retailer Login ID and password.
                  </p>
                </div>

                <form onSubmit={handleLoginSubmit} className="flex flex-col gap-3.5">
                  <div>
                    <label className="block text-[11px] font-bold text-[#12304A] mb-1">
                      Email or Retailer Login ID *
                    </label>
                    <input
                      type="text"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      placeholder="e.g. RAMESH01 or shop@gmail.com"
                      className="w-full px-3 py-2.5 bg-[#F4F7F8] border border-[#D8E1E5] rounded-lg text-xs text-[#12304A] focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#20A66A]"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[#12304A] mb-1">
                      Password *
                    </label>
                    <input
                      type="password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-3 py-2.5 bg-[#F4F7F8] border border-[#D8E1E5] rounded-lg text-xs text-[#12304A] focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#20A66A]"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmittingLogin}
                    className="w-full mt-2 py-3 bg-[#12304A] hover:bg-[#1B4261] disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer"
                  >
                    {isSubmittingLogin ? "Signing in..." : "Login to Portal"}
                  </button>
                </form>

                <div className="text-center pt-2 border-t border-[#D8E1E5] flex flex-col gap-1.5">
                  <button
                    type="button"
                    onClick={() => openModal("register")}
                    className="text-xs font-bold text-[#20A66A] hover:underline cursor-pointer"
                  >
                    New shop? Register Free
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
}

export default LandingPage;
