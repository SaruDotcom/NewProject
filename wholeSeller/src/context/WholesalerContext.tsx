'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Product, Category, Retailer, Order, OrderStatus, InventoryLog, SecuritySession, AuditLog, ReturnRequest,
} from '@/lib/types';
import api, { setAuthToken, clearAuthToken, getAuthToken, type WholesalerStoreTheme } from '@/lib/api';
import { getWholesalerId, wholesalerQueryKeys } from '@/lib/query-client';

const productImageUrl = (image: unknown): string => {
  if (typeof image === 'string') return image.trim();
  if (image && typeof image === 'object' && 'url' in image && typeof image.url === 'string') {
    return image.url.trim();
  }
  return '';
};

const productImageUrls = (images: unknown, imageUrl?: unknown): string[] => {
  const imageList = Array.isArray(images) ? images : images ? [images] : [];
  return [...new Set([productImageUrl(imageUrl), ...imageList.map(productImageUrl)].filter(Boolean))];
};

export interface WholesalerProfile {
  id: string;
  businessName: string;
  businessLogoUrl: string;
  activeStoreTheme: WholesalerStoreTheme;
  businessType: string;
  ownerName: string;
  email: string;
  phone: string;
  isGstRegistered: boolean;
  gstin: string;
  tradeLicense: string;
  streetAddress: string;
  city: string;
  state: string;
  pincode: string;
  sameAsBusinessAddress: boolean;
  pickupStreetAddress: string;
  pickupCity: string;
  pickupState: string;
  pickupPincode: string;
  bankName: string;
  accountNumber: string;
  ifscCode: string;
  twoFactorEnabled: boolean;
  apiKey: string;
  subscriptionPlan: '' | 'MONTHLY' | 'ANNUAL';
  subscriptionStatus: '' | 'ACTIVE' | 'CANCELLED';
  nextBillingDate: string;
  accountStatus: '' | 'ACTIVE' | 'SUSPENDED' | 'BLOCKED';
  kycStatus: string;
}

export interface WholesalerAccountRegistration {
  businessName: string;
  ownerName: string;
  email: string;
  phone: string;
  isGstRegistered: boolean;
  gstin: string;
  streetAddress: string;
  city: string;
  state: string;
  pincode: string;
  sameAsBusinessAddress: boolean;
  pickupStreetAddress: string;
  pickupCity: string;
  pickupState: string;
  pickupPincode: string;
  inviteToken?: string;
  ref?: string;
  adminCode?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
}

export interface WholesalerNotification {
  id: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

interface WholesalerContextType {
  profile: WholesalerProfile;
  products: Product[];
  allRawProducts: Product[];
  categories: Category[];
  retailers: Retailer[];
  orders: Order[];
  returns: ReturnRequest[];
  inventoryLogs: InventoryLog[];
  sessions: SecuritySession[];
  auditLogs: AuditLog[];
  notifications: WholesalerNotification[];
  isLoading: boolean;

  // Actions
  updateReturnStatus: (returnId: string, status: 'APPROVED' | 'REJECTED') => Promise<void>;
  login: (email: string, password: string) => Promise<LoginResult>;
  resendLoginOtp: (challengeToken: string) => Promise<{ maskedEmail: string; resendAfterSeconds: number }>;
  verifyLoginOtp: (challengeToken: string, code: string) => Promise<void>;
  sendTwoFactorOtp: (resend?: boolean) => Promise<{ maskedEmail: string; resendAfterSeconds: number }>;
  verifyTwoFactorOtp: (code: string) => Promise<void>;
  disableTwoFactor: () => Promise<void>;
  registerWholesaler: (data: WholesalerAccountRegistration, passwordInput: string) => Promise<void>;
  refreshData: (silent?: boolean) => Promise<void>;
  markNotificationsRead: () => Promise<void>;
  updateProfile: (updated: Partial<WholesalerProfile>) => void;
  addProduct: (product: Omit<Product, 'id' | 'wholesalerId' | 'isLowStock'>) => Promise<void>;
  updateProduct: (id: string, updated: Partial<Product>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  adjustStock: (productId: string, delta: number, reason: string) => Promise<void>;

  addCategory: (category: Omit<Category, 'id' | 'wholesalerId' | 'productCount'>) => Promise<void>;
  updateCategory: (id: string, updated: Partial<Category>) => Promise<void>;
  deleteCategory: (id: string) => Promise<{ success: boolean; message?: string }>;

  updateRetailerLimit: (id: string, newLimit: number, newDiscount: number) => void;
  updateOrderStatus: (id: string, status: OrderStatus, tracking?: string) => Promise<void>;

  generateNewApiKey: () => void;
  updateSubscription: (plan: 'MONTHLY' | 'ANNUAL', renewalDate?: string) => void;
  terminateSession: (sessionId: string) => void;
  addAuditLog: (action: string, status?: 'Success' | 'Warning' | 'Failed') => void;
}

export interface LoginResult {
  requiresTwoFactor: boolean;
  challengeToken?: string;
  maskedEmail?: string;
  resendAfterSeconds?: number;
}

const WholesalerContext = createContext<WholesalerContextType | undefined>(undefined);

export const DEFAULT_PROFILE: WholesalerProfile = {
  id: '',
  businessName: '',
  businessLogoUrl: '',
  activeStoreTheme: 'DEFAULT',
  businessType: '',
  ownerName: '',
  email: '',
  phone: '',
  isGstRegistered: false,
  gstin: '',
  tradeLicense: '',
  streetAddress: '',
  city: '',
  state: '',
  pincode: '',
  sameAsBusinessAddress: true,
  pickupStreetAddress: '',
  pickupCity: '',
  pickupState: '',
  pickupPincode: '',
  bankName: '',
  accountNumber: '',
  ifscCode: '',
  twoFactorEnabled: false,
  apiKey: '',
  subscriptionPlan: '',
  subscriptionStatus: '',
  nextBillingDate: '',
  accountStatus: '',
  kycStatus: ''
};

export const WholesalerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = useQueryClient();
  const [profile, setProfile] = useState<WholesalerProfile>(DEFAULT_PROFILE);
  const [rawProducts, setRawProducts] = useState<Product[]>([]);
  const [rawCategories, setRawCategories] = useState<Category[]>([]);
  const [rawRetailers, setRawRetailers] = useState<Retailer[]>([]);
  const [rawOrders, setRawOrders] = useState<Order[]>([]);
  const [returns, setReturns] = useState<ReturnRequest[]>([]);
  const [inventoryLogs, setInventoryLogs] = useState<InventoryLog[]>([]);
  const [sessions, setSessions] = useState<SecuritySession[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [notifications, setNotifications] = useState<WholesalerNotification[]>([]);

  const invalidateResources = (...resources: string[]) => {
    const userId = profile.id || getWholesalerId();
    resources.forEach((resource) => {
      void queryClient.invalidateQueries({
        queryKey: wholesalerQueryKeys.resource(userId, resource),
      });
    });
  };

  const loadNotifications = async () => {
    const token = getAuthToken();
    if (!token) return;
    const userId = getWholesalerId();
    const response = await queryClient.fetchQuery({
      queryKey: wholesalerQueryKeys.resource(userId, 'notifications'),
      queryFn: () => api.getNotifications(),
    });
    const items = Array.isArray(response?.data) ? response.data : [];
    setNotifications(items.map((item: any) => ({
      id: String(item._id || item.id),
      title: item.title || 'Update',
      message: item.message || '',
      isRead: Boolean(item.isRead),
      createdAt: item.createdAt || '',
    })));
  };

  // Sync data from Backend API when token is present
  const refreshData = async (silent = false) => {
    const token = getAuthToken();
    if (!token) {
      setProfile(DEFAULT_PROFILE);
      setRawProducts([]);
      setRawCategories([]);
      setRawRetailers([]);
      setRawOrders([]);
      setReturns([]);
      setInventoryLogs([]);
      setSessions([]);
      setAuditLogs([]);
      setNotifications([]);
      return;
    }

    try {
      if (!silent) setIsLoading(true);

      // 1. Get Me Profile
      const meRes = await api.getMe();
      const userId = String(meRes?.data?.id || meRes?.data?._id || profile.id || 'unknown');
      if (userId !== 'unknown') localStorage.setItem('wholesaler_user_id', userId);
      if (meRes?.data) {
        const u = meRes.data;
        const wp = u.wholesalerProfile || {};
        setProfile((prev) => ({
          ...prev,
          id: u.id || u._id || prev.id,
          accountStatus: u.status === 'SUSPENDED' || u.status === 'BLOCKED' ? u.status : 'ACTIVE',
          businessName: wp.businessName || u.businessName || prev.businessName,
          businessLogoUrl: wp.businessLogoUrl || prev.businessLogoUrl,
          activeStoreTheme: wp.activeStoreTheme || 'DEFAULT',
          businessType: wp.businessType || prev.businessType,
          ownerName: u.name || prev.ownerName,
          email: u.email || prev.email,
          phone: u.phone || prev.phone,
          gstin: wp.gstin || prev.gstin,
          isGstRegistered: wp.gstStatus ? wp.gstStatus === 'REGISTERED' : prev.isGstRegistered,
          tradeLicense: wp.registrationDetails?.tradeLicense || prev.tradeLicense,
          streetAddress: wp.address?.street || prev.streetAddress,
          city: wp.address?.city || prev.city,
          state: wp.address?.state || prev.state,
          pincode: wp.address?.pincode || prev.pincode,
          sameAsBusinessAddress: wp.pickupAddress?.sameAsBusinessAddress ?? prev.sameAsBusinessAddress,
          pickupStreetAddress: wp.pickupAddress?.street || prev.pickupStreetAddress,
          pickupCity: wp.pickupAddress?.city || prev.pickupCity,
          pickupState: wp.pickupAddress?.state || prev.pickupState,
          pickupPincode: wp.pickupAddress?.pincode || prev.pickupPincode,
          bankName: wp.bankDetails?.bankName || prev.bankName,
          accountNumber: wp.bankDetails?.accountNumber || prev.accountNumber,
          ifscCode: wp.bankDetails?.ifscCode || prev.ifscCode,
          kycStatus: wp.kycStatus || prev.kycStatus,
          twoFactorEnabled: Boolean(wp.twoFactorEnabled),
        }));
      }

      // 2. Get Categories
      const catRes = await queryClient.fetchQuery({
        queryKey: wholesalerQueryKeys.resource(userId, 'categories'),
        queryFn: () => api.getCategories(),
      });
      const categoryItems = Array.isArray(catRes?.data)
        ? catRes.data
        : Array.isArray(catRes?.data?.items)
          ? catRes.data.items
          : [];
      if (catRes?.data) {
        const apiCats: Category[] = categoryItems.map((c: any) => ({
          id: c._id || c.id,
          wholesalerId: c.wholesalerId || profile.id,
          name: c.name,
          slug: c.slug || (c.name ? c.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') : 'category'),
          productCount: c.productCount || c.products || 0,
          icon: 'Package',
          description: c.description || c.name || 'Product Category',
          imageUrl: c.imageUrl || '',
          parentId: c.parentId ? (typeof c.parentId === 'object' && c.parentId !== null ? String(c.parentId._id || c.parentId.id || '') : String(c.parentId)) : null,
          parentName: c.parent?.name || (typeof c.parentId === 'object' && c.parentId !== null ? c.parentId?.name : undefined),
          displayPath: c.displayPath || c.name,
          level: c.level || 0,
          path: c.path || [],
        }));
        if (apiCats.length > 0) {
          setRawCategories(apiCats);
        } else {
          setRawCategories([]);
        }
      }

      // 3. Get Products
      const prodRes = await queryClient.fetchQuery({
        queryKey: wholesalerQueryKeys.resource(userId, 'products'),
        queryFn: () => api.getProducts(),
      });
      if (prodRes?.data && Array.isArray(prodRes.data)) {
        const apiProds: Product[] = prodRes.data.map((p: any) => {
          const cost = Number(p.costPrice ?? p.wholesalePrice ?? p.price ?? 0);
          const selling = Number(p.sellingPrice ?? p.mrp ?? 0);
          const base = Number(p.wholesalePrice ?? p.basePrice ?? p.costPrice ?? p.sellingPrice ?? 0);
          const st = Number(p.stockQuantity ?? p.stock ?? p.quantity ?? 0);
          const moq = Number(p.minOrderQty ?? p.moq ?? 0);
          return {
            id: p._id || p.id,
            wholesalerId: p.wholesalerId || profile.id,
            title: p.name || p.title || '',
            sku: p.sku || '',
            category: typeof p.categoryId === 'object' ? (p.categoryId?.name || '') : (typeof p.category === 'object' ? p.category?.name : (p.category || '')),
            categoryId: typeof p.categoryId === 'object' ? p.categoryId?._id : (p.categoryId || ''),
            subcategoryId: typeof p.subcategoryId === 'object' ? p.subcategoryId?._id : (p.subcategoryId || ''),
            subcategoryName: typeof p.subcategoryId === 'object' ? p.subcategoryId?.name : '',
            costPrice: cost,
            sellingPrice: selling,
            basePrice: base,
            stock: st,
            minOrderQty: moq,
            unit: p.unit || '',
            isLowStock: st <= moq,
            imageUrl: productImageUrls(p.images, p.imageUrl)[0] || '',
            images: productImageUrls(p.images, p.imageUrl),
            pricingTiers: p.bulkPricingTiers || p.pricingTiers || [],
            description: p.description || '',
            sizes: p.sizes || [],
            colors: p.colors || [],
            colorVariants: Array.isArray(p.colorVariants)
              ? p.colorVariants
                  .map((variant: any) => ({
                    color: String(variant.color || variant.name || '').trim(),
                    ...(variant.sku ? { sku: String(variant.sku) } : {}),
                    images: productImageUrls(variant.images),
                  }))
                  .filter((variant: { color: string }) => variant.color)
              : [],
          };
        });
        setRawProducts(apiProds);
      }

      // 4. Get Connected Retailers
      const retRes = await queryClient.fetchQuery({
        queryKey: wholesalerQueryKeys.resource(userId, 'retailers'),
        queryFn: () => api.getConnectedRetailers(),
      });
      if (retRes?.data && Array.isArray(retRes.data)) {
        const apiRets: Retailer[] = retRes.data.map((r: any) => ({
          id: r._id || r.id,
          retailerId: r.retailerId || '',
          wholesalerId: profile.id,
          businessName: r.businessName || '',
          contactPerson: r.contactPerson || r.name || '',
          email: r.email || '',
          profileComplete: Boolean(r.profileComplete),
          businessType: r.businessType || '',
          address: r.address || '',
          pincode: r.pincode || '',
          phone: r.phone || '',
          city: r.city || '',
          state: r.state || '',
          status: 'CONNECTED',
          gstin: r.gstNumber || r.gstin || '',
          creditLimit: Number(r.creditLimit ?? 0),
          discountPercent: Number(r.discountPercent ?? 0),
          totalOrdersCount: Number(r.totalOrdersCount ?? 0),
          totalSpent: Number(r.totalSpent ?? 0),
          outstandingAmount: Number(r.outstandingAmount ?? 0),
          registrationSource: r.registrationSource || 'DIRECT',
          lastLoginAt: r.lastLoginAt || null,
          verificationStatus: r.verificationStatus || 'NOT_SUBMITTED',
          documentsSubmitted: Boolean(r.documentsSubmitted),
          joinedDate: r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-IN') : '',
        }));
        setRawRetailers(apiRets);
      }

      // 5. Get Orders
      const orderRes = await queryClient.fetchQuery({
        queryKey: wholesalerQueryKeys.resource(userId, 'orders'),
        queryFn: () => api.getOrders(),
      });
      const orderItems = Array.isArray(orderRes?.data)
        ? orderRes.data
        : Array.isArray(orderRes?.data?.items)
          ? orderRes.data.items
          : [];
      if (orderRes?.data) {
        const apiOrders: Order[] = orderItems.map((o: any) => {
          const tot = Number(o.totalAmount ?? o.grandTotal ?? o.total ?? 0);
          const rId = typeof o.retailerId === 'object' ? String(o.retailerId?._id || '') : String(o.retailerId || o.retailer?.id || '');
          const rBiz = (typeof o.retailerId === 'object' && o.retailerId?.businessName) || o.retailer?.businessName || o.retailerBusinessName || '';
          const rName = typeof o.retailerId === 'object' ? (o.retailerId?.name || o.retailerId?.businessName || '') : (o.retailerName || o.retailer?.name || '');
          return {
            id: o._id || o.id,
            orderNumber: o.orderNo || o.orderNumber || '',
            wholesalerId: profile.id,
            retailerId: rId,
            retailerBusinessName: rBiz,
            retailerName: rName,
            retailerCity: typeof o.retailerId === 'object' ? (o.retailerId?.city || o.retailerId?.address?.city || '') : (o.retailerCity || ''),
            status: (o.orderStatus || o.status || 'PENDING').toUpperCase() as OrderStatus,
            cancellationReason: o.cancellationReason || '',
            cancellationNote: o.cancellationNote || '',
            totalAmount: tot,
            taxAmount: Math.round(tot * 0.18),
            discountAmount: Number(o.discountAmount || 0),
            paymentStatus: o.paymentStatus || 'UNPAID',
            createdAt: o.createdAt ? new Date(o.createdAt).toLocaleString('en-IN') : '',
            items: Array.isArray(o.items)
              ? o.items.map((it: any, index: number) => {
                  const unitP = Number(it.pricePerUnit ?? it.price ?? 0);
                  const qty = Number(it.quantity ?? 0);
                  return {
                    id: `item-${index}`,
                    productId: typeof it.productId === 'object' ? it.productId?._id : it.productId,
                    productTitle: typeof it.productId === 'object' ? (it.productId?.name || it.productId?.title || '') : (it.name || ''),
                    sku: typeof it.productId === 'object' ? (it.productId?.sku || '') : (it.sku || ''),
                    unitPrice: unitP,
                    quantity: qty,
                    subtotal: unitP * qty,
                  };
                })
              : [],
          };
        });
        setRawOrders(apiOrders);
      }

      // 6. Get Returns
      const returnsRes = await queryClient.fetchQuery({
        queryKey: wholesalerQueryKeys.resource(userId, 'returns'),
        queryFn: () => api.getReturns(),
      });
      if (returnsRes?.data && Array.isArray(returnsRes.data)) {
        setReturns(returnsRes.data.map((r: any) => ({
          id: r._id || r.id,
          orderId: r.orderId,
          retailerId: r.retailerId,
          returnNumber: r.returnNumber,
          status: r.status,
          items: r.items,
          reason: r.reason,
          retailerNote: r.retailerNote || '',
          totalRefundAmount: r.totalRefundAmount,
          createdAt: r.createdAt,
        })));
      } else {
        setReturns([]);
      }

      try {
        await loadNotifications();
      } catch (err: any) {
        console.warn('Notification load failed:', err.message);
      }
    } catch (err: any) {
      console.warn('Sync Wholesaler API note:', err.message);
      if (String(err?.message || '').toLowerCase().includes('unauthorized') || String(err?.message || '').includes('401')) {
        queryClient.clear();
        localStorage.removeItem('wholesaler_user_id');
        clearAuthToken();
        setProfile(DEFAULT_PROFILE);
        setRawProducts([]);
        setRawCategories([]);
        setRawRetailers([]);
        setRawOrders([]);
        setInventoryLogs([]);
        setSessions([]);
        setAuditLogs([]);
        setNotifications([]);
        if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login') && !window.location.pathname.startsWith('/register')) {
          window.location.href = '/login';
        }
      }
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  useEffect(() => {
    const isPublicAuthPage = typeof window !== 'undefined' && 
      (window.location.pathname.startsWith('/login') || window.location.pathname.startsWith('/register'));
    if (!isPublicAuthPage) {
      refreshData();
    }
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const isPublicAuthPage = typeof window !== 'undefined' && 
        (window.location.pathname.startsWith('/login') || window.location.pathname.startsWith('/register'));
      const token = getAuthToken();
      if (token && !isPublicAuthPage && token !== 'demo-wholesaler-token') {
        loadNotifications().catch((err: any) => console.warn('Notification refresh failed:', err.message));
      }
    }, 30000);
    return () => window.clearInterval(interval);
  }, []);

  const markNotificationsRead = async () => {
    try {
      await api.markAllNotificationsRead();
      invalidateResources('notifications');
      setNotifications((current) => current.map((notification) => ({ ...notification, isRead: true })));
    } catch (err: any) {
      console.warn('Mark notifications read failed:', err.message);
    }
  };

  const login = async (identifier: string, password: string): Promise<LoginResult> => {
    setIsLoading(true);
    try {
      const res = await api.login({ email: identifier, password, role: 'WHOLESALER' });
      if (res?.data?.requiresTwoFactor && res.data.challengeToken) {
        return {
          requiresTwoFactor: true,
          challengeToken: res.data.challengeToken,
          maskedEmail: res.data.maskedEmail,
          resendAfterSeconds: res.data.resendAfterSeconds,
        };
      }
      if (res?.data?.token) {
        setAuthToken(res.data.token);
      } else {
        throw new Error('Login did not return an authentication token.');
      }
      await refreshData();
      return { requiresTwoFactor: false };
    } catch (err: any) {
      if (
        String(err?.message || '').toLowerCase().includes('failed to fetch') ||
        String(err?.message || '').toLowerCase().includes('networkerror')
      ) {
        console.warn('Backend unavailable, initializing offline demo session:', err.message);
        setAuthToken('demo-wholesaler-token');
        setProfile({
          ...DEFAULT_PROFILE,
          id: 'wholesaler-apex-demo',
          businessName: 'Apex Wholesale Electronics',
          ownerName: 'Rajesh Sharma',
          email: identifier || 'wholesaler@apex.com',
          phone: '+91 98765 43210',
          accountStatus: 'ACTIVE',
          kycStatus: 'APPROVED',
        });
        return { requiresTwoFactor: false };
      }
      setIsLoading(false);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const resendLoginOtp = async (challengeToken: string) => {
    const response = await api.resendLoginOtp(challengeToken);
    return response.data;
  };

  const verifyLoginOtp = async (challengeToken: string, code: string) => {
    const response = await api.verifyLoginOtp(challengeToken, code);
    setAuthToken(response.data.token);
    await refreshData();
  };

  const sendTwoFactorOtp = async (resend = false) => {
    const response = await api.sendTwoFactorOtp(resend);
    return response.data;
  };

  const verifyTwoFactorOtp = async (code: string) => {
    await api.verifyTwoFactorOtp(code);
    await refreshData(true);
    addAuditLog('Two-Factor Authentication Enabled');
  };

  const disableTwoFactor = async () => {
    await api.disableTwoFactor();
    await refreshData(true);
    addAuditLog('Two-Factor Authentication Disabled');
  };

  const logout = () => {
    queryClient.clear();
    localStorage.removeItem('wholesaler_user_id');
    clearAuthToken();
    window.location.href = '/login';
  };

  const registerWholesaler = async (data: WholesalerAccountRegistration, passwordInput: string) => {
    setIsLoading(true);
    try {
      const response = await api.register({
        name: data.ownerName,
        email: data.email,
        password: passwordInput,
        businessName: data.businessName,
        phone: data.phone,
        address: data.streetAddress,
        streetAddress: data.streetAddress,
        city: data.city,
        state: data.state,
        pincode: data.pincode,
        isGstRegistered: data.isGstRegistered,
        gstin: data.isGstRegistered ? data.gstin : '',
        gstStatus: data.isGstRegistered ? 'REGISTERED' : 'UNREGISTERED',
        sameAsBusinessAddress: data.sameAsBusinessAddress,
        pickupStreetAddress: data.pickupStreetAddress,
        pickupCity: data.pickupCity,
        pickupState: data.pickupState,
        pickupPincode: data.pickupPincode,
        inviteToken: data.inviteToken,
        ref: data.ref,
        adminCode: data.adminCode,
        utmSource: data.utmSource,
        utmMedium: data.utmMedium,
        utmCampaign: data.utmCampaign,
      });
      if (!response?.data?.user) throw new Error('Registration succeeded but no account details were returned.');
      clearAuthToken();
    } catch (err: any) {
      setIsLoading(false);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const updateProfile = useCallback((updated: Partial<WholesalerProfile>) => {
    setProfile((prev) => ({ ...prev, ...updated }));
  }, []);

  const addProduct = async (prod: Omit<Product, 'id' | 'wholesalerId' | 'isLowStock'>) => {
    try {
      const res = await api.createProduct({
        name: prod.title,
        title: prod.title,
        categoryName: prod.category,
        categoryId: prod.categoryId,
        subcategoryId: prod.subcategoryId || null,
        costPrice: prod.costPrice,
        wholesalePrice: prod.sellingPrice,
        sellingPrice: prod.sellingPrice,
        mrp: prod.sellingPrice,
        stock: prod.stock,
        minOrderQty: prod.minOrderQty,
        unit: prod.unit || 'piece',
        pricingTiers: prod.pricingTiers,
        description: prod.description || prod.sku,
        sizes: prod.sizes,
        colors: prod.colors,
        additionalOptions: prod.additionalOptions,
        categoryAttributes: prod.categoryAttributes,
        imageUrl: prod.imageUrl,
        images: prod.images,
        colorVariants: prod.colorVariants,
        sku: prod.sku,
      });
      if (res?.data) {
        invalidateResources('products', 'analytics');
        await refreshData(true);
      }
    } catch (err: any) {
      console.warn('Add product API note:', err.message);
      throw err;
    }
    addAuditLog(`Added new wholesale product: ${prod.title}`);
  };

  const updateProduct = async (id: string, updated: Partial<Product>) => {
    try {
      await api.updateProduct(id, {
        ...(updated.title && { name: updated.title, title: updated.title }),
        ...(updated.category && { categoryName: updated.category }),
        ...(updated.categoryId && { categoryId: updated.categoryId }),
        ...(updated.subcategoryId !== undefined && { subcategoryId: updated.subcategoryId }),
        ...(updated.costPrice !== undefined && { costPrice: updated.costPrice }),
        ...(updated.mrp !== undefined && { mrp: updated.mrp }),
        ...(updated.sellingPrice !== undefined && { sellingPrice: updated.sellingPrice, wholesalePrice: updated.sellingPrice, basePrice: updated.sellingPrice }),
        ...(updated.stock !== undefined && { stock: updated.stock }),
        ...(updated.minOrderQty !== undefined && { minOrderQty: updated.minOrderQty }),
        ...(updated.unit !== undefined && { unit: updated.unit }),
        ...(updated.pricingTiers && { pricingTiers: updated.pricingTiers }),
        ...(updated.description !== undefined && { description: updated.description }),
        ...(updated.sizes && { sizes: updated.sizes }),
        ...(updated.colors && { colors: updated.colors }),
        ...(updated.additionalOptions && { additionalOptions: updated.additionalOptions }),
        ...(updated.categoryAttributes && { categoryAttributes: updated.categoryAttributes }),
        ...(updated.imageUrl !== undefined && { imageUrl: updated.imageUrl }),
        ...(updated.images !== undefined && { images: updated.images }),
        ...(updated.colorVariants !== undefined && { colorVariants: updated.colorVariants }),
        ...(updated.sku !== undefined && { sku: updated.sku }),
      });
      invalidateResources('products', 'inventory', 'analytics');
      await refreshData(true);
    } catch (err: any) {
      console.warn('Update product API note:', err.message);
      throw err;
    }
    addAuditLog(`Updated product ID: ${id}`);
  };

  const deleteProduct = async (id: string) => {
    try {
      await api.deleteProduct(id);
      invalidateResources('products', 'analytics');
      await refreshData(true);
    } catch (err: any) {
      console.warn('Delete product API note:', err.message);
      throw err;
    }
    addAuditLog(`Deleted product ID: ${id}`);
  };

  const adjustStock = async (productId: string, delta: number, reason: string) => {
    const existing = rawProducts.find((p) => p.id === productId);
    const newStock = Math.max(0, (existing?.stock || 0) + delta);

    // Optimistically update local state for immediate UI feedback
    setRawProducts((prev) =>
      prev.map((p) =>
        p.id === productId ? { ...p, stock: newStock, isLowStock: newStock <= p.minOrderQty } : p
      )
    );

    try {
      await api.adjustInventory(productId, { quantity: delta, notes: reason });
      invalidateResources('products', 'inventory', 'analytics');
      await refreshData(true);
    } catch (err) {
      setRawProducts((prev) =>
        prev.map((product) =>
          product.id === productId
            ? { ...product, stock: existing?.stock ?? product.stock }
            : product
        )
      );
      throw err;
    }

    addAuditLog(`Stock adjusted for ${existing?.sku}: ${delta > 0 ? '+' : ''}${delta} (${reason})`);
  };

  const addCategory = async (cat: Omit<Category, 'id' | 'wholesalerId' | 'productCount' | 'slug' | 'icon'>) => {
    try {
      const res = await api.createCategory({ name: cat.name, description: cat.description || cat.name, imageUrl: cat.imageUrl, parentId: cat.parentId || null });
      if (res?.data) {
        invalidateResources('categories', 'products');
        await refreshData(true);
      }
    } catch (err) {
      throw err;
    }
    addAuditLog(`Created product category: ${cat.name}`);
  };

  const updateCategory = async (id: string, updated: Partial<Category>) => {
    try {
      await api.updateCategory(id, { name: updated.name, description: updated.description, imageUrl: updated.imageUrl, parentId: updated.parentId });
      invalidateResources('categories', 'products');
      await refreshData(true);
    } catch (err) {
      throw err;
    }
    addAuditLog(`Updated category ID: ${id}`);
  };

  const deleteCategory = async (id: string): Promise<{ success: boolean; message?: string }> => {
    const categoryObj = rawCategories.find((c) => c.id === id);
    if (!categoryObj) {
      return { success: false, message: 'Category not found.' };
    }

    try {
      await api.deleteCategory(id);
      invalidateResources('categories', 'products');
      await refreshData(true);
      return { success: true };
    } catch (err: any) {
      console.warn('Delete category API note:', err.message);
      return { success: false, message: err?.message || 'Unable to delete category.' };
    }
  };

  const updateRetailerLimit = (id: string, newLimit: number, newDiscount: number) => {
    setRawRetailers((prev) => prev.map((r) => (r.id === id ? { ...r, creditLimit: newLimit, discountPercent: newDiscount } : r)));
    addAuditLog(`Updated credit terms for retailer ID: ${id}`);
  };

  const updateOrderStatus = async (id: string, status: OrderStatus, tracking?: string) => {
    try {
      await api.updateOrderStatus(id, status);
      invalidateResources('orders', 'analytics');
      await refreshData(true);
    } catch (err: any) {
      console.warn('Update order status API note:', err.message);
      throw err;
    }
    addAuditLog(`Updated order status to ${status} for Order ID: ${id}`);
  };

  const updateReturnStatus = async (returnId: string, status: 'APPROVED' | 'REJECTED') => {
    try {
      await api.updateReturnStatus(returnId, status);
      invalidateResources('returns', 'orders');
      await refreshData(true);
      addAuditLog(`Updated return request ${returnId} to ${status}`);
    } catch (err: any) {
      console.warn('Update return status API note:', err.message);
      throw err;
    }
  };

  const generateNewApiKey = () => {
    const newKey = `wh_live_pk_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;
    setProfile((prev) => ({ ...prev, apiKey: newKey }));
    addAuditLog(`Generated new ERP integration API Key`);
  };

  const updateSubscription = (plan: 'MONTHLY' | 'ANNUAL', renewalDate?: string) => {
    setProfile((prev) => ({
      ...prev,
      subscriptionPlan: plan,
      subscriptionStatus: 'ACTIVE',
      nextBillingDate: renewalDate ? new Date(renewalDate).toLocaleDateString('en-IN') : prev.nextBillingDate,
    }));
    addAuditLog(`Verified subscription payment for ${plan} plan`);
  };

  const terminateSession = (sessionId: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    addAuditLog(`Terminated security session ID: ${sessionId}`);
  };

  const addAuditLog = (action: string, status: 'Success' | 'Warning' | 'Failed' = 'Success') => {
    const log: AuditLog = {
      id: `audit-${Date.now()}`,
      action,
      user: profile.ownerName + ' (Wholesaler)',
      timestamp: new Date().toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'medium' }),
      status,
    };
    setAuditLogs((prev) => [log, ...prev]);
  };

  return (
    <WholesalerContext.Provider
      value={{
        profile,
        products: rawProducts,
        allRawProducts: rawProducts,
        categories: rawCategories,
        retailers: rawRetailers,
        orders: rawOrders,
        returns,
        inventoryLogs,
        sessions,
        auditLogs,
        notifications,
        isLoading,
        login,
        resendLoginOtp,
        verifyLoginOtp,
        sendTwoFactorOtp,
        verifyTwoFactorOtp,
        disableTwoFactor,
        registerWholesaler,
        refreshData,
        markNotificationsRead,
        updateProfile,
        addProduct,
        updateProduct,
        deleteProduct,
        adjustStock,
        addCategory,
        updateCategory,
        deleteCategory,
        updateRetailerLimit,
        updateOrderStatus,
        updateReturnStatus,
        generateNewApiKey,
        updateSubscription,
        terminateSession,
        addAuditLog,
      }}
    >
      {children}
    </WholesalerContext.Provider>
  );
};

const fallbackWholesalerContext: WholesalerContextType = {
  profile: DEFAULT_PROFILE,
  products: [],
  allRawProducts: [],
  categories: [],
  retailers: [],
  orders: [],
  returns: [],
  inventoryLogs: [],
  sessions: [],
  auditLogs: [],
  notifications: [],
  isLoading: false,
  updateReturnStatus: async () => undefined,
  login: async () => ({ requiresTwoFactor: false }),
  resendLoginOtp: async () => ({ maskedEmail: '', resendAfterSeconds: 60 }),
  verifyLoginOtp: async () => undefined,
  sendTwoFactorOtp: async () => ({ maskedEmail: '', resendAfterSeconds: 60 }),
  verifyTwoFactorOtp: async () => undefined,
  disableTwoFactor: async () => undefined,
  registerWholesaler: async () => undefined,
  refreshData: async () => undefined,
  markNotificationsRead: async () => undefined,
  updateProfile: () => undefined,
  addProduct: async () => undefined,
  updateProduct: async () => undefined,
  deleteProduct: async () => undefined,
  adjustStock: async () => undefined,
  addCategory: async () => undefined,
  updateCategory: async () => undefined,
  deleteCategory: async () => ({ success: false }),
  updateRetailerLimit: () => undefined,
  updateOrderStatus: async () => undefined,
  generateNewApiKey: () => undefined,
  updateSubscription: () => undefined,
  terminateSession: () => undefined,
  addAuditLog: () => undefined,
};

export const useWholesaler = () => {
  const context = useContext(WholesalerContext);
  return context ?? fallbackWholesalerContext;
};
