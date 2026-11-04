'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import api, { type PartnerReview, type ReviewPartner } from '@/lib/api';

export default function ReviewsPage() {
  const [partners, setPartners] = useState<ReviewPartner[]>([]);
  const [reviews, setReviews] = useState<PartnerReview[]>([]);
  const [recipientId, setRecipientId] = useState('');
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
  const [rating, setRating] = useState(5);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const loadReviews = useCallback(async () => {
    const [partnerResponse, reviewResponse] = await Promise.all([
      api.getReviewPartners(),
      api.getReceivedReviews(),
    ]);
    setPartners(partnerResponse.data);
    setReviews(reviewResponse.data);
    setRecipientId((selected) => selected || partnerResponse.data[0]?.id || '');
  }, []);

  useEffect(() => {
    let active = true;
    loadReviews()
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Could not load reviews.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [loadReviews]);

  const submitReview = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!recipientId || !comment.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      await api.submitPartnerReview({ recipientId, title: title.trim(), comment: comment.trim(), rating });
      setTitle('');
      setComment('');
      setRating(5);
      await loadReviews();
    } catch (submitError: unknown) {
      setError(submitError instanceof Error ? submitError.message : 'Could not submit your review.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-bold uppercase tracking-wider text-tradeflow-green">Wholesaler dashboard</p>
        <h1 className="mt-1 text-2xl font-extrabold text-tradeflow-navy">Partner reviews</h1>
        <p className="mt-1 text-sm text-gray-500">Review connected retailers and see feedback retailers have left for your business.</p>
      </header>

      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <div className="grid gap-5 lg:grid-cols-2">
        <form onSubmit={submitReview} className="space-y-4 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-extrabold text-tradeflow-navy">Review a retailer</h2>
          <label className="block space-y-1.5 text-sm font-semibold text-tradeflow-navy">
            Connected retailer
            <select value={recipientId} onChange={(event) => setRecipientId(event.target.value)} required disabled={!partners.length || submitting} className="h-11 w-full rounded-lg border border-stone-300 bg-white px-3 text-sm">
              {partners.length ? partners.map((partner) => <option key={partner.id} value={partner.id}>{partner.name}</option>) : <option value="">No connected retailer</option>}
            </select>
          </label>
          <div>
            <span className="block text-sm font-semibold text-tradeflow-navy">Rating</span>
            <div className="mt-1 flex gap-1" role="group" aria-label="Rating">
              {[1, 2, 3, 4, 5].map((value) => (
                <button key={value} type="button" aria-label={`${value} star${value === 1 ? '' : 's'}`} onClick={() => setRating(value)} className="rounded p-1 text-amber-500">
                  <Star className={value <= rating ? 'fill-current' : ''} />
                </button>
              ))}
            </div>
          </div>
          <label className="block space-y-1.5 text-sm font-semibold text-tradeflow-navy">
            Title (optional)
            <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} className="h-11 w-full rounded-lg border border-stone-300 bg-white px-3 text-sm" />
          </label>
          <label className="block space-y-1.5 text-sm font-semibold text-tradeflow-navy">
            Review
            <textarea required value={comment} onChange={(event) => setComment(event.target.value)} maxLength={2000} rows={4} className="w-full rounded-lg border border-stone-300 bg-white p-3 text-sm" />
          </label>
          <button type="submit" disabled={!recipientId || !comment.trim() || submitting} className="min-h-11 rounded-lg bg-tradeflow-green px-4 text-sm font-bold text-white disabled:opacity-50">
            {submitting ? 'Submitting…' : 'Submit review'}
          </button>
        </form>

        <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-extrabold text-tradeflow-navy">Reviews for your business</h2>
          {loading ? <p className="py-8 text-sm text-gray-500">Loading reviews…</p> : reviews.length ? (
            <div className="mt-4 divide-y divide-stone-100">
              {reviews.map((review) => (
                <article key={review.id} className="py-4 first:pt-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-bold text-tradeflow-navy">{review.title || 'Partner review'}</h3>
                      <p className="mt-1 text-xs text-gray-500">From {review.reviewer.name} · {new Date(review.createdAt).toLocaleDateString()}</p>
                    </div>
                    <span className="shrink-0 font-bold text-amber-600">{review.rating}/5 ★</span>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-gray-600">{review.comment}</p>
                </article>
              ))}
            </div>
          ) : <p className="py-8 text-sm text-gray-500">No retailer reviews for your business yet.</p>}
        </section>
      </div>
    </div>
  );
}
