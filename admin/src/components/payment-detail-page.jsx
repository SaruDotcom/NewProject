import { useEffect, useState } from "react";
import { ArrowLeft, Download, RefreshCw } from "lucide-react";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { toast } from "sonner";
import { apiGet } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  KpiCard,
  PageHeader,
  SectionCard,
  StatusBadge,
} from "@/components/admin-ui";
import { downloadPaymentReceipt } from "@/components/order-detail-page";

const methodLabels = {
  cod: "COD",
  upi: "UPI",
  card: "Card",
  wallet: "Wallet",
  credit: "Credit",
};
const statusLabels = {
  success: "Success",
  pending: "Pending",
  failed: "Failed",
  refunded: "Refunded",
};
const money = (value) => `₹${Number(value || 0).toLocaleString("en-IN")}`;
const date = (value) => (value ? new Date(value).toLocaleString("en-IN") : "—");

function PartyCard({ title, party }) {
  return (
    <div className="space-y-2 rounded-xl border bg-card p-5">
      <h3 className="border-b pb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      <p className="font-bold text-foreground">
        {party?.businessName || party?.name || "—"}
      </p>
      <p className="text-sm text-muted-foreground">{party?.name || "—"}</p>
      <p className="break-all text-sm text-muted-foreground">
        {party?.email || "—"}
      </p>
      <p className="text-sm text-muted-foreground">
        {party?.phone ? `Phone: ${party.phone}` : "Phone: —"}
      </p>
    </div>
  );
}

export function PaymentDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams({ strict: false });
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [receiptLoading, setReceiptLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    apiGet(`/admin/payments/${encodeURIComponent(id)}`)
      .then((payload) => mounted && setDetails(payload || null))
      .catch((err) => {
        if (mounted) {
          setDetails(null);
          setError(err.message || "Unable to load payment details");
        }
      })
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [id, refreshKey]);

  const downloadReceipt = async () => {
    setReceiptLoading(true);
    try {
      const payload = await apiGet(
        `/admin/payments/${encodeURIComponent(id)}/receipt`,
      );
      downloadPaymentReceipt(payload);
      toast.success("Payment receipt downloaded");
    } catch (err) {
      toast.error(err.message || "Unable to download receipt");
    } finally {
      setReceiptLoading(false);
    }
  };

  if (loading)
    return (
      <div className="rounded-lg border border-dashed bg-card p-8 text-sm text-muted-foreground">
        Loading payment details...
      </div>
    );
  if (error || !details?.payment) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => navigate({ to: "/payments" })}>
          <ArrowLeft /> Back to payments
        </Button>
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/5 p-8 text-sm text-destructive"
        >
          {error || "Payment details were not found."}
        </div>
      </div>
    );
  }

  const payment = details.payment;
  const order = details.order || payment.order || {};
  const items = Array.isArray(order.items) ? order.items : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payment Details"
        description={`Reference: ${payment.transactionRef || payment.id || "—"}`}
        action={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => setRefreshKey((value) => value + 1)}
            >
              <RefreshCw /> Refresh
            </Button>
            <Button onClick={downloadReceipt} disabled={receiptLoading}>
              <Download />{" "}
              {receiptLoading ? "Preparing receipt..." : "Download Receipt"}
            </Button>
            <Button
              variant="ghost"
              onClick={() => navigate({ to: "/payments" })}
            >
              <ArrowLeft /> Back
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Total Amount" value={money(payment.amount)} />
        <KpiCard
          label="Payment Method"
          value={methodLabels[payment.method] || payment.method || "—"}
        />
        <div className="admin-card flex min-h-24 flex-col justify-center gap-2 p-4">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Status
          </span>
          <div>
            <StatusBadge
              status={statusLabels[payment.status] || payment.status}
            />
          </div>
        </div>
        <div className="admin-card flex min-h-24 flex-col justify-center gap-2 p-4">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Payment Timing
          </span>
          <span className="text-sm font-semibold text-foreground">
            {date(payment.createdAt)}
          </span>
        </div>
      </div>

      <SectionCard
        title="Payment and order references"
        description="Identifiers and dates associated with this transaction."
      >
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="text-xs font-semibold uppercase text-muted-foreground">
              Transaction reference
            </dt>
            <dd className="mt-1 break-all font-mono text-sm font-semibold">
              {payment.transactionRef || payment.id || "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase text-muted-foreground">
              Payment ID
            </dt>
            <dd className="mt-1 break-all font-mono text-sm">
              {payment.id || "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase text-muted-foreground">
              Order number
            </dt>
            <dd className="mt-1 text-sm font-semibold">
              {order.orderNo || "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase text-muted-foreground">
              Payment method
            </dt>
            <dd className="mt-1 text-sm">
              {methodLabels[payment.method] || payment.method || "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase text-muted-foreground">
              Payment status
            </dt>
            <dd className="mt-1">
              <StatusBadge
                status={statusLabels[payment.status] || payment.status}
              />
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase text-muted-foreground">
              Created
            </dt>
            <dd className="mt-1 text-sm">{date(payment.createdAt)}</dd>
          </div>
        </dl>
        {order.id && (
          <div className="mt-5 border-t pt-4">
            <Link
              to="/orders/$id"
              params={{ id: String(order.id) }}
              className="text-sm font-semibold text-primary hover:underline"
            >
              View related order
            </Link>
          </div>
        )}
      </SectionCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <PartyCard
          title="Retailer Store"
          party={order.retailer || payment.order?.retailer}
        />
        <PartyCard
          title="Wholesaler Store"
          party={order.wholesaler || payment.order?.wholesaler}
        />
      </div>

      <SectionCard
        title={`Order Breakdown${order.orderNo ? ` · ${order.orderNo}` : ""}`}
        description={`${items.length} product line${items.length === 1 ? "" : "s"} associated with this payment.`}
      >
        {items.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="bg-muted/50 text-xs font-bold uppercase text-muted-foreground">
                <tr>
                  <th className="p-3">Product</th>
                  <th className="p-3">SKU</th>
                  <th className="p-3 text-center">Quantity</th>
                  <th className="p-3 text-right">Price / Unit</th>
                  <th className="p-3 text-right">Line Total</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map((item, index) => (
                  <tr
                    key={`${item.sku || item.productName || "item"}-${index}`}
                  >
                    <td className="p-3 font-semibold">
                      {item.productName || item.product?.name || "Product"}
                    </td>
                    <td className="p-3 font-mono text-xs text-muted-foreground">
                      {item.sku || item.product?.sku || "—"}
                    </td>
                    <td className="p-3 text-center">
                      {item.quantity || 0} {item.unit || "Pcs"}
                    </td>
                    <td className="p-3 text-right">
                      {money(item.pricePerUnit)}
                    </td>
                    <td className="p-3 text-right font-bold">
                      {money(item.totalPrice)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            No order line items are attached to this payment.
          </div>
        )}
        <div className="ml-auto mt-5 grid max-w-sm gap-2 border-t pt-4 text-sm">
          {order.subtotal !== undefined && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{money(order.subtotal)}</span>
            </div>
          )}
          {order.tax !== undefined && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tax</span>
              <span>{money(order.tax)}</span>
            </div>
          )}
          <div className="flex justify-between border-t pt-2 font-bold">
            <span>Payment total</span>
            <span>{money(payment.amount)}</span>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
