import { getWholesalerId, queryClient, wholesalerQueryKeys } from '@/lib/query-client';

const BASE_URL = import.meta.env.VITE_API_BASE_URL?.replace(/\/+$/, '');

export function resolveProductImageUrl(imagePath?: string | null): string | null {
  const value = imagePath?.trim();
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  if (!BASE_URL) return value;

  // API base URLs normally end in /api or /api/v1. Images are served from the
  // backend origin, not from that API mount point.
  return new URL(value, `${new URL(BASE_URL).origin}/`).toString();
}

export function isLegacyLocalProductImageUrl(_imagePath?: string | null): boolean {
  return false;
}

function buildApiUrl(endpoint: string): string {
  if (!BASE_URL) {
    throw new Error('VITE_API_BASE_URL is not configured');
  }

  return `${BASE_URL}/${endpoint.replace(/^\/+/, '')}`;
}

const TOKEN_KEY = 'wholesaler_jwt_token';

export interface ApiErrorDetail {
  field: string;
  message: string;
  type?: string;
}

export class ApiError extends Error {
  status: number;
  code?: string;
  errors: ApiErrorDetail[];

  constructor(message: string, status: number, code?: string, errors: ApiErrorDetail[] = []) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.errors = errors;
  }
}

export type KhataBusinessType =
  | 'CLOTHING'
  | 'GENERAL_STORE'
  | 'ELECTRONICS'
  | 'FOOTWEAR'
  | 'COSMETICS'
  | 'OTHER';

export type WholesalerStoreTheme = 'DEFAULT' | 'ROYAL' | 'FESTIVE' | 'MINIMAL';

export interface KhataEntry {
  _id: string;
  date: string;
  productName: string;
  category: string;
  size: string;
  colour: string;
  unit: string;
  brandModel: string;
  counterpartyName: string;
  quantity: number;
  purchaseRate: number;
  purchaseAmount: number;
  paidAmount: number;
  pendingAmount: number;
  paymentStatus: 'PAID' | 'PARTIAL' | 'PENDING';
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface KhataSummary {
  totalPurchase: number;
  totalPaid: number;
  totalPending: number;
}

export interface KhataEntryInput {
  date: string;
  productName: string;
  category: string;
  size: string;
  colour: string;
  unit: string;
  brandModel: string;
  counterpartyName: string;
  quantity: number;
  purchaseRate: number;
  paidAmount: number;
  notes: string;
}

export interface KhataBookSettings {
  businessName: string;
  businessType: KhataBusinessType | '';
  otherBusinessType: string;
}

export interface WholesalerAnalyticsProduct {
  _id: string;
  name: string;
  sku: string;
  category: string;
  unitsSold: number;
  revenue: number;
  profit: number;
}

export interface WholesalerAnalyticsReport {
  period?: { startDate: string; endDate: string };
  growth?: {
    revenueGrowth: number;
    profitGrowth: number;
    ordersGrowth: number;
    aovGrowth: number;
    retailersGrowth: number;
  };
  insights?: {
    returnRatePercent: number;
    deliveredOrders: number;
    returnedOrders: number;
    cancelledOrders: number;
    lowStockAlerts: Array<{ _id: string; name: string; sku: string; stock: number; threshold: number }>;
    fastMovingProducts: Array<{ _id: string; name: string; sku: string; stock: number; unitsSold: number; turnoverRatio: number }>;
    slowMovingProducts: Array<{ _id: string; name: string; sku: string; stock: number; unitsSold: number; turnoverRatio: number }>;
  };
  financial: {
    revenue: number;
    profit: number;
    profitBasis: string;
    averageOrderValue: number;
    averagePaymentPerOrder: number;
    paymentsReceived: number;
    totalDiscount: number;
    creditOutstanding: number;
    overdueAmount: number;
  };
  orders: {
    total: number;
    pending?: number;
    confirmed?: number;
    shipped?: number;
    delivered?: number;
    cancelled: number;
    returned: number;
    statusBreakdown: Array<{ status: string; count: number }>;
    returnReasons: Array<{ reason: string; returns: number; units: number }>;
  };
  products: {
    count?: number;
    totalProducts?: number;
    unitsSold: number;
    byRevenue: WholesalerAnalyticsProduct[];
    byUnits: WholesalerAnalyticsProduct[];
  };
  categories: Array<{ _id: string; revenue: number; unitsSold: number }>;
  retailers: {
    connected: number;
    newConnected: number;
    top: Array<{ _id: string; name: string; orders: number; revenue: number }>;
    newRetailersTrend?: Array<{ date: string; count: number }>;
  };
  inventory: {
    unitsAdded: number;
    unitsSold: number;
    movementTrend?: Array<{ date: string; added: number; sold: number }>;
  };
  coupons: {
    totalDiscount: number;
    mostUsed: Array<{ _id: string; uses: number; discount: number }>;
  };
  trend: Array<{ date: string; revenue: number; orders: number }>;
}

export interface BulkProductUploadRow {
  rowNumber: number;
  data: Record<string, string | number | null>;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  billingPeriod: 'MONTHLY' | 'YEARLY';
  description: string;
  taxNote: string;
  isActive: boolean;
  order: number;
  recommended: boolean;
  features: Array<{ id: string; title: string; enabled: boolean; order: number }>;
}

export interface WholesalerSubscription {
  planId: string;
  planName: string;
  status: 'ACTIVE' | 'EXPIRED';
  amount: number;
  currency: string;
  billingPeriod: 'MONTHLY' | 'YEARLY';
  startedAt: string;
  renewalDate: string;
}

export interface BulkProductPreviewRow {
  rowNumber: number;
  valid: boolean;
  errors: string[];
  data: Record<string, string | number | null>;
}

export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token: string) {
  if (getAuthToken() !== token) queryClient.clear();
  if (typeof window === 'undefined') return;
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearAuthToken() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem('wholesaler_user_id');
  queryClient.clear();
}

function invalidateMutation(endpoint: string) {
  const path = endpoint.split('?')[0];
  const userId = getWholesalerId();
  if (userId === 'unknown') return;

  getWholesalerResources(path).forEach((resource) => {
    void queryClient.invalidateQueries({
      queryKey: wholesalerQueryKeys.resource(userId, resource),
    });
  });
}

function getWholesalerResources(path: string): string[] {
  if (path.startsWith('/support/tickets')) return ['support'];
  if (path.startsWith('/wholesaler/products')) return ['products', 'inventory', 'analytics'];
  if (path.startsWith('/wholesaler/categories')) return ['categories', 'products'];
  if (path.startsWith('/orders/returns') || path.startsWith('/wholesaler/returns')) return ['returns', 'orders', 'wallet'];
  if (path.startsWith('/wholesaler/orders') || path.startsWith('/orders/')) return ['orders', 'analytics', 'wallet'];
  if (path.startsWith('/wholesaler/retailers')) return ['retailers', 'credit-overview'];
  if (path.startsWith('/wholesaler/inventory')) return ['inventory', 'products', 'analytics'];
  if (path.startsWith('/wholesaler/banners') || path.startsWith('/wholesaler/store-theme')) return ['banners', 'products'];
  if (path.startsWith('/wholesaler/profile')) return ['profile'];
  if (path.startsWith('/wholesaler/khata-book')) return ['khata-book'];
  if (path.startsWith('/wholesaler/referral')) return ['referral'];
  if (path.startsWith('/wholesaler/kyc')) return ['kyc'];
  if (path.startsWith('/wholesaler/coupons')) return ['coupons'];
  if (path.startsWith('/wholesaler/credit-policy') || path.startsWith('/wholesaler/credit-overview')) return ['credit-overview'];
  if (path.startsWith('/payouts/') || path.startsWith('/wallets/')) return ['wallet'];
  if (path.startsWith('/reviews')) return ['reviews'];
  if (path.startsWith('/notifications')) return ['notifications'];
  if (path.startsWith('/wholesaler/invite-links')) return ['invite-links'];
  if (path.startsWith('/wholesaler/subscription')) return ['subscription'];
  return ['api'];
}

function isUncachedWholesalerRead(path: string): boolean {
  return path.startsWith('/auth/') ||
    /\/(payment|payments|payout|payouts|wallet|wallets|kyc|security|documents?)(\/|$|-)/i.test(path);
}

export async function request<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = buildApiUrl(endpoint);
  const token = getAuthToken();
  const method = (options.method || 'GET').toUpperCase();
  const path = endpoint.split('?')[0];

  const headers: Record<string, string> = {
    ...(typeof FormData !== 'undefined' && options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
    ...(options.headers as Record<string, string>),
  };

  const isAuthEndpoint = endpoint.startsWith('/auth/login') || endpoint.startsWith('/auth/register');
  if (token && !isAuthEndpoint) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const fetchResponse = async (): Promise<T> => {
    const response = await fetch(url, {
      ...options,
      cache: 'no-store',
      headers,
    });

    const isJson = response.headers.get('content-type')?.includes('application/json');
    const data = isJson ? await response.json() : null;

    if (!response.ok) {
      if (
        response.status === 401 &&
        typeof window !== 'undefined' &&
        !endpoint.startsWith('/auth/')
      ) {
        clearAuthToken();
        if (!window.location.pathname.startsWith('/login') && !window.location.pathname.startsWith('/register')) {
          window.location.href = '/login?expired=1';
        }
      }
      const errorMsg = data?.message || `HTTP ${response.status}: ${response.statusText}`;
      throw new ApiError(errorMsg, response.status, data?.code, data?.errors);
    }

    if (!['GET', 'HEAD'].includes(method)) invalidateMutation(endpoint);
    return data as T;
  };

  if (!['GET', 'HEAD'].includes(method)) return fetchResponse();
  if (path === '/subscription-plan') {
    return queryClient.fetchQuery({
      queryKey: ['public', 'subscription-plan'],
      queryFn: fetchResponse,
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
    });
  }
  if (!token || isUncachedWholesalerRead(path)) return fetchResponse();

  const userId = getWholesalerId();
  if (userId === 'unknown') return fetchResponse();
  const resource = getWholesalerResources(path)[0];
  return queryClient.fetchQuery({
    queryKey: wholesalerQueryKeys.resource(userId, resource, endpoint),
    queryFn: fetchResponse,
    staleTime: 30 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

export const api = {
  getKhataSettings: () =>
    request<{ success: boolean; data: KhataBookSettings }>('/wholesaler/khata-book/settings', { method: 'GET' }),
  updateKhataSettings: (settings: Pick<KhataBookSettings, 'businessType' | 'otherBusinessType'>) =>
    request<{ success: boolean; data: KhataBookSettings }>('/wholesaler/khata-book/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    }),

  getKhataEntries: (filters: Record<string, string>) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    const query = params.toString();
    return request<{ success: boolean; data: { items: KhataEntry[]; summary: KhataSummary } }>(
      `/wholesaler/khata-book${query ? `?${query}` : ''}`,
      { method: 'GET' },
    );
  },
  createKhataEntry: (entry: KhataEntryInput) =>
    request<{ success: boolean; data: KhataEntry }>('/wholesaler/khata-book', {
      method: 'POST',
      body: JSON.stringify(entry),
    }),
  updateKhataEntry: (id: string, entry: KhataEntryInput) =>
    request<{ success: boolean; data: KhataEntry }>(`/wholesaler/khata-book/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(entry),
    }),
  deleteKhataEntry: (id: string) =>
    request<{ success: boolean; data: { id: string } }>(`/wholesaler/khata-book/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),
  downloadKhataReport: async (format: 'xlsx' | 'pdf', filters: Record<string, string>): Promise<Blob> => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    const query = params.toString();
    const token = getAuthToken();
    const response = await fetch(
      buildApiUrl(`/wholesaler/khata-book/export/${format}${query ? `?${query}` : ''}`),
      { headers: token ? { Authorization: `Bearer ${token}` } : {} },
    );
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      if (response.status === 401 && typeof window !== 'undefined') {
        clearAuthToken();
        if (!window.location.pathname.startsWith('/login')) window.location.href = '/login?expired=1';
      }
      throw new ApiError(body?.message || 'Unable to download the Khata Book report.', response.status, body?.code, body?.errors);
    }
    return response.blob();
  },

  // Auth
  login: (credentials: { email?: string; loginId?: string; mobile?: string; phone?: string; password?: string; role?: string }) =>
    request<{ success: boolean; data: { token?: string; user?: any; requiresTwoFactor?: boolean; challengeToken?: string; maskedEmail?: string; resendAfterSeconds?: number } }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    }),
  resendLoginOtp: (challengeToken: string) =>
    request<{ success: boolean; data: { maskedEmail: string; resendAfterSeconds: number } }>('/auth/login/2fa/resend', {
      method: 'POST',
      body: JSON.stringify({ challengeToken }),
    }),
  verifyLoginOtp: (challengeToken: string, code: string) =>
    request<{ success: boolean; data: { token: string; user: any } }>('/auth/login/2fa/verify', {
      method: 'POST',
      body: JSON.stringify({ challengeToken, code }),
    }),
  sendTwoFactorOtp: (resend = false) =>
    request<{ success: boolean; data: { maskedEmail: string; resendAfterSeconds: number } }>(
      `/auth/2fa/enable/${resend ? 'resend' : 'send'}`,
      { method: 'POST' },
    ),
  verifyTwoFactorOtp: (code: string) =>
    request<{ success: boolean; data: { twoFactorEnabled: boolean } }>('/auth/2fa/enable/verify', {
      method: 'POST',
      body: JSON.stringify({ code }),
    }),
  disableTwoFactor: () =>
    request<{ success: boolean; data: { twoFactorEnabled: boolean } }>('/auth/2fa/disable', {
      method: 'POST',
    }),

  register: (payload: {
    name: string;
    email: string;
    password: string;
    businessName: string;
    businessLogoUrl?: string;
    phone?: string;
    address?: string;
    streetAddress?: string;
    city?: string;
    state?: string;
    pincode?: string;
    isGstRegistered?: boolean;
    gstin?: string;
    gstStatus?: string;
    sameAsBusinessAddress?: boolean;
    pickupStreetAddress?: string;
    pickupCity?: string;
    pickupState?: string;
    pickupPincode?: string;
    inviteToken?: string;
    ref?: string;
    adminCode?: string;
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
  }) =>
    request<{ success: boolean; message: string; data: { user: any; token?: string; accessToken?: string; refreshToken?: string } }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ ...payload, role: 'wholesaler' }),
    }),

  getWholesalerInvite: (token: string) =>
    request<{ success: boolean; data: { contactName: string; email: string; phone: string; businessName: string; expiresAt: string } }>(
      `/invites/wholesaler/${encodeURIComponent(token)}`,
      { method: 'GET' },
    ),

  validateAdminRef: (code: string) =>
    request<{ success: boolean; message?: string; data: { valid: boolean; isPaused?: boolean; code?: string; platformName?: string; message?: string } }>(
      `/invites/validate-ref/${encodeURIComponent(code)}`,
      { method: 'GET' },
    ),

  getMe: () =>
    request<{ success: boolean; data: any }>('/auth/me', { method: 'GET' }),

  updateStoreTheme: (activeStoreTheme: WholesalerStoreTheme) =>
    request<{ success: boolean; data: { user: any; profile: any } }>('/wholesaler/profile', {
      method: 'PATCH',
      body: JSON.stringify({ activeStoreTheme }),
    }),

  getBanners: () =>
    request<{
      success: boolean;
      data: {
        banners: any[];
        businessCategory: string;
        presetOptions: any[];
        activeStoreTheme: WholesalerStoreTheme;
        businessName: string;
      };
    }>('/wholesaler/banners', { method: 'GET' }),

  updateBanners: (banners: any[], businessCategory?: string) =>
    request<{
      success: boolean;
      data: {
        banners: any[];
        businessCategory: string;
        presetOptions: any[];
        activeStoreTheme: WholesalerStoreTheme;
        businessName: string;
      };
    }>('/wholesaler/banners', {
      method: 'PUT',
      body: JSON.stringify({ banners, businessCategory }),
    }),

  activatePreset: (presetId: string) =>
    request<{
      success: boolean;
      data: {
        banners: any[];
        businessCategory: string;
        presetOptions: any[];
        activeStoreTheme: WholesalerStoreTheme;
        businessName: string;
      };
    }>('/wholesaler/banners/activate-preset', {
      method: 'POST',
      body: JSON.stringify({ presetId }),
    }),

  updateBusinessCategory: (businessCategory: string) =>
    request<{
      success: boolean;
      data: {
        banners: any[];
        businessCategory: string;
        presetOptions: any[];
        activeStoreTheme: WholesalerStoreTheme;
        businessName: string;
      };
    }>('/wholesaler/business-category', {
      method: 'PATCH',
      body: JSON.stringify({ businessCategory }),
    }),

  getPublicSubscriptionPlan: () =>
    request<{ success: boolean; data: { plans: SubscriptionPlan[] } }>('/subscription-plan', { method: 'GET' }),

  getWholesalerSubscription: () =>
    request<{
      success: boolean;
      data: {
        plans: SubscriptionPlan[];
        subscription: WholesalerSubscription | null;
        payment: { configured: boolean };
      };
    }>('/wholesaler/subscription', { method: 'GET' }),

  createSubscriptionOrder: (planId: string) =>
    request<{
      success: boolean;
      message?: string;
      data: {
        configured: boolean;
        keyId?: string;
        order?: { id: string; amount: number; currency: string };
        plan?: SubscriptionPlan;
      };
    }>('/wholesaler/subscription/orders', { method: 'POST', body: JSON.stringify({ planId }) }),

  verifySubscriptionPayment: (payload: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) =>
    request<{ success: boolean; data: { subscription: WholesalerSubscription } }>(
      '/wholesaler/subscription/verify',
      { method: 'POST', body: JSON.stringify(payload) },
    ),

  getMyKyc: () =>
    request<{ success: boolean; data: any }>('/wholesaler/kyc', { method: 'GET' }),

  submitKyc: (data: FormData) =>
    request<{ success: boolean; data: any }>('/wholesaler/kyc', {
      method: 'POST',
      body: data,
    }),

  getKycDocument: async (documentId: string) => {
    const url = buildApiUrl(`/wholesaler/kyc/documents/${encodeURIComponent(documentId)}`);
    const token = getAuthToken();
    const response = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) throw new Error('Unable to load KYC document');
    return response.blob();
  },

  getNotifications: () =>
    request<{ success: boolean; data: any[]; meta?: any }>('/notifications', { method: 'GET' }),

  markAllNotificationsRead: () =>
    request<{ success: boolean }>('/notifications/read', { method: 'PATCH' }),

  getRetailerReferral: () =>
    request<{ success: boolean; data: { code: string; signupsEnabled: boolean; joinedCount: number } }>(
      '/wholesaler/referral',
      { method: 'GET' },
    ),

  regenerateRetailerReferral: () =>
    request<{ success: boolean; data: { code: string; signupsEnabled: boolean; joinedCount: number } }>(
      '/wholesaler/referral/regenerate',
      { method: 'POST' },
    ),

  setRetailerReferralEnabled: (enabled: boolean) =>
    request<{ success: boolean; data: { code: string; signupsEnabled: boolean; joinedCount: number } }>(
      '/wholesaler/referral',
      { method: 'PATCH', body: JSON.stringify({ enabled }) },
    ),

  // Connected Retailers
  getConnectedRetailers: () =>
    request<{ success: boolean; data: any[] }>('/wholesaler/retailers', { method: 'GET' }),

  getRetailerDetails: (relationshipId: string) =>
    request<{ success: boolean; data: any }>(`/wholesaler/retailers/${relationshipId}`, { method: 'GET' }),

  getRetailerIdentityProfile: (retailerId: string) =>
    request<{ success: boolean; data: any }>(
      `/retailer-identity/${encodeURIComponent(retailerId)}/profile`,
      { method: 'GET' },
    ),

  getFullRetailerAadhaar: (retailerId: string) =>
    request<{ success: boolean; data: { number: string } }>(
      `/retailer-identity/${encodeURIComponent(retailerId)}/aadhaar`,
      { method: 'GET' },
    ),

  updateRetailerVerification: (retailerId: string, status: 'VERIFIED' | 'REJECTED', note = '') =>
    request<{ success: boolean; data: { verificationStatus: string; verificationNote: string } }>(
      `/retailer-identity/${encodeURIComponent(retailerId)}/verification`,
      { method: 'PATCH', body: JSON.stringify({ status, note }) },
    ),

  getRetailerDocument: async (retailerId: string, documentType: string): Promise<Blob> => {
    const url = buildApiUrl(`/retailer-identity/${encodeURIComponent(retailerId)}/documents/${encodeURIComponent(documentType)}`);
    const token = getAuthToken();
    const response = await fetch(url, {
      cache: 'no-store',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) {
      let message = `Unable to load retailer document (HTTP ${response.status}).`;
      try {
        const data = await response.json();
        message = data?.message || message;
      } catch {
        // Keep the status-based error message when the server does not return JSON.
      }
      throw new ApiError(message, response.status);
    }
    return response.blob();
  },

  // Categories
  getCategories: () =>
    request<{ success: boolean; data: any }>('/wholesaler/categories', { method: 'GET' }),

  createCategory: (data: { name: string; description?: string; imageUrl?: string; parentId?: string | null }) =>
    request<{ success: boolean; data: any }>('/wholesaler/categories', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateCategory: (id: string, data: { name?: string; description?: string; imageUrl?: string; parentId?: string | null }) =>
    request<{ success: boolean; data: any }>(`/wholesaler/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteCategory: (id: string) =>
    request<{ success: boolean }>(`/wholesaler/categories/${id}`, { method: 'DELETE' }),

  // Products
  getProducts: () =>
    request<{ success: boolean; data: any[] }>('/wholesaler/products', { method: 'GET' }),

  previewBulkProducts: (rows: BulkProductUploadRow[]) =>
    request<{ success: boolean; data: { rows: BulkProductPreviewRow[] } }>('/wholesaler/products/bulk/preview', {
      method: 'POST',
      body: JSON.stringify({ rows }),
    }),

  importBulkProducts: (rows: BulkProductUploadRow[]) =>
    request<{ success: boolean; data: { imported: Array<{ rowNumber: number; productId: string }>; rejected: Array<{ rowNumber: number; errors: string[] }> } }>('/wholesaler/products/bulk/import', {
      method: 'POST',
      body: JSON.stringify({ rows }),
    }),

  downloadBulkProductTemplate: async (category: string): Promise<Blob> => {
    const url = buildApiUrl(`/wholesaler/products/bulk/template?category=${encodeURIComponent(category)}`);
    const token = getAuthToken();
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = 'Bearer ' + token;
    const response = await fetch(url, {
      headers,
    });
    if (!response.ok) {
      if (response.status === 401 && typeof window !== 'undefined') {
        clearAuthToken();
        if (!window.location.pathname.startsWith('/login')) {
          window.location.href = '/login?expired=1';
        }
      }
      const data = await response.json();
      throw new Error(data?.message || 'Could not create the Excel template.');
    }
    return response.blob();
  },

  uploadProductImages: async (files: FileList | File[]) => {
    const formData = new FormData();
    Array.from(files).forEach((file) => formData.append('images', file));
    
    const url = buildApiUrl('/wholesaler/products/upload');
    const token = getAuthToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(url, { method: 'POST', headers, body: formData });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.message || 'Upload failed');
    return data;
  },

  createProduct: (data: any) =>
    request<{ success: boolean; data: any }>('/wholesaler/products', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateProduct: (id: string, data: any) =>
    request<{ success: boolean; data: any }>(`/wholesaler/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteProduct: (id: string) =>
    request<{ success: boolean }>(`/wholesaler/products/${id}`, { method: 'DELETE' }),

  // Orders
  getOrders: () =>
    request<{ success: boolean; data: any }>('/orders', { method: 'GET' }),

  updateOrderStatus: (id: string, status: string) =>
    request<{ success: boolean; data: any }>(`/orders/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  // Inventory
  adjustInventory: (productId: string, data: { quantity: number; notes?: string }) =>
    request<{ success: boolean; data: any }>(`/wholesaler/inventory/${productId}/adjustments`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Returns
  getReturns: () =>
    request<{ success: boolean; data: any; meta?: any }>('/orders/returns/all', { method: 'GET' }),

  updateReturnStatus: (id: string, status: string, adminNotes?: string) =>
    request<{ success: boolean; data: any }>(`/orders/returns/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, adminNotes }),
    }),

  // Wallet
  getWallet: () =>
    request<{ success: boolean; data: any }>('/wallets/me', { method: 'GET' }),
    
  getWalletTransactions: () =>
    request<{ success: boolean; data: any[] }>('/wallets/transactions', { method: 'GET' }),

  submitFeedback: (data: { title?: string; comment: string; rating: number; productId?: string }) =>
    request<{ success: boolean; data: any }>('/support/tickets', {
      method: 'POST',
      body: JSON.stringify({
        type: 'Feedback',
        subject: data.title?.trim() || 'Wholesaler Partner Feedback',
        message: `Rating: ${data.rating}/5\n\n${data.comment.trim()}`,
      }),
    }),

  submitSupportTicket: (data: {
    type: string;
    subject: string;
    message: string;
    priority?: string;
    relatedOrderId?: string;
    attachments?: Array<{ url: string; publicId?: string }>;
  }) =>
    request<{ success: boolean; data: any }>('/support/tickets', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getMySupportTickets: () =>
    request<{ success: boolean; data: any[] }>('/support/tickets/mine', { method: 'GET' }),

  getSupportTicket: (ticketId: string) =>
    request<{ success: boolean; data: any }>(`/support/tickets/${encodeURIComponent(ticketId)}`, { method: 'GET' }),

  replySupportTicket: (ticketId: string, message: string) =>
    request<{ success: boolean; data: any }>(`/support/tickets/${encodeURIComponent(ticketId)}/reply`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    }),

  markSupportTicketRead: (ticketId: string) =>
    request<{ success: boolean; data: any }>(`/support/tickets/${encodeURIComponent(ticketId)}/read`, {
      method: 'PATCH',
      body: JSON.stringify({}),
    }),

  uploadSupportAttachments: async (files: FileList | File[]) => {
    const formData = new FormData();
    Array.from(files).forEach((file) => formData.append('images', file));
    const token = getAuthToken();
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(buildApiUrl('/support/tickets/attachments'), {
      method: 'POST',
      headers,
      body: formData,
    });
    const data = await response.json();
    if (!response.ok) throw new ApiError(data?.message || 'Support image upload failed', response.status, data?.code, data?.errors);
    return data as { success: boolean; data: Array<{ url: string; publicId: string }> };
  },

  // Coupons
  validateCoupon: (code: string, planAmount: number, planType?: string) =>
    request<{
      success: boolean;
      data: {
        valid: boolean;
        code: string;
        title: string;
        discountType: string;
        discountValue: number;
        discountAmount: number;
        originalAmount: number;
        netPrice: number;
        couponId: string;
      };
    }>('/admin/coupons/validate', {
      method: 'POST',
      body: JSON.stringify({ code, planAmount, planType }),
    }),

  // Help Request
  submitHelpRequest: (data: { subject?: string; message: string; callbackPhone?: string }) =>
    request<{ success: boolean; data: any }>('/support/tickets', {
      method: 'POST',
      body: JSON.stringify({
        type: 'Request',
        subject: data.subject?.trim() || 'Super Admin Help Request',
        message: data.message.trim(),
        priority: 'High',
        callbackPhone: data.callbackPhone?.trim(),
      }),
    }),

  // Credit Policy & Overview
  getCreditPolicy: () =>
    request<{ success: boolean; data: any }>('/wholesaler/credit-policy', { method: 'GET' }),

  updateCreditPolicy: (data: {
    creditEnabled: boolean;
    defaultCreditLimit: number;
    creditPeriodDays: number;
    lateFeePercent: number;
    minOrderForCredit: number;
  }) =>
    request<{ success: boolean; data: any }>('/wholesaler/credit-policy', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  setRetailerCreditLimit: (retailerId: string, customCreditLimit: number | null) =>
    request<{ success: boolean; data: any }>(`/wholesaler/retailers/${retailerId}/credit-limit`, {
      method: 'PATCH',
      body: JSON.stringify({ customCreditLimit }),
    }),

  updateRetailerCreditPolicy: (retailerId: string, data: {
    status?: 'DISABLED' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
    creditEnabled?: boolean;
    customCreditLimit?: number | null;
    creditPeriodDays?: number;
  }) =>
    request<{ success: boolean; data: any }>(`/wholesaler/retailers/${retailerId}/credit-policy`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  getPaymentSettings: () =>
    request<{ success: boolean; data: any }>('/wholesaler/payment-settings', { method: 'GET' }),
  updatePaymentSettings: (data: FormData) =>
    request<{ success: boolean; data: any }>('/wholesaler/payment-settings', {
      method: 'PATCH',
      body: data,
    }),
  getPaymentReports: () =>
    request<{ success: boolean; data: any[] }>('/wholesaler/payment-reports', { method: 'GET' }),
  reviewPaymentReport: (reportId: string, action: 'VERIFY' | 'REJECT', note = '') =>
    request<{ success: boolean; data: any }>(`/wholesaler/payment-reports/${reportId}`, {
      method: 'PATCH',
      body: JSON.stringify({ action, note }),
    }),
  getPaymentReportScreenshot: async (reportId: string) => {
    const url = buildApiUrl(`/wholesaler/payment-reports/${encodeURIComponent(reportId)}/screenshot`);
    const token = getAuthToken();
    const response = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (!response.ok) throw new Error('Unable to load payment evidence.');
    return URL.createObjectURL(await response.blob());
  },

  getCreditOverview: () =>
    request<{ success: boolean; data: any }>('/wholesaler/credit-overview', { method: 'GET' }),

  getWholesalerAnalytics: (query?: { startDate?: string; endDate?: string } | string, endDateParam?: string) => {
    const params = new URLSearchParams();
    if (typeof query === 'string') {
      if (query) params.append('startDate', query);
      if (endDateParam) params.append('endDate', endDateParam);
    } else if (query) {
      if (query.startDate) params.append('startDate', query.startDate);
      if (query.endDate) params.append('endDate', query.endDate);
    }
    const queryString = params.toString();
    return request<{ success: boolean; data: { report: WholesalerAnalyticsReport } }>(
      `/wholesaler/analytics${queryString ? `?${queryString}` : ''}`,
      { method: 'GET' }
    );
  },

  downloadWholesalerAnalyticsCsv: async (startDate: string, endDate: string, sections: string[]) => {
    const params = new URLSearchParams({
      startDate,
      endDate,
      sections: sections.join(','),
    });
    const endpoint = `/wholesaler/analytics/export?${params.toString()}`;
    const token = getAuthToken();
    const response = await fetch(
      buildApiUrl(endpoint),
      { headers: token ? { Authorization: `Bearer ${token}` } : {} }
    );

    if (!response.ok) {
      if (response.status === 401 && typeof window !== 'undefined') {
        clearAuthToken();
        if (!window.location.pathname.startsWith('/login')) {
          window.location.href = '/login?expired=1';
        }
      }
      const contentType = response.headers.get('content-type') || '';
      const errorBody = contentType.includes('application/json')
        ? await response.json()
        : await response.text();
      const message = typeof errorBody === 'string'
        ? errorBody || `HTTP ${response.status}: ${response.statusText}`
        : errorBody?.message || `HTTP ${response.status}: ${response.statusText}`;
      throw new Error(message);
    }

    return response.blob();
  },

  // Wholesaler Coupons & Offers
  getWholesalerCoupons: () =>
    request<{ success: boolean; data: any[] }>('/wholesaler/coupons', { method: 'GET' }),

  createWholesalerCoupon: (data: any) =>
    request<{ success: boolean; data: any }>('/wholesaler/coupons', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateWholesalerCoupon: (id: string, data: any) =>
    request<{ success: boolean; data: any }>(`/wholesaler/coupons/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  toggleWholesalerCoupon: (id: string) =>
    request<{ success: boolean; data: any }>(`/wholesaler/coupons/${id}/toggle`, {
      method: 'PATCH',
    }),

  deleteWholesalerCoupon: (id: string) =>
    request<{ success: boolean }>(`/wholesaler/coupons/${id}`, {
      method: 'DELETE',
    }),
};

export default api;
