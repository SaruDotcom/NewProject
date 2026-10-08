import React, { useState } from 'react';
import { Star, StarBorder, RateReview, CheckCircle } from '@mui/icons-material';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import api from '@/api/api';

interface FeedbackModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FeedbackModal({ open, onOpenChange }: FeedbackModalProps) {
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [title, setTitle] = useState<string>('');
  const [comment, setComment] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);

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
        title: title.trim() || 'Retailer Platform Feedback',
        comment: comment.trim(),
      });
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setTitle('');
        setComment('');
        setRating(5);
        onOpenChange(false);
      }, 1800);
    } catch (err: any) {
      setError(err?.message || 'Failed to submit feedback. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setError(null);
      setSuccess(false);
      onOpenChange(false);
    }
  };

  const currentRating = hoverRating !== null ? hoverRating : rating;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md rounded-2xl p-6 shadow-2xl">
        <DialogHeader className="flex flex-col items-center text-center space-y-2">
          <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <RateReview className="size-8 text-primary" />
          </div>
          <DialogTitle className="text-xl font-extrabold text-ink">
            Submit Feedback & Review
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Your feedback helps us improve the platform. Submitted reviews are reviewed by the Admin team.
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="py-8 flex flex-col items-center justify-center text-center space-y-3">
            <CheckCircle className="size-14 text-emerald-500 animate-bounce" />
            <h4 className="font-extrabold text-lg text-ink">Thank You!</h4>
            <p className="text-xs text-muted-foreground max-w-xs">
              Your feedback has been submitted successfully and sent to the Admin team for review.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-2 space-y-4">
            {error && (
              <div className="p-3 rounded-xl bg-destructive/10 text-destructive text-xs font-semibold">
                {error}
              </div>
            )}

            {/* Rating Stars */}
            <div className="flex flex-col items-center space-y-1.5 bg-secondary/30 p-3 rounded-xl">
              <span className="text-xs font-extrabold uppercase text-muted-foreground tracking-wider">
                Overall Rating
              </span>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(null)}
                    className="p-1 text-amber-500 hover:scale-125 transition-transform focus:outline-none"
                  >
                    {star <= currentRating ? (
                      <Star className="size-8 fill-current" />
                    ) : (
                      <StarBorder className="size-8 text-amber-400" />
                    )}
                  </button>
                ))}
              </div>
              <span className="text-xs font-bold text-amber-600">
                {currentRating === 5 && 'Outstanding ★★★★★'}
                {currentRating === 4 && 'Very Good ★★★★☆'}
                {currentRating === 3 && 'Average ★★★☆☆'}
                {currentRating === 2 && 'Needs Improvement ★★☆☆☆'}
                {currentRating === 1 && 'Poor ★☆☆☆☆'}
              </span>
            </div>

            {/* Feedback Subject / Title */}
            <div>
              <label className="block text-xs font-bold text-ink mb-1">
                Subject / Title (Optional)
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Order Delivery, Platform Interface..."
                className="w-full rounded-xl border border-input bg-background px-3.5 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
              />
            </div>

            {/* Comment */}
            <div>
              <label className="block text-xs font-bold text-ink mb-1">
                Feedback Comment <span className="text-primary">*</span>
              </label>
              <textarea
                rows={4}
                required
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Describe your experience or suggest features to our Admin team..."
                className="w-full rounded-xl border border-input bg-background px-3.5 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 resize-none"
              />
            </div>

            <DialogFooter className="pt-2 flex flex-col sm:flex-row gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={loading}
                className="w-full sm:w-1/2 rounded-xl font-semibold"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="w-full sm:w-1/2 rounded-xl font-extrabold bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {loading ? 'Submitting...' : 'Submit Feedback'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
