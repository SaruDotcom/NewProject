'use client';

import React, { useState, useEffect } from 'react';
import {
  Sliders,
  Plus,
  Sparkles,
  CheckCircle2,
  Trash2,
  Edit3,
  Eye,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  Layers,
  Check,
  Tag,
  Building2,
  LoaderCircle,
  RefreshCw,
  Power,
  Store,
} from 'lucide-react';
import { useWholesaler } from '@/context/WholesalerContext';
import api, { type WholesalerStoreTheme } from '@/lib/api';

export interface BannerSlide {
  id: string;
  title: string;
  subtitle: string;
  badgeText: string;
  buttonText: string;
  imageUrl: string;
  targetCategory: string;
  discountBadge: string;
  gradient: string;
  isActive: boolean;
  businessType?: string;
  targetRetailers?: 'ALL' | string;
  createdAt?: string;
}

const BUSINESS_CATEGORIES: Array<{ id: string; label: string; icon: string; description: string }> = [
  { id: 'CLOTHING', label: 'Clothing & Apparel', icon: '👗', description: 'Western wear, Indian ethnic wear, kurtis, lehengas & fashion offers.' },
  { id: 'COSMETICS', label: 'Beauty & Cosmetics', icon: '💄', description: 'Beauty products, skincare, salon supplies & makeup offers.' },
  { id: 'GENERAL_STORE', label: 'Kirana & General Store', icon: '🛒', description: 'Grocery staples, daily essentials, snacks & FMCG offers.' },
  { id: 'FOOTWEAR', label: 'Footwear', icon: '👟', description: 'Casual shoes, formal footwear, ethnic juttis & family sandals.' },
  { id: 'ELECTRONICS', label: 'Electronics', icon: '⚡', description: 'Smart gadgets, cables, audio, chargers & small appliances.' },
  { id: 'OTHER', label: 'General Merchandise', icon: '📦', description: 'Commercial trade products & general wholesale offers.' },
];

const GRADIENT_OPTIONS = [
  { label: 'Navy & Green', value: 'from-tradeflow-navy via-tradeflow-green to-tradeflow-navy' },
  { label: 'Growth Green', value: 'from-tradeflow-navy via-green-700 to-tradeflow-green' },
  { label: 'Sky & Navy', value: 'from-tradeflow-navy via-tradeflow-sky to-tradeflow-navy' },
  { label: 'Amber & Navy', value: 'from-tradeflow-navy via-amber-700 to-tradeflow-navy' },
];

const getTradeflowGradient = (gradient: string) =>
  gradient?.includes('tradeflow-')
    ? gradient
    : 'from-tradeflow-navy via-tradeflow-green to-tradeflow-navy';

export default function BannerSlidesPage() {
  const { categories, profile } = useWholesaler();
  const [slides, setSlides] = useState<BannerSlide[]>([]);
  const [presetOptions, setPresetOptions] = useState<BannerSlide[]>([]);
  const [businessCategory, setBusinessCategory] = useState<string>('CLOTHING');
  const [activeTheme, setActiveTheme] = useState<WholesalerStoreTheme>('DEFAULT');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [activePreviewIndex, setActivePreviewIndex] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [editingSlide, setEditingSlide] = useState<BannerSlide | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');

  const [form, setForm] = useState({
    title: '',
    subtitle: '',
    badgeText: 'WHOLESALE DEAL',
    buttonText: 'Shop Trade Deals',
    imageUrl: '',
    targetCategory: 'All',
    discountBadge: '',
    gradient: GRADIENT_OPTIONS[0].value,
    targetRetailers: 'ALL',
  });

  useEffect(() => {
    if (!imageFile) {
      setImagePreview('');
      return;
    }

    const previewUrl = URL.createObjectURL(imageFile);
    setImagePreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [imageFile]);

  const loadBanners = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.getBanners();
      if (response?.data) {
        setSlides(response.data.banners || []);
        setPresetOptions(response.data.presetOptions || []);
        setBusinessCategory(response.data.businessCategory || 'CLOTHING');
        setActiveTheme(response.data.activeStoreTheme || profile.activeStoreTheme || 'DEFAULT');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load banner slides from server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadBanners();
  }, []);

  const activeSlides = slides.filter((s) => s.isActive);

  // Auto-play preview carousel
  useEffect(() => {
    if (activeSlides.length <= 1) return;
    const timer = setInterval(() => {
      setActivePreviewIndex((prev) => (prev + 1) % activeSlides.length);
    }, 4500);
    return () => clearInterval(timer);
  }, [activeSlides.length]);

  const handleCategoryChange = async (newCategory: string) => {
    if (newCategory === businessCategory || saving) return;
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const response = await api.updateBusinessCategory(newCategory);
      if (response?.data) {
        setSlides(response.data.banners || []);
        setPresetOptions(response.data.presetOptions || []);
        setBusinessCategory(response.data.businessCategory || newCategory);
        setMessage(`Updated business category to ${BUSINESS_CATEGORIES.find((c) => c.id === newCategory)?.label || newCategory}.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update business category.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (id: string) => {
    const updated = slides.map((s) => (s.id === id ? { ...s, isActive: !s.isActive } : s));
    setSlides(updated);
    setSaving(true);
    setMessage('');
    setError('');
    try {
      await api.updateBanners(updated, businessCategory);
      const isNowActive = updated.find((s) => s.id === id)?.isActive;
      setMessage(isNowActive ? 'Offer activated for your retailer storefront.' : 'Offer deactivated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update banner status.');
      // Revert on error
      setSlides(slides);
    } finally {
      setSaving(false);
    }
  };

  const handleActivatePreset = async (preset: BannerSlide) => {
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const response = await api.activatePreset(preset.id);
      if (response?.data) {
        setSlides(response.data.banners || []);
        setMessage(`Activated "${preset.title}" for your retailer storefront.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to activate preset offer.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSlide = async (id: string) => {
    const updated = slides.filter((s) => s.id !== id);
    setSlides(updated);
    setSaving(true);
    setMessage('');
    setError('');
    try {
      await api.updateBanners(updated, businessCategory);
      setMessage('Banner slide removed.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete banner slide.');
      setSlides(slides);
    } finally {
      setSaving(false);
    }
  };

  const handleOpenCreateModal = () => {
    setEditingSlide(null);
    setImageFile(null);
    setForm({
      title: '',
      subtitle: '',
      badgeText: 'WHOLESALE EXCLUSIVE',
      buttonText: 'Shop Trade Deals',
      imageUrl: presetOptions[0]?.imageUrl || 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=1200&q=80',
      targetCategory: categories[0]?.name || 'All',
      discountBadge: 'TRADE MARGIN',
      gradient: GRADIENT_OPTIONS[0].value,
      targetRetailers: 'ALL',
    });
    setShowModal(true);
  };

  const handleOpenEditModal = (slide: BannerSlide) => {
    setEditingSlide(slide);
    setImageFile(null);
    setForm({
      title: slide.title,
      subtitle: slide.subtitle || '',
      badgeText: slide.badgeText || '',
      buttonText: slide.buttonText || 'Shop Trade Deals',
      imageUrl: slide.imageUrl || '',
      targetCategory: slide.targetCategory || 'All',
      discountBadge: slide.discountBadge || '',
      gradient: slide.gradient || GRADIENT_OPTIONS[0].value,
      targetRetailers: slide.targetRetailers || 'ALL',
    });
    setShowModal(true);
  };

  const handleImageSelection = (file?: File) => {
    if (!file) return;
    const acceptedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!acceptedTypes.includes(file.type)) {
      setError('Choose a JPG, PNG, or WebP image.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be 5 MB or smaller.');
      return;
    }

    setError('');
    setImageFile(file);
    setForm((previous) => ({ ...previous, imageUrl: '' }));
  };

  const handleSaveSlide = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;

    setSaving(true);
    setMessage('');
    setError('');

    try {
      let imageUrl = form.imageUrl.trim();
      if (imageFile) {
        const uploadResponse = await api.uploadProductImages([imageFile]);
        const uploadedImage = uploadResponse?.data?.[0];
        imageUrl = typeof uploadedImage === 'string' ? uploadedImage : uploadedImage?.url || '';
        if (!imageUrl) throw new Error('Image upload completed without returning an image URL.');
      }

      const updatedSlides = editingSlide
        ? slides.map((slide) =>
            slide.id === editingSlide.id
              ? {
                  ...slide,
                  title: form.title.trim(),
                  subtitle: form.subtitle.trim(),
                  badgeText: form.badgeText.trim(),
                  buttonText: form.buttonText.trim(),
                  imageUrl,
                  targetCategory: form.targetCategory,
                  discountBadge: form.discountBadge.trim(),
                  gradient: form.gradient,
                  targetRetailers: form.targetRetailers,
                }
              : slide,
          )
        : [
            {
              id: `slide-${Date.now()}`,
              title: form.title.trim(),
              subtitle: form.subtitle.trim(),
              badgeText: form.badgeText.trim(),
              buttonText: form.buttonText.trim(),
              imageUrl,
              targetCategory: form.targetCategory,
              discountBadge: form.discountBadge.trim(),
              gradient: form.gradient,
              isActive: true,
              businessType: businessCategory,
              targetRetailers: form.targetRetailers,
              createdAt: new Date().toISOString(),
            },
            ...slides,
          ];

      const response = await api.updateBanners(updatedSlides, businessCategory);
      if (response?.data) {
        setSlides(response.data.banners || []);
        setMessage('Banner slides saved successfully.');
        setShowModal(false);
        setImageFile(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save banner slide.');
    } finally {
      setSaving(false);
    }
  };

  const currentPreview = activeSlides[activePreviewIndex] || activeSlides[0] || slides[0];
  const currentCategoryInfo = BUSINESS_CATEGORIES.find((c) => c.id === businessCategory) || BUSINESS_CATEGORIES[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-tradeflow-navy">Retailer Promotional Banners & Offers</h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-tradeflow-green-50 text-tradeflow-green border border-tradeflow-green/30">
              Synced to Retailer Homepage
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Activate and customize promotional banners displayed on your connected retailers' storefront homepages.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => void loadBanners()}
            disabled={loading}
            className="px-3 py-2 bg-white border border-tradeflow-gray-200 text-tradeflow-navy font-bold text-xs rounded-xl hover:bg-gray-50 transition-all shadow-xs flex items-center gap-1.5"
            title="Refresh banner settings"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            onClick={handleOpenCreateModal}
            className="px-4 py-2 bg-tradeflow-green text-tradeflow-navy font-bold text-xs rounded-xl hover:bg-tradeflow-green-hover transition-all shadow-md flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Add Custom Banner
          </button>
        </div>
      </header>

      {/* Status Messages */}
      {message && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{message}</span>
        </div>
      )}
      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold rounded-xl flex items-center gap-2">
          <span>{error}</span>
        </div>
      )}

      {/* 1. BUSINESS CATEGORY SELECTOR */}
      <section className="bg-white rounded-2xl p-5 border border-tradeflow-gray-200 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-3">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-tradeflow-green">
              Wholesaler Business Type
            </span>
            <h2 className="text-sm font-bold text-tradeflow-navy flex items-center gap-2">
              <Building2 className="w-4 h-4 text-tradeflow-navy" />
              <span>Category: {currentCategoryInfo.label}</span>
              <span className="text-base">{currentCategoryInfo.icon}</span>
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">{currentCategoryInfo.description}</p>
          </div>
          <span className="text-[11px] text-gray-400 font-medium self-start sm:self-auto">
            Banners are matched to your catalog & business type
          </span>
        </div>

        {/* Business Category Pills */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 pt-1">
          {BUSINESS_CATEGORIES.map((cat) => {
            const isSelected = businessCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => handleCategoryChange(cat.id)}
                disabled={saving}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  isSelected
                    ? 'border-tradeflow-green bg-tradeflow-green-50 ring-2 ring-tradeflow-green/20'
                    : 'border-tradeflow-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className="text-lg">{cat.icon}</div>
                <div className={`mt-1 text-xs font-bold ${isSelected ? 'text-tradeflow-navy' : 'text-gray-700'}`}>
                  {cat.label}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* 2. TAILORED BANNER OPTIONS FOR THIS BUSINESS TYPE */}
      <section className="bg-white rounded-2xl p-5 border border-tradeflow-gray-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-tradeflow-navy flex items-center gap-2">
              <Tag className="w-4 h-4 text-tradeflow-green" />
              <span>Recommended Offer Options for {currentCategoryInfo.label}</span>
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Select and activate the promotions you want to showcase on your retailers' homepage.
            </p>
          </div>
          <span className="text-xs font-bold text-tradeflow-navy bg-tradeflow-gray-50 px-2.5 py-1 rounded-lg border">
            {presetOptions.length} Options
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {presetOptions.map((preset) => {
            const matchingSlide = slides.find((s) => s.id === preset.id);
            const isCurrentlyActive = matchingSlide?.isActive ?? preset.isActive;
            const currentTitle = matchingSlide?.title || preset.title;
            const currentSubtitle = matchingSlide?.subtitle || preset.subtitle;
            const currentBadge = matchingSlide?.discountBadge || preset.discountBadge;

            return (
              <div
                key={preset.id}
                className={`rounded-xl border transition-all flex flex-col justify-between overflow-hidden ${
                  isCurrentlyActive
                    ? 'border-tradeflow-green bg-white shadow-xs ring-1 ring-tradeflow-green/30'
                    : 'border-tradeflow-gray-200 bg-gray-50/50'
                }`}
              >
                {/* Thumbnail Header */}
                <div className="relative h-28 overflow-hidden bg-gray-200">
                  <img src={preset.imageUrl} alt="" className="w-full h-full object-cover" />
                  <div className={`absolute inset-0 bg-gradient-to-t ${getTradeflowGradient(preset.gradient)} opacity-80`} />
                  <div className="absolute top-2 left-2 right-2 flex items-center justify-between z-10">
                    <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-black/40 text-white backdrop-blur-xs">
                      {preset.badgeText}
                    </span>
                    {currentBadge && (
                      <span className="px-2 py-0.5 rounded text-[9px] font-black bg-amber-400 text-tradeflow-navy shadow-xs">
                        {currentBadge}
                      </span>
                    )}
                  </div>
                  <div className="absolute bottom-2 left-2 right-2 z-10">
                    <h4 className="font-bold text-white text-xs line-clamp-1 drop-shadow-xs">{currentTitle}</h4>
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-3 space-y-2 flex-1 flex flex-col justify-between text-xs">
                  <p className="text-gray-600 text-[11px] line-clamp-2 leading-relaxed">{currentSubtitle}</p>

                  <div className="pt-2 border-t border-gray-100 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (matchingSlide) {
                          void handleToggleActive(matchingSlide.id);
                        } else {
                          void handleActivatePreset(preset);
                        }
                      }}
                      disabled={saving}
                      className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                        isCurrentlyActive
                          ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                          : 'bg-tradeflow-gray-100 text-tradeflow-navy hover:bg-tradeflow-gray-200'
                      }`}
                    >
                      <Power className="w-3.5 h-3.5" />
                      <span>{isCurrentlyActive ? 'Active on Storefront' : 'Activate Offer'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(matchingSlide || preset)}
                      className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-100 text-gray-600"
                      title="Customize Offer Details"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 3. LIVE STOREFRONT INTERACTIVE PREVIEW SLIDER */}
      <section className="bg-white rounded-2xl p-5 border border-tradeflow-gray-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Eye className="w-5 h-5 text-tradeflow-navy" />
            <h2 className="text-sm font-bold text-tradeflow-navy">Retailer Homepage Live Preview</h2>
            <span className="text-[11px] font-semibold text-gray-500">
              (Theme: <strong>{activeTheme}</strong>)
            </span>
          </div>
          <span className="text-xs text-gray-500 font-semibold">
            {activeSlides.length} Active Offer{activeSlides.length === 1 ? '' : 's'} Visible to Retailers
          </span>
        </div>

        {currentPreview && activeSlides.length > 0 ? (
          <div className="relative rounded-2xl overflow-hidden min-h-[280px] sm:min-h-[340px] shadow-lg border border-gray-200 flex flex-col justify-between p-6 sm:p-10 text-white">
            <img src={currentPreview.imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
            <div className={`absolute inset-0 bg-gradient-to-r ${getTradeflowGradient(currentPreview.gradient)} opacity-90`} />

            {/* Top Badges */}
            <div className="relative z-10 flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-white/20 backdrop-blur-md border border-white/20">
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                {currentPreview.badgeText || 'WHOLESALE OFFER'}
              </span>

              {currentPreview.discountBadge && (
                <span className="px-3 py-1 rounded-full text-xs font-black bg-amber-400 text-tradeflow-navy shadow-md">
                  {currentPreview.discountBadge}
                </span>
              )}
            </div>

            {/* Main Content */}
            <div className="relative z-10 max-w-xl space-y-2 my-auto py-4">
              <h3 className="text-2xl sm:text-4xl font-black tracking-tight leading-tight drop-shadow-md">
                {currentPreview.title}
              </h3>
              <p className="text-xs sm:text-sm text-gray-200 line-clamp-2 leading-relaxed">
                {currentPreview.subtitle}
              </p>

              <div className="pt-3 flex items-center gap-3">
                <div className="px-5 py-2.5 bg-white text-tradeflow-navy font-extrabold text-xs rounded-xl shadow-lg flex items-center gap-2">
                  <span>{currentPreview.buttonText || 'Shop Trade Deals'}</span>
                  <ArrowRight className="w-4 h-4" />
                </div>
                <span className="text-[11px] text-gray-300 font-medium">
                  Category: <strong className="text-white">{currentPreview.targetCategory || 'All'}</strong>
                </span>
              </div>
            </div>

            {/* Slider Dots & Arrows */}
            <div className="relative z-10 flex items-center justify-between pt-2 border-t border-white/20">
              <div className="flex items-center gap-2">
                {activeSlides.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActivePreviewIndex(idx)}
                    className={`h-2 rounded-full transition-all ${
                      idx === activePreviewIndex ? 'w-8 bg-amber-400' : 'w-2 bg-white/40'
                    }`}
                  />
                ))}
              </div>

              {activeSlides.length > 1 && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      setActivePreviewIndex((prev) => (prev - 1 + activeSlides.length) % activeSlides.length)
                    }
                    className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 backdrop-blur-xs transition-all"
                  >
                    <ChevronLeft className="w-4 h-4 text-white" />
                  </button>
                  <button
                    onClick={() => setActivePreviewIndex((prev) => (prev + 1) % activeSlides.length)}
                    className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 backdrop-blur-xs transition-all"
                  >
                    <ChevronRight className="w-4 h-4 text-white" />
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="p-8 text-center text-gray-500 bg-gray-50 rounded-2xl border border-dashed">
            <p className="font-bold text-sm text-gray-700">No active offers currently selected.</p>
            <p className="text-xs text-gray-500 mt-1">
              Click &quot;Activate Offer&quot; on any recommendation above to feature it on your connected retailers' storefront.
            </p>
          </div>
        )}
      </section>

      {/* 4. ALL CONFIGURED OFFERS TABLE */}
      <section className="bg-white rounded-2xl p-5 border border-tradeflow-gray-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-tradeflow-navy flex items-center gap-2">
            <Layers className="w-4 h-4 text-tradeflow-green" />
            <span>All Configured Wholesaler Banners ({slides.length})</span>
          </h2>
          <span className="text-xs text-gray-500">
            {activeSlides.length} of {slides.length} active
          </span>
        </div>

        {slides.length === 0 ? (
          <div className="p-6 text-center text-xs text-gray-500 bg-gray-50 rounded-xl border border-dashed">
            No banners configured yet. Select one from the recommended options above.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {slides.map((slide) => (
              <div
                key={slide.id}
                className={`bg-white rounded-xl border transition-all flex flex-col justify-between overflow-hidden ${
                  slide.isActive ? 'border-tradeflow-gray-200 shadow-xs' : 'border-gray-200 opacity-60 bg-gray-50'
                }`}
              >
                {/* Image Header */}
                <div className="relative h-32 overflow-hidden bg-gray-100">
                  <img src={slide.imageUrl} alt="" className="w-full h-full object-cover" />
                  <div className={`absolute inset-0 bg-gradient-to-t ${getTradeflowGradient(slide.gradient)} opacity-80`} />
                  <div className="absolute top-2 left-2 right-2 flex items-center justify-between z-10">
                    <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-white/20 backdrop-blur-xs text-white border border-white/20">
                      {slide.badgeText || 'OFFER'}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleToggleActive(slide.id)}
                      disabled={saving}
                      className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase transition-all ${
                        slide.isActive ? 'bg-emerald-500 text-white shadow-xs' : 'bg-gray-300 text-gray-700'
                      }`}
                    >
                      {slide.isActive ? 'ACTIVE' : 'INACTIVE'}
                    </button>
                  </div>
                  <div className="absolute bottom-2 left-2 right-2 z-10">
                    <h4 className="font-bold text-white text-sm line-clamp-1 drop-shadow-xs">{slide.title}</h4>
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-3 space-y-2 flex-1 flex flex-col justify-between text-xs">
                  <p className="text-gray-600 text-[11px] line-clamp-2 leading-relaxed">{slide.subtitle}</p>

                  <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                    <span className="text-[11px] text-gray-500">
                      Target: <strong>{slide.targetCategory || 'All'}</strong>
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEditModal(slide)}
                        className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-lg text-xs flex items-center gap-1"
                      >
                        <Edit3 className="w-3 h-3" /> Edit
                      </button>
                      <button
                        onClick={() => handleDeleteSlide(slide.id)}
                        className="p-1 text-red-600 hover:bg-red-50 rounded-lg"
                        title="Delete banner"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* CREATE / EDIT SLIDE MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 space-y-4 border border-tradeflow-gray-200 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-tradeflow-gray-200">
              <h3 className="text-base font-bold text-tradeflow-navy flex items-center gap-2">
                <Sliders className="w-5 h-5 text-tradeflow-green" />
                <span>{editingSlide ? 'Edit Promotional Offer' : 'Configure New Promotional Offer'}</span>
              </h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 font-bold">
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveSlide} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-gray-700 mb-1">Banner Heading / Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Festive B2B Stock-Up Fair"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl bg-tradeflow-gray-50 font-semibold text-xs"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Short Offer Text / Subtitle</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Exclusive wholesale margins on bulk cases with prompt truck dispatch."
                  value={form.subtitle}
                  onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl bg-tradeflow-gray-50 text-xs"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Badge Text</label>
                  <input
                    type="text"
                    placeholder="e.g. WHOLESALE EXCLUSIVE"
                    value={form.badgeText}
                    onChange={(e) => setForm({ ...form, badgeText: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl bg-tradeflow-gray-50 text-xs uppercase"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Discount / Promotion Badge</label>
                  <input
                    type="text"
                    placeholder="e.g. UP TO 30% MARGIN"
                    value={form.discountBadge}
                    onChange={(e) => setForm({ ...form, discountBadge: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl bg-tradeflow-gray-50 text-xs font-bold text-emerald-700 uppercase"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Target Category</label>
                  <select
                    value={form.targetCategory}
                    onChange={(e) => setForm({ ...form, targetCategory: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl bg-tradeflow-gray-50 text-xs font-semibold"
                  >
                    <option value="All">All Categories</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">CTA Button Text</label>
                  <input
                    type="text"
                    placeholder="e.g. Shop Trade Deals"
                    value={form.buttonText}
                    onChange={(e) => setForm({ ...form, buttonText: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl bg-tradeflow-gray-50 text-xs font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Banner Image</label>
                <p className="text-[11px] text-gray-500 mb-2">JPG, PNG, or WebP up to 5 MB.</p>
                {(imagePreview || form.imageUrl) && (
                  <img
                    src={imagePreview || form.imageUrl}
                    alt="Banner preview"
                    className="mb-3 h-36 w-full rounded-xl border border-gray-200 bg-gray-50 object-cover"
                  />
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <label className="inline-flex cursor-pointer items-center rounded-xl bg-tradeflow-gray-100 px-3 py-2 font-bold text-tradeflow-navy hover:bg-tradeflow-gray-200">
                    {imagePreview || form.imageUrl ? 'Replace Image' : 'Upload Image'}
                    <input
                      type="file"
                      accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                      className="sr-only"
                      onChange={(event) => {
                        handleImageSelection(event.target.files?.[0]);
                        event.currentTarget.value = '';
                      }}
                    />
                  </label>
                  {(imagePreview || form.imageUrl) && (
                    <button
                      type="button"
                      onClick={() => {
                        setImageFile(null);
                        setForm((previous) => ({ ...previous, imageUrl: '' }));
                        setError('');
                      }}
                      className="rounded-xl border border-gray-300 px-3 py-2 font-bold text-gray-700 hover:bg-gray-50"
                    >
                      Remove Image
                    </button>
                  )}
                  {imageFile && <span className="text-[11px] text-gray-500">{imageFile.name}</span>}
                </div>
                {error && <p className="mt-2 text-[11px] font-semibold text-rose-700">{error}</p>}
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Banner Background Gradient</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {GRADIENT_OPTIONS.map((g) => (
                    <button
                      key={g.label}
                      type="button"
                      onClick={() => setForm({ ...form, gradient: g.value })}
                      className={`p-2.5 rounded-xl border text-center text-xs font-bold text-white transition-all bg-gradient-to-r ${getTradeflowGradient(g.value)} ${
                        form.gradient === g.value ? 'ring-2 ring-tradeflow-green border-white' : 'opacity-80'
                      }`}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-gray-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 font-bold rounded-xl hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-tradeflow-green text-tradeflow-navy font-bold rounded-xl hover:bg-tradeflow-green-hover shadow-md flex items-center gap-2"
                >
                  {saving && <LoaderCircle className="w-3.5 h-3.5 animate-spin" />}
                  <span>{editingSlide ? 'Save Changes' : 'Save & Publish Banner'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
