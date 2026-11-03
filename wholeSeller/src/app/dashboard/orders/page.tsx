'use client';

import React, { useState } from 'react';
import {
  ShoppingBag,
  Clock,
  CheckCircle2,
  Truck,
  FileText,
  Printer,
  Search,
  X,
  Building2,
  AlertCircle,
  Calendar,
  Sliders,
  RefreshCw,
  XCircle,
  ArrowRight,
  Upload,
  ExternalLink,
  Download,
  Package
} from 'lucide-react';
import { useWholesaler } from '@/context/WholesalerContext';
import { Order, OrderStatus } from '@/lib/types';
import { api, resolveProductImageUrl } from '@/lib/api';

export default function OrdersPage() {
  const { profile, orders, returns, updateOrderStatus, updateReturnStatus } = useWholesaler();

  // Filters State
  const [activeStatusTab, setActiveStatusTab] = useState<string>('ALL');
  const [dateFilter, setDateFilter] = useState<'ALL' | 'TODAY' | 'WEEK' | 'MONTH'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(50);

  React.useEffect(() => {
    setVisibleCount(50);
  }, [activeStatusTab, dateFilter, searchQuery]);

  const filteredOrders = orders.filter((order) => {
    const matchesStatus = activeStatusTab === 'ALL' || order.status === activeStatusTab;
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch = !query
      || order.orderNumber.toLowerCase().includes(query)
      || order.retailerName.toLowerCase().includes(query)
      || Boolean(order.retailerBusinessName?.toLowerCase().includes(query))
      || order.items.some((item) => item.productTitle.toLowerCase().includes(query));

    let matchesDate = true;
    if (dateFilter !== 'ALL' && order.createdAt) {
      const orderDate = new Date(order.createdAt);
      const now = new Date();
      if (!Number.isNaN(orderDate.getTime())) {
        if (dateFilter === 'TODAY') {
          matchesDate = orderDate.toDateString() === now.toDateString();
        } else if (dateFilter === 'WEEK') {
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          matchesDate = orderDate >= weekAgo;
        } else if (dateFilter === 'MONTH') {
          const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          matchesDate = orderDate >= monthAgo;
        }
      }
    }

    return matchesStatus && matchesSearch && matchesDate;
  });

  // Order Details Modal State
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [statusUpdateMessage, setStatusUpdateMessage] = useState<string | null>(null);
  const [statusUpdateError, setStatusUpdateError] = useState<string | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Shipping Details Modal State
  const [shippingModalOpen, setShippingModalOpen] = useState(false);
  const [shippingForm, setShippingForm] = useState({
    courierName: '',
    biltyNumber: '',
    trackingNumber: '',
    shippingDate: new Date().toISOString().split('T')[0],
    estimatedDeliveryDate: '',
    biltyUrl: '',
    biltyFileName: '',
    shippingNotes: '',
  });
  const [isUploadingBilty, setIsUploadingBilty] = useState(false);
  const [biltyUploadError, setBiltyUploadError] = useState<string | null>(null);
  const [shippingFormError, setShippingFormError] = useState<string | null>(null);

  // Status Badge Renderer matching explicit prompt specs
  const renderStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'PENDING':
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase bg-amber-50 text-amber-500 border border-amber-200">
            Pending
          </span>
        );
      case 'CONFIRMED':
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase bg-blue-50 text-blue-700 border border-blue-200">
            Confirmed
          </span>
        );
      case 'PROCESSING':
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase bg-purple-50 text-purple-700 border border-purple-200">
            Processing
          </span>
        );
      case 'SHIPPED':
      case 'DISPATCHED':
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase bg-indigo-50 text-indigo-700 border border-indigo-200">
            Shipped
          </span>
        );
      case 'DELIVERED':
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase bg-tradeflow-green-50 text-status-success border border-status-success/20">
            Delivered
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase bg-red-50 text-red-600 border border-red-200">
            Cancelled
          </span>
        );
    }
  };

  const openShippingModalForOrder = (order: Order) => {
    const sd = order.shippingDetails;
    setShippingForm({
      courierName: sd?.courierName || '',
      biltyNumber: sd?.biltyNumber || '',
      trackingNumber: sd?.trackingNumber || order.trackingNumber || '',
      shippingDate: sd?.shippingDate ? new Date(sd.shippingDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      estimatedDeliveryDate: sd?.estimatedDeliveryDate ? new Date(sd.estimatedDeliveryDate).toISOString().split('T')[0] : '',
      biltyUrl: sd?.biltyUrl || '',
      biltyFileName: sd?.biltyFileName || '',
      shippingNotes: sd?.shippingNotes || '',
    });
    setShippingFormError(null);
    setBiltyUploadError(null);
    setShippingModalOpen(true);
  };

  const handleBiltyFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setBiltyUploadError('Invalid file type. Please upload a PDF, JPG, or PNG document.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setBiltyUploadError('File size exceeds 10MB limit.');
      return;
    }

    setIsUploadingBilty(true);
    setBiltyUploadError(null);
    try {
      const res = await api.uploadShippingDocument(file, selectedOrder?.id);
      if (res?.data?.url) {
        setShippingForm((prev) => ({
          ...prev,
          biltyUrl: res.data.url,
          biltyFileName: res.data.fileName || file.name,
        }));
      }
    } catch (err: any) {
      setBiltyUploadError(err?.message || 'Failed to upload document. Please try again.');
    } finally {
      setIsUploadingBilty(false);
    }
  };

  const handleSaveShippingDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;

    if (!shippingForm.courierName.trim()) {
      setShippingFormError('Transport / Courier Company Name is required.');
      return;
    }
    if (!shippingForm.biltyNumber.trim() && !shippingForm.trackingNumber.trim()) {
      setShippingFormError('Bilty / LR Number or Tracking Number is required.');
      return;
    }

    setIsUpdatingStatus(true);
    setShippingFormError(null);
    try {
      await updateOrderStatus(selectedOrder.id, 'SHIPPED', shippingForm);
      setSelectedOrder((current) => current ? {
        ...current,
        status: 'SHIPPED',
        trackingNumber: shippingForm.trackingNumber || shippingForm.biltyNumber,
        shippingDetails: shippingForm,
      } : current);
      setStatusUpdateMessage('Order marked as Shipped and shipping details saved.');
      setShippingModalOpen(false);
      setTimeout(() => setStatusUpdateMessage(null), 3500);
    } catch (err: any) {
      setShippingFormError(err?.message || 'Failed to save shipping details. Please try again.');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleStatusChangeInModal = async (newStatus: OrderStatus) => {
    if (!selectedOrder || isUpdatingStatus) return;

    if (newStatus === 'SHIPPED') {
      openShippingModalForOrder(selectedOrder);
      return;
    }

    if (selectedOrder.status === newStatus) return;

    setIsUpdatingStatus(true);
    setStatusUpdateMessage(null);
    setStatusUpdateError(null);
    try {
      await updateOrderStatus(selectedOrder.id, newStatus);
      setSelectedOrder((current) => current ? { ...current, status: newStatus } : current);
      setStatusUpdateMessage(`Order status updated to "${newStatus.toLowerCase().replace(/_/g, ' ')}".`);
      setTimeout(() => setStatusUpdateMessage(null), 3500);
    } catch (error) {
      setStatusUpdateError(error instanceof Error ? error.message : 'Unable to update order status. Please try again.');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-tradeflow-navy">Orders</h1>
          <p className="text-xs text-gray-500">Track and manage retailer orders and invoices.</p>
        </div>
      </div>

      {/* Filters Bar: Status Tabs, Date Range & Search */}
      <div className="p-4 bg-white rounded-2xl border border-tradeflow-gray-200 flex flex-col lg:flex-row items-center justify-between gap-4 shadow-xs">
        {/* Status Pill Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full lg:w-auto">
          {['ALL', 'PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURNS'].map((status) => (
            <button
              key={status}
              onClick={() => setActiveStatusTab(status)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                activeStatusTab === status
                  ? 'bg-tradeflow-green text-tradeflow-navy shadow-xs'
                  : 'bg-tradeflow-gray-50 text-gray-600 hover:bg-tradeflow-gray-200'
              }`}
            >
              {status === 'ALL' ? `All (${orders.length})` : status === 'RETURNS' ? `Returns` : status}
            </button>
          ))}
        </div>

        {/* Date Range & Search */}
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          {/* Date Range Dropdown */}
          <div className="flex items-center gap-1 bg-tradeflow-gray-50 px-3 py-1.5 rounded-xl border border-tradeflow-gray-200 text-xs font-bold">
            <Calendar className="w-3.5 h-3.5 text-gray-400" />
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as any)}
              className="bg-transparent focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Time</option>
              <option value="TODAY">Today (Mar 15)</option>
              <option value="WEEK">Last 7 Days</option>
              <option value="MONTH">This Month (Mar 2026)</option>
            </select>
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search orders, retailers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-1.5 text-xs bg-tradeflow-gray-50 border border-tradeflow-gray-200 rounded-xl focus:outline-none focus:border-tradeflow-green"
            />
          </div>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-2xl border border-tradeflow-gray-200 p-6 shadow-xs">
        <div className="overflow-x-auto">
          {activeStatusTab === 'RETURNS' ? (
            <table className="w-full text-left text-xs min-w-[720px]">
              <thead>
                <tr className="border-b border-tradeflow-gray-200 text-gray-400 font-bold uppercase tracking-wider">
                  <th className="pb-3">Return ID</th>
                  <th className="pb-3">Order ID</th>
                  <th className="pb-3">Retailer</th>
                  <th className="pb-3">Reason</th>
                  <th className="pb-3">Amount</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-tradeflow-gray-200">
                {/*@ts-ignore*/}
                {returns.slice(0, visibleCount).map((ret: any) => (
                  <tr key={ret.id} className="hover:bg-tradeflow-gray-50 transition-colors group">
                    <td className="py-4 font-bold font-mono text-tradeflow-navy">{ret.returnNumber}</td>
                    <td className="py-4 font-mono text-gray-600">{ret.orderId?.orderNumber || ret.orderId}</td>
                    <td className="py-4 font-bold text-tradeflow-navy">{ret.retailerId?.name || ret.retailerId?.businessName || 'Retailer'}</td>
                    <td className="py-4 text-gray-700 font-medium max-w-xs">
                      <div className="truncate">{ret.reason}</div>
                      {ret.retailerNote && <div className="mt-1 line-clamp-2 text-[10px] font-normal text-gray-500">Note: {ret.retailerNote}</div>}
                    </td>
                    <td className="py-4 font-extrabold text-sm text-tradeflow-navy">₹{(ret.totalRefundAmount || 0).toLocaleString('en-IN')}</td>
                    <td className="py-4">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase ${ret.status === 'APPROVED' ? 'bg-tradeflow-green-50 text-status-success' : ret.status === 'REJECTED' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-500'}`}>
                        {ret.status}
                      </span>
                    </td>
                    <td className="py-4 text-right">
                      {ret.status === 'REQUESTED' && (
                        <div className="flex justify-end gap-2">
                          <button onClick={() => updateReturnStatus(ret.id, 'APPROVED')} className="px-3 py-1 bg-tradeflow-green-50 text-status-success border border-status-success/20 rounded-lg text-xs font-bold hover:bg-tradeflow-green-100 transition-colors">Approve</button>
                          <button onClick={() => updateReturnStatus(ret.id, 'REJECTED')} className="px-3 py-1 bg-red-50 text-red-600 border border-red-200 rounded-lg text-xs font-bold hover:bg-red-100 transition-colors">Reject</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-left text-xs min-w-[700px]">
              <thead>
                <tr className="border-b border-tradeflow-gray-200 text-gray-400 font-bold uppercase tracking-wider">
                  <th className="pb-3">Order ID</th>
                  <th className="pb-3">Retailer Name</th>
                  <th className="pb-3">Products</th>
                  <th className="pb-3">Quantity</th>
                  <th className="pb-3">Total Amount</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3 text-right">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-tradeflow-gray-200">
                {filteredOrders.slice(0, visibleCount).map((order) => {
                  const totalUnitsCount = order.items.reduce((acc, i) => acc + i.quantity, 0);
                  const productsSummary = order.items.map(i => i.productTitle).join(', ');
  
                  return (
                    <tr
                      key={order.id}
                      onClick={() => setSelectedOrder(order)}
                      className="hover:bg-tradeflow-gray-50 transition-colors cursor-pointer group"
                    >
                      <td className="py-4 font-bold font-mono text-tradeflow-navy group-hover:text-green-700 transition-colors">
                        {order.orderNumber}
                      </td>
                      <td className="py-4">
                        <div className="font-bold text-tradeflow-navy">{order.retailerName}</div>
                        <div className="text-[10px] text-gray-400">{order.retailerCity}</div>
                      </td>
                      <td className="py-4 text-gray-700 font-medium max-w-xs truncate" title={productsSummary}>
                        {productsSummary}
                      </td>
                      <td className="py-4 font-bold text-gray-700">
                        {totalUnitsCount} units ({order.items.length} SKUs)
                      </td>
                      <td className="py-4 font-extrabold text-sm text-tradeflow-navy">
                        ₹{(order.totalAmount || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="py-4">
                        {renderStatusBadge(order.status)}
                      </td>
                      <td className="py-4 text-right text-gray-400 font-mono">
                        {order.createdAt}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
      {(activeStatusTab === 'RETURNS' ? returns.length : filteredOrders.length) > visibleCount && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => setVisibleCount((count) => count + 50)}
            className="rounded-xl border border-tradeflow-gray-200 bg-white px-4 py-2 text-sm font-bold text-tradeflow-navy hover:bg-tradeflow-gray-50"
          >
            Load more {activeStatusTab === 'RETURNS' ? 'returns' : 'orders'}
          </button>
        </div>
      )}

      {/* ORDER DETAILS & STATUS UPDATE MODAL */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto border border-tradeflow-gray-200 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-tradeflow-gray-200">
              <div>
                <h2 className="text-lg font-bold text-tradeflow-navy">Order Details & Fulfillment</h2>
                <div className="text-xs font-mono text-green-700 font-bold">{selectedOrder.orderNumber} • Placed on {selectedOrder.createdAt}</div>
              </div>
              <button onClick={() => setSelectedOrder(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Auto-Deduction Notification Message */}
            {statusUpdateMessage && (
              <div className="p-3 bg-tradeflow-green-50 border border-status-success/20 rounded-xl text-xs text-status-success font-bold flex items-center gap-2 animate-pulse">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{statusUpdateMessage}</span>
              </div>
            )}
            {statusUpdateError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-bold flex items-center gap-2" role="alert">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{statusUpdateError}</span>
              </div>
            )}

            {/* STATUS UPDATE DROPDOWN SELECTOR */}
            <div className="p-4 bg-tradeflow-gray-50 rounded-xl border border-tradeflow-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-[10px] font-bold uppercase text-gray-400 block mb-0.5">Order Status</span>
                <span className="text-xs text-gray-600 font-medium">Select Shipped to enter transport & bilty details.</span>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-gray-700">Update Status:</label>
                <select
                  value={selectedOrder.status}
                  onChange={(e) => handleStatusChangeInModal(e.target.value as OrderStatus)}
                  disabled={isUpdatingStatus}
                  className="px-3 py-1.5 bg-white border border-tradeflow-gray-200 rounded-xl font-bold text-xs focus:outline-none focus:border-tradeflow-green cursor-pointer"
                >
                  <option value="PENDING">Pending</option>
                  <option value="CONFIRMED">Confirmed</option>
                  <option value="PROCESSING">Processing</option>
                  <option value="SHIPPED">Shipped</option>
                  <option value="DELIVERED">Delivered</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>
            </div>

            {/* SHIPPING DETAILS CARD (when Shipped / Delivered / details exist) */}
            {(selectedOrder.shippingDetails || selectedOrder.status === 'SHIPPED' || selectedOrder.status === 'DELIVERED') && (
              <div className="p-4 rounded-xl bg-blue-50/50 border border-blue-200 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Truck className="w-4 h-4 text-blue-600" />
                    <span className="font-extrabold text-tradeflow-navy">Shipping & Transport Details</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => openShippingModalForOrder(selectedOrder)}
                    className="text-[11px] font-bold text-blue-700 hover:underline"
                  >
                    Edit Shipping Details
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white p-3 rounded-lg border border-blue-100">
                  <div>
                    <span className="text-[10px] text-gray-400 font-bold uppercase block">Courier / Transport</span>
                    <span className="font-bold text-tradeflow-navy">{selectedOrder.shippingDetails?.courierName || '—'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 font-bold uppercase block">Bilty / LR No</span>
                    <span className="font-mono font-bold text-tradeflow-navy">{selectedOrder.shippingDetails?.biltyNumber || '—'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 font-bold uppercase block">Tracking No</span>
                    <span className="font-mono font-bold text-tradeflow-navy">{selectedOrder.shippingDetails?.trackingNumber || '—'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 font-bold uppercase block">Shipped Date</span>
                    <span className="font-bold text-tradeflow-navy">{selectedOrder.shippingDetails?.shippingDate || '—'}</span>
                  </div>
                </div>
                {selectedOrder.shippingDetails?.biltyUrl && (
                  <div className="flex items-center justify-between bg-white p-2.5 rounded-lg border border-blue-100">
                    <div className="flex items-center gap-2 truncate">
                      <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                      <span className="truncate font-semibold">{selectedOrder.shippingDetails.biltyFileName || 'Bilty Document'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <a
                        href={selectedOrder.shippingDetails.biltyUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 font-bold hover:underline flex items-center gap-1 text-[11px]"
                      >
                        <ExternalLink className="w-3 h-3" /> View
                      </a>
                      <a
                        href={selectedOrder.shippingDetails.biltyUrl}
                        download={selectedOrder.shippingDetails.biltyFileName || 'bilty'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 font-bold hover:underline flex items-center gap-1 text-[11px]"
                      >
                        <Download className="w-3 h-3" /> Download
                      </a>
                    </div>
                  </div>
                )}
                {selectedOrder.shippingDetails?.shippingNotes && (
                  <div className="text-[11px] text-gray-600 bg-white p-2.5 rounded-lg border border-blue-100">
                    <span className="font-bold text-gray-700">Notes: </span>
                    {selectedOrder.shippingDetails.shippingNotes}
                  </div>
                )}
              </div>
            )}

            {selectedOrder.cancellationReason && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs">
                <div className="font-bold text-red-700">Retailer cancellation reason</div>
                <div className="mt-1 text-gray-700">{selectedOrder.cancellationReason}</div>
                {selectedOrder.cancellationNote && <div className="mt-1 text-gray-600">Note: {selectedOrder.cancellationNote}</div>}
              </div>
            )}

            {/* Buyer & Seller Info Box */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-tradeflow-gray-50 border border-tradeflow-gray-200 text-xs">
              <div>
                <div className="text-[10px] font-bold uppercase text-gray-400 mb-1">Wholesaler (Seller)</div>
                <div className="font-bold text-tradeflow-navy">Apex Wholesale Pvt Ltd</div>
                <div className="text-gray-500">GSTIN: {profile.gstin}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase text-gray-400 mb-1">Retailer Client (Buyer)</div>
                <div className="font-bold text-tradeflow-navy">{selectedOrder.retailerName}</div>
                <div className="text-gray-500">Location: {selectedOrder.retailerCity}</div>
              </div>
            </div>

            {/* Line Items Table with actual product images */}
            <div className="space-y-2">
              <div className="text-xs font-bold text-gray-700">Items in Order</div>
              <div className="border border-tradeflow-gray-200 rounded-xl overflow-x-auto">
                <table className="w-full text-left text-xs min-w-[440px]">
                  <thead className="bg-tradeflow-gray-50 text-gray-500 font-bold border-b border-tradeflow-gray-200">
                    <tr>
                      <th className="p-2.5">Item & SKU</th>
                      <th className="p-2.5">Unit Price</th>
                      <th className="p-2.5">Quantity</th>
                      <th className="p-2.5 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-tradeflow-gray-200">
                    {selectedOrder.items.map(item => {
                      const img = item.imageUrl ? (resolveProductImageUrl(item.imageUrl) || item.imageUrl) : null;
                      return (
                        <tr key={item.id}>
                          <td className="p-2.5 font-medium">
                            <div className="flex items-center gap-2.5">
                              <div className="size-10 rounded-lg border bg-tradeflow-gray-50 shrink-0 overflow-hidden flex items-center justify-center">
                                {img ? (
                                  <img src={img} alt={item.productTitle} className="size-full object-cover" onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }} />
                                ) : (
                                  <Package className="w-4 h-4 text-gray-400" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <div className="truncate font-bold text-tradeflow-navy">{item.productTitle}</div>
                                <div className="text-[10px] font-mono text-gray-400">SKU: {item.sku}</div>
                              </div>
                            </div>
                          </td>
                          <td className="p-2.5 font-semibold">₹{item.unitPrice}</td>
                          <td className="p-2.5 font-bold">{item.quantity} pcs</td>
                          <td className="p-2.5 text-right font-bold">₹{(item.subtotal || 0).toLocaleString('en-IN')}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Financial Summary */}
            <div className="p-4 rounded-xl bg-tradeflow-gray-50 border border-tradeflow-gray-200 space-y-1.5 text-xs">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal:</span>
                <span>₹{((selectedOrder.totalAmount || 0) - (selectedOrder.taxAmount || 0) + (selectedOrder.discountAmount || 0)).toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-status-success font-medium">
                <span>Discount:</span>
                <span>- ₹{(selectedOrder.discountAmount || 0).toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>GST:</span>
                <span>+ ₹{(selectedOrder.taxAmount || 0).toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between font-extrabold text-sm text-tradeflow-navy pt-2 border-t border-tradeflow-gray-200">
                <span>Total:</span>
                <span className="text-green-700">₹{(selectedOrder.totalAmount || 0).toLocaleString('en-IN')}</span>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="pt-3 border-t border-tradeflow-gray-200 flex items-center justify-between">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 text-xs flex items-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                <span>Print Invoice</span>
              </button>

              <button
                onClick={() => setSelectedOrder(null)}
                className="px-5 py-2 bg-tradeflow-green text-tradeflow-navy font-bold text-xs rounded-xl hover:bg-tradeflow-green-hover"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DISPATCH ORDER & SHIPPING DETAILS MODAL */}
      {shippingModalOpen && selectedOrder && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-60 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 space-y-4 my-8 border border-tradeflow-gray-200 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-tradeflow-gray-200">
              <div className="flex items-center gap-2.5">
                <span className="grid size-9 place-items-center rounded-xl bg-blue-50 text-blue-600">
                  <Truck className="w-5 h-5" />
                </span>
                <div>
                  <h2 className="text-base font-extrabold text-tradeflow-navy">Dispatch Order & Shipping Details</h2>
                  <p className="text-[11px] text-gray-500 font-mono">Order {selectedOrder.orderNumber} • {selectedOrder.retailerName}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShippingModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {shippingFormError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{shippingFormError}</span>
              </div>
            )}

            {/* Product Image & Details Preview */}
            <div className="p-3 rounded-xl bg-tradeflow-gray-50 border border-tradeflow-gray-200">
              <span className="text-[10px] font-bold uppercase text-gray-400 block mb-2">Ordered Products in this Shipment</span>
              <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                {selectedOrder.items.map((item, idx) => {
                  const img = item.imageUrl ? (resolveProductImageUrl(item.imageUrl) || item.imageUrl) : null;
                  return (
                    <div key={idx} className="flex items-center gap-3 bg-white p-2 rounded-lg border border-tradeflow-gray-200">
                      <div className="size-10 rounded-lg border bg-tradeflow-gray-50 shrink-0 overflow-hidden flex items-center justify-center">
                        {img ? (
                          <img src={img} alt={item.productTitle} className="size-full object-cover" onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }} />
                        ) : (
                          <Package className="w-4 h-4 text-gray-400" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-tradeflow-navy truncate">{item.productTitle}</p>
                        <p className="text-[10px] text-gray-400">SKU: {item.sku} • Qty: <strong className="text-tradeflow-navy">{item.quantity} pcs</strong></p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <form onSubmit={handleSaveShippingDetails} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="text-xs font-bold text-tradeflow-navy block mb-1">
                    Transport / Courier Company Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. VRL Logistics, Safechem, Delhivery, BlueDart"
                    value={shippingForm.courierName}
                    onChange={(e) => setShippingForm({ ...shippingForm, courierName: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-tradeflow-gray-50 border border-tradeflow-gray-200 rounded-xl focus:outline-none focus:border-tradeflow-green font-semibold"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-tradeflow-navy block mb-1">
                    Bilty / LR Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. BLT-98234 / LR-4401"
                    value={shippingForm.biltyNumber}
                    onChange={(e) => setShippingForm({ ...shippingForm, biltyNumber: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-tradeflow-gray-50 border border-tradeflow-gray-200 rounded-xl focus:outline-none focus:border-tradeflow-green font-mono"
                  />
                  <span className="text-[10px] text-gray-400 block mt-0.5">Mandatory for transport shipments</span>
                </div>

                <div>
                  <label className="text-xs font-bold text-tradeflow-navy block mb-1">
                    Transport / Tracking Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. TRK-77881920"
                    value={shippingForm.trackingNumber}
                    onChange={(e) => setShippingForm({ ...shippingForm, trackingNumber: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-tradeflow-gray-50 border border-tradeflow-gray-200 rounded-xl focus:outline-none focus:border-tradeflow-green font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-tradeflow-navy block mb-1">
                    Shipping Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={shippingForm.shippingDate}
                    onChange={(e) => setShippingForm({ ...shippingForm, shippingDate: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-tradeflow-gray-50 border border-tradeflow-gray-200 rounded-xl focus:outline-none focus:border-tradeflow-green font-medium"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-tradeflow-navy block mb-1">
                    Estimated Delivery Date
                  </label>
                  <input
                    type="date"
                    value={shippingForm.estimatedDeliveryDate}
                    onChange={(e) => setShippingForm({ ...shippingForm, estimatedDeliveryDate: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-tradeflow-gray-50 border border-tradeflow-gray-200 rounded-xl focus:outline-none focus:border-tradeflow-green font-medium"
                  />
                </div>
              </div>

              {/* Bilty Document Upload */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-tradeflow-navy block">
                  Shipping Document / Bilty Upload (PDF, JPG, PNG)
                </label>
                <div className="border-2 border-dashed border-tradeflow-gray-200 hover:border-tradeflow-green rounded-xl p-3 bg-tradeflow-gray-50 transition-colors">
                  {shippingForm.biltyUrl ? (
                    <div className="flex items-center justify-between bg-white p-2.5 rounded-lg border border-tradeflow-gray-200">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="w-4 h-4 text-tradeflow-green shrink-0" />
                        <span className="text-xs font-bold text-tradeflow-navy truncate">{shippingForm.biltyFileName || 'Attached Bilty Document'}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <a
                          href={shippingForm.biltyUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"
                        >
                          <ExternalLink className="w-3.5 h-3.5" /> View
                        </a>
                        <button
                          type="button"
                          onClick={() => setShippingForm({ ...shippingForm, biltyUrl: '', biltyFileName: '' })}
                          className="text-xs font-bold text-red-500 hover:underline"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center cursor-pointer py-2">
                      <Upload className={`w-6 h-6 text-gray-400 mb-1 ${isUploadingBilty ? 'animate-bounce text-tradeflow-green' : ''}`} />
                      <span className="text-xs font-bold text-gray-700">
                        {isUploadingBilty ? 'Uploading document...' : 'Click to upload Bilty / LR Document'}
                      </span>
                      <span className="text-[10px] text-gray-400 mt-0.5">PDF, PNG, JPG up to 10MB</span>
                      <input
                        type="file"
                        accept=".pdf,image/png,image/jpeg,image/jpg,image/webp"
                        disabled={isUploadingBilty}
                        onChange={handleBiltyFileUpload}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
                {biltyUploadError && (
                  <p className="text-[11px] text-red-600 font-semibold">{biltyUploadError}</p>
                )}
              </div>

              {/* Additional Shipping Notes */}
              <div>
                <label className="text-xs font-bold text-tradeflow-navy block mb-1">
                  Additional Shipping Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Driver contact: 9876543210, 4 cartons packed with tamper-evident tape."
                  value={shippingForm.shippingNotes}
                  onChange={(e) => setShippingForm({ ...shippingForm, shippingNotes: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-tradeflow-gray-50 border border-tradeflow-gray-200 rounded-xl focus:outline-none focus:border-tradeflow-green font-medium"
                />
              </div>

              <div className="pt-3 border-t border-tradeflow-gray-200 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  disabled={isUpdatingStatus || isUploadingBilty}
                  onClick={() => setShippingModalOpen(false)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingStatus || isUploadingBilty}
                  className="px-5 py-2 bg-tradeflow-green text-tradeflow-navy font-bold text-xs rounded-xl hover:bg-tradeflow-green-hover disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Truck className="w-3.5 h-3.5" />
                  <span>{isUpdatingStatus ? 'Saving...' : 'Confirm & Mark as Shipped'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
