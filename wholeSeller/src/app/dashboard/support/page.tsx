"use client";

import React, { useEffect, useState } from "react";
import {
  AlertCircle,
  Headphones,
  MessageSquare,
  Paperclip,
  Send,
  Ticket,
  Upload,
  X,
} from "lucide-react";
import api from "@/lib/api";

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

interface SupportReply {
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
  replies?: SupportReply[];
}

function ticketId(ticket: SupportTicket) {
  return ticket._id;
}

function statusStyle(status: string) {
  if (status === "Resolved" || status === "Closed")
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (status === "In Progress")
    return "bg-blue-50 text-blue-700 border-blue-200";
  return "bg-amber-50 text-amber-700 border-amber-200";
}

export default function SupportPage() {
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
      .catch((err: any) =>
        setError(err?.message || "Could not load support tickets."),
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
    } catch (err: any) {
      setError(err?.message || "Could not create support ticket.");
    } finally {
      setWorking(false);
    }
  };

  const openTicket = async (ticket: SupportTicket) => {
    setError("");
    try {
      const response = await api.getSupportTicket(ticketId(ticket));
      let opened = response.data as SupportTicket;
      if (opened.unreadForCreator) {
        await api.markSupportTicketRead(ticketId(ticket));
        opened = { ...opened, unreadForCreator: false };
      }
      setSelectedTicket(opened);
      await refreshTickets();
    } catch (err: any) {
      setError(err?.message || "Could not open this ticket.");
    }
  };

  const sendReply = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedTicket || !reply.trim()) return;
    setWorking(true);
    setError("");
    try {
      const response = await api.replySupportTicket(
        ticketId(selectedTicket),
        reply.trim(),
      );
      setSelectedTicket(response.data as SupportTicket);
      setReply("");
      await refreshTickets();
    } catch (err: any) {
      setError(err?.message || "Could not send your reply.");
    } finally {
      setWorking(false);
    }
  };

  const unreadCount = tickets.filter(
    (ticket) => ticket.unreadForCreator,
  ).length;

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-tradeflow-green">
            <Headphones className="h-5 w-5" />
            <span className="text-xs font-extrabold uppercase tracking-wider">
              Support Center
            </span>
          </div>
          <h1 className="mt-1 text-2xl font-extrabold text-tradeflow-navy">
            Help &amp; Support
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Create a support ticket and follow the conversation with our team.
          </p>
        </div>
        {unreadCount > 0 && (
          <span className="rounded-full border border-tradeflow-green/30 bg-tradeflow-green-50 px-3 py-1.5 text-xs font-bold text-tradeflow-navy">
            {unreadCount} new {unreadCount === 1 ? "reply" : "replies"}
          </span>
        )}
      </header>

      {(error || success) && (
        <div
          role={error ? "alert" : "status"}
          className={`flex items-start gap-2 rounded-xl border p-3 text-sm ${error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}
        >
          {error && <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />}
          <span>{error || success}</span>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <section className="rounded-2xl border border-tradeflow-gray-200 bg-white p-5 shadow-xs">
          <h2 className="flex items-center gap-2 font-extrabold text-tradeflow-navy">
            <MessageSquare className="h-4 w-4 text-tradeflow-green" /> Create a
            ticket
          </h2>
          <form onSubmit={createTicket} className="mt-4 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-xs font-bold text-gray-700">
                Type
                <select
                  value={type}
                  onChange={(event) =>
                    setType(event.target.value as TicketType)
                  }
                  className="w-full rounded-xl border border-tradeflow-gray-200 bg-white px-3 py-2.5"
                >
                  {ticketTypes.map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-xs font-bold text-gray-700">
                Priority
                <select
                  value={priority}
                  onChange={(event) => setPriority(event.target.value)}
                  className="w-full rounded-xl border border-tradeflow-gray-200 bg-white px-3 py-2.5"
                >
                  {["Low", "Medium", "High"].map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </select>
              </label>
            </div>
            <label className="block space-y-1 text-xs font-bold text-gray-700">
              Subject
              <input
                required
                maxLength={200}
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                className="w-full rounded-xl border border-tradeflow-gray-200 px-3 py-2.5"
              />
            </label>
            <label className="block space-y-1 text-xs font-bold text-gray-700">
              Message
              <textarea
                required
                maxLength={5000}
                rows={5}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                className="w-full resize-y rounded-xl border border-tradeflow-gray-200 px-3 py-2.5"
              />
            </label>
            <label className="block space-y-1 text-xs font-bold text-gray-700">
              Related order ID{" "}
              <span className="font-normal text-gray-400">(optional)</span>
              <input
                value={relatedOrderId}
                onChange={(event) => setRelatedOrderId(event.target.value)}
                className="w-full rounded-xl border border-tradeflow-gray-200 px-3 py-2.5 font-mono"
              />
            </label>
            <div>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-tradeflow-gray-300 px-3 py-2.5 text-xs font-bold text-gray-700 hover:border-tradeflow-green">
                <Upload className="h-4 w-4 text-tradeflow-green" /> Add images
                (up to 3)
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
                    className="flex items-center justify-between gap-2 text-xs text-gray-500"
                  >
                    <span className="flex min-w-0 items-center gap-1 truncate">
                      <Paperclip className="h-3.5 w-3.5 shrink-0" />
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
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
              <p className="mt-1 text-[11px] text-gray-400">
                JPG, JPEG, PNG, or WEBP · max 5 MB each
              </p>
            </div>
            <button
              disabled={working}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-tradeflow-green px-4 py-3 text-sm font-extrabold text-tradeflow-navy hover:bg-tradeflow-green-hover disabled:opacity-60"
            >
              <Send className="h-4 w-4" />{" "}
              {working ? "Sending…" : "Send to Super Admin"}
            </button>
          </form>
        </section>

        <section className="min-w-0 rounded-2xl border border-tradeflow-gray-200 bg-white p-5 shadow-xs">
          <h2 className="flex items-center gap-2 font-extrabold text-tradeflow-navy">
            <Ticket className="h-4 w-4 text-tradeflow-green" /> My tickets
          </h2>
          {loading ? (
            <p className="py-8 text-center text-sm text-gray-500">
              Loading tickets…
            </p>
          ) : tickets.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-500">
              You have not submitted any support tickets yet.
            </p>
          ) : (
            <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
              {tickets.map((ticket) => (
                <button
                  key={ticketId(ticket)}
                  type="button"
                  onClick={() => openTicket(ticket)}
                  className={`w-full rounded-xl border p-3 text-left transition-colors ${selectedTicket?._id === ticket._id ? "border-tradeflow-green bg-tradeflow-green-50/60" : "border-tradeflow-gray-200 hover:bg-tradeflow-gray-50"}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono text-[11px] font-bold text-gray-500">
                      {ticket.ticketNo}
                    </span>
                    <div className="flex items-center gap-2">
                      {ticket.unreadForCreator && (
                        <span className="rounded-full bg-tradeflow-green px-2 py-0.5 text-[10px] font-bold text-tradeflow-navy">
                          New reply
                        </span>
                      )}
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${statusStyle(ticket.status)}`}
                      >
                        {ticket.status}
                      </span>
                    </div>
                  </div>
                  <p className="mt-1 truncate text-sm font-bold text-tradeflow-navy">
                    {ticket.subject}
                  </p>
                  <p className="mt-1 text-[11px] text-gray-500">
                    {ticket.type} · Updated{" "}
                    {new Date(ticket.updatedAt).toLocaleDateString()}
                  </p>
                </button>
              ))}
            </div>
          )}

          {selectedTicket && (
            <div className="mt-5 border-t border-tradeflow-gray-200 pt-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-mono text-[11px] font-bold text-tradeflow-green">
                    {selectedTicket.ticketNo}
                  </p>
                  <h3 className="mt-1 text-base font-extrabold text-tradeflow-navy">
                    {selectedTicket.subject}
                  </h3>
                </div>
                <span
                  className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${statusStyle(selectedTicket.status)}`}
                >
                  {selectedTicket.status}
                </span>
              </div>
              <div className="mt-3 max-h-64 space-y-3 overflow-y-auto rounded-xl bg-tradeflow-gray-50 p-3">
                {(selectedTicket.replies || []).map((item, index) => (
                  <article
                    key={`${item.createdAt}-${index}`}
                    className="rounded-lg border border-white bg-white p-3"
                  >
                    <div className="flex justify-between gap-2 text-[10px] font-bold text-gray-500">
                      <span>
                        {typeof item.by === "object"
                          ? item.by?.name || item.role
                          : item.role}
                      </span>
                      <time>{new Date(item.createdAt).toLocaleString()}</time>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-gray-800">
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
                      className="text-xs font-semibold text-tradeflow-green underline"
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
                  className="min-w-0 flex-1 rounded-xl border border-tradeflow-gray-200 px-3 py-2.5 text-sm"
                />
                <button
                  disabled={working || !reply.trim()}
                  aria-label="Send reply"
                  className="rounded-xl bg-tradeflow-green px-3 text-tradeflow-navy disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
