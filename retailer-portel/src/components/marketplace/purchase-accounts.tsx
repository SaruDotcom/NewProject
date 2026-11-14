import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  BookOpen,
  CalendarDays,
  CreditCard,
  Download,
  FileText,
  Printer,
  ReceiptText,
  Search,
  Share2,
  Star,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, type ApiOrder, type RetailerReview } from "@/api/api";
import { useStore, getApiOrderItems } from "@/state/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { money } from "./primitives";

type AccountOrder = Omit<ApiOrder, "wholesalerId"> & {
  wholesalerId?: string | Record<string, any>;
  [key: string]: any;
};
type Period = "today" | "week" | "month" | "year" | "custom";
export type PurchaseAccountsTab = "overview" | "history" | "ledger" | "payments" | "feedback";
type CategoryRatings = Required<RetailerReview["categoryRatings"]>;

const tabs: { id: PurchaseAccountsTab; label: string; icon: typeof BookOpen }[] = [
  { id: "overview", label: "Overview", icon: BookOpen },
  { id: "history", label: "Purchase History & Invoices", icon: ReceiptText },
  { id: "ledger", label: "Transactions & Ledger", icon: FileText },
  { id: "payments", label: "Payments", icon: CreditCard },
  { id: "feedback", label: "Feedback & Reviews", icon: Star },
];

const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

function orderId(order: AccountOrder) {
  return String(order._id || order.id || "");
}

function linkedId(value: any) {
  return String(typeof value === "object" && value ? value._id || value.id || "" : value || "");
}

function wholesalerName(order: AccountOrder) {
  const seller = order.wholesalerId && typeof order.wholesalerId === "object" ? order.wholesalerId : null;
  return String(seller?.businessName || seller?.name || "Wholesaler");
}

function wholesalerId(order: AccountOrder) {
  return linkedId(order.wholesalerId);
}

function orderNumber(order: AccountOrder) {
  return String(order.orderNumber || orderId(order));
}

function orderTotal(order: AccountOrder) {
  return Math.max(0, Number(order.grandTotal ?? order.totalAmount ?? 0));
}

function isCancelled(order: AccountOrder) {
  return ["CANCELLED", "RETURNED", "REFUNDED"].includes(String(order.orderStatus || order.status || "").toUpperCase());
}

function paymentOrderId(payment: any) {
  return linkedId(payment.orderId);
}

function paymentAmount(payment: any) {
  return Number.isSafeInteger(payment.amountPaise) ? payment.amountPaise / 100 : Number(payment.amount || 0);
}

function paymentAllocations(payment: any) {
  if (Array.isArray(payment.orderAllocations) && payment.orderAllocations.length) {
    return payment.orderAllocations.map((allocation: any) => ({
      orderId: linkedId(allocation.orderId),
      amount: Number(allocation.amountPaise || 0) / 100,
    }));
  }
  return [{ orderId: paymentOrderId(payment), amount: paymentAmount(payment) }];
}

function orderPaid(order: AccountOrder, payments: any[]) {
  const total = orderTotal(order);
  if (order.isCreditOrder) {
    if (Number.isFinite(Number(order.creditPaidAmount))) return Math.min(total, Number(order.creditPaidAmount || 0));
    return order.creditPaymentStatus === "PAID" ? total : 0;
  }
  if (Number.isSafeInteger(order.directPaidPaise)) {
    return Math.min(total, order.directPaidPaise / 100);
  }
  const fromPayments = payments.reduce((sum, payment) => {
    if (payment.status !== "PAID" || payment.isReversal) return sum;
    return sum + paymentAllocations(payment)
      .filter((allocation: { orderId: string }) => allocation.orderId === orderId(order))
      .reduce((allocated: number, allocation: { amount: number }) => allocated + allocation.amount, 0);
  }, 0);
  if (fromPayments > 0) return Math.min(total, fromPayments);
  return order.paymentStatus === "PAID" ? total : 0;
}

function paymentDue(order: AccountOrder, payments: any[], returns: any[]) {
  const returned = returns
    .filter((entry) => entry.status === "COMPLETED" && linkedId(entry.orderId) === orderId(order))
    .reduce((sum, entry) => sum + Number(entry.totalRefundAmount || 0), 0);
  return Math.max(0, orderTotal(order) - orderPaid(order, payments) - returned);
}

function startOfWeek(date: Date) {
  const result = new Date(date);
  const day = (result.getDay() + 6) % 7;
  result.setDate(result.getDate() - day);
  result.setHours(0, 0, 0, 0);
  return result;
}

function dateBounds(period: Period, from: string, to: string) {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  if (period === "week") start.setTime(startOfWeek(now).getTime());
  if (period === "month") start.setDate(1);
  if (period === "year") {
    start.setMonth(0, 1);
  }
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  if (period === "custom") {
    const customStart = from ? new Date(`${from}T00:00:00`) : null;
    const customEnd = to ? new Date(`${to}T23:59:59.999`) : null;
    return {
      start: customStart && !Number.isNaN(customStart.getTime()) ? customStart : null,
      end: customEnd && !Number.isNaN(customEnd.getTime()) ? customEnd : null,
    };
  }
  return { start, end };
}

function withinRange(value: string | Date | undefined, range: { start: Date | null; end: Date | null }) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return (!range.start || date >= range.start) && (!range.end || date <= range.end);
}

function formatDate(value?: string | Date | null, withTime = false) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return date.toLocaleString("en-IN", withTime
    ? { dateStyle: "medium", timeStyle: "short" }
    : { dateStyle: "medium" });
}

function unwrapRows<T>(response: any, key?: string): T[] {
  const data = response?.data;
  if (Array.isArray(data)) return data as T[];
  if (key && Array.isArray(data?.[key])) return data[key] as T[];
  return [];
}

async function loadAllOrders(): Promise<AccountOrder[]> {
  const first: any = await api.getOrders({ page: 1, limit: 100, sortBy: "createdAt", sortOrder: "desc" });
  const result = getApiOrderItems(first).map((order) => order as AccountOrder);
  const totalPages = Math.max(1, Number(first?.meta?.totalPages || 1));
  for (let page = 2; page <= totalPages; page += 4) {
    const batch = Array.from({ length: Math.min(4, totalPages - page + 1) }, (_, index) => page + index);
    const pages = await Promise.all(batch.map((currentPage) =>
      api.getOrders({ page: currentPage, limit: 100, sortBy: "createdAt", sortOrder: "desc" }) as Promise<any>
    ));
    pages.forEach((response) => result.push(...getApiOrderItems(response).map((order) => order as AccountOrder)));
  }
  return result;
}

async function loadAllPayments(): Promise<any[]> {
  const first: any = await api.getPayments({ page: 1, limit: 100, sortBy: "createdAt", sortOrder: "desc" });
  const result = unwrapRows<any>(first);
  const totalPages = Math.max(1, Number(first?.meta?.totalPages || 1));
  for (let page = 2; page <= totalPages; page += 4) {
    const batch = Array.from({ length: Math.min(4, totalPages - page + 1) }, (_, index) => page + index);
    const pages = await Promise.all(batch.map((currentPage) =>
      api.getPayments({ page: currentPage, limit: 100, sortBy: "createdAt", sortOrder: "desc" }) as Promise<any>
    ));
    pages.forEach((response) => result.push(...unwrapRows<any>(response)));
  }
  return result;
}

function statusStyle(status: string) {
  const value = String(status || "").toUpperCase();
  if (["DELIVERED", "PAID", "APPROVED", "COMPLETED", "VERIFIED"].includes(value)) return "bg-emerald-100 text-emerald-800";
  if (["CANCELLED", "REJECTED", "REFUNDED", "FAILED"].includes(value)) return "bg-rose-100 text-rose-800";
  return "bg-amber-100 text-amber-800";
}

function amountForReview(review: RetailerReview | undefined, key: keyof CategoryRatings) {
  return Number(review?.categoryRatings?.[key] || 5);
}

function downloadLedgerStatement(name: string, events: any[]) {
  const rows = [
    ["Date", "Transaction", "Invoice / ID", "Debit", "Credit", "Running Balance"],
    ...events.map((event) => [
      formatDate(event.date),
      event.type,
      event.reference || "",
      Number(event.debit || 0).toFixed(2),
      Number(event.credit || 0).toFixed(2),
      Number(event.balance || 0).toFixed(2),
    ]),
  ];
  const csv = rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase()}-ledger.csv`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function PurchaseAccountsPage({ initialTab = "overview" }: { initialTab?: PurchaseAccountsTab }) {
  const { currentUser } = useStore();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<PurchaseAccountsTab>(initialTab);
  const [period, setPeriod] = useState<Period>("month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [search, setSearch] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [selectedPaymentOrderId, setSelectedPaymentOrderId] = useState("");
  const [paymentWholesalerId, setPaymentWholesalerId] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(today());
  const [paymentMode, setPaymentMode] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentDetails, setPaymentDetails] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [paymentProof, setPaymentProof] = useState<File | null>(null);
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [proofReportId, setProofReportId] = useState("");
  const [reviewOrderId, setReviewOrderId] = useState("");
  const [reviewTitle, setReviewTitle] = useState("");
  const [reviewComment, setReviewComment] = useState("");
  const [reviewRating, setReviewRating] = useState(5);
  const [categoryRatings, setCategoryRatings] = useState<CategoryRatings>({
    productQuality: 5,
    packaging: 5,
    delivery: 5,
    communication: 5,
  });
  const [submittingReview, setSubmittingReview] = useState(false);

  const ordersQuery = useQuery({
    queryKey: ["retailer-purchase-accounts-orders", currentUser?.id],
    queryFn: loadAllOrders,
    enabled: Boolean(currentUser?.id),
    staleTime: 15000,
  });
  const paymentsQuery = useQuery({
    queryKey: ["retailer-purchase-accounts-payments", currentUser?.id],
    queryFn: loadAllPayments,
    enabled: Boolean(currentUser?.id),
    staleTime: 15000,
  });
  const returnsQuery = useQuery({
    queryKey: ["retailer-purchase-accounts-returns", currentUser?.id],
    queryFn: async () => unwrapRows<any>(await api.getReturns({ limit: 100 })),
    enabled: Boolean(currentUser?.id),
    staleTime: 15000,
  });
  const reportsQuery = useQuery({
    queryKey: ["retailer-purchase-accounts-payment-reports", currentUser?.id],
    queryFn: async () => unwrapRows<any>(await api.getRetailerPaymentReports()),
    enabled: Boolean(currentUser?.id),
    staleTime: 10000,
    refetchInterval: 30000,
  });
  const reviewsQuery = useQuery({
    queryKey: ["retailer-purchase-accounts-reviews", currentUser?.id],
    queryFn: async () => unwrapRows<RetailerReview>(await api.getSubmittedReviews()),
    enabled: Boolean(currentUser?.id),
  });
  const invoiceQuery = useQuery({
    queryKey: ["retailer-purchase-account-invoice", currentUser?.id, selectedOrderId],
    queryFn: async () => (await api.getOrderById(encodeURIComponent(selectedOrderId))).data,
    enabled: Boolean(currentUser?.id && selectedOrderId),
  });
  const paymentOptionsQuery = useQuery({
    queryKey: ["retailer-purchase-account-payment-options", paymentWholesalerId],
    queryFn: async () => (await api.getRetailerPaymentOptions(paymentWholesalerId)).data,
    enabled: Boolean(paymentWholesalerId),
  });

  const orders = ordersQuery.data || [];
  const payments = paymentsQuery.data || [];
  const returns = returnsQuery.data || [];
  const reports = reportsQuery.data || [];
  const reviews = reviewsQuery.data || [];
  const bounds = dateBounds(period, customFrom, customTo);
  const reviewOrder = orders.find((order) => orderId(order) === reviewOrderId);
  const existingReview = reviews.find((review) => review.orderId === reviewOrderId);
  const availableMethods = paymentOptionsQuery.data?.paymentMethods || [];

  const nonCancelledOrders = useMemo(() => orders.filter((order) => !isCancelled(order)), [orders]);
  const dateFilteredOrders = useMemo(
    () => nonCancelledOrders.filter((order) => withinRange(order.createdAt, bounds)),
    [nonCancelledOrders, bounds.start?.getTime(), bounds.end?.getTime()],
  );
  const outstandingOrders = useMemo(
    () => nonCancelledOrders.filter((order) => paymentDue(order, payments, returns) > 0),
    [nonCancelledOrders, payments, returns],
  );
  const payableWholesalers = useMemo(() => {
    const byId = new Map<string, { id: string; name: string }>();
    outstandingOrders.forEach((order) => {
      const id = wholesalerId(order);
      if (id && !byId.has(id)) byId.set(id, { id, name: wholesalerName(order) });
    });
    return [...byId.values()];
  }, [outstandingOrders]);

  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (!paymentWholesalerId && payableWholesalers.length) setPaymentWholesalerId(payableWholesalers[0].id);
  }, [payableWholesalers, paymentWholesalerId]);

  const payableOrders = useMemo(
    () => outstandingOrders.filter((order) => wholesalerId(order) === paymentWholesalerId),
    [outstandingOrders, paymentWholesalerId],
  );

  useEffect(() => {
    if (!payableOrders.some((order) => orderId(order) === selectedPaymentOrderId)) {
      setSelectedPaymentOrderId(orderId(payableOrders[0] || ({} as AccountOrder)));
    }
  }, [payableOrders, selectedPaymentOrderId]);

  const selectedPaymentOrder = payableOrders.find((order) => orderId(order) === selectedPaymentOrderId);
  const selectedDue = selectedPaymentOrder ? paymentDue(selectedPaymentOrder, payments, returns) : 0;
  const pendingForSelectedOrder = selectedPaymentOrder
    ? payments
      .filter((payment) => payment.isReport && ["PENDING", "PROCESSING"].includes(String(payment.status || "").toUpperCase()))
      .filter((payment) => paymentOrderId(payment) === selectedPaymentOrderId
        || (payment.creditOrderSpecific && (payment.relatedOrderIds || []).some((id: any) => linkedId(id) === selectedPaymentOrderId)))
      .reduce((sum, payment) => sum + paymentAmount(payment), 0)
    : 0;
  const submitableBalance = Math.max(0, selectedDue - pendingForSelectedOrder);

  useEffect(() => {
    if (selectedPaymentOrder) {
      setPaymentAmount(submitableBalance ? submitableBalance.toFixed(2) : "");
      setPaymentMode(availableMethods[0] || "");
    } else {
      setPaymentAmount("");
      setPaymentMode("");
    }
  }, [selectedPaymentOrderId, submitableBalance, availableMethods.join("|")]);

  useEffect(() => {
    if (!reviewOrderId) {
      const next = orders.find((order) => String(order.orderStatus || "").toUpperCase() === "DELIVERED");
      if (next) setReviewOrderId(orderId(next));
    }
  }, [orders, reviewOrderId]);

  useEffect(() => {
    setReviewTitle(existingReview?.title || "");
    setReviewComment(existingReview?.comment || "");
    setReviewRating(existingReview?.rating || 5);
    setCategoryRatings({
      productQuality: amountForReview(existingReview, "productQuality"),
      packaging: amountForReview(existingReview, "packaging"),
      delivery: amountForReview(existingReview, "delivery"),
      communication: amountForReview(existingReview, "communication"),
    });
  }, [existingReview?.id, reviewOrderId]);

  const totalForPeriod = (selectedPeriod: Period) => {
    const range = dateBounds(selectedPeriod, "", "");
    return nonCancelledOrders
      .filter((order) => withinRange(order.createdAt, range))
      .reduce((sum, order) => sum + orderTotal(order), 0);
  };
  const todayPurchaseTotal = totalForPeriod("today");
  const monthPurchaseTotal = totalForPeriod("month");
  const yearPurchaseTotal = totalForPeriod("year");
  const paidTotal = dateFilteredOrders.reduce((sum, order) => sum + orderPaid(order, payments), 0);
  const outstandingTotal = dateFilteredOrders.reduce((sum, order) => sum + paymentDue(order, payments, returns), 0);
  const returnTotal = returns
    .filter((entry) => entry.status === "COMPLETED")
    .filter((entry) => {
      const entryOrder = orders.find((order) => orderId(order) === linkedId(entry.orderId));
      return entryOrder && withinRange(entryOrder.createdAt, bounds);
    })
    .reduce((sum, entry) => sum + Number(entry.totalRefundAmount || 0), 0);
  const pendingTotal = payments
    .filter((payment) => payment.isReport)
    .filter((report) => ["PENDING", "PROCESSING"].includes(String(report.status || "").toUpperCase()))
    .reduce((sum, report) => sum + paymentAmount(report), 0);
  const rejectedTotal = payments
    .filter((payment) => payment.isReport)
    .filter((report) => ["REJECTED", "FAILED"].includes(String(report.status || "").toUpperCase()))
    .reduce((sum, report) => sum + paymentAmount(report), 0);
  const advanceTotal = payments
    .filter((payment) => payment.isAdvance === true && payment.status === "PAID")
    .reduce((sum, payment) => sum + paymentAmount(payment), 0);

  const filteredOrders = orders.filter((order) => {
    if (!search.trim()) return true;
    const query = search.toLowerCase();
    return orderNumber(order).toLowerCase().includes(query)
      || wholesalerName(order).toLowerCase().includes(query)
      || String(order.shippingDetails?.biltyNumber || "").toLowerCase().includes(query)
      || (order.items || []).some((item: any) => String(item.name || "").toLowerCase().includes(query));
  });

  const ledgerGroups = useMemo(() => {
    const byWholesaler = new Map<string, { id: string; name: string; events: any[]; purchases: number; payments: number; returns: number; due: number; nextDue: string | null }>();
    const groupFor = (id: string, name: string) => {
      if (!byWholesaler.has(id)) byWholesaler.set(id, { id, name, events: [], purchases: 0, payments: 0, returns: 0, due: 0, nextDue: null });
      return byWholesaler.get(id)!;
    };
    nonCancelledOrders.forEach((order) => {
      const id = wholesalerId(order);
      if (!id) return;
      const group = groupFor(id, wholesalerName(order));
      const total = orderTotal(order);
      group.purchases += total;
      group.due += paymentDue(order, payments, returns);
      group.events.push({
        date: order.createdAt,
        type: "Purchase invoice",
        reference: orderNumber(order),
        debit: total,
        credit: 0,
      });
      const dueDate = order.creditDueDate;
      if (paymentDue(order, payments, returns) > 0 && dueDate && (!group.nextDue || new Date(dueDate) < new Date(group.nextDue))) {
        group.nextDue = dueDate;
      }
    });
    payments.forEach((payment) => {
      if (payment.status !== "PAID") return;
      const allocations = paymentAllocations(payment);
      allocations.forEach((allocation: { orderId: string; amount: number }) => {
        const order = orders.find((item) => orderId(item) === allocation.orderId);
        const id = order ? wholesalerId(order) : linkedId(payment.wholesalerId);
        if (!id) return;
        const group = groupFor(id, order ? wholesalerName(order) : String(payment.wholesalerId?.businessName || payment.wholesalerId?.name || "Wholesaler"));
        const reversed = Boolean(payment.isReversal);
        const amount = allocation.amount || paymentAmount(payment);
        if (reversed) {
          group.events.push({ date: payment.paidAt || payment.createdAt, type: "Payment reversal", reference: payment.transactionReference || payment._id, debit: amount, credit: 0 });
          group.due += amount;
        } else {
          group.events.push({ date: payment.paidAt || payment.reportedPaymentDate || payment.createdAt, type: payment.isCreditRepayment ? "Credit repayment" : "Payment received", reference: payment.transactionReference || payment._id, debit: 0, credit: amount });
          group.payments += amount;
        }
      });
    });
    returns.filter((entry) => entry.status === "COMPLETED").forEach((entry) => {
      const order = orders.find((item) => orderId(item) === linkedId(entry.orderId));
      if (!order) return;
      const group = groupFor(wholesalerId(order), wholesalerName(order));
      const amount = Number(entry.totalRefundAmount || 0);
      group.events.push({ date: entry.resolvedAt || entry.updatedAt || entry.createdAt, type: "Purchase return / adjustment", reference: entry.returnNumber || entry._id, debit: 0, credit: amount });
      group.returns += amount;
      group.due = Math.max(0, group.due - amount);
    });
    return [...byWholesaler.values()].map((group) => {
      group.events.sort((a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime());
      let balance = 0;
      group.events = group.events.map((event) => {
        balance += Number(event.debit || 0) - Number(event.credit || 0);
        return { ...event, balance };
      });
      return group;
    });
  }, [nonCancelledOrders, payments, returns, orders]);

  const selectedInvoice = invoiceQuery.data?.order as AccountOrder | undefined;
  const invoice = invoiceQuery.data?.invoice;
  const invoiceReports = reports.filter((report) => {
    if (!selectedOrderId) return false;
    return paymentOrderId(report) === selectedOrderId
      || (report.orderAllocations || []).some((allocation: any) => linkedId(allocation.orderId) === selectedOrderId)
      || (report.relatedOrderIds || []).some((id: any) => linkedId(id) === selectedOrderId);
  });

  const submitPayment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const amount = Number(paymentAmount);
    if (!selectedPaymentOrder || !Number.isFinite(amount) || amount <= 0 || amount > submitableBalance) {
      toast.error(`Enter a payment between ₹0.01 and ${money(submitableBalance)}.`);
      return;
    }
    if (!availableMethods.includes(paymentMode)) {
      toast.error("Choose a payment method enabled by this wholesaler.");
      return;
    }
    if (paymentReference.trim().length < 4) {
      toast.error("Enter a UTR or transaction reference with at least 4 characters.");
      return;
    }
    setSubmittingPayment(true);
    try {
      await api.createPaymentReport({
        orderId: orderId(selectedPaymentOrder),
        amount: amount.toFixed(2),
        transactionReference: paymentReference.trim(),
        paymentMethod: paymentMode,
        paymentDetails: paymentDetails.trim(),
        paymentDate,
        notes: paymentNotes.trim(),
        type: selectedPaymentOrder.isCreditOrder ? "CREDIT_REPAYMENT" : undefined,
        screenshot: paymentProof || undefined,
      });
      setPaymentReference("");
      setPaymentDetails("");
      setPaymentNotes("");
      setPaymentProof(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["retailer-purchase-accounts-payments", currentUser?.id] }),
        queryClient.invalidateQueries({ queryKey: ["retailer-purchase-accounts-payment-reports", currentUser?.id] }),
      ]);
      toast.success("Payment submitted for wholesaler verification. Your balance changes after approval.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to submit payment.");
    } finally {
      setSubmittingPayment(false);
    }
  };

  const submitReview = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!reviewOrder || !reviewComment.trim()) return;
    setSubmittingReview(true);
    try {
      const payload = {
        title: reviewTitle.trim(),
        comment: reviewComment.trim(),
        rating: reviewRating,
        categoryRatings,
      };
      if (existingReview) {
        await api.updatePartnerReview(existingReview.id, payload);
      } else {
        await api.submitPartnerReview({
          ...payload,
          orderId: orderId(reviewOrder),
          recipientId: wholesalerId(reviewOrder),
        });
      }
      await queryClient.invalidateQueries({ queryKey: ["retailer-purchase-accounts-reviews", currentUser?.id] });
      toast.success(existingReview ? "Review updated." : "Review submitted.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to submit review.");
    } finally {
      setSubmittingReview(false);
    }
  };

  const downloadInvoice = async () => {
    if (!selectedInvoice || !invoice?.available) return;
    try {
      const blob = await api.downloadOrderInvoice(orderId(selectedInvoice));
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${invoice.number || `INV-${orderNumber(selectedInvoice)}`}.pdf`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to download this invoice.");
    }
  };

  const shareInvoice = async () => {
    if (!selectedInvoice) return;
    const url = new URL(`/orders/${encodeURIComponent(orderId(selectedInvoice))}`, window.location.origin).toString();
    try {
      if (navigator.share) {
        await navigator.share({ title: `Invoice ${invoice?.number || orderNumber(selectedInvoice)}`, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Invoice link copied.");
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      toast.error(error instanceof Error ? error.message : "Unable to share this invoice.");
    }
  };

  const openPaymentProof = async (reportId: string) => {
    setProofReportId(reportId);
    try {
      const blob = await api.getPaymentReportScreenshot(reportId);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to open payment proof.");
    } finally {
      setProofReportId("");
    }
  };

  const printInvoice = () => {
    window.print();
  };

  const loading = ordersQuery.isLoading || paymentsQuery.isLoading || returnsQuery.isLoading;
  const dataError = ordersQuery.error || paymentsQuery.error || returnsQuery.error;

  return (
    <main className="shell py-8 sm:py-10">
      <header className="rounded-3xl border border-primary/10 bg-gradient-to-br from-card via-card to-primary/[0.07] p-5 shadow-sm sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Retailer workspace</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">Purchase &amp; Accounts</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Your actual orders, invoice status, payments, and separate wholesaler balances.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-xl border bg-background px-3 py-2 text-xs font-semibold text-muted-foreground">
            <CalendarDays className="size-4 text-primary" />
            {period === "custom" ? "Custom date range" : `Showing ${period === "today" ? "today" : `this ${period}`}`}
          </div>
        </div>
      </header>

      <nav className="mt-5 flex gap-2 overflow-x-auto border-b pb-2" aria-label="Purchase and accounts pages">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            aria-current={activeTab === id ? "page" : undefined}
            className={`flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-3.5 text-sm font-bold transition-colors ${
              activeTab === id ? "bg-primary text-primary-foreground" : "border bg-card text-ink hover:bg-accent"
            }`}
          >
            <Icon className="size-4" />
            {label}
          </button>
        ))}
      </nav>

      {activeTab !== "payments" && activeTab !== "feedback" && (
        <section className="mt-5 flex flex-wrap items-end gap-3 rounded-2xl border bg-card p-4">
          <label className="grid gap-1 text-xs font-bold text-ink">
            Purchase period
            <select value={period} onChange={(event) => setPeriod(event.target.value as Period)} className="h-10 min-w-44 rounded-lg border bg-background px-3 text-sm">
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="year">This Year</option>
              <option value="custom">Custom Date Range</option>
            </select>
          </label>
          {period === "custom" && (
            <>
              <label className="grid gap-1 text-xs font-bold text-ink">From<Input type="date" value={customFrom} onChange={(event) => setCustomFrom(event.target.value)} /></label>
              <label className="grid gap-1 text-xs font-bold text-ink">To<Input type="date" value={customTo} onChange={(event) => setCustomTo(event.target.value)} /></label>
            </>
          )}
        </section>
      )}

      {loading ? (
        <div className="mt-6 rounded-2xl border bg-card p-10 text-center text-sm text-muted-foreground" role="status">Loading your purchase and payment records…</div>
      ) : dataError ? (
        <div className="mt-6 rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive" role="alert">
          {dataError instanceof Error ? dataError.message : "Unable to load your account records."}
        </div>
      ) : (
        <>
          {activeTab === "overview" && (
            <section className="mt-6 space-y-5">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                {[
                  ["Today's Total Purchase", todayPurchaseTotal, "Actual orders excluding cancellations"],
                  ["Monthly Total Purchase", monthPurchaseTotal, "Actual orders excluding cancellations"],
                  ["Yearly Total Purchase", yearPurchaseTotal, "Actual orders excluding cancellations"],
                  ["Total Paid Amount", paidTotal, "Recorded for purchases in the selected period"],
                  ["Total Outstanding (Udhaar)", outstandingTotal, "After approved payments and completed returns"],
                  ["Total Advance Payment", advanceTotal, advanceTotal ? "Recorded advance transactions" : "No advance records available"],
                  ["Purchase Returns", returnTotal, "Completed return adjustments in the selected period"],
                ].map(([label, amount, hint]) => (
                  <article key={String(label)} className="rounded-2xl border bg-card p-5 shadow-sm">
                    <p className="text-xs font-semibold text-muted-foreground">{label}</p>
                    <p className="mt-2 text-2xl font-black text-ink">{money(Number(amount))}</p>
                    <p className="mt-2 text-[11px] leading-4 text-muted-foreground">{hint}</p>
                  </article>
                ))}
              </div>
              <section className="rounded-2xl border bg-card p-5 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-extrabold text-ink">Recent purchases</h2>
                    <p className="mt-1 text-sm text-muted-foreground">{dateFilteredOrders.length} actual non-cancelled order(s) in this period.</p>
                  </div>
                  <Button variant="outline" onClick={() => setActiveTab("history")}>Purchase History</Button>
                </div>
                <div className="mt-4 divide-y">
                  {dateFilteredOrders.slice(0, 6).map((order) => (
                    <article key={orderId(order)} className="flex flex-wrap items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <p className="font-bold text-ink">{orderNumber(order)} · {wholesalerName(order)}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{formatDate(order.createdAt)} · {order.items?.length || 0} product(s)</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold ${statusStyle(order.orderStatus || order.status)}`}>{String(order.orderStatus || order.status || "PENDING").replace(/_/g, " ")}</span>
                        <strong className="text-sm text-ink">{money(orderTotal(order))}</strong>
                      </div>
                    </article>
                  ))}
                  {!dateFilteredOrders.length && <p className="py-8 text-center text-sm text-muted-foreground">No purchases in this period.</p>}
                </div>
              </section>
            </section>
          )}

          {activeTab === "history" && (
            <section className="mt-6 rounded-2xl border bg-card p-4 sm:p-6">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-xl font-extrabold text-ink">Purchase History &amp; Invoices</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Cancelled orders remain visible as order history but are excluded from purchase totals.</p>
                </div>
                <label className="relative w-full sm:max-w-sm">
                  <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search invoice, wholesaler, bilty or product" className="pl-9" />
                </label>
              </div>
              <div className="mt-5 space-y-3 md:hidden">
                {filteredOrders.map((order) => (
                  <article key={orderId(order)} className="rounded-xl border p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div><p className="font-bold text-ink">{orderNumber(order)}</p><p className="mt-1 text-xs text-muted-foreground">{wholesalerName(order)} · {formatDate(order.createdAt)}</p></div>
                      <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${statusStyle(order.orderStatus || order.status)}`}>{String(order.orderStatus || order.status || "PENDING").replace(/_/g, " ")}</span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <p><span className="text-muted-foreground">Products:</span> {order.items?.length || 0}</p>
                      <p><span className="text-muted-foreground">Qty:</span> {(order.items || []).reduce((sum: number, item: any) => sum + Number(item.quantity || 0), 0)}</p>
                      <p><span className="text-muted-foreground">Bilty:</span> {order.shippingDetails?.biltyNumber || "Not provided"}</p>
                      <p><span className="text-muted-foreground">Paid:</span> {money(orderPaid(order, payments))}</p>
                      <p className="font-bold text-ink"><span className="text-muted-foreground">Total:</span> {money(orderTotal(order))}</p>
                      <p className="font-bold text-amber-700"><span className="text-muted-foreground">Baaki:</span> {money(paymentDue(order, payments, returns))}</p>
                    </div>
                    <Button className="mt-3 w-full" variant="outline" onClick={() => setSelectedOrderId(orderId(order))}>View Invoice / Status</Button>
                  </article>
                ))}
              </div>
              <div className="mt-5 hidden overflow-x-auto md:block">
                <table className="w-full min-w-[1180px] text-left text-xs">
                  <thead className="text-[10px] uppercase tracking-wide text-muted-foreground"><tr className="border-b">
                    <th className="pb-3 pr-3">Invoice / Order</th><th className="pb-3 pr-3">Bilty / LR</th><th className="pb-3 pr-3">Wholesaler</th><th className="pb-3 pr-3">Purchase date</th><th className="pb-3 pr-3">Products / Qty</th><th className="pb-3 pr-3 text-right">Subtotal</th><th className="pb-3 pr-3 text-right">GST</th><th className="pb-3 pr-3 text-right">Transport</th><th className="pb-3 pr-3 text-right">Discount</th><th className="pb-3 pr-3 text-right">Total / Paid / Due</th><th className="pb-3 pr-3">Status</th><th className="pb-3 text-right">Invoice</th>
                  </tr></thead>
                  <tbody className="divide-y">
                    {filteredOrders.map((order) => (
                      <tr key={orderId(order)}>
                        <td className="py-3 pr-3 font-bold">{orderNumber(order)}</td><td className="py-3 pr-3">{order.shippingDetails?.biltyNumber || "Not provided"}</td><td className="py-3 pr-3 font-semibold">{wholesalerName(order)}</td><td className="whitespace-nowrap py-3 pr-3">{formatDate(order.createdAt)}</td>
                        <td className="py-3 pr-3">{order.items?.length || 0} / {(order.items || []).reduce((sum: number, item: any) => sum + Number(item.quantity || 0), 0)}</td><td className="py-3 pr-3 text-right">{money(Number(order.subtotal || 0))}</td><td className="py-3 pr-3 text-right">{money(Number(order.tax || 0))}</td><td className="py-3 pr-3 text-right">{money(Number(order.shipping || 0))}</td><td className="py-3 pr-3 text-right">{money(Number(order.discount || 0))}</td>
                        <td className="py-3 pr-3 text-right"><strong>{money(orderTotal(order))}</strong><br /><span className="text-emerald-700">{money(orderPaid(order, payments))}</span> / <span className="text-amber-700">{money(paymentDue(order, payments, returns))}</span></td><td className="py-3 pr-3"><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${statusStyle(order.orderStatus || order.status)}`}>{String(order.orderStatus || order.status || "PENDING").replace(/_/g, " ")}</span></td><td className="py-3 text-right"><Button size="sm" variant="outline" onClick={() => setSelectedOrderId(orderId(order))}>View Invoice</Button></td>
                      </tr>
                    ))}
                    {!filteredOrders.length && <tr><td colSpan={12} className="py-12 text-center text-muted-foreground">No purchases match this search.</td></tr>}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {activeTab === "ledger" && (
            <section className="mt-6 space-y-4">
              <div className="rounded-2xl border bg-card p-5">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div><h2 className="text-xl font-extrabold text-ink">Transactions &amp; Ledger</h2><p className="mt-1 text-sm text-muted-foreground">Each wholesaler has an independent running balance built from orders, approved payments, and completed returns.</p></div>
                  <label className="relative w-full sm:max-w-sm"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search wholesaler" className="pl-9" /></label>
                </div>
                {!ledgerGroups.length && <p className="py-10 text-center text-sm text-muted-foreground">No wholesaler transactions recorded.</p>}
                {ledgerGroups.filter((group) => group.name.toLowerCase().includes(search.toLowerCase())).map((group) => {
                  const visibleEvents = group.events.filter((event) => withinRange(event.date, bounds));
                  return (
                  <details key={group.id} className="mt-4 rounded-xl border bg-background" open={ledgerGroups.length === 1}>
                    <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-3 p-4">
                      <div><p className="font-extrabold text-ink">{group.name}</p><p className="mt-1 text-[11px] text-muted-foreground">Opening balance: Not recorded · Next due: {formatDate(group.nextDue)}</p></div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-right text-xs sm:grid-cols-4">
                        <span>Purchases <b className="block text-ink">{money(group.purchases)}</b></span><span>Payments <b className="block text-emerald-700">{money(group.payments)}</b></span><span>Returns <b className="block text-emerald-700">{money(group.returns)}</b></span><span>Baaki <b className="block text-amber-700">{money(group.due)}</b></span>
                      </div>
                      <Button type="button" size="sm" variant="outline" onClick={(event) => { event.preventDefault(); event.stopPropagation(); downloadLedgerStatement(group.name, visibleEvents); }}><Download className="mr-2 size-3.5" />Download statement</Button>
                    </summary>
                    <div className="overflow-x-auto border-t">
                      <table className="w-full min-w-[720px] text-left text-xs">
                        <thead className="text-[10px] uppercase text-muted-foreground"><tr><th className="p-3">Date</th><th className="p-3">Transaction</th><th className="p-3">Invoice / ID</th><th className="p-3 text-right">Debit</th><th className="p-3 text-right">Credit (Jama)</th><th className="p-3 text-right">Running Balance</th></tr></thead>
                        <tbody className="divide-y">
                          {visibleEvents.map((entry, index) => (
                            <tr key={`${entry.reference}-${index}`}>
                              <td className="whitespace-nowrap p-3">{formatDate(entry.date)}</td>
                              <td className="p-3 font-semibold">{entry.type}</td>
                              <td className="p-3 font-mono">{entry.reference || "Not recorded"}</td>
                              <td className="p-3 text-right">{entry.debit ? money(entry.debit) : "—"}</td>
                              <td className="p-3 text-right">{entry.credit ? money(entry.credit) : "—"}</td>
                              <td className="p-3 text-right font-extrabold">{money(entry.balance)}</td>
                            </tr>
                          ))}
                          {!visibleEvents.length && (
                            <tr>
                              <td colSpan={6} className="py-8 text-center text-muted-foreground">No ledger entries in this date range.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </details>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">No opening balance or advance is inferred when no such transaction is recorded.</p>
            </section>
          )}

          {activeTab === "payments" && (
            <section className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
              <form onSubmit={submitPayment} className="h-fit space-y-4 rounded-2xl border bg-card p-5 shadow-sm">
                <div><p className="text-xs font-bold uppercase tracking-wider text-primary">Payment request</p><h2 className="mt-1 text-xl font-extrabold text-ink">Make a Payment</h2><p className="mt-1 text-sm text-muted-foreground">Payments remain pending until the wholesaler verifies them.</p></div>
                <label className="block space-y-1.5 text-sm font-semibold">Wholesaler<select value={paymentWholesalerId} onChange={(event) => { setPaymentWholesalerId(event.target.value); setSelectedPaymentOrderId(""); }} className="h-11 w-full rounded-lg border bg-background px-3">{payableWholesalers.map((seller) => <option key={seller.id} value={seller.id}>{seller.name}</option>)}</select></label>
                <label className="block space-y-1.5 text-sm font-semibold">Invoice / outstanding order<select value={selectedPaymentOrderId} onChange={(event) => setSelectedPaymentOrderId(event.target.value)} required disabled={!payableOrders.length} className="h-11 w-full rounded-lg border bg-background px-3">{payableOrders.length ? payableOrders.map((order) => <option key={orderId(order)} value={orderId(order)}>{orderNumber(order)} · Due {money(paymentDue(order, payments, returns))}</option>) : <option value="">No outstanding invoices</option>}</select></label>
                <div className="rounded-xl bg-secondary/50 p-3 text-sm"><span className="text-muted-foreground">Outstanding amount</span><strong className="float-right text-amber-800">{money(selectedDue)}</strong></div>
                <label className="block space-y-1.5 text-sm font-semibold">Payment amount<Input type="number" min="0.01" step="0.01" max={submitableBalance} value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} required /></label>
                {pendingForSelectedOrder > 0 && <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900">{money(pendingForSelectedOrder)} is already awaiting verification for this invoice.</p>}
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block space-y-1.5 text-sm font-semibold">Payment date<Input type="date" value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} required /></label>
                  <label className="block space-y-1.5 text-sm font-semibold">Payment mode<select value={paymentMode} onChange={(event) => setPaymentMode(event.target.value)} required disabled={!availableMethods.length} className="h-10 w-full rounded-md border bg-background px-3 text-sm">{availableMethods.map((method: string) => <option key={method} value={method}>{method.replace(/_/g, " ")}</option>)}</select></label>
                </div>
                {paymentOptionsQuery.isError && <p role="alert" className="text-xs text-destructive">{paymentOptionsQuery.error instanceof Error ? paymentOptionsQuery.error.message : "Unable to load enabled payment methods."}</p>}
                {!paymentOptionsQuery.isLoading && !availableMethods.length && <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900">No payment methods are currently enabled by this wholesaler.</p>}
                <label className="block space-y-1.5 text-sm font-semibold">UTR / transaction reference<Input value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} minLength={4} maxLength={100} required /></label>
                {["CASH_DEPOSIT", "CHEQUE"].includes(paymentMode) && <label className="block space-y-1.5 text-sm font-semibold">Deposit / cheque details<Input value={paymentDetails} onChange={(event) => setPaymentDetails(event.target.value)} maxLength={500} required /></label>}
                <label className="block space-y-1.5 text-sm font-semibold">Payment proof (optional)<Input type="file" accept=".jpg,.jpeg,.png,.webp,.pdf" onChange={(event) => setPaymentProof(event.target.files?.[0] || null)} /></label>
                <label className="block space-y-1.5 text-sm font-semibold">Notes (optional)<textarea value={paymentNotes} onChange={(event) => setPaymentNotes(event.target.value)} maxLength={500} rows={2} className="w-full rounded-lg border bg-background p-3 text-sm" /></label>
                <Button type="submit" className="w-full" disabled={submittingPayment || !selectedPaymentOrder || !availableMethods.length}>{submittingPayment ? "Submitting…" : "Submit for Verification"}</Button>
              </form>

              <section className="rounded-2xl border bg-card p-5 shadow-sm">
                <div><p className="text-xs font-bold uppercase tracking-wider text-primary">Payment status</p><h2 className="mt-1 text-xl font-extrabold text-ink">Payment History</h2></div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  {[["Paid", payments.filter((payment) => payment.status === "PAID" && !payment.isReversal).reduce((sum, payment) => sum + paymentAmount(payment), 0)], ["Pending", pendingTotal], ["Rejected", rejectedTotal], ["Advance", advanceTotal]].map(([label, amount]) => <div key={String(label)} className="rounded-xl border p-3"><span className="text-xs text-muted-foreground">{label}</span><b className="mt-1 block text-lg text-ink">{money(Number(amount))}</b></div>)}
                </div>
                <div className="mt-5 space-y-3">
                  {payments.filter((payment) => payment.isReport).map((payment) => (
                    (() => {
                      const report = reports.find((item) => String(item._id) === String(payment._id));
                      return (
                    <article key={payment._id} className="rounded-xl border p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div><p className="font-bold text-ink">{money(paymentAmount(payment))} · {String(payment.paymentMethod || "UPI").replace(/_/g, " ")}</p><p className="mt-1 break-all text-xs text-muted-foreground">Ref {payment.transactionReference || "Not recorded"} · Order {payment.orderId?.orderNumber || paymentOrderId(payment)}</p><p className="mt-1 text-xs text-muted-foreground">{formatDate(payment.reportedPaymentDate || payment.createdAt, true)}{payment.notes ? ` · ${payment.notes}` : ""}</p>{payment.reviewNote && <p className="mt-2 text-xs text-rose-700">Wholesaler note: {payment.reviewNote}</p>}</div>
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold ${statusStyle(payment.status)}`}>{payment.status === "PAID" ? "APPROVED" : String(payment.status || "PENDING").replace(/_/g, " ")}</span>
                      </div>
                      {(report?.screenshotAvailable || payment.screenshotAvailable) && <button type="button" onClick={() => void openPaymentProof(String(payment._id))} disabled={proofReportId === String(payment._id)} className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-primary underline">{proofReportId === String(payment._id) ? "Opening proof…" : "View payment proof"}</button>}
                    </article>
                      );
                    })()
                  ))}
                  {reportsQuery.isError && <p role="alert" className="text-sm text-destructive">{reportsQuery.error instanceof Error ? reportsQuery.error.message : "Unable to load payment reports."}</p>}
                  {!payments.some((payment) => payment.isReport) && <p className="py-8 text-center text-sm text-muted-foreground">No submitted payment reports yet.</p>}
                </div>
              </section>
            </section>
          )}

          {activeTab === "feedback" && (
            <section className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
              <form onSubmit={submitReview} className="h-fit space-y-4 rounded-2xl border bg-card p-5 shadow-sm">
                <div><p className="text-xs font-bold uppercase tracking-wider text-primary">Verified purchase feedback</p><h2 className="mt-1 text-xl font-extrabold text-ink">{existingReview ? "Edit your review" : "Review a wholesaler"}</h2><p className="mt-1 text-sm text-muted-foreground">Only delivered orders can be reviewed, once per order.</p></div>
                <label className="block space-y-1.5 text-sm font-semibold">Delivered order<select value={reviewOrderId} onChange={(event) => setReviewOrderId(event.target.value)} required disabled={!orders.some((order) => String(order.orderStatus || "").toUpperCase() === "DELIVERED")} className="h-11 w-full rounded-lg border bg-background px-3">{orders.filter((order) => String(order.orderStatus || "").toUpperCase() === "DELIVERED").map((order) => <option key={orderId(order)} value={orderId(order)}>{orderNumber(order)} · {wholesalerName(order)}{reviews.some((review) => review.orderId === orderId(order)) ? " · reviewed" : ""}</option>)}{!orders.some((order) => String(order.orderStatus || "").toUpperCase() === "DELIVERED") && <option value="">No delivered purchases available</option>}</select></label>
                {reviewOrder && <p className="rounded-lg bg-secondary/50 p-3 text-xs text-muted-foreground">Verified wholesaler: <strong className="text-ink">{wholesalerName(reviewOrder)}</strong></p>}
                <div><span className="block text-sm font-semibold">Overall rating</span><div className="mt-1 flex gap-1" role="group" aria-label="Overall rating">{[1, 2, 3, 4, 5].map((value) => <button key={value} type="button" aria-label={`${value} star${value === 1 ? "" : "s"}`} aria-pressed={reviewRating === value} onClick={() => setReviewRating(value)} className="rounded p-1 text-amber-500"><Star className={`size-6 ${value <= reviewRating ? "fill-current" : ""}`} /></button>)}</div></div>
                {([
                  ["productQuality", "Product quality"],
                  ["packaging", "Packaging"],
                  ["delivery", "Delivery experience"],
                  ["communication", "Communication"],
                ] as const).map(([key, label]) => <label key={key} className="flex items-center justify-between gap-3 text-sm font-semibold">{label}<select value={categoryRatings[key]} onChange={(event) => setCategoryRatings((current) => ({ ...current, [key]: Number(event.target.value) as CategoryRatings[typeof key] }))} className="h-9 rounded-lg border bg-background px-2">{[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value} / 5</option>)}</select></label>)}
                <label className="block space-y-1.5 text-sm font-semibold">Title (optional)<Input value={reviewTitle} onChange={(event) => setReviewTitle(event.target.value)} maxLength={120} /></label>
                <label className="block space-y-1.5 text-sm font-semibold">Written feedback<textarea required value={reviewComment} onChange={(event) => setReviewComment(event.target.value)} maxLength={2000} rows={4} className="w-full rounded-lg border bg-background p-3 text-sm" /></label>
                <Button type="submit" className="w-full" disabled={!reviewOrder || !reviewComment.trim() || submittingReview}>{submittingReview ? "Saving…" : existingReview ? "Update Review" : "Submit Review"}</Button>
              </form>
              <section className="rounded-2xl border bg-card p-5 shadow-sm">
                <h2 className="text-xl font-extrabold text-ink">Your Feedback &amp; Reviews</h2>
                <p className="mt-1 text-sm text-muted-foreground">Only your retailer-submitted reviews are shown here.</p>
                {reviewsQuery.isError ? <p role="alert" className="mt-4 text-sm text-destructive">{reviewsQuery.error instanceof Error ? reviewsQuery.error.message : "Unable to load reviews."}</p> : reviews.length ? (
                  <div className="mt-4 divide-y">{reviews.map((review) => <article key={review.id} className="py-4 first:pt-0"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-bold text-ink">{review.title || "Order review"}</h3><p className="mt-1 text-xs text-muted-foreground">For {review.recipient.name} · Order {review.orderId} · {formatDate(review.createdAt)}</p></div><strong className="text-amber-600">{review.rating}/5 ★</strong></div><p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{review.comment}</p><p className="mt-2 text-xs text-muted-foreground">Quality {review.categoryRatings?.productQuality ?? "—"} · Packaging {review.categoryRatings?.packaging ?? "—"} · Delivery {review.categoryRatings?.delivery ?? "—"} · Communication {review.categoryRatings?.communication ?? "—"}</p>{(review as any).wholesalerResponse && <p className="mt-3 rounded-lg bg-secondary/40 p-3 text-sm">Wholesaler response: {(review as any).wholesalerResponse}</p>}</article>)}</div>
                ) : <p className="py-10 text-center text-sm text-muted-foreground">No reviews submitted yet.</p>}
              </section>
            </section>
          )}
        </>
      )}

      {selectedOrderId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-6" role="dialog" aria-modal="true" aria-label="Invoice details">
          <section className="max-h-[94vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-background p-4 shadow-2xl sm:p-7">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div><p className="text-xs font-bold uppercase tracking-wider text-primary">Purchase invoice</p><h2 className="mt-1 text-2xl font-extrabold text-ink">{selectedInvoice ? invoice?.number || `Order ${orderNumber(selectedInvoice)}` : "Invoice details"}</h2><p className="mt-1 text-sm text-muted-foreground">{selectedInvoice ? wholesalerName(selectedInvoice) : "Loading order…"}</p></div>
              <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={downloadInvoice} disabled={!invoice?.available}><Download className="mr-2 size-4" />Download PDF</Button><Button variant="outline" onClick={printInvoice} disabled={!invoice?.available}><Printer className="mr-2 size-4" />Print</Button><Button variant="outline" onClick={shareInvoice} disabled={!selectedInvoice}><Share2 className="mr-2 size-4" />Share</Button>              <Button variant="ghost" onClick={() => setSelectedOrderId("")}>Close</Button></div>
            </div>
            {invoiceQuery.isLoading ? <p className="py-12 text-center text-sm text-muted-foreground">Loading order and invoice data…</p> : invoiceQuery.isError ? <p role="alert" className="my-5 rounded-lg bg-destructive/5 p-4 text-sm text-destructive">{invoiceQuery.error instanceof Error ? invoiceQuery.error.message : "Unable to load invoice details."}</p> : selectedInvoice && (
              <div id="account-invoice-print" className="mt-5 space-y-5">
                {!invoice?.available && <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">Invoice is not available yet. The invoice is generated from the confirmed order after it is marked delivered. Current order status: {String(selectedInvoice.orderStatus || selectedInvoice.status || "PENDING").replace(/_/g, " ")}.</p>}
                <div className="grid gap-4 sm:grid-cols-2">
                  <article className="rounded-xl border p-4">
                    <h3 className="text-xs font-bold uppercase text-muted-foreground">Supplier details</h3>
                    <div className="mt-3 flex items-center gap-3">{invoice?.seller?.logo && <img src={invoice.seller.logo} alt={`${invoice.seller.businessName} logo`} className="size-12 rounded-lg border object-contain" />}<p className="font-extrabold text-ink">{invoice?.seller?.businessName || wholesalerName(selectedInvoice)}</p></div>
                    <p className="mt-2 text-sm text-muted-foreground">{formatAddress(invoice?.seller?.address)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Contact: {invoice?.seller?.phone || invoice?.seller?.email || "Not provided"} · GSTIN: {invoice?.seller?.gstin || "Not provided"}</p>
                  </article>
                  <article className="rounded-xl border p-4">
                    <h3 className="text-xs font-bold uppercase text-muted-foreground">Invoice / order details</h3>
                    <dl className="mt-3 grid grid-cols-2 gap-2 text-sm"><dt>Invoice number</dt><dd className="text-right font-semibold">{invoice?.number || "Not available"}</dd><dt>Order number</dt><dd className="text-right font-semibold">{orderNumber(selectedInvoice)}</dd><dt>Invoice date</dt><dd className="text-right font-semibold">{invoice?.available ? formatDate(invoice.date) : "Not issued"}</dd><dt>Purchase date</dt><dd className="text-right font-semibold">{formatDate(selectedInvoice.createdAt)}</dd><dt>Bilty / LR number</dt><dd className="text-right font-semibold">{selectedInvoice.shippingDetails?.biltyNumber || "Not provided"}</dd><dt>Order status</dt><dd className="text-right font-semibold">{String(selectedInvoice.orderStatus || selectedInvoice.status || "PENDING").replace(/_/g, " ")}</dd><dt>Due date</dt><dd className="text-right font-semibold">{formatDate(selectedInvoice.creditDueDate)}</dd></dl>
                  </article>
                </div>
                <article className="overflow-hidden rounded-xl border">
                  <h3 className="border-b p-4 text-sm font-extrabold text-ink">Purchased products</h3>
                  <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-xs"><thead className="bg-secondary/40 text-[10px] uppercase text-muted-foreground"><tr><th className="p-3">Product</th><th className="p-3">Description</th><th className="p-3">Qty / Unit</th><th className="p-3 text-right">Rate</th><th className="p-3 text-right">Taxable</th><th className="p-3 text-right">GST % / Amt</th><th className="p-3 text-right">Total</th></tr></thead><tbody className="divide-y">{(selectedInvoice.items || []).map((item: any, index: number) => <tr key={String(item._id || item.productId?._id || item.productId || index)}><td className="p-3 font-semibold">{item.name || "Product"}<div className="text-[10px] text-muted-foreground">HSN: {item.hsnCode || "Not recorded"}</div></td><td className="p-3 text-muted-foreground">{item.description || "Not recorded on this order"}</td><td className="p-3">{item.quantity} {item.unit || "unit not recorded"}</td><td className="p-3 text-right">{money(Number(item.pricePerUnit || 0))}</td><td className="p-3 text-right">{money(Number(item.taxableValue ?? item.subtotal ?? 0))}</td><td className="p-3 text-right">{Number(item.gstRate || 0)}% / {money(Number(item.gstAmount || 0))}</td><td className="p-3 text-right font-bold">{money(Number(item.total ?? item.subtotal ?? 0))}</td></tr>)}</tbody></table></div>
                </article>
                <div className="grid gap-4 lg:grid-cols-2">
                  <article className="rounded-xl border p-4"><h3 className="text-sm font-extrabold text-ink">Payment details</h3>{invoiceReports.length ? <div className="mt-3 space-y-2">{invoiceReports.map((report) => <div key={report._id} className="flex flex-wrap justify-between gap-2 border-b pb-2 text-xs last:border-0"><span>{formatDate(report.reportedPaymentDate || report.paidAt || report.createdAt)} · {String(report.paymentMethod || "Not recorded").replace(/_/g, " ")} · Ref {report.transactionReference || "Not recorded"}</span><span className="font-bold">{money(paymentAmount(report))} · {report.status}</span>{report.screenshotAvailable && <button type="button" onClick={() => void openPaymentProof(String(report._id))} className="text-primary underline">View proof</button>}</div>)}</div> : <p className="mt-3 text-sm text-muted-foreground">No payment reports are recorded for this order.</p>}</article>
                  <article className="rounded-xl border p-4"><h3 className="text-sm font-extrabold text-ink">Bill calculation</h3><dl className="mt-3 space-y-2 text-sm"><div className="flex justify-between"><dt>Subtotal</dt><dd>{money(Number(selectedInvoice.subtotal || 0))}</dd></div><div className="flex justify-between"><dt>CGST</dt><dd>{money((selectedInvoice.items || []).reduce((sum: number, item: any) => sum + Number(item.cgstAmount || 0), 0))}</dd></div><div className="flex justify-between"><dt>SGST</dt><dd>{money((selectedInvoice.items || []).reduce((sum: number, item: any) => sum + Number(item.sgstAmount || 0), 0))}</dd></div><div className="flex justify-between"><dt>IGST</dt><dd>{money((selectedInvoice.items || []).reduce((sum: number, item: any) => sum + Number(item.igstAmount || 0), 0))}</dd></div><div className="flex justify-between"><dt>Transport / shipping</dt><dd>{money(Number(selectedInvoice.shipping || 0))}</dd></div><div className="flex justify-between"><dt>Loading / unloading</dt><dd>Not recorded</dd></div><div className="flex justify-between"><dt>Discount</dt><dd>− {money(Number(selectedInvoice.discount || 0))}</dd></div><div className="flex justify-between border-t pt-2 font-extrabold"><dt>Grand total</dt><dd>{money(orderTotal(selectedInvoice))}</dd></div><div className="flex justify-between text-emerald-700"><dt>Amount paid</dt><dd>{money(orderPaid(selectedInvoice, payments))}</dd></div><div className="flex justify-between font-bold text-amber-800"><dt>Remaining balance</dt><dd>{money(paymentDue(selectedInvoice, payments, returns))}</dd></div></dl></article>
                </div>
                <div className="grid gap-4 sm:grid-cols-2"><article className="rounded-xl border p-4"><h3 className="text-xs font-bold uppercase text-muted-foreground">Retailer details</h3><p className="mt-2 font-bold">{invoice?.buyer?.businessName || "Retailer"}</p><p className="mt-1 text-xs text-muted-foreground">{formatAddress(invoice?.buyer?.address)}</p><p className="mt-1 text-xs text-muted-foreground">Contact: {invoice?.buyer?.phone || invoice?.buyer?.email || "Not provided"} · GSTIN: {invoice?.buyer?.gstin || "Not provided"}</p></article><article className="rounded-xl border p-4"><h3 className="text-xs font-bold uppercase text-muted-foreground">Order notes</h3><p className="mt-2 whitespace-pre-wrap text-sm">{selectedInvoice.wholesalerNotes || selectedInvoice.notes || "No notes recorded"}</p></article></div>
              </div>
            )}
          </section>
        </div>
      )}
      <style>{`@media print { body * { visibility: hidden !important; } #account-invoice-print, #account-invoice-print * { visibility: visible !important; } #account-invoice-print { position: absolute; inset: 0; width: 100%; padding: 18px; background: white; } }`}</style>
    </main>
  );
}

function formatAddress(address: any) {
  if (!address || typeof address !== "object") return "Address not provided";
  const values = [address.street, address.addressLine2, address.city, address.state, address.pincode, address.country]
    .filter((value) => typeof value === "string" && value.trim());
  return values.length ? values.join(", ") : "Address not provided";
}
