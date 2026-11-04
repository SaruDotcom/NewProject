import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Building2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  MessageSquareText,
  RefreshCw,
  Search,
  Send,
  Star,
  Store,
} from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce";
import { Button } from "@/components/ui/button";
import { ConfirmationModal } from "@/components/ui/confirmation-modal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import { toast } from "sonner";

const INITIAL_RESULT = {
  items: [],
  pagination: { page: 1, limit: 10, total: 0, totalPages: 1 },
  summary: {},
};

const SECTIONS = {
  feedback: {
    title: "Wholesaler Feedback to Superadmin",
    description:
      "Direct feedback tickets submitted by wholesalers to the platform team.",
    icon: MessageSquareText,
  },
  wholesalerReviews: {
    title: "Wholesaler Reviews for Retailers",
    description:
      "Partner ratings and comments shared by wholesalers about retailers.",
    icon: Building2,
    reviewerRole: "WHOLESALER",
    recipientRole: "RETAILER",
  },
  retailerReviews: {
    title: "Retailer Reviews for Wholesalers",
    description:
      "Partner ratings and comments shared by retailers about wholesalers.",
    icon: Store,
    reviewerRole: "RETAILER",
    recipientRole: "WHOLESALER",
  },
};

const REVIEW_STATUSES = [
  ["approved", "Published"],
  ["pending", "Pending"],
  ["hidden", "Hidden"],
];
const FEEDBACK_STATUSES = [
  ["Open", "Open"],
  ["In Progress", "In progress"],
  ["Resolved", "Resolved"],
  ["Closed", "Closed"],
];

function getData(response) {
  return response?.data ?? response;
}

function formatDate(value, withTime = false) {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}),
  }).format(date);
}

function statusStyle(status) {
  const value = String(status || "").toLowerCase();
  if (["approved", "resolved", "closed"].includes(value)) {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }
  if (["hidden"].includes(value))
    return "border-stone-200 bg-stone-100 text-stone-600";
  if (["in progress"].includes(value))
    return "border-sky-200 bg-sky-50 text-sky-800";
  return "border-amber-200 bg-amber-50 text-amber-800";
}

function StarRating({ rating, compact = false }) {
  const count = Number(rating);
  if (!Number.isFinite(count) || count < 1 || count > 5) {
    return <span className="text-xs text-stone-400">No rating</span>;
  }

  return (
    <span
      className="inline-flex items-center gap-1.5"
      aria-label={`${count} out of 5 stars`}
    >
      <span className="flex items-center gap-0.5 text-amber-500">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`${compact ? "size-3" : "size-3.5"} ${star <= count ? "fill-current" : "text-stone-200"}`}
          />
        ))}
      </span>
      <span className="text-xs font-semibold text-stone-700">{count}/5</span>
    </span>
  );
}

function identityName(item, isFeedback) {
  return isFeedback
    ? item.businessName || item.contactName || "Wholesaler"
    : item.reviewer?.name || "Business partner";
}

export function ReviewsManagementPage() {
  const [section, setSection] = useState("feedback");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 350);
  const [status, setStatus] = useState("all");
  const [rating, setRating] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [sortOrder, setSortOrder] = useState("desc");
  const [result, setResult] = useState(INITIAL_RESULT);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [confirmation, setConfirmation] = useState(null);
  const [saving, setSaving] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [reply, setReply] = useState("");
  const [replySaving, setReplySaving] = useState(false);

  const activeSection = SECTIONS[section];
  const isFeedback = section === "feedback";
  const statusOptions = isFeedback ? FEEDBACK_STATUSES : REVIEW_STATUSES;
  const averageRating = useMemo(() => {
    const ratings = result.items
      .map((item) => Number(item.rating))
      .filter((value) => value >= 1 && value <= 5);
    return ratings.length
      ? (
          ratings.reduce((sum, value) => sum + value, 0) / ratings.length
        ).toFixed(1)
      : "—";
  }, [result.items]);
  const totalPages = Math.max(1, result.pagination?.totalPages || 1);

  useEffect(() => {
    setPage(1);
  }, [section, debouncedSearch, status, rating, dateFrom, dateTo]);

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({
      page: String(page),
      limit: "10",
      sortOrder,
    });
    if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
    if (status !== "all") params.set("status", status);
    if (rating !== "all") params.set("rating", rating);
    if (dateFrom) params.set(isFeedback ? "startDate" : "dateFrom", dateFrom);
    if (dateTo) params.set(isFeedback ? "endDate" : "dateTo", dateTo);

    if (isFeedback) {
      params.set("role", "WHOLESALER");
      params.set("type", "Feedback");
    } else {
      params.set("sortBy", "createdAt");
      params.set("userRole", activeSection.reviewerRole);
      params.set("recipientRole", activeSection.recipientRole);
    }

    setLoading(true);
    setError("");
    const path = isFeedback
      ? `/admin/support/tickets?${params.toString()}`
      : `/admin/reviews?${params.toString()}`;
    api
      .get(path)
      .then((response) => {
        if (active) setResult(getData(response) || INITIAL_RESULT);
      })
      .catch((loadError) => {
        if (active)
          setError(loadError.message || "Unable to load feedback and reviews.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [
    activeSection,
    dateFrom,
    dateTo,
    debouncedSearch,
    isFeedback,
    page,
    rating,
    refreshKey,
    sortOrder,
    status,
  ]);

  const refresh = () => setRefreshKey((value) => value + 1);

  const openDetails = async (item) => {
    if (!isFeedback) {
      setSelectedItem({ ...item, kind: "review" });
      setReply("");
      return;
    }

    setDetailLoading(true);
    setError("");
    try {
      const response = await api.get(
        `/admin/support/tickets/${encodeURIComponent(item._id || item.id)}`,
      );
      setSelectedItem({ ...getData(response), kind: "feedback" });
      setReply("");
    } catch (detailError) {
      toast.error(detailError.message || "Unable to load feedback details.");
    } finally {
      setDetailLoading(false);
    }
  };

  const runAction = async () => {
    setSaving(true);
    try {
      if (confirmation.kind === "delete") {
        await api.delete(
          `/admin/reviews/${encodeURIComponent(confirmation.id)}`,
        );
      } else {
        await api.patch(
          `/admin/reviews/${encodeURIComponent(confirmation.id)}/status`,
          {
            status: confirmation.status,
          },
        );
      }
      toast.success(
        confirmation.kind === "delete"
          ? "Review deleted"
          : "Review status updated",
      );
      setConfirmation(null);
      setSelectedItem(null);
      refresh();
    } catch (actionError) {
      toast.error(actionError.message || "Review action failed.");
    } finally {
      setSaving(false);
    }
  };

  const sendFeedbackReply = async (event) => {
    event.preventDefault();
    if (!selectedItem || !reply.trim()) return;
    setReplySaving(true);
    try {
      const response = await api.post(
        `/admin/support/tickets/${encodeURIComponent(selectedItem._id)}/reply`,
        { message: reply.trim() },
      );
      setSelectedItem({ ...getData(response), kind: "feedback" });
      setReply("");
      toast.success("Reply sent to wholesaler");
      refresh();
    } catch (replyError) {
      toast.error(replyError.message || "Could not send your reply.");
    } finally {
      setReplySaving(false);
    }
  };

  const exportCsv = () => {
    const fields = isFeedback
      ? [
          "Wholesaler",
          "Email",
          "Category",
          "Subject",
          "Rating",
          "Message",
          "Status",
          "Date",
        ]
      : [
          "Reviewer",
          "Role",
          "Email",
          "Category",
          "Recipient",
          "Rating",
          "Review",
          "Status",
          "Date",
        ];
    const rows = result.items.map((item) =>
      isFeedback
        ? [
            identityName(item, true),
            item.email,
            item.type || "Feedback",
            item.subject,
            item.rating,
            item.message,
            item.status,
            item.createdAt,
          ]
        : [
            item.reviewer?.name,
            item.userRole,
            item.reviewer?.email,
            item.category,
            item.recipient?.name,
            item.rating,
            item.comment,
            item.status,
            item.createdAt,
          ],
    );
    const escape = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const csv = [fields, ...rows]
      .map((row) => row.map(escape).join(","))
      .join("\r\n");
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `${section}-feedback.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Current page exported");
  };

  const renderReviewActions = (item) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          aria-label="Review moderation actions"
          className="h-8 border-stone-200 px-2.5 text-xs text-stone-600"
        >
          Manage
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onSelect={() => setConfirmation({ id: item._id, status: "approved" })}
        >
          Publish review
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => setConfirmation({ id: item._id, status: "pending" })}
        >
          Mark pending
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => setConfirmation({ id: item._id, status: "hidden" })}
        >
          Hide review
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="font-semibold text-destructive"
          onSelect={() => setConfirmation({ id: item._id, kind: "delete" })}
        >
          Delete review
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const renderCard = (item) => {
    const reviewerName = identityName(item, isFeedback);
    const email = isFeedback ? item.email : item.reviewer?.email;
    const category = isFeedback
      ? item.type || "Feedback"
      : item.category || "Partner review";
    const heading = isFeedback
      ? item.subject || "Wholesaler feedback"
      : item.title || "Partner review";
    const comment = isFeedback ? item.message : item.comment;

    return (
      <article
        key={String(item._id || item.id)}
        className="group rounded-2xl border border-stone-200 bg-white p-5 shadow-[0_3px_14px_rgba(29,38,33,0.035)] transition hover:border-stone-300 hover:shadow-[0_8px_24px_rgba(29,38,33,0.07)]"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#edf3ef] text-[#314c3f]">
              {isFeedback ? (
                <Building2 className="size-4" />
              ) : section === "wholesalerReviews" ? (
                <Building2 className="size-4" />
              ) : (
                <Store className="size-4" />
              )}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[#1f3028]">
                {reviewerName}
              </p>
              <p className="truncate text-xs text-stone-500">
                {email ||
                  (isFeedback ? "Wholesaler account" : "Partner account")}
              </p>
            </div>
          </div>
          <span
            className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusStyle(item.status)}`}
          >
            {isFeedback
              ? item.status || "Open"
              : { approved: "Published" }[item.status] ||
                item.status ||
                "Pending"}
          </span>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center rounded-full bg-stone-100 px-2.5 py-1 text-[11px] font-semibold text-stone-600">
            {category}
          </span>
          <div className="flex items-center gap-3">
            <StarRating rating={item.rating} compact />
            <span className="inline-flex items-center gap-1 text-xs text-stone-500">
              <CalendarDays className="size-3.5" /> {formatDate(item.createdAt)}
            </span>
          </div>
        </div>

        {!isFeedback && (
          <div className="mt-3 rounded-xl bg-[#f7f8f6] px-3.5 py-2.5 text-xs text-stone-600">
            <span className="font-semibold text-stone-800">To</span>{" "}
            {item.recipient?.name || "Business partner"}
            {item.recipient?.email ? (
              <span className="text-stone-400"> · {item.recipient.email}</span>
            ) : null}
          </div>
        )}

        <h3 className="mt-4 text-base font-semibold leading-6 text-[#1f3028]">
          {heading}
        </h3>
        <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm leading-6 text-stone-600">
          {comment || "No written comment."}
        </p>

        <div className="mt-5 flex items-center justify-between gap-3 border-t border-stone-100 pt-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => openDetails(item)}
            disabled={detailLoading}
            className="h-8 px-2 text-xs font-semibold text-[#314c3f] hover:bg-[#edf3ef]"
          >
            <Eye className="mr-1.5 size-3.5" /> View details
          </Button>
          {isFeedback ? (
            <span className="text-[11px] text-stone-400">
              {item.ticketNo || "Feedback ticket"}
            </span>
          ) : (
            renderReviewActions(item)
          )}
        </div>
      </article>
    );
  };

  return (
    <div className="space-y-7 pb-8">
      <header className="flex flex-col justify-between gap-4 border-b border-stone-200 pb-6 sm:flex-row sm:items-end">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#718174]">
            Marketplace voice
          </p>
          <h1 className="mt-2 font-serif text-3xl font-semibold tracking-tight text-[#20352a] sm:text-4xl">
            Feedback &amp; Reviews
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-500">
            A considered view of partner experiences and direct feedback from
            the businesses on your platform.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={exportCsv}
            disabled={loading || !result.items.length}
            className="border-stone-300 bg-white"
          >
            <Download className="mr-2 size-4" /> Export page
          </Button>
          <Button
            variant="outline"
            onClick={refresh}
            className="border-stone-300 bg-white"
          >
            <RefreshCw className="mr-2 size-4" /> Refresh
          </Button>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-stone-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
            Matching submissions
          </p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-[#20352a]">
            {result.pagination?.total || 0}
          </p>
          <p className="mt-1 text-xs text-stone-400">
            In this section and filter
          </p>
        </div>
        <div className="rounded-2xl border border-stone-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
            Current page average
          </p>
          <p className="mt-2 flex items-center gap-2 text-2xl font-semibold tabular-nums text-[#20352a]">
            {averageRating}
            <Star className="size-4 fill-amber-400 text-amber-400" />
          </p>
          <p className="mt-1 text-xs text-stone-400">Rated submissions only</p>
        </div>
        <div className="rounded-2xl border border-stone-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
            Section
          </p>
          <p className="mt-2 truncate text-lg font-semibold text-[#20352a]">
            {isFeedback ? "Platform feedback" : "Partner reviews"}
          </p>
          <p className="mt-1 text-xs text-stone-400">
            Records stay separated by recipient
          </p>
        </div>
      </div>

      <section className="space-y-5">
        <Tabs
          value={section}
          onValueChange={(value) => {
            setSection(value);
            setStatus("all");
            setSelectedItem(null);
          }}
        >
          <TabsList className="grid h-auto w-full grid-cols-1 gap-1 rounded-2xl border border-stone-200 bg-[#f5f5f1] p-1.5 sm:grid-cols-3">
            {Object.entries(SECTIONS).map(([key, config]) => (
              <TabsTrigger
                key={key}
                value={key}
                className="min-h-11 rounded-xl px-3 text-xs leading-5 text-stone-600 data-[state=active]:bg-white data-[state=active]:text-[#20352a] data-[state=active]:shadow-sm sm:text-sm"
              >
                {config.title}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#718174]">
              Selected collection
            </p>
            <h2 className="mt-1 text-xl font-semibold text-[#20352a]">
              {activeSection.title}
            </h2>
            <p className="mt-1 text-sm text-stone-500">
              {activeSection.description}
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              setSortOrder((value) => (value === "desc" ? "asc" : "desc"))
            }
            className="inline-flex h-9 items-center gap-2 self-start rounded-lg border border-stone-200 bg-white px-3 text-xs font-semibold text-stone-600 hover:bg-stone-50 sm:self-auto"
          >
            {sortOrder === "desc" ? (
              <ArrowDown className="size-3.5" />
            ) : (
              <ArrowUp className="size-3.5" />
            )}
            {sortOrder === "desc" ? "Newest first" : "Oldest first"}
          </button>
        </div>

        <section className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="relative sm:col-span-2 lg:col-span-2">
              <Search className="absolute left-3 top-2.5 size-4 text-stone-400" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={
                  isFeedback
                    ? "Search wholesaler, email, ticket or message"
                    : "Search business, email or review"
                }
                className="border-stone-200 pl-9"
              />
            </div>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="border-stone-200">
                <SelectValue placeholder="Any status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any status</SelectItem>
                {statusOptions.map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={rating} onValueChange={setRating}>
              <SelectTrigger className="border-stone-200">
                <SelectValue placeholder="Any rating" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any rating</SelectItem>
                {[5, 4, 3, 2, 1].map((value) => (
                  <SelectItem key={value} value={String(value)}>
                    {value} stars
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-2 sm:col-span-2 lg:col-span-1">
              <Input
                type="date"
                value={dateFrom}
                onChange={(event) => setDateFrom(event.target.value)}
                aria-label="From date"
                className="min-w-0 border-stone-200"
              />
              <Input
                type="date"
                value={dateTo}
                onChange={(event) => setDateTo(event.target.value)}
                aria-label="To date"
                className="min-w-0 border-stone-200"
              />
            </div>
          </div>
        </section>

        {loading ? (
          <div className="rounded-2xl border border-stone-200 bg-white py-16 text-center text-sm text-stone-500">
            Loading {isFeedback ? "wholesaler feedback" : "partner reviews"}...
          </div>
        ) : error ? (
          <div
            role="alert"
            className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800"
          >
            {error}
          </div>
        ) : result.items?.length ? (
          <div className="grid gap-4 xl:grid-cols-2">
            {result.items.map(renderCard)}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-stone-300 bg-white px-5 py-16 text-center">
            <span className="mx-auto grid size-11 place-items-center rounded-full bg-[#edf3ef] text-[#506c5a]">
              <MessageSquareText className="size-5" />
            </span>
            <h3 className="mt-4 text-base font-semibold text-[#20352a]">
              Nothing to show yet
            </h3>
            <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-stone-500">
              No records match these filters. New submissions will appear here
              after they are saved.
            </p>
          </div>
        )}

        <div className="flex flex-col gap-3 border-t border-stone-200 pt-4 text-sm text-stone-500 sm:flex-row sm:items-center sm:justify-between">
          <span>
            Showing {result.items?.length ? (page - 1) * 10 + 1 : 0}–
            {Math.min(page * 10, result.pagination?.total || 0)} of{" "}
            {result.pagination?.total || 0}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              disabled={page <= 1 || loading}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              aria-label="Previous page"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="min-w-20 text-center text-xs">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              disabled={page >= totalPages || loading}
              onClick={() =>
                setPage((value) => Math.min(totalPages, value + 1))
              }
              aria-label="Next page"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      </section>

      <Dialog
        open={Boolean(selectedItem)}
        onOpenChange={(open) => {
          if (!open) setSelectedItem(null);
        }}
      >
        <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto border-stone-200">
          {selectedItem && (
            <>
              <DialogHeader className="pr-7">
                <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#718174]">
                  {selectedItem.kind === "feedback"
                    ? "Wholesaler feedback"
                    : selectedItem.category || "Partner review"}
                </p>
                <DialogTitle className="font-serif text-2xl text-[#20352a]">
                  {selectedItem.kind === "feedback"
                    ? selectedItem.subject
                    : selectedItem.title || "Partner review"}
                </DialogTitle>
                <DialogDescription>
                  Submitted {formatDate(selectedItem.createdAt, true)}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#f7f8f6] p-4">
                  <div>
                    <p className="font-semibold text-[#20352a]">
                      {selectedItem.kind === "feedback"
                        ? selectedItem.businessName ||
                          selectedItem.contactName ||
                          "Wholesaler"
                        : selectedItem.reviewer?.name || "Business partner"}
                    </p>
                    <p className="mt-0.5 text-xs text-stone-500">
                      {selectedItem.kind === "feedback"
                        ? selectedItem.email || "Wholesaler account"
                        : `${selectedItem.userRole || selectedItem.reviewer?.role || "Partner"}${selectedItem.reviewer?.email ? ` · ${selectedItem.reviewer.email}` : ""}`}
                    </p>
                  </div>
                  <div className="space-y-1 text-right">
                    <StarRating rating={selectedItem.rating} />
                    <span
                      className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusStyle(selectedItem.status)}`}
                    >
                      {selectedItem.status || "Open"}
                    </span>
                  </div>
                </div>

                {selectedItem.kind === "review" && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-stone-200 p-3">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-stone-400">
                        Review category
                      </p>
                      <p className="mt-1 text-sm font-semibold text-stone-700">
                        {selectedItem.category || "Partner review"}
                      </p>
                    </div>
                    <div className="rounded-xl border border-stone-200 p-3">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-stone-400">
                        Recipient
                      </p>
                      <p className="mt-1 text-sm font-semibold text-stone-700">
                        {selectedItem.recipient?.name || "Business partner"}
                      </p>
                      {selectedItem.recipient?.email && (
                        <p className="mt-0.5 text-xs text-stone-500">
                          {selectedItem.recipient.email}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {selectedItem.kind === "feedback" && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-stone-200 p-3">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-stone-400">
                        Feedback category
                      </p>
                      <p className="mt-1 text-sm font-semibold text-stone-700">
                        {selectedItem.type || "Feedback"}
                      </p>
                    </div>
                    <div className="rounded-xl border border-stone-200 p-3">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-stone-400">
                        Ticket
                      </p>
                      <p className="mt-1 text-sm font-semibold text-stone-700">
                        {selectedItem.ticketNo || "—"}
                      </p>
                    </div>
                  </div>
                )}

                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-stone-400">
                    {selectedItem.kind === "feedback"
                      ? "Feedback message"
                      : "Review"}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-stone-700">
                    {selectedItem.kind === "feedback"
                      ? selectedItem.message
                      : selectedItem.comment}
                  </p>
                </div>

                {selectedItem.kind === "feedback" && (
                  <>
                    <div className="border-t border-stone-200 pt-4">
                      <h3 className="text-sm font-semibold text-[#20352a]">
                        Conversation
                      </h3>
                      <div className="mt-3 space-y-3">
                        {(selectedItem.replies || []).map((entry, index) => (
                          <article
                            key={entry._id || `${entry.createdAt}-${index}`}
                            className="rounded-xl border border-stone-200 p-3"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="text-xs font-semibold text-stone-700">
                                {entry.by?.name ||
                                  entry.senderName ||
                                  entry.role ||
                                  "Participant"}
                                {entry.role ? ` · ${entry.role}` : ""}
                              </p>
                              <time className="text-[11px] text-stone-400">
                                {formatDate(entry.createdAt, true)}
                              </time>
                            </div>
                            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-stone-600">
                              {entry.message}
                            </p>
                          </article>
                        ))}
                      </div>
                    </div>
                    <form
                      onSubmit={sendFeedbackReply}
                      className="space-y-2 border-t border-stone-200 pt-4"
                    >
                      <label
                        htmlFor="feedback-reply"
                        className="text-xs font-semibold text-stone-700"
                      >
                        Reply to wholesaler
                      </label>
                      <textarea
                        id="feedback-reply"
                        required
                        maxLength={5000}
                        value={reply}
                        onChange={(event) => setReply(event.target.value)}
                        rows={3}
                        className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#718174] focus:ring-2 focus:ring-[#718174]/15"
                        placeholder="Write a response..."
                      />
                      <div className="flex justify-end">
                        <Button
                          type="submit"
                          disabled={!reply.trim() || replySaving}
                          className="bg-[#314c3f] text-white hover:bg-[#263b31]"
                        >
                          <Send className="mr-2 size-4" />{" "}
                          {replySaving ? "Sending..." : "Send reply"}
                        </Button>
                      </div>
                    </form>
                  </>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmationModal
        open={Boolean(confirmation)}
        title={
          confirmation?.kind === "delete"
            ? "Delete review?"
            : "Update review status?"
        }
        description="This moderation action will be saved immediately."
        confirmLabel={confirmation?.kind === "delete" ? "Delete" : "Confirm"}
        variant={confirmation?.kind === "delete" ? "destructive" : "default"}
        onCancel={() => !saving && setConfirmation(null)}
        onConfirm={runAction}
      />
    </div>
  );
}
