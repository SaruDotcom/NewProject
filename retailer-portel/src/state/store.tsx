import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  api,
  clearAuthToken,
  getAuthToken,
  setAuthToken,
  type ApiCategory,
  type ApiNotification,
  type ApiOrder,
  type ApiOrderListData,
  type ApiProduct,
  type ApiWholesaler,
} from "@/api/api";
import { retailerQueryKeys } from "@/lib/query-client";
import { getStoredReferralAttribution } from "@/lib/referral-attribution";

const GUEST_CART_KEY = "nexora_retailer_guest_cart";

function readLocalCart(): CartLine[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(GUEST_CART_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((item) => item?.productId && typeof item.quantity === "number");
    }
  } catch {
    // ignore
  }
  return [];
}

function saveLocalCart(cart: CartLine[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(GUEST_CART_KEY, JSON.stringify(cart));
  } catch {
    // ignore
  }
}

export type Relationship = "Connected";

export type Product = {
  id: string;
  name: string;
  brand: string;
  category: string;
  wholesalerId: string;
  price: number;
  mrp: number;
  moq: number;
  unit?: string;
  stock: number;
  rating: number;
  image: number;
  description: string;
  specs: Record<string, string>;
  imageUrl?: string;
  images?: string[];
  pricingTiers?: Array<{ id: string; minQty: number; pricePerUnit: number }>;
  sizes?: string[];
  colors?: string[];
  colorVariants?: Array<{ color: string; sku?: string; images: string[] }>;
  sizeChart?: {
    unit: string;
    measurements: Array<{ size: string; measurements: Record<string, number> }>;
  } | null;
  additionalOptions?: Array<{ name: string; value: string }>;
  categoryAttributes?: Record<string, any>;
};

export type Category = {
  id: string;
  name: string;
  description: string;
  count?: number;
  slug?: string;
  imageUrl?: string;
  parentId?: string;
  parentName?: string;
  displayPath?: string;
  path?: Array<{ id: string; name: string; slug: string }>;
  level?: number;
};

export type BannerSlide = {
  id: string;
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

export type Wholesaler = {
  id: string;
  name: string;
  initials: string;
  logo?: string;
  verified: boolean;
  rating: number;
  location: string;
  products: number;
  categories: string[];
  delivery: string;
  relationship: Relationship;
  about: string;
  ownerName?: string;
  description?: string;
  businessName?: string;
  businessCategory?: string;
  activeStoreTheme?: "DEFAULT" | "ROYAL" | "FESTIVE" | "MINIMAL";
  banners?: BannerSlide[];
};

export type OrderItem = {
  productId: string;
  name: string;
  sku?: string;
  imageUrl?: string;
  quantity: number;
  pricePerUnit: number;
  subtotal: number;
  total?: number;
  hsnCode?: string;
  cgst?: number | null;
  sgst?: number | null;
  igst?: number | null;
  gstAmount?: number;
  priceIncludesTax?: boolean;
  product?: Product;
};

export type OrderStatus = "Pending" | "Confirmed" | "Processing" | "Shipped" | "Delivered" | "Cancelled";
export type Order = {
  id: string;
  orderNumber?: string;
  date: string;
  status: OrderStatus;
  cancellationReason?: string | undefined;
  cancellationNote?: string | undefined;
  wholesalerId: string;
  total: number;
  items: OrderItem[];
  paymentMethod?: string | undefined;
  isCreditOrder?: boolean | undefined;
  creditDueDate?: string | undefined;
  creditPeriodDays?: number | undefined;
  creditPaymentStatus?: "PENDING" | "PAID" | "OVERDUE" | undefined;
  creditSettledAt?: string | undefined;
};

export type RetailerProfile = {
  businessName: string;
  ownerName: string;
  phone: string;
  email: string;
  gstRegistered: boolean;
  gstNumber: string;
  businessType: string;
  category: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  profileComplete?: boolean;
};

export type NotificationItem = { id: string; title: string; body: string; time: string; unread: boolean };
export type CartLine = { productId: string; quantity: number; color?: string };

export type UserSession = {
  id: string;
  email: string;
};

export type UserData = {
  linkedWholesalerId: string;
  profile: RetailerProfile;
  relationships: Record<string, "Connected">;
  orders: Order[];
  cart: CartLine[];
  wishlist: string[];
  recentlyViewed: string[];
  notifications: NotificationItem[];
};

export type Store = {
  currentUser: UserSession | null;
  isLoggedIn: boolean;
  isLoading: boolean;
  linkedWholesalerId: string;
  linkedWholesaler: Wholesaler | null;
  connectedWholesalers: Wholesaler[];
  products: Product[];
  categories: Category[];
  cart: CartLine[];
  cartCount: number;
  uniqueCartCount: number;
  wishlist: string[];
  relationships: Record<string, "Connected">;
  orders: Order[];
  returns: any[];
  retailerProfile: RetailerProfile;
  unread: number;
  notifications: NotificationItem[];
  recentlyViewed: string[];
  dashboard: Record<string, unknown> | null;
  addedToCartProduct: { product: Product; quantity: number; color?: string } | null;
  clearAddedToCartProduct: () => void;
  login: (email: string, password?: string, targetWholesalerId?: string) => Promise<void>;
  logout: () => Promise<void>;
  connectWholesaler: (wholesalerId: string, showToast?: boolean) => Promise<void>;
  addToCart: (id: string, q?: number, color?: string) => void;
  setQuantity: (id: string, q: number) => void;
  removeCart: (id: string) => void;
  toggleWishlist: (id: string) => void;
  saveProfile: (profile: RetailerProfile) => Promise<void>;
  placeOrder: (paymentMethod?: string, couponCode?: string) => Promise<boolean>;
  markRead: () => void;
  addRecentlyViewed: (id: string) => void;
  refreshOrders: () => Promise<void>;
  refreshData: (silent?: boolean) => Promise<void>;
};

const StoreContext = createContext<Store | undefined>(undefined);

const emptyProfile: RetailerProfile = {
  businessName: "",
  ownerName: "",
  phone: "",
  email: "",
  gstRegistered: false,
  gstNumber: "",
  businessType: "",
  category: "",
  address: "",
  city: "",
  state: "",
  pincode: "",
};

const toInitials = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2 && parts[0] && parts[1]) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return (name || "RT").slice(0, 2).toUpperCase();
};

function normalizeProfile(data: Record<string, unknown> | undefined): RetailerProfile {
  const user = (data || {}) as Record<string, any>;
  const profile = (typeof user["retailerProfile"] === "object" && user["retailerProfile"] !== null ? user["retailerProfile"] : user) as Record<string, any>;
  const addressObj = typeof profile["address"] === "object" && profile["address"] !== null ? (profile["address"] as Record<string, any>) : {};
  const addressText = typeof profile["address"] === "string" ? String(profile["address"]) : [addressObj["street"], addressObj["addressLine1"], addressObj["addressLine2"]].filter(Boolean).join(", ");

  return {
    businessName: String(profile["businessName"] || profile["companyName"] || ""),
    ownerName: String(profile["ownerName"] || user["name"] || profile["name"] || profile["fullName"] || ""),
    phone: String(user["phone"] || profile["phone"] || ""),
    email: String(user["email"] || profile["email"] || ""),
    gstRegistered: Boolean(profile["gstRegistered"] || profile["gstStatus"] === "REGISTERED" || profile["gstStatus"] === "gst_registered"),
    gstNumber: String(profile["gstNumber"] || profile["gstin"] || ""),
    businessType: String(profile["businessType"] || ""),
    category: String(profile["category"] || ""),
    address: addressText || String(profile["shopAddress"] || ""),
    city: String((profile["city"] as string) || (addressObj["city"] as string) || ""),
    state: String((profile["state"] as string) || (addressObj["state"] as string) || ""),
    pincode: String((profile["pincode"] as string) || (addressObj["postalCode"] as string) || (addressObj["pincode"] as string) || ""),
    profileComplete: Boolean(profile["profileComplete"]),
  };
}

function cleanImageUrl(img: any): string {
  if (!img) return "";
  if (typeof img === "string") return img.trim();
  if (typeof img === "object") {
    if (img.url && typeof img.url === "string") return img.url.trim();
    const keys = Object.keys(img).filter((k) => /^\d+$/.test(k)).sort((a, b) => Number(a) - Number(b));
    if (keys.length > 5) {
      return keys.map((k) => img[k]).join("").trim();
    }
  }
  return "";
}

export function mapProduct(item: ApiProduct, index = 0, categoryMap?: Map<string, string>): Product {
  let categoryName = "Grocery & Staples";
  if (typeof item.category === "object" && item.category !== null && (item.category as any).name) {
    categoryName = String((item.category as any).name);
  } else if (typeof item.category === "string" && item.category.trim()) {
    const rawCat = item.category.trim();
    if (categoryMap && categoryMap.has(rawCat)) {
      categoryName = categoryMap.get(rawCat)!;
    } else if (categoryMap && categoryMap.has(rawCat.toLowerCase())) {
      categoryName = categoryMap.get(rawCat.toLowerCase())!;
    } else if (/^[0-9a-fA-F]{24}$/.test(rawCat)) {
      categoryName = "General";
    } else {
      categoryName = rawCat;
    }
  } else if (item.categoryId && categoryMap && categoryMap.has(String(item.categoryId))) {
    categoryName = categoryMap.get(String(item.categoryId))!;
  } else if (item.categoryId && typeof item.categoryId === "object" && (item.categoryId as any).name) {
    categoryName = String((item.categoryId as any).name);
  }

  const rawImages = Array.isArray(item.images) ? item.images : [];
  const cleanedImages = rawImages.map(cleanImageUrl).filter(Boolean);
  const cleanedMain = cleanImageUrl(item.imageUrl) || cleanedImages[0] || "";
  const allImages = [...new Set([cleanedMain, ...cleanedImages].filter(Boolean))];

  const product: Product = {
    id: item._id || item.id || `product-${index}`,
    name: item.name || item.title || "Untitled product",
    brand: item.brand || "Verified brand",
    category: categoryName,
    wholesalerId: typeof item.wholesalerId === "object" && item.wholesalerId !== null
      ? String(item.wholesalerId._id || item.wholesalerId.id || "")
      : item.wholesalerId || "",
    price: Number(item.wholesalePrice ?? item.price ?? item.retailerPrice ?? item.mrp ?? 0),
    mrp: Number(item.mrp ?? item.wholesalePrice ?? item.price ?? 0),
    moq: Number(item.moq ?? item.minOrderQty ?? 1),
    unit: item.unit || 'piece',
    stock: Number(item.stock ?? item.quantity ?? 0),
    rating: 4.7,
    image: index % 6,
    description: item.description || "Trade-ready product available from your connected wholesaler.",
    specs: {
      Unit: item.unit || "piece",
      Dispatch: "Within 24 hours",
      MOQ: String(item.moq ?? item.minOrderQty ?? 1),
    },
  };

  if (cleanedMain) product.imageUrl = cleanedMain;
  if (allImages.length > 0) product.images = allImages;
  if (item.pricingTiers) product.pricingTiers = item.pricingTiers;
  if (item.sizes) product.sizes = item.sizes;
  const variants = Array.isArray(item.colorVariants)
    ? item.colorVariants.map((variant) => ({
        color: String(variant.color || variant.name || "").trim(),
        ...(variant.sku ? { sku: String(variant.sku).trim() } : {}),
        images: Array.isArray(variant.images)
          ? [...new Set(variant.images.map(cleanImageUrl).filter(Boolean))]
          : [],
      })).filter((variant) => variant.color)
    : [];
  const colors = Array.isArray(item.colors) ? item.colors : [];
  const variantColors = variants.map((variant) => variant.color);
  if (colors.length || variantColors.length) {
    product.colors = [...new Set([...colors, ...variantColors])];
  }
  if (variants.length) {
    product.colorVariants = variants;
  }
  if (item.sizeChart) product.sizeChart = item.sizeChart;
  if (item.additionalOptions) product.additionalOptions = item.additionalOptions;
  if (item.categoryAttributes) product.categoryAttributes = item.categoryAttributes;

  return product;
}

function mapCategory(item: ApiCategory): Category {
  const cat: Category = {
    id: item._id || item.id || item.slug || item.name || "category",
    name: item.name || "Category",
    description: item.description || "Trade products from your connected wholesaler.",
    count: item.count || (item as any).productCount || (item as any).products || 0,
    imageUrl: (item as any).imageUrl || (item as any).image || undefined,
    parentId: (item as any).parentId ? (typeof (item as any).parentId === 'object' ? (item as any).parentId?._id : String((item as any).parentId)) : undefined,
    parentName: (item as any).parent?.name,
    displayPath: (item as any).displayPath || item.name,
    path: (item as any).path || [],
    level: (item as any).level || 0,
  };
  const slugVal = item.slug || item.name;
  if (slugVal) cat.slug = slugVal;
  return cat;
}

function mapWholesaler(item: ApiWholesaler | null | undefined): Wholesaler | null {
  if (!item) return null;

  const rawId = String(item._id || item.id || "");
  const businessName = item.businessName || item.name || "Connected wholesaler";

  const rawBanners = Array.isArray(item.banners) ? item.banners : [];
  const banners: BannerSlide[] = rawBanners.map((b, idx) => ({
    id: String(b.id || b._id || `banner-${idx}`),
    title: b.title || "",
    subtitle: b.subtitle || "",
    tag: b.tag || "",
    discountBadge: b.discountBadge || "",
    imageUrl: b.imageUrl || "",
    ctaText: b.ctaText || "Explore Catalog",
    ctaLink: b.ctaLink || "/products",
    category: b.category || "",
    active: b.active !== false,
    order: Number(b.order ?? idx),
  }));

  const result: Wholesaler = {
    id: rawId,
    name: businessName,
    initials: toInitials(businessName),
    logo: item.businessLogoUrl || (item as any).logo || "",
    verified: true,
    rating: Number(item.rating || 4.8),
    location: item.address?.["city"] || item.address?.["state"] || (item as any).city || "India",
    products: 0,
    categories: Array.isArray((item as any).categories) ? (item as any).categories : [],
    delivery: "1-2 day dispatch",
    relationship: "Connected",
    about: item.description || "Verified wholesaler connected to your retail account.",
    description: item.description || "",
    businessName,
    businessCategory: item.businessCategory || "",
    activeStoreTheme: item.activeStoreTheme || "DEFAULT",
    banners,
  };

  if (item.name) result.ownerName = item.name;
  return result;
}

export function getCategoryHierarchy(
  item: OrderItem,
  storeProducts: Product[],
  storeCategories: Category[]
): string {
  const linkedProduct = item.product || storeProducts.find((p) => String(p.id) === String(item.productId));
  const prodObj: any = item.product || linkedProduct;

  const names: string[] = [];

  if (prodObj) {
    const catObj = prodObj.categoryId || prodObj.category;
    const subCatObj = prodObj.subcategoryId || prodObj.subCategory;
    const subSubCatObj = prodObj.subSubcategoryId || prodObj.subSubCategory;

    if (catObj && typeof catObj === "object" && catObj.name) {
      names.push(catObj.name);
    }
    if (subCatObj && typeof subCatObj === "object" && subCatObj.name) {
      names.push(subCatObj.name);
    }
    if (subSubCatObj && typeof subSubCatObj === "object" && subSubCatObj.name) {
      names.push(subSubCatObj.name);
    }

    if (names.length > 0) {
      return names.join(" > ");
    }

    if (typeof linkedProduct?.category === "string" && linkedProduct.category.trim() && linkedProduct.category !== "General") {
      if (!/^[0-9a-fA-F]{24}$/.test(linkedProduct.category.trim())) {
        names.push(linkedProduct.category.trim());
      }
    }
  }

  if (names.length === 0 && storeCategories && storeCategories.length > 0) {
    const firstCatName = typeof prodObj?.category === "string" ? prodObj.category : "";
    const matchedCat = storeCategories.find(
      (c) => c.name === firstCatName || String(c.id) === String(prodObj?.categoryId) || String(c.id) === String(prodObj?.subcategoryId)
    );

    if (matchedCat) {
      if (matchedCat.displayPath && matchedCat.displayPath.includes(">")) {
        return matchedCat.displayPath;
      }
      if (matchedCat.path && matchedCat.path.length > 0) {
        return matchedCat.path.map((p) => p.name).join(" > ");
      }
      const chain: string[] = [matchedCat.name];
      let curr = matchedCat;
      while (curr.parentId) {
        const parent = storeCategories.find((c) => String(c.id) === String(curr.parentId));
        if (!parent) break;
        chain.unshift(parent.name);
        curr = parent;
      }
      return chain.join(" > ");
    }
  }

  if (names.length > 0) {
    return names.join(" > ");
  }

  return "General";
}

export function mapOrder(item: ApiOrder): Order {
  const mongoId = String(item._id || item.id || "");
  const orderNumber = item.orderNumber || (item as any).orderNo || (mongoId ? `ORD-${mongoId.slice(-6).toUpperCase()}` : "order");
  const id = mongoId || orderNumber;
  const status = String(item.orderStatus || item.status || "PENDING").toUpperCase();

  const mappedItems: OrderItem[] = (item.items || []).map((line: any, idx: number) => {
    let prodObj: any = null;
    let pId = "";

    if (line.productId && typeof line.productId === "object") {
      prodObj = line.productId;
      pId = String(prodObj._id || prodObj.id || "");
    } else {
      pId = String(line.productId || "");
    }

    const name = line.name || prodObj?.name || prodObj?.title || "Product";
    const imageUrl = line.imageUrl || (prodObj?.images && prodObj.images.length > 0 ? prodObj.images[0] : "") || prodObj?.imageUrl || "";
    const quantity = Number(line.quantity || 0);
    const pricePerUnit = Number(line.pricePerUnit ?? line.price ?? prodObj?.wholesalePrice ?? prodObj?.price ?? 0);
    const subtotal = Number(line.subtotal ?? (pricePerUnit * quantity));
    const total = Number(line.total ?? subtotal);

    const itemObj: OrderItem = {
      productId: pId,
      name,
      sku: line.sku || prodObj?.sku || "",
      imageUrl,
      quantity,
      pricePerUnit,
      subtotal,
      total,
      hsnCode: line.hsnCode || '',
      cgst: line.cgst ?? null,
      sgst: line.sgst ?? null,
      igst: line.igst ?? null,
      gstAmount: Number(line.gstAmount || 0),
      priceIncludesTax: Boolean(line.priceIncludesTax),
    };
    if (prodObj) {
      itemObj.product = mapProduct(prodObj, idx);
    }

    return itemObj;
  });

  const isCreditOrder = Boolean(item.isCreditOrder || item.paymentMethod === "CREDIT");
  const creditPaymentStatus = item.creditPaymentStatus || (isCreditOrder ? "PENDING" : undefined);
  const wholesalerId = typeof item.wholesalerId === "object" && item.wholesalerId !== null
    ? String((item.wholesalerId as any)._id || (item.wholesalerId as any).id || "")
    : String(item.wholesalerId || "connected-wholesaler");

  return {
    id,
    orderNumber,
    date: item.createdAt ? new Date(item.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "Today",
    status:
      status === "PENDING" ? "Pending" :
      status === "CONFIRMED" ? "Confirmed" :
      status === "PROCESSING" ? "Processing" :
      status === "SHIPPED" || status === "DISPATCHED" ? "Shipped" :
      status === "DELIVERED" ? "Delivered" :
      status === "CANCELLED" ? "Cancelled" : "Pending",
    cancellationReason: item.cancellationReason || "",
    cancellationNote: item.cancellationNote || "",
    wholesalerId,
    total: Number(item.grandTotal ?? item.total ?? (item as any).totalAmount ?? 0),
    items: mappedItems,
    paymentMethod: item.paymentMethod || item.paymentMode || (isCreditOrder ? "CREDIT" : "COD"),
    isCreditOrder,
    creditDueDate: item.creditDueDate ? new Date(item.creditDueDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : undefined,
    creditPeriodDays: item.creditPeriodDays ? Number(item.creditPeriodDays) : undefined,
    creditPaymentStatus,
    creditSettledAt: item.creditSettledAt ? new Date(item.creditSettledAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : undefined,
  };
}

export function getApiOrderItems(response: { data?: ApiOrder[] | ApiOrderListData } | null | undefined): ApiOrder[] {
  const data = response?.data;
  if (Array.isArray(data)) return data;
  return data && Array.isArray(data.items) ? data.items : [];
}

function mapNotification(item: ApiNotification): NotificationItem {
  return {
    id: item._id || item.id || item.title || "notification",
    title: item.title || "Update",
    body: item.message || item.body || "New update",
    time: item.createdAt ? new Date(item.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "Now",
    unread: item.isRead === false || item.read === false,
  };
}

export function resolveWholesalerId(input?: string | null): string {
  if (!input) return "";
  return String(input);
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [currentUser, setCurrentUser] = useState<UserSession | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [profile, setProfile] = useState<RetailerProfile>(emptyProfile);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [returns, setReturns] = useState<any[]>([]);
  const [cart, setCart] = useState<CartLine[]>(() => readLocalCart());
  const cartRef = useRef<CartLine[]>([]);
  cartRef.current = cart;
  const cartCount = useMemo(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart]);
  const uniqueCartCount = cart.length;
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [recentlyViewed, setRecentlyViewed] = useState<string[]>([]);
  const [dashboard, setDashboard] = useState<Record<string, unknown> | null>(null);
  const [linkedWholesaler, setLinkedWholesaler] = useState<Wholesaler | null>(null);
  const [relationships, setRelationships] = useState<Record<string, "Connected">>({});

  const syncSession = useCallback(async (silent = false) => {
    const token = getAuthToken();
    if (!token) {
      setCurrentUser(null);
      setProfile(emptyProfile);
      setDashboard(null);

      // Restore cart from local storage for guest
      const localCart = readLocalCart();
      setCart(localCart);
      cartRef.current = localCart;

      // Check if user came with a referral attribution
      const storedRef = getStoredReferralAttribution();
      if (storedRef?.code) {
        try {
          if (!silent) setIsLoading(true);
          const [refRes, prodRes] = await Promise.all([
            api.getReferral(storedRef.code).catch(() => null),
            api.getReferralProducts(storedRef.code, { limit: 200 }).catch(() => null),
          ]);

          let mappedWs: Wholesaler | null = null;
          if (refRes?.data?.wholesaler) {
            mappedWs = mapWholesaler(refRes.data.wholesaler);
            setLinkedWholesaler(mappedWs);
          }

          const rawProducts = Array.isArray(prodRes?.data)
            ? prodRes.data
            : Array.isArray((prodRes as any)?.data?.products)
              ? (prodRes as any).data.products
              : [];

          if (rawProducts.length > 0) {
            const wsId = String(mappedWs?.id || rawProducts[0]?.wholesalerId || "connected-wholesaler");
            if (mappedWs) {
              mappedWs.id = wsId;
            }
            setRelationships({ [wsId]: "Connected" });

            const publicProducts = rawProducts.map((item: any, idx: number) => {
              const mapped = mapProduct(item, idx);
              return {
                ...mapped,
                wholesalerId: wsId,
              };
            });
            setProducts(publicProducts);

            const catNames = Array.from(new Set(publicProducts.map((p: any) => p.category).filter(Boolean)));
            const publicCategories = catNames.map((name: any) => ({
              id: String(name),
              name: String(name),
              description: `${name} category`,
            }));
            setCategories(publicCategories);
          } else if (mappedWs) {
            setRelationships({ [mappedWs.id]: "Connected" });
          }
        } catch (e) {
          console.warn("Could not load referral public catalog", e);
        } finally {
          if (!silent) setIsLoading(false);
        }
      } else {
        setLinkedWholesaler(null);
        setRelationships({});
      }
      return;
    }

    try {
      if (!silent) setIsLoading(true);

      const me = await api.getMe();
      const user = (me?.data as Record<string, any>) || {};
      const email = String(user["email"] || "");
      const userId = String(user["_id"] || user["id"] || email || "retailer");
      localStorage.setItem("nexora_retailer_user_id", userId);
      setCurrentUser({ id: userId, email });
      setProfile(normalizeProfile(user));

      // Sync any guest cart items added before logging in
      const guestCart = readLocalCart();
      if (guestCart.length > 0) {
        for (const line of guestCart) {
          await api.addToCart(line.productId, line.quantity, line.color).catch(() => undefined);
        }
        try {
          localStorage.removeItem(GUEST_CART_KEY);
        } catch {}
      }

      const fetchUserData = <T,>(resource: string, queryFn: () => Promise<T>, staleTime?: number) =>
        queryClient.fetchQuery({
          queryKey: retailerQueryKeys.resource(userId, resource),
          queryFn,
          ...(staleTime !== undefined && { staleTime }),
        });

      const [dashboardRes, wholesalerRes, productsRes, categoriesRes, cartRes, wishlistRes, ordersRes, notificationsRes, returnsRes] = await Promise.all([
        fetchUserData("dashboard", () => api.getDashboard()).catch(() => null),
        fetchUserData("wholesaler", () => api.getConnectedWholesaler(), 0).catch(() => null),
        fetchUserData("products", () => api.getProducts({ limit: 200 })).catch(() => ({ data: [] })),
        fetchUserData("categories", () => api.getCategories({ limit: 200 })).catch(() => ({ data: [] })),
        fetchUserData("cart", () => api.getCart()).catch(() => ({ data: { items: [] } })),
        fetchUserData("wishlist", () => api.getWishlist()).catch(() => ({ data: [] })),
        fetchUserData("orders", () => api.getOrders({ limit: 200 })).catch(() => ({ data: [] })),
        fetchUserData("notifications", () => api.getNotifications()).catch(() => ({ data: [] })),
        fetchUserData("returns", () => api.getReturns()).catch(() => ({ data: [] })),
      ]);

      const connectedWholesalerData = mapWholesaler((wholesalerRes as { data?: ApiWholesaler } | null)?.data ?? null);
      setDashboard((dashboardRes as { data?: Record<string, unknown> } | null)?.data ?? null);
      setLinkedWholesaler(connectedWholesalerData);
      if (connectedWholesalerData) {
        setRelationships({ [connectedWholesalerData.id]: "Connected" });
      } else {
        setRelationships({});
      }

      const nextCategories = Array.isArray((categoriesRes as { data?: ApiCategory[] })?.data)
        ? ((categoriesRes as { data?: ApiCategory[] }).data || []).map(mapCategory)
        : [];
      setCategories(nextCategories);

      const categoryMap = new Map<string, string>();
      nextCategories.forEach((c) => {
        categoryMap.set(c.id, c.name);
        categoryMap.set(c.id.toLowerCase(), c.name);
        categoryMap.set(c.name, c.name);
        categoryMap.set(c.name.toLowerCase(), c.name);
      });

      const nextProducts = Array.isArray((productsRes as { data?: ApiProduct[] })?.data)
        ? ((productsRes as { data?: ApiProduct[] }).data || []).map((item, index) => {
            const product = mapProduct(item, index, categoryMap);
            return {
              ...product,
              wholesalerId: product.wholesalerId === "connected-wholesaler" ? connectedWholesalerData?.id || "" : product.wholesalerId,
            };
          })
        : [];
      setProducts(nextProducts);

      const cartItems = ((cartRes as { data?: { items?: Array<{ productId: string; quantity: number; color?: string }> } } | null)?.data?.items || []) as Array<{ productId: string; quantity: number; color?: string }>;
      const mappedCart = cartItems.map((item) => ({ productId: String(item.productId), quantity: Number(item.quantity || 0), color: item.color }));
      setCart(mappedCart);
      cartRef.current = mappedCart;
      saveLocalCart(mappedCart);

      const wishlistItems = ((wishlistRes as { data?: Array<{ _id?: string; productId?: string }> } | null)?.data || []) as Array<{ _id?: string; productId?: string }>;
      setWishlist(wishlistItems.map((item) => String(item.productId || item._id || "")));

      setOrders(getApiOrderItems(ordersRes as { data?: ApiOrder[] | ApiOrderListData } | null).map(mapOrder));

      const nextNotifications = Array.isArray((notificationsRes as { data?: ApiNotification[] })?.data)
        ? ((notificationsRes as { data?: ApiNotification[] }).data || []).map(mapNotification)
        : [];
      setNotifications(nextNotifications);

      const nextReturns = Array.isArray((returnsRes as any)?.data) ? (returnsRes as any).data : [];
      setReturns(nextReturns);
    } catch (error) {
      console.warn("Unable to sync retailer session", error);
      clearAuthToken();
      setCurrentUser(null);
      setProfile(emptyProfile);
      setDashboard(null);
      setLinkedWholesaler(null);
      setRelationships({});
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [queryClient]);

  const refreshOrders = useCallback(async () => {
    const token = getAuthToken();
    if (!token) return;
    try {
      const userId = currentUser?.id || localStorage.getItem("nexora_retailer_user_id");
      if (userId) {
        await queryClient.invalidateQueries({
          queryKey: retailerQueryKeys.resource(userId, "orders"),
        });
      }
      const ordersRes = await api.getOrders({ limit: 200 }).catch(() => null);
      if (ordersRes) setOrders(getApiOrderItems(ordersRes).map(mapOrder));
    } catch {
      // Silent catch for background polling
    }
  }, [currentUser?.id, queryClient]);

  const refreshLinkedWholesaler = useCallback(async () => {
    try {
      const token = getAuthToken();
      if (token) {
        const response = await api.getConnectedWholesaler();
        setLinkedWholesaler(mapWholesaler(response?.data ?? null));
        return;
      }

      const referralCode = getStoredReferralAttribution()?.code;
      if (!referralCode) return;
      const response = await api.getReferral(referralCode);
      setLinkedWholesaler(mapWholesaler(response?.data?.wholesaler ?? null));
    } catch (error) {
      console.warn("Could not refresh the connected wholesaler storefront theme", error);
    }
  }, []);

  const refreshCatalog = useCallback(async () => {
    const token = getAuthToken();
    const userId =
      currentUser?.id ||
      localStorage.getItem("nexora_retailer_user_id");
    if (!token || !userId) return;

    try {
      const [productsRes, categoriesRes] = await Promise.all([
        queryClient.fetchQuery({
          queryKey: retailerQueryKeys.resource(userId, "products"),
          queryFn: () => api.getProducts({ limit: 200 }),
        }),
        queryClient.fetchQuery({
          queryKey: retailerQueryKeys.resource(userId, "categories"),
          queryFn: () => api.getCategories({ limit: 200 }),
        }),
      ]);
      const nextCategories = Array.isArray(categoriesRes?.data)
        ? categoriesRes.data.map(mapCategory)
        : [];
      setCategories(nextCategories);

      const categoryMap = new Map<string, string>();
      nextCategories.forEach((category) => {
        categoryMap.set(category.id, category.name);
        categoryMap.set(category.id.toLowerCase(), category.name);
        categoryMap.set(category.name, category.name);
        categoryMap.set(category.name.toLowerCase(), category.name);
      });

      const nextProducts = Array.isArray(productsRes?.data)
        ? productsRes.data.map((item, index) => {
            const product = mapProduct(item, index, categoryMap);
            return {
              ...product,
              wholesalerId:
                product.wholesalerId === "connected-wholesaler"
                  ? linkedWholesaler?.id || ""
                  : product.wholesalerId,
            };
          })
        : [];
      setProducts(nextProducts);
    } catch (error) {
      console.warn("Could not refresh the retailer catalog", error);
    }
  }, [currentUser?.id, linkedWholesaler?.id, queryClient]);

  useEffect(() => {
    void syncSession();

    // Auto-poll orders every 30 seconds for real-time order status updates (Pending -> Confirmed, etc.)
    const interval = setInterval(() => {
      void refreshOrders();
    }, 30000);
    const themeInterval = setInterval(() => {
      void refreshLinkedWholesaler();
    }, 60000);
    const catalogInterval = setInterval(() => {
      void refreshCatalog();
    }, 30000);

    const handleFocus = () => {
      if (document.visibilityState === "hidden") return;
      void refreshOrders();
      void refreshLinkedWholesaler();
      void refreshCatalog();
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleFocus);

    return () => {
      clearInterval(interval);
      clearInterval(themeInterval);
      clearInterval(catalogInterval);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleFocus);
    };
  }, [syncSession, refreshOrders, refreshLinkedWholesaler, refreshCatalog]);

  const linkedWholesalerId = linkedWholesaler?.id || "";
  const unread = notifications.filter((item) => item.unread).length;
  const invalidateUserData = useCallback((...resources: string[]) => {
    if (!currentUser?.id) return;
    resources.forEach((resource) => {
      void queryClient.invalidateQueries({
        queryKey: retailerQueryKeys.resource(currentUser.id, resource),
      });
    });
  }, [currentUser?.id, queryClient]);

  const logout = useCallback(async () => {
    try {
      await api.logout().catch(() => undefined);
    } finally {
      queryClient.clear();
      queryClient.clear();
      clearAuthToken();
      localStorage.clear();
      sessionStorage.clear();
      setCurrentUser(null);
      setProfile(emptyProfile);
      setProducts([]);
      setCategories([]);
      setOrders([]);
      setCart([]);
      setWishlist([]);
      setNotifications([]);
      setDashboard(null);
      setLinkedWholesaler(null);
      setRelationships({});
      toast.success("Signed out successfully");
    }
  }, [queryClient]);

  const login = useCallback(async (identifier: string, password?: string, targetWholesalerId?: string) => {
    const normalized = identifier.trim();
    const isPhone = /^\d{10}$/.test(normalized);
    const loginPayload: Parameters<typeof api.login>[0] = {};
    if (normalized.includes("@")) loginPayload.email = normalized;
    else if (!isPhone) loginPayload.loginId = normalized;
    else {
      loginPayload.mobile = normalized;
      loginPayload.phone = normalized;
    }
    if (password) loginPayload.password = password;

    const result = await api.login(loginPayload);
    const token = result?.data?.token || result?.data?.accessToken;
    if (token) {
      setAuthToken(token);
    }

    if (targetWholesalerId) {
      await api.acceptInvitation(targetWholesalerId).catch(() => undefined);
    }

    await syncSession();
    toast.success("Signed in successfully");
  }, [syncSession]);

  const connectWholesaler = useCallback(async (wholesalerId: string, showToast = true) => {
    const token = wholesalerId || new URLSearchParams(window.location.search).get("invite") || new URLSearchParams(window.location.search).get("token");
    if (token) {
      await api.acceptInvitation(token).catch(() => undefined);
    }
    invalidateUserData("wholesaler", "products", "categories", "dashboard");
    await syncSession(true);
    if (showToast) {
      toast.success("Wholesaler connection updated");
    }
  }, [invalidateUserData, syncSession]);

  const [addedToCartProduct, setAddedToCartProduct] = useState<{ product: Product; quantity: number; color?: string } | null>(null);

  const clearAddedToCartProduct = useCallback(() => {
    setAddedToCartProduct(null);
  }, []);

  const addToCart = useCallback(async (id: string, q?: number, color?: string) => {
    const product = products.find((item) => item.id === id);
    if (!product) return;

    if (product.stock <= 0) {
      toast.error(`${product.name} is currently out of stock`);
      return;
    }

    const minQty = Math.max(1, Math.ceil(product.moq || 1));
    const quantity = Math.max(minQty, typeof q === 'number' && Number.isInteger(q) ? q : minQty);
    const token = getAuthToken();

    const applyCartUpdateAndToast = () => {
      const currentCart = cartRef.current;
      const existing = currentCart.find(
        (item) => item.productId === id && String(item.color || '') === String(color || '')
      );
      let nextCart: CartLine[];
      if (existing) {
        nextCart = currentCart.map((item) =>
          item.productId === id && String(item.color || '') === String(color || '')
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      } else {
        nextCart = [...currentCart, { productId: id, quantity, ...(color ? { color } : {}) }];
      }
      cartRef.current = nextCart;
      saveLocalCart(nextCart);
      const updatedTotalCount = nextCart.reduce((sum, item) => sum + item.quantity, 0);
      setCart(nextCart);
      setAddedToCartProduct({ product, quantity, color });
      toast.success(
        `${product.name}${color ? ` (${color})` : ''} added to cart! Cart (${updatedTotalCount})`,
        {
          description: `Total items in cart: ${updatedTotalCount}`,
        }
      );
    };

    if (token) {
      try {
        await api.addToCart(id, quantity, color);
        invalidateUserData("cart");
        applyCartUpdateAndToast();
      } catch (err: any) {
        if (err?.status === 401) {
          clearAuthToken();
          setCurrentUser(null);
          applyCartUpdateAndToast();
        } else {
          const msg = err?.message || err?.data?.message || "Failed to add to cart";
          toast.error(msg);
        }
      }
    } else {
      applyCartUpdateAndToast();
    }
  }, [invalidateUserData, products]);

  const setQuantity = useCallback(async (id: string, q: number) => {
    const product = products.find((item) => item.id === id);
    const minQty = Math.max(1, Math.ceil(product?.moq || 1));
    const nextQty = Math.max(minQty, Number.isInteger(q) ? q : minQty);
    const nextCart = cartRef.current.map((item) => (item.productId === id ? { ...item, quantity: nextQty } : item));
    cartRef.current = nextCart;
    saveLocalCart(nextCart);
    setCart(nextCart);
    const token = getAuthToken();
    if (token) {
      try {
        await api.updateCartItem(id, nextQty);
        invalidateUserData("cart");
      } catch (err: any) {
        if (err?.status === 401) {
          clearAuthToken();
          setCurrentUser(null);
        } else {
          toast.error(err?.message || "Failed to update cart");
        }
      }
    }
  }, [invalidateUserData, products]);

  const removeCart = useCallback(async (id: string) => {
    const nextCart = cartRef.current.filter((item) => item.productId !== id);
    cartRef.current = nextCart;
    saveLocalCart(nextCart);
    setCart(nextCart);
    const token = getAuthToken();
    if (token) {
      try {
        await api.removeCartItem(id);
        invalidateUserData("cart");
      } catch (err: any) {
        if (err?.status === 401) {
          clearAuthToken();
          setCurrentUser(null);
        } else {
          toast.error(err?.message || "Failed to remove item");
        }
      }
    }
  }, [invalidateUserData]);

  const toggleWishlist = useCallback(async (id: string) => {
    const isWished = wishlist.includes(id);
    try {
      if (isWished) {
        await api.removeFromWishlist(id);
        invalidateUserData("wishlist");
        setWishlist((current) => current.filter((item) => item !== id));
      } else {
        await api.addToWishlist(id);
        invalidateUserData("wishlist");
        setWishlist((current) => [...current, id]);
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to update wishlist");
    }
  }, [invalidateUserData, wishlist]);

  const saveProfile = useCallback(async (profileInput: RetailerProfile) => {
    setProfile(profileInput);
    await api.updateBusinessProfile({
      ownerName: profileInput.ownerName,
      phone: profileInput.phone,
      businessName: profileInput.businessName,
      businessType: profileInput.businessType,
      category: profileInput.category,
      address: profileInput.address,
      city: profileInput.city,
      state: profileInput.state,
      pincode: profileInput.pincode,
      gstStatus: profileInput.gstRegistered ? "REGISTERED" : "UNREGISTERED",
      gstin: profileInput.gstNumber,
    });
    invalidateUserData("profile", "dashboard");
    await syncSession(true);
    toast.success("Retailer profile saved");
  }, [invalidateUserData, syncSession]);

  const placeOrder = useCallback(async (paymentMethod = "COD", couponCode?: string) => {
    if (!cart.length) {
      throw new Error("Your cart is empty");
    }

    const shippingAddress = {
      addressLine1: profile.address || "Main Market Road",
      city: profile.city || "New Delhi",
      state: profile.state || "Delhi",
      postalCode: profile.pincode || "110001",
      pincode: profile.pincode || "110001",
      country: "India",
      contactName: profile.ownerName || "Retailer contact",
      phone: profile.phone || "",
    };

    try {
      setIsLoading(true);
      await api.checkout({
        items: cart.map((line) => ({ productId: line.productId, quantity: line.quantity })),
        shippingAddress,
        paymentMethod,
        ...(couponCode ? { couponCode } : {}),
      });

      setCart([]);
      cartRef.current = [];
      saveLocalCart([]);
      invalidateUserData("cart", "orders", "dashboard");
      await syncSession(true);
      toast.success("Wholesale order placed successfully!");
      return true;
    } finally {
      setIsLoading(false);
    }
  }, [cart, invalidateUserData, profile, syncSession]);

  const markRead = useCallback(() => {
    setNotifications((current) => current.map((item) => ({ ...item, unread: false })));
  }, []);

  const addRecentlyViewed = useCallback((id: string) => {
    if (!id) return;
    setRecentlyViewed((current) => {
      if (current[0] === id) return current;
      return [id, ...current.filter((item) => item !== id)].slice(0, 12);
    });
  }, []);

  const value = useMemo<Store>(
    () => ({
      currentUser,
      isLoggedIn: Boolean(currentUser && getAuthToken()),
      isLoading,
      linkedWholesalerId,
      linkedWholesaler,
      connectedWholesalers: linkedWholesaler ? [linkedWholesaler] : [],
      products,
      categories,
      cart,
      cartCount,
      uniqueCartCount,
      wishlist,
      relationships,
      orders,
      refreshData: syncSession,
      returns,
      retailerProfile: profile,
      unread,
      notifications,
      recentlyViewed,
      dashboard,
      addedToCartProduct,
      clearAddedToCartProduct,
      login,
      logout,
      connectWholesaler,
      addToCart,
      setQuantity,
      removeCart,
      toggleWishlist,
      saveProfile,
      placeOrder,
      markRead,
      addRecentlyViewed,
      refreshOrders,
    }),
    [currentUser, isLoading, linkedWholesalerId, linkedWholesaler, products, categories, cart, cartCount, uniqueCartCount, wishlist, relationships, orders, returns, profile, unread, notifications, recentlyViewed, dashboard, addedToCartProduct, clearAddedToCartProduct, login, logout, connectWholesaler, addToCart, setQuantity, removeCart, toggleWishlist, saveProfile, placeOrder, markRead, addRecentlyViewed, refreshOrders, syncSession]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export const useStore = () => {
  const value = useContext(StoreContext);
  if (!value) throw new Error("StoreProvider missing");
  return value;
};
