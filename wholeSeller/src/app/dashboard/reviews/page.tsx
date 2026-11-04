'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MessageSquareText, Send, Star, Store } from 'lucide-react';
import api, {
  type PartnerReview,
  type ReviewPartner,
  type SubmittedPartnerReview,
} from '@/lib/api';
import { useWholesaler } from '@/context/WholesalerContext';
import { getWholesalerId, wholesalerQueryKeys } from '@/lib/query-client';

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Date unavailable'
    : date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function Rating({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-1.5" aria-label={`${value} out of 5 stars`}>
      <span className="flex gap-0.5 text-amber-500">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star key={star} className={`h-3.5 w-3.5 ${star <= value ? 'fill-current' : 'text-stone-200'}`} />
        ))}
      </span>
      <span className="text-xs font-semibold text-stone-700">{value}/5</span>
    </span>
  );
}

export default function ReviewsPage() {
  const { profile } = useWholesaler();
  const queryClient = useQueryClient();
  const userId = profile.id || getWholesalerId();
  const queryKey = wholesalerQueryKeys.resource(userId, 'reviews');

  const reviewsQuery = useQuery({
    queryKey,
    queryFn: async () => {
      const [partnerResponse, receivedResponse, submittedResponse] = await Promise.all([
        api.getReviewPartners(),
        api.getReceivedReviews(),
        api.getSubmittedReviews(),
      ]);
      return {
        partners: partnerResponse.data || [],
        receivedReviews: receivedResponse.data || [],
        submittedReviews: submittedResponse.data || [],
      };
    },
    staleTime: 60 * 1000,
  });

  const [receivedReviewsState, setReceivedReviewsState] = useState<PartnerReview[] | null>(null);
  const partners = reviewsQuery.data?.partners || [];
  const receivedReviews = receivedReviewsState ?? (reviewsQuery.data?.receivedReviews || []);
  const submittedReviews = reviewsQuery.data?.submittedReviews || [];

  const [recipientId, setRecipientId] = useState('');
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
  const [rating, setRating] = useState(5);
  const loading = reviewsQuery.isLoading && !reviewsQuery.data;
  const [submitting, setSubmitting] = useState(false);
  const [markingReadId, setMarkingReadId] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const unreadCount = receivedReviews.filter((review) => !review.isRead).length;

  useEffect(() => {
    if (partners.length > 0 && !recipientId) {
      setRecipientId(partners[0].id);
    }
  }, [partners, recipientId]);

  const submitReview = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!recipientId || !comment.trim()) return;
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      await api.submitPartnerReview({ recipientId, title: title.trim(), comment: comment.trim(), rating });
      setTitle('');
      setComment('');
      setRating(5);
      await queryClient.invalidateQueries({ queryKey });
      setSuccess('Your review was submitted and saved.');
    } catch (submitError: unknown) {
      setError(submitError instanceof Error ? submitError.message : 'Could not submit your review.');
    } finally {
      setSubmitting(false);
    }
  };

  const markAsRead = async (reviewId: string) => {
    setMarkingReadId(reviewId);
    setError('');
    try {
      await api.markReviewAsRead(reviewId);
      setReceivedReviewsState((current) => (current ?? receivedReviews).map((review) => (
        review.id === reviewId ? { ...review, isRead: true } : review
      )));
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : 'Could not update review status.');
    } finally {
      setMarkingReadId('');
    }
  };

  return (
    <main className="space-y-7 pb-8">
      <header className="flex flex-col justify-between gap-4 border-b border-stone-200 pb-6 sm:flex-row sm:items-end">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#718174]">Business relationships</p>
          <h1 className="mt-2 font-serif text-3xl font-semibold tracking-tight text-[#20352a] sm:text-4xl">My Reviews &amp; Feedback</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-500">
            Share feedback with connected retailers and keep track of the reviews your business receives.
          </p>
        </div>
        {unreadCount > 0 && (
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800">
            <span className="size-1.5 rounded-full bg-emerald-600" />
            {unreadCount} new {unreadCount === 1 ? 'review' : 'reviews'}
          </span>
        )}
      </header>

      {(error || success) && (
        <p role={error ? 'alert' : 'status'} className={`rounded-xl border p-3 text-sm ${error ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
          {error || success}
        </p>
      )}

      <section className="grid gap-5 xl:grid-cols-[minmax(300px,0.8fr)_minmax(0,1.2fr)]">
        <form onSubmit={submitReview} className="h-fit space-y-4 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#edf2ed] text-[#496451]"><Send className="size-4" /></span>
            <div>
              <h2 className="text-base font-semibold text-[#263b31]">Review a retailer</h2>
              <p className="mt-1 text-xs leading-5 text-stone-500">Share a private partner review with one of your connected retailers.</p>
            </div>
          </div>
          <label className="block space-y-1.5 text-xs font-semibold text-stone-700">
            Connected retailer
            <select value={recipientId} onChange={(event) => setRecipientId(event.target.value)} required disabled={!partners.length || submitting} className="h-11 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm text-stone-800 focus:border-[#81917f] focus:outline-none">
              {partners.length ? partners.map((partner) => <option key={partner.id} value={partner.id}>{partner.name}</option>) : <option value="">No connected retailer</option>}
            </select>
          </label>
          <div>
            <span className="block text-xs font-semibold text-stone-700">Your rating</span>
            <div className="mt-1 flex gap-1" role="group" aria-label="Review rating">
              {[1, 2, 3, 4, 5].map((value) => (
                <button key={value} type="button" aria-label={`${value} star${value === 1 ? '' : 's'}`} aria-pressed={rating === value} onClick={() => setRating(value)} className="rounded p-1 text-amber-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-600">
                  <Star className={`size-5 ${value <= rating ? 'fill-current' : ''}`} />
                </button>
              ))}
            </div>
          </div>
          <label className="block space-y-1.5 text-xs font-semibold text-stone-700">
            Title <span className="font-normal text-stone-400">(optional)</span>
            <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} className="h-11 w-full rounded-xl border border-stone-200 px-3 text-sm text-black outline-none focus:border-[#81917f]" />
          </label>
          <label className="block space-y-1.5 text-xs font-semibold text-stone-700">
            Review
            <textarea required value={comment} onChange={(event) => setComment(event.target.value)} maxLength={2000} rows={4} className="w-full rounded-xl border border-stone-200 bg-white p-3 text-sm leading-6 text-black outline-none placeholder:text-stone-400 focus:border-[#81917f]" placeholder="Write about your experience with this retailer…" />
          </label>
          <button type="submit" disabled={!recipientId || !comment.trim() || submitting} className="min-h-11 w-full rounded-xl bg-[#314c3f] px-4 text-sm font-semibold text-white transition hover:bg-[#263b31] disabled:cursor-not-allowed disabled:opacity-50">
            {submitting ? 'Submitting…' : 'Submit review'}
          </button>
        </form>

        <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center justify-between gap-3 border-b border-stone-100 pb-4">
            <div>
              <h2 className="text-base font-semibold text-[#263b31]">Reviews received</h2>
              <p className="mt-1 text-xs text-stone-500">Ratings and messages from retailers about your business.</p>
            </div>
            <span className="rounded-full bg-[#f3f4f0] px-2.5 py-1 text-xs font-semibold text-stone-600">{receivedReviews.length}</span>
          </div>
          {loading ? (
            <p role="status" className="py-10 text-center text-sm text-stone-500">Loading retailer reviews…</p>
          ) : receivedReviews.length ? (
            <div className="divide-y divide-stone-100">
              {receivedReviews.map((review) => (
                <article key={review.id} className="py-5 first:pt-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-[#263b31]">{review.title || 'Retailer review'}</h3>
                        {!review.isRead && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-800">New</span>}
                      </div>
                      <p className="mt-1 text-xs text-stone-500">From {review.reviewer.name} · {formatDate(review.createdAt)}</p>
                    </div>
                    <Rating value={review.rating} />
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-black">{review.comment}</p>
                  {!review.isRead && (
                    <button type="button" onClick={() => void markAsRead(review.id)} disabled={markingReadId === review.id} className="mt-3 text-xs font-semibold text-[#496451] underline underline-offset-2 disabled:opacity-50">
                      {markingReadId === review.id ? 'Updating…' : 'Mark as read'}
                    </button>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center">
              <MessageSquareText className="mx-auto size-6 text-stone-300" />
              <p className="mt-3 text-sm font-semibold text-stone-600">No retailer reviews yet</p>
              <p className="mt-1 text-xs text-stone-400">Reviews from your connected retailers will appear here.</p>
            </div>
          )}
        </section>
      </section>

      <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-center justify-between gap-3 border-b border-stone-100 pb-4">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-xl bg-[#f4f0e7] text-[#8b7549]"><Store className="size-4" /></span>
            <div>
              <h2 className="text-base font-semibold text-[#263b31]">Reviews you’ve written</h2>
              <p className="mt-1 text-xs text-stone-500">Your saved feedback for connected retailers.</p>
            </div>
          </div>
          <span className="rounded-full bg-[#f3f4f0] px-2.5 py-1 text-xs font-semibold text-stone-600">{submittedReviews.length}</span>
        </div>
        {loading ? (
          <p role="status" className="py-8 text-center text-sm text-stone-500">Loading your submitted reviews…</p>
        ) : submittedReviews.length ? (
          <div className="grid gap-3 pt-4 md:grid-cols-2">
            {submittedReviews.map((review) => (
              <article key={review.id} className="rounded-xl border border-stone-200 bg-[#fbfaf7] p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-[#263b31]">{review.title || 'Partner review'}</h3>
                    <p className="mt-1 text-xs text-stone-500">For {review.recipient.name} · {formatDate(review.createdAt)}</p>
                  </div>
                  <Rating value={review.rating} />
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-black">{review.comment}</p>
              </article>
            ))}
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-stone-500">Your submitted reviews will appear here.</p>
        )}
      </section>
    </main>
  );
}
