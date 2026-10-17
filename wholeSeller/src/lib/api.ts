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

  let resources: string[] = [];
  if (path.startsWith('/support/tickets')) resources = ['support'];
  else if (path.startsWith('/wholesaler/products')) resources = ['products', 'inventory', 'analytics'];
  else if (path.startsWith('/wholesaler/categories')) resources = ['categories', 'products'];
  else if (path.startsWith('/orders/returns') || path.startsWith('/wholesaler/returns')) resources = ['returns', 'orders'];
  else if (path.startsWith('/wholesaler/orders') || path.startsWith('/orders/')) resources = ['orders', 'analytics'];
  else if (path.startsWith('/wholesaler/retailers')) resources = ['retailers', 'credit-overview'];
  else if (path.startsWith('/wholesaler/inventory')) resources = ['inventory', 'products', 'analytics'];
  else if (path.startsWith('/wholesaler/kyc')) resources = ['kyc'];
  else if (path.startsWith('/wholesaler/coupons')) resources = ['coupons'];
  else if (path.startsWith('/wholesaler/credit-policy')) resources = ['credit-overview'];
  else if (path.startsWith('/wholesaler/credit/settle-order')) resources = ['credit-overview', 'orders', 'wallet', 'analytics'];
  else if (path.startsWith('/reviews')) resources = ['reviews'];
  else if (path.startsWith('/notifications')) resources = ['notifications'];
  else if (path.startsWith('/wholesaler/invite-links')) resources = ['invite-links'];

  resources.forEach((resource) => {
    void queryClient.invalidateQueries({
      queryKey: wholesalerQueryKeys.resource(userId, resource),
    });
  });
}

export async function request<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = buildApiUrl(endpoint);
  const token = getAuthToken();

  const headers: Record<string, string> = {
    ...(typeof FormData !== 'undefined' && options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
    ...(options.headers as Record<string, string>),
  };

  const isAuthEndpoint = endpoint.startsWith('/auth/login') || endpoint.startsWith('/auth/register');
  if (token && !isAuthEndpoint) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
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

  if (!['GET', 'HEAD'].includes((options.method || 'GET').toUpperCase())) {
    invalidateMutation(endpoint);
  }

  return data;
}

export const api = {
  // Auth
  login: (credentials: { email?: string; loginId?: string; mobile?: string; phone?: string; password?: string; role?: string }) =>
    request<{ success: boolean; data: { token: string; user: any } }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
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
    request<{ success: boolean; message: string; data: { token: string; accessToken: string; refreshToken: string; user: any } }>('/auth/register', {
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

  settleOrderCredit: (orderId: string) =>
    request<{ success: boolean; data: any }>(`/wholesaler/credit/settle-order/${orderId}`, {
      method: 'POST',
    }),

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
