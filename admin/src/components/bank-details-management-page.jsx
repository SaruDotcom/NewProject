import { useCallback, useEffect, useState } from "react";
import { Check, Clock3, Eye, Landmark, RefreshCw, X } from "lucide-react";
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
  useAdminBreadcrumb("Bank Details Verification");
  const [status, setStatus] = useState("PENDING");
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rejecting, setRejecting] = useState(null);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [selectedDetails, setSelectedDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState("");

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

  const viewDetails = async (item) => {
    setSelectedSubmission(item);
    setSelectedDetails(null);
    setDetailsError("");
    setDetailsLoading(true);
    try {
      const response = await api.get(`/admin/bank-details/${encodeURIComponent(item.wholesalerId)}`);
      setSelectedDetails(response?.data ?? response);
    } catch (detailError) {
      setDetailsError(detailError instanceof Error ? detailError.message : "Unable to load bank details.");
    } finally {
      setDetailsLoading(false);
    }
  };

  useEffect(() => {
    void loadSubmissions();
  }, [loadSubmissions]);

  const review = async (item, action, rejectionReason = "") => {
    setSaving(true);
    try {
      const path = `/admin/bank-details/${encodeURIComponent(item.wholesalerId)}/${action.toLowerCase()}`;
      await apiPatch(path, action === "REJECT" ? { reason: rejectionReason } : {});
      setRejecting(null);
      setSelectedSubmission(null);
      setSelectedDetails(null);
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

      {!loading && !error && submissions.length > 0 && (
        <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
          <table className="w-full min-w-[1180px] border-collapse text-left text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-semibold">Wholesaler</th>
                <th className="px-4 py-3 font-semibold">Business Name</th>
                <th className="px-4 py-3 font-semibold">Bank Name</th>
                <th className="px-4 py-3 font-semibold">Account Holder</th>
                <th className="px-4 py-3 font-semibold">Account Number</th>
                <th className="px-4 py-3 font-semibold">IFSC Code</th>
                <th className="px-4 py-3 font-semibold">Branch</th>
                <th className="px-4 py-3 font-semibold">Submitted</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {submissions.map((item) => {
                const details = item.bankDetails || {};
                const pending = details.verificationStatus === "PENDING";
                return (
                  <tr key={item.wholesalerId}>
                    <td className="px-4 py-3">
                      <p className="font-medium">{item.wholesalerName}</p>
                      <p className="text-xs text-muted-foreground">{item.email}</p>
                    </td>
                    <td className="px-4 py-3">{item.businessName || "—"}</td>
                    <td className="px-4 py-3">{details.bankName || "—"}</td>
                    <td className="px-4 py-3">{details.accountHolderName || "—"}</td>
                    <td className="px-4 py-3 font-mono">{details.accountNumber || "—"}</td>
                    <td className="px-4 py-3 font-mono">{details.ifscCode || "—"}</td>
                    <td className="px-4 py-3">{details.branch || "—"}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{formatDate(details.submittedAt)}</td>
                    <td className="px-4 py-3"><StatusBadge status={details.verificationStatus} /></td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" onClick={() => void viewDetails(item)}>
                          <Eye className="mr-1.5 size-4" /> View Details
                        </Button>
                        {pending && (
                          <>
                            <Button size="sm" disabled={saving} onClick={() => void review(item, "APPROVE")}>
                              <Check className="mr-1.5 size-4" /> Approve
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              disabled={saving}
                              onClick={() => {
                                setRejecting(item);
                                setReason("");
                              }}
                            >
                              <X className="mr-1.5 size-4" /> Reject
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

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

      <Dialog
        open={Boolean(selectedSubmission)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedSubmission(null);
            setSelectedDetails(null);
          }
        }}
      >
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Submitted bank details</DialogTitle>
            <DialogDescription>
              Sensitive information is shown only in this Superadmin review view.
            </DialogDescription>
          </DialogHeader>
          {detailsLoading && <p role="status" className="text-sm text-muted-foreground">Loading details…</p>}
          {detailsError && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{detailsError}</p>}
          {selectedDetails && (
            <>
              <div className="rounded-lg border bg-muted/30 p-4">
                <p className="font-semibold">{selectedDetails.wholesalerName}</p>
                <p className="text-sm text-muted-foreground">
                  {selectedDetails.businessName || "Business name not provided"} · KYC status: {selectedDetails.kycStatus}
                </p>
              </div>
              <dl className="grid gap-4 sm:grid-cols-2">
                <div><dt className="text-xs text-muted-foreground">Account holder</dt><dd className="mt-1 font-medium">{selectedDetails.bankDetails?.accountHolderName || "—"}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Bank name</dt><dd className="mt-1 font-medium">{selectedDetails.bankDetails?.bankName || "—"}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Account number</dt><dd className="mt-1 break-all font-mono font-medium">{selectedDetails.bankDetails?.accountNumber || "—"}</dd></div>
                <div><dt className="text-xs text-muted-foreground">IFSC code</dt><dd className="mt-1 font-medium">{selectedDetails.bankDetails?.ifscCode || "—"}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Branch</dt><dd className="mt-1 font-medium">{selectedDetails.bankDetails?.branch || "—"}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Submitted</dt><dd className="mt-1 font-medium">{formatDate(selectedDetails.bankDetails?.submittedAt)}</dd></div>
              </dl>
              {selectedDetails.bankDetails?.rejectionReason && (
                <p className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
                  Rejection reason: {selectedDetails.bankDetails.rejectionReason}
                </p>
              )}
              {(selectedDetails.bankDetails?.verificationHistory || []).length > 0 && (
                <details>
                  <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                    <Clock3 className="size-4" /> Verification history ({selectedDetails.bankDetails.verificationHistory.length})
                  </summary>
                  <ol className="mt-3 space-y-2 border-l pl-4 text-sm">
                    {selectedDetails.bankDetails.verificationHistory.slice().reverse().map((entry, index) => (
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
            </>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedSubmission(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
