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
  ArrowRight
} from 'lucide-react';
import { useWholesaler } from '@/context/WholesalerContext';
import { Order, OrderStatus } from '@/lib/mock-data';

export default function OrdersPage() {
  const { profile, orders, returns, updateOrderStatus, updateReturnStatus } = useWholesaler();

  // Filters State
  const [activeStatusTab, setActiveStatusTab] = useState<string>('ALL');
  const [dateFilter, setDateFilter] = useState<'ALL' | 'TODAY' | 'WEEK' | 'MONTH'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Order Details Modal State
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [statusUpdateMessage, setStatusUpdateMessage] = useState<string | null>(null);

  // Status Badge Renderer matching explicit prompt specs
  const renderStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'PENDING':
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase bg-[#FFF8E1] text-[#F9A825] border border-[#FFE082]">
            Pending
          </span>
        );
      case 'CONFIRMED':
      case 'PROCESSING':
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase bg-slate-100 text-slate-700 border border-slate-300">
            Confirmed
          </span>
        );
      case 'SHIPPED':
      case 'DISPATCHED':
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase bg-slate-100 text-slate-700 border border-slate-300">
            Shipped
          </span>
        );
      case 'DELIVERED':
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase bg-[#E8F5E9] text-[#2E7D32] border border-[#2E7D32]/20">
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

  // Filter Orders
  const filteredOrders = orders.filter(o => {
    const matchesStatus = activeStatusTab === 'ALL' || o.status === activeStatusTab;
    const matchesSearch = o.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          o.retailerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          o.items.some(i => i.productTitle.toLowerCase().includes(searchQuery.toLowerCase()));
    
    let matchesDate = true;
    if (dateFilter === 'TODAY') {
      matchesDate = o.createdAt.includes('2026-03-15');
    } else if (dateFilter === 'WEEK') {
      matchesDate = o.createdAt.includes('2026-03-15') || o.createdAt.includes('2026-03-14') || o.createdAt.includes('2026-03-12');
    } else if (dateFilter === 'MONTH') {
      matchesDate = o.createdAt.includes('2026-03');
    }

    return matchesStatus && matchesSearch && matchesDate;
  });

  const handleStatusChangeInModal = (newStatus: OrderStatus) => {
    if (!selectedOrder) return;
    
    const isAutoDeductionTrigger = selectedOrder.status === 'PENDING' && (newStatus === 'CONFIRMED' || newStatus === 'SHIPPED' || newStatus === 'PROCESSING' || newStatus === 'DISPATCHED');

    updateOrderStatus(selectedOrder.id, newStatus);
    
    // Update local modal state
    setSelectedOrder({ ...selectedOrder, status: newStatus });

    if (isAutoDeductionTrigger) {
      setStatusUpdateMessage('Order status updated to "Confirmed"! Automatic inventory stock deduction applied to warehouse products.');
      setTimeout(() => setStatusUpdateMessage(null), 3500);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#1F1F1F]">Retailer Orders Workflow</h1>
          <p className="text-xs text-gray-500">Track orders placed by connected B2B retailers, update status, and print tax invoices</p>
        </div>
      </div>

      {/* Filters Bar: Status Tabs, Date Range & Search */}
      <div className="p-4 bg-white rounded-2xl border border-[#E5E5E5] flex flex-col lg:flex-row items-center justify-between gap-4 shadow-xs">
        {/* Status Pill Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full lg:w-auto">
          {['ALL', 'PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURNS'].map((status) => (
            <button
              key={status}
              onClick={() => setActiveStatusTab(status)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                activeStatusTab === status
                  ? 'bg-[#C62828] text-white shadow-xs'
                  : 'bg-[#FAF9F7] text-gray-600 hover:bg-[#E5E5E5]'
              }`}
            >
              {status === 'ALL' ? `All Orders (${orders.length})` : status === 'RETURNS' ? `Returns` : status}
            </button>
          ))}
        </div>

        {/* Date Range & Search */}
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          {/* Date Range Dropdown */}
          <div className="flex items-center gap-1 bg-[#FAF9F7] px-3 py-1.5 rounded-xl border border-[#E5E5E5] text-xs font-bold">
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
              placeholder="Search order #, retailer, product..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-1.5 text-xs bg-[#FAF9F7] border border-[#E5E5E5] rounded-xl focus:outline-none focus:border-[#C62828]"
            />
          </div>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-2xl border border-[#E5E5E5] p-6 shadow-xs">
        <div className="overflow-x-auto">
          {activeStatusTab === 'RETURNS' ? (
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#E5E5E5] text-gray-400 font-bold uppercase tracking-wider">
                  <th className="pb-3">Return ID</th>
                  <th className="pb-3">Order ID</th>
                  <th className="pb-3">Retailer</th>
                  <th className="pb-3">Reason</th>
                  <th className="pb-3">Amount</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E5E5]">
                {/*@ts-ignore*/}
                {returns.map((ret: any) => (
                  <tr key={ret.id} className="hover:bg-[#FAF9F7] transition-colors group">
                    <td className="py-4 font-bold font-mono text-[#1F1F1F]">{ret.returnNumber}</td>
                    <td className="py-4 font-mono text-gray-600">{ret.orderId?.orderNumber || ret.orderId}</td>
                    <td className="py-4 font-bold text-[#1F1F1F]">{ret.retailerId?.name || ret.retailerId?.businessName || 'Retailer'}</td>
                    <td className="py-4 text-gray-700 font-medium max-w-xs">
                      <div className="truncate">{ret.reason}</div>
                      {ret.retailerNote && <div className="mt-1 line-clamp-2 text-[10px] font-normal text-gray-500">Note: {ret.retailerNote}</div>}
                    </td>
                    <td className="py-4 font-extrabold text-sm text-[#1F1F1F]">₹{(ret.totalRefundAmount || 0).toLocaleString('en-IN')}</td>
                    <td className="py-4">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase ${ret.status === 'APPROVED' ? 'bg-[#E8F5E9] text-[#2E7D32]' : ret.status === 'REJECTED' ? 'bg-red-50 text-red-600' : 'bg-[#FFF8E1] text-[#F9A825]'}`}>
                        {ret.status}
                      </span>
                    </td>
                    <td className="py-4 text-right">
                      {ret.status === 'REQUESTED' && (
                        <div className="flex justify-end gap-2">
                          <button onClick={() => updateReturnStatus(ret.id, 'APPROVED')} className="px-3 py-1 bg-[#E8F5E9] text-[#2E7D32] border border-[#2E7D32]/20 rounded-lg text-xs font-bold hover:bg-[#C8E6C9] transition-colors">Approve</button>
                          <button onClick={() => updateReturnStatus(ret.id, 'REJECTED')} className="px-3 py-1 bg-red-50 text-red-600 border border-red-200 rounded-lg text-xs font-bold hover:bg-red-100 transition-colors">Reject</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#E5E5E5] text-gray-400 font-bold uppercase tracking-wider">
                  <th className="pb-3">Order ID</th>
                  <th className="pb-3">Retailer Name</th>
                  <th className="pb-3">Products</th>
                  <th className="pb-3">Quantity</th>
                  <th className="pb-3">Total Amount</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3 text-right">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E5E5]">
                {filteredOrders.map((order) => {
                  const totalUnitsCount = order.items.reduce((acc, i) => acc + i.quantity, 0);
                  const productsSummary = order.items.map(i => i.productTitle).join(', ');
  
                  return (
                    <tr
                      key={order.id}
                      onClick={() => setSelectedOrder(order)}
                      className="hover:bg-[#FAF9F7] transition-colors cursor-pointer group"
                    >
                      <td className="py-4 font-bold font-mono text-[#1F1F1F] group-hover:text-[#C62828] transition-colors">
                        {order.orderNumber}
                      </td>
                      <td className="py-4">
                        <div className="font-bold text-[#1F1F1F]">{order.retailerName}</div>
                        <div className="text-[10px] text-gray-400">{order.retailerCity}</div>
                      </td>
                      <td className="py-4 text-gray-700 font-medium max-w-xs truncate" title={productsSummary}>
                        {productsSummary}
                      </td>
                      <td className="py-4 font-bold text-gray-700">
                        {totalUnitsCount} units ({order.items.length} SKUs)
                      </td>
                      <td className="py-4 font-extrabold text-sm text-[#1F1F1F]">
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

      {/* ORDER DETAILS & STATUS UPDATE MODAL */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto border border-[#E5E5E5] shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5E5E5]">
              <div>
                <h2 className="text-lg font-bold text-[#1F1F1F]">Order Details & Fulfillment</h2>
                <div className="text-xs font-mono text-[#C62828] font-bold">{selectedOrder.orderNumber} • Placed on {selectedOrder.createdAt}</div>
              </div>
              <button onClick={() => setSelectedOrder(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Auto-Deduction Notification Message */}
            {statusUpdateMessage && (
              <div className="p-3 bg-[#E8F5E9] border border-[#2E7D32]/20 rounded-xl text-xs text-[#2E7D32] font-bold flex items-center gap-2 animate-pulse">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{statusUpdateMessage}</span>
              </div>
            )}

            {/* STATUS UPDATE DROPDOWN SELECTOR */}
            <div className="p-4 bg-[#FAF9F7] rounded-xl border border-[#E5E5E5] flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase text-gray-400 block mb-0.5">Order Status Workflow</span>
                <span className="text-xs text-gray-600 font-medium">Changing to &quot;Confirmed&quot; triggers auto-inventory stock deduction</span>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-gray-700">Update Status:</label>
                <select
                  value={selectedOrder.status}
                  onChange={(e) => handleStatusChangeInModal(e.target.value as OrderStatus)}
                  className="px-3 py-1.5 bg-white border border-[#E5E5E5] rounded-xl font-bold text-xs focus:outline-none focus:border-[#C62828] cursor-pointer"
                >
                  <option value="PENDING">Pending</option>
                  <option value="CONFIRMED">Confirmed (Auto-Deduct Stock)</option>
                  <option value="SHIPPED">Shipped</option>
                  <option value="DELIVERED">Delivered</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>
            </div>

            {selectedOrder.cancellationReason && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs">
                <div className="font-bold text-red-700">Retailer cancellation reason</div>
                <div className="mt-1 text-gray-700">{selectedOrder.cancellationReason}</div>
                {selectedOrder.cancellationNote && <div className="mt-1 text-gray-600">Note: {selectedOrder.cancellationNote}</div>}
              </div>
            )}

            {/* Buyer & Seller Info Box */}
            <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-[#FAF9F7] border border-[#E5E5E5] text-xs">
              <div>
                <div className="text-[10px] font-bold uppercase text-gray-400 mb-1">Wholesaler (Seller)</div>
                <div className="font-bold text-[#1F1F1F]">Apex Wholesale Pvt Ltd</div>
                <div className="text-gray-500">GSTIN: {profile.gstin}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase text-gray-400 mb-1">Retailer Client (Buyer)</div>
                <div className="font-bold text-[#1F1F1F]">{selectedOrder.retailerName}</div>
                <div className="text-gray-500">Location: {selectedOrder.retailerCity}</div>
              </div>
            </div>

            {/* Line Items Table */}
            <div className="space-y-2">
              <div className="text-xs font-bold text-gray-700">Line Items Breakdown</div>
              <div className="border border-[#E5E5E5] rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#FAF9F7] text-gray-500 font-bold border-b border-[#E5E5E5]">
                    <tr>
                      <th className="p-2.5">Item & SKU</th>
                      <th className="p-2.5">Unit Price</th>
                      <th className="p-2.5">Quantity</th>
                      <th className="p-2.5 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E5E5]">
                    {selectedOrder.items.map(item => (
                      <tr key={item.id}>
                        <td className="p-2.5 font-medium">
                          <div>{item.productTitle}</div>
                          <div className="text-[10px] font-mono text-gray-400">SKU: {item.sku}</div>
                        </td>
                        <td className="p-2.5">₹{item.unitPrice}</td>
                        <td className="p-2.5 font-bold">{item.quantity} pcs</td>
                        <td className="p-2.5 text-right font-bold">₹{(item.subtotal || 0).toLocaleString('en-IN')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Financial Summary */}
            <div className="p-4 rounded-xl bg-[#FAF9F7] border border-[#E5E5E5] space-y-1.5 text-xs">
              <div className="flex justify-between text-gray-600">
                <span>Gross Subtotal:</span>
                <span>₹{((selectedOrder.totalAmount || 0) - (selectedOrder.taxAmount || 0) + (selectedOrder.discountAmount || 0)).toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-[#2E7D32] font-medium">
                <span>Wholesale Discount Applied:</span>
                <span>- ₹{(selectedOrder.discountAmount || 0).toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>GST Tax (12%):</span>
                <span>+ ₹{(selectedOrder.taxAmount || 0).toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between font-extrabold text-sm text-[#1F1F1F] pt-2 border-t border-[#E5E5E5]">
                <span>Total Amount Payable:</span>
                <span className="text-[#C62828]">₹{(selectedOrder.totalAmount || 0).toLocaleString('en-IN')}</span>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="pt-3 border-t border-[#E5E5E5] flex items-center justify-between">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 text-xs flex items-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                <span>Print Tax Invoice</span>
              </button>

              <button
                onClick={() => setSelectedOrder(null)}
                className="px-5 py-2 bg-[#C62828] text-white font-bold text-xs rounded-xl hover:bg-[#B71C1C]"
              >
                Close Order Details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
