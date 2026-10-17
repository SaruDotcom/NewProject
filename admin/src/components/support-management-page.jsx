import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Headphones,
  Mail,
  MessageSquare,
  Phone,
  Search,
  Send,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { KpiCard, PageHeader } from "@/components/admin-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { adminQueryKeys } from "@/lib/query-client";
import { api } from "@/lib/api";

const ticketTypes = [
  "Issue",
  "Request",
  "Feedback",
  "Payment",
  "Order",
  "Product",
  "KYC",
  "Account",
  "Other",
];
const statusOptions = ["Open", "In Progress", "Resolved", "Closed"];
const priorityOptions = ["Low", "Medium", "High"];

const initialFilters = {
  role: "all",
  status: "all",
  type: "all",
  priority: "all",
  startDate: "",
  endDate: "",
  search: "",
};

function ticketId(ticket) {
  return String(ticket?._id || ticket?.id || "");
}

function creatorId(ticket) {
  const id = ticket?.createdBy?.userId || ticket?.creatorId;
  return String(id?._id || id || "");
}

function creatorRoleLabel(ticket) {
  return (ticket?.createdBy?.role || ticket?.creatorRole) === "WHOLESALER"
    ? "Wholesaler"
    : "Retailer";
}

function assignedId(ticket) {
  const id = ticket?.assignedTo;
  return String(id?._id || id || "");
}

function badgeClass(value) {
  const normalized = String(value || "").toLowerCase();
  if (normalized === "high" || normalized === "urgent")
    return "border-rose-500/25 bg-rose-500/10 text-rose-700";
  if (normalized === "resolved" || normalized === "closed")
    return "border-emerald-500/25 bg-emerald-500/10 text-emerald-700";
  if (normalized === "in progress")
    return "border-sky-500/25 bg-sky-500/10 text-sky-700";
  return "border-amber-500/25 bg-amber-500/10 text-amber-800";
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : "—";
}

export function SupportManagementPage() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState(initialFilters);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [reply, setReply] = useState("");
  const [saving, setSaving] = useState(false);

  const params = new URLSearchParams({ page: String(page), limit: "20" });
  Object.entries(appliedFilters).forEach(([key, value]) => {
    if (value && value !== "all") params.set(key, value);
  });
  const listPath = `/admin/support/tickets?${params.toString()}`;
  const ticketsQuery = useQuery({
    queryKey: adminQueryKeys.request("support", listPath),
    queryFn: async () => {
      const response = await api.get(listPath);
      return response.data ?? response;
    },
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });
  const result = ticketsQuery.data || {};
  const rows = result.items || [];
  const stats = result.stats || {};
  const admins = result.admins || [];
  const pagination = result.pagination || { page: 1, totalPages: 1, total: 0 };

  const applyFilters = (event) => {
    event.preventDefault();
    setPage(1);
    setAppliedFilters({ ...filters });
  };

  const openTicket = async (ticket) => {
    setDetailLoading(true);
    try {
      const response = await api.get(
        `/admin/support/tickets/${encodeURIComponent(ticketId(ticket))}`,
      );
      setSelected(response.data ?? response);
      setReply("");
    } catch (error) {
      toast.error(error.message || "Could not load ticket details");
    } finally {
      setDetailLoading(false);
    }
  };

  const invalidateTickets = async () => {
    await queryClient.invalidateQueries({
      queryKey: adminQueryKeys.requestResource("support"),
    });
  };

  const updateTicket = async (patch) => {
    if (!selected) return;
    setSaving(true);
    try {
      const response = await api.patch(
        `/admin/support/tickets/${encodeURIComponent(ticketId(selected))}`,
        patch,
      );
      setSelected(response.data ?? response);
      await invalidateTickets();
      toast.success("Support ticket updated");
    } catch (error) {
      toast.error(error.message || "Could not update support ticket");
    } finally {
      setSaving(false);
    }
  };

  const sendReply = async (event) => {
    event.preventDefault();
    if (!selected || !reply.trim()) return;
    setSaving(true);
    try {
      const response = await api.post(
        `/admin/support/tickets/${encodeURIComponent(ticketId(selected))}/reply`,
        { message: reply.trim() },
      );
      setSelected(response.data ?? response);
      setReply("");
      await invalidateTickets();
      toast.success("Reply sent");
    } catch (error) {
      toast.error(error.message || "Could not send reply");
    } finally {
      setSaving(false);
    }
  };

  const profileHref = selected
    ? `/${selected.createdBy?.role === "WHOLESALER" || selected.creatorRole === "WHOLESALER" ? "wholesalers" : "retailers"}/${encodeURIComponent(creatorId(selected))}`
    : "#";
  const orderId =
    selected?.relatedOrderId?._id ||
    selected?.relatedOrderId ||
    selected?.orderId;
  const orderNumber =
    selected?.relatedOrderId?.orderNumber || selected?.orderId?.orderNumber;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Support Requests"
        description="Review and respond to wholesaler and retailer support tickets."
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard label="Total" value={stats.total ?? 0} icon={Headphones} />
        <KpiCard
          label="Open"
          value={stats.open ?? 0}
          icon={AlertCircle}
          tone="warning"
        />
        <KpiCard
          label="In Progress"
          value={stats.inProgress ?? 0}
          icon={MessageSquare}
          tone="info"
        />
        <KpiCard
          label="Resolved"
          value={stats.resolved ?? 0}
          icon={Headphones}
          tone="success"
        />
        <KpiCard
          label="High Priority"
          value={stats.highPriority ?? 0}
          icon={AlertCircle}
          tone="warning"
        />
      </section>

      <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <form
          onSubmit={applyFilters}
          className="grid gap-3 border-b p-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7"
        >
          <div className="relative xl:col-span-2">
            <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <Input
              value={filters.search}
              onChange={(event) =>
                setFilters({ ...filters, search: event.target.value })
              }
              placeholder="Ticket no, business, subject"
              className="pl-9"
            />
          </div>
          <Select
            value={filters.role}
            onValueChange={(value) => setFilters({ ...filters, role: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All roles</SelectItem>
              <SelectItem value="WHOLESALER">Wholesaler</SelectItem>
              <SelectItem value="RETAILER">Retailer</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={filters.status}
            onValueChange={(value) => setFilters({ ...filters, status: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {statusOptions.map((value) => (
                <SelectItem key={value} value={value}>
                  {value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filters.type}
            onValueChange={(value) => setFilters({ ...filters, type: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {ticketTypes.map((value) => (
                <SelectItem key={value} value={value}>
                  {value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filters.priority}
            onValueChange={(value) =>
              setFilters({ ...filters, priority: value })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All priorities</SelectItem>
              {priorityOptions.map((value) => (
                <SelectItem key={value} value={value}>
                  {value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2 xl:col-span-2">
            <Input
              type="date"
              value={filters.startDate}
              onChange={(event) =>
                setFilters({ ...filters, startDate: event.target.value })
              }
              aria-label="Start date"
            />
            <Input
              type="date"
              value={filters.endDate}
              onChange={(event) =>
                setFilters({ ...filters, endDate: event.target.value })
              }
              aria-label="End date"
            />
            <CalendarDays className="hidden size-4 text-muted-foreground xl:block" />
          </div>
          <Button type="submit" className="xl:col-span-7">
            Apply filters
          </Button>
        </form>

        {ticketsQuery.isError ? (
          <div
            role="alert"
            className="p-8 text-center text-sm text-destructive"
          >
            {ticketsQuery.error.message || "Could not load support tickets."}
          </div>
        ) : ticketsQuery.isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Loading support tickets…
          </div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No support tickets match these filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-left text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Ticket No</th>
                  <th className="px-4 py-3">From</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Subject</th>
                  <th className="px-4 py-3">Priority</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3">Last updated</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((ticket) => (
                  <tr
                    key={ticketId(ticket)}
                    onClick={() => openTicket(ticket)}
                    className="cursor-pointer transition-colors hover:bg-muted/40"
                  >
                    <td className="px-4 py-3 font-mono text-xs font-bold text-primary">
                      {ticket.ticketNo}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold">
                        {ticket.businessName ||
                          ticket.contactName ||
                          "Business"}
                      </div>
                      <span className="mt-1 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold">
                        {creatorRoleLabel(ticket)}
                      </span>
                    </td>
                    <td className="px-4 py-3">{ticket.type}</td>
                    <td className="max-w-64 truncate px-4 py-3 font-semibold">
                      {ticket.subject}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full border px-2 py-1 text-xs font-bold ${badgeClass(ticket.priority)}`}
                      >
                        {ticket.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full border px-2 py-1 text-xs font-bold ${badgeClass(ticket.status)}`}
                      >
                        {ticket.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {formatDate(ticket.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {formatDate(ticket.updatedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex items-center justify-between border-t p-3 text-xs text-muted-foreground">
          <span>
            {pagination.total || 0} tickets · Page {pagination.page || page} of{" "}
            {pagination.totalPages || 1}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((current) => current - 1)}
            >
              <ChevronLeft className="size-4" /> Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= (pagination.totalPages || 1)}
              onClick={() => setPage((current) => current + 1)}
            >
              Next <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      </section>

      {selected && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/40"
          onMouseDown={(event) =>
            event.target === event.currentTarget && setSelected(null)
          }
        >
          <aside className="flex h-full w-full max-w-2xl flex-col overflow-y-auto border-l bg-background shadow-2xl">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b bg-background p-5">
              <div>
                <p className="font-mono text-xs font-bold text-primary">
                  {selected.ticketNo}
                </p>
                <h2 className="mt-1 text-lg font-extrabold">
                  {selected.subject}
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {selected.type} · Created {formatDate(selected.createdAt)}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Close ticket details"
                onClick={() => setSelected(null)}
              >
                <X className="size-4" />
              </Button>
            </div>

            {detailLoading ? (
              <p className="p-6 text-sm text-muted-foreground">
                Loading conversation…
              </p>
            ) : (
              <div className="space-y-5 p-5">
                <section className="rounded-xl border bg-card p-4">
                  <h3 className="text-xs font-extrabold uppercase tracking-wide text-muted-foreground">
                    Sender details
                  </h3>
                  <p className="mt-2 font-bold">
                    {selected.businessName || "Business"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {selected.contactName || "Contact not provided"}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm">
                    {selected.phone && (
                      <a
                        href={`tel:${selected.phone}`}
                        className="inline-flex items-center gap-1.5 text-primary hover:underline"
                      >
                        <Phone className="size-4" />
                        {selected.phone}
                      </a>
                    )}
                    {selected.email && (
                      <a
                        href={`mailto:${selected.email}`}
                        className="inline-flex items-center gap-1.5 text-primary hover:underline"
                      >
                        <Mail className="size-4" />
                        {selected.email}
                      </a>
                    )}
                    <a
                      href={profileHref}
                      className="font-semibold text-primary hover:underline"
                    >
                      View {creatorRoleLabel(selected).toLowerCase()} profile
                    </a>
                  </div>
                  {orderId && (
                    <a
                      href={`/orders/${encodeURIComponent(String(orderId?._id || orderId))}`}
                      className="mt-3 inline-block text-sm font-semibold text-primary hover:underline"
                    >
                      Related order {orderNumber ? `· ${orderNumber}` : ""}
                    </a>
                  )}
                </section>

                <section className="grid gap-3 sm:grid-cols-3">
                  <label className="space-y-1 text-xs font-bold text-muted-foreground">
                    Status
                    <Select
                      disabled={saving}
                      value={selected.status}
                      onValueChange={(value) => updateTicket({ status: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {statusOptions.map((value) => (
                          <SelectItem key={value} value={value}>
                            {value}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </label>
                  <label className="space-y-1 text-xs font-bold text-muted-foreground">
                    Priority
                    <Select
                      disabled={saving}
                      value={selected.priority}
                      onValueChange={(value) =>
                        updateTicket({ priority: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {priorityOptions.map((value) => (
                          <SelectItem key={value} value={value}>
                            {value}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </label>
                  <label className="space-y-1 text-xs font-bold text-muted-foreground">
                    Assign to
                    <Select
                      disabled={saving}
                      value={assignedId(selected) || "unassigned"}
                      onValueChange={(value) =>
                        updateTicket({
                          assignedTo: value === "unassigned" ? null : value,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">Unassigned</SelectItem>
                        {admins.map((admin) => (
                          <SelectItem key={admin._id} value={admin._id}>
                            {admin.name} · {admin.role}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </label>
                </section>

                <section>
                  <h3 className="mb-2 text-xs font-extrabold uppercase tracking-wide text-muted-foreground">
                    Original message
                  </h3>
                  <p className="whitespace-pre-wrap rounded-xl border bg-card p-4 text-sm leading-relaxed">
                    {selected.message}
                  </p>
                  {!!selected.attachments?.length && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {selected.attachments.map((attachment) => (
                        <a
                          key={attachment.url}
                          href={attachment.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-semibold text-primary underline"
                        >
                          View attachment
                        </a>
                      ))}
                    </div>
                  )}
                </section>

                <section>
                  <h3 className="mb-2 text-xs font-extrabold uppercase tracking-wide text-muted-foreground">
                    Conversation
                  </h3>
                  <div className="space-y-3">
                    {(selected.replies || []).map((item, index) => (
                      <article
                        key={`${item.createdAt}-${index}`}
                        className="rounded-xl border bg-card p-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                          <span className="font-extrabold">
                            {typeof item.by === "object"
                              ? item.by?.name || item.role
                              : item.role}
                          </span>
                          <time className="text-muted-foreground">
                            {formatDate(item.createdAt)}
                          </time>
                        </div>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">
                          {item.message}
                        </p>
                      </article>
                    ))}
                  </div>
                </section>

                <form onSubmit={sendReply} className="space-y-2 border-t pt-4">
                  <label className="text-xs font-extrabold">
                    Reply to ticket
                  </label>
                  <textarea
                    required
                    maxLength={5000}
                    rows={4}
                    value={reply}
                    onChange={(event) => setReply(event.target.value)}
                    className="w-full rounded-xl border bg-background p-3 text-sm"
                    placeholder="Write a response…"
                  />
                  <Button disabled={saving || !reply.trim()} className="w-full">
                    <Send className="mr-2 size-4" />
                    {saving ? "Sending…" : "Send reply"}
                  </Button>
                </form>
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
