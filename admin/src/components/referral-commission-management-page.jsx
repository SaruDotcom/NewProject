import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { api, apiGet, apiPatch, apiPut } from "@/lib/api";
import { useAdminBreadcrumb } from "@/components/admin-shell";

const emptySummary = {
  totalReferringWholesalers: 0,
  totalReferredWholesalers: 0,
  totalCommissionGenerated: 0,
  pendingCommission: 0,
  approvedCommission: 0,
  processingCommission: 0,
  totalCommissionPaid: 0,
};

const money = (value) => `₹${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const date = (value) => value
  ? new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
  : "—";

const statusClass = {
  PENDING: "bg-amber-100 text-amber-800",
  APPROVED: "bg-sky-100 text-sky-800",
  PROCESSING: "bg-violet-100 text-violet-800",
  PAID: "bg-emerald-100 text-emerald-800",
  REJECTED: "bg-red-100 text-red-800",
};

export function ReferralCommissionManagementPage() {
  useAdminBreadcrumb("Referral & Commission Management");
  const [summary, setSummary] = useState(emptySummary);
  const [items, setItems] = useState([]);
  const [commissionAmount, setCommissionAmount] = useState("300");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState("");
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [paymentTarget, setPaymentTarget] = useState(null);
  const [bankDetails, setBankDetails] = useState(null);
  const [transactionReference, setTransactionReference] = useState("");
  const [loadingBankDetails, setLoadingBankDetails] = useState(false);

  const params = useMemo(() => {
    const query = new URLSearchParams({ page: String(page), limit: "10" });
    if (status !== "all") query.set("status", status);
    return query.toString();
  }, [page, status]);

  const refresh = () => setRefreshKey((value) => value + 1);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    Promise.all([
      apiGet("/admin/referral-program/summary"),
      apiGet(`/admin/referral-program?${params}`),
      apiGet("/admin/referral-program/settings"),
    ])
      .then(([nextSummary, result, nextSettings]) => {
        if (!active) return;
        setSummary(nextSummary || emptySummary);
        setItems(result?.items || []);
        setPagination(result?.pagination || { total: 0, totalPages: 0 });
        setCommissionAmount(String(nextSettings?.commissionAmount ?? 300));
      })
      .catch((fetchError) => {
        if (active) setError(fetchError.message || "Unable to load referral commissions.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [params, refreshKey]);

  const saveSettings = async (event) => {
    event.preventDefault();
    setSavingSettings(true);
    try {
      const result = await apiPut("/admin/referral-program/settings", {
        commissionAmount: Number(commissionAmount),
      });
      setCommissionAmount(String(result.commissionAmount));
      toast.success("Referral commission amount saved.");
      refresh();
    } catch (saveError) {
      toast.error(saveError.message || "Unable to save referral commission amount.");
    } finally {
      setSavingSettings(false);
    }
  };

  const review = async (id, decision, reason) => {
    setBusyId(id);
    try {
      await apiPatch(`/admin/referral-program/${id}/review`, { decision, reason });
      toast.success(decision === "approve" ? "Commission approved." : "Commission rejected.");
      setRejectTarget(null);
      setRejectionReason("");
      refresh();
    } catch (reviewError) {
      toast.error(reviewError.message || "Unable to review this commission.");
    } finally {
      setBusyId("");
    }
  };

  const startPayout = async (id) => {
    setBusyId(id);
    try {
      await apiPatch(`/admin/referral-program/${id}/process`, {});
      toast.success("Manual bank payout started. Record it as paid only after the bank transfer succeeds.");
      refresh();
    } catch (payoutError) {
      toast.error(payoutError.message || "Unable to start payout.");
    } finally {
      setBusyId("");
    }
  };

  const openPayment = async (item) => {
    setPaymentTarget(item);
    setBankDetails(null);
    setTransactionReference("");
    setLoadingBankDetails(true);
    try {
      const response = await api.get(
        `/admin/referral-program/${item.id}/payout-details`,
        { cache: "no-store" },
      );
      setBankDetails(response?.data || response);
    } catch (detailsError) {
      toast.error(detailsError.message || "Unable to load approved payout bank details.");
      setPaymentTarget(null);
    } finally {
      setLoadingBankDetails(false);
    }
  };

  const markPaid = async (event) => {
    event.preventDefault();
    if (!paymentTarget) return;
    setBusyId(paymentTarget.id);
    try {
      await apiPatch(`/admin/referral-program/${paymentTarget.id}/paid`, { transactionReference });
      toast.success("Manual bank payment recorded.");
      setPaymentTarget(null);
      setBankDetails(null);
      setTransactionReference("");
      refresh();
    } catch (paymentError) {
      toast.error(paymentError.message || "Unable to record bank payment.");
    } finally {
      setBusyId("");
    }
  };

  const statCards = [
    ["Total Referring Wholesalers", summary.totalReferringWholesalers],
    ["Total Referred Wholesalers", summary.totalReferredWholesalers],
    ["Total Commission Generated", money(summary.totalCommissionGenerated)],
    ["Pending Commission", money(summary.pendingCommission)],
    ["Approved Commission", money(summary.approvedCommission)],
    ["Processing Commission", money(summary.processingCommission)],
    ["Total Commission Paid", money(summary.totalCommissionPaid)],
  ];

  return (
    <main className="space-y-6 p-4 sm:p-6">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Wholesaler growth</p>
        <h1 className="mt-1 text-2xl font-bold">Referral &amp; Commission Management</h1>
        <p className="mt-1 text-sm text-muted-foreground">Review eligible referrals and record manual bank payouts after successful transfers.</p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {statCards.map(([label, value]) => (
          <article key={label} className="rounded-xl border bg-card p-4 shadow-sm">
            <p className="text-xs font-semibold text-muted-foreground">{label}</p>
            <p className="mt-2 text-xl font-bold">{value}</p>
          </article>
        ))}
      </section>

      <form onSubmit={saveSettings} className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-end">
        <label className="grid flex-1 gap-1 text-sm font-semibold">
          Commission per KYC-approved referral
          <span className="relative">
            <span className="absolute left-3 top-2.5 text-sm text-muted-foreground">₹</span>
            <input
              type="number"
              min="0.01"
              max="1000000"
              step="0.01"
              required
              value={commissionAmount}
              onChange={(event) => setCommissionAmount(event.target.value)}
              className="h-10 w-full rounded-md border bg-background pl-7 pr-3 text-sm"
            />
          </span>
        </label>
        <button type="submit" disabled={savingSettings} className="h-10 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50">
          {savingSettings ? "Saving…" : "Save commission"}
        </button>
        <p className="text-xs text-muted-foreground sm:max-w-sm">This amount applies to referrals that become eligible after the setting is saved. Existing commissions keep their recorded amount.</p>
      </form>

      <section className="overflow-hidden rounded-xl border bg-card">
        <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-bold">Wholesaler Referrals</h2>
            <p className="mt-1 text-xs text-muted-foreground">Bank account numbers are masked here. Full approved details are revealed only on demand and audited.</p>
          </div>
          <div className="flex gap-2">
            <select
              value={status}
              onChange={(event) => { setStatus(event.target.value); setPage(1); }}
              className="h-9 rounded-md border bg-background px-3 text-sm"
              aria-label="Filter referrals by commission status"
            >
              <option value="all">All statuses</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="PROCESSING">Processing</option>
              <option value="PAID">Paid</option>
              <option value="REJECTED">Rejected</option>
            </select>
            <button type="button" onClick={refresh} className="h-9 rounded-md border px-3 text-sm font-semibold">Refresh</button>
          </div>
        </div>
        {error && <p role="alert" className="m-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {loading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading referral commissions…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1200px] text-left text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-3">Referring Wholesaler</th>
                  <th className="px-3 py-3">Referred Wholesaler</th>
                  <th className="px-3 py-3">Referral Date</th>
                  <th className="px-3 py-3">Commission</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Payment Details</th>
                  <th className="px-3 py-3">Transaction</th>
                  <th className="px-3 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-3 py-3">
                      <p className="font-semibold">{item.referrer.businessName || item.referrer.name}</p>
                      <p className="font-mono text-[10px] text-muted-foreground">{item.referrer.id}</p>
                    </td>
                    <td className="px-3 py-3">
                      <p className="font-semibold">{item.referred.businessName || item.referred.name}</p>
                      <p className="font-mono text-[10px] text-muted-foreground">{item.referred.id}</p>
                    </td>
                    <td className="px-3 py-3">{date(item.referralDate)}</td>
                    <td className="px-3 py-3 font-semibold">{money(item.commissionAmount)}</td>
                    <td className="px-3 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass[item.commissionStatus] || ""}`}>
                        {item.commissionStatus}
                      </span>
                      {item.rejectionReason && <p className="mt-1 max-w-48 text-xs text-red-700">{item.rejectionReason}</p>}
                    </td>
                    <td className="px-3 py-3">
                      {item.paymentDetails.bankDetailsAvailable ? (
                        <>
                          <p>{item.paymentDetails.bankName}</p>
                          <p className="text-xs text-muted-foreground">{item.paymentDetails.accountNumber} · {item.paymentDetails.ifscCode}</p>
                          {["APPROVED", "PROCESSING"].includes(item.commissionStatus) && (
                            <button type="button" onClick={() => void openPayment(item)} className="mt-1 text-xs font-semibold text-primary underline">View full details</button>
                          )}
                        </>
                      ) : <span className="text-xs text-amber-700">Complete bank details and approved KYC required</span>}
                    </td>
                    <td className="px-3 py-3">
                      <p>{date(item.paymentDate)}</p>
                      <p className="max-w-40 break-all text-xs text-muted-foreground">{item.transactionReference || "—"}</p>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {item.commissionStatus === "PENDING" && (
                          <>
                            <button type="button" disabled={busyId === item.id} onClick={() => void review(item.id, "approve")} className="rounded-md bg-emerald-700 px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-50">Approve</button>
                            <button type="button" disabled={busyId === item.id} onClick={() => { setRejectTarget(item); setRejectionReason(""); }} className="rounded-md border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-700 disabled:opacity-50">Reject</button>
                          </>
                        )}
                        {item.commissionStatus === "APPROVED" && (
                          <>
                            <button type="button" disabled={busyId === item.id || !item.paymentDetails.bankDetailsAvailable} onClick={() => void startPayout(item.id)} className="rounded-md bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50">Start payout</button>
                            <button type="button" disabled={busyId === item.id} onClick={() => { setRejectTarget(item); setRejectionReason(""); }} className="rounded-md border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-700 disabled:opacity-50">Reject</button>
                          </>
                        )}
                        {item.commissionStatus === "PROCESSING" && (
                          <button type="button" disabled={busyId === item.id} onClick={() => void openPayment(item)} className="rounded-md bg-emerald-700 px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-50">Record payment</button>
                        )}
                        {["PAID", "REJECTED"].includes(item.commissionStatus) && <span className="text-xs text-muted-foreground">No action</span>}
                      </div>
                    </td>
                  </tr>
                ))}
                {items.length === 0 && <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-muted-foreground">No referral commissions match this status.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex items-center justify-between border-t px-4 py-3 text-xs text-muted-foreground">
          <span>{pagination.total} commissions</span>
          <div className="flex items-center gap-2">
            <button type="button" disabled={page <= 1 || loading} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded border px-3 py-1.5 disabled:opacity-40">Previous</button>
            <span>Page {page} of {Math.max(1, pagination.totalPages || 1)}</span>
            <button type="button" disabled={page >= pagination.totalPages || loading} onClick={() => setPage((value) => value + 1)} className="rounded border px-3 py-1.5 disabled:opacity-40">Next</button>
          </div>
        </div>
      </section>

      {rejectTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="presentation">
          <form onSubmit={(event) => { event.preventDefault(); void review(rejectTarget.id, "reject", rejectionReason); }} role="dialog" aria-modal="true" aria-labelledby="reject-referral-title" className="w-full max-w-md space-y-4 rounded-xl bg-background p-5 shadow-xl">
            <div>
              <h2 id="reject-referral-title" className="font-bold">Reject referral commission</h2>
              <p className="mt-1 text-sm text-muted-foreground">Provide a reason that will be shown to the referring wholesaler.</p>
            </div>
            <textarea required maxLength={500} value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} className="min-h-24 w-full rounded-md border bg-background p-3 text-sm" />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setRejectTarget(null)} className="rounded-md border px-3 py-2 text-sm">Cancel</button>
              <button type="submit" disabled={busyId === rejectTarget.id} className="rounded-md bg-red-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Confirm rejection</button>
            </div>
          </form>
        </div>
      )}

      {paymentTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="presentation">
          <form onSubmit={markPaid} role="dialog" aria-modal="true" aria-labelledby="referral-payment-title" className="w-full max-w-lg space-y-4 rounded-xl bg-background p-5 shadow-xl">
            <div>
              <h2 id="referral-payment-title" className="font-bold">Manual bank transfer</h2>
              <p className="mt-1 text-sm text-muted-foreground">Transfer {money(paymentTarget.commissionAmount)} to the approved account. Record payment only after your bank confirms success.</p>
            </div>
            {loadingBankDetails ? (
              <p className="rounded-lg bg-muted p-4 text-sm">Loading bank details…</p>
            ) : bankDetails ? (
              <dl className="grid grid-cols-2 gap-3 rounded-lg bg-muted p-4 text-sm">
                <dt className="text-muted-foreground">Account holder</dt><dd className="font-semibold">{bankDetails.accountHolderName}</dd>
                <dt className="text-muted-foreground">Bank</dt><dd className="font-semibold">{bankDetails.bankName}</dd>
                <dt className="text-muted-foreground">Account number</dt><dd className="font-mono font-semibold">{bankDetails.accountNumber}</dd>
                <dt className="text-muted-foreground">IFSC</dt><dd className="font-mono font-semibold">{bankDetails.ifscCode}</dd>
                <dt className="text-muted-foreground">Branch</dt><dd className="font-semibold">{bankDetails.branch || "—"}</dd>
              </dl>
            ) : <p role="alert" className="text-sm text-red-700">Approved bank details are unavailable.</p>}
            {paymentTarget.commissionStatus === "PROCESSING" && (
              <label className="grid gap-1 text-sm font-semibold">
                Bank transaction reference
                <input required minLength={2} maxLength={120} value={transactionReference} onChange={(event) => setTransactionReference(event.target.value)} className="h-10 rounded-md border bg-background px-3 font-normal" />
              </label>
            )}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => { setPaymentTarget(null); setBankDetails(null); }} className="rounded-md border px-3 py-2 text-sm">Close</button>
              {paymentTarget.commissionStatus === "PROCESSING" && (
                <button type="submit" disabled={loadingBankDetails || !bankDetails || busyId === paymentTarget.id} className="rounded-md bg-emerald-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Confirm transfer paid</button>
              )}
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
