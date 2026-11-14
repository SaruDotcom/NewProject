'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MessageSquareText, Star } from 'lucide-react';
import api, { type PartnerReview } from '@/lib/api';
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
  const userId = profile.id || getWholesalerId();
  const queryKey = wholesalerQueryKeys.resource(userId, 'reviews');
  const reviewsQuery = useQuery({
    queryKey,
    queryFn: async () => (await api.getReceivedReviews()).data || [],
    staleTime: 60 * 1000,
  });
  const [receivedReviewsState, setReceivedReviewsState] = useState<PartnerReview[] | null>(null);
  const [markingReadId, setMarkingReadId] = useState('');
  const [error, setError] = useState('');
  const receivedReviews = receivedReviewsState ?? reviewsQuery.data ?? [];
  const unreadCount = receivedReviews.filter((review) => !review.isRead).length;

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
          <h1 className="mt-2 font-serif text-3xl font-semibold tracking-tight text-[#20352a] sm:text-4xl">Retailer Feedback &amp; Reviews</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-500">
            Feedback from retailers with delivered orders appears here. Reviews can only be submitted by retailers.
          </p>
        </div>
        {unreadCount > 0 && (
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800">
            <span className="size-1.5 rounded-full bg-emerald-600" />
            {unreadCount} new {unreadCount === 1 ? 'review' : 'reviews'}
          </span>
        )}
      </header>

      {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}

      <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-center justify-between gap-3 border-b border-stone-100 pb-4">
          <div>
            <h2 className="text-base font-semibold text-[#263b31]">Reviews received</h2>
            <p className="mt-1 text-xs text-stone-500">Ratings and messages from verified retailer purchases.</p>
          </div>
          <span className="rounded-full bg-[#f3f4f0] px-2.5 py-1 text-xs font-semibold text-stone-600">{receivedReviews.length}</span>
        </div>
        {reviewsQuery.isLoading ? (
          <p role="status" className="py-10 text-center text-sm text-stone-500">Loading retailer reviews…</p>
        ) : reviewsQuery.isError ? (
          <p role="alert" className="py-10 text-center text-sm text-rose-700">
            {reviewsQuery.error instanceof Error ? reviewsQuery.error.message : 'Unable to load retailer reviews.'}
          </p>
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
                  <button
                    type="button"
                    onClick={() => void markAsRead(review.id)}
                    disabled={markingReadId === review.id}
                    className="mt-3 text-xs font-semibold text-[#496451] underline underline-offset-2 disabled:opacity-50"
                  >
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
            <p className="mt-1 text-xs text-stone-400">Verified retailer feedback will appear here.</p>
          </div>
        )}
      </section>
    </main>
  );
}
