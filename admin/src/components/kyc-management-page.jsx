import { useEffect, useState } from "react";
import {
  Check,
  FileCheck2,
  RefreshCw,
  RotateCcw,
  Search,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader, StatusBadge } from "@/components/admin-ui";
import { apiGet, apiGetKycDocument, apiPatch } from "@/lib/api";
import { toast } from "sonner";

const statusLabels = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  RESUBMISSION_REQUIRED: "Resubmission required",
};

export function KycManagementPage() {
  const [applications, setApplications] = useState([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [selectedId, setSelectedId] = useState("");
  const [reasonAction, setReasonAction] = useState(null);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [documentPreviews, setDocumentPreviews] = useState({});

  const loadApplications = async () => {
    setLoading(true);
    setError("");
    try {
      const query =
        status === "all" ? "" : `?status=${encodeURIComponent(status)}`;
      const payload = await apiGet(`/admin/kyc${query}`);
      const items = Array.isArray(payload)
        ? payload
        : payload?.applications || payload?.items || [];
      setApplications(items);
      setSelectedId((current) =>
        items.some((item) => String(item._id) === current) ? current : "",
      );
    } catch (loadError) {
      setError(loadError.message || "Unable to load KYC applications.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadApplications();
  }, [status]);

  const visibleApplications = applications.filter((application) => {
    const query = search.trim().toLowerCase();
    const wholesaler = application.wholesalerId || {};
    return (
      !query ||
      [
        application.businessName,
        application.ownerName,
        application.pan,
        application.gstin,
        wholesaler.email,
      ].some((value) =>
        String(value || "")
          .toLowerCase()
          .includes(query),
      )
    );
  });
  const selectedApplication = applications.find(
    (item) => String(item._id || item.id || "") === selectedId,
  );
  const selectedDocuments = selectedApplication?.documents || [];
  const documentIdsKey = selectedDocuments
    .map((doc) => String(doc._id || doc.id || (typeof doc === "string" ? doc : "")))
    .filter(Boolean)
    .join(",");

  useEffect(() => {
    if (!selectedId || !documentIdsKey) {
      setDocumentPreviews({});
      return;
    }

    let active = true;
    const objectUrls = [];

    Promise.all(
      selectedDocuments.map(async (document) => {
        const id = String(
          document._id || document.id || (typeof document === "string" ? document : ""),
        );
        if (!id) return null;
        try {
          const blob = await apiGetKycDocument(id);
          if (!active) return null;
          const url = URL.createObjectURL(blob);
          objectUrls.push(url);
          return [id, url];
        } catch {
          return null;
        }
      }),
    ).then((entries) => {
      if (active) setDocumentPreviews(Object.fromEntries(entries.filter(Boolean)));
    });

    return () => {
      active = false;
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [selectedId, documentIdsKey]);

  const approveApplication = async (application) => {
    setActionLoading(true);
    try {
      await apiPatch(`/admin/kyc/${application._id}/approve`, {});
      toast.success(`${application.businessName} approved`);
      await loadApplications();
    } catch (actionError) {
      toast.error(actionError.message || "Unable to approve this application");
    } finally {
      setActionLoading(false);
    }
  };

  const submitReasonAction = async (event) => {
    event.preventDefault();
    if (!reasonAction || !reason.trim()) return;
    setActionLoading(true);
    try {
      const actionPath =
        reasonAction.type === "reject" ? "reject" : "resubmission";
      await apiPatch(
        `/admin/kyc/${reasonAction.application._id}/${actionPath}`,
        { reason: reason.trim() },
      );
      toast.success(
        reasonAction.type === "reject"
          ? "KYC application rejected"
          : "Resubmission requested",
      );
      setReasonAction(null);
      setReason("");
      await loadApplications();
    } catch (actionError) {
      toast.error(actionError.message || "Unable to update this application");
    } finally {
      setActionLoading(false);
    }
  };

  const address = selectedApplication?.registeredAddress || {};
  const bank = selectedApplication?.bankDetails || {};

  return (
    <div className="space-y-6">
      <PageHeader
        title="KYC Review"
        description="Review wholesaler identity and business details before enabling catalog creation."
        action={
          <Button
            variant="outline"
            onClick={loadApplications}
            disabled={loading}
          >
            <RefreshCw /> Refresh
          </Button>
        }
      />

      <section className="admin-card overflow-hidden">
        <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative min-w-56 flex-1">
            <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search business, owner, PAN, or GSTIN"
              className="pl-9 shadow-none"
            />
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: "all", label: "All Requests" },
              { id: "PENDING", label: "Pending Review" },
              { id: "APPROVED", label: "Approved" },
              { id: "REJECTED", label: "Rejected" },
              { id: "RESUBMISSION_REQUIRED", label: "Resubmit Requested" },
            ].map((tab) => (
              <Button
                key={tab.id}
                type="button"
                variant={status === tab.id ? "default" : "outline"}
                size="sm"
                onClick={() => setStatus(tab.id)}
                className="h-8 text-xs"
              >
                {tab.label}
              </Button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-sm text-muted-foreground">
            Loading KYC applications...
          </div>
        ) : error ? (
          <div role="alert" className="p-8 text-sm text-destructive">
            {error}
          </div>
        ) : visibleApplications.length === 0 ? (
          <div className="p-8 text-sm text-muted-foreground">
            No KYC applications found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-xs uppercase text-muted-foreground">
                  <th className="px-4 py-3">Business</th>
                  <th className="px-4 py-3">Owner</th>
                  <th className="px-4 py-3">PAN / GSTIN</th>
                  <th className="px-4 py-3">Submitted</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Review</th>
                </tr>
              </thead>
              <tbody>
                {visibleApplications.map((application, index) => {
                  const appId = String(application._id || application.id || `kyc-${index}`);
                  const wholesaler = application.wholesalerId || {};
                  const approved = application.status === "APPROVED";
                  return (
                    <tr
                      key={appId}
                      className={`border-b last:border-0 ${selectedId === appId ? "bg-muted/30" : ""}`}
                    >
                      <td className="px-4 py-3">
                        <button
                          className="text-left font-semibold hover:text-primary"
                          onClick={() =>
                            setSelectedId((current) =>
                              current === appId ? "" : appId,
                            )
                          }
                        >
                          {application.businessName ||
                            wholesaler.businessName ||
                            "Business"}
                        </button>
                        <span className="block text-xs text-muted-foreground">
                          {wholesaler.email || ""}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {application.ownerName || wholesaler.name || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span className="block">{application.pan || "—"}</span>
                        <span className="text-xs text-muted-foreground">
                          {application.gstin || "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {application.submittedAt
                          ? new Date(
                              application.submittedAt,
                            ).toLocaleDateString("en-IN")
                          : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge
                          status={
                            statusLabels[application.status] ||
                            application.status
                          }
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            onClick={() => approveApplication(application)}
                            disabled={actionLoading || approved}
                            aria-label={`Approve ${application.businessName}`}
                          >
                            <Check /> Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setReasonAction({
                                type: "resubmission",
                                application,
                              });
                              setReason("");
                            }}
                            disabled={actionLoading || approved}
                            aria-label={`Request resubmission from ${application.businessName}`}
                          >
                            <RotateCcw />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              setReasonAction({ type: "reject", application });
                              setReason("");
                            }}
                            disabled={actionLoading || approved}
                            aria-label={`Reject ${application.businessName}`}
                          >
                            <X />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selectedApplication && (
        <section className="admin-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <FileCheck2 className="size-4 text-primary" />
            <h2 className="text-sm font-bold">Application details</h2>
          </div>
          <div className="mb-5">
            <p className="mb-3 text-xs font-bold uppercase text-muted-foreground">
              Identity card images
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                ["PAN_CARD", "PAN card · front"],
                ["AADHAAR_FRONT", "Aadhaar · front"],
                ["AADHAAR_BACK", "Aadhaar · back"],
              ].map(([type, label]) => {
                const document = [...selectedDocuments].reverse().find((item) => item.documentType === type);
                const id = String(document?._id || document?.id || "");
                const preview = documentPreviews[id];
                return (
                  <div key={type} className="overflow-hidden rounded-md border bg-muted/20">
                    <div className="flex aspect-[1.6/1] items-center justify-center bg-muted/50 p-2">
                      {preview && document?.mimeType?.startsWith("image/") ? (
                        <img src={preview} alt={label} className="h-full w-full object-contain" />
                      ) : preview ? (
                        <a href={preview} target="_blank" rel="noreferrer" className="text-sm font-semibold text-primary underline">Open document</a>
                      ) : (
                        <span className="text-xs text-muted-foreground">{document ? "Loading secure preview..." : "Not provided"}</span>
                      )}
                    </div>
                    <p className="truncate border-t px-3 py-2 text-xs font-semibold">{label}</p>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="grid gap-5 border-t pt-5 text-sm md:grid-cols-3">
            <div>
              <p className="mb-2 text-xs font-bold uppercase text-muted-foreground">
                Registered address
              </p>
              <p>{address.street || "—"}</p>
              <p>
                {[address.city, address.state, address.pincode]
                  .filter(Boolean)
                  .join(", ")}
              </p>
            </div>
            <div>
              <p className="mb-2 text-xs font-bold uppercase text-muted-foreground">
                Bank account
              </p>
              <p>{bank.accountHolderName || "—"}</p>
              <p>{bank.bankName || "—"}</p>
              <p>
                {bank.ifscCode || "—"} ·{" "}
                {bank.accountNumber
                  ? `•••• ${bank.accountNumber.slice(-4)}`
                  : "No account number"}
              </p>
            </div>
            <div>
              <p className="mb-2 text-xs font-bold uppercase text-muted-foreground">
                Business details
              </p>
              <p>{selectedApplication.businessType || "—"}</p>
              <p>Documents: {selectedApplication.documents?.length || 0}</p>
              <p>{selectedApplication.reviewReason || "No review note"}</p>
            </div>
          </div>
        </section>
      )}

      {reasonAction && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="presentation"
          onMouseDown={(event) =>
            event.target === event.currentTarget &&
            !actionLoading &&
            setReasonAction(null)
          }
        >
          <form
            onSubmit={submitReasonAction}
            className="w-full max-w-md space-y-4 rounded-md border bg-card p-5 shadow-xl"
          >
            <div>
              <h2 className="font-bold">
                {reasonAction.type === "reject"
                  ? "Reject application"
                  : "Request resubmission"}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {reasonAction.application.businessName}
              </p>
            </div>
            <label className="block space-y-1.5 text-sm font-medium">
              Reason
              <textarea
                required
                autoFocus
                rows={4}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                className="w-full rounded-md border border-input bg-background p-3 text-sm outline-none focus:border-primary"
              />
            </label>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setReasonAction(null)}
                disabled={actionLoading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant={
                  reasonAction.type === "reject" ? "destructive" : "default"
                }
                disabled={actionLoading || !reason.trim()}
              >
                {actionLoading
                  ? "Saving..."
                  : reasonAction.type === "reject"
                    ? "Reject KYC"
                    : "Request resubmission"}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
