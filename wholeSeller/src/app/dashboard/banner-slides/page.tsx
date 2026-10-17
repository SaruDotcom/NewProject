'use client';

import React, { useState, useEffect } from 'react';
import {
  Sliders,
  Plus,
  Image,
  Sparkles,
  CheckCircle2,
  Trash2,
  Edit3,
  Eye,
  ChevronLeft,
  ChevronRight,
  Target,
  ArrowRight,
  Layers,
  Copy,
  Check,
  Tag,
  Gift
} from 'lucide-react';
import { useWholesaler } from '@/context/WholesalerContext';

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
  targetRetailers: 'ALL' | string;
  createdAt: string;
}

const DEFAULT_PRESET_IMAGES = [
  {
    name: 'Festive Apparel Sale',
    url: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=1200&q=80',
    category: 'Clothing & Apparel'
  },
  {
    name: 'Electronics Wholesale Mega Fair',
    url: 'https://images.unsplash.com/photo-1550009158-9ebf69173e03?auto=format&fit=crop&w=1200&q=80',
    category: 'Electronics'
  },
  {
    name: 'Grocery & Staples Bulk Savings',
    url: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1200&q=80',
    category: 'Grocery & Staples'
  },
  {
    name: 'Footwear & Fashion Collection',
    url: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=1200&q=80',
    category: 'Footwear'
  }
];

const GRADIENT_OPTIONS = [
  { label: 'Navy & Green', value: 'from-tradeflow-navy via-tradeflow-green to-tradeflow-navy' },
  { label: 'Growth Green', value: 'from-tradeflow-navy via-green-700 to-tradeflow-green' },
  { label: 'Sky & Navy', value: 'from-tradeflow-navy via-tradeflow-sky to-tradeflow-navy' },
  { label: 'Amber & Navy', value: 'from-tradeflow-navy via-amber-700 to-tradeflow-navy' },
];

const getTradeflowGradient = (gradient: string) =>
  gradient.includes('tradeflow-')
    ? gradient
    : 'from-tradeflow-navy via-tradeflow-green to-tradeflow-navy';

export const INITIAL_SLIDES: BannerSlide[] = [
  {
    id: 'slide-1',
    title: 'Festive B2B Stock-Up Fair',
    subtitle: 'Get up to 35% extra wholesale margin on bulk Saree & Kurti cases!',
    badgeText: 'FESTIVE SPECIAL',
    buttonText: 'Shop Wholesale Offers',
    imageUrl: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=1200&q=80',
    targetCategory: 'Clothing',
    discountBadge: '35% EXTRA MARGIN',
    gradient: 'from-tradeflow-navy via-tradeflow-green to-tradeflow-navy',
    isActive: true,
    targetRetailers: 'ALL',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'slide-2',
    title: 'Electronics & Gadgets Wholesale Deals',
    subtitle: 'Direct factory pricing on smart devices with 1-year warranty & GST input credit.',
    badgeText: 'DIRECT SUPPLIER PRICE',
    buttonText: 'Explore Electronics',
    imageUrl: 'https://images.unsplash.com/photo-1550009158-9ebf69173e03?auto=format&fit=crop&w=1200&q=80',
    targetCategory: 'Electronics',
    discountBadge: 'FLAT ₹500 OFF',
    gradient: 'from-tradeflow-navy via-tradeflow-sky to-tradeflow-navy',
    isActive: true,
    targetRetailers: 'ALL',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'slide-3',
    title: 'Grocery Staples Bulk Saver Week',
    subtitle: 'Consolidate monthly inventory orders & get free door-step truck dispatch.',
    badgeText: 'FREE TRUCK FREIGHT',
    buttonText: 'Order Grocery Cases',
    imageUrl: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1200&q=80',
    targetCategory: 'Grocery & Staples',
    discountBadge: 'FREE DELIVERY',
    gradient: 'from-tradeflow-navy via-tradeflow-green to-tradeflow-navy',
    isActive: true,
    targetRetailers: 'ALL',
    createdAt: new Date().toISOString(),
  },
];

export default function BannerSlidesPage() {
  const { categories, retailers } = useWholesaler();
  const [slides, setSlides] = useState<BannerSlide[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('wholesaler_banner_slides');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          // ignore
        }
      }
    }
    return INITIAL_SLIDES;
  });

  const [activePreviewIndex, setActivePreviewIndex] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [editingSlide, setEditingSlide] = useState<BannerSlide | null>(null);

  const [form, setForm] = useState({
    title: '',
    subtitle: '',
    badgeText: 'LIMITED TIME DEAL',
    buttonText: 'Explore Collection',
    imageUrl: DEFAULT_PRESET_IMAGES[0].url,
    targetCategory: 'All',
    discountBadge: 'UP TO 30% OFF',
    gradient: GRADIENT_OPTIONS[0].value,
    targetRetailers: 'ALL',
  });

  useEffect(() => {
    localStorage.setItem('wholesaler_banner_slides', JSON.stringify(slides));
  }, [slides]);

  const activeSlides = slides.filter((s) => s.isActive);

  // Auto-play preview carousel
  useEffect(() => {
    if (activeSlides.length <= 1) return;
    const timer = setInterval(() => {
      setActivePreviewIndex((prev) => (prev + 1) % activeSlides.length);
    }, 4500);
    return () => clearInterval(timer);
  }, [activeSlides.length]);

  const handleOpenCreateModal = () => {
    setEditingSlide(null);
    setForm({
      title: '',
      subtitle: '',
      badgeText: 'WHOLESALE EXCLUSIVE',
      buttonText: 'Shop Trade Deals',
      imageUrl: DEFAULT_PRESET_IMAGES[0].url,
      targetCategory: categories[0]?.name || 'All',
      discountBadge: 'EXTRA 20% MARGIN',
      gradient: GRADIENT_OPTIONS[0].value,
      targetRetailers: 'ALL',
    });
    setShowModal(true);
  };

  const handleOpenEditModal = (slide: BannerSlide) => {
    setEditingSlide(slide);
    setForm({
      title: slide.title,
      subtitle: slide.subtitle,
      badgeText: slide.badgeText || '',
      buttonText: slide.buttonText || 'Shop Trade Deals',
      imageUrl: slide.imageUrl,
      targetCategory: slide.targetCategory || 'All',
      discountBadge: slide.discountBadge || '',
      gradient: slide.gradient || GRADIENT_OPTIONS[0].value,
      targetRetailers: slide.targetRetailers || 'ALL',
    });
    setShowModal(true);
  };

  const handleSaveSlide = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;

    if (editingSlide) {
      setSlides((prev) =>
        prev.map((s) =>
          s.id === editingSlide.id
            ? {
                ...s,
                title: form.title,
                subtitle: form.subtitle,
                badgeText: form.badgeText,
                buttonText: form.buttonText,
                imageUrl: form.imageUrl,
                targetCategory: form.targetCategory,
                discountBadge: form.discountBadge,
                gradient: form.gradient,
                targetRetailers: form.targetRetailers,
              }
            : s
        )
      );
    } else {
      const newSlide: BannerSlide = {
        id: `slide-${Date.now()}`,
        title: form.title,
        subtitle: form.subtitle,
        badgeText: form.badgeText,
        buttonText: form.buttonText,
        imageUrl: form.imageUrl,
        targetCategory: form.targetCategory,
        discountBadge: form.discountBadge,
        gradient: form.gradient,
        isActive: true,
        targetRetailers: form.targetRetailers,
        createdAt: new Date().toISOString(),
      };
      setSlides((prev) => [newSlide, ...prev]);
    }
    setShowModal(false);
  };

  const handleToggleActive = (id: string) => {
    setSlides((prev) =>
      prev.map((s) => (s.id === id ? { ...s, isActive: !s.isActive } : s))
    );
  };

  const handleDeleteSlide = (id: string) => {
    setSlides((prev) => prev.filter((s) => s.id !== id));
  };

  const currentPreview = activeSlides[activePreviewIndex] || slides[0];

  return (
    <div className="space-y-6">
      {/* Top Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-tradeflow-navy">Retailer Banner Slides & Marketing</h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-tradeflow-sky-50 text-tradeflow-navy border border-tradeflow-sky/30">
              Live Storefront Preview
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Create promotional banner sliders provided to your connected B2B retailers for their business storefront homepage.
          </p>
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="px-4 py-2.5 bg-tradeflow-green text-tradeflow-navy font-bold text-xs rounded-xl hover:bg-tradeflow-green-hover transition-all shadow-md flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Create New Banner Slide
        </button>
      </div>

      {/* Live Storefront Interactive Preview Slider */}
      <div className="bg-white rounded-2xl p-5 border border-tradeflow-gray-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Eye className="w-5 h-5 text-tradeflow-sky" />
            <h2 className="text-sm font-bold text-tradeflow-navy">Retailer Storefront Live Banner Preview</h2>
          </div>
          <span className="text-xs text-gray-500 font-semibold">
            {activeSlides.length} Active Slide{activeSlides.length === 1 ? '' : 's'} Displaying to Retailers
          </span>
        </div>

        {currentPreview ? (
          <div className="relative rounded-2xl overflow-hidden min-h-[300px] sm:min-h-[360px] shadow-lg border border-gray-200 flex flex-col justify-between p-6 sm:p-10 text-white">
            {/* Background Image with Overlay */}
            <img
              src={currentPreview.imageUrl}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className={`absolute inset-0 bg-gradient-to-r ${getTradeflowGradient(currentPreview.gradient)} opacity-90`} />

            {/* Slide Header Badges */}
            <div className="relative z-10 flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-white/20 backdrop-blur-md border border-white/20">
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                {currentPreview.badgeText || 'WHOLESALE DEAL'}
              </span>

              {currentPreview.discountBadge && (
                <span className="px-3 py-1 rounded-full text-xs font-black bg-amber-400 text-tradeflow-navy shadow-md">
                  {currentPreview.discountBadge}
                </span>
              )}
            </div>

            {/* Main Content */}
            <div className="relative z-10 max-w-xl space-y-2 my-auto py-6">
              <h3 className="text-2xl sm:text-4xl font-black tracking-tight leading-tight drop-shadow-md">
                {currentPreview.title}
              </h3>
              <p className="text-xs sm:text-sm text-gray-200 line-clamp-2 leading-relaxed">
                {currentPreview.subtitle}
              </p>

              <div className="pt-4 flex items-center gap-3">
                <div className="px-5 py-2.5 bg-white text-tradeflow-navy font-extrabold text-xs rounded-xl shadow-lg flex items-center gap-2 hover:bg-tradeflow-gray-50 transition-all">
                  <span>{currentPreview.buttonText || 'Shop Trade Deals'}</span>
                  <ArrowRight className="w-4 h-4" />
                </div>
                <span className="text-[11px] text-gray-300 font-medium">
                  Category: <strong className="text-white">{currentPreview.targetCategory}</strong>
                </span>
              </div>
            </div>

            {/* Slider Controls & Dot Indicators */}
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
            </div>
          </div>
        ) : (
          <div className="p-8 text-center text-gray-500 bg-gray-50 rounded-2xl border border-dashed">
            No active slides. Click "Create New Banner Slide" to publish your first retailer promotion!
          </div>
        )}
      </div>

      {/* Managed Banner Slides Grid */}
      <div className="space-y-4">
        <h2 className="text-base font-extrabold text-tradeflow-navy flex items-center gap-2">
          <Layers className="w-5 h-5 text-green-700" />
          <span>All Published Wholesaler Banner Slides ({slides.length})</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {slides.map((slide) => (
            <div
              key={slide.id}
              className={`bg-white rounded-2xl border transition-all flex flex-col justify-between overflow-hidden ${
                slide.isActive ? 'border-tradeflow-gray-200 shadow-xs' : 'border-gray-200 opacity-60 bg-gray-50'
              }`}
            >
              {/* Image Preview Header */}
              <div className="relative h-40 overflow-hidden bg-gray-100">
                <img src={slide.imageUrl} alt="" className="w-full h-full object-cover" />
                <div className={`absolute inset-0 bg-gradient-to-t ${getTradeflowGradient(slide.gradient)} opacity-80`} />
                <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-10">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-white/20 backdrop-blur-xs text-white border border-white/20">
                    {slide.badgeText || 'SLIDE'}
                  </span>
                  <button
                    onClick={() => handleToggleActive(slide.id)}
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase transition-all ${
                      slide.isActive
                        ? 'bg-emerald-500 text-white shadow-xs'
                        : 'bg-gray-300 text-gray-700'
                    }`}
                  >
                    {slide.isActive ? 'ACTIVE' : 'INACTIVE'}
                  </button>
                </div>
                <div className="absolute bottom-3 left-3 right-3 z-10">
                  <h4 className="font-extrabold text-white text-base line-clamp-1 drop-shadow-xs">
                    {slide.title}
                  </h4>
                </div>
              </div>

              {/* Card Body */}
              <div className="p-4 space-y-3 flex-1 flex flex-col justify-between text-xs">
                <p className="text-gray-600 line-clamp-2 leading-relaxed">{slide.subtitle}</p>

                <div className="pt-2 border-t border-gray-100 space-y-1.5 text-[11px] text-gray-500">
                  <div className="flex justify-between">
                    <span>Discount Badge:</span>
                    <strong className="text-emerald-700 font-bold">{slide.discountBadge || 'None'}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Target Category:</span>
                    <strong className="text-tradeflow-navy font-semibold">{slide.targetCategory}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Target Retailers:</span>
                    <strong className="text-tradeflow-navy font-semibold">
                      {slide.targetRetailers === 'ALL' ? 'All Connected Retailers' : slide.targetRetailers}
                    </strong>
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-3 flex items-center justify-between border-t border-gray-100">
                  <button
                    onClick={() => handleOpenEditModal(slide)}
                    className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-lg transition-all flex items-center gap-1"
                  >
                    <Edit3 className="w-3.5 h-3.5" /> Edit Slide
                  </button>
                  <button
                    onClick={() => handleDeleteSlide(slide.id)}
                    className="p-1.5 text-status-danger hover:text-red-700 hover:bg-red-50 rounded-lg transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CREATE / EDIT SLIDE MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 space-y-4 border border-tradeflow-gray-200 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-tradeflow-gray-200">
              <h3 className="text-base font-bold text-tradeflow-navy flex items-center gap-2">
                <Sliders className="w-5 h-5 text-green-700" />
                <span>{editingSlide ? 'Edit Banner Slide' : 'Create Wholesaler Banner Slide'}</span>
              </h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 font-bold">
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveSlide} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-gray-700 mb-1">Banner Title *</label>
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
                <label className="block font-bold text-gray-700 mb-1">Subtitle / Offer Description</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Get up to 35% extra margin on bulk Saree & Kurti cases!"
                  value={form.subtitle}
                  onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl bg-tradeflow-gray-50 text-xs"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Top Badge Text</label>
                  <input
                    type="text"
                    placeholder="e.g. FESTIVE SPECIAL"
                    value={form.badgeText}
                    onChange={(e) => setForm({ ...form, badgeText: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl bg-tradeflow-gray-50 text-xs uppercase"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Discount Badge Label</label>
                  <input
                    type="text"
                    placeholder="e.g. UP TO 35% OFF"
                    value={form.discountBadge}
                    onChange={(e) => setForm({ ...form, discountBadge: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl bg-tradeflow-gray-50 text-xs font-bold text-emerald-700 uppercase"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Target Category Link</label>
                  <select
                    value={form.targetCategory}
                    onChange={(e) => setForm({ ...form, targetCategory: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl bg-tradeflow-gray-50 text-xs font-semibold"
                  >
                    <option value="All">All Products</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Button Action Text</label>
                  <input
                    type="text"
                    placeholder="e.g. Shop Wholesale Deals"
                    value={form.buttonText}
                    onChange={(e) => setForm({ ...form, buttonText: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl bg-tradeflow-gray-50 text-xs font-bold"
                  />
                </div>
              </div>

              {/* Image Presets & URL */}
              <div>
                <label className="block font-bold text-gray-700 mb-1">Select Banner Image Preset or Enter URL</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
                  {DEFAULT_PRESET_IMAGES.map((preset) => (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => setForm({ ...form, imageUrl: preset.url })}
                      className={`p-1.5 rounded-lg border text-left text-[10px] transition-all overflow-hidden ${
                        form.imageUrl === preset.url
                          ? 'border-tradeflow-green bg-tradeflow-green-50 font-bold'
                          : 'border-gray-200 bg-gray-50'
                      }`}
                    >
                      <img src={preset.url} alt="" className="h-10 w-full object-cover rounded-md mb-1" />
                      <span className="line-clamp-1">{preset.name}</span>
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  placeholder="https://..."
                  value={form.imageUrl}
                  onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl bg-tradeflow-gray-50 text-xs font-mono"
                />
              </div>

              {/* Theme Gradient */}
              <div>
                <label className="block font-bold text-gray-700 mb-1">Banner Background Theme</label>
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
                  className="px-5 py-2 bg-tradeflow-green text-tradeflow-navy font-bold rounded-xl hover:bg-tradeflow-green-hover shadow-md"
                >
                  {editingSlide ? 'Save Changes' : 'Publish Banner Slide'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
