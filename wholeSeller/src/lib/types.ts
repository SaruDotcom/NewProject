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
  mrp?: number;
  basePrice: number;
  stock: number;
  minOrderQty: number;
  unit?: string;
  isLowStock: boolean;
  imageUrl: string;
  images?: string[];
  pricingTiers: WholesaleTier[];
  description: string;
  sizes?: string[];
  colors?: string[];
  colorVariants?: Array<{ color: string; sku?: string; images: string[] }>;
  hsnCode?: string;
  cgst?: number | null;
  sgst?: number | null;
  igst?: number | null;
  priceIncludesTax?: boolean;
  additionalOptions?: CustomAttribute[];
  categoryAttributes?: Record<string, unknown>;
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

export type CategoryInput = Omit<Category, 'id' | 'wholesalerId' | 'productCount' | 'slug'> & {
  slug?: string;
};

export interface Retailer {
  id: string;
  retailerId?: string;
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
  outstandingAmount?: number;
  registrationSource?: string;
  lastLoginAt?: string | null;
  verificationStatus?: 'NOT_SUBMITTED' | 'SUBMITTED' | 'VERIFIED' | 'REJECTED' | string;
  documentsSubmitted?: boolean;
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
  retailerId?: string;
  retailerBusinessName?: string;
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
