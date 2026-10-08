import React, { useState } from 'react';
import { Star, MessageSquare, CheckCircle2, X } from 'lucide-react';
import api from '@/lib/api';

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

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) {
      setError('Please provide a comment for your feedback.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await api.submitFeedback({
        rating,
        title: title.trim() || 'Wholesaler Partner Feedback',
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
    } catch (err: any) {
      setError(err?.message || 'Failed to submit feedback. Please try again.');
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
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-[#E5E5E5]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#E5E5E5]">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FFEBEE] text-[#C62828]">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-[#1F1F1F]">Partner Feedback & Review</h3>
              <p className="text-xs text-gray-500">Submit your feedback directly to the Admin team</p>
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
            <h4 className="font-extrabold text-lg text-[#1F1F1F]">Thank You!</h4>
            <p className="text-xs text-gray-600 max-w-xs">
              Your feedback has been submitted successfully and sent to the Admin team for review.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            {error && (
              <div className="p-3 rounded-xl bg-[#FFEBEE] text-[#C62828] text-xs font-semibold border border-[#F2C2C4]">
                {error}
              </div>
            )}

            {/* Rating Stars */}
            <div className="flex flex-col items-center space-y-1.5 bg-[#FAF9F7] p-3 rounded-xl border border-[#E5E5E5]">
              <span className="text-[11px] font-extrabold uppercase text-gray-500 tracking-wider">
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
              <label className="block text-xs font-bold text-[#1F1F1F] mb-1">
                Subject / Topic (Optional)
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Platform Features, Order Management..."
                className="w-full rounded-xl border border-[#E5E5E5] bg-[#FAF9F7] px-3.5 py-2 text-sm focus:outline-none focus:border-[#C62828] focus:ring-1 focus:ring-[#C62828]"
              />
            </div>

            {/* Comment */}
            <div>
              <label className="block text-xs font-bold text-[#1F1F1F] mb-1">
                Feedback Comment <span className="text-[#C62828]">*</span>
              </label>
              <textarea
                rows={4}
                required
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Write your feedback, suggestions, or issue details for the Admin team..."
                className="w-full rounded-xl border border-[#E5E5E5] bg-[#FAF9F7] px-3.5 py-2 text-sm focus:outline-none focus:border-[#C62828] focus:ring-1 focus:ring-[#C62828] resize-none"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-[#E5E5E5]">
              <button
                type="button"
                onClick={handleModalClose}
                disabled={loading}
                className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2 text-xs font-extrabold text-white bg-[#C62828] hover:bg-[#B71C1C] rounded-xl shadow-sm transition-all disabled:opacity-50"
              >
                {loading ? 'Submitting...' : 'Submit Feedback'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
