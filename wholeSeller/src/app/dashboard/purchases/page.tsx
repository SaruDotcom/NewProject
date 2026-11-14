import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowDownLeft,
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  Check,
  CirclePlus,
  ClipboardList,
  FileText,
  LoaderCircle,
  PackagePlus,
  Plus,
  Printer,
  RotateCcw,
  Search,
  Truck,
  X,
} from 'lucide-react';
import api, {
  type PurchaseBill,
  type PurchaseBillInput,
  type PurchasePaymentMode,
  type PurchaseSupplier,
  type PurchaseUnit,
} from '@/lib/api';
import { useWholesaler } from '@/context/WholesalerContext';
import { wholesalerQueryKeys } from '@/lib/query-client';
import type { Category, Product } from '@/lib/types';

type Tab = 'purchases' | 'suppliers' | 'returns';
type FormMode = 'FULL' | 'QUICK';
type LineDraft = {
  productId: string;
  quantity: string;
  unit: PurchaseUnit;
  purchaseRate: string;
  gstPercent: string;
  sellingPriceAction: 'KEEP' | 'UPDATE';
  retailerPrice: string;
};
type BillDraft = {
  supplierId: string;
  invoiceNumber: string;
  billDate: string;
  dueDate: string;
  items: LineDraft[];
  transportCharges: string;
  loadingCharges: string;
  discountType: 'AMOUNT' | 'PERCENT';
  discountValue: string;
  paymentAmount: string;
  paymentMode: PurchasePaymentMode | '';
  paymentDate: string;
  notes: string;
  stockUpdateEnabled: boolean;
};
type SupplierDraft = {
  name: string;
  mobile: string;
  address: string;
  gstin: string;
  openingBalance: string;
};

const units: PurchaseUnit[] = ['KG', 'BOX', 'CARTON', 'PIECES', 'METER'];
const paymentModes: Array<{ value: PurchasePaymentMode; label: string }> = [
  { value: 'CASH', label: 'Cash' },
  { value: 'UPI', label: 'UPI' },
  { value: 'CHEQUE', label: 'Cheque' },
  { value: 'BANK_TRANSFER', label: 'Bank transfer' },
];
const currency = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
});
const amount = (value: number | string | undefined) => currency.format(Number(value || 0));
const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const makeKey = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}[character] || character));
const fieldClass = 'mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-800 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10';
const labelClass = 'block text-xs font-semibold text-stone-600';
const buttonClass = 'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50';
const defaultLine = (): LineDraft => ({
  productId: '',
  quantity: '1',
  unit: 'PIECES',
  purchaseRate: '',
  gstPercent: '0',
  sellingPriceAction: 'KEEP',
  retailerPrice: '',
});
const defaultBill = (mode: FormMode, supplierId = ''): BillDraft => ({
  supplierId,
  invoiceNumber: '',
  billDate: today(),
  dueDate: '',
  items: [defaultLine()],
  transportCharges: '0',
  loadingCharges: '0',
  discountType: 'AMOUNT',
  discountValue: '0',
  paymentAmount: '0',
  paymentMode: '',
  paymentDate: today(),
  notes: '',
  stockUpdateEnabled: mode === 'FULL',
});

function isObjectSupplier(value: PurchaseBill['supplierId']): value is PurchaseSupplier {
  return typeof value === 'object' && value !== null;
}

function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-stone-950/45 p-3 backdrop-blur-[2px]" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section role="dialog" aria-modal="true" aria-label={title} className={`max-h-[94vh] w-full overflow-y-auto rounded-2xl bg-white shadow-2xl ${wide ? 'max-w-5xl' : 'max-w-2xl'}`}>
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-stone-100 bg-white px-5 py-4">
          <h2 className="text-lg font-bold text-stone-900">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-stone-500 hover:bg-stone-100" aria-label="Close dialog">
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="p-5">{children}</div>
      </section>
    </div>
  );
}

function StatusBadge({ status }: { status: PurchaseBill['paymentStatus'] }) {
  const styles = status === 'PAID'
    ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
    : status === 'PARTIAL'
      ? 'bg-amber-50 text-amber-800 ring-amber-200'
      : 'bg-rose-50 text-rose-700 ring-rose-200';
  const text = status === 'UDHAAR' ? 'Udhaar' : status === 'PARTIAL' ? 'Partly paid' : 'Paid';
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ring-inset ${styles}`}>{text}</span>;
}

export default function PurchasesPage() {
  const { profile, products, categories, addProduct, refreshData } = useWholesaler();
  const queryClient = useQueryClient();
  const ownerId = profile.id || 'unknown';
  const [tab, setTab] = useState<Tab>('purchases');
  const [search, setSearch] = useState('');
  const [billPage, setBillPage] = useState(1);
  const [supplierSearch, setSupplierSearch] = useState('');
  const [billStatus, setBillStatus] = useState<'ACTIVE' | 'CANCELLED' | 'ALL'>('ACTIVE');
  const [billForm, setBillForm] = useState<BillDraft | null>(null);
  const [formMode, setFormMode] = useState<FormMode>('FULL');
  const [editingBill, setEditingBill] = useState<PurchaseBill | null>(null);
  const [supplierFormOpen, setSupplierFormOpen] = useState(false);
  const [supplierDraft, setSupplierDraft] = useState<SupplierDraft>({ name: '', mobile: '', address: '', gstin: '', openingBalance: '0' });
  const [productFormOpen, setProductFormOpen] = useState(false);
  const [productDraft, setProductDraft] = useState({ title: '', sku: '', categoryId: '', sellingPrice: '', unit: 'piece' });
  const [selectedBillId, setSelectedBillId] = useState<string | null>(null);
  const [ledgerSupplier, setLedgerSupplier] = useState<PurchaseSupplier | null>(null);
  const [ledgerFrom, setLedgerFrom] = useState('');
  const [ledgerTo, setLedgerTo] = useState('');
  const [ledgerPage, setLedgerPage] = useState(1);
  const [paymentSupplier, setPaymentSupplier] = useState<PurchaseSupplier | null>(null);
  const [returnBill, setReturnBill] = useState<PurchaseBill | null>(null);
  const [cancelBill, setCancelBill] = useState<PurchaseBill | null>(null);
  const [cancelReturnId, setCancelReturnId] = useState<string | null>(null);
  const [paymentForm, setPaymentForm] = useState({ amount: '', paymentDate: today(), paymentMode: 'CASH' as PurchasePaymentMode, notes: '' });
  const [returnDraft, setReturnDraft] = useState({ itemId: '', quantity: '1', returnDate: today(), reason: 'DAMAGED' as 'DAMAGED' | 'WRONG_PRODUCT' | 'EXCESS_QUANTITY' | 'OTHER', refundStatus: 'PENDING' as 'REFUNDED' | 'ADJUSTED' | 'PENDING', refundMode: '' as PurchasePaymentMode | '', notes: '' });
  const [cancelReason, setCancelReason] = useState('');
  const [cancelReturnReason, setCancelReturnReason] = useState('');
  const [paymentReverse, setPaymentReverse] = useState<{ id: string; reason: string } | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [duplicateBill, setDuplicateBill] = useState<Pick<PurchaseBill, '_id' | 'invoiceNumber' | 'billDate' | 'totalAmount' | 'status'> | null>(null);
  const [saving, setSaving] = useState(false);

  const summaryQuery = useQuery({
    queryKey: wholesalerQueryKeys.resource(ownerId, 'purchases', 'summary'),
    queryFn: () => api.getPurchaseSummary(),
    enabled: Boolean(profile.id),
  });
  const suppliersQuery = useQuery({
    queryKey: wholesalerQueryKeys.resource(ownerId, 'purchases', 'suppliers'),
    queryFn: () => api.getPurchaseSuppliers(),
    enabled: Boolean(profile.id),
  });
  const billsQuery = useQuery({
    queryKey: wholesalerQueryKeys.resource(ownerId, 'purchases', 'bills', billStatus, search, billPage),
    queryFn: () => api.getPurchaseBills({ status: billStatus, search, page: billPage, limit: 100 }),
    enabled: Boolean(profile.id),
  });
  const returnsQuery = useQuery({
    queryKey: wholesalerQueryKeys.resource(ownerId, 'purchases', 'returns'),
    queryFn: () => api.getPurchaseReturns({ status: 'ALL', limit: 100 }),
    enabled: Boolean(profile.id),
  });
  const ledgerQuery = useQuery({
    queryKey: wholesalerQueryKeys.resource(ownerId, 'purchases', 'ledger', ledgerSupplier?._id, ledgerFrom, ledgerTo),
    queryFn: () => api.getPurchaseSupplierLedger(ledgerSupplier!._id, {
      ...(ledgerFrom ? { from: ledgerFrom } : {}),
      ...(ledgerTo ? { to: ledgerTo } : {}),
      page: ledgerPage,
      limit: 100,
    }),
    enabled: Boolean(profile.id && ledgerSupplier),
  });
  const paymentsQuery = useQuery({
    queryKey: wholesalerQueryKeys.resource(ownerId, 'purchases', 'supplier-payments', ledgerSupplier?._id),
    queryFn: () => api.getPurchaseSupplierPayments(ledgerSupplier!._id),
    enabled: Boolean(profile.id && ledgerSupplier),
  });
  const selectedBillQuery = useQuery({
    queryKey: wholesalerQueryKeys.resource(ownerId, 'purchases', 'bill', selectedBillId),
    queryFn: () => api.getPurchaseBill(selectedBillId!),
    enabled: Boolean(profile.id && selectedBillId),
  });

  const suppliers = suppliersQuery.data?.data || [];
  const bills = billsQuery.data?.data.items || [];
  const returns = returnsQuery.data?.data || [];
  const summary = summaryQuery.data?.data;
  const activeBills = useMemo(() => bills.filter((bill) => bill.status === 'ACTIVE'), [bills]);
  const returnableBills = useMemo(
    () => activeBills.filter((bill) => bill.items.some((item) => item.returnedQuantity < item.quantity)),
    [activeBills],
  );
  const filteredSuppliers = useMemo(() => {
    const term = supplierSearch.trim().toLowerCase();
    return term ? suppliers.filter((supplier) => `${supplier.name} ${supplier.mobile} ${supplier.gstin}`.toLowerCase().includes(term)) : suppliers;
  }, [suppliers, supplierSearch]);
  const supplierById = useMemo(() => new Map(suppliers.map((supplier) => [supplier._id, supplier])), [suppliers]);
  const productById = useMemo(() => new Map((products as Product[]).map((product) => [product.id, product])), [products]);
  const mainCategories = useMemo(
    () => (categories as Category[]).filter((category) => !category.parentId),
    [categories],
  );

  const invalidatePurchases = async () => {
    await queryClient.invalidateQueries({ queryKey: wholesalerQueryKeys.resource(ownerId, 'purchases') });
    await queryClient.invalidateQueries({ queryKey: wholesalerQueryKeys.resource(ownerId, 'inventory') });
    await queryClient.invalidateQueries({ queryKey: wholesalerQueryKeys.resource(ownerId, 'products') });
    await refreshData(true);
  };

  const openBillForm = (mode: FormMode) => {
    setEditingBill(null);
    setFormMode(mode);
    setBillForm(defaultBill(mode, suppliers[0]?._id || ''));
    setDuplicateBill(null);
    setMessage(null);
  };

  const editBill = async (bill: PurchaseBill) => {
    try {
      const { data } = await api.getPurchaseBill(bill._id);
      setEditingBill(data);
      setFormMode(data.billType);
      setBillForm({
        supplierId: typeof data.supplierId === 'string' ? data.supplierId : data.supplierId._id,
        invoiceNumber: data.invoiceNumber,
        billDate: data.billDate.slice(0, 10),
        dueDate: data.dueDate?.slice(0, 10) || '',
        items: data.items.map((item) => ({
          productId: item.productId,
          quantity: String(item.quantity),
          unit: item.unit,
          purchaseRate: String(item.purchaseRate),
          gstPercent: String(item.gstPercent),
          sellingPriceAction: 'KEEP',
          retailerPrice: '',
        })),
        transportCharges: String(data.transportCharges),
        loadingCharges: String(data.loadingCharges),
        discountType: data.discountType,
        discountValue: String(data.discountValue),
        paymentAmount: String(data.paidAmount),
        paymentMode: data.paymentMode,
        paymentDate: today(),
        notes: data.notes,
        stockUpdateEnabled: data.stockUpdateEnabled,
      });
      setDuplicateBill(null);
      setMessage(null);
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unable to load this bill.' });
    }
  };

  const saveSupplier = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const { data } = await api.createPurchaseSupplier({
        ...supplierDraft,
        openingBalance: Number(supplierDraft.openingBalance || 0),
      });
      await invalidatePurchases();
      setSupplierDraft({ name: '', mobile: '', address: '', gstin: '', openingBalance: '0' });
      setSupplierFormOpen(false);
      setMessage({ type: 'success', text: `${data.name} added to your supplier list.` });
      if (billForm) setBillForm((current) => current ? { ...current, supplierId: data._id } : current);
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unable to add supplier.' });
    } finally {
      setSaving(false);
    }
  };

  const saveProduct = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const category = mainCategories.find((item) => item.id === productDraft.categoryId);
      if (!category) throw new Error('Select a main category for the new product.');
      await addProduct({
        title: productDraft.title.trim(),
        sku: productDraft.sku.trim(),
        category: category.name,
        categoryId: category.id,
        subcategoryId: null,
        subSubcategoryId: null,
        costPrice: 0,
        sellingPrice: Number(productDraft.sellingPrice),
        mrp: Number(productDraft.sellingPrice),
        basePrice: Number(productDraft.sellingPrice),
        stock: 0,
        minOrderQty: 1,
        unit: productDraft.unit.trim() || 'piece',
        imageUrl: '',
        pricingTiers: [],
        description: '',
      });
      await refreshData(true);
      setProductDraft({ title: '', sku: '', categoryId: '', sellingPrice: '', unit: 'piece' });
      setProductFormOpen(false);
      setMessage({ type: 'success', text: 'Product created with zero stock. This bill can update its inventory.' });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unable to create product.' });
    } finally {
      setSaving(false);
    }
  };

  const lineTotals = (line: LineDraft) => {
    const taxable = Number(line.quantity || 0) * Number(line.purchaseRate || 0);
    const gst = taxable * Number(line.gstPercent || 0) / 100;
    return { taxable, gst, total: taxable + gst };
  };

  const billTotals = (draft: BillDraft) => {
    const subtotal = draft.items.reduce((sum, line) => sum + lineTotals(line).taxable, 0);
    const gst = draft.items.reduce((sum, line) => sum + lineTotals(line).gst, 0);
    const beforeDiscount = subtotal + gst + Number(draft.transportCharges || 0) + Number(draft.loadingCharges || 0);
    const discount = draft.discountType === 'PERCENT'
      ? subtotal * Number(draft.discountValue || 0) / 100
      : Number(draft.discountValue || 0);
    const total = Math.max(0, beforeDiscount - discount);
    const paid = Number(draft.paymentAmount || 0);
    return { subtotal, gst, discount, total, paid, outstanding: Math.max(0, total - paid) };
  };

  const setLine = (index: number, patch: Partial<LineDraft>) => {
    setBillForm((current) => current ? {
      ...current,
      items: current.items.map((line, lineIndex) => lineIndex === index ? { ...line, ...patch } : line),
    } : current);
  };

  const saveBill = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!billForm) return;
    setSaving(true);
    setDuplicateBill(null);
    setMessage(null);
    try {
      if (formMode === 'FULL' && !editingBill) {
        const duplicate = await api.checkDuplicatePurchaseBill(billForm.supplierId, billForm.invoiceNumber);
        if (duplicate.data.duplicate && duplicate.data.bill) {
          setDuplicateBill(duplicate.data.bill);
          setSaving(false);
          return;
        }
      }

      const payload: PurchaseBillInput = {
        billType: formMode,
        supplierId: billForm.supplierId,
        idempotencyKey: editingBill?.idempotencyKey || makeKey(),
        invoiceNumber: formMode === 'FULL' ? billForm.invoiceNumber.trim() : '',
        billDate: billForm.billDate,
        items: billForm.items.map((line) => ({
          productId: line.productId,
          quantity: Number(line.quantity),
          unit: line.unit,
          purchaseRate: Number(line.purchaseRate),
          gstPercent: Number(line.gstPercent || 0),
        })),
        transportCharges: formMode === 'FULL' ? Number(billForm.transportCharges || 0) : 0,
        loadingCharges: formMode === 'FULL' ? Number(billForm.loadingCharges || 0) : 0,
        discountType: formMode === 'FULL' ? billForm.discountType : 'AMOUNT',
        discountValue: formMode === 'FULL' ? Number(billForm.discountValue || 0) : 0,
        paymentAmount: Number(billForm.paymentAmount || 0),
        paymentMode: billForm.paymentMode,
        paymentDate: billForm.paymentDate,
        dueDate: billForm.dueDate || null,
        notes: billForm.notes,
        stockUpdateEnabled: billForm.stockUpdateEnabled,
        sellingPriceUpdates: billForm.items
          .filter((line) => line.sellingPriceAction === 'UPDATE' && line.retailerPrice.trim())
          .map((line) => ({ productId: line.productId, retailerPrice: Number(line.retailerPrice) })),
        ...(editingBill ? {
          expectedRevision: editingBill.revision,
          confirmPaymentRefund: Number(billForm.paymentAmount || 0) < editingBill.paidAmount &&
            window.confirm('Confirm that the supplier refund was received before reducing the paid amount?'),
        } : {}),
      };
      if (!payload.supplierId || payload.items.some((item) => !item.productId || item.quantity <= 0 || item.purchaseRate < 0)) {
        throw new Error('Choose a supplier and complete every product, quantity and purchase rate.');
      }
      if (payload.paymentAmount > 0 && !payload.paymentMode) throw new Error('Choose a payment mode for the amount paid.');
      const result = editingBill
        ? await api.updatePurchaseBill(editingBill._id, payload)
        : await api.createPurchaseBill(payload);
      await invalidatePurchases();
      setBillForm(null);
      setEditingBill(null);
      setMessage({ type: 'success', text: editingBill ? 'Purchase bill updated.' : `${result.data.invoiceNumber} saved successfully.` });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unable to save this purchase bill.' });
    } finally {
      setSaving(false);
    }
  };

  const savePayment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!paymentSupplier) return;
    setSaving(true);
    setMessage(null);
    try {
      await api.createPurchaseSupplierPayment(paymentSupplier._id, {
        amount: Number(paymentForm.amount),
        paymentDate: paymentForm.paymentDate,
        paymentMode: paymentForm.paymentMode,
        notes: paymentForm.notes,
        idempotencyKey: makeKey(),
      });
      setPaymentSupplier(null);
      setPaymentForm({ amount: '', paymentDate: today(), paymentMode: 'CASH', notes: '' });
      await invalidatePurchases();
      setMessage({ type: 'success', text: 'Supplier payment recorded and allocated to outstanding bills.' });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unable to record supplier payment.' });
    } finally {
      setSaving(false);
    }
  };

  const saveReturn = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!returnBill) return;
    setSaving(true);
    setMessage(null);
    try {
      const { data } = await api.createPurchaseReturn({
        purchaseBillId: returnBill._id,
        returnDate: returnDraft.returnDate,
        items: [{ billItemId: returnDraft.itemId, quantity: Number(returnDraft.quantity) }],
        reason: returnDraft.reason,
        refundStatus: returnDraft.refundStatus,
        refundMode: returnDraft.refundMode,
        notes: returnDraft.notes,
        idempotencyKey: makeKey(),
      });
      await invalidatePurchases();
      setReturnBill(null);
      setMessage({
        type: 'success',
        text: `Return ${data._id.slice(-6)} recorded. ${data.items?.some((item: { stockNote?: string }) => item.stockNote) ? 'Check the stock note in return history.' : 'Inventory updated where eligible.'}`,
      });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unable to save this purchase return.' });
    } finally {
      setSaving(false);
    }
  };

  const confirmCancelBill = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!cancelBill) return;
    setSaving(true);
    try {
      await api.cancelPurchaseBill(cancelBill._id, cancelReason);
      setCancelBill(null);
      setCancelReason('');
      await invalidatePurchases();
      setMessage({ type: 'success', text: `${cancelBill.invoiceNumber} cancelled with an audit trail.` });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unable to cancel this bill.' });
    } finally {
      setSaving(false);
    }
  };

  const confirmCancelReturn = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!cancelReturnId) return;
    setSaving(true);
    try {
      await api.cancelPurchaseReturn(cancelReturnId, cancelReturnReason);
      setCancelReturnId(null);
      setCancelReturnReason('');
      await invalidatePurchases();
      setMessage({ type: 'success', text: 'Purchase return cancelled and its ledger/stock effects were reversed.' });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unable to cancel this return.' });
    } finally {
      setSaving(false);
    }
  };

  const confirmPaymentReverse = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!paymentReverse) return;
    setSaving(true);
    try {
      await api.reversePurchaseSupplierPayment(paymentReverse.id, paymentReverse.reason);
      setPaymentReverse(null);
      await invalidatePurchases();
      setMessage({ type: 'success', text: 'Supplier payment reversed with a separate ledger entry.' });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unable to reverse this payment.' });
    } finally {
      setSaving(false);
    }
  };

  const openReturnForm = (bill: PurchaseBill) => {
    setReturnBill(bill);
    const item = bill.items.find((line) => line.returnedQuantity < line.quantity);
    setReturnDraft({
      itemId: item?._id || '',
      quantity: '1',
      returnDate: today(),
      reason: 'DAMAGED',
      refundStatus: 'PENDING',
      refundMode: '',
      notes: '',
    });
  };

  const startPayment = (supplier: PurchaseSupplier) => {
    setPaymentForm({ amount: '', paymentDate: today(), paymentMode: 'CASH', notes: '' });
    setPaymentSupplier(supplier);
  };

  const getAllLedgerEntries = async () => {
    if (!ledgerSupplier) return [];
    const filters = {
      ...(ledgerFrom ? { from: ledgerFrom } : {}),
      ...(ledgerTo ? { to: ledgerTo } : {}),
      limit: 100,
    };
    const firstPage = await api.getPurchaseSupplierLedger(ledgerSupplier._id, { ...filters, page: 1 });
    const entries = [...firstPage.data.items];
    for (let page = 2; page <= firstPage.data.meta.totalPages; page += 1) {
      const result = await api.getPurchaseSupplierLedger(ledgerSupplier._id, { ...filters, page });
      entries.push(...result.data.items);
    }
    return entries;
  };

  const downloadStatement = async () => {
    if (!ledgerSupplier) return;
    setSaving(true);
    try {
      const entries = await getAllLedgerEntries();
      const rows = [
        ['Date', 'Transaction', 'Notes', 'Amount', 'Balance'],
        ...entries.map((entry) => [
          new Date(entry.effectiveDate).toLocaleDateString('en-IN'),
          entry.type.replace(/_/g, ' '),
          entry.notes || '',
          String(entry.amount),
          String(entry.balanceAfter),
        ]),
      ];
      const csv = rows.map((row) => row.map((cell) => {
        const value = String(cell).replace(/^([=+\-@\t\r])/, "'$1");
        return `"${value.replace(/"/g, '""')}"`;
      }).join(',')).join('\r\n');
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${ledgerSupplier.name}-khata.csv`.replace(/[^a-z0-9._-]/gi, '-');
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unable to download supplier statement.' });
    } finally {
      setSaving(false);
    }
  };

  const writePrintDocument = (printWindow: Window, title: string, content: string) => {
    printWindow.document.write(`<!doctype html><html><head><title>${escapeHtml(title)}</title><style>
      body{font:14px Arial,sans-serif;color:#1c1917;margin:32px}h1{font-size:22px;margin:0 0 6px}
      p{color:#57534e;margin:4px 0 18px}.summary{display:flex;gap:32px;margin:18px 0;padding:14px;background:#f5f5f4}
      table{border-collapse:collapse;width:100%;margin-top:16px}th,td{border:1px solid #d6d3d1;padding:8px;text-align:left}
      th{background:#f5f5f4;font-size:11px;text-transform:uppercase}.totals{margin:18px 0 0 auto;width:280px}
      .right{text-align:right}.muted{color:#78716c}.strong{font-weight:bold}@media print{body{margin:15mm}}
    </style></head><body>${content}</body></html>`);
    printWindow.document.close();
    printWindow.focus();
    window.setTimeout(() => printWindow.print(), 250);
  };

  const openPrintDocument = (title: string, content: string) => {
    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) {
      setMessage({ type: 'error', text: 'Allow pop-ups to print this document.' });
      return;
    }
    writePrintDocument(printWindow, title, content);
  };

  const printStatement = async () => {
    if (!ledgerSupplier) return;
    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) {
      setMessage({ type: 'error', text: 'Allow pop-ups to print this document.' });
      return;
    }
    setSaving(true);
    try {
      const entries = await getAllLedgerEntries();
      const rows = entries.map((entry) => `<tr><td>${escapeHtml(new Date(entry.effectiveDate).toLocaleDateString('en-IN'))}</td><td>${escapeHtml(entry.type.replace(/_/g, ' '))}</td><td>${escapeHtml(entry.notes)}</td><td class="right">${entry.amount < 0 ? '−' : '+'}${escapeHtml(amount(Math.abs(entry.amount)))}</td><td class="right">${escapeHtml(amount(entry.balanceAfter))}</td></tr>`).join('');
      writePrintDocument(printWindow, `${ledgerSupplier.name} supplier statement`, `
        <h1>Supplier Khata Statement</h1><p>${escapeHtml(ledgerSupplier.name)} · ${escapeHtml(ledgerSupplier.mobile)}</p>
        <div class="summary"><span>Opening balance: <b>${escapeHtml(amount(ledgerSupplier.openingBalance))}</b></span><span>Current Baaki: <b>${escapeHtml(amount(ledgerSupplier.currentBalance))}</b></span></div>
        <table><thead><tr><th>Date</th><th>Transaction</th><th>Notes</th><th>Amount</th><th>Balance</th></tr></thead><tbody>${rows}</tbody></table>
      `);
    } catch (error) {
      printWindow.close();
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unable to print supplier statement.' });
    } finally {
      setSaving(false);
    }
  };

  const printBill = (bill: PurchaseBill) => {
    const supplier = isObjectSupplier(bill.supplierId) ? bill.supplierId : supplierById.get(bill.supplierId);
    const rows = bill.items.map((item) => `<tr><td>${escapeHtml(item.productName)}</td><td>${escapeHtml(item.quantity)} ${escapeHtml(item.unit)}</td><td class="right">${escapeHtml(amount(item.purchaseRate))}</td><td class="right">${escapeHtml(item.gstPercent)}% · ${escapeHtml(amount(item.gstAmount))}</td><td class="right">${escapeHtml(amount(item.itemTotal))}</td></tr>`).join('');
    openPrintDocument(`Purchase ${bill.invoiceNumber}`, `
      <h1>Purchase Bill</h1><p>${escapeHtml(supplier?.name || 'Supplier')} · ${escapeHtml(supplier?.mobile || '')}</p>
      <p>Bill: <b>${escapeHtml(bill.invoiceNumber)}</b> · Date: ${escapeHtml(new Date(bill.billDate).toLocaleDateString('en-IN'))}</p>
      <table><thead><tr><th>Product</th><th>Quantity</th><th>Rate</th><th>GST</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table>
      <table class="totals"><tbody><tr><td>Subtotal</td><td class="right">${escapeHtml(amount(bill.subtotal))}</td></tr><tr><td>GST</td><td class="right">${escapeHtml(amount(bill.gstTotal))}</td></tr><tr><td>Additional charges</td><td class="right">${escapeHtml(amount(bill.transportCharges + bill.loadingCharges))}</td></tr><tr><td>Discount</td><td class="right">−${escapeHtml(amount(bill.discountAmount))}</td></tr><tr><td class="strong">Total</td><td class="right strong">${escapeHtml(amount(bill.totalAmount))}</td></tr><tr><td>Net Jama</td><td class="right">${escapeHtml(amount(bill.paidAmount - bill.refundedAmount))}</td></tr>${bill.refundedAmount > 0 ? `<tr><td>Refund received</td><td class="right">${escapeHtml(amount(bill.refundedAmount))}</td></tr>` : ''}<tr><td>Baaki</td><td class="right">${escapeHtml(amount(bill.outstandingAmount))}</td></tr></tbody></table>
      ${bill.notes ? `<p>Notes: ${escapeHtml(bill.notes)}</p>` : ''}
    `);
  };

  const renderBillForm = () => billForm && (
    <Modal title={editingBill ? `Edit ${editingBill.invoiceNumber}` : formMode === 'FULL' ? 'New full purchase bill' : 'Quick purchase entry'} onClose={() => { setBillForm(null); setEditingBill(null); }} wide>
      <form className="space-y-5" onSubmit={saveBill}>
        {message?.type === 'error' && <p role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{message.text}</p>}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className={labelClass}>Supplier
            <div className="mt-1 flex gap-2">
              <select className={fieldClass + ' mt-0'} value={billForm.supplierId} required disabled={Boolean(editingBill)} onChange={(event) => setBillForm({ ...billForm, supplierId: event.target.value })}>
                <option value="">Select supplier</option>
                {suppliers.filter((supplier) => supplier.isActive).map((supplier) => <option key={supplier._id} value={supplier._id}>{supplier.name} · {amount(supplier.currentBalance)} due</option>)}
              </select>
              <button type="button" onClick={() => setSupplierFormOpen(true)} className="rounded-xl border border-stone-200 px-3 text-emerald-700 hover:bg-emerald-50" aria-label="Add supplier"><Plus className="h-4 w-4" /></button>
            </div>
          </label>
          {formMode === 'FULL' && <label className={labelClass}>Bill / invoice number
            <input className={fieldClass} value={billForm.invoiceNumber} disabled={Boolean(editingBill)} onChange={(event) => setBillForm({ ...billForm, invoiceNumber: event.target.value })} required />
          </label>}
          <label className={labelClass}>Purchase date
            <input className={fieldClass} type="date" value={billForm.billDate} onChange={(event) => setBillForm({ ...billForm, billDate: event.target.value })} required />
          </label>
          <label className={labelClass}>Due date
            <input className={fieldClass} type="date" value={billForm.dueDate} onChange={(event) => setBillForm({ ...billForm, dueDate: event.target.value })} />
          </label>
        </div>
        {!editingBill && suppliers.find((supplier) => supplier._id === billForm.supplierId) && (
          <p className="rounded-xl bg-emerald-50 px-4 py-3 text-xs text-emerald-800">
            Previous outstanding: <strong>{amount(suppliers.find((supplier) => supplier._id === billForm.supplierId)?.currentBalance)}</strong>
          </p>
        )}

        <section className="overflow-hidden rounded-2xl border border-stone-200">
          <div className="flex items-center justify-between bg-stone-50 px-4 py-3">
            <div>
              <h3 className="text-sm font-bold text-stone-800">Purchase items</h3>
              <p className="text-xs text-stone-500">Enter supplier rate and GST; totals are recalculated by the server.</p>
            </div>
            {!editingBill && <button type="button" onClick={() => setProductFormOpen(true)} className="inline-flex items-center gap-1 rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"><PackagePlus className="h-4 w-4" /> Add product</button>}
          </div>
          <div className="space-y-3 p-3">
            {billForm.items.map((line, index) => {
              const product = productById.get(line.productId);
              const changedRate = product && Number(line.purchaseRate) > 0 && Math.abs(Number(product.costPrice || 0) - Number(line.purchaseRate)) >= 0.01;
              return (
                <div key={`${index}-${line.productId}`} className="rounded-xl border border-stone-100 bg-white p-3">
                  <div className="grid gap-3 md:grid-cols-[2fr_0.8fr_0.9fr_0.8fr_1.1fr_auto]">
                    <label className={labelClass}>Product
                      <select className={fieldClass} value={line.productId} required onChange={(event) => {
                        const selected = productById.get(event.target.value);
                        setLine(index, {
                          productId: event.target.value,
                          unit: (units.find((unit) => unit.toLowerCase() === String(selected?.unit || '').toLowerCase()) || 'PIECES'),
                          purchaseRate: String(selected?.costPrice || ''),
                        });
                      }}>
                        <option value="">Select product</option>
                        {(products as Product[]).map((product) => <option key={product.id} value={product.id}>{product.title} · stock {product.stock}</option>)}
                      </select>
                    </label>
                    <label className={labelClass}>Quantity
                      <input className={fieldClass} type="number" min="0.001" step="0.001" value={line.quantity} required onChange={(event) => setLine(index, { quantity: event.target.value })} />
                    </label>
                    <label className={labelClass}>Unit
                      <select className={fieldClass} value={line.unit} onChange={(event) => setLine(index, { unit: event.target.value as PurchaseUnit })}>
                        {units.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
                      </select>
                    </label>
                    <label className={labelClass}>Rate / unit
                      <input className={fieldClass} type="number" min="0" step="0.01" value={line.purchaseRate} required onChange={(event) => setLine(index, { purchaseRate: event.target.value })} />
                    </label>
                    <label className={labelClass}>GST %
                      <input className={fieldClass} type="number" min="0" max="100" step="0.01" value={line.gstPercent} onChange={(event) => setLine(index, { gstPercent: event.target.value })} />
                    </label>
                    <div className="flex items-end">
                      {billForm.items.length > 1 && <button type="button" onClick={() => setBillForm({ ...billForm, items: billForm.items.filter((_, itemIndex) => itemIndex !== index) })} className="mb-1 rounded-lg p-2 text-stone-400 hover:bg-rose-50 hover:text-rose-600" aria-label="Remove item"><X className="h-4 w-4" /></button>}
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-stone-100 pt-2 text-xs">
                    <span className="text-stone-500">Taxable {amount(lineTotals(line).taxable)} · GST {amount(lineTotals(line).gst)} · Item total <strong className="text-stone-800">{amount(lineTotals(line).total)}</strong></span>
                    {changedRate && <span className="text-amber-800">Purchase rate changed ({amount(product.costPrice)} → {amount(line.purchaseRate)}). Would you like to update the retailer selling price?
                      <select className="ml-2 rounded-lg border border-amber-300 bg-white px-2 py-1" value={line.sellingPriceAction} onChange={(event) => setLine(index, { sellingPriceAction: event.target.value as LineDraft['sellingPriceAction'] })}>
                        <option value="KEEP">No, keep existing price</option>
                        <option value="UPDATE">Yes, enter target selling price</option>
                      </select>
                      {line.sellingPriceAction === 'UPDATE' && <input className="ml-2 w-32 rounded-lg border border-amber-300 px-2 py-1" aria-label="Target retailer selling price" type="number" min="0" step="0.01" placeholder="Target ₹" value={line.retailerPrice} onChange={(event) => setLine(index, { retailerPrice: event.target.value })} required />}
                    </span>}
                  </div>
                </div>
              );
            })}
            {formMode === 'FULL' && <button type="button" onClick={() => setBillForm({ ...billForm, items: [...billForm.items, defaultLine()] })} className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"><Plus className="h-4 w-4" /> Add another item</button>}
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-[1.4fr_0.8fr]">
          <div className="grid gap-4 sm:grid-cols-2">
            {formMode === 'FULL' && <>
              <label className={labelClass}>Transport charges<input className={fieldClass} type="number" min="0" step="0.01" value={billForm.transportCharges} onChange={(event) => setBillForm({ ...billForm, transportCharges: event.target.value })} /></label>
              <label className={labelClass}>Loading / unloading<input className={fieldClass} type="number" min="0" step="0.01" value={billForm.loadingCharges} onChange={(event) => setBillForm({ ...billForm, loadingCharges: event.target.value })} /></label>
              <label className={labelClass}>Discount type
                <select className={fieldClass} value={billForm.discountType} onChange={(event) => setBillForm({ ...billForm, discountType: event.target.value as BillDraft['discountType'] })}><option value="AMOUNT">Fixed amount</option><option value="PERCENT">Percentage</option></select>
              </label>
              <label className={labelClass}>Discount {billForm.discountType === 'PERCENT' ? '%' : '₹'}
                <input className={fieldClass} type="number" min="0" step="0.01" value={billForm.discountValue} onChange={(event) => setBillForm({ ...billForm, discountValue: event.target.value })} />
              </label>
            </>}
            <label className={labelClass}>Amount paid (Jama)
              <input className={fieldClass} type="number" min="0" step="0.01" value={billForm.paymentAmount} onChange={(event) => setBillForm({ ...billForm, paymentAmount: event.target.value })} />
            </label>
            <label className={labelClass}>Payment mode
              <select className={fieldClass} value={billForm.paymentMode} onChange={(event) => setBillForm({ ...billForm, paymentMode: event.target.value as PurchasePaymentMode | '' })}><option value="">Choose if paid</option>{paymentModes.map((mode) => <option key={mode.value} value={mode.value}>{mode.label}</option>)}</select>
            </label>
            <label className={labelClass}>Payment date
              <input className={fieldClass} type="date" value={billForm.paymentDate} onChange={(event) => setBillForm({ ...billForm, paymentDate: event.target.value })} />
            </label>
            <label className={labelClass + ' sm:col-span-2'}>Notes
              <textarea className={fieldClass} rows={2} maxLength={1000} value={billForm.notes} onChange={(event) => setBillForm({ ...billForm, notes: event.target.value })} placeholder="Optional remarks" />
            </label>
            <label className="flex items-center gap-2 rounded-xl border border-stone-200 px-3 py-3 text-sm font-medium text-stone-700 sm:col-span-2">
              <input type="checkbox" checked={billForm.stockUpdateEnabled} onChange={(event) => setBillForm({ ...billForm, stockUpdateEnabled: event.target.checked })} className="h-4 w-4 accent-emerald-600" />
              Update inventory automatically {formMode === 'FULL' ? '(on by default)' : '(off by default)'}
            </label>
          </div>
          <aside className="h-fit rounded-2xl bg-stone-50 p-4">
            <h3 className="mb-3 text-sm font-bold text-stone-800">Bill total</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between text-stone-600"><dt>Taxable amount</dt><dd>{amount(billTotals(billForm).subtotal)}</dd></div>
              <div className="flex justify-between text-stone-600"><dt>GST</dt><dd>{amount(billTotals(billForm).gst)}</dd></div>
              <div className="flex justify-between text-stone-600"><dt>Discount</dt><dd>−{amount(billTotals(billForm).discount)}</dd></div>
              <div className="flex justify-between border-t border-stone-200 pt-2 text-base font-bold text-stone-900"><dt>Total bill</dt><dd>{amount(billTotals(billForm).total)}</dd></div>
              <div className="flex justify-between text-emerald-700"><dt>Jama</dt><dd>{amount(billTotals(billForm).paid)}</dd></div>
              <div className="flex justify-between font-semibold text-rose-700"><dt>Baaki</dt><dd>{amount(billTotals(billForm).outstanding)}</dd></div>
            </dl>
          </aside>
        </div>
        {duplicateBill && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <span>This bill number already exists for this supplier. Review the existing bill before continuing.</span>
          <div className="flex gap-2"><button type="button" onClick={() => { setBillForm(null); setSelectedBillId(duplicateBill._id); }} className="rounded-lg bg-amber-800 px-3 py-2 font-semibold text-white">View existing bill</button><button type="button" onClick={() => { setBillForm(null); setDuplicateBill(null); }} className="rounded-lg border border-amber-300 bg-white px-3 py-2 font-semibold text-amber-900">Cancel entry</button></div>
        </div>}
        <footer className="flex flex-wrap justify-end gap-3 border-t border-stone-100 pt-4">
          <button type="button" onClick={() => { setBillForm(null); setEditingBill(null); }} className={`${buttonClass} border border-stone-200 bg-white text-stone-700 hover:bg-stone-50`}>Cancel</button>
          <button type="submit" disabled={saving || !suppliers.length || !products.length} className={`${buttonClass} bg-emerald-700 text-white hover:bg-emerald-800`}>
            {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {editingBill ? 'Save changes' : 'Save purchase'}
          </button>
        </footer>
      </form>
    </Modal>
  );

  const detailBill = selectedBillQuery.data?.data;
  const detailSupplierId = detailBill
    ? (typeof detailBill.supplierId === 'object' ? detailBill.supplierId._id : detailBill.supplierId)
    : undefined;
  const pageQueryError = [summaryQuery.error, suppliersQuery.error, billsQuery.error, returnsQuery.error]
    .find((error) => error instanceof Error);

  return (
    <main className="mx-auto max-w-[1500px] space-y-6 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-emerald-800"><BookOpen className="h-3.5 w-3.5" /> Wholesaler Khata</div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl">Kharidi & Supplier Khata</h1>
          <p className="mt-1 max-w-2xl text-sm text-stone-500">Record purchase bills, track Jama and Baaki, manage supplier payments and returns.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => openBillForm('QUICK')} className={`${buttonClass} border border-stone-200 bg-white text-stone-700 hover:bg-stone-50`}><CirclePlus className="h-4 w-4" /> Quick entry</button>
          <button type="button" onClick={() => openBillForm('FULL')} className={`${buttonClass} bg-emerald-700 text-white shadow-sm hover:bg-emerald-800`}><Plus className="h-4 w-4" /> Full bill</button>
        </div>
      </header>

      {message && <div role={message.type === 'error' ? 'alert' : 'status'} className={`flex items-start justify-between gap-3 rounded-xl px-4 py-3 text-sm ${message.type === 'error' ? 'bg-rose-50 text-rose-800' : 'bg-emerald-50 text-emerald-800'}`}>
        <span>{message.text}</span><button type="button" onClick={() => setMessage(null)} aria-label="Dismiss message"><X className="h-4 w-4" /></button>
      </div>}
      {pageQueryError && <div role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800">
        Unable to load purchase data: {pageQueryError.message}
      </div>}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          { label: 'Total purchases', value: summary?.totalPurchases, icon: ClipboardList, color: 'text-blue-700 bg-blue-50' },
          { label: 'Total Jama', value: summary?.totalPaid, icon: ArrowUpRight, color: 'text-emerald-700 bg-emerald-50' },
          { label: 'Baaki / Udhaar', value: summary?.totalOutstanding, icon: ArrowDownLeft, color: 'text-amber-800 bg-amber-50' },
          { label: 'Overdue payments', value: summary?.overduePayments, icon: CalendarDays, color: 'text-rose-700 bg-rose-50' },
          { label: 'Purchase returns', value: summary?.totalReturns, icon: RotateCcw, color: 'text-violet-700 bg-violet-50' },
        ].map((card) => {
          const Icon = card.icon;
          return <article key={card.label} className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between"><span className="text-xs font-semibold text-stone-500">{card.label}</span><span className={`rounded-xl p-2 ${card.color}`}><Icon className="h-4 w-4" /></span></div>
            <p className="mt-3 text-xl font-bold text-stone-900">{summaryQuery.isLoading ? '—' : amount(card.value)}</p>
          </article>;
        })}
      </section>

      <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
        <div className="flex flex-col justify-between gap-4 border-b border-stone-100 p-4 sm:flex-row sm:items-center">
          <div className="flex flex-wrap gap-1 rounded-xl bg-stone-100 p-1">
            {[
              { key: 'purchases' as const, label: 'Purchase bills', icon: ClipboardList },
              { key: 'suppliers' as const, label: 'Suppliers', icon: Truck },
              { key: 'returns' as const, label: 'Kharidi Wapsi', icon: RotateCcw },
            ].map((item) => {
              const Icon = item.icon;
              return <button type="button" key={item.key} onClick={() => setTab(item.key)} className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition ${tab === item.key ? 'bg-white text-emerald-800 shadow-sm' : 'text-stone-500 hover:text-stone-800'}`}><Icon className="h-4 w-4" />{item.label}</button>;
            })}
          </div>
          {tab === 'purchases' && <div className="flex flex-wrap gap-2">
            <label className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
              <input aria-label="Search bills" className="w-full rounded-xl border border-stone-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-emerald-500 sm:w-56" placeholder="Search supplier or bill" value={search} onChange={(event) => { setSearch(event.target.value); setBillPage(1); }} />
            </label>
            <select aria-label="Filter bill status" className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm" value={billStatus} onChange={(event) => { setBillStatus(event.target.value as typeof billStatus); setBillPage(1); }}><option value="ACTIVE">Active</option><option value="ALL">All bills</option><option value="CANCELLED">Cancelled</option></select>
          </div>}
          {tab === 'suppliers' && <div className="flex gap-2"><label className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" /><input aria-label="Search suppliers" className="w-full rounded-xl border border-stone-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-emerald-500 sm:w-56" placeholder="Search supplier" value={supplierSearch} onChange={(event) => setSupplierSearch(event.target.value)} /></label><button type="button" onClick={() => setSupplierFormOpen(true)} className={`${buttonClass} bg-emerald-700 text-white hover:bg-emerald-800`}><Plus className="h-4 w-4" /> Add supplier</button></div>}
          {tab === 'returns' && <button type="button" onClick={() => returnableBills[0] && openReturnForm(returnableBills[0])} disabled={!returnableBills.length} className={`${buttonClass} bg-emerald-700 text-white hover:bg-emerald-800`}><RotateCcw className="h-4 w-4" /> New return</button>}
        </div>

        {tab === 'purchases' && <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-stone-50 text-[11px] uppercase tracking-wide text-stone-500"><tr>
              <th className="px-4 py-3">Bill / date</th><th className="px-4 py-3">Supplier</th><th className="px-4 py-3">Total</th><th className="px-4 py-3">Jama</th><th className="px-4 py-3">Baaki</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Due date</th><th className="px-4 py-3 text-right">Actions</th>
            </tr></thead>
            <tbody className="divide-y divide-stone-100">
              {billsQuery.isLoading && <tr><td colSpan={8} className="px-4 py-12 text-center text-stone-500"><LoaderCircle className="mx-auto mb-2 h-5 w-5 animate-spin" />Loading purchase bills…</td></tr>}
              {!billsQuery.isLoading && !bills.length && <tr><td colSpan={8} className="px-4 py-12 text-center text-stone-500">No purchase bills match this filter. Start with a full bill or quick entry.</td></tr>}
              {bills.map((bill) => {
                const supplier = isObjectSupplier(bill.supplierId) ? bill.supplierId : supplierById.get(bill.supplierId);
                return <tr key={bill._id} className="hover:bg-stone-50/70">
                  <td className="px-4 py-3"><button type="button" onClick={() => setSelectedBillId(bill._id)} className="font-bold text-emerald-800 hover:underline">{bill.invoiceNumber}</button><div className="mt-1 text-xs text-stone-500">{new Date(bill.billDate).toLocaleDateString('en-IN')} · {bill.billType === 'QUICK' ? 'Quick entry' : 'Full bill'}</div></td>
                  <td className="px-4 py-3"><div className="font-semibold text-stone-800">{supplier?.name || 'Supplier'}</div><div className="text-xs text-stone-500">{supplier?.mobile || ''}</div></td>
                  <td className="px-4 py-3 font-semibold">{amount(bill.totalAmount)}</td><td className="px-4 py-3 text-emerald-700">{amount(bill.paidAmount - bill.refundedAmount)}</td>
                  <td className="px-4 py-3 font-semibold text-rose-700">{amount(bill.outstandingAmount)}</td>
                  <td className="px-4 py-3">{bill.status === 'CANCELLED' ? <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[11px] font-bold text-stone-600">Cancelled</span> : <StatusBadge status={bill.paymentStatus} />}</td>
                  <td className="px-4 py-3 text-xs text-stone-500">{bill.dueDate ? new Date(bill.dueDate).toLocaleDateString('en-IN') : '—'}</td>
                  <td className="px-4 py-3"><div className="flex justify-end gap-1">
                    <button type="button" title="View bill" onClick={() => setSelectedBillId(bill._id)} className="rounded-lg p-2 text-stone-500 hover:bg-stone-100"><FileText className="h-4 w-4" /></button>
                    <button type="button" title="Print bill" onClick={() => setSelectedBillId(bill._id)} className="rounded-lg p-2 text-stone-500 hover:bg-stone-100"><Printer className="h-4 w-4" /></button>
                    {bill.status === 'ACTIVE' && <>
                      <button type="button" title="Edit bill" onClick={() => void editBill(bill)} className="rounded-lg p-2 text-stone-500 hover:bg-stone-100"><ClipboardList className="h-4 w-4" /></button>
                      <button type="button" title="Record purchase return" onClick={() => openReturnForm(bill)} className="rounded-lg p-2 text-violet-700 hover:bg-violet-50"><RotateCcw className="h-4 w-4" /></button>
                      <button type="button" title="Cancel bill" onClick={() => { setCancelBill(bill); setCancelReason(''); }} className="rounded-lg p-2 text-rose-600 hover:bg-rose-50"><X className="h-4 w-4" /></button>
                    </>}
                  </div></td>
                </tr>;
              })}
            </tbody>
          </table>
          <div className="flex items-center justify-between border-t border-stone-100 px-4 py-3 text-xs text-stone-500">
            <span>{billsQuery.data?.data.meta.total || 0} bills · page {billsQuery.data?.data.meta.page || 1} of {billsQuery.data?.data.meta.totalPages || 1}</span>
            <div className="flex gap-2"><button type="button" disabled={billPage <= 1} onClick={() => setBillPage((page) => page - 1)} className="rounded-lg border border-stone-200 px-3 py-2 disabled:opacity-40">Previous</button><button type="button" disabled={billPage >= (billsQuery.data?.data.meta.totalPages || 1)} onClick={() => setBillPage((page) => page + 1)} className="rounded-lg border border-stone-200 px-3 py-2 disabled:opacity-40">Next</button></div>
          </div>
        </div>}

        {tab === 'suppliers' && <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-stone-50 text-[11px] uppercase tracking-wide text-stone-500"><tr><th className="px-4 py-3">Supplier</th><th className="px-4 py-3">Opening balance</th><th className="px-4 py-3">Purchases</th><th className="px-4 py-3">Payments</th><th className="px-4 py-3">Returns</th><th className="px-4 py-3">Current Baaki</th><th className="px-4 py-3">Next due</th><th className="px-4 py-3 text-right">Actions</th></tr></thead>
            <tbody className="divide-y divide-stone-100">
              {suppliersQuery.isLoading && <tr><td colSpan={8} className="px-4 py-10 text-center text-stone-500">Loading suppliers…</td></tr>}
              {!suppliersQuery.isLoading && !filteredSuppliers.length && <tr><td colSpan={8} className="px-4 py-10 text-center text-stone-500">{suppliers.length ? 'No supplier matches this search.' : 'No suppliers yet. Add a supplier to start recording Kharidi.'}</td></tr>}
              {filteredSuppliers.map((supplier) => <tr key={supplier._id} className="hover:bg-stone-50/70">
                <td className="px-4 py-3"><div className="font-bold text-stone-800">{supplier.name}</div><div className="text-xs text-stone-500">{supplier.mobile}</div></td>
                <td className="px-4 py-3">{amount(supplier.openingBalance)}</td><td className="px-4 py-3">{amount(supplier.totalPurchases)}</td><td className="px-4 py-3">{amount(supplier.totalPayments)}</td><td className="px-4 py-3">{amount(supplier.purchaseReturns)}</td><td className="px-4 py-3 font-bold text-amber-800">{amount(supplier.currentBalance)}</td>
                <td className="px-4 py-3 text-xs text-stone-500">{supplier.nextDueDate ? new Date(supplier.nextDueDate).toLocaleDateString('en-IN') : '—'}</td>
                <td className="px-4 py-3"><div className="flex justify-end gap-2"><button type="button" onClick={() => setLedgerSupplier(supplier)} className="rounded-lg border border-stone-200 px-3 py-2 text-xs font-semibold hover:bg-stone-50">Ledger</button><button type="button" onClick={() => startPayment(supplier)} className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-800">Add payment</button></div></td>
              </tr>)}
            </tbody>
          </table>
        </div>}

        {tab === 'returns' && <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-left text-sm">
            <thead className="bg-stone-50 text-[11px] uppercase tracking-wide text-stone-500"><tr><th className="px-4 py-3">Return date</th><th className="px-4 py-3">Supplier / bill</th><th className="px-4 py-3">Items</th><th className="px-4 py-3">Amount</th><th className="px-4 py-3">Refund status</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Actions</th></tr></thead>
            <tbody className="divide-y divide-stone-100">
              {returnsQuery.isLoading && <tr><td colSpan={7} className="px-4 py-10 text-center text-stone-500">Loading purchase returns…</td></tr>}
              {!returnsQuery.isLoading && !returns.length && <tr><td colSpan={7} className="px-4 py-10 text-center text-stone-500">No purchase returns have been recorded.</td></tr>}
              {returns.map((entry: any) => <tr key={entry._id}>
                <td className="px-4 py-3">{new Date(entry.returnDate).toLocaleDateString('en-IN')}</td>
                <td className="px-4 py-3"><strong>{entry.supplierId?.name || 'Supplier'}</strong><div className="text-xs text-stone-500">{entry.purchaseBillId?.invoiceNumber || 'Bill'}</div></td>
                <td className="px-4 py-3">{entry.items?.map((item: { productName: string; quantity: number; unit: string; stockNote?: string }, index: number) => <div key={`${entry._id}-${index}`}><span>{item.productName} ({item.quantity} {item.unit})</span>{item.stockNote && <div className="text-[11px] text-amber-700">{item.stockNote}</div>}</div>)}</td>
                <td className="px-4 py-3 font-semibold">{amount(entry.returnAmount)}</td><td className="px-4 py-3">{entry.refundStatus}</td>
                <td className="px-4 py-3">{entry.status === 'ACTIVE' ? <span className="text-emerald-700">Active</span> : <span className="text-stone-500">Cancelled</span>}</td>
                <td className="px-4 py-3 text-right">{entry.status === 'ACTIVE' && <button type="button" onClick={() => { setCancelReturnId(entry._id); setCancelReturnReason(''); }} className="rounded-lg px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50">Reverse</button>}</td>
              </tr>)}
            </tbody>
          </table>
        </div>}
      </section>

      {renderBillForm()}

      {supplierFormOpen && <Modal title="Add new supplier" onClose={() => setSupplierFormOpen(false)}>
        <form className="space-y-4" onSubmit={saveSupplier}>
          <p className="rounded-xl bg-stone-50 px-3 py-2 text-xs text-stone-600">Supplier data is private to your wholesaler account. Opening balance is recorded in the ledger.</p>
          <label className={labelClass}>Supplier name<input className={fieldClass} required minLength={2} maxLength={160} value={supplierDraft.name} onChange={(event) => setSupplierDraft({ ...supplierDraft, name: event.target.value })} /></label>
          <label className={labelClass}>Mobile number<input className={fieldClass} required type="tel" pattern="\\+?[1-9][0-9]{7,14}" title="Enter 8 to 15 digits, optionally prefixed by +" value={supplierDraft.mobile} onChange={(event) => setSupplierDraft({ ...supplierDraft, mobile: event.target.value })} /></label>
          <label className={labelClass}>Address<input className={fieldClass} maxLength={500} value={supplierDraft.address} onChange={(event) => setSupplierDraft({ ...supplierDraft, address: event.target.value })} /></label>
          <label className={labelClass}>GSTIN (optional)<input className={fieldClass} maxLength={15} value={supplierDraft.gstin} onChange={(event) => setSupplierDraft({ ...supplierDraft, gstin: event.target.value.toUpperCase() })} /></label>
          <label className={labelClass}>Opening balance (Baaki)<input className={fieldClass} type="number" min="0" step="0.01" value={supplierDraft.openingBalance} onChange={(event) => setSupplierDraft({ ...supplierDraft, openingBalance: event.target.value })} /></label>
          <div className="flex justify-end gap-2"><button type="button" onClick={() => setSupplierFormOpen(false)} className={`${buttonClass} border border-stone-200 text-stone-700`}>Cancel</button><button disabled={saving} className={`${buttonClass} bg-emerald-700 text-white`}>{saving ? 'Saving…' : 'Save supplier'}</button></div>
        </form>
      </Modal>}

      {productFormOpen && <Modal title="Add product for this bill" onClose={() => setProductFormOpen(false)}>
        <form className="space-y-4" onSubmit={saveProduct}>
          <p className="rounded-xl bg-blue-50 px-3 py-2 text-xs text-blue-800">The product is created with zero stock. Inventory changes only if “Update inventory automatically” is enabled on the bill.</p>
          <label className={labelClass}>Product name<input className={fieldClass} required value={productDraft.title} onChange={(event) => setProductDraft({ ...productDraft, title: event.target.value })} /></label>
          <label className={labelClass}>SKU<input className={fieldClass} required value={productDraft.sku} onChange={(event) => setProductDraft({ ...productDraft, sku: event.target.value })} /></label>
          <label className={labelClass}>Main category<select className={fieldClass} required value={productDraft.categoryId} onChange={(event) => setProductDraft({ ...productDraft, categoryId: event.target.value })}><option value="">Select category</option>{mainCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={labelClass}>Retailer selling price<input className={fieldClass} type="number" min="0" step="0.01" required value={productDraft.sellingPrice} onChange={(event) => setProductDraft({ ...productDraft, sellingPrice: event.target.value })} /></label>
            <label className={labelClass}>Unit<input className={fieldClass} value={productDraft.unit} onChange={(event) => setProductDraft({ ...productDraft, unit: event.target.value })} /></label>
          </div>
          <div className="flex justify-end gap-2"><button type="button" onClick={() => setProductFormOpen(false)} className={`${buttonClass} border border-stone-200 text-stone-700`}>Cancel</button><button disabled={saving} className={`${buttonClass} bg-emerald-700 text-white`}>{saving ? 'Saving…' : 'Create product'}</button></div>
        </form>
      </Modal>}

      {paymentSupplier && <Modal title={`Add payment · ${paymentSupplier.name}`} onClose={() => setPaymentSupplier(null)}>
        <form className="space-y-4" onSubmit={savePayment}>
          <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">Current supplier balance: <strong>{amount(paymentSupplier.currentBalance)}</strong>. Payment is first allocated to the oldest open bills.</p>
          <label className={labelClass}>Payment amount<input className={fieldClass} type="number" min="0.01" step="0.01" required value={paymentForm.amount} onChange={(event) => setPaymentForm({ ...paymentForm, amount: event.target.value })} /></label>
          <div className="grid gap-3 sm:grid-cols-2"><label className={labelClass}>Payment date<input className={fieldClass} type="date" required value={paymentForm.paymentDate} onChange={(event) => setPaymentForm({ ...paymentForm, paymentDate: event.target.value })} /></label><label className={labelClass}>Mode<select className={fieldClass} value={paymentForm.paymentMode} onChange={(event) => setPaymentForm({ ...paymentForm, paymentMode: event.target.value as PurchasePaymentMode })}>{paymentModes.map((mode) => <option key={mode.value} value={mode.value}>{mode.label}</option>)}</select></label></div>
          <label className={labelClass}>Notes<textarea className={fieldClass} rows={2} value={paymentForm.notes} onChange={(event) => setPaymentForm({ ...paymentForm, notes: event.target.value })} /></label>
          <div className="flex justify-end gap-2"><button type="button" onClick={() => setPaymentSupplier(null)} className={`${buttonClass} border border-stone-200 text-stone-700`}>Cancel</button><button disabled={saving} className={`${buttonClass} bg-emerald-700 text-white`}>{saving ? 'Saving…' : 'Record payment'}</button></div>
        </form>
      </Modal>}

      {ledgerSupplier && <Modal title={`Supplier Khata · ${ledgerSupplier.name}`} onClose={() => setLedgerSupplier(null)} wide>
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-stone-50 p-4">
            <div><p className="text-xs text-stone-500">Opening balance</p><p className="font-bold">{amount(ledgerSupplier.openingBalance)}</p></div>
            <div><p className="text-xs text-stone-500">Current Baaki</p><p className="text-lg font-bold text-amber-800">{amount(ledgerSupplier.currentBalance)}</p></div>
            <div className="flex flex-wrap gap-2"><button type="button" onClick={downloadStatement} disabled={!ledgerQuery.data?.data.items.length} className={`${buttonClass} border border-stone-200 bg-white text-stone-700`}><FileText className="h-4 w-4" /> Download CSV</button><button type="button" onClick={printStatement} className={`${buttonClass} border border-stone-200 bg-white text-stone-700`}><Printer className="h-4 w-4" /> Print</button><button type="button" onClick={() => startPayment(ledgerSupplier)} className={`${buttonClass} bg-emerald-700 text-white`}><Plus className="h-4 w-4" /> Add payment</button></div>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className={labelClass}>From<input className={fieldClass} type="date" value={ledgerFrom} onChange={(event) => { setLedgerFrom(event.target.value); setLedgerPage(1); }} /></label>
            <label className={labelClass}>To<input className={fieldClass} type="date" value={ledgerTo} onChange={(event) => { setLedgerTo(event.target.value); setLedgerPage(1); }} /></label>
          </div>
          <div className="overflow-x-auto rounded-xl border border-stone-200">
            <table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-stone-50 text-xs uppercase text-stone-500"><tr><th className="px-3 py-3">Date</th><th className="px-3 py-3">Transaction</th><th className="px-3 py-3">Notes</th><th className="px-3 py-3">Amount</th><th className="px-3 py-3">Balance</th></tr></thead><tbody className="divide-y divide-stone-100">
              {ledgerQuery.isLoading && <tr><td colSpan={5} className="p-6 text-center text-stone-500">Loading ledger…</td></tr>}
              {ledgerQuery.error instanceof Error && <tr><td colSpan={5} className="p-6 text-center text-rose-700">Unable to load ledger: {ledgerQuery.error.message}</td></tr>}
              {ledgerQuery.data?.data.items.map((entry) => <tr key={entry._id}><td className="px-3 py-3">{new Date(entry.effectiveDate).toLocaleDateString('en-IN')}</td><td className="px-3 py-3 font-semibold">{entry.type.replace(/_/g, ' ')}</td><td className="px-3 py-3 text-stone-500">{entry.notes || '—'}</td><td className={`px-3 py-3 font-semibold ${entry.amount < 0 ? 'text-emerald-700' : 'text-stone-800'}`}>{entry.amount < 0 ? '−' : '+'}{amount(Math.abs(entry.amount))}</td><td className="px-3 py-3">{amount(entry.balanceAfter)}</td></tr>)}
            </tbody></table>
          </div>
          <div className="flex items-center justify-between text-xs text-stone-500">
            <span>{ledgerQuery.data?.data.meta.total || 0} transactions · page {ledgerQuery.data?.data.meta.page || 1} of {ledgerQuery.data?.data.meta.totalPages || 1}</span>
            <div className="flex gap-2"><button type="button" disabled={ledgerPage <= 1} onClick={() => setLedgerPage((page) => page - 1)} className="rounded-lg border border-stone-200 px-3 py-2 disabled:opacity-40">Previous</button><button type="button" disabled={ledgerPage >= (ledgerQuery.data?.data.meta.totalPages || 1)} onClick={() => setLedgerPage((page) => page + 1)} className="rounded-lg border border-stone-200 px-3 py-2 disabled:opacity-40">Next</button></div>
          </div>
          <div className="overflow-x-auto rounded-xl border border-stone-200">
            <h3 className="px-3 py-3 text-sm font-bold">Payments & reversals</h3>
            <table className="w-full min-w-[600px] text-left text-xs"><thead className="bg-stone-50 uppercase text-stone-500"><tr><th className="px-3 py-2">Date</th><th className="px-3 py-2">Mode</th><th className="px-3 py-2">Amount</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Action</th></tr></thead><tbody className="divide-y divide-stone-100">
              {paymentsQuery.data?.data.map((payment: any) => <tr key={payment._id}><td className="px-3 py-2">{new Date(payment.paymentDate).toLocaleDateString('en-IN')}</td><td className="px-3 py-2">{payment.direction === 'REFUND_RECEIVED' ? 'Supplier refund' : payment.paymentMode}</td><td className="px-3 py-2">{amount(payment.amount)}</td><td className="px-3 py-2">{payment.status}</td><td className="px-3 py-2">{payment.status === 'POSTED' && payment.direction === 'OUTGOING' && <button type="button" onClick={() => setPaymentReverse({ id: payment._id, reason: '' })} className="font-semibold text-rose-700 hover:underline">Reverse</button>}</td></tr>)}
              {!paymentsQuery.data?.data.length && <tr><td colSpan={5} className="p-4 text-center text-stone-500">No supplier payments recorded.</td></tr>}
            </tbody></table>
          </div>
        </div>
      </Modal>}

      {returnBill && <Modal title={`Purchase return · ${returnBill.invoiceNumber}`} onClose={() => setReturnBill(null)}>
        <form className="space-y-4" onSubmit={saveReturn}>
          <label className={labelClass}>Product
            <select className={fieldClass} required value={returnDraft.itemId} onChange={(event) => setReturnDraft({ ...returnDraft, itemId: event.target.value })}>
              <option value="">Select bill item</option>
              {returnBill.items.filter((item) => item.returnedQuantity < item.quantity).map((item) => <option key={item._id} value={item._id}>{item.productName} · {item.quantity - item.returnedQuantity} {item.unit} available</option>)}
            </select>
          </label>
          <div className="grid gap-3 sm:grid-cols-2"><label className={labelClass}>Return quantity<input className={fieldClass} type="number" required min="0.001" step="0.001" value={returnDraft.quantity} onChange={(event) => setReturnDraft({ ...returnDraft, quantity: event.target.value })} /></label><label className={labelClass}>Return date<input className={fieldClass} type="date" required value={returnDraft.returnDate} onChange={(event) => setReturnDraft({ ...returnDraft, returnDate: event.target.value })} /></label></div>
          <label className={labelClass}>Return reason<select className={fieldClass} value={returnDraft.reason} onChange={(event) => setReturnDraft({ ...returnDraft, reason: event.target.value as typeof returnDraft.reason })}><option value="DAMAGED">Damaged</option><option value="WRONG_PRODUCT">Wrong product</option><option value="EXCESS_QUANTITY">Excess quantity</option><option value="OTHER">Other</option></select></label>
          <label className={labelClass}>Refund status<select className={fieldClass} value={returnDraft.refundStatus} onChange={(event) => setReturnDraft({ ...returnDraft, refundStatus: event.target.value as typeof returnDraft.refundStatus, refundMode: '' })}><option value="PENDING">Pending</option><option value="ADJUSTED">Adjusted in supplier Khata</option><option value="REFUNDED">Refund received</option></select></label>
          {returnDraft.refundStatus === 'REFUNDED' && <label className={labelClass}>Refund received via<select className={fieldClass} required value={returnDraft.refundMode} onChange={(event) => setReturnDraft({ ...returnDraft, refundMode: event.target.value as PurchasePaymentMode })}><option value="">Select mode</option>{paymentModes.map((mode) => <option key={mode.value} value={mode.value}>{mode.label}</option>)}</select></label>}
          <label className={labelClass}>Notes<textarea className={fieldClass} rows={2} value={returnDraft.notes} onChange={(event) => setReturnDraft({ ...returnDraft, notes: event.target.value })} /></label>
          <p className="rounded-xl bg-blue-50 px-3 py-2 text-xs text-blue-800">Stock is reduced only when this bill originally added the quantity and enough of it is still available.</p>
          <div className="flex justify-end gap-2"><button type="button" onClick={() => setReturnBill(null)} className={`${buttonClass} border border-stone-200 text-stone-700`}>Cancel</button><button disabled={saving || !returnDraft.itemId} className={`${buttonClass} bg-emerald-700 text-white`}>{saving ? 'Saving…' : 'Confirm return'}</button></div>
        </form>
      </Modal>}

      {selectedBillId && <Modal title={detailBill ? `Purchase bill · ${detailBill.invoiceNumber}` : 'Purchase bill'} onClose={() => setSelectedBillId(null)}>
        {selectedBillQuery.isLoading ? <div className="py-8 text-center text-stone-500"><LoaderCircle className="mx-auto h-5 w-5 animate-spin" /></div> : selectedBillQuery.error instanceof Error ? <p role="alert" className="text-sm text-rose-700">Unable to load bill: {selectedBillQuery.error.message}</p> : detailBill && <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-sm font-semibold text-stone-800">{typeof detailBill.supplierId === 'object' ? detailBill.supplierId.name : supplierById.get(detailBill.supplierId)?.name}</p><p className="text-xs text-stone-500">{new Date(detailBill.billDate).toLocaleDateString('en-IN')} · {detailBill.billType === 'FULL' ? 'Full bill' : 'Quick entry'}</p></div><button type="button" onClick={() => printBill(detailBill)} className={`${buttonClass} border border-stone-200 bg-white text-stone-700`}><Printer className="h-4 w-4" /> Print</button></div>
          <div className="overflow-x-auto rounded-xl border border-stone-200"><table className="w-full text-left text-sm"><thead className="bg-stone-50 text-xs text-stone-500"><tr><th className="px-3 py-2">Product</th><th className="px-3 py-2">Qty</th><th className="px-3 py-2">Rate</th><th className="px-3 py-2">GST</th><th className="px-3 py-2">Total</th></tr></thead><tbody>{detailBill.items.map((item) => <tr key={item._id} className="border-t border-stone-100"><td className="px-3 py-3">{item.productName}</td><td className="px-3 py-3">{item.quantity} {item.unit}</td><td className="px-3 py-3">{amount(item.purchaseRate)}</td><td className="px-3 py-3">{item.gstPercent}% · {amount(item.gstAmount)}</td><td className="px-3 py-3 font-semibold">{amount(item.itemTotal)}</td></tr>)}</tbody></table></div>
          <dl className="space-y-2 rounded-xl bg-stone-50 p-4 text-sm">
            <div className="flex justify-between"><dt>Subtotal</dt><dd>{amount(detailBill.subtotal)}</dd></div><div className="flex justify-between"><dt>GST</dt><dd>{amount(detailBill.gstTotal)}</dd></div><div className="flex justify-between"><dt>Additional charges</dt><dd>{amount(detailBill.transportCharges + detailBill.loadingCharges)}</dd></div><div className="flex justify-between"><dt>Discount</dt><dd>−{amount(detailBill.discountAmount)}</dd></div><div className="flex justify-between border-t border-stone-200 pt-2 font-bold"><dt>Total</dt><dd>{amount(detailBill.totalAmount)}</dd></div>            <div className="flex justify-between text-emerald-700"><dt>Net Jama</dt><dd>{amount(detailBill.paidAmount - detailBill.refundedAmount)}</dd></div>{detailBill.refundedAmount > 0 && <div className="flex justify-between text-violet-700"><dt>Refund received</dt><dd>{amount(detailBill.refundedAmount)}</dd></div>}<div className="flex justify-between text-rose-700"><dt>Baaki</dt><dd>{amount(detailBill.outstandingAmount)}</dd></div>
          </dl>
          {detailBill.notes && <p className="text-sm text-stone-600">Notes: {detailBill.notes}</p>}
          <div className="flex justify-end gap-2">{detailBill.status === 'ACTIVE' && <><button type="button" onClick={() => { setSelectedBillId(null); void editBill(detailBill); }} className={`${buttonClass} border border-stone-200 text-stone-700`}>Edit bill</button><button type="button" onClick={() => { setSelectedBillId(null); const supplier = supplierById.get(detailSupplierId || ''); if (supplier) startPayment(supplier); }} className={`${buttonClass} bg-emerald-700 text-white`}>Add payment</button></>}</div>
        </div>}
      </Modal>}

      {cancelBill && <Modal title={`Cancel bill ${cancelBill.invoiceNumber}`} onClose={() => setCancelBill(null)}>
        <form className="space-y-4" onSubmit={confirmCancelBill}>
          <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">Cancellation creates an audit record and reverses the stock/ledger effect. Reverse or settle recorded payments first.</p>
          <label className={labelClass}>Cancellation reason<textarea className={fieldClass} minLength={3} maxLength={500} required value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} /></label>
          <div className="flex justify-end gap-2"><button type="button" onClick={() => setCancelBill(null)} className={`${buttonClass} border border-stone-200 text-stone-700`}>Keep bill</button><button disabled={saving} className={`${buttonClass} bg-rose-700 text-white`}>{saving ? 'Cancelling…' : 'Cancel bill'}</button></div>
        </form>
      </Modal>}

      {cancelReturnId && <Modal title="Reverse purchase return" onClose={() => setCancelReturnId(null)}>
        <form className="space-y-4" onSubmit={confirmCancelReturn}>
          <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">This keeps the return history and adds ledger/stock reversal entries.</p>
          <label className={labelClass}>Reversal reason<textarea className={fieldClass} minLength={3} maxLength={500} required value={cancelReturnReason} onChange={(event) => setCancelReturnReason(event.target.value)} /></label>
          <div className="flex justify-end gap-2"><button type="button" onClick={() => setCancelReturnId(null)} className={`${buttonClass} border border-stone-200 text-stone-700`}>Back</button><button disabled={saving} className={`${buttonClass} bg-rose-700 text-white`}>Reverse return</button></div>
        </form>
      </Modal>}

      {paymentReverse && <Modal title="Reverse supplier payment" onClose={() => setPaymentReverse(null)}>
        <form className="space-y-4" onSubmit={confirmPaymentReverse}>
          <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">Reversal is a separate transaction. The original payment remains in history.</p>
          <label className={labelClass}>Reason<textarea className={fieldClass} minLength={3} maxLength={500} required value={paymentReverse.reason} onChange={(event) => setPaymentReverse({ ...paymentReverse, reason: event.target.value })} /></label>
          <div className="flex justify-end gap-2"><button type="button" onClick={() => setPaymentReverse(null)} className={`${buttonClass} border border-stone-200 text-stone-700`}>Cancel</button><button disabled={saving} className={`${buttonClass} bg-rose-700 text-white`}>Confirm reversal</button></div>
        </form>
      </Modal>}
    </main>
  );
}
