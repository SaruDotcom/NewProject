// Central API service for NEXORA Retailer Portal
import { queryClient, retailerQueryKeys } from "@/lib/query-client";
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';
const TOKEN_KEY = 'nexora_jwt_token';
const USER_ID_KEY = 'nexora_retailer_user_id';

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
  wholesalerId?: string | { _id?: string; id?: string; name?: string };
  wholesalePrice?: number;
  retailerPrice?: number;
  mrp?: number;
  price?: number;
  minOrderQty?: number;
  moq?: number;
  quantity?: number;
  stock?: number;
  imageUrl?: string;
  images?: Array<string | { url?: string; publicId?: string }>;
  sizeChart?: {
    unit: 'inch' | 'cm' | string;
    measurements: Array<{ size: string; measurements: Record<string, number> }>;
  } | null;
  description?: string;
  unit?: string;
  status?: string;
  pricingTiers?: Array<{ id: string; minQty: number; pricePerUnit: number }>;
  sizes?: string[];
  colors?: string[];
  colorVariants?: Array<{
    color?: string;
    name?: string;
    sku?: string;
    images?: Array<string | { url?: string; publicId?: string }>;
  }>;
  colorVariants?: Array<{ color: string; sku?: string; images?: string[] }>;
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

export type ApiBannerSlide = {
  id?: string;
  _id?: string;
  title: string;
  subtitle?: string;
  tag?: string;
  discountBadge?: string;
  imageUrl?: string;
  ctaText?: string;
  ctaLink?: string;
  category?: string;
  active?: boolean;
  order?: number;
};

export type ApiWholesaler = {
  id?: string;
  _id?: string;
  name?: string;
  email?: string;
  phone?: string;
  businessName?: string;
  businessCategory?: string;
  businessLogoUrl?: string;
  activeStoreTheme?: "DEFAULT" | "ROYAL" | "FESTIVE" | "MINIMAL";
  banners?: ApiBannerSlide[];
  description?: string;
  address?: Record<string, string>;
  minOrderValue?: number;
  rating?: number;
  relationshipStatus?: string;
  status?: string;
  available?: boolean;
  unavailableMessage?: string;
  categoryDetails?: ApiCategory[];
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
    hsnCode?: string;
    cgst?: number | null;
    sgst?: number | null;
    igst?: number | null;
    gstAmount?: number;
    priceIncludesTax?: boolean;
  }>;
};

export type ApiOrderListData = {
  items: ApiOrder[];
  pagination?: Record<string, unknown>;
  filters?: Record<string, unknown>;
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
  if (getAuthToken() !== token) {
    queryClient.clear();
    localStorage.removeItem(USER_ID_KEY);
  }
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearAuthToken() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_ID_KEY);
  queryClient.clear();
}

function invalidateMutation(endpoint: string) {
  const path = endpoint.split('?')[0];
  const userId = localStorage.getItem(USER_ID_KEY);
  if (!userId) return;

  getRetailerResources(path).forEach((resource) => {
    void queryClient.invalidateQueries({
      queryKey: retailerQueryKeys.resource(userId, resource),
    });
  });
}

function getRetailerResources(path: string): string[] {
  if (path.startsWith("/retailer/cart")) return ["cart"];
  if (path.startsWith("/retailer/wishlist")) return ["wishlist"];
  if (path === "/retailer/checkout") return ["cart", "orders", "dashboard"];
  if (path.startsWith("/retailer/payments/reports")) {
    return ["payment-reports", "orders", "credit"];
  }
  if (path === "/retailer/credit-request") return ["credit"];
  if (path.startsWith("/retailer/orders")) return ["orders", "dashboard"];
  if (path.startsWith("/retailer/returns")) return ["returns", "orders"];
  if (
    path.startsWith("/retailer/profile") ||
    path.startsWith("/retailer-identity/")
  ) {
    return ["profile", "dashboard"];
  }
  if (path.startsWith("/retailer/addresses")) return ["addresses"];
  if (path.startsWith("/retailer/notifications")) return ["notifications"];
  if (path.startsWith("/retailer/invitations")) {
    return ["wholesaler", "products", "categories", "dashboard"];
  }
  if (path.startsWith("/support/tickets")) return ["support"];
  if (path.startsWith("/reviews")) return ["reviews"];
  if (path.startsWith("/retailer/dashboard")) return ["dashboard"];
  if (
    path.startsWith("/retailer/wholesaler") ||
    path.startsWith("/retailer/store") ||
    path.startsWith("/retailer/connections")
  ) {
    return ["wholesaler"];
  }
  if (path.startsWith("/retailer/categories")) return ["categories"];
  if (path.startsWith("/retailer/products")) return ["products"];
  if (path.startsWith("/retailer/coupons")) return ["coupons"];
  if (path.startsWith("/retailer/credit-info")) return ["credit"];
  return ["api"];
}

function isUncachedRetailerRead(path: string): boolean {
  return (
    path.startsWith("/auth/") ||
    path.startsWith("/retailer-identity/") ||
    /^\/retailer\/orders\/[^/]+/.test(path) ||
    /\/(payment|payments|checkout|transaction|transactions|document|documents|aadhaar|pan)(\/|$|-)/i.test(
      path,
    )
  );
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
  const method = (options.method || "GET").toUpperCase();
  const path = endpoint.split("?")[0];
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> | undefined),
  };

  if (!headers["Content-Type"] && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const fetchResponse = async (): Promise<T> => {
    const response = await fetch(url, {
      cache: "no-store",
      ...options,
      headers,
    });

    const contentType = response.headers.get("content-type") || "";
    const data = contentType.includes("application/json")
      ? await response.json()
      : null;

    if (!response.ok) {
      if (response.status === 401) clearAuthToken();
      const validationDetails = Array.isArray(data?.errors)
        ? data.errors
            .map((item: { field?: string; message?: string }) =>
              [item.field, item.message].filter(Boolean).join(": "),
            )
            .filter(Boolean)
            .join("; ")
        : "";
      const errorMessage = validationDetails
        ? `${data?.message || "Request validation failed"}: ${validationDetails}`
        : data?.message || `HTTP ${response.status}: ${response.statusText}`;
      throw new ApiError(errorMessage, response.status, data);
    }

    if (!["GET", "HEAD"].includes(method)) invalidateMutation(endpoint);
    return (data ?? null) as T;
  };

  if (
    !["GET", "HEAD"].includes(method) ||
    !token ||
    isUncachedRetailerRead(path)
  ) {
    return fetchResponse();
  }

  const userId = localStorage.getItem(USER_ID_KEY);
  if (!userId) return fetchResponse();
  const resource = getRetailerResources(path)[0];
  return queryClient.fetchQuery({
    queryKey: retailerQueryKeys.resource(userId, resource, endpoint),
    queryFn: fetchResponse,
    staleTime: 30 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

export const api = {
  login: (credentials: { email?: string; loginId?: string; phone?: string; mobile?: string; password?: string }) =>
    request<ApiEnvelope<{ token?: string; accessToken?: string; user?: RetailerUser }>>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    }),

  logout: () => request('/auth/logout', { method: 'POST' }),

  getReferral: (code: string) => {
    const normalizedCode = code.trim().toUpperCase();
    return queryClient.fetchQuery({
      queryKey: ['public', 'referral', normalizedCode],
      queryFn: () =>
        request<ApiEnvelope<{ wholesaler: ApiWholesaler & { businessName: string; logo: string; city: string; categories?: string[] } }>>(
          `/referral/${encodeURIComponent(normalizedCode)}`,
          { method: 'GET' },
        ),
      staleTime: 30_000,
      gcTime: 10 * 60 * 1000,
      retry: false,
    });
  },

  getReferralProducts: (code: string, params?: Record<string, string | number | boolean | null | undefined>) => {
    const normalizedCode = code.trim().toUpperCase();
    return queryClient.fetchQuery({
      queryKey: ['public', 'referral-products', normalizedCode, params],
      queryFn: () =>
        request<ApiEnvelope<ApiProduct[]> & { meta?: Record<string, unknown> }>(
          `/referral/${encodeURIComponent(normalizedCode)}/products${buildQueryString(params)}`,
          { method: 'GET' },
        ),
      staleTime: 30_000,
      gcTime: 10 * 60 * 1000,
      retry: false,
    });
  },

  register: (payload: {
    name: string;
    email: string;
    password: string;
    loginId: string;
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
    category?: string;
    panNumber?: string;
    aadhaarNumber?: string;
    identityConsent?: boolean;
    shopPhoto?: File | undefined;
    panImage?: File | undefined;
    aadhaarFront?: File | undefined;
    aadhaarBack?: File | undefined;
    referralCode: string;
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    utmTerm?: string;
    utmContent?: string;
    firstLandingAt?: string | undefined;
  }) => {
    const requestPayload = { ...payload, role: payload.role || 'retailer' };
    const files = [
      requestPayload.shopPhoto,
      requestPayload.panImage,
      requestPayload.aadhaarFront,
      requestPayload.aadhaarBack,
    ];
    if (files.some(Boolean)) {
      const formData = new FormData();
      Object.entries(requestPayload).forEach(([key, value]) => {
        if (value === undefined || value === null) return;
        if (value instanceof File) formData.append(key, value);
        else formData.append(key, String(value));
      });
      return request<ApiEnvelope<{ token?: string; accessToken?: string; user?: RetailerUser }>>('/auth/register', {
        method: 'POST',
        body: formData,
      });
    }
    return request<ApiEnvelope<{ token?: string; accessToken?: string; user?: RetailerUser }>>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(requestPayload),
    });
  },

  getMe: () => request<ApiEnvelope<RetailerUser>>('/auth/me', { method: 'GET' }),

  requestPasswordReset: (email: string) =>
    request<ApiEnvelope<{ message: string; resendAfterSeconds: number }>>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  verifyPasswordReset: (email: string, code: string) =>
    request<ApiEnvelope<{ resetToken: string; expiresInSeconds: number }>>('/auth/verify-password-reset', {
      method: 'POST',
      body: JSON.stringify({ email, code }),
    }),

  resetPassword: (token: string, newPassword: string) =>
    request<ApiEnvelope<{ message: string }>>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, newPassword }),
    }),

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

  getRetailerIdentityProfile: (retailerId: string) =>
    request<ApiEnvelope<{
      pan: { number: string; last4: string; hasImage: boolean };
      aadhaar: { last4: string; hasFrontImage: boolean; hasBackImage: boolean };
      shopPhoto: { hasImage: boolean };
      consent: { accepted: boolean; at: string | null };
      verificationStatus: string;
      verificationNote: string;
      documentsSubmitted: boolean;
    }>>(`/retailer-identity/${encodeURIComponent(retailerId)}/profile`, { method: 'GET' }),

  updateRetailerIdentity: (retailerId: string, formData: FormData) =>
    request<ApiEnvelope<{
      pan: { number: string; last4: string; hasImage: boolean };
      aadhaar: { last4: string; hasFrontImage: boolean; hasBackImage: boolean };
      shopPhoto: { hasImage: boolean };
      consent: { accepted: boolean; at: string | null };
      verificationStatus: string;
      verificationNote: string;
      documentsSubmitted: boolean;
    }>>(`/retailer-identity/${encodeURIComponent(retailerId)}/profile`, {
      method: 'PATCH',
      body: formData,
    }),

  getRetailerDocument: async (retailerId: string, documentType: string): Promise<Blob> => {
    const url = `${BASE_URL.replace(/\/+$/, '')}/retailer-identity/${encodeURIComponent(retailerId)}/documents/${encodeURIComponent(documentType)}`;
    const token = getAuthToken();
    const response = await fetch(url, {
      cache: 'no-store',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) {
      let message = `Unable to load document (HTTP ${response.status}).`;
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

  getFullAadhaar: (retailerId: string) =>
    request<ApiEnvelope<{ number: string }>>(
      `/retailer-identity/${encodeURIComponent(retailerId)}/aadhaar`,
      { method: 'GET' },
    ),

  getConnections: () => request<ApiEnvelope<any[]>>('/retailer/connections', { method: 'GET' }),

  getStore: () => request<ApiEnvelope<any>>('/retailer/store', { method: 'GET' }),

  getCategories: (params?: Record<string, string | number | boolean | null | undefined>) =>
    request<ApiEnvelope<ApiCategory[]> & { meta?: Record<string, unknown> }>(`/retailer/categories${buildQueryString(params)}`, { method: 'GET' }),

  getProducts: (params?: Record<string, string | number | boolean | null | undefined>) =>
    request<ApiEnvelope<ApiProduct[]> & { meta?: Record<string, unknown> }>(`/retailer/products${buildQueryString(params)}`, { method: 'GET' }),

  getProductById: (productId: string) => request<ApiEnvelope<{ product: ApiProduct; inventory?: unknown }>>(`/retailer/products/${productId}`, { method: 'GET' }),

  getCart: () => request<ApiEnvelope<any>>('/retailer/cart', { method: 'GET' }),

  addToCart: (productId: string, quantity = 1, color?: string) =>
    request<ApiEnvelope<any>>('/retailer/cart', {
      method: 'POST',
      body: JSON.stringify({ productId, quantity, ...(color ? { color } : {}) }),
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
    couponCode?: string;
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

  getRetailerPaymentOptions: (wholesalerId?: string) =>
    request<ApiEnvelope<{
      wholesalerId: string;
      businessName: string;
      accountName: string;
      qrPaymentsEnabled: boolean;
      hasQrImage: boolean;
      qrDataUrl: string;
      qrImageUrl?: string;
      upiIdPaymentsEnabled: boolean;
      upiId: string;
      qrSessionMinutes: number;
    }>>(`/retailer/payment-options${wholesalerId ? `?wholesalerId=${encodeURIComponent(wholesalerId)}` : ''}`, { method: 'GET' }),
  createRetailerQrSession: (wholesalerId?: string) =>
    request<ApiEnvelope<{
      wholesalerId: string;
      qrDataUrl: string;
      qrImageUrl?: string;
      qrSessionMinutes: number;
      expiresAt: string;
    }>>('/retailer/payment-options/qr-session', { method: 'POST', body: JSON.stringify(wholesalerId ? { wholesalerId } : {}) }),
  createPaymentReport: (payload: { orderId?: string; amount: string; transactionReference: string; type?: 'CREDIT_REPAYMENT'; screenshot?: File }) => {
    const formData = new FormData();
    if (payload.orderId) formData.append('orderId', payload.orderId);
    formData.append('amount', payload.amount);
    formData.append('transactionReference', payload.transactionReference);
    if (payload.type) formData.append('type', payload.type);
    if (payload.screenshot) formData.append('screenshot', payload.screenshot);
    return request<ApiEnvelope<any>>('/retailer/payments/reports', { method: 'POST', body: formData });
  },
  getRetailerPaymentReports: () =>
    request<ApiEnvelope<any[]>>('/retailer/payments/reports', { method: 'GET' }),
  requestCredit: () =>
    request<ApiEnvelope<{ creditStatus: string }>>('/retailer/credit-request', {
      method: 'POST',
      body: JSON.stringify({}),
    }),

  getOrders: (params?: Record<string, string | number | boolean | null | undefined>) =>
    request<ApiEnvelope<ApiOrder[] | ApiOrderListData>>(`/retailer/orders${buildQueryString(params)}`, { method: 'GET' }),

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
    request<ApiEnvelope<any>>('/support/tickets', {
      method: 'POST',
      body: JSON.stringify({
        type: 'Feedback',
        subject: payload.title?.trim() || 'Retailer Platform Feedback',
        message: `Rating: ${payload.rating}/5\n\n${payload.comment.trim()}`,
      }),
    }),

  submitSupportTicket: (payload: {
    type: string;
    subject: string;
    message: string;
    priority?: string;
    relatedOrderId?: string;
    attachments?: Array<{ url: string; publicId?: string }>;
  }) =>
    request<ApiEnvelope<any>>('/support/tickets', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getMySupportTickets: () => request<ApiEnvelope<any[]>>('/support/tickets/mine', { method: 'GET' }),

  getSupportTicket: (ticketId: string) =>
    request<ApiEnvelope<any>>(`/support/tickets/${encodeURIComponent(ticketId)}`, { method: 'GET' }),

  replySupportTicket: (ticketId: string, message: string) =>
    request<ApiEnvelope<any>>(`/support/tickets/${encodeURIComponent(ticketId)}/reply`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    }),

  markSupportTicketRead: (ticketId: string) =>
    request<ApiEnvelope<any>>(`/support/tickets/${encodeURIComponent(ticketId)}/read`, { method: 'PATCH' }),

  uploadSupportAttachments: (files: FileList | File[]) => {
    const formData = new FormData();
    Array.from(files).forEach((file) => formData.append('images', file));
    return request<ApiEnvelope<Array<{ url: string; publicId: string }>>>('/support/tickets/attachments', {
      method: 'POST',
      body: formData,
    });
  },

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
