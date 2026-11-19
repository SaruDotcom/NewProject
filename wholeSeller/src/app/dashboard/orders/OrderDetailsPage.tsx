import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, CalendarClock, CreditCard, Download, Package, Printer, Store, Truck } from 'lucide-react';
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

function dateOnly(value?: string) {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not recorded' : date.toLocaleDateString('en-IN', { dateStyle: 'medium' });
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
  const [downloadError, setDownloadError] = useState('');
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
  const invoiceAvailable = Boolean(response?.invoice?.available);
  const invoiceNumber = response?.invoice?.number || `INV-${order?.orderNumber || ''}`;
  const seller = response?.invoice?.seller || order?.wholesaler;
  const buyer = response?.invoice?.buyer || retailer;
  const taxTotal = items.reduce((sum, item) => sum + Number(item.gstAmount || 0), 0);
  const taxableTotal = items.reduce((sum, item) => sum + Number(item.taxableValue ?? item.totalPrice ?? 0), 0);
  const paidTotal = !order
    ? 0
    : order.isCreditOrder
      ? Number(order.creditPaidAmount || 0)
      : Number.isSafeInteger(order.directPaidPaise)
        ? Number(order.directPaidPaise) / 100
        : String(order.paymentStatus || '').toUpperCase() === 'PAID'
        ? total
        : Number(response?.totals?.paidAmount || 0);
  const shouldPrint = searchParams.get('print') === '1';

  useEffect(() => {
    if (!shouldPrint || !order || !invoiceAvailable || printStartedFor.current === orderId) return;
    printStartedFor.current = orderId;
    const timer = window.setTimeout(() => window.print(), 400);
    return () => window.clearTimeout(timer);
  }, [order, orderId, shouldPrint, invoiceAvailable]);

  const downloadInvoice = async () => {
    setDownloadError('');
    try {
      const blob = await api.downloadOrderInvoice(orderId);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${invoiceNumber.replace(/[^a-z0-9-]/gi, '-')}.pdf`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : 'Unable to download this invoice.');
    }
  };

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

  function BusinessLogo({ logo, name }: { logo?: string; name: string }) {
    const [failed, setFailed] = useState(false);
    return (
      <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden border border-stone-200 bg-stone-50">
        {logo && !failed
          ? <img src={logo} alt={`${name} business logo`} className="h-full w-full object-contain p-1" onError={() => setFailed(true)} />
          : <span className="px-1 text-center text-xs font-bold tracking-wide text-stone-500">{name.slice(0, 2).toUpperCase()}</span>}
      </div>
    );
  }

  function InvoiceParty({
    title,
    party,
    fallbackName,
  }: {
    title: string;
    party?: OrderDetailsParty;
    fallbackName: string;
  }) {
    const name = party?.businessName || party?.name || fallbackName;
    return (
      <article className="border border-stone-200 p-3">
        <h2 className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#9a7941]">{title}</h2>
        <div className="mt-3 flex items-start gap-3">
          <BusinessLogo logo={party?.logo} name={name} />
          <div className="min-w-0 text-xs">
            <p className="font-bold">{name}</p>
            <p className="mt-1 leading-5 text-[#657181]">{addressText(party?.address) || 'Address not provided'}</p>
            {(party?.phone || party?.email) && <p className="mt-1 text-[#657181]">{party.phone || party.email}{party.phone && party.email ? ` · ${party.email}` : ''}</p>}
            <p className="mt-1 text-[#657181]">GSTIN: {party?.gstin || 'Not applicable'}</p>
          </div>
        </div>
      </article>
    );
  }

  function InvoiceTotal({ label, amount, strong = false }: { label: string; amount: string; strong?: boolean }) {
    return (
      <div className={`flex justify-between gap-3 ${strong ? 'border-t border-stone-200 pt-2 font-extrabold text-[#1d2d40]' : 'text-[#657181]'}`}>
        <dt>{label}</dt>
        <dd className="text-right">{amount}</dd>
      </div>
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
          #order-invoice-print, #order-invoice-print * { visibility: visible !important; }
          #order-invoice-print { position: absolute; inset: 0; width: 100%; max-width: none; margin: 0; padding: 0; }
          #order-invoice-print article, #order-invoice-print tr { break-inside: avoid; }
        }
        @page { size: A4; margin: 12mm; }
      `}</style>
      <header className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <button type="button" onClick={() => navigate('/dashboard/orders')} className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-bold text-stone-700 hover:bg-stone-50">
          <ArrowLeft className="h-4 w-4" /> Back to Orders
        </button>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void downloadInvoice()} disabled={!invoiceAvailable} className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-bold text-stone-700 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50">
            <Download className="h-4 w-4" /> Download Invoice PDF
          </button>
          <button type="button" onClick={() => window.print()} disabled={!invoiceAvailable} className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50">
            <Printer className="h-4 w-4" /> Print Invoice
          </button>
        </div>
      </header>

      {downloadError && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 print:hidden">{downloadError}</p>}

      <section id="order-invoice-print" className="mx-auto w-full max-w-[210mm] border border-stone-200 bg-white p-5 text-[#1d2d40] shadow-sm sm:p-8">
        {!invoiceAvailable && <p className="mb-5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 print:hidden">Invoice is available after this order is marked delivered.</p>}
        <div className="flex flex-wrap items-start justify-between gap-5 border-b-2 border-[#b3945a] pb-5">
          <div className="flex min-w-0 items-center gap-4">
            <BusinessLogo logo={seller?.logo || profile.businessLogoUrl} name={seller?.businessName || profile.businessName} />
            <div className="min-w-0">
              <p className="text-lg font-extrabold">{seller?.businessName || profile.businessName}</p>
              <p className="mt-1 text-xs leading-5 text-[#657181]">{addressText(seller?.address) || [profile.streetAddress, profile.city, profile.state, profile.pincode].filter(Boolean).join(', ') || 'Business address not provided'}</p>
              <p className="mt-1 text-xs text-[#657181]">{seller?.phone || profile.phone || 'Contact not provided'}{seller?.email || profile.email ? ` · ${seller?.email || profile.email}` : ''}{seller?.gstin || profile.gstin ? ` · GSTIN ${seller?.gstin || profile.gstin}` : ''}</p>
            </div>
          </div>
          <div className="sm:text-right">
            <p className="text-2xl font-black tracking-wide">TAX INVOICE</p>
            <p className="mt-1 font-bold text-[#9a7941]">{invoiceNumber}</p>
            <p className="mt-2 text-xs text-[#657181]">Invoice date: {invoiceAvailable ? dateOnly(response?.invoice?.date) : 'Not issued'}</p>
            <p className="text-xs text-[#657181]">Order reference: {order.orderNumber}</p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <InvoiceParty title="Supplied By" party={seller} fallbackName={profile.businessName} />
          <InvoiceParty title="Billed To" party={buyer} fallbackName={buyer?.businessName || buyer?.name || 'Retailer'} />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 border-y border-stone-200 py-3 text-xs sm:grid-cols-4">
          <p><span className="text-[#657181]">Invoice date</span><br /><strong>{invoiceAvailable ? dateOnly(response?.invoice?.date) : 'Not issued'}</strong></p>
          <p><span className="text-[#657181]">Order date</span><br /><strong>{dateOnly(order.createdAt)}</strong></p>
          <p><span className="text-[#657181]">Bilty / LR</span><br /><strong>{order.shippingDetails?.biltyNumber || 'Not provided'}</strong></p>
          <p><span className="text-[#657181]">Status</span><br /><strong>{order.orderStatus || order.status || 'Not recorded'}</strong></p>
        </div>
        {order.shippingAddress && <article className="mt-4 border border-stone-200 p-3 text-xs">
          <h2 className="font-bold uppercase tracking-wide text-[#9a7941]">Ship To</h2>
          <p className="mt-1 font-semibold">{order.shippingAddress.contactName || buyer?.businessName || buyer?.name || 'Retailer'}</p>
          <p className="mt-1 text-[#657181]">{addressText(order.shippingAddress)}</p>
          {order.shippingAddress.phone && <p className="mt-1 text-[#657181]">Phone: {order.shippingAddress.phone}</p>}
        </article>}

        <article className="mt-5 overflow-hidden border border-stone-200">
          <h2 className="border-b border-stone-200 px-3 py-3 text-sm font-extrabold">Product details</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-[11px]">
              <thead className="bg-[#1d2d40] text-[9px] uppercase tracking-wide text-white"><tr>
                <th className="p-2">S.No.</th><th className="p-2">Product / SKU</th><th className="p-2 text-right">Qty</th><th className="p-2 text-right">Unit price</th><th className="p-2 text-right">Tax</th><th className="p-2 text-right">Discount</th><th className="p-2 text-right">Total</th>
              </tr></thead>
              <tbody className="divide-y divide-stone-200">
                {items.map((item, index) => {
                  const unitPrice = Number(item.pricePerUnit || 0);
                  const itemTax = Number(item.gstAmount || 0);
                  return <tr key={item.product?.id || item._id || index} className={index % 2 === 0 ? 'bg-stone-50' : 'bg-white'}>
                    <td className="p-2">{index + 1}</td>
                    <td className="p-2"><strong>{item.name || item.product?.name || item.productName || 'Product'}</strong><div className="mt-1 text-[9px] text-[#657181]">SKU: {item.sku || item.product?.sku || '—'}{item.hsnCode ? ` · HSN: ${item.hsnCode}` : ''}</div>{item.description && <div className="mt-1 text-[9px] text-[#657181]">{item.description}</div>}</td>
                    <td className="p-2 text-right">{item.quantity} {item.unit || ''}</td>
                    <td className="p-2 text-right">{money(unitPrice)}</td>
                    <td className="p-2 text-right">{money(itemTax)}</td>
                    <td className="p-2 text-right">{money(Number(item.discountAmount || 0))}</td>
                    <td className="p-2 text-right font-bold">{money(Number(item.total ?? item.totalPrice ?? unitPrice * Number(item.quantity || 0)))}</td>
                  </tr>;
                })}
                {!items.length && <tr><td colSpan={7} className="p-6 text-center text-[#657181]">No product details are available for this order.</td></tr>}
              </tbody>
            </table>
          </div>
        </article>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <article className="border border-stone-200 p-4">
            <h2 className="text-sm font-extrabold">Payment information</h2>
            <dl className="mt-3 space-y-2 text-xs text-[#657181]">
              <div className="flex justify-between gap-3"><dt>Method</dt><dd>{response.payment?.paymentMethod || response.payment?.method || order.paymentMethod || 'Not recorded'}</dd></div>
              {response.payments?.length
                ? response.payments.map((entry, index) => <div key={`${entry.transactionRef || 'payment'}-${entry.createdAt || index}`} className="border-t border-stone-100 pt-2">
                  <div className="flex justify-between gap-3"><dt>Status</dt><dd>{entry.status || 'Not recorded'}</dd></div>
                  <div className="mt-1 flex justify-between gap-3"><dt>Reference</dt><dd>{entry.transactionRef || 'Not recorded'}</dd></div>
                  <div className="mt-1 flex justify-between gap-3"><dt>Date</dt><dd>{dateOnly(entry.paidAt || entry.reportedPaymentDate || entry.createdAt)}</dd></div>
                  <div className="mt-1 flex justify-between gap-3"><dt>Amount</dt><dd>{money(Number(entry.amount || 0))}</dd></div>
                </div>)
                : <div className="flex justify-between gap-3"><dt>Status</dt><dd>{order.paymentStatus || 'Not recorded'}</dd></div>}
            </dl>
          </article>
          <article className="border border-stone-200 p-4">
            <h2 className="text-sm font-extrabold">Invoice summary</h2>
            <dl className="mt-3 space-y-2 text-xs">
              <InvoiceTotal label="Subtotal" amount={money(order.subtotal)} />
              <InvoiceTotal label="Discount" amount={`−${money(order.discount)}`} />
              <InvoiceTotal label="Taxable amount" amount={money(taxableTotal)} />
              <InvoiceTotal label="CGST" amount={money(items.reduce((sum, item) => sum + Number(item.cgstAmount || 0), 0))} />
              <InvoiceTotal label="SGST" amount={money(items.reduce((sum, item) => sum + Number(item.sgstAmount || 0), 0))} />
              <InvoiceTotal label="IGST" amount={money(items.reduce((sum, item) => sum + Number(item.igstAmount || 0), 0))} />
              <InvoiceTotal label="Tax total" amount={money(taxTotal)} />
              <InvoiceTotal label="Shipping charges" amount={money(order.shipping)} />
              <InvoiceTotal label="Grand total" amount={money(total)} strong />
              <InvoiceTotal label="Amount paid" amount={money(paidTotal)} />
              <InvoiceTotal label="Outstanding amount" amount={money(Math.max(0, total - paidTotal))} strong />
            </dl>
          </article>
        </div>
        <footer className="mt-6 border-t border-stone-200 pt-3 text-center text-[10px] text-[#657181]">Thank you for your business.</footer>
      </section>

      <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm print:hidden sm:p-7">
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
