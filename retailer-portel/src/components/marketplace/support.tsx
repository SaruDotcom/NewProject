import { useEffect, useState } from "react";
import { api } from "@/api/api";

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
] as const;
type TicketType = (typeof ticketTypes)[number];
type IconName =
  | "support"
  | "alert"
  | "chat"
  | "upload"
  | "attachment"
  | "close"
  | "send"
  | "ticket";

function SupportIcon({
  name,
  className,
}: {
  name: IconName;
  className?: string;
}) {
  const icon = {
    support: (
      <>
        <path d="M3 14v-3a9 9 0 0 1 18 0v3" />
        <path d="M5 14h2v5H5a2 2 0 0 1-2-2v-1a2 2 0 0 1 2-2Zm14 0h-2v5h2a2 2 0 0 0 2-2v-1a2 2 0 0 0-2-2ZM12 21h2" />
      </>
    ),
    alert: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v5m0 3h.01" />
      </>
    ),
    chat: (
      <path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H5l1.6-3.2A7.5 7.5 0 1 1 20 11.5Z" />
    ),
    upload: (
      <>
        <path d="M12 16V4m-4 4 4-4 4 4" />
        <path d="M5 14v5h14v-5" />
      </>
    ),
    attachment: (
      <path d="m8 12.5 5.7-5.7a3 3 0 0 1 4.2 4.2l-7.8 7.8a5 5 0 0 1-7.1-7.1l8.5-8.5" />
    ),
    close: <path d="m6 6 12 12M18 6 6 18" />,
    send: (
      <>
        <path d="m22 2-7 20-4-9-9-4Z" />
        <path d="M22 2 11 13" />
      </>
    ),
    ticket: (
      <>
        <path d="M3 8V5h18v3a3 3 0 0 0 0 6v5H3v-5a3 3 0 0 0 0-6Z" />
        <path d="M13 8v2m0 4v2" />
      </>
    ),
  }[name];

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {icon}
    </svg>
  );
}

interface TicketReply {
  by?: string | { name?: string; role?: string };
  role: string;
  message: string;
  createdAt: string;
}

interface SupportTicket {
  _id: string;
  ticketNo: string;
  type: TicketType;
  subject: string;
  message: string;
  priority: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  unreadForCreator?: boolean;
  attachments?: Array<{ url: string; publicId?: string }>;
  replies?: TicketReply[];
}

function ticketStatusStyle(status: string) {
  if (status === "Resolved" || status === "Closed")
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "In Progress")
    return "border-blue-200 bg-blue-50 text-blue-700";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

export function HelpSupportPage() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(
    null,
  );
  const [type, setType] = useState<TicketType>("Issue");
  const [priority, setPriority] = useState("Medium");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [relatedOrderId, setRelatedOrderId] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const refreshTickets = async () => {
    const response = await api.getMySupportTickets();
    setTickets(response.data || []);
  };

  useEffect(() => {
    refreshTickets()
      .catch((err: unknown) =>
        setError(
          err instanceof Error
            ? err.message
            : "Could not load support tickets.",
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  const chooseFiles = (event: React.ChangeEvent<HTMLInputElement>) => {
    const chosen = Array.from(event.target.files || []);
    const invalid = chosen.find(
      (file) =>
        !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
        !/\.(jpe?g|png|webp)$/i.test(file.name) ||
        file.size > 5 * 1024 * 1024,
    );
    if (invalid) {
      setError(
        "Attachments must be JPG, JPEG, PNG, or WEBP images up to 5 MB each.",
      );
      event.target.value = "";
      return;
    }
    if (chosen.length + files.length > 3) {
      setError("You can attach up to 3 images.");
      event.target.value = "";
      return;
    }
    setError("");
    setFiles((current) => [...current, ...chosen]);
    event.target.value = "";
  };

  const createTicket = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    setWorking(true);
    try {
      const uploaded = files.length
        ? await api.uploadSupportAttachments(files)
        : { data: [] };
      const response = await api.submitSupportTicket({
        type,
        subject: subject.trim(),
        message: message.trim(),
        priority,
        relatedOrderId: relatedOrderId.trim() || undefined,
        attachments: uploaded.data || [],
      });
      const created = response.data as SupportTicket;
      setSuccess(`Ticket ${created.ticketNo} was sent to Super Admin Support.`);
      setSubject("");
      setMessage("");
      setRelatedOrderId("");
      setFiles([]);
      setSelectedTicket(created);
      await refreshTickets();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Could not create support ticket.",
      );
    } finally {
      setWorking(false);
    }
  };

  const openTicket = async (ticket: SupportTicket) => {
    setError("");
    try {
      const response = await api.getSupportTicket(ticket._id);
      let opened = response.data as SupportTicket;
      if (opened.unreadForCreator) {
        await api.markSupportTicketRead(ticket._id);
        opened = { ...opened, unreadForCreator: false };
      }
      setSelectedTicket(opened);
      await refreshTickets();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Could not open this ticket.",
      );
    }
  };

  const sendReply = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedTicket || !reply.trim()) return;
    setWorking(true);
    setError("");
    try {
      const response = await api.replySupportTicket(
        selectedTicket._id,
        reply.trim(),
      );
      setSelectedTicket(response.data as SupportTicket);
      setReply("");
      await refreshTickets();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Could not send your reply.",
      );
    } finally {
      setWorking(false);
    }
  };

  const unreadCount = tickets.filter(
    (ticket) => ticket.unreadForCreator,
  ).length;

  return (
    <main className="shell py-8 sm:py-10">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-primary">
            <SupportIcon name="support" className="size-5" />
            <span className="text-xs font-extrabold uppercase tracking-wider">
              Support Center
            </span>
          </div>
          <h1 className="mt-1 text-2xl font-black text-ink">
            Help &amp; Support
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create a ticket and follow the conversation with our team.
          </p>
        </div>
        {unreadCount > 0 && (
          <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-extrabold text-primary">
            {unreadCount} new {unreadCount === 1 ? "reply" : "replies"}
          </span>
        )}
      </header>

      {(error || success) && (
        <div
          role={error ? "alert" : "status"}
          className={`mb-5 flex items-start gap-2 rounded-xl border p-3 text-sm ${error ? "border-destructive/25 bg-destructive/10 text-destructive" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}
        >
          {error && (
            <SupportIcon name="alert" className="mt-0.5 size-4 shrink-0" />
          )}
          <span>{error || success}</span>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h2 className="flex items-center gap-2 font-extrabold text-ink">
            <SupportIcon name="chat" className="size-4 text-primary" /> Create a
            ticket
          </h2>
          <form onSubmit={createTicket} className="mt-4 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-xs font-bold text-foreground">
                Type
                <select
                  value={type}
                  onChange={(event) =>
                    setType(event.target.value as TicketType)
                  }
                  className="w-full rounded-xl border border-input bg-background px-3 py-2.5"
                >
                  {ticketTypes.map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-xs font-bold text-foreground">
                Priority
                <select
                  value={priority}
                  onChange={(event) => setPriority(event.target.value)}
                  className="w-full rounded-xl border border-input bg-background px-3 py-2.5"
                >
                  {["Low", "Medium", "High"].map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </select>
              </label>
            </div>
            <label className="block space-y-1 text-xs font-bold text-foreground">
              Subject
              <input
                required
                maxLength={200}
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                className="w-full rounded-xl border border-input bg-background px-3 py-2.5"
              />
            </label>
            <label className="block space-y-1 text-xs font-bold text-foreground">
              Message
              <textarea
                required
                maxLength={5000}
                rows={5}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                className="w-full resize-y rounded-xl border border-input bg-background px-3 py-2.5"
              />
            </label>
            <label className="block space-y-1 text-xs font-bold text-foreground">
              Related order ID{" "}
              <span className="font-normal text-muted-foreground">
                (optional)
              </span>
              <input
                value={relatedOrderId}
                onChange={(event) => setRelatedOrderId(event.target.value)}
                className="w-full rounded-xl border border-input bg-background px-3 py-2.5 font-mono"
              />
            </label>
            <div>
              <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-dashed border-border px-3 py-2.5 text-xs font-bold text-foreground hover:border-primary">
                <SupportIcon name="upload" className="size-4 text-primary" />{" "}
                Add images (up to 3)
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                  multiple
                  className="sr-only"
                  onChange={chooseFiles}
                />
              </label>
              <div className="mt-2 space-y-1">
                {files.map((file, index) => (
                  <div
                    key={`${file.name}-${index}`}
                    className="flex items-center justify-between gap-2 text-xs text-muted-foreground"
                  >
                    <span className="flex min-w-0 items-center gap-1 truncate">
                      <SupportIcon
                        name="attachment"
                        className="size-3.5 shrink-0"
                      />
                      {file.name}
                    </span>
                    <button
                      type="button"
                      aria-label={`Remove ${file.name}`}
                      onClick={() =>
                        setFiles((current) =>
                          current.filter((_, fileIndex) => fileIndex !== index),
                        )
                      }
                    >
                      <SupportIcon name="close" className="size-4" />
                    </button>
                  </div>
                ))}
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                JPG, JPEG, PNG, or WEBP · max 5 MB each
              </p>
            </div>
            <button
              disabled={working}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-extrabold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              <SupportIcon name="send" className="size-4" />{" "}
              {working ? "Sending…" : "Send to Super Admin"}
            </button>
          </form>
        </section>

        <section className="min-w-0 rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h2 className="flex items-center gap-2 font-extrabold text-ink">
            <SupportIcon name="ticket" className="size-4 text-primary" /> My
            tickets
          </h2>
          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Loading tickets…
            </p>
          ) : tickets.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              You have not submitted any support tickets yet.
            </p>
          ) : (
            <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
              {tickets.map((ticket) => (
                <button
                  key={ticket._id}
                  type="button"
                  onClick={() => openTicket(ticket)}
                  className={`w-full rounded-xl border p-3 text-left transition-colors ${selectedTicket?._id === ticket._id ? "border-primary bg-primary/5" : "border-border hover:bg-accent"}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono text-[11px] font-bold text-muted-foreground">
                      {ticket.ticketNo}
                    </span>
                    <div className="flex items-center gap-2">
                      {ticket.unreadForCreator && (
                        <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
                          New reply
                        </span>
                      )}
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${ticketStatusStyle(ticket.status)}`}
                      >
                        {ticket.status}
                      </span>
                    </div>
                  </div>
                  <p className="mt-1 truncate text-sm font-bold text-ink">
                    {ticket.subject}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {ticket.type} · Updated{" "}
                    {new Date(ticket.updatedAt).toLocaleDateString()}
                  </p>
                </button>
              ))}
            </div>
          )}

          {selectedTicket && (
            <div className="mt-5 border-t border-border pt-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-mono text-[11px] font-bold text-primary">
                    {selectedTicket.ticketNo}
                  </p>
                  <h3 className="mt-1 text-base font-extrabold text-ink">
                    {selectedTicket.subject}
                  </h3>
                </div>
                <span
                  className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${ticketStatusStyle(selectedTicket.status)}`}
                >
                  {selectedTicket.status}
                </span>
              </div>
              <div className="mt-3 max-h-64 space-y-3 overflow-y-auto rounded-xl bg-secondary/40 p-3">
                {(selectedTicket.replies || []).map((item, index) => (
                  <article
                    key={`${item.createdAt}-${index}`}
                    className="rounded-lg border border-border bg-card p-3"
                  >
                    <div className="flex justify-between gap-2 text-[10px] font-bold text-muted-foreground">
                      <span>
                        {typeof item.by === "object"
                          ? item.by?.name || item.role
                          : item.role}
                      </span>
                      <time>{new Date(item.createdAt).toLocaleString()}</time>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">
                      {item.message}
                    </p>
                  </article>
                ))}
              </div>
              {!!selectedTicket.attachments?.length && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {selectedTicket.attachments.map((attachment) => (
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
              <form onSubmit={sendReply} className="mt-3 flex gap-2">
                <input
                  required
                  value={reply}
                  onChange={(event) => setReply(event.target.value)}
                  placeholder="Write a reply…"
                  className="min-w-0 flex-1 rounded-xl border border-input bg-background px-3 py-2.5 text-sm"
                />
                <button
                  disabled={working || !reply.trim()}
                  aria-label="Send reply"
                  className="rounded-xl bg-primary px-3 text-primary-foreground disabled:opacity-50"
                >
                  <SupportIcon name="send" className="size-4" />
                </button>
              </form>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
