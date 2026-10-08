export interface InviteToken {
  token: string;
  createdBy: string;
  isUsed: boolean;
  expiresAt: string;
}

export const VALID_INVITE_TOKENS: InviteToken[] = [
  { token: 'SA-INVITE-2026-X99', createdBy: 'Super Admin (Main)', isUsed: false, expiresAt: '2026-12-31' },
  { token: 'SA-INVITE-ADMIN-882', createdBy: 'Super Admin (Ops)', isUsed: false, expiresAt: '2026-12-31' },
  { token: 'SUPER-ADMIN-9910', createdBy: 'Super Admin (Partner Desk)', isUsed: false, expiresAt: '2026-12-31' },
  { token: 'EXPIRED-TOKEN-000', createdBy: 'Super Admin', isUsed: true, expiresAt: '2025-01-01' },
];

export interface WholesaleTier {
  id: string;
  minQty: number;
  maxQty?: number;
  pricePerUnit: number;
}

export interface CustomAttribute {
  id: string;
  name: string;
  value: string;
}

export interface Product {
  id: string;
  wholesalerId: string;
  title: string;
  sku: string;
  category: string;
  categoryId: string;
  subcategoryId?: string | null;
  subcategoryName?: string;
  costPrice: number;
  sellingPrice: number;
  basePrice: number;
  stock: number;
  minOrderQty: number;
  unit?: string;
  isLowStock: boolean;
  imageUrl: string;
  pricingTiers: WholesaleTier[];
  description: string;
  sizes?: string[];
  colors?: string[];
  additionalOptions?: CustomAttribute[];
  categoryAttributes?: Record<string, any>;
}

export interface Category {
  id: string;
  wholesalerId: string;
  name: string;
  slug: string;
  productCount: number;
  icon: string;
  description: string;
  imageUrl?: string;
  parentId?: string | null;
  parentName?: string;
  path?: Array<{ id: string; name: string; slug: string }>;
  displayPath?: string;
  level?: number;
}

export const DEFAULT_CATEGORY_IMAGES: { [key: string]: string } = {
  clothes: 'https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?auto=format&fit=crop&w=600&q=80',
  footwear: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=600&q=80',
  electronics: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=600&q=80',
  accessories: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=600&q=80',
  home: 'https://images.unsplash.com/photo-1616046229478-9901c5536a45?auto=format&fit=crop&w=600&q=80',
  fallback: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=600&q=80'
};

export function getCategoryImageUrl(categoryName: string, imageUrl?: string): string {
  if (imageUrl && imageUrl.trim().length > 0) {
    return imageUrl.trim();
  }
  const lower = (categoryName || '').toLowerCase();
  if (lower.includes('cloth') || lower.includes('apparel') || lower.includes('wear') || lower.includes('textile') || lower.includes('garment') || lower.includes('shirt')) {
    return DEFAULT_CATEGORY_IMAGES.clothes;
  }
  if (lower.includes('footwear') || lower.includes('shoe') || lower.includes('leather') || lower.includes('boot')) {
    return DEFAULT_CATEGORY_IMAGES.footwear;
  }
  if (lower.includes('electronic') || lower.includes('gadget') || lower.includes('tech') || lower.includes('phone') || lower.includes('mobile')) {
    return DEFAULT_CATEGORY_IMAGES.electronics;
  }
  if (lower.includes('accessori') || lower.includes('watch') || lower.includes('bag') || lower.includes('belt')) {
    return DEFAULT_CATEGORY_IMAGES.accessories;
  }
  if (lower.includes('home') || lower.includes('decor') || lower.includes('kitchen') || lower.includes('bed')) {
    return DEFAULT_CATEGORY_IMAGES.home;
  }
  return DEFAULT_CATEGORY_IMAGES.fallback;
}

export interface Retailer {
  id: string;
  wholesalerId: string;
  businessName: string;
  contactPerson: string;
  email: string;
  loginId?: string;
  profileComplete?: boolean;
  businessType?: string;
  category?: string;
  address?: string;
  pincode?: string;
  phone: string;
  gstin: string;
  city: string;
  state: string;
  status: 'CONNECTED';
  creditLimit: number;
  discountPercent: number;
  totalOrdersCount: number;
  totalSpent: number;
  joinedDate: string;
}

export interface OrderItem {
  id: string;
  productId: string;
  productTitle: string;
  sku: string;
  unitPrice: number;
  quantity: number;
  subtotal: number;
}

export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' | 'PROCESSING' | 'DISPATCHED';

export interface Order {
  id: string;
  wholesalerId: string;
  orderNumber: string;
  retailerName: string;
  retailerCity: string;
  status: OrderStatus;
  cancellationReason?: string;
  cancellationNote?: string;
  totalAmount: number;
  taxAmount: number;
  discountAmount: number;
  paymentStatus: 'UNPAID' | 'PARTIAL' | 'PAID';
  trackingNumber?: string;
  createdAt: string;
  items: OrderItem[];
}

export interface ReturnItem {
  productId: string;
  name: string;
  sku: string;
  quantity: number;
  reason: string;
  pricePerUnit: number;
}

export interface ReturnRequest {
  id: string;
  orderId: string | { orderNumber: string };
  retailerId: string | { name: string; email: string };
  returnNumber: string;
  status: 'REQUESTED' | 'APPROVED' | 'REJECTED' | 'PROCESSING' | 'COMPLETED' | 'CANCELLED';
  items: ReturnItem[];
  reason: string;
  retailerNote?: string;
  totalRefundAmount: number;
  createdAt: string;
}

export interface InventoryLog {
  id: string;
  productId: string;
  productTitle: string;
  sku: string;
  changeAmount: number;
  changeType?: 'Order Fulfillment' | 'Manual Addition' | 'Manual Adjustment' | 'Return Restock' | string;
  resultingStock?: number;
  reason: string;
  createdAt: string;
}

export interface SecuritySession {
  id: string;
  device: string;
  ipAddress: string;
  location: string;
  lastActive: string;
  current: boolean;
}

export interface AuditLog {
  id: string;
  action: string;
  user: string;
  timestamp: string;
  status: 'Success' | 'Warning' | 'Failed';
}

const CURRENT_WHOLESALER_ID = 'wholesaler-apex-001';

export const INITIAL_CATEGORIES: Category[] = [
  { id: 'cat-1', wholesalerId: CURRENT_WHOLESALER_ID, name: 'Apparel & Textiles', slug: 'apparel-textiles', productCount: 42, icon: 'Shirt', description: 'Wholesale garments, cotton fabrics, ethnic wear', imageUrl: 'https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?auto=format&fit=crop&w=600&q=80' },
  { id: 'cat-2', wholesalerId: CURRENT_WHOLESALER_ID, name: 'Footwear & Leather', slug: 'footwear-leather', productCount: 28, icon: 'Footprints', description: 'Men & Women casuals, formal shoes, leather boots', imageUrl: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=600&q=80' },
  { id: 'cat-3', wholesalerId: CURRENT_WHOLESALER_ID, name: 'Electronics & Accessories', slug: 'electronics-accessories', productCount: 19, icon: 'Smartphone', description: 'Headphones, power banks, smartwatch straps', imageUrl: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=600&q=80' },
  { id: 'cat-4', wholesalerId: CURRENT_WHOLESALER_ID, name: 'Fashion Accessories', slug: 'fashion-accessories', productCount: 35, icon: 'Watch', description: 'Belts, sunglasses, silk scarves, handbags', imageUrl: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=600&q=80' },
  { id: 'cat-5', wholesalerId: CURRENT_WHOLESALER_ID, name: 'Home & Kitchen Decor', slug: 'home-decor', productCount: 14, icon: 'Home', description: 'Bedsheets, curtain fabrics, tableware sets', imageUrl: 'https://images.unsplash.com/photo-1616046229478-9901c5536a45?auto=format&fit=crop&w=600&q=80' },
];

export const INITIAL_PRODUCTS: Product[] = [
  {
    id: 'prod-101',
    wholesalerId: CURRENT_WHOLESALER_ID,
    title: 'Premium Cotton Slim Fit Formal Shirt (Bulk Pack)',
    sku: 'TS-BLK-101',
    category: 'Apparel & Textiles',
    categoryId: 'cat-1',
    costPrice: 380,
    sellingPrice: 550,
    basePrice: 550,
    stock: 450,
    minOrderQty: 20,
    isLowStock: false,
    imageUrl: 'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?auto=format&fit=crop&w=600&q=80',
    description: '100% combed cotton men formal shirts with crisp collar. Available in sizes M to XXL.',
    sizes: ['M', 'L', 'XL', 'XXL'],
    colors: ['White', 'Navy Blue', 'Light Blue'],
    additionalOptions: [
      { id: 'opt-1', name: 'Fabric', value: '100% Combed Cotton' },
      { id: 'opt-2', name: 'Fit', value: 'Slim Fit' }
    ],
    pricingTiers: [
      { id: 't1', minQty: 20, maxQty: 50, pricePerUnit: 550 },
      { id: 't2', minQty: 51, maxQty: 200, pricePerUnit: 500 },
      { id: 't3', minQty: 201, pricePerUnit: 440 },
    ]
  },
  {
    id: 'prod-102',
    wholesalerId: CURRENT_WHOLESALER_ID,
    title: 'Unisex Heavyweight Oversized Graphic Hoodie',
    sku: 'HD-OVR-204',
    category: 'Apparel & Textiles',
    categoryId: 'cat-1',
    costPrice: 620,
    sellingPrice: 890,
    basePrice: 890,
    stock: 120,
    minOrderQty: 15,
    isLowStock: false,
    imageUrl: 'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?auto=format&fit=crop&w=600&q=80',
    description: '380 GSM fleece hoodie with ribbed cuffs and drop shoulder style.',
    sizes: ['S', 'M', 'L', 'XL'],
    colors: ['Black', 'Charcoal Gray', 'Beige'],
    additionalOptions: [
      { id: 'opt-3', name: 'Material', value: '380 GSM Fleece Cotton' }
    ],
    pricingTiers: [
      { id: 't1', minQty: 15, maxQty: 50, pricePerUnit: 890 },
      { id: 't2', minQty: 51, maxQty: 150, pricePerUnit: 810 },
      { id: 't3', minQty: 151, pricePerUnit: 740 },
    ]
  },
  {
    id: 'prod-103',
    wholesalerId: CURRENT_WHOLESALER_ID,
    title: 'Genuine Leather Executive Briefcase & Laptop Bag',
    sku: 'BG-LTH-990',
    category: 'Fashion Accessories',
    categoryId: 'cat-4',
    costPrice: 1250,
    sellingPrice: 1850,
    basePrice: 1850,
    stock: 18,
    minOrderQty: 5,
    isLowStock: true,
    imageUrl: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=600&q=80',
    description: 'Handcrafted full-grain leather laptop satchel with padded 15.6-inch compartment.',
    sizes: ['Standard 15.6"'],
    colors: ['Tan Brown', 'Dark Chocolate'],
    additionalOptions: [
      { id: 'opt-4', name: 'Leather Type', value: 'Full Grain Buffalo Leather' }
    ],
    pricingTiers: [
      { id: 't1', minQty: 5, maxQty: 20, pricePerUnit: 1850 },
      { id: 't2', minQty: 21, pricePerUnit: 1650 },
    ]
  },
  {
    id: 'prod-104',
    wholesalerId: CURRENT_WHOLESALER_ID,
    title: 'True Wireless Active Noise Canceling Earbuds',
    sku: 'EL-TWS-401',
    category: 'Electronics & Accessories',
    categoryId: 'cat-3',
    costPrice: 780,
    sellingPrice: 1200,
    basePrice: 1200,
    stock: 350,
    minOrderQty: 10,
    isLowStock: false,
    imageUrl: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=600&q=80',
    description: 'Bluetooth 5.3 ANC TWS earbuds with 32h battery case. Retail packaged.',
    sizes: ['One Size'],
    colors: ['Matte Black', 'Pearl White'],
    additionalOptions: [
      { id: 'opt-5', name: 'Bluetooth', value: 'v5.3 ANC' },
      { id: 'opt-6', name: 'Battery Life', value: '32 Hours' }
    ],
    pricingTiers: [
      { id: 't1', minQty: 10, maxQty: 50, pricePerUnit: 1200 },
      { id: 't2', minQty: 51, maxQty: 200, pricePerUnit: 1080 },
      { id: 't3', minQty: 201, pricePerUnit: 980 },
    ]
  },
  {
    id: 'prod-105',
    wholesalerId: CURRENT_WHOLESALER_ID,
    title: 'Men Handcrafted Leather Loafers (Assorted Sizes Pack)',
    sku: 'FT-LFR-88',
    category: 'Footwear & Leather',
    categoryId: 'cat-2',
    costPrice: 980,
    sellingPrice: 1450,
    basePrice: 1450,
    stock: 8,
    minOrderQty: 10,
    isLowStock: true,
    imageUrl: 'https://images.unsplash.com/photo-1614252235316-8c857d38b5f4?auto=format&fit=crop&w=600&q=80',
    description: 'TPR sole breathable genuine leather loafers in Tan and Black.',
    sizes: ['UK 7', 'UK 8', 'UK 9', 'UK 10'],
    colors: ['Tan', 'Black'],
    additionalOptions: [
      { id: 'opt-7', name: 'Sole Material', value: 'TPR Anti-Skid' }
    ],
    pricingTiers: [
      { id: 't1', minQty: 10, maxQty: 40, pricePerUnit: 1450 },
      { id: 't2', minQty: 41, pricePerUnit: 1290 },
    ]
  },
  {
    id: 'prod-106',
    wholesalerId: CURRENT_WHOLESALER_ID,
    title: 'Luxury 400 TC Egyptian Cotton Bedsheet Set',
    sku: 'HM-BD-505',
    category: 'Home & Kitchen Decor',
    categoryId: 'cat-5',
    costPrice: 850,
    sellingPrice: 1290,
    basePrice: 1290,
    stock: 95,
    minOrderQty: 10,
    isLowStock: false,
    imageUrl: 'https://images.unsplash.com/photo-1616046229478-9901c5536a45?auto=format&fit=crop&w=600&q=80',
    description: 'King size sheet with 2 pillow covers in satin weave finish.',
    sizes: ['King (108x108")'],
    colors: ['Ivory', 'Sage Green', 'Teal Blue'],
    additionalOptions: [
      { id: 'opt-8', name: 'Thread Count', value: '400 TC Satin Weave' }
    ],
    pricingTiers: [
      { id: 't1', minQty: 10, maxQty: 50, pricePerUnit: 1290 },
      { id: 't2', minQty: 51, pricePerUnit: 1150 },
    ]
  }
];

export const INITIAL_RETAILERS: Retailer[] = [
  {
    id: 'ret-1',
    wholesalerId: CURRENT_WHOLESALER_ID,
    businessName: 'Metro Fashion & Garments Ltd',
    contactPerson: 'Anil Agarwal',
    email: 'anil@metrofashion.in',
    phone: '9820144510',
    gstin: '27AAACM9981B1Z2',
    city: 'Mumbai',
    state: 'Maharashtra',
    status: 'CONNECTED',
    creditLimit: 250000,
    discountPercent: 8,
    totalOrdersCount: 24,
    totalSpent: 485000,
    joinedDate: '2025-11-12'
  },
  {
    id: 'ret-2',
    wholesalerId: CURRENT_WHOLESALER_ID,
    businessName: 'Trendz Apparel Boutique',
    contactPerson: 'Sonia Kapoor',
    email: 'sonia@trendzboutique.com',
    phone: '9811233400',
    gstin: '07ABBCP4421C1Z8',
    city: 'New Delhi',
    state: 'Delhi',
    status: 'CONNECTED',
    creditLimit: 150000,
    discountPercent: 5,
    totalOrdersCount: 16,
    totalSpent: 310000,
    joinedDate: '2025-12-05'
  },
  {
    id: 'ret-3',
    wholesalerId: CURRENT_WHOLESALER_ID,
    businessName: 'Royal Footwear & Hub',
    contactPerson: 'Vikram Singh',
    email: 'vikram@royalfootwear.org',
    phone: '9744099821',
    gstin: '08AAACR5501D1Z4',
    city: 'Jaipur',
    state: 'Rajasthan',
    status: 'CONNECTED',
    creditLimit: 100000,
    discountPercent: 6,
    totalOrdersCount: 9,
    totalSpent: 198000,
    joinedDate: '2026-01-20'
  }
];

export const INITIAL_ORDERS: Order[] = [
  {
    id: 'ord-1001',
    wholesalerId: CURRENT_WHOLESALER_ID,
    orderNumber: 'ORD-2026-8891',
    retailerName: 'Metro Fashion & Garments Ltd',
    retailerCity: 'Mumbai',
    status: 'PENDING',
    totalAmount: 48600,
    taxAmount: 5832,
    discountAmount: 2430,
    paymentStatus: 'UNPAID',
    createdAt: '2026-03-15 10:30 AM',
    items: [
      { id: 'oi-1', productId: 'prod-101', productTitle: 'Premium Cotton Slim Fit Formal Shirt (Bulk Pack)', sku: 'TS-BLK-101', unitPrice: 500, quantity: 60, subtotal: 30000 },
      { id: 'oi-2', productId: 'prod-102', productTitle: 'Unisex Heavyweight Oversized Graphic Hoodie', sku: 'HD-OVR-204', unitPrice: 810, quantity: 20, subtotal: 16200 }
    ]
  },
  {
    id: 'ord-1002',
    wholesalerId: CURRENT_WHOLESALER_ID,
    orderNumber: 'ORD-2026-8890',
    retailerName: 'Trendz Apparel Boutique',
    retailerCity: 'New Delhi',
    status: 'CONFIRMED',
    totalAmount: 32400,
    taxAmount: 3888,
    discountAmount: 1620,
    paymentStatus: 'PARTIAL',
    trackingNumber: 'BLUEDART-8820192',
    createdAt: '2026-03-14 04:15 PM',
    items: [
      { id: 'oi-3', productId: 'prod-104', productTitle: 'True Wireless Active Noise Canceling Earbuds', sku: 'EL-TWS-401', unitPrice: 1080, quantity: 30, subtotal: 32400 }
    ]
  },
  {
    id: 'ord-1003',
    wholesalerId: CURRENT_WHOLESALER_ID,
    orderNumber: 'ORD-2026-8889',
    retailerName: 'Royal Footwear & Hub',
    retailerCity: 'Jaipur',
    status: 'SHIPPED',
    totalAmount: 29000,
    taxAmount: 3480,
    discountAmount: 1450,
    paymentStatus: 'PAID',
    trackingNumber: 'DELHIVERY-992011',
    createdAt: '2026-03-12 11:00 AM',
    items: [
      { id: 'oi-4', productId: 'prod-105', productTitle: 'Men Handcrafted Leather Loafers', sku: 'FT-LFR-88', unitPrice: 1450, quantity: 20, subtotal: 29000 }
    ]
  },
  {
    id: 'ord-1004',
    wholesalerId: CURRENT_WHOLESALER_ID,
    orderNumber: 'ORD-2026-8885',
    retailerName: 'Metro Fashion & Garments Ltd',
    retailerCity: 'Mumbai',
    status: 'DELIVERED',
    totalAmount: 92500,
    taxAmount: 11100,
    discountAmount: 4625,
    paymentStatus: 'PAID',
    trackingNumber: 'FEDEX-IN-77102',
    createdAt: '2026-03-08 02:45 PM',
    items: [
      { id: 'oi-5', productId: 'prod-103', productTitle: 'Genuine Leather Executive Briefcase', sku: 'BG-LTH-990', unitPrice: 1850, quantity: 50, subtotal: 92500 }
    ]
  }
];

export const INITIAL_INVENTORY_LOGS: InventoryLog[] = [
  { id: 'log-1', productId: 'prod-101', productTitle: 'Premium Cotton Slim Fit Formal Shirt', sku: 'TS-BLK-101', changeAmount: -60, reason: 'Fulfilled Order #ORD-2026-8891', createdAt: '2026-03-15 10:35 AM' },
  { id: 'log-2', productId: 'prod-104', productTitle: 'True Wireless Active Noise Canceling Earbuds', sku: 'EL-TWS-401', changeAmount: 200, reason: 'Factory Stock Batch Arrival #B-991', createdAt: '2026-03-14 09:00 AM' }
];

export const INITIAL_SESSIONS: SecuritySession[] = [
  { id: 'sess-1', device: 'Chrome on Windows 11 (Desktop)', ipAddress: '103.21.124.89', location: 'Mumbai, India', lastActive: 'Active Now', current: true }
];

export const INITIAL_AUDIT_LOGS: AuditLog[] = [
  { id: 'audit-1', action: 'Wholesaler Registration Submitted (Pending Approval)', user: 'Rajesh Sharma (Wholesaler)', timestamp: '2026-03-15 08:30:12', status: 'Success' }
];
