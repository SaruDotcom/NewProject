import { useCallback, useEffect, useState } from "react";
import { Check, Clock3, Landmark, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState, PageHeader, StatusBadge } from "@/components/admin-ui";
import { api, apiPatch } from "@/lib/api";
import { useAdminBreadcrumb } from "@/components/admin-shell";

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

export function BankDetailsManagementPage() {
  useAdminBreadcrumb("Bank Verification");
  const [status, setStatus] = useState("PENDING");
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rejecting, setRejecting] = useState(null);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const loadSubmissions = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await api.get(`/admin/bank-details?status=${status}`);
      const payload = response?.data ?? response;
      setSubmissions(Array.isArray(payload) ? payload : payload?.items || []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load bank submissions.");
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void loadSubmissions();
  }, [loadSubmissions]);

  const review = async (item, action, rejectionReason = "") => {
    setSaving(true);
    try {
      const path = `/admin/bank-details/${encodeURIComponent(item.wholesalerId)}/${action.toLowerCase()}`;
      await apiPatch(path, action === "REJECT" ? { reason: rejectionReason } : {});
      setRejecting(null);
      setReason("");
      toast.success(action === "APPROVE" ? "Bank details approved." : "Bank details rejected.");
      await loadSubmissions();
    } catch (reviewError) {
      toast.error(reviewError instanceof Error ? reviewError.message : "Unable to review bank details.");
    } finally {
      setSaving(false);
    }
  };

  const submitRejection = async (event) => {
    event.preventDefault();
    if (!rejecting || !reason.trim()) {
      toast.error("Enter a reason for rejecting these bank details.");
      return;
    }
    await review(rejecting, "REJECT", reason.trim());
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bank Details Verification"
        description="Review wholesaler bank details separately from KYC. Approval never changes the KYC application."
        action={
          <Button variant="outline" onClick={() => void loadSubmissions()} disabled={loading}>
            <RefreshCw className="mr-2 size-4" />
            Refresh
          </Button>
        }
      />

      <div className="flex flex-wrap gap-2">
        {["PENDING", "APPROVED", "REJECTED", "ALL"].map((filter) => (
          <Button
            key={filter}
            variant={status === filter ? "default" : "outline"}
            onClick={() => setStatus(filter)}
          >
            {filter === "ALL" ? "All submissions" : filter[0] + filter.slice(1).toLowerCase()}
          </Button>
        ))}
      </div>

      {error && (
        <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          {error}
          <Button variant="outline" size="sm" className="ml-3" onClick={() => void loadSubmissions()}>
            Retry
          </Button>
        </div>
      )}

      {loading && <p role="status" className="text-sm text-muted-foreground">Loading bank submissions…</p>}
      {!loading && !error && submissions.length === 0 && (
        <EmptyState
          icon={Landmark}
          title="No bank submissions"
          description={status === "PENDING" ? "There are no bank details waiting for review." : "No submissions match this status."}
        />
      )}

      <div className="space-y-4">
        {submissions.map((item) => {
          const details = item.bankDetails || {};
          const history = details.verificationHistory || [];
          const pending = details.verificationStatus === "PENDING";
          return (
            <article key={item.wholesalerId} className="rounded-xl border bg-card p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">{item.businessName || item.wholesalerName}</h2>
                  <p className="text-sm text-muted-foreground">{item.wholesalerName} · {item.email}</p>
                  <p className="mt-1 text-xs text-muted-foreground">KYC status: {item.kycStatus}</p>
                </div>
                <StatusBadge status={details.verificationStatus} />
              </div>

              <dl className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div><dt className="text-xs text-muted-foreground">Account holder</dt><dd className="mt-1 font-medium">{details.accountHolderName || "—"}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Bank name</dt><dd className="mt-1 font-medium">{details.bankName || "—"}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Account number</dt><dd className="mt-1 font-mono font-medium">{details.accountNumber || "—"}</dd></div>
                <div><dt className="text-xs text-muted-foreground">IFSC code</dt><dd className="mt-1 font-medium">{details.ifscCode || "—"}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Branch</dt><dd className="mt-1 font-medium">{details.branch || "—"}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Submitted</dt><dd className="mt-1 font-medium">{formatDate(details.submittedAt)}</dd></div>
              </dl>

              {details.rejectionReason && (
                <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
                  Previous rejection reason: {details.rejectionReason}
                </p>
              )}

              {history.length > 0 && (
                <details className="mt-4">
                  <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                    <Clock3 className="size-4" /> Verification history ({history.length})
                  </summary>
                  <ol className="mt-3 space-y-2 border-l pl-4 text-sm">
                    {history.slice().reverse().map((entry, index) => (
                      <li key={`${entry.status}-${entry.changedAt}-${index}`} className="text-muted-foreground">
                        <span className="font-medium text-foreground">{entry.status}</span>
                        {" · "}{formatDate(entry.changedAt)}
                        {entry.rejectionReason && <span> · {entry.rejectionReason}</span>}
                        {entry.accountNumberLast4 && <span> · Account ending {entry.accountNumberLast4}</span>}
                      </li>
                    ))}
                  </ol>
                </details>
              )}

              {pending && (
                <div className="mt-5 flex flex-wrap gap-2">
                  <Button disabled={saving} onClick={() => void review(item, "APPROVE")}>
                    <Check className="mr-2 size-4" /> Approve
                  </Button>
                  <Button
                    variant="destructive"
                    disabled={saving}
                    onClick={() => {
                      setRejecting(item);
                      setReason("");
                    }}
                  >
                    <X className="mr-2 size-4" /> Reject
                  </Button>
                </div>
              )}
            </article>
          );
        })}
      </div>

      <Dialog open={Boolean(rejecting)} onOpenChange={(open) => !open && setRejecting(null)}>
        <DialogContent>
          <form onSubmit={submitRejection} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Reject bank details</DialogTitle>
              <DialogDescription>
                Provide a reason the wholesaler can use to correct and resubmit the information.
              </DialogDescription>
            </DialogHeader>
            <Textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={500}
              required
              rows={4}
              placeholder="Explain what needs to be corrected"
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRejecting(null)} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" variant="destructive" disabled={saving || !reason.trim()}>
                {saving ? "Submitting…" : "Reject bank details"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
