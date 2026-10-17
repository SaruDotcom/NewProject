import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Ticket,
  Plus,
  Search,
  Tag,
  Calendar,
  Layers,
  Copy,
  Check,
  Edit2,
  Trash2,
  ToggleLeft,
  ToggleRight,
  TrendingUp,
  AlertCircle,
  Clock,
  Sparkles,
  Percent,
  IndianRupee,
  Users,
} from 'lucide-react';
import api from '@/lib/api';
import { useWholesaler } from '@/context/WholesalerContext';
import { wholesalerQueryKeys } from '@/lib/query-client';

interface Coupon {
  _id: string;
  code: string;
  title: string;
  description?: string;
  discountType: 'PERCENTAGE' | 'FLAT';
  discountValue: number;
  minOrderValue: number;
  maxDiscountCap: number;
  validFrom?: string;
  validUntil?: string;
  usageLimit: number;
  usageCount: number;
  perRetailerLimit: number;
  isActive: boolean;
  createdAt?: string;
}

export default function CouponsPage() {
  const { profile } = useWholesaler();
  const queryClient = useQueryClient();
  const couponsQuery = useQuery({
    queryKey: wholesalerQueryKeys.resource(profile.id || 'unknown', 'coupons'),
    queryFn: async () => {
      const response = await api.getWholesalerCoupons();
      if (!response.success || !Array.isArray(response.data)) throw new Error('Failed to load coupons');
      return response.data as Coupon[];
    },
    enabled: Boolean(profile.id),
  });
  const coupons = couponsQuery.data ?? [];
  const isLoading = couponsQuery.isLoading;
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    code: '',
    title: '',
    description: '',
    discountType: 'PERCENTAGE' as 'PERCENTAGE' | 'FLAT',
    discountValue: '',
    minOrderValue: '0',
    maxDiscountCap: '0',
    validFrom: new Date().toISOString().split('T')[0],
    validUntil: '',
    usageLimit: '0',
    perRetailerLimit: '1',
    isActive: true,
  });

  const fetchCoupons = async () => {
    await queryClient.invalidateQueries({
      queryKey: wholesalerQueryKeys.resource(profile.id || 'unknown', 'coupons'),
    });
    await couponsQuery.refetch();
  };

  useEffect(() => {
    if (couponsQuery.error) {
      console.error('Failed to fetch coupons:', couponsQuery.error);
      setError(couponsQuery.error.message || 'Failed to load coupons');
    } else if (couponsQuery.data) {
      setError(null);
    }
  }, [couponsQuery.data, couponsQuery.error]);

  const openCreateModal = () => {
    setEditingCoupon(null);
    setFormData({
      code: '',
      title: '',
      description: '',
      discountType: 'PERCENTAGE',
      discountValue: '',
      minOrderValue: '0',
      maxDiscountCap: '0',
      validFrom: new Date().toISOString().split('T')[0],
      validUntil: '',
      usageLimit: '0',
      perRetailerLimit: '1',
      isActive: true,
    });
    setIsModalOpen(true);
    setError(null);
  };

  const openEditModal = (coupon: Coupon) => {
    setEditingCoupon(coupon);
    setFormData({
      code: coupon.code,
      title: coupon.title,
      description: coupon.description || '',
      discountType: coupon.discountType === 'FLAT' ? 'FLAT' : 'PERCENTAGE',
      discountValue: String(coupon.discountValue),
      minOrderValue: String(coupon.minOrderValue || 0),
      maxDiscountCap: String(coupon.maxDiscountCap || 0),
      validFrom: coupon.validFrom ? coupon.validFrom.split('T')[0] : '',
      validUntil: coupon.validUntil ? coupon.validUntil.split('T')[0] : '',
      usageLimit: String(coupon.usageLimit || 0),
      perRetailerLimit: String(coupon.perRetailerLimit || 0),
      isActive: coupon.isActive,
    });
    setIsModalOpen(true);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    if (!formData.code.trim() || !formData.title.trim() || !formData.discountValue) {
      setError('Please fill in code, title, and discount value');
      setIsSubmitting(false);
      return;
    }

    const payload = {
      code: formData.code.trim().toUpperCase(),
      title: formData.title.trim(),
      description: formData.description.trim(),
      discountType: formData.discountType,
      discountValue: Number(formData.discountValue),
      minOrderValue: Number(formData.minOrderValue) || 0,
      maxDiscountCap: Number(formData.maxDiscountCap) || 0,
      validFrom: formData.validFrom ? new Date(formData.validFrom).toISOString() : null,
      validUntil: formData.validUntil ? new Date(formData.validUntil).toISOString() : null,
      usageLimit: Number(formData.usageLimit) || 0,
      perRetailerLimit: Number(formData.perRetailerLimit) || 0,
      isActive: formData.isActive,
    };

    try {
      if (editingCoupon) {
        await api.updateWholesalerCoupon(editingCoupon._id, payload);
      } else {
        await api.createWholesalerCoupon(payload);
      }
      setIsModalOpen(false);
      await fetchCoupons();
    } catch (err: any) {
      setError(err.message || 'Failed to save coupon');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (couponId: string) => {
    try {
      await api.toggleWholesalerCoupon(couponId);
      await fetchCoupons();
    } catch (err: any) {
      alert(err.message || 'Failed to toggle status');
    }
  };

  const handleDelete = async (couponId: string) => {
    if (!window.confirm('Are you sure you want to delete this coupon?')) return;
    try {
      await api.deleteWholesalerCoupon(couponId);
      await fetchCoupons();
    } catch (err: any) {
      alert(err.message || 'Failed to delete coupon');
    }
  };

  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // Filtered list
  const filteredCoupons = coupons.filter((coupon) => {
    const matchesSearch =
      coupon.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      coupon.title.toLowerCase().includes(searchQuery.toLowerCase());

    if (activeTab === 'ACTIVE') return matchesSearch && coupon.isActive;
    if (activeTab === 'INACTIVE') return matchesSearch && !coupon.isActive;
    return matchesSearch;
  });

  const totalActive = coupons.filter((c) => c.isActive).length;
  const totalRedemptions = coupons.reduce((sum, c) => sum + (c.usageCount || 0), 0);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-tradeflow-gray-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-tradeflow-green-50 text-green-700 rounded-xl font-bold">
              <Ticket className="w-6 h-6" />
            </span>
            <h1 className="text-2xl font-extrabold text-tradeflow-navy">Coupons & Offers</h1>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            Create and manage promotional discount coupons for your connected retailers to boost sales.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-tradeflow-green hover:bg-tradeflow-green-hover text-tradeflow-navy font-bold rounded-xl shadow-md transition-all transform hover:scale-[1.02]"
        >
          <Plus className="w-5 h-5" />
          <span>Create New Coupon</span>
        </button>
      </div>

      {/* Analytics Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 bg-white rounded-2xl border border-tradeflow-gray-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-tradeflow-green-100 text-green-700 flex items-center justify-center">
            <Tag className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Active Coupons</div>
            <div className="text-2xl font-black text-tradeflow-navy mt-0.5">{totalActive} / {coupons.length}</div>
          </div>
        </div>

        <div className="p-5 bg-white rounded-2xl border border-tradeflow-gray-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Redemptions</div>
            <div className="text-2xl font-black text-tradeflow-navy mt-0.5">{totalRedemptions} Times</div>
          </div>
        </div>

        <div className="p-5 bg-white rounded-2xl border border-tradeflow-gray-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Retailer Engagement</div>
            <div className="text-2xl font-black text-tradeflow-navy mt-0.5">High Potential</div>
          </div>
        </div>
      </div>

      {/* Tabs & Search Filter */}
      <div className="bg-white p-4 rounded-2xl border border-tradeflow-gray-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-1 bg-tradeflow-gray-50 p-1 rounded-xl border border-tradeflow-gray-200 w-full md:w-auto">
          <button
            onClick={() => setActiveTab('ALL')}
            className={`px-4 py-2 text-xs font-extrabold rounded-lg transition-all ${
              activeTab === 'ALL'
                ? 'bg-white text-green-700 shadow-xs'
                : 'text-gray-600 hover:text-tradeflow-navy'
            }`}
          >
            All Coupons ({coupons.length})
          </button>
          <button
            onClick={() => setActiveTab('ACTIVE')}
            className={`px-4 py-2 text-xs font-extrabold rounded-lg transition-all ${
              activeTab === 'ACTIVE'
                ? 'bg-white text-green-700 shadow-xs'
                : 'text-gray-600 hover:text-tradeflow-navy'
            }`}
          >
            Active ({totalActive})
          </button>
          <button
            onClick={() => setActiveTab('INACTIVE')}
            className={`px-4 py-2 text-xs font-extrabold rounded-lg transition-all ${
              activeTab === 'INACTIVE'
                ? 'bg-white text-green-700 shadow-xs'
                : 'text-gray-600 hover:text-tradeflow-navy'
            }`}
          >
            Inactive ({coupons.length - totalActive})
          </button>
        </div>

        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search coupon code or title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs border border-tradeflow-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-tradeflow-green/20 focus:border-tradeflow-green"
          />
        </div>
      </div>

      {/* Coupons List */}
      {isLoading ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-tradeflow-gray-200">
          <div className="w-8 h-8 border-4 border-tradeflow-green border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-3 text-xs font-semibold text-gray-500">Loading coupons...</p>
        </div>
      ) : filteredCoupons.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-tradeflow-gray-200 space-y-3">
          <div className="w-16 h-16 rounded-full bg-tradeflow-green-50 text-green-700 flex items-center justify-center mx-auto">
            <Ticket className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-tradeflow-navy">No coupons found</h3>
          <p className="text-xs text-gray-500 max-w-sm mx-auto">
            {searchQuery
              ? `No coupons matching "${searchQuery}"`
              : 'You have not created any discount coupons yet. Click below to add your first offer!'}
          </p>
          {!searchQuery && (
            <button
              onClick={openCreateModal}
              className="mt-2 inline-flex items-center gap-2 px-4 py-2 bg-tradeflow-green text-tradeflow-navy font-bold rounded-xl text-xs"
            >
              <Plus className="w-4 h-4" />
              Create First Coupon
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredCoupons.map((coupon) => {
            const isExpired = coupon.validUntil && new Date(coupon.validUntil) < new Date();
            return (
              <div
                key={coupon._id}
                className={`bg-white rounded-2xl border transition-all duration-200 shadow-xs flex flex-col justify-between overflow-hidden relative ${
                  coupon.isActive && !isExpired
                    ? 'border-tradeflow-gray-200 hover:border-tradeflow-green/40 hover:shadow-md'
                    : 'border-dashed border-gray-300 opacity-80 bg-gray-50/50'
                }`}
              >
                {/* Header Strip */}
                <div className="p-5 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-black px-3 py-1 bg-tradeflow-green-50 text-green-700 border border-tradeflow-green-100 rounded-lg tracking-wider flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5" />
                        {coupon.code}
                      </span>
                      <button
                        onClick={() => copyToClipboard(coupon.code)}
                        title="Copy coupon code"
                        className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                      >
                        {copiedCode === coupon.code ? (
                          <Check className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                    </div>

                    <span
                      className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                        coupon.isActive && !isExpired
                          ? 'bg-emerald-100 text-emerald-800'
                          : isExpired
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-gray-200 text-gray-700'
                      }`}
                    >
                      {isExpired ? 'Expired' : coupon.isActive ? 'Active' : 'Disabled'}
                    </span>
                  </div>

                  <div>
                    <h3 className="font-extrabold text-base text-tradeflow-navy leading-tight">
                      {coupon.title}
                    </h3>
                    {coupon.description && (
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">{coupon.description}</p>
                    )}
                  </div>

                  {/* Discount Banner Details */}
                  <div className="p-3 bg-tradeflow-gray-50 rounded-xl border border-tradeflow-gray-200 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500 font-medium">Discount Value:</span>
                      <span className="font-black text-green-700">
                        {coupon.discountType === 'PERCENTAGE'
                          ? `${coupon.discountValue}% OFF`
                          : `₹${coupon.discountValue} FLAT OFF`}
                      </span>
                    </div>

                    {coupon.discountType === 'PERCENTAGE' && coupon.maxDiscountCap > 0 && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-500 font-medium">Max Discount Cap:</span>
                        <span className="font-bold text-gray-700">₹{coupon.maxDiscountCap}</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500 font-medium">Min Order Subtotal:</span>
                      <span className="font-bold text-gray-700">
                        {coupon.minOrderValue > 0 ? `₹${coupon.minOrderValue}` : 'No Minimum'}
                      </span>
                    </div>
                  </div>

                  {/* Limits & Usage */}
                  <div className="space-y-1.5 text-xs text-gray-600">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-gray-500">
                        <Users className="w-3.5 h-3.5" /> Total Redemptions:
                      </span>
                      <span className="font-bold text-gray-900">
                        {coupon.usageCount || 0}
                        {coupon.usageLimit > 0 ? ` / ${coupon.usageLimit}` : ' (Unlimited)'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-gray-500">
                        <Clock className="w-3.5 h-3.5" /> Limit Per Retailer:
                      </span>
                      <span className="font-bold text-gray-900">
                        {coupon.perRetailerLimit > 0 ? `${coupon.perRetailerLimit} Order(s)` : 'Unlimited'}
                      </span>
                    </div>

                    {coupon.validUntil && (
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-gray-500">
                          <Calendar className="w-3.5 h-3.5" /> Valid Until:
                        </span>
                        <span className="font-semibold text-gray-700">
                          {new Date(coupon.validUntil).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Controls */}
                <div className="px-5 py-3 bg-tradeflow-gray-50 border-t border-tradeflow-gray-200 flex items-center justify-between">
                  <button
                    onClick={() => handleToggleStatus(coupon._id)}
                    className="flex items-center gap-1.5 text-xs font-bold text-gray-700 hover:text-green-700 transition-colors"
                  >
                    {coupon.isActive ? (
                      <ToggleRight className="w-5 h-5 text-emerald-600" />
                    ) : (
                      <ToggleLeft className="w-5 h-5 text-gray-400" />
                    )}
                    <span>{coupon.isActive ? 'Active' : 'Enable'}</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openEditModal(coupon)}
                      className="p-1.5 text-gray-600 hover:text-green-700 hover:bg-white rounded-lg border border-transparent hover:border-tradeflow-gray-200 transition-all"
                      title="Edit Coupon"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(coupon._id)}
                      className="p-1.5 text-rose-600 hover:text-rose-800 hover:bg-white rounded-lg border border-transparent hover:border-tradeflow-gray-200 transition-all"
                      title="Delete Coupon"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-tradeflow-gray-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-tradeflow-gray-50 border-b border-tradeflow-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Ticket className="w-5 h-5 text-green-700" />
                <h2 className="font-extrabold text-lg text-tradeflow-navy">
                  {editingCoupon ? 'Edit Coupon' : 'Create New Coupon'}
                </h2>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-700 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {error && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-extrabold text-gray-700 mb-1">
                    Coupon Code *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. DIWALI50"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 text-xs font-mono font-bold uppercase border border-tradeflow-gray-200 rounded-xl focus:ring-2 focus:ring-tradeflow-green/20 focus:border-tradeflow-green"
                  />
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-gray-700 mb-1">
                    Title / Offer Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Diwali Festive Offer"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-tradeflow-gray-200 rounded-xl focus:ring-2 focus:ring-tradeflow-green/20 focus:border-tradeflow-green"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-extrabold text-gray-700 mb-1">
                  Description (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Short description for retailer terms (e.g. Valid on all electronics orders)"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-tradeflow-gray-200 rounded-xl focus:ring-2 focus:ring-tradeflow-green/20 focus:border-tradeflow-green"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-tradeflow-gray-50 p-3 rounded-xl border border-tradeflow-gray-200">
                <div>
                  <label className="block text-xs font-extrabold text-gray-700 mb-1">
                    Discount Type *
                  </label>
                  <select
                    value={formData.discountType}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        discountType: e.target.value as 'PERCENTAGE' | 'FLAT',
                      })
                    }
                    className="w-full px-3 py-2 text-xs font-semibold border border-tradeflow-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-tradeflow-green/20 focus:border-tradeflow-green"
                  >
                    <option value="PERCENTAGE">Percentage (%) OFF</option>
                    <option value="FLAT">Flat Amount (₹) OFF</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-gray-700 mb-1">
                    Discount Value * ({formData.discountType === 'PERCENTAGE' ? '%' : '₹'})
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    placeholder={formData.discountType === 'PERCENTAGE' ? 'e.g. 10' : 'e.g. 500'}
                    value={formData.discountValue}
                    onChange={(e) => setFormData({ ...formData, discountValue: e.target.value })}
                    className="w-full px-3 py-2 text-xs font-bold border border-tradeflow-gray-200 rounded-xl focus:ring-2 focus:ring-tradeflow-green/20 focus:border-tradeflow-green"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-extrabold text-gray-700 mb-1">
                    Min Order Value (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0 = No minimum"
                    value={formData.minOrderValue}
                    onChange={(e) => setFormData({ ...formData, minOrderValue: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-tradeflow-gray-200 rounded-xl focus:ring-2 focus:ring-tradeflow-green/20 focus:border-tradeflow-green"
                  />
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-gray-700 mb-1">
                    Max Discount Cap (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0 = No max cap"
                    value={formData.maxDiscountCap}
                    onChange={(e) => setFormData({ ...formData, maxDiscountCap: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-tradeflow-gray-200 rounded-xl focus:ring-2 focus:ring-tradeflow-green/20 focus:border-tradeflow-green"
                    disabled={formData.discountType === 'FLAT'}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-extrabold text-gray-700 mb-1">
                    Valid From
                  </label>
                  <input
                    type="date"
                    value={formData.validFrom}
                    onChange={(e) => setFormData({ ...formData, validFrom: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-tradeflow-gray-200 rounded-xl focus:ring-2 focus:ring-tradeflow-green/20 focus:border-tradeflow-green"
                  />
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-gray-700 mb-1">
                    Valid Until (Optional)
                  </label>
                  <input
                    type="date"
                    value={formData.validUntil}
                    onChange={(e) => setFormData({ ...formData, validUntil: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-tradeflow-gray-200 rounded-xl focus:ring-2 focus:ring-tradeflow-green/20 focus:border-tradeflow-green"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-extrabold text-gray-700 mb-1">
                    Total Usage Limit
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0 = Unlimited total usage"
                    value={formData.usageLimit}
                    onChange={(e) => setFormData({ ...formData, usageLimit: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-tradeflow-gray-200 rounded-xl focus:ring-2 focus:ring-tradeflow-green/20 focus:border-tradeflow-green"
                  />
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-gray-700 mb-1">
                    Usage Limit Per Retailer
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0 = Unlimited per retailer"
                    value={formData.perRetailerLimit}
                    onChange={(e) => setFormData({ ...formData, perRetailerLimit: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-tradeflow-gray-200 rounded-xl focus:ring-2 focus:ring-tradeflow-green/20 focus:border-tradeflow-green"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="isActiveToggle"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-4 h-4 text-green-700 rounded border-gray-300 focus:ring-tradeflow-green"
                />
                <label htmlFor="isActiveToggle" className="text-xs font-bold text-gray-700 cursor-pointer">
                  Activate this coupon immediately
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-tradeflow-gray-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-tradeflow-gray-200 text-gray-700 font-bold rounded-xl text-xs hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-tradeflow-green hover:bg-tradeflow-green-hover text-tradeflow-navy font-bold rounded-xl text-xs shadow-xs disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : editingCoupon ? 'Update Coupon' : 'Create Coupon'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
