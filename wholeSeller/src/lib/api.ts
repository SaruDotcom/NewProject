const BASE_URL = import.meta.env.VITE_API_BASE_URL?.replace(/\/+$/, '');

function buildApiUrl(endpoint: string): string {
  if (!BASE_URL) {
    throw new Error('VITE_API_BASE_URL is not configured');
  }

  return `${BASE_URL}/${endpoint.replace(/^\/+/, '')}`;
}

const TOKEN_KEY = 'wholesaler_jwt_token';
export const DEMO_AUTH_TOKEN = 'demo-wholesaler-token';

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

export function isDemoAuthToken(token: string | null): boolean {
  return token === DEMO_AUTH_TOKEN;
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
}

export async function request<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = buildApiUrl(endpoint);
  const token = getAuthToken();

  const headers: Record<string, string> = {
    ...(typeof FormData !== 'undefined' && options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const isJson = response.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await response.json() : null;

  if (!response.ok) {
    if (response.status === 401 && typeof window !== 'undefined' && !endpoint.includes('/auth/login')) {
      clearAuthToken();
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login?expired=1';
      }
    }
    const errorMsg = data?.message || `HTTP ${response.status}: ${response.statusText}`;
    throw new Error(errorMsg);
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
  }) =>
    request<{ success: boolean; message: string; data: { user: any } }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ ...payload, role: 'wholesaler' }),
    }),

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

  // Invite links
  createInviteLink: () =>
    request<{ success: boolean; data: any }>('/wholesaler/invite-links', { method: 'POST' }),

  getInviteLinks: () =>
    request<{ success: boolean; data: any[] }>('/wholesaler/invite-links', { method: 'GET' }),

  // Connected Retailers
  getConnectedRetailers: () =>
    request<{ success: boolean; data: any[] }>('/wholesaler/retailers', { method: 'GET' }),

  getRetailerDetails: (relationshipId: string) =>
    request<{ success: boolean; data: any }>(`/wholesaler/retailers/${relationshipId}`, { method: 'GET' }),

  resetRetailerPassword: (relationshipId: string, password: string) =>
    request<{ success: boolean; data: any }>(`/wholesaler/retailers/${relationshipId}/password`, {
      method: 'PATCH',
      body: JSON.stringify({ password }),
    }),

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
    request<{ success: boolean; data: any }>('/reviews', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

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
    request<{ success: boolean; data: any }>('/wholesaler/help-center', {
      method: 'POST',
      body: JSON.stringify(data),
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
