import React, { useEffect, useState } from 'react';
import { Star, MessageSquare, CheckCircle2, X } from 'lucide-react';
import api, { type ReviewPartner } from '@/lib/api';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FeedbackModal: React.FC<FeedbackModalProps> = ({ isOpen, onClose }) => {
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [title, setTitle] = useState<string>('');
  const [comment, setComment] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);
  const [partners, setPartners] = useState<ReviewPartner[]>([]);
  const [recipientId, setRecipientId] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    api.getReviewPartners()
      .then((response) => {
        if (!active) return;
        setPartners(response.data);
        setRecipientId(response.data[0]?.id || '');
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Could not load connected retailers.');
      });
    return () => {
      active = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) {
      setError('Please provide a comment for your review.');
      return;
    }
    if (!recipientId) {
      setError('You need an active retailer connection before submitting a partner review.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await api.submitPartnerReview({
        recipientId,
        rating,
        title: title.trim(),
        comment: comment.trim(),
      });
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setTitle('');
        setComment('');
        setRating(5);
        onClose();
      }, 1800);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to submit review. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleModalClose = () => {
    if (!loading) {
      setError(null);
      setSuccess(false);
      onClose();
    }
  };

  const currentRating = hoverRating !== null ? hoverRating : rating;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-[#E7E5E4]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#E7E5E4]">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-tradeflow-green-50 text-tradeflow-green">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-[#1C1917]">Partner Feedback & Review</h3>
              <p className="text-xs text-[#78716C]">Share a rating and review with a connected retailer</p>
            </div>
          </div>
          <button
            onClick={handleModalClose}
            disabled={loading}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {success ? (
          <div className="py-8 flex flex-col items-center justify-center text-center space-y-3">
            <CheckCircle2 className="h-14 w-14 text-emerald-500 animate-bounce" />
            <h4 className="font-bold text-lg text-[#1C1917]">Thank You!</h4>
            <p className="text-xs text-[#78716C] max-w-xs">
              Your review has been saved and shared with the retailer.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            {error && (
              <div className="p-3 rounded-xl bg-red-50 text-red-700 text-xs font-semibold border border-red-200">
                {error}
              </div>
            )}

            <div>
              <label className="mb-1 block text-xs font-bold text-[#1C1917]">Review retailer</label>
              <select
                value={recipientId}
                onChange={(event) => setRecipientId(event.target.value)}
                required
                disabled={!partners.length || loading}
                className="h-10 w-full rounded-xl border border-[#E7E5E4] bg-[#FAF9F6] px-3 text-sm"
              >
                {partners.length ? partners.map((partner) => <option key={partner.id} value={partner.id}>{partner.name}</option>) : <option value="">No connected retailer</option>}
              </select>
            </div>

            {/* Rating Stars */}
            <div className="flex flex-col items-center space-y-1.5 bg-[#FAF9F6] p-3 rounded-xl border border-[#E7E5E4]">
              <span className="text-[11px] font-bold uppercase text-[#78716C] tracking-wider">
                Rate your Experience
              </span>
              <div className="flex items-center gap-1.5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(null)}
                    className="p-1 text-amber-400 hover:scale-125 transition-transform focus:outline-none"
                  >
                    <Star
                      className={`h-7 w-7 ${
                        star <= currentRating
                          ? 'fill-amber-400 text-amber-400'
                          : 'text-gray-300'
                      }`}
                    />
                  </button>
                ))}
              </div>
              <span className="text-xs font-bold text-amber-600">
                {currentRating === 5 && 'Excellent ★★★★★'}
                {currentRating === 4 && 'Good ★★★★☆'}
                {currentRating === 3 && 'Average ★★★☆☆'}
                {currentRating === 2 && 'Needs Improvement ★★☆☆☆'}
                {currentRating === 1 && 'Poor ★☆☆☆☆'}
              </span>
            </div>

            {/* Subject / Title */}
            <div>
              <label className="block text-xs font-bold text-[#1C1917] mb-1">
                Subject / Topic (Optional)
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Order management, payment..."
                className="w-full rounded-xl border border-[#E7E5E4] bg-[#FAF9F6] px-3.5 py-2 text-sm focus:outline-none focus:border-tradeflow-green focus:ring-1 focus:ring-tradeflow-green"
              />
            </div>

            {/* Comment */}
            <div>
              <label className="block text-xs font-bold text-[#1C1917] mb-1">
                Feedback Comment <span className="text-tradeflow-green">*</span>
              </label>
              <textarea
                rows={4}
                required
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Describe your experience working with this retailer..."
                className="w-full rounded-xl border border-[#E7E5E4] bg-[#FAF9F6] px-3.5 py-2 text-sm focus:outline-none focus:border-tradeflow-green focus:ring-1 focus:ring-tradeflow-green resize-none"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-[#E7E5E4]">
              <button
                type="button"
                onClick={handleModalClose}
                disabled={loading}
                className="px-4 py-2 text-xs font-bold text-[#78716C] hover:bg-gray-100 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2 text-xs font-bold text-white bg-tradeflow-green hover:bg-tradeflow-green-hover rounded-xl shadow-xs transition-all disabled:opacity-50"
              >
                {loading ? 'Submitting...' : 'Submit Review'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
