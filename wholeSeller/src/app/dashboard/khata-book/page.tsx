import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BookOpen,
  CalendarDays,
  Download,
  FileSpreadsheet,
  FileText,
  LoaderCircle,
  Pencil,
  Plus,
  Printer,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import api, {
  type KhataBusinessType,
  type KhataEntry,
  type KhataEntryInput,
  type KhataSummary,
} from '@/lib/api';
import { useWholesaler } from '@/context/WholesalerContext';
import { wholesalerQueryKeys } from '@/lib/query-client';

type Period = 'DAY' | 'MONTH' | 'YEAR' | 'CUSTOM';

const businessTypes: Array<{ value: KhataBusinessType; label: string }> = [
  { value: 'CLOTHING', label: 'Clothing' },
  { value: 'GENERAL_STORE', label: 'General Store' },
  { value: 'ELECTRONICS', label: 'Electronics' },
  { value: 'FOOTWEAR', label: 'Footwear' },
  { value: 'COSMETICS', label: 'Cosmetics' },
  { value: 'OTHER', label: 'Other business' },
];

const currency = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
});
const amount = (value: number | undefined) => currency.format(Number(value || 0));
const todayString = () => {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
};
const emptySummary: KhataSummary = { totalPurchase: 0, totalPaid: 0, totalPending: 0 };

function blankEntry(): KhataEntryInput {
  return {
    date: todayString(),
    productName: '',
    category: '',
    size: '',
    colour: '',
    unit: '',
    brandModel: '',
    counterpartyName: '',
    quantity: 1,
    purchaseRate: 0,
    paidAmount: 0,
    notes: '',
  };
}

function statusLabel(status: KhataEntry['paymentStatus']) {
  return status === 'PAID' ? 'Paid' : status === 'PARTIAL' ? 'Partial' : 'Pending';
}

function fieldClass() {
  return 'mt-1 w-full rounded-lg border border-tradeflow-gray-200 bg-white px-3 py-2 text-sm font-normal text-tradeflow-navy focus:border-tradeflow-green focus:outline-none focus:ring-2 focus:ring-tradeflow-green/15';
}

function dateValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export default function KhataBookPage() {
  const { profile } = useWholesaler();
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState<Period>('MONTH');
  const [from, setFrom] = useState(() => `${todayString().slice(0, 7)}-01`);
  const [to, setTo] = useState(todayString());
  const [search, setSearch] = useState('');
  const [supplier, setSupplier] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<KhataEntryInput>(blankEntry);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState<'xlsx' | 'pdf' | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [selectedBusinessType, setSelectedBusinessType] = useState<KhataBusinessType>('CLOTHING');
  const [otherBusinessType, setOtherBusinessType] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);
  const [editingBusinessType, setEditingBusinessType] = useState(false);

  const settingsQuery = useQuery({
    queryKey: wholesalerQueryKeys.resource(profile.id || 'unknown', 'khata-book-settings'),
    queryFn: async () => (await api.getKhataSettings()).data,
    enabled: Boolean(profile.id),
  });
  const settings = settingsQuery.data;
  const businessType = settings?.businessType || '';
  const filters = useMemo(() => ({
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
    ...(supplier.trim() ? { counterparty: supplier.trim() } : {}),
    ...(statusFilter ? { paymentStatus: statusFilter } : {}),
    ...(search.trim() ? { search: search.trim() } : {}),
  }), [from, to, supplier, statusFilter, search]);
  const entriesKey = wholesalerQueryKeys.resource(profile.id || 'unknown', 'khata-book', filters);
  const entriesQuery = useQuery({
    queryKey: entriesKey,
    queryFn: () => api.getKhataEntries(filters),
    enabled: Boolean(profile.id && businessType),
  });
  const entries = entriesQuery.data?.data.items || [];
  const summary = entriesQuery.data?.data.summary || emptySummary;

  const refreshEntries = async () => {
    await queryClient.invalidateQueries({
      queryKey: wholesalerQueryKeys.resource(profile.id || 'unknown', 'khata-book'),
    });
  };

  const choosePeriod = (value: Period) => {
    const now = new Date();
    const end = todayString();
    setPeriod(value);
    if (value === 'DAY') {
      setFrom(end);
      setTo(end);
    } else if (value === 'MONTH') {
      setFrom(`${end.slice(0, 7)}-01`);
      setTo(end);
    } else if (value === 'YEAR') {
      setFrom(`${now.getFullYear()}-01-01`);
      setTo(end);
    }
  };

  const saveBusinessType = async (event: React.FormEvent) => {
    event.preventDefault();
    setSavingSettings(true);
    setMessage(null);
    try {
      const saved = await api.updateKhataSettings({
        businessType: selectedBusinessType,
        otherBusinessType: selectedBusinessType === 'OTHER' ? otherBusinessType.trim() : '',
      });
      queryClient.setQueryData(
        wholesalerQueryKeys.resource(profile.id || 'unknown', 'khata-book-settings'),
        saved.data,
      );
      setEditingBusinessType(false);
      setMessage({ type: 'success', text: 'Your Khata Book is ready.' });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unable to save your business type.' });
    } finally {
      setSavingSettings(false);
    }
  };

  const resetForm = () => {
    setForm(blankEntry());
    setEditingId(null);
    setFormOpen(false);
  };

  const openNewEntry = () => {
    setMessage(null);
    setEditingId(null);
    setForm(blankEntry());
    setFormOpen(true);
  };

  const editEntry = (entry: KhataEntry) => {
    setMessage(null);
    setEditingId(entry._id);
    setForm({
      date: entry.date,
      productName: entry.productName || '',
      category: entry.category || '',
      size: entry.size || '',
      colour: entry.colour || '',
      unit: entry.unit || '',
      brandModel: entry.brandModel || '',
      counterpartyName: entry.counterpartyName || '',
      quantity: entry.quantity,
      purchaseRate: entry.purchaseRate,
      paidAmount: entry.paidAmount,
      notes: entry.notes || '',
    });
    setFormOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const saveEntry = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      if (editingId) {
        await api.updateKhataEntry(editingId, form);
        setMessage({ type: 'success', text: 'Purchase entry updated.' });
      } else {
        await api.createKhataEntry(form);
        setMessage({ type: 'success', text: 'Purchase entry saved.' });
      }
      resetForm();
      await refreshEntries();
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unable to save this purchase entry.' });
    } finally {
      setSaving(false);
    }
  };

  const deleteEntry = async (entry: KhataEntry) => {
    if (!window.confirm('Delete this purchase entry?')) return;
    setMessage(null);
    try {
      await api.deleteKhataEntry(entry._id);
      setMessage({ type: 'success', text: 'Purchase entry deleted.' });
      if (editingId === entry._id) resetForm();
      await refreshEntries();
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unable to delete this purchase entry.' });
    }
  };

  const downloadReport = async (format: 'xlsx' | 'pdf') => {
    setExporting(format);
    setMessage(null);
    try {
      const blob = await api.downloadKhataReport(format, filters);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `khata-book-${from || 'all'}-to-${to || 'dates'}.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unable to download this report.' });
    } finally {
      setExporting(null);
    }
  };

  const productLabel = businessType === 'GENERAL_STORE' ? 'Item name' : 'Product name';
  const rateLabel = businessType === 'CLOTHING' || businessType === 'FOOTWEAR'
    ? 'Per piece cost'
    : businessType === 'ELECTRONICS'
      ? 'Unit cost'
      : 'Purchase rate';
  const showCategory = ['CLOTHING', 'GENERAL_STORE', 'OTHER'].includes(businessType);
  const showSizeColour = ['CLOTHING', 'FOOTWEAR', 'OTHER'].includes(businessType);
  const showUnit = ['GENERAL_STORE', 'OTHER'].includes(businessType);
  const showBrand = ['ELECTRONICS', 'COSMETICS', 'OTHER'].includes(businessType);
  const fieldHeaders = [
    { key: 'category', label: 'Category', show: showCategory },
    { key: 'size', label: 'Size', show: showSizeColour },
    { key: 'colour', label: 'Colour', show: showSizeColour },
    { key: 'brandModel', label: businessType === 'ELECTRONICS' ? 'Brand / Model' : 'Brand', show: showBrand },
    { key: 'unit', label: 'Unit', show: showUnit },
  ].filter((field) => field.show);
  const extraSummary = [
    { label: 'Total purchase', value: amount(summary.totalPurchase), color: 'text-tradeflow-navy' },
    { label: 'Total paid', value: amount(summary.totalPaid), color: 'text-emerald-700' },
    { label: 'Total pending', value: amount(summary.totalPending), color: 'text-amber-700' },
  ];

  if (!profile.id || settingsQuery.isLoading) {
    return <div role="status" className="flex items-center justify-center gap-2 p-16 text-sm text-gray-500"><LoaderCircle className="h-5 w-5 animate-spin" /> Opening your Khata Book…</div>;
  }
  if (settingsQuery.error) {
    return <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{settingsQuery.error.message || 'Unable to load your Khata Book settings.'}</div>;
  }

  if (!businessType || editingBusinessType) {
    return (
      <div className="mx-auto max-w-2xl rounded-2xl border border-tradeflow-gray-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-5 flex items-center gap-3">
          <div className="rounded-xl bg-tradeflow-green/10 p-3 text-tradeflow-green"><BookOpen className="h-5 w-5" /></div>
          <div><h1 className="text-2xl font-extrabold text-tradeflow-navy">{businessType ? 'Change business type' : 'Set up your Khata Book'}</h1><p className="mt-1 text-sm text-gray-500">Choose your business type to show the right purchase details.</p></div>
        </div>
        {message && <div role={message.type === 'error' ? 'alert' : 'status'} className={`mb-4 rounded-lg p-3 text-sm ${message.type === 'error' ? 'bg-red-50 text-red-800' : 'bg-emerald-50 text-emerald-800'}`}>{message.text}</div>}
        <form onSubmit={saveBusinessType} className="space-y-4">
          <label className="block text-sm font-semibold text-tradeflow-navy">Business type
            <select value={selectedBusinessType} onChange={(event) => setSelectedBusinessType(event.target.value as KhataBusinessType)} className={fieldClass()}>
              {businessTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
            </select>
          </label>
          {selectedBusinessType === 'OTHER' && <label className="block text-sm font-semibold text-tradeflow-navy">Your business type
            <input required maxLength={80} value={otherBusinessType} onChange={(event) => setOtherBusinessType(event.target.value)} placeholder="For example: Furniture" className={fieldClass()} />
          </label>}
          <p className="rounded-lg bg-blue-50 p-3 text-xs leading-5 text-blue-900">Your business type controls which purchase details appear. Existing purchases stay saved if you change it.</p>
          <button type="submit" disabled={savingSettings} className="inline-flex items-center gap-2 rounded-lg bg-tradeflow-green px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60">
            {savingSettings && <LoaderCircle className="h-4 w-4 animate-spin" />} {businessType ? 'Save business type' : 'Open my Khata Book'}
          </button>
          {businessType && <button type="button" onClick={() => setEditingBusinessType(false)} className="ml-2 rounded-lg border border-tradeflow-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-600">Cancel</button>}
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <style>{`@media print { @page { size: landscape; margin: 10mm; } body * { visibility: hidden !important; } #khata-print-area, #khata-print-area * { visibility: visible !important; } #khata-print-area { position: absolute; inset: 0 auto auto 0; width: 100%; padding: 12px; overflow: visible !important; } #khata-print-area table { min-width: 0 !important; width: 100% !important; font-size: 8px; } #khata-print-area th, #khata-print-area td { padding: 4px !important; } #khata-print-area .overflow-x-auto { overflow: visible !important; } }`}</style>
      <header className="flex flex-col gap-4 border-b border-tradeflow-gray-200 pb-5 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-tradeflow-green/10 p-3 text-tradeflow-green"><BookOpen className="h-5 w-5" /></div>
          <div>
            <h1 className="text-2xl font-extrabold text-tradeflow-navy">Khata Book</h1>
            <p className="mt-1 text-sm text-gray-500">{settings?.businessName || profile.businessName} · {businessType === 'OTHER' ? settings?.otherBusinessType : businessTypes.find((type) => type.value === businessType)?.label} purchase register</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void downloadReport('xlsx')} disabled={Boolean(exporting)} className="inline-flex items-center gap-2 rounded-lg border border-tradeflow-gray-200 bg-white px-3 py-2 text-sm font-semibold text-tradeflow-navy hover:bg-gray-50 disabled:opacity-60">
            {exporting === 'xlsx' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />} Excel
          </button>
          <button type="button" onClick={() => void downloadReport('pdf')} disabled={Boolean(exporting)} className="inline-flex items-center gap-2 rounded-lg border border-tradeflow-gray-200 bg-white px-3 py-2 text-sm font-semibold text-tradeflow-navy hover:bg-gray-50 disabled:opacity-60">
            {exporting === 'pdf' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />} PDF
          </button>
          <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg border border-tradeflow-gray-200 bg-white px-3 py-2 text-sm font-semibold text-tradeflow-navy hover:bg-gray-50">
            <Printer className="h-4 w-4" /> Print
          </button>
          <button type="button" onClick={() => {
            setSelectedBusinessType(settings?.businessType || 'CLOTHING');
            setOtherBusinessType(settings?.otherBusinessType || '');
            setEditingBusinessType(true);
          }} className="rounded-lg border border-tradeflow-gray-200 bg-white px-3 py-2 text-sm font-semibold text-tradeflow-navy hover:bg-gray-50">
            Business type
          </button>
          <button type="button" onClick={openNewEntry} className="inline-flex items-center gap-2 rounded-lg bg-tradeflow-green px-4 py-2 text-sm font-bold text-white hover:bg-tradeflow-green-hover">
            <Plus className="h-4 w-4" /> New Entry
          </button>
        </div>
      </header>

      {message && <div role={message.type === 'error' ? 'alert' : 'status'} className={`rounded-xl border p-3 text-sm ${message.type === 'error' ? 'border-red-200 bg-red-50 text-red-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>{message.text}</div>}
      {entriesQuery.error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{entriesQuery.error.message || 'Unable to load saved purchase entries.'}</div>}

      <section className="rounded-2xl border border-tradeflow-gray-200 bg-white p-4 shadow-sm print:hidden">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-bold text-tradeflow-navy"><CalendarDays className="h-4 w-4" /> Date range</h2>
          <div className="flex flex-wrap gap-1 rounded-lg bg-gray-100 p-1">
            {([['DAY', 'Daily'], ['MONTH', 'Monthly'], ['YEAR', 'Yearly']] as Array<[Period, string]>).map(([value, label]) => (
              <button key={value} type="button" onClick={() => choosePeriod(value)} className={`rounded-md px-3 py-1.5 text-xs font-semibold ${period === value ? 'bg-white text-tradeflow-navy shadow-sm' : 'text-gray-500 hover:text-tradeflow-navy'}`}>{label}</button>
            ))}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1.2fr_1.2fr_1.2fr]">
          <label className="text-xs font-semibold text-gray-500">From
            <input type="date" value={from} max={to || undefined} onChange={(event) => { setFrom(event.target.value); setPeriod('CUSTOM'); }} className={fieldClass()} />
          </label>
          <label className="text-xs font-semibold text-gray-500">To
            <input type="date" value={to} min={from || undefined} onChange={(event) => { setTo(event.target.value); setPeriod('CUSTOM'); }} className={fieldClass()} />
          </label>
          <label className="text-xs font-semibold text-gray-500">Supplier
            <input value={supplier} onChange={(event) => setSupplier(event.target.value)} placeholder="Filter supplier" className={fieldClass()} />
          </label>
          <label className="text-xs font-semibold text-gray-500">Payment status
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className={fieldClass()}>
              <option value="">All statuses</option><option value="PAID">Paid</option><option value="PARTIAL">Partial</option><option value="PENDING">Pending</option>
            </select>
          </label>
          <label className="text-xs font-semibold text-gray-500">Search
            <span className="relative mt-1 block"><Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Product, category, notes" className="w-full rounded-lg border border-tradeflow-gray-200 py-2 pl-9 pr-3 text-sm font-normal text-tradeflow-navy" /></span>
          </label>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        {extraSummary.map((card) => <div key={card.label} className="rounded-2xl border border-tradeflow-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-gray-500">{card.label}</p>
          <p className={`mt-1 text-xl font-extrabold ${card.color}`}>{card.value}</p>
        </div>)}
      </section>

      {formOpen && <form onSubmit={saveEntry} className="space-y-4 rounded-2xl border border-tradeflow-gray-200 bg-white p-5 shadow-sm print:hidden">
        <div className="flex items-center justify-between gap-3">
          <div><h2 className="text-lg font-bold text-tradeflow-navy">{editingId ? 'Edit Entry' : 'New Entry'}</h2></div>
          <button type="button" onClick={resetForm} aria-label="Close form" className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"><X className="h-4 w-4" /></button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm font-semibold text-tradeflow-navy">Date
            <input required type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} className={fieldClass()} />
          </label>
          <label className="text-sm font-semibold text-tradeflow-navy sm:col-span-2">{productLabel}
            <input required maxLength={160} value={form.productName} onChange={(event) => setForm({ ...form, productName: event.target.value })} className={fieldClass()} />
          </label>
          <label className="text-sm font-semibold text-tradeflow-navy">Supplier name
            <input required maxLength={160} value={form.counterpartyName} onChange={(event) => setForm({ ...form, counterpartyName: event.target.value })} className={fieldClass()} />
          </label>
          {showCategory && <label className="text-sm font-semibold text-tradeflow-navy">Category
            <input maxLength={120} value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} className={fieldClass()} />
          </label>}
          {showSizeColour && <label className="text-sm font-semibold text-tradeflow-navy">Size
            <input maxLength={80} value={form.size} onChange={(event) => setForm({ ...form, size: event.target.value })} placeholder="e.g. S, M, L" className={fieldClass()} />
          </label>}
          {showSizeColour && <label className="text-sm font-semibold text-tradeflow-navy">Colour
            <input maxLength={80} value={form.colour} onChange={(event) => setForm({ ...form, colour: event.target.value })} className={fieldClass()} />
          </label>}
          {showBrand && <label className="text-sm font-semibold text-tradeflow-navy">{businessType === 'ELECTRONICS' ? 'Brand / model' : 'Brand'}
            <input maxLength={120} value={form.brandModel} onChange={(event) => setForm({ ...form, brandModel: event.target.value })} className={fieldClass()} />
          </label>}
          <label className="text-sm font-semibold text-tradeflow-navy">Quantity
            <input required type="number" min="0.001" step="0.001" value={form.quantity || ''} onChange={(event) => setForm({ ...form, quantity: Number(event.target.value) })} className={fieldClass()} />
          </label>
          {showUnit && <label className="text-sm font-semibold text-tradeflow-navy">Unit
            <input maxLength={40} value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })} placeholder="e.g. piece, kg" className={fieldClass()} />
          </label>}
          <label className="text-sm font-semibold text-tradeflow-navy">{rateLabel}
            <input required type="number" min="0" step="0.01" value={form.purchaseRate || ''} onChange={(event) => setForm({ ...form, purchaseRate: Number(event.target.value) })} className={fieldClass()} />
          </label>
          <label className="text-sm font-semibold text-tradeflow-navy">Paid amount
            <input required type="number" min="0" max={form.quantity * form.purchaseRate} step="0.01" value={form.paidAmount || ''} onChange={(event) => setForm({ ...form, paidAmount: Number(event.target.value) })} className={fieldClass()} />
          </label>
          <label className="text-sm font-semibold text-tradeflow-navy sm:col-span-2 lg:col-span-4">Notes
            <input maxLength={1000} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Optional notes" className={fieldClass()} />
          </label>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4">
          <p className="text-sm text-gray-600">Total cost: <strong className="text-tradeflow-navy">{amount(form.quantity * form.purchaseRate)}</strong><span className="mx-3 text-gray-300">|</span>Pending: <strong className="text-amber-700">{amount(Math.max(0, form.quantity * form.purchaseRate - form.paidAmount))}</strong></p>
          <div className="flex gap-2">
            <button type="button" onClick={resetForm} className="rounded-lg border border-tradeflow-gray-200 px-4 py-2 text-sm font-semibold text-gray-600">Cancel</button>
            <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-tradeflow-green px-4 py-2 text-sm font-bold text-white disabled:opacity-60">
              {saving && <LoaderCircle className="h-4 w-4 animate-spin" />} Save
            </button>
          </div>
        </div>
      </form>}

      <section id="khata-print-area" className="overflow-hidden rounded-2xl border border-tradeflow-gray-200 bg-white shadow-sm print:rounded-none print:border-0 print:shadow-none">
        <div className="hidden border-b border-gray-200 p-4 print:block">
          <h1 className="text-xl font-bold">{settings?.businessName || profile.businessName || 'Business'}</h1>
          <p className="mt-1 text-sm">Purchase Khata Book · {from || 'All dates'} to {to || 'All dates'}</p>
          <p className="mt-1 text-sm">Total purchase: {amount(summary.totalPurchase)} · Total paid: {amount(summary.totalPaid)} · Total pending: {amount(summary.totalPending)}</p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-tradeflow-gray-200 p-4 print:hidden">
          <div><h2 className="font-bold text-tradeflow-navy">Purchase entries</h2><p className="mt-1 text-xs text-gray-500">Saved securely to your business account.</p></div>
          {entriesQuery.isFetching && <span role="status" className="inline-flex items-center gap-1 text-xs text-gray-500"><LoaderCircle className="h-3.5 w-3.5 animate-spin" /> Updating</span>}
        </div>
        {entriesQuery.isLoading ? <div role="status" className="flex items-center justify-center gap-2 p-12 text-sm text-gray-500"><LoaderCircle className="h-5 w-5 animate-spin" /> Loading saved entries…</div>
          : entries.length === 0 ? <div className="p-10 text-center print:hidden">
            <BookOpen className="mx-auto h-8 w-8 text-gray-300" /><h3 className="mt-3 font-semibold text-tradeflow-navy">Your Khata Book is empty</h3>
            <p className="mt-1 text-sm text-gray-500">Add a purchase entry to start recording your business hisaab.</p>
            <button type="button" onClick={openNewEntry} className="mt-4 rounded-lg bg-tradeflow-green px-4 py-2 text-sm font-bold text-white">New Entry</button>
          </div> : <>
            <div className="overflow-x-auto">
              <table className="min-w-[1050px] w-full border-collapse text-left text-sm">
                <thead className="bg-gray-50 text-xs font-bold uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="border-b border-gray-200 px-3 py-3">Date</th>
                    <th className="border-b border-gray-200 px-3 py-3">{businessType === 'GENERAL_STORE' ? 'Item' : 'Product'}</th>
                    {fieldHeaders.map((field) => <th key={field.key} className="border-b border-gray-200 px-3 py-3">{field.label}</th>)}
                    <th className="border-b border-gray-200 px-3 py-3">Quantity</th>
                    <th className="border-b border-gray-200 px-3 py-3">Supplier</th>
                    <th className="border-b border-gray-200 px-3 py-3">Unit cost</th>
                    <th className="border-b border-gray-200 px-3 py-3">Total cost</th>
                    <th className="border-b border-gray-200 px-3 py-3">Paid</th>
                    <th className="border-b border-gray-200 px-3 py-3">Pending</th>
                    <th className="border-b border-gray-200 px-3 py-3">Status</th>
                    <th className="border-b border-gray-200 px-3 py-3">Notes</th>
                    <th className="border-b border-gray-200 px-3 py-3 print:hidden">Edit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {entries.map((entry) => <tr key={entry._id} className="hover:bg-gray-50/70">
                    <td className="whitespace-nowrap px-3 py-3">{entry.date}</td>
                    <td className="max-w-40 truncate px-3 py-3 font-medium text-tradeflow-navy">{entry.productName}</td>
                    {fieldHeaders.map((field) => <td key={field.key} className="px-3 py-3 text-gray-600">{entry[field.key as keyof KhataEntry] || '—'}</td>)}
                    <td className="px-3 py-3">{entry.quantity}{entry.unit ? ` ${entry.unit}` : ''}</td>
                    <td className="max-w-40 truncate px-3 py-3">{entry.counterpartyName}</td>
                    <td className="whitespace-nowrap px-3 py-3">{amount(entry.purchaseRate)}</td>
                    <td className="whitespace-nowrap px-3 py-3 font-semibold">{amount(entry.purchaseAmount)}</td>
                    <td className="whitespace-nowrap px-3 py-3">{amount(entry.paidAmount)}</td>
                    <td className="whitespace-nowrap px-3 py-3">{amount(entry.pendingAmount)}</td>
                    <td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-xs font-bold ${entry.paymentStatus === 'PAID' ? 'bg-emerald-50 text-emerald-700' : entry.paymentStatus === 'PARTIAL' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`}>{statusLabel(entry.paymentStatus)}</span></td>
                    <td className="max-w-40 truncate px-3 py-3 text-gray-500">{entry.notes || '—'}</td>
                    <td className="px-3 py-3 print:hidden"><div className="flex gap-1">
                      <button type="button" title="Edit entry" onClick={() => editEntry(entry)} className="rounded-md p-1.5 text-gray-500 hover:bg-blue-50 hover:text-blue-700"><Pencil className="h-4 w-4" /></button>
                      <button type="button" title="Delete entry" onClick={() => void deleteEntry(entry)} className="rounded-md p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-700"><Trash2 className="h-4 w-4" /></button>
                    </div></td>
                  </tr>)}
                </tbody>
              </table>
            </div>
            <div className="grid gap-2 border-t border-gray-200 bg-gray-50 p-4 text-sm sm:grid-cols-3">
              <p>Total purchase <strong className="ml-1 text-tradeflow-navy">{amount(summary.totalPurchase)}</strong></p>
              <p>Total paid <strong className="ml-1 text-emerald-700">{amount(summary.totalPaid)}</strong></p>
              <p>Total pending <strong className="ml-1 text-amber-700">{amount(summary.totalPending)}</strong></p>
            </div>
          </>}
      </section>
      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 print:hidden">
        <Download className="h-3.5 w-3.5" /><span>Choose a daily, monthly, yearly or custom date range to download or print your saved entries.</span>
      </div>
    </div>
  );
}
