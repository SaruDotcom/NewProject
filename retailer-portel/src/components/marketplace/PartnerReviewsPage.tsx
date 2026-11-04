import { useEffect, useState, type FormEvent } from "react";
import { Star } from "@mui/icons-material";
import { api, type PartnerReview, type ReviewPartner } from "@/api/api";
import { useStore } from "@/state/store";

export function PartnerReviewsPage() {
  const { currentUser } = useStore();
  const [partners, setPartners] = useState<ReviewPartner[]>([]);
  const [reviews, setReviews] = useState<PartnerReview[]>([]);
  const [recipientId, setRecipientId] = useState("");
  const [title, setTitle] = useState("");
  const [comment, setComment] = useState("");
  const [rating, setRating] = useState(5);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const loadReviews = async () => {
    const [partnerResponse, reviewResponse] = await Promise.all([
      api.getReviewPartners(),
      api.getReceivedReviews(),
    ]);
    setPartners(partnerResponse.data);
    setReviews(reviewResponse.data);
    setRecipientId((selected) => selected || partnerResponse.data[0]?.id || "");
  };

  useEffect(() => {
    let active = true;
    Promise.all([api.getReviewPartners(), api.getReceivedReviews()])
      .then(([partnerResponse, reviewResponse]) => {
        if (!active) return;
        setPartners(partnerResponse.data);
        setReviews(reviewResponse.data);
        setRecipientId(partnerResponse.data[0]?.id || "");
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : "Could not load reviews.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [currentUser?.id]);

  const submitReview = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!recipientId || !comment.trim()) return;
    setSubmitting(true);
    setError("");
    try {
      await api.submitPartnerReview({ recipientId, title: title.trim(), comment: comment.trim(), rating });
      setTitle("");
      setComment("");
      setRating(5);
      await loadReviews();
    } catch (submitError: unknown) {
      setError(submitError instanceof Error ? submitError.message : "Could not submit your review.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="shell py-8 sm:py-10">
      <header className="mb-6">
        <p className="text-xs font-bold uppercase text-primary">Retailer workspace</p>
        <h1 className="mt-1 text-3xl font-extrabold text-ink">Partner reviews</h1>
        <p className="mt-2 text-sm text-muted-foreground">Rate your connected wholesaler and see reviews wholesalers have left for your store.</p>
      </header>

      {error && <p role="alert" className="mb-4 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <form onSubmit={submitReview} className="space-y-4 rounded-2xl border bg-card p-5 shadow-sm">
          <h2 className="text-lg font-extrabold text-ink">Review your wholesaler</h2>
          <label className="block space-y-1.5 text-sm font-semibold text-ink">
            Connected wholesaler
            <select
              value={recipientId}
              onChange={(event) => setRecipientId(event.target.value)}
              required
              disabled={!partners.length || submitting}
              className="h-11 w-full rounded-lg border bg-background px-3 text-sm"
            >
              {partners.length ? partners.map((partner) => <option key={partner.id} value={partner.id}>{partner.name}</option>) : <option value="">No connected wholesaler</option>}
            </select>
          </label>
          <div>
            <span className="block text-sm font-semibold text-ink">Rating</span>
            <div className="mt-1 flex gap-1" role="group" aria-label="Rating">
              {[1, 2, 3, 4, 5].map((value) => (
                <button key={value} type="button" aria-label={`${value} star${value === 1 ? "" : "s"}`} onClick={() => setRating(value)} className="rounded p-1 text-amber-500">
                  <Star className={value <= rating ? "fill-current" : ""} />
                </button>
              ))}
            </div>
          </div>
          <label className="block space-y-1.5 text-sm font-semibold text-ink">
            Title (optional)
            <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} className="h-11 w-full rounded-lg border bg-background px-3 text-sm" />
          </label>
          <label className="block space-y-1.5 text-sm font-semibold text-ink">
            Review
            <textarea required value={comment} onChange={(event) => setComment(event.target.value)} maxLength={2000} rows={4} className="w-full rounded-lg border bg-background p-3 text-sm" />
          </label>
          <button type="submit" disabled={!recipientId || !comment.trim() || submitting} className="min-h-11 rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-50">
            {submitting ? "Submitting…" : "Submit review"}
          </button>
        </form>

        <section className="rounded-2xl border bg-card p-5 shadow-sm">
          <h2 className="text-lg font-extrabold text-ink">Reviews about your store</h2>
          {loading ? <p className="py-8 text-sm text-muted-foreground">Loading reviews…</p> : reviews.length ? (
            <div className="mt-4 divide-y">
              {reviews.map((review) => (
                <article key={review.id} className="py-4 first:pt-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-bold text-ink">{review.title || "Partner review"}</h3>
                      <p className="mt-1 text-xs text-muted-foreground">From {review.reviewer.name} · {new Date(review.createdAt).toLocaleDateString()}</p>
                    </div>
                    <span className="shrink-0 font-bold text-amber-600">{review.rating}/5 ★</span>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{review.comment}</p>
                </article>
              ))}
            </div>
          ) : <p className="py-8 text-sm text-muted-foreground">{loading ? "" : "No wholesaler reviews for your store yet."}</p>}
        </section>
      </div>
    </main>
  );
}
