import { useEffect, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, CalendarClock, CreditCard, Package, Printer, Store, Truck } from 'lucide-react';
import { useWholesaler } from '@/context/WholesalerContext';
import api, { resolveProductImageUrl } from '@/lib/api';
import { wholesalerQueryKeys } from '@/lib/query-client';
import type { OrderDetailsAddress, OrderDetailsParty } from '@/lib/types';

const currency = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
});

function money(value: number | undefined) {
  return currency.format(Number(value || 0));
}

function dateTime(value?: string) {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Not recorded'
    : date.toLocaleString('en-IN', { dateStyle: 'full', timeStyle: 'short' });
}

function addressText(address?: OrderDetailsAddress | string) {
  if (!address) return '';
  if (typeof address === 'string') return address;
  return [
    address.street || address.addressLine1,
    address.addressLine2,
    address.city,
    address.state,
    address.pincode,
    address.country,
  ].filter(Boolean).join(', ');
}

function partyText(party?: OrderDetailsParty) {
  return [
    party?.businessName || party?.name,
    party?.phone,
    party?.email,
    party?.city,
    party?.state,
  ].filter(Boolean);
}

export default function OrderDetailsPage() {
  const navigate = useNavigate();
  const { orderId = '' } = useParams();
  const [searchParams] = useSearchParams();
  const { profile } = useWholesaler();
  const printStartedFor = useRef('');
  const query = useQuery({
    queryKey: wholesalerQueryKeys.resource(profile.id || 'unknown', 'orders', 'detail', orderId),
    queryFn: () => api.getOrderById(orderId),
    enabled: Boolean(profile.id && orderId),
  });
  const response = query.data?.data;
  const order = response?.order;
  const populatedRetailer = typeof order?.retailerId === 'object' ? order.retailerId : undefined;
  const retailer = order?.retailer || populatedRetailer;
  const retailerAddress = retailer?.address || populatedRetailer?.address;
  const items = order?.items || [];
  const total = Number(order?.totalAmount ?? order?.grandTotal ?? response?.totals?.totalAmount ?? 0);
  const shouldPrint = searchParams.get('print') === '1';

  useEffect(() => {
    if (!shouldPrint || !order || printStartedFor.current === orderId) return;
    printStartedFor.current = orderId;
    const timer = window.setTimeout(() => window.print(), 400);
    return () => window.clearTimeout(timer);
  }, [order, orderId, shouldPrint]);

  if (query.isLoading) {
    return <main className="mx-auto max-w-5xl p-4 sm:p-8" role="status">Loading order details…</main>;
  }

  if (query.isError || !order) {
    return (
      <main className="mx-auto max-w-5xl space-y-4 p-4 sm:p-8">
        <button type="button" onClick={() => navigate('/dashboard/orders')} className="inline-flex items-center gap-2 text-sm font-bold text-emerald-800">
          <ArrowLeft className="h-4 w-4" /> Back to Orders
        </button>
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {query.error instanceof Error ? query.error.message : 'Order details could not be loaded.'}
        </p>
      </main>
    );
  }

  const timeline = response.timeline?.length
    ? response.timeline
    : (order.statusTimeline || []).map((entry) => ({
      status: entry.status,
      note: entry.note,
      createdAt: entry.timestamp,
    }));

  return (
    <main id="order-details-print" className="mx-auto max-w-5xl space-y-5 p-4 sm:p-8">
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #order-details-print, #order-details-print * { visibility: visible !important; }
          #order-details-print { position: absolute; inset: 0; width: 100%; max-width: none; padding: 0; }
        }
      `}</style>
      <header className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <button type="button" onClick={() => navigate('/dashboard/orders')} className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-bold text-stone-700 hover:bg-stone-50">
          <ArrowLeft className="h-4 w-4" /> Back to Orders
        </button>
        <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-800">
          <Printer className="h-4 w-4" /> Print Order
        </button>
      </header>

      <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-stone-100 pb-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-800">Order details</p>
            <h1 className="mt-1 text-2xl font-extrabold text-stone-900">{order.orderNumber}</h1>
            <p className="mt-2 inline-flex items-center gap-2 text-sm text-stone-500">
              <CalendarClock className="h-4 w-4" /> Placed {dateTime(order.createdAt)}
            </p>
          </div>
          <div className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-extrabold uppercase text-emerald-800">
            {order.orderStatus || order.status || 'Status unavailable'}
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <article className="rounded-xl border border-stone-200 bg-stone-50 p-4">
            <h2 className="flex items-center gap-2 text-sm font-bold text-stone-800"><Store className="h-4 w-4" /> Retailer details</h2>
            <div className="mt-3 space-y-1 text-sm text-stone-600">
              <p className="font-bold text-stone-900">{retailer?.businessName || retailer?.name || 'Retailer'}</p>
              {partyText(retailer).slice(1).map((value, index) => <p key={`${index}-${value}`}>{value}</p>)}
              {addressText(retailerAddress) && <p>{addressText(retailerAddress)}</p>}
            </div>
          </article>
          <article className="rounded-xl border border-stone-200 bg-stone-50 p-4">
            <h2 className="flex items-center gap-2 text-sm font-bold text-stone-800"><Truck className="h-4 w-4" /> Delivery details</h2>
            <div className="mt-3 space-y-1 text-sm text-stone-600">
              <p>{addressText(order.shippingAddress) || 'Shipping address not recorded'}</p>
              <p>Payment status: <strong className="text-stone-900">{order.paymentStatus || 'Not recorded'}</strong></p>
              {order.shippingDetails?.courierName && <p>Courier: {order.shippingDetails.courierName}</p>}
              {order.shippingDetails?.biltyNumber && <p>Bilty / LR: {order.shippingDetails.biltyNumber}</p>}
              {order.shippingDetails?.trackingNumber && <p>Tracking: {order.shippingDetails.trackingNumber}</p>}
              {order.shippingDetails?.shippedAt && <p>Shipped: {dateTime(order.shippingDetails.shippedAt)}</p>}
              {order.shippingDetails?.estimatedDeliveryDate && <p>Estimated delivery: {dateTime(order.shippingDetails.estimatedDeliveryDate)}</p>}
            </div>
          </article>
        </div>

        <section className="mt-6">
          <h2 className="flex items-center gap-2 text-base font-extrabold text-stone-900"><Package className="h-4 w-4" /> Purchased products</h2>
          <div className="mt-3 overflow-x-auto rounded-xl border border-stone-200">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-stone-50 text-xs font-bold uppercase text-stone-500">
                <tr><th className="p-3">Product</th><th className="p-3">SKU</th><th className="p-3 text-right">Unit price</th><th className="p-3 text-right">Quantity</th><th className="p-3 text-right">Line total</th></tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {items.map((item, index) => {
                  const image = item.product?.imageUrl || item.imageUrl;
                  const imageUrl = image ? resolveProductImageUrl(image) : null;
                  const unitPrice = Number(item.pricePerUnit || 0);
                  const quantity = Number(item.quantity || 0);
                  return (
                    <tr key={item.product?.id || item._id || index}>
                      <td className="p-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-stone-200 bg-stone-50">
                            {imageUrl ? <img src={imageUrl} alt={item.product?.name || item.productName || 'Product'} className="h-full w-full object-cover" /> : <Package className="h-5 w-5 text-stone-400" />}
                          </div>
                          <span className="font-bold text-stone-900">{item.product?.name || item.productName || item.name || 'Product'}</span>
                        </div>
                      </td>
                      <td className="p-3 font-mono text-xs text-stone-500">{item.product?.sku || item.sku || '—'}</td>
                      <td className="p-3 text-right">{money(unitPrice)}</td>
                      <td className="p-3 text-right">{quantity}</td>
                      <td className="p-3 text-right font-bold">{money(item.totalPrice ?? unitPrice * quantity)}</td>
                    </tr>
                  );
                })}
                {!items.length && <tr><td colSpan={5} className="p-6 text-center text-stone-500">No product details are available for this order.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <div className="mt-5 grid gap-4 md:grid-cols-[1fr_auto]">
          <article className="rounded-xl border border-stone-200 p-4">
            <h2 className="flex items-center gap-2 text-sm font-bold text-stone-800"><CreditCard className="h-4 w-4" /> Payment and notes</h2>
            <div className="mt-3 space-y-1 text-sm text-stone-600">
              <p>Method: {response.payment?.paymentMethod || response.payment?.method || 'Not recorded'}</p>
              <p>Transaction reference: {response.payment?.transactionReference || 'Not recorded'}</p>
              <p>Last payment update: {dateTime(response.payment?.createdAt)}</p>
              {(order.notes || order.wholesalerNotes) && <p>Notes: {order.wholesalerNotes || order.notes}</p>}
              {order.cancellationReason && <p className="text-red-700">Cancellation reason: {order.cancellationReason} {order.cancellationNote || ''}</p>}
            </div>
          </article>
          <dl className="min-w-60 space-y-2 rounded-xl bg-stone-50 p-4 text-sm">
            <div className="flex justify-between gap-6"><dt className="text-stone-500">Subtotal</dt><dd>{money(order.subtotal)}</dd></div>
            <div className="flex justify-between gap-6"><dt className="text-stone-500">Tax</dt><dd>{money(order.tax)}</dd></div>
            <div className="flex justify-between gap-6"><dt className="text-stone-500">Shipping</dt><dd>{money(order.shipping)}</dd></div>
            <div className="flex justify-between gap-6"><dt className="text-stone-500">Discount</dt><dd>−{money(order.discount)}</dd></div>
            <div className="flex justify-between gap-6 border-t border-stone-200 pt-2 text-base font-extrabold"><dt>Total</dt><dd>{money(total)}</dd></div>
          </dl>
        </div>

        {!!timeline.length && (
          <section className="mt-6 border-t border-stone-100 pt-5">
            <h2 className="text-sm font-extrabold text-stone-900">Order timeline</h2>
            <ol className="mt-3 space-y-3">
              {timeline.map((entry, index) => (
                <li key={`${entry.status || 'status'}-${entry.createdAt || index}`} className="flex flex-wrap justify-between gap-2 rounded-lg bg-stone-50 px-3 py-2 text-sm">
                  <span className="font-bold text-stone-800">{entry.status || 'Status update'}{entry.note ? ` · ${entry.note}` : ''}</span>
                  <time className="text-xs text-stone-500">{dateTime(entry.createdAt)}</time>
                </li>
              ))}
            </ol>
          </section>
        )}
      </section>
    </main>
  );
}
