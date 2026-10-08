'use client';

import React, { useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Boxes,
  TrendingUp,
  DollarSign,
  ShoppingBag,
  History,
  Edit,
  Sliders,
  AlertTriangle,
  CheckCircle2,
  Package,
  Layers,
  X,
  Search,
  User,
  RotateCcw,
  AlertCircle,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Building2,
  MapPin,
  Calendar,
  FileText
} from 'lucide-react';
import { useWholesaler } from '@/context/WholesalerContext';
import { Product, Order, ReturnRequest, InventoryLog, WholesaleTier, CustomAttribute } from '@/lib/mock-data';
import api from '@/lib/api';

export default function ProductDetailPage() {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const {
    products,
    categories,
    orders = [],
    returns = [],
    inventoryLogs = [],
    retailers = [],
    updateProduct,
    adjustStock
  } = useWholesaler();

  // Find target product
  const product = products.find((p) => String(p.id) === String(productId));

  // Modals & Pagination State
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);

  // Pagination for Orders Breakdown Table
  const [ordersPage, setOrdersPage] = useState(1);
  const ordersPerPage = 5;

  // Stock Adjustment State
  const [adjustAmount, setAdjustAmount] = useState<number>(50);
  const [adjustReason, setAdjustReason] = useState<string>('Restocked / Factory Arrival');

  // Edit Product Form State
  const [title, setTitle] = useState(product?.title || '');
  const [sku, setSku] = useState(product?.sku || '');
  const [categoryName, setCategoryName] = useState(product?.category || '');
  const [costPrice, setCostPrice] = useState<number | ''>(product?.costPrice || 0);
  const [sellingPrice, setSellingPrice] = useState<number | ''>(product?.sellingPrice || 0);
  const [stock, setStock] = useState<number | ''>(product?.stock || 0);
  const [minOrderQty, setMinOrderQty] = useState<number | ''>(product?.minOrderQty || 1);
  const [imageUrl, setImageUrl] = useState(product?.imageUrl || '');
  const [description, setDescription] = useState(product?.description || '');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Synchronize edit form when product loads/changes
  React.useEffect(() => {
    if (product) {
      setTitle(product.title);
      setSku(product.sku);
      setCategoryName(product.category || '');
      setCostPrice(product.costPrice || (product.basePrice ? Math.round(product.basePrice * 0.7) : 0));
      setSellingPrice(product.sellingPrice || product.basePrice || 0);
      setStock(product.stock || 0);
      setMinOrderQty(product.minOrderQty || 1);
      setImageUrl(product.imageUrl || '');
      setDescription(product.description || '');
    }
  }, [product]);

  // Compute lifetime metrics from real Order & OrderItem records for this product
  const metrics = useMemo(() => {
    if (!product) {
      return {
        unitsSold: 0,
        fulfilledOrdersCount: 0,
        totalRevenue: 0,
        totalProfit: 0,
        costPrice: 0,
        sellingPrice: 0,
        unitMargin: 0,
        marginPercent: 0,
        totalStockCost: 0,
        uniqueRetailersCount: 0,
      };
    }

    const cost = product.costPrice || (product.basePrice ? Math.round(product.basePrice * 0.7) : 0);
    const selling = product.sellingPrice || product.basePrice || 100;
    const unitMargin = selling - cost;
    const marginPercent = cost > 0 ? (unitMargin / cost) * 100 : (selling > 0 ? 100 : 0);

    let unitsSold = 0;
    let fulfilledOrdersCount = 0;
    let totalRevenue = 0;
    let totalProfit = 0;
    const uniqueRetailerNames = new Set<string>();

    orders.forEach((o) => {
      if (o.status === 'CANCELLED') return;

      let containsProduct = false;
      (o.items || []).forEach((item) => {
        if (String(item.productId) === String(product.id)) {
          const itemQty = Number(item.quantity || 0);
          const itemPrice = Number(item.unitPrice || selling);
          const itemRevenue = itemQty * itemPrice;
          const itemProfit = itemQty * (itemPrice - cost);

          unitsSold += itemQty;
          totalRevenue += itemRevenue;
          totalProfit += itemProfit;
          containsProduct = true;
        }
      });

      if (containsProduct) {
        fulfilledOrdersCount += 1;
        if (o.retailerName) uniqueRetailerNames.add(o.retailerName);
      }
    });

    return {
      unitsSold,
      fulfilledOrdersCount,
      totalRevenue,
      totalProfit,
      costPrice: cost,
      sellingPrice: selling,
      unitMargin,
      marginPercent,
      totalStockCost: (product.stock || 0) * cost,
      uniqueRetailersCount: uniqueRetailerNames.size,
    };
  }, [product, orders]);

  // Filter Order-wise Breakdown Table for this product
  const productOrders = useMemo(() => {
    if (!product) return [];

    const list: Array<{
      orderId: string;
      orderNumber: string;
      retailerName: string;
      retailerCity: string;
      orderDate: string;
      status: string;
      quantity: number;
      unitPrice: number;
      subtotal: number;
      profit: number;
    }> = [];

    orders.forEach((o) => {
      (o.items || []).forEach((item) => {
        if (String(item.productId) === String(product.id)) {
          const itemQty = Number(item.quantity || 0);
          const itemPrice = Number(item.unitPrice || metrics.sellingPrice);
          const itemSubtotal = itemQty * itemPrice;
          const itemProfit = itemQty * (itemPrice - metrics.costPrice);

          list.push({
            orderId: o.id,
            orderNumber: o.orderNumber,
            retailerName: o.retailerName || 'Retail Buyer',
            retailerCity: o.retailerCity || 'India',
            orderDate: o.createdAt || new Date().toLocaleString('en-IN'),
            status: o.status,
            quantity: itemQty,
            unitPrice: itemPrice,
            subtotal: itemSubtotal,
            profit: itemProfit,
          });
        }
      });
    });

    // Sort by most recent first
    return list.sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());
  }, [product, orders, metrics]);

  // Pagination for Order Breakdown Table
  const totalOrderPages = Math.ceil(productOrders.length / ordersPerPage) || 1;
  const paginatedOrders = useMemo(() => {
    const start = (ordersPage - 1) * ordersPerPage;
    return productOrders.slice(start, start + ordersPerPage);
  }, [productOrders, ordersPage]);

  // Compute Top Retailers for this specific product
  const topRetailers = useMemo(() => {
    if (!product) return [];

    const retailerMap: Record<
      string,
      {
        businessName: string;
        contactPerson?: string;
        city?: string;
        totalUnits: number;
        totalRevenue: number;
        orderCount: number;
        lastOrderDate: string;
      }
    > = {};

    orders.forEach((o) => {
      if (o.status === 'CANCELLED') return;

      (o.items || []).forEach((item) => {
        if (String(item.productId) === String(product.id)) {
          const rName = o.retailerName || 'Retail Partner';
          if (!retailerMap[rName]) {
            // Find retailer metadata if available
            const rMeta = retailers.find((r) => r.businessName.toLowerCase() === rName.toLowerCase());
            retailerMap[rName] = {
              businessName: rName,
              contactPerson: rMeta?.contactPerson || 'Store Manager',
              city: o.retailerCity || rMeta?.city || 'Delhi',
              totalUnits: 0,
              totalRevenue: 0,
              orderCount: 0,
              lastOrderDate: o.createdAt,
            };
          }

          const qty = Number(item.quantity || 0);
          const price = Number(item.unitPrice || metrics.sellingPrice);
          retailerMap[rName].totalUnits += qty;
          retailerMap[rName].totalRevenue += qty * price;
          retailerMap[rName].orderCount += 1;
          retailerMap[rName].lastOrderDate = o.createdAt;
        }
      });
    });

    return Object.values(retailerMap)
      .sort((a, b) => b.totalUnits - a.totalUnits)
      .slice(0, 5);
  }, [product, orders, retailers, metrics.sellingPrice]);

  // Stock Movement History (Combined from InventoryLog context + synthesized order fulfillment logs)
  const stockLogs = useMemo(() => {
    if (!product) return [];

    const logs: Array<{
      id: string;
      date: string;
      changeType: string;
      changeAmount: number;
      reason: string;
      resultingStock?: number;
    }> = [];

    // Add direct inventory logs matching product
    inventoryLogs.forEach((log) => {
      if (String(log.productId) === String(product.id) || log.sku === product.sku) {
        let type = log.changeType || (log.changeAmount > 0 ? 'Manual Addition' : 'Manual Adjustment');
        if (log.reason?.toLowerCase().includes('order')) type = 'Order Fulfillment';
        if (log.reason?.toLowerCase().includes('return')) type = 'Return Restock';

        logs.push({
          id: log.id,
          date: log.createdAt,
          changeType: type,
          changeAmount: log.changeAmount,
          reason: log.reason,
          resultingStock: log.resultingStock,
        });
      }
    });

    // Synthesize order fulfillment logs if log array is missing detailed records
    if (logs.length === 0) {
      orders.forEach((o) => {
        (o.items || []).forEach((item) => {
          if (String(item.productId) === String(product.id)) {
            logs.push({
              id: `log-ord-${o.id}`,
              date: o.createdAt,
              changeType: o.status === 'CANCELLED' ? 'Return Restock' : 'Order Fulfillment',
              changeAmount: o.status === 'CANCELLED' ? Number(item.quantity) : -Number(item.quantity),
              reason: `Order #${o.orderNumber} for ${o.retailerName} (${o.status})`,
            });
          }
        });
      });
    }

    // Sort by date descending
    return logs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [product, inventoryLogs, orders]);

  // Returns & Cancellations records for this product
  const returnsAndCancellations = useMemo(() => {
    if (!product) return [];

    const list: Array<{
      id: string;
      type: 'RETURN' | 'CANCELLATION';
      referenceNo: string;
      date: string;
      retailerName: string;
      quantity: number;
      reason: string;
      status: string;
    }> = [];

    // 1. Process Return requests containing this product
    returns.forEach((r) => {
      (r.items || []).forEach((item) => {
        if (String(item.productId) === String(product.id)) {
          // Resolve retailer name
          let retName = 'Retail Buyer';
          if (typeof r.retailerId === 'object' && r.retailerId !== null) {
            retName = (r.retailerId as any).name || (r.retailerId as any).businessName || 'Retailer';
          } else if (typeof r.retailerId === 'string') {
            const matchR = retailers.find((ret) => ret.id === r.retailerId);
            if (matchR) retName = matchR.businessName;
          }

          list.push({
            id: r.id,
            type: 'RETURN',
            referenceNo: r.returnNumber || `RET-${r.id.slice(-4)}`,
            date: r.createdAt || new Date().toLocaleString('en-IN'),
            retailerName: retName,
            quantity: Number(item.quantity || 1),
            reason: r.reason || item.reason || 'Product Return Request',
            status: r.status,
          });
        }
      });
    });

    // 2. Process Cancelled Orders containing this product
    orders.forEach((o) => {
      if (o.status === 'CANCELLED') {
        (o.items || []).forEach((item) => {
          if (String(item.productId) === String(product.id)) {
            list.push({
              id: o.id,
              type: 'CANCELLATION',
              referenceNo: o.orderNumber,
              date: o.createdAt,
              retailerName: o.retailerName || 'Retail Partner',
              quantity: Number(item.quantity || 1),
              reason: o.cancellationReason || o.cancellationNote || 'Order cancelled by buyer/system',
              status: 'CANCELLED',
            });
          }
        });
      }
    });

    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [product, returns, orders, retailers]);

  // Handle Edit Product Submit
  const handleSaveProductEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product) return;
    setFormError(null);
    setIsSaving(true);

    try {
      await updateProduct(product.id, {
        title,
        sku,
        category: categoryName,
        costPrice: Number(costPrice) || 0,
        sellingPrice: Number(sellingPrice) || 0,
        basePrice: Number(sellingPrice) || 0,
        stock: Number(stock) || 0,
        minOrderQty: Number(minOrderQty) || 1,
        imageUrl,
        description,
      });
      setShowEditModal(false);
    } catch (err: any) {
      setFormError(err?.message || 'Failed to update product details');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Manual Stock Adjust Submit
  const handleApplyStockAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product) return;
    await adjustStock(product.id, Number(adjustAmount), adjustReason);
    setShowAdjustModal(false);
  };

  const formatCurrency = (val: number) => `₹${Math.round(val).toLocaleString('en-IN')}`;

  // If product not found
  if (!product) {
    return (
      <div className="p-8 text-center space-y-4">
        <div className="w-16 h-16 bg-red-50 text-[#C62828] rounded-2xl flex items-center justify-center mx-auto">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-[#1F1F1F]">Product Not Found</h2>
        <p className="text-xs text-gray-500">The product you are attempting to view does not exist or has been removed.</p>
        <Link
          to="/dashboard/inventory"
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#C62828] text-white text-xs font-bold rounded-xl hover:bg-[#B71C1C]"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Inventory Table</span>
        </Link>
      </div>
    );
  }

  const isOutOfStock = product.stock === 0;
  const isLowStock = product.stock > 0 && product.stock <= (product.minOrderQty || 10);

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header & Navigation Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
            <Link to="/dashboard/inventory" className="hover:text-[#C62828] transition-colors flex items-center gap-1 font-bold">
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Inventory Stock Table</span>
            </Link>
            <span>/</span>
            <span className="text-gray-700 font-bold truncate max-w-[200px]">{product.title}</span>
          </div>
          <h1 className="text-2xl font-extrabold text-[#1F1F1F] flex items-center gap-2">
            <span>{product.title}</span>
            <span className="text-xs font-mono px-2.5 py-0.5 rounded-md bg-[#FAF9F7] text-gray-600 border border-[#E5E5E5]">
              SKU: {product.sku}
            </span>
          </h1>
        </div>

        {/* Header Action Buttons: Edit Product & Adjust Stock */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAdjustModal(true)}
            className="px-3.5 py-2 bg-white border border-[#E5E5E5] hover:border-[#C62828] hover:text-[#C62828] text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-1.5"
          >
            <Sliders className="w-4 h-4 text-[#C62828]" />
            <span>Adjust Stock</span>
          </button>

          <button
            onClick={() => setShowEditModal(true)}
            className="px-4 py-2 bg-[#C62828] text-white text-xs font-bold rounded-xl hover:bg-[#B71C1C] shadow-xs transition-all flex items-center gap-1.5"
          >
            <Edit className="w-4 h-4" />
            <span>Edit Product</span>
          </button>
        </div>
      </div>

      {/* SECTION 1: PRODUCT SUMMARY TOP CARDS & BADGES */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Image, Stock Badge & Basic Info */}
        <div className="bg-white rounded-2xl border border-[#E5E5E5] p-5 shadow-xs flex flex-col sm:flex-row lg:flex-col items-center gap-5">
          <div className="w-full sm:w-48 lg:w-full h-52 bg-[#FAF9F7] rounded-xl border border-[#E5E5E5] overflow-hidden relative flex items-center justify-center p-3 shrink-0">
            {product.imageUrl ? (
              <img src={product.imageUrl} alt={product.title} className="w-full h-full object-contain" />
            ) : (
              <Package className="w-16 h-16 text-gray-300" />
            )}
            <div className="absolute top-2 right-2">
              {isOutOfStock ? (
                <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase bg-red-50 text-red-600 border border-red-200">
                  Out of Stock (0)
                </span>
              ) : isLowStock ? (
                <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase bg-[#FFF8E1] text-[#F9A825] border border-[#FFE082] flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  <span>Low Stock ({product.stock})</span>
                </span>
              ) : (
                <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase bg-[#E8F5E9] text-[#2E7D32] border border-[#2E7D32]/20">
                  In Stock ({product.stock})
                </span>
              )}
            </div>
          </div>

          <div className="space-y-2 w-full text-xs">
            <div className="flex items-center justify-between border-b border-[#E5E5E5] pb-2">
              <span className="text-gray-400 font-bold uppercase text-[10px]">Category</span>
              <span className="font-bold text-[#1F1F1F] bg-[#FAF9F7] px-2 py-0.5 rounded border border-[#E5E5E5]">
                {product.category}
              </span>
            </div>
            <div className="flex items-center justify-between border-b border-[#E5E5E5] pb-2">
              <span className="text-gray-400 font-bold uppercase text-[10px]">Minimum Order Qty (MOQ)</span>
              <span className="font-bold text-[#C62828] font-mono">{product.minOrderQty || 1} units</span>
            </div>
            <div className="flex items-center justify-between border-b border-[#E5E5E5] pb-2">
              <span className="text-gray-400 font-bold uppercase text-[10px]">Active Wholesaler Buyers</span>
              <span className="font-bold text-gray-800">{metrics.uniqueRetailersCount} Retailers</span>
            </div>
            <p className="text-[11px] text-gray-500 pt-1 line-clamp-2">{product.description || 'No description provided.'}</p>
          </div>
        </div>

        {/* Right 2 Columns: 6 Financial Performance Metric Cards */}
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="p-4 bg-white rounded-2xl border border-[#E5E5E5] shadow-xs space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Current Stock Inventory</span>
            <div className="text-2xl font-extrabold text-[#1F1F1F]">{product.stock.toLocaleString()} units</div>
            <div className="text-[11px] text-gray-500 font-medium">Valued at {formatCurrency(metrics.totalStockCost)} (Cost)</div>
          </div>

          <div className="p-4 bg-white rounded-2xl border border-[#E5E5E5] shadow-xs space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Cost Price vs Selling Price</span>
            <div className="text-base font-extrabold text-[#1F1F1F] flex items-center gap-1 font-mono">
              <span>{formatCurrency(metrics.costPrice)}</span>
              <span className="text-gray-400">→</span>
              <span className="text-[#C62828]">{formatCurrency(metrics.sellingPrice)}</span>
            </div>
            <div className="text-[11px] font-bold text-[#2E7D32]">
              Unit Profit: +{formatCurrency(metrics.unitMargin)} ({metrics.marginPercent.toFixed(1)}%)
            </div>
          </div>

          <div className="p-4 bg-white rounded-2xl border border-[#E5E5E5] shadow-xs space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Total Lifetime Units Sold</span>
            <div className="text-2xl font-extrabold text-[#1F1F1F]">{metrics.unitsSold.toLocaleString()} units</div>
            <div className="text-[11px] text-gray-500 font-medium">Across {metrics.fulfilledOrdersCount} fulfilled order(s)</div>
          </div>

          <div className="p-4 bg-white rounded-2xl border border-[#E5E5E5] shadow-xs space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Total Revenue Generated</span>
            <div className="text-2xl font-extrabold text-[#C62828]">{formatCurrency(metrics.totalRevenue)}</div>
            <div className="text-[11px] text-gray-500 font-medium">{metrics.unitsSold} units × {formatCurrency(metrics.sellingPrice)}</div>
          </div>

          <div className="p-4 bg-white rounded-2xl border border-[#E5E5E5] shadow-xs space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Total Lifetime Profit</span>
            <div className="text-2xl font-extrabold text-[#2E7D32]">{formatCurrency(metrics.totalProfit)}</div>
            <div className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Net profit from completed orders</span>
            </div>
          </div>

          <div className="p-4 bg-white rounded-2xl border border-[#E5E5E5] shadow-xs space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Total Orders Fulfilled</span>
            <div className="text-2xl font-extrabold text-[#1F1F1F]">{metrics.fulfilledOrdersCount} orders</div>
            <div className="text-[11px] text-gray-500 font-medium">Confirmed / Shipped / Delivered</div>
          </div>
        </div>
      </div>

      {/* SECTION 4 & 5: TOP RETAILERS + RETURNS & CANCELLATIONS (2 Column Grid) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* SECTION 4: TOP RETAILERS FOR THIS PRODUCT */}
        <div className="bg-white rounded-2xl border border-[#E5E5E5] p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#E5E5E5]">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[#C62828]" />
              <h3 className="font-bold text-sm text-[#1F1F1F]">Top Retailers for this Product</h3>
            </div>
            <span className="text-[10px] bg-[#FAF9F7] text-gray-500 font-mono px-2 py-0.5 rounded border border-[#E5E5E5]">
              Ranked by Volume
            </span>
          </div>

          {topRetailers.length === 0 ? (
            <p className="text-xs text-gray-400 py-4 text-center">No retailer order history recorded for this product yet.</p>
          ) : (
            <div className="space-y-2.5">
              {topRetailers.map((ret, idx) => (
                <div key={idx} className="p-3 bg-[#FAF9F7] rounded-xl border border-[#E5E5E5] flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-[#C62828]/10 text-[#C62828] font-extrabold text-xs flex items-center justify-center shrink-0">
                      #{idx + 1}
                    </span>
                    <div>
                      <div className="font-bold text-[#1F1F1F]">{ret.businessName}</div>
                      <div className="text-[10px] text-gray-500">
                        {ret.contactPerson} · {ret.city}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="font-extrabold text-[#C62828]">{ret.totalUnits} units</div>
                    <div className="text-[10px] font-mono text-gray-500">{formatCurrency(ret.totalRevenue)} total</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* SECTION 5: RETURNS & CANCELLATIONS */}
        <div className="bg-white rounded-2xl border border-[#E5E5E5] p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#E5E5E5]">
            <div className="flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-amber-600" />
              <h3 className="font-bold text-sm text-[#1F1F1F]">Returns & Cancelled Orders</h3>
            </div>
            <span className="text-[10px] bg-[#FFF8E1] text-[#F9A825] font-extrabold px-2.5 py-0.5 rounded-full border border-[#FFE082]">
              {returnsAndCancellations.length} Record(s)
            </span>
          </div>

          {returnsAndCancellations.length === 0 ? (
            <div className="p-6 text-center text-xs text-gray-400 space-y-1">
              <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto" />
              <p className="font-bold text-gray-700">Zero Returns or Cancellations</p>
              <p>This product has 100% clean fulfillment history.</p>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
              {returnsAndCancellations.map((item) => (
                <div key={item.id} className="p-3 bg-[#FAF9F7] rounded-xl border border-[#E5E5E5] text-xs space-y-1">
                  <div className="flex items-center justify-between font-bold">
                    <span className="text-[#1F1F1F] font-mono flex items-center gap-1.5">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase ${
                        item.type === 'RETURN' ? 'bg-purple-50 text-purple-700 border border-purple-200' : 'bg-red-50 text-red-700 border border-red-200'
                      }`}>
                        {item.type}
                      </span>
                      <span>{item.referenceNo}</span>
                    </span>
                    <span className="text-gray-500 font-mono text-[10px]">{item.date}</span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-gray-700 font-medium pt-1">
                    <span>Retailer: <strong>{item.retailerName}</strong></span>
                    <span className="font-bold text-red-600">Qty: {item.quantity}</span>
                  </div>
                  <p className="text-[10px] text-gray-500 italic bg-white p-1.5 rounded border border-[#E5E5E5]">
                    Reason: {item.reason}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* SECTION 3: ORDER-WISE BREAKDOWN TABLE */}
      <div className="bg-white rounded-2xl border border-[#E5E5E5] p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-[#E5E5E5] pb-3">
          <div>
            <h2 className="text-base font-bold text-[#1F1F1F]">Order-Wise Item Breakdown Table</h2>
            <p className="text-[11px] text-gray-500">
              Detailed list of every wholesale order containing {product.title}
            </p>
          </div>
          <span className="text-xs text-gray-500 font-mono">
            Total Orders Found: {productOrders.length}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[950px]">
            <thead>
              <tr className="border-b border-[#E5E5E5] text-gray-400 font-bold uppercase tracking-wider">
                <th className="pb-3">Retailer Business Name</th>
                <th className="pb-3">Order ID & Date</th>
                <th className="pb-3 text-center">Qty Ordered</th>
                <th className="pb-3 text-right">Unit Price</th>
                <th className="pb-3 text-right">Item Total</th>
                <th className="pb-3 text-right">Profit Earned</th>
                <th className="pb-3">Status</th>
                <th className="pb-3">Delivery City</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E5E5]">
              {paginatedOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-gray-400 text-xs">
                    No orders have been placed for this product yet.
                  </td>
                </tr>
              ) : (
                paginatedOrders.map((ord, idx) => (
                  <tr key={idx} className="hover:bg-[#FAF9F7] transition-colors">
                    <td className="py-3.5 font-bold text-[#1F1F1F]">{ord.retailerName}</td>
                    <td className="py-3.5">
                      <div className="font-mono font-bold text-gray-800">{ord.orderNumber}</div>
                      <div className="text-[10px] text-gray-400">{ord.orderDate}</div>
                    </td>
                    <td className="py-3.5 text-center font-bold text-sm text-[#1F1F1F]">{ord.quantity}</td>
                    <td className="py-3.5 text-right font-mono text-gray-700">{formatCurrency(ord.unitPrice)}</td>
                    <td className="py-3.5 text-right font-mono font-bold text-[#C62828]">{formatCurrency(ord.subtotal)}</td>
                    <td className="py-3.5 text-right font-mono font-bold text-[#2E7D32]">+{formatCurrency(ord.profit)}</td>
                    <td className="py-3.5">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                          ord.status === 'DELIVERED'
                            ? 'bg-[#E8F5E9] text-[#2E7D32] border border-[#2E7D32]/20'
                            : ord.status === 'CANCELLED'
                            ? 'bg-red-50 text-red-600 border border-red-200'
                            : 'bg-blue-50 text-blue-700 border border-blue-200'
                        }`}
                      >
                        {ord.status}
                      </span>
                    </td>
                    <td className="py-3.5 text-gray-600 font-semibold">{ord.retailerCity}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Orders Table Pagination */}
        {totalOrderPages > 1 && (
          <div className="flex items-center justify-between border-t border-[#E5E5E5] pt-3 text-xs">
            <span className="text-gray-500 font-medium">
              Page {ordersPage} of {totalOrderPages} ({productOrders.length} Total Orders)
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setOrdersPage((p) => Math.max(1, p - 1))}
                disabled={ordersPage === 1}
                className="px-3 py-1.5 bg-[#FAF9F7] border border-[#E5E5E5] rounded-xl text-gray-700 hover:bg-[#E5E5E5] disabled:opacity-50 flex items-center gap-1 font-bold"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Previous</span>
              </button>
              <button
                onClick={() => setOrdersPage((p) => Math.min(totalOrderPages, p + 1))}
                disabled={ordersPage === totalOrderPages}
                className="px-3 py-1.5 bg-[#FAF9F7] border border-[#E5E5E5] rounded-xl text-gray-700 hover:bg-[#E5E5E5] disabled:opacity-50 flex items-center gap-1 font-bold"
              >
                <span>Next</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* SECTION 2: STOCK MOVEMENT HISTORY */}
      <div className="bg-white rounded-2xl border border-[#E5E5E5] p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#E5E5E5]">
          <div className="flex items-center gap-2">
            <History className="w-4.5 h-4.5 text-[#C62828]" />
            <h2 className="text-base font-bold text-[#1F1F1F]">Stock Movement History Audit Log</h2>
          </div>
          <span className="text-[10px] bg-[#FAF9F7] text-gray-500 font-mono px-2 py-0.5 rounded border border-[#E5E5E5]">
            Chronological Audit
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[700px]">
            <thead>
              <tr className="border-b border-[#E5E5E5] text-gray-400 font-bold uppercase tracking-wider">
                <th className="pb-3">Date & Time</th>
                <th className="pb-3">Change Type</th>
                <th className="pb-3 text-center">Quantity Changed</th>
                <th className="pb-3">Reason / Note</th>
                <th className="pb-3 text-right">Resulting Stock Level</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E5E5]">
              {stockLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-gray-400 text-xs">
                    No stock movement audit records logged for this product.
                  </td>
                </tr>
              ) : (
                stockLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-[#FAF9F7] transition-colors">
                    <td className="py-3.5 font-mono text-gray-600">{log.date}</td>
                    <td className="py-3.5">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                          log.changeType === 'Order Fulfillment'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : log.changeType === 'Return Restock'
                            ? 'bg-purple-50 text-purple-700 border border-purple-200'
                            : log.changeType === 'Manual Addition'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {log.changeType}
                      </span>
                    </td>
                    <td className="py-3.5 text-center font-mono font-extrabold">
                      <span className={log.changeAmount > 0 ? 'text-[#2E7D32]' : 'text-[#C62828]'}>
                        {log.changeAmount > 0 ? `+${log.changeAmount}` : log.changeAmount} units
                      </span>
                    </td>
                    <td className="py-3.5 text-gray-700 font-medium">{log.reason}</td>
                    <td className="py-3.5 text-right font-mono font-extrabold text-[#1F1F1F]">
                      {log.resultingStock !== undefined ? `${log.resultingStock} units` : `${product.stock} units`}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION 6: PRE-FILLED EDIT PRODUCT MODAL */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto border border-[#E5E5E5] shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5E5E5]">
              <h2 className="text-base font-extrabold text-[#1F1F1F]">Edit Product Details: {product.title}</h2>
              <button onClick={() => setShowEditModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-bold">
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveProductEdit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Product Title *</label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-[#E5E5E5] rounded-xl bg-[#FAF9F7] font-bold text-[#1F1F1F]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">SKU Code *</label>
                  <input
                    type="text"
                    required
                    value={sku}
                    onChange={(e) => setSku(e.target.value.toUpperCase())}
                    className="w-full px-3.5 py-2.5 border border-[#E5E5E5] rounded-xl bg-[#FAF9F7] font-mono font-bold text-[#1F1F1F]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Category *</label>
                  <select
                    value={categoryName}
                    onChange={(e) => setCategoryName(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-[#E5E5E5] rounded-xl bg-[#FAF9F7] font-bold text-gray-800"
                  >
                    <option value="">-- Select Category --</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Minimum Order Qty (MOQ) *</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={minOrderQty}
                    onChange={(e) => setMinOrderQty(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 border border-[#E5E5E5] rounded-xl bg-[#FAF9F7] font-bold text-[#1F1F1F]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Cost Price (₹) *</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={costPrice}
                    onChange={(e) => setCostPrice(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 border border-[#E5E5E5] rounded-xl bg-[#FAF9F7] font-mono font-bold text-[#1F1F1F]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Wholesale Selling Price (₹) *</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={sellingPrice}
                    onChange={(e) => setSellingPrice(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 border border-[#E5E5E5] rounded-xl bg-[#FAF9F7] font-mono font-bold text-[#C62828]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Current Stock *</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={stock}
                    onChange={(e) => setStock(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 border border-[#E5E5E5] rounded-xl bg-[#FAF9F7] font-mono font-bold text-[#1F1F1F]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Image URL</label>
                <input
                  type="text"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3.5 py-2.5 border border-[#E5E5E5] rounded-xl bg-[#FAF9F7] font-medium text-xs"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Product Description</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full p-3 border border-[#E5E5E5] rounded-xl bg-[#FAF9F7] font-medium text-xs"
                />
              </div>

              <div className="pt-3 border-t border-[#E5E5E5] flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 font-bold text-gray-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 bg-[#C62828] text-white font-bold rounded-xl hover:bg-[#B71C1C] disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : 'Save Product Updates'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MANUAL STOCK ADJUSTMENT MODAL */}
      {showAdjustModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 border border-[#E5E5E5] shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5E5E5]">
              <h2 className="text-base font-bold text-[#1F1F1F]">Manual Stock Adjustment</h2>
              <button onClick={() => setShowAdjustModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleApplyStockAdjust} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-gray-700 mb-1">Target Product</label>
                <div className="p-2.5 bg-[#FAF9F7] border border-[#E5E5E5] rounded-xl font-bold text-[#1F1F1F]">
                  {product.title}
                  <span className="block text-[10px] font-mono text-gray-400 mt-0.5">
                    Current Stock: {product.stock} units
                  </span>
                </div>
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Stock Adjustment Quantity (+ or -)</label>
                <input
                  type="number"
                  required
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(Number(e.target.value))}
                  placeholder="e.g. +50 for Restock, -10 for Damaged"
                  className="w-full px-3.5 py-2.5 border border-[#E5E5E5] rounded-xl bg-[#FAF9F7] font-bold text-sm text-[#1F1F1F]"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Adjustment Reason *</label>
                <select
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-[#E5E5E5] rounded-xl bg-[#FAF9F7] font-medium text-xs"
                >
                  <option value="Restocked / Factory Arrival">Restocked / Factory Arrival</option>
                  <option value="Damaged Stock Audit Write-off">Damaged Stock Audit Write-off</option>
                  <option value="Inventory Count Correction">Inventory Count Correction</option>
                  <option value="Returned Order Stock Addition">Returned Order Stock Addition</option>
                </select>
              </div>

              <div className="pt-3 border-t border-[#E5E5E5] flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAdjustModal(false)}
                  className="px-4 py-2 font-bold text-gray-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#C62828] text-white font-bold rounded-xl hover:bg-[#B71C1C]"
                >
                  Apply Stock Update
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
