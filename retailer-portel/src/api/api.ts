// Central API service for NEXORA Retailer Portal
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const TOKEN_KEY = 'nexora_jwt_token';

export type ApiEnvelope<T> = {
  success: boolean;
  message?: string;
  data: T;
  meta?: Record<string, unknown>;
};

export type RetailerUser = {
  _id?: string;
  id?: string;
  name?: string;
  email?: string;
  phone?: string;
  role?: string;
  status?: string;
  retailerProfile?: Record<string, unknown>;
  wholesalerProfile?: Record<string, unknown>;
  businessName?: string;
};

export type ApiProduct = {
  _id?: string;
  id?: string;
  name?: string;
  title?: string;
  brand?: string;
  category?: { _id?: string; name?: string; slug?: string } | string;
  categoryId?: string;
  subcategoryId?: string;
  wholesalerId?: string;
  wholesalePrice?: number;
  retailerPrice?: number;
  mrp?: number;
  price?: number;
  minOrderQty?: number;
  moq?: number;
  quantity?: number;
  stock?: number;
  imageUrl?: string;
  images?: string[];
  description?: string;
  unit?: string;
  status?: string;
  pricingTiers?: Array<{ id: string; minQty: number; pricePerUnit: number }>;
  sizes?: string[];
  colors?: string[];
  additionalOptions?: Array<{ name: string; value: string }>;
  categoryAttributes?: Record<string, any>;
};

export type ApiCategory = {
  _id?: string;
  id?: string;
  name?: string;
  slug?: string;
  description?: string;
  count?: number;
  imageUrl?: string;
};

export type ApiWholesaler = {
  id?: string;
  _id?: string;
  name?: string;
  email?: string;
  phone?: string;
  businessName?: string;
  businessLogoUrl?: string;
  description?: string;
  address?: Record<string, string>;
  minOrderValue?: number;
  rating?: number;
  relationshipStatus?: string;
};

export type ApiOrder = {
  _id?: string;
  id?: string;
  orderNumber?: string;
  orderStatus?: string;
  status?: string;
  wholesalerId?: string;
  retailerId?: string;
  grandTotal?: number;
  total?: number;
  createdAt?: string;
  paymentMethod?: string;
  paymentMode?: string;
  isCreditOrder?: boolean;
  creditDueDate?: string;
  creditPeriodDays?: number;
  creditPaymentStatus?: "PENDING" | "PAID" | "OVERDUE";
  creditSettledAt?: string;
  cancellationReason?: string;
  cancellationNote?: string;
  items?: Array<{
    productId: string | any;
    quantity: number;
    pricePerUnit?: number;
    price?: number;
    name?: string;
    imageUrl?: string;
    subtotal?: number;
    total?: number;
    sku?: string;
  }>;
};

export type ApiNotification = {
  _id?: string;
  id?: string;
  title?: string;
  message?: string;
  body?: string;
  isRead?: boolean;
  read?: boolean;
  createdAt?: string;
};

export type ApiAddress = {
  _id?: string;
  id?: string;
  fullName?: string;
  name?: string;
  phone?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  pincode?: string;
  country?: string;
  isDefault?: boolean;
  type?: string;
};

export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearAuthToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  data: unknown;
  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

function buildQueryString(params?: Record<string, string | number | boolean | null | undefined>) {
  const search = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    search.set(key, String(value));
  });
  const queryString = search.toString();
  return queryString ? `?${queryString}` : '';
}

async function request<T = unknown>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${BASE_URL.replace(/\/+$/, '')}/${endpoint.replace(/^\/+/, '')}`;
  const token = getAuthToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> | undefined),
  };

  if (!headers['Content-Type'] && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    cache: 'no-store', // Prevent browser caching across sessions (critical for data isolation)
    ...options,
    headers,
  });

  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await response.json() : null;

  if (!response.ok) {
    if (response.status === 401) {
      clearAuthToken();
    }
    const errorMessage = data?.message || `HTTP ${response.status}: ${response.statusText}`;
    throw new ApiError(errorMessage, response.status, data);
  }

  return (data ?? null) as T;
}

export const api = {
  login: (credentials: { email?: string; loginId?: string; phone?: string; mobile?: string; password?: string }) =>
    request<ApiEnvelope<{ token?: string; accessToken?: string; user?: RetailerUser }>>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    }),

  logout: () => request('/auth/logout', { method: 'POST' }),

  register: (payload: {
    name: string;
    email: string;
    password: string;
    phone?: string;
    role?: string;
    businessName?: string;
    businessType?: string;
    address?: string;
    city?: string;
    state?: string;
    pincode?: string;
    gstStatus?: string;
    gstin?: string;
    gstNumber?: string;
    inviteToken?: string;
    referralCode?: string;
  }) =>
    request<ApiEnvelope<{ user?: RetailerUser }>>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ ...payload, role: payload.role || 'retailer' }),
    }),

  getMe: () => request<ApiEnvelope<RetailerUser>>('/auth/me', { method: 'GET' }),

  getDashboard: () => request<ApiEnvelope<any>>('/retailer/dashboard', { method: 'GET' }),

  getConnectedWholesaler: () => request<ApiEnvelope<ApiWholesaler | null>>('/retailer/wholesaler', { method: 'GET' }),

  getCreditInfo: () =>
    request<ApiEnvelope<{
      wholesalerId?: string;
      creditEnabled: boolean;
      defaultCreditLimit: number;
      customCreditLimit?: number | null;
      effectiveLimit: number;
      currentOutstandingAmount: number;
      availableCredit: number;
      creditPeriodDays: number;
      lateFeePercent: number;
      minOrderForCredit: number;
    }>>('/retailer/credit-info', { method: 'GET' }),

  updateBusinessProfile: (payload: {
    businessName: string;
    ownerName: string;
    phone?: string;
    businessType?: string;
    category?: string;
    address?: string;
    city?: string;
    state?: string;
    pincode?: string;
    gstStatus?: string;
    gstin?: string;
    gstNumber?: string;
  }) =>
    request<ApiEnvelope<any>>('/retailer/profile/business', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  getConnections: () => request<ApiEnvelope<any[]>>('/retailer/connections', { method: 'GET' }),

  getStore: () => request<ApiEnvelope<any>>('/retailer/store', { method: 'GET' }),

  getCategories: (params?: Record<string, string | number | boolean | null | undefined>) =>
    request<ApiEnvelope<ApiCategory[]> & { meta?: Record<string, unknown> }>(`/retailer/categories${buildQueryString(params)}`, { method: 'GET' }),

  getProducts: (params?: Record<string, string | number | boolean | null | undefined>) =>
    request<ApiEnvelope<ApiProduct[]> & { meta?: Record<string, unknown> }>(`/retailer/products${buildQueryString(params)}`, { method: 'GET' }),

  getProductById: (productId: string) => request<ApiEnvelope<{ product: ApiProduct; inventory?: unknown }>>(`/retailer/products/${productId}`, { method: 'GET' }),

  getCart: () => request<ApiEnvelope<any>>('/retailer/cart', { method: 'GET' }),

  addToCart: (productId: string, quantity = 1) =>
    request<ApiEnvelope<any>>('/retailer/cart', {
      method: 'POST',
      body: JSON.stringify({ productId, quantity }),
    }),

  updateCartItem: (itemId: string, quantity: number) =>
    request<ApiEnvelope<any>>(`/retailer/cart/items/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify({ quantity }),
    }),

  removeCartItem: (itemId: string) =>
    request<ApiEnvelope<any>>(`/retailer/cart/items/${itemId}`, { method: 'DELETE' }),

  clearCart: () => request<ApiEnvelope<any>>('/retailer/cart', { method: 'DELETE' }),

  getWishlist: () => request<ApiEnvelope<any>>('/retailer/wishlist', { method: 'GET' }),
  addToWishlist: (productId: string) => request<ApiEnvelope<any>>('/retailer/wishlist', { method: 'POST', body: JSON.stringify({ productId }) }),
  removeFromWishlist: (productId: string) => request<ApiEnvelope<any>>(`/retailer/wishlist/${productId}`, { method: 'DELETE' }),

  checkout: (payload: {
    items?: Array<{ productId: string; quantity: number }>;
    shippingAddress: {
      addressLine1: string;
      city: string;
      state: string;
      postalCode?: string;
      pincode?: string;
      country?: string;
      contactName?: string;
      phone?: string;
      addressLine2?: string;
    };
    paymentMethod?: string;
    idempotencyKey?: string;
    notes?: string; 
  }) =>
    request<ApiEnvelope<any>>('/retailer/checkout', {
      method: 'POST',
      headers: { 'Idempotency-Key': payload.idempotencyKey || `retailer-checkout-${Date.now()}-${Math.random().toString(36).slice(2)}` },
      body: JSON.stringify({
        ...payload,
        paymentMethod: payload.paymentMethod || 'COD',
      }),
    }),

  getOrders: (params?: Record<string, string | number | boolean | null | undefined>) =>
    request<ApiEnvelope<ApiOrder[]> & { meta?: Record<string, unknown> }>(`/retailer/orders${buildQueryString(params)}`, { method: 'GET' }),

  getReturns: () => request<ApiEnvelope<any[]>>('/retailer/returns', { method: 'GET' }),

  createReturn: (payload: { orderId: string; items: { productId: string; quantity: number }[]; reason: string; note?: string; images?: string[] }) =>
    request<ApiEnvelope<any>>('/retailer/returns', { method: 'POST', body: JSON.stringify(payload) }),

  getOrderById: (orderId: string) => request<ApiEnvelope<{ order: any; payment?: any }>>(`/retailer/orders/${orderId}`, { method: 'GET' }),

  cancelOrder: (orderId: string, reason: string, note?: string) =>
    request<ApiEnvelope<any>>(`/retailer/orders/${orderId}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason, note }),
    }),

  getAddresses: () => request<ApiEnvelope<ApiAddress[]>>('/retailer/addresses', { method: 'GET' }),

  createAddress: (address: Partial<ApiAddress>) =>
    request<ApiEnvelope<ApiAddress>>('/retailer/addresses', {
      method: 'POST',
      body: JSON.stringify(address),
    }),

  updateAddress: (addressId: string, address: Partial<ApiAddress>) =>
    request<ApiEnvelope<ApiAddress>>(`/retailer/addresses/${addressId}`, {
      method: 'PATCH',
      body: JSON.stringify(address),
    }),

  deleteAddress: (addressId: string) => request<ApiEnvelope<{ message?: string }>>(`/retailer/addresses/${addressId}`, { method: 'DELETE' }),

  setDefaultAddress: (addressId: string) => request<ApiEnvelope<ApiAddress>>(`/retailer/addresses/${addressId}/default`, { method: 'PATCH' }),

  getNotifications: () => request<ApiEnvelope<any[]>>('/retailer/notifications', { method: 'GET' }),

  markNotificationRead: (notificationId: string) => request<ApiEnvelope<any>>(`/retailer/notifications/${notificationId}/read`, { method: 'PATCH' }),

  markNotificationsRead: () => request<ApiEnvelope<any>>('/retailer/notifications/read-all', { method: 'PATCH' }),

  getPayments: () => request<ApiEnvelope<any[]>>('/retailer/payments', { method: 'GET' }),

  getTransactions: () => request<ApiEnvelope<any[]>>('/retailer/transactions', { method: 'GET' }),

  submitFeedback: (payload: { title?: string; comment: string; rating: number; wholesalerId?: string; productId?: string }) =>
    request<ApiEnvelope<any>>('/reviews', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Retailer Coupons & Offers
  getCoupons: () => request<ApiEnvelope<any[]>>('/retailer/coupons', { method: 'GET' }),

  validateCoupon: (payload: { code: string; wholesalerId?: string; subtotal: number }) =>
    request<ApiEnvelope<{
      valid: boolean;
      coupon: {
        _id: string;
        code: string;
        title: string;
        description?: string;
        discountType: string;
        discountValue: number;
        minOrderValue: number;
        maxDiscountCap: number;
      };
      discountAmount: number;
      finalTotal: number;
    }>>('/retailer/coupons/validate', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Invitations
  acceptInvitation: (inviteToken: string) =>
    request<ApiEnvelope<any>>('/retailer/invitations/accept', {
      method: 'POST',
      body: JSON.stringify({ inviteToken }),
    }),
};

export default api;
