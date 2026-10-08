'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  Product, Category, Retailer, Order, OrderStatus, InventoryLog, SecuritySession, AuditLog, ReturnRequest
} from '@/lib/mock-data';
import api, { setAuthToken, clearAuthToken, getAuthToken, isDemoAuthToken } from '@/lib/api';

export interface WholesalerProfile {
  id: string;
  businessName: string;
  businessLogoUrl: string;
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
  subscriptionPlan: 'MONTHLY' | 'ANNUAL';
  subscriptionStatus: 'ACTIVE' | 'CANCELLED';
  nextBillingDate: string;
  accountStatus: 'APPROVED' | 'PENDING_APPROVAL' | 'REJECTED';
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
}

export interface InviteLinkItem {
  _id: string;
  token: string;
  shareableUrl: string;
  isUsed: boolean;
  createdAt: string;
  usedByRetailerId?: any;
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
  inviteLinks: InviteLinkItem[];
  isLoading: boolean;

  // Actions
  updateReturnStatus: (returnId: string, status: 'APPROVED' | 'REJECTED') => Promise<void>;
  login: (email: string, password?: string) => Promise<void>;
  registerWholesaler: (data: WholesalerAccountRegistration, passwordInput?: string) => Promise<void>;
  generateInviteLink: () => Promise<string | null>;
  refreshData: () => Promise<void>;
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

  toggleTwoFactor: () => void;
  generateNewApiKey: () => void;
  updateSubscription: (plan: 'MONTHLY' | 'ANNUAL') => void;
  terminateSession: (sessionId: string) => void;
  addAuditLog: (action: string, status?: 'Success' | 'Warning' | 'Failed') => void;
}

const WholesalerContext = createContext<WholesalerContextType | undefined>(undefined);

export const DEFAULT_PROFILE: WholesalerProfile = {
  id: '',
  businessName: '',
  businessLogoUrl: '',
  businessType: '',
  ownerName: '',
  email: '',
  phone: '',
  isGstRegistered: true,
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
  subscriptionPlan: 'ANNUAL',
  subscriptionStatus: 'ACTIVE',
  nextBillingDate: '',
  accountStatus: 'PENDING_APPROVAL',
  kycStatus: 'DRAFT'
};

export const WholesalerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [profile, setProfile] = useState<WholesalerProfile>(DEFAULT_PROFILE);
  const [rawProducts, setRawProducts] = useState<Product[]>([]);
  const [rawCategories, setRawCategories] = useState<Category[]>([]);
  const [rawRetailers, setRawRetailers] = useState<Retailer[]>([]);
  const [rawOrders, setRawOrders] = useState<Order[]>([]);
  const [returns, setReturns] = useState<ReturnRequest[]>([]);
  const [inventoryLogs, setInventoryLogs] = useState<InventoryLog[]>([]);
  const [sessions, setSessions] = useState<SecuritySession[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [inviteLinks, setInviteLinks] = useState<InviteLinkItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [notifications, setNotifications] = useState<WholesalerNotification[]>([]);

  const loadNotifications = async () => {
    const response = await api.getNotifications();
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
  const refreshData = async () => {
    const token = getAuthToken();
    if (!token || isDemoAuthToken(token)) {
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
      setInviteLinks([]);
      return;
    }

    try {
      setIsLoading(true);

      // 1. Get Me Profile
      const meRes = await api.getMe();
      if (meRes?.data) {
        const u = meRes.data;
        const wp = u.wholesalerProfile || {};
        setProfile((prev) => ({
          ...prev,
          id: u.id || u._id || prev.id,
          businessName: wp.businessName || u.businessName || prev.businessName,
          businessLogoUrl: wp.businessLogoUrl || prev.businessLogoUrl,
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
        }));
      }

      // 2. Get Categories
      const catRes = await api.getCategories();
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
      const prodRes = await api.getProducts();
      if (prodRes?.data && Array.isArray(prodRes.data)) {
        const apiProds: Product[] = prodRes.data.map((p: any) => {
          const cost = Number(p.costPrice || p.wholesalePrice || p.price || 0);
          const selling = Number(p.sellingPrice || p.mrp || 100);
          const base = Number(p.wholesalePrice || p.basePrice || p.costPrice || p.sellingPrice || 100);
          const st = Number(p.stockQuantity ?? p.stock ?? p.quantity ?? 50);
          const moq = Number(p.minOrderQty ?? p.moq ?? 1);
          return {
            id: p._id || p.id,
            wholesalerId: p.wholesalerId || profile.id,
            title: p.name || p.title || 'Product',
            sku: p.sku || `SKU-${String(p._id || p.id || '').slice(-4)}`,
            category: typeof p.categoryId === 'object' ? (p.categoryId?.name || 'General') : (typeof p.category === 'object' ? p.category?.name : (p.category || 'General')),
            categoryId: typeof p.categoryId === 'object' ? p.categoryId?._id : (p.categoryId || ''),
            subcategoryId: typeof p.subcategoryId === 'object' ? p.subcategoryId?._id : (p.subcategoryId || ''),
            subcategoryName: typeof p.subcategoryId === 'object' ? p.subcategoryId?.name : '',
            costPrice: cost,
            sellingPrice: selling,
            basePrice: base,
            stock: st,
            minOrderQty: moq,
            unit: p.unit || 'piece',
            isLowStock: st <= moq,
            imageUrl: p.imageUrl || (p.images && p.images[0]) || '',
            pricingTiers: p.bulkPricingTiers || p.pricingTiers || [],
            description: p.description || p.name || '',
            sizes: p.sizes || [],
            colors: p.colors || [],
          };
        });
        setRawProducts(apiProds);
      }

      // 4. Get Connected Retailers
      const retRes = await api.getConnectedRetailers();
      if (retRes?.data && Array.isArray(retRes.data)) {
        const apiRets: Retailer[] = retRes.data.map((r: any) => ({
          id: r._id || r.id,
          wholesalerId: profile.id,
          businessName: r.businessName || `${r.name || 'Retailer'}'s Store`,
          contactPerson: r.contactPerson || r.name || 'Owner',
          email: r.email || '',
          loginId: r.loginId || '',
          profileComplete: Boolean(r.profileComplete),
          businessType: r.businessType || 'Retail Store',
          address: r.address || '',
          pincode: r.pincode || '',
          phone: r.phone || '9000000000',
          city: r.city || 'Delhi',
          state: r.state || 'Delhi',
          status: 'CONNECTED',
          gstin: r.gstNumber || r.gstin || 'NON-GST',
          creditLimit: Number(r.creditLimit || 50000),
          discountPercent: Number(r.discountPercent || 5),
          totalOrdersCount: Number(r.totalOrdersCount || 1),
          totalSpent: Number(r.totalSpent || 10000),
          joinedDate: r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-IN') : new Date().toLocaleDateString('en-IN'),
        }));
        setRawRetailers(apiRets);
      }

      // 5. Get Orders
      const orderRes = await api.getOrders();
      const orderItems = Array.isArray(orderRes?.data)
        ? orderRes.data
        : Array.isArray(orderRes?.data?.items)
          ? orderRes.data.items
          : [];
      if (orderRes?.data) {
        const apiOrders: Order[] = orderItems.map((o: any) => {
          const tot = Number(o.totalAmount ?? o.grandTotal ?? o.total ?? 0);
          return {
            id: o._id || o.id,
            orderNumber: o.orderNo || o.orderNumber || `ORD-${String(o._id || o.id || '').slice(-4)}`,
            wholesalerId: profile.id,
            retailerName: typeof o.retailerId === 'object' ? (o.retailerId?.name || o.retailerId?.businessName || 'Retailer') : (o.retailerName || 'Retailer'),
            retailerCity: typeof o.retailerId === 'object' ? (o.retailerId?.city || o.retailerId?.address?.city || 'Delhi') : (o.retailerCity || 'Delhi'),
            status: (o.orderStatus || o.status || 'PENDING').toUpperCase() as OrderStatus,
            cancellationReason: o.cancellationReason || '',
            cancellationNote: o.cancellationNote || '',
            totalAmount: tot,
            taxAmount: Math.round(tot * 0.18),
            discountAmount: Number(o.discountAmount || 0),
            paymentStatus: o.paymentStatus || 'PAID',
            createdAt: o.createdAt ? new Date(o.createdAt).toLocaleString('en-IN') : new Date().toLocaleString('en-IN'),
            items: Array.isArray(o.items)
              ? o.items.map((it: any, index: number) => {
                  const unitP = Number(it.pricePerUnit ?? it.price ?? 100);
                  const qty = Number(it.quantity || 1);
                  return {
                    id: `item-${index}`,
                    productId: typeof it.productId === 'object' ? it.productId?._id : it.productId,
                    productTitle: typeof it.productId === 'object' ? (it.productId?.name || it.productId?.title) : (it.name || 'Product'),
                    sku: typeof it.productId === 'object' ? (it.productId?.sku || 'SKU') : 'SKU',
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
      const returnsRes = await api.getReturns();
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

      // 6. Get Invite Links
      const invRes = await api.getInviteLinks();
      if (invRes?.data && Array.isArray(invRes.data)) {
        setInviteLinks(invRes.data);
      }

      try {
        await loadNotifications();
      } catch (err: any) {
        console.warn('Notification load failed:', err.message);
      }
    } catch (err: any) {
      console.warn('Sync Wholesaler API note:', err.message);
      if (String(err?.message || '').toLowerCase().includes('unauthorized') || String(err?.message || '').includes('401')) {
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
        setInviteLinks([]);
        window.location.href = '/login';
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (getAuthToken()) {
        loadNotifications().catch((err: any) => console.warn('Notification refresh failed:', err.message));
      }
    }, 30000);
    return () => window.clearInterval(interval);
  }, []);

  const markNotificationsRead = async () => {
    try {
      await api.markAllNotificationsRead();
      setNotifications((current) => current.map((notification) => ({ ...notification, isRead: true })));
    } catch (err: any) {
      console.warn('Mark notifications read failed:', err.message);
    }
  };

  const login = async (identifier: string, password = 'ChangeThisPassword123') => {
    setIsLoading(true);
    try {
      const res = await api.login({ email: identifier, password, role: 'WHOLESALER' });
      if (res?.data?.token) {
        setAuthToken(res.data.token);
      }
      await refreshData();
    } catch (err: any) {
      setIsLoading(false);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    clearAuthToken();
    window.location.href = '/login';
  };

  const registerWholesaler = async (data: WholesalerAccountRegistration, passwordInput = 'ChangeThisPassword123') => {
    setIsLoading(true);
    try {
      await api.register({
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
      });

      setProfile((prev) => ({
        ...prev,
        businessName: data.businessName,
        ownerName: data.ownerName,
        email: data.email,
        phone: data.phone,
        city: data.city,
        state: data.state,
        pincode: data.pincode,
        accountStatus: 'PENDING_APPROVAL',
      }));

      addAuditLog(`Submitted wholesaler registration for admin approval: ${data.businessName} (${data.email}).`);
    } catch (err: any) {
      setIsLoading(false);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const generateInviteLink = async () => {
    try {
      const res = await api.createInviteLink();
      if (res?.data) {
        await refreshData();
        const retailerUrl =
          (import.meta as any).env?.VITE_RETAILER_URL ||
          (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_RETAILER_URL) ||
          'http://localhost:5174';
        return res.data.shareableUrl || `${retailerUrl}/register?inviteToken=${res.data.token}`;
      }
    } catch (err: any) {
      console.warn('Generate invite link error:', err.message);
    }
    return null;
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
        sku: prod.sku,
      });
      if (res?.data) {
        await refreshData();
      }
    } catch (err: any) {
      console.warn('Add product API note:', err.message);
      throw err;
    }
    addAuditLog(`Added new wholesale product: ${prod.title}`);
  };

  const updateProduct = async (id: string, updated: Partial<Product>) => {
    // Optimistically update local state for immediate UI feedback
    setRawProducts((prev) =>
      prev.map((p) => {
        if (p.id === id) {
          const nextStock = updated.stock !== undefined ? updated.stock : p.stock;
          const nextMoq = updated.minOrderQty !== undefined ? updated.minOrderQty : p.minOrderQty;
          return {
            ...p,
            ...updated,
            stock: nextStock,
            minOrderQty: nextMoq,
            isLowStock: nextStock <= nextMoq,
          };
        }
        return p;
      })
    );

    try {
      await api.updateProduct(id, {
        ...(updated.title && { name: updated.title, title: updated.title }),
        ...(updated.category && { categoryName: updated.category }),
        ...(updated.categoryId && { categoryId: updated.categoryId }),
        ...(updated.subcategoryId !== undefined && { subcategoryId: updated.subcategoryId }),
        ...(updated.costPrice !== undefined && { costPrice: updated.costPrice }),
        ...(updated.sellingPrice !== undefined && { sellingPrice: updated.sellingPrice, wholesalePrice: updated.sellingPrice, mrp: updated.sellingPrice }),
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
        ...(updated.sku !== undefined && { sku: updated.sku }),
      });
      await refreshData();
    } catch (err: any) {
      console.warn('Update product API note:', err.message);
    }
    addAuditLog(`Updated product ID: ${id}`);
  };

  const deleteProduct = async (id: string) => {
    try {
      await api.deleteProduct(id);
      await refreshData();
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
      await refreshData();
    } catch (err: any) {
      console.warn('Adjust inventory API fallback:', err.message);
      await updateProduct(productId, { stock: newStock });
    }

    const newLog: InventoryLog = {
      id: `log-${Date.now()}`,
      productId,
      productTitle: existing?.title || 'Product',
      sku: existing?.sku || 'SKU',
      changeAmount: delta,
      changeType: delta > 0 ? 'Manual Addition' : 'Manual Adjustment',
      resultingStock: newStock,
      reason,
      createdAt: new Date().toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }),
    };
    setInventoryLogs((prev) => [newLog, ...prev]);
    addAuditLog(`Stock adjusted for ${existing?.sku}: ${delta > 0 ? '+' : ''}${delta} (${reason})`);
  };

  const addCategory = async (cat: Omit<Category, 'id' | 'wholesalerId' | 'productCount' | 'slug' | 'icon'>) => {
    try {
      const res = await api.createCategory({ name: cat.name, description: cat.description || cat.name, imageUrl: cat.imageUrl, parentId: cat.parentId || null });
      if (res?.data) {
        await refreshData();
      }
    } catch (err: any) {
      console.warn('Add category API note:', err.message);
      throw err;
    }
    addAuditLog(`Created product category: ${cat.name}`);
  };

  const updateCategory = async (id: string, updated: Partial<Category>) => {
    try {
      await api.updateCategory(id, { name: updated.name, description: updated.description, imageUrl: updated.imageUrl, parentId: updated.parentId });
      await refreshData();
    } catch (err: any) {
      console.warn('Update category API note:', err.message);
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
      await refreshData();
      return { success: true };
    } catch (err: any) {
      console.warn('Delete category API note:', err.message);
      // If it is a client-side mock category or not found on server, remove locally
      if (!/^[0-9a-fA-F]{24}$/.test(id) || String(err?.message || '').includes('not found')) {
        setRawCategories((prev) => prev.filter((c) => c.id !== id));
        return { success: true };
      }
      return { success: false, message: err?.message || 'Unable to delete category.' };
    }
  };

  const updateRetailerLimit = (id: string, newLimit: number, newDiscount: number) => {
    setRawRetailers((prev) => prev.map((r) => (r.id === id ? { ...r, creditLimit: newLimit, discountPercent: newDiscount } : r)));
    addAuditLog(`Updated credit terms for retailer ID: ${id}`);
  };

  const updateOrderStatus = async (id: string, status: OrderStatus, tracking?: string) => {
    const formatStatus = status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
    try {
      await api.updateOrderStatus(id, formatStatus);
      await refreshData();
    } catch (err: any) {
      console.warn('Update order status API note:', err.message);
      throw err;
    }
    addAuditLog(`Updated order status to ${status} for Order ID: ${id}`);
  };

  const updateReturnStatus = async (returnId: string, status: 'APPROVED' | 'REJECTED') => {
    try {
      await api.updateReturnStatus(returnId, status);
      await refreshData();
      addAuditLog(`Updated return request ${returnId} to ${status}`);
    } catch (err: any) {
      console.warn('Update return status API note:', err.message);
      throw err;
    }
  };

  const toggleTwoFactor = () => {
    setProfile((prev) => {
      const nextVal = !prev.twoFactorEnabled;
      addAuditLog(`Two-Factor Authentication ${nextVal ? 'Enabled' : 'Disabled'}`);
      return { ...prev, twoFactorEnabled: nextVal };
    });
  };

  const generateNewApiKey = () => {
    const newKey = `wh_live_pk_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;
    setProfile((prev) => ({ ...prev, apiKey: newKey }));
    addAuditLog(`Generated new ERP integration API Key`);
  };

  const updateSubscription = (plan: 'MONTHLY' | 'ANNUAL') => {
    setProfile((prev) => ({ ...prev, subscriptionPlan: plan, subscriptionStatus: 'ACTIVE' }));
    addAuditLog(`Upgraded subscription plan to ${plan} (₹${plan === 'MONTHLY' ? '300/mo' : '3000/yr'})`);
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
        inviteLinks,
        isLoading,
        login,
        registerWholesaler,
        generateInviteLink,
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
        toggleTwoFactor,
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
  inviteLinks: [],
  isLoading: false,
  updateReturnStatus: async () => undefined,
  login: async () => undefined,
  registerWholesaler: async () => undefined,
  generateInviteLink: async () => null,
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
  toggleTwoFactor: () => undefined,
  generateNewApiKey: () => undefined,
  updateSubscription: () => undefined,
  terminateSession: () => undefined,
  addAuditLog: () => undefined,
};

export const useWholesaler = () => {
  const context = useContext(WholesalerContext);
  return context ?? fallbackWholesalerContext;
};
