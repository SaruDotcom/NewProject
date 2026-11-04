import React, { useState } from 'react';
import {
  Send,
  CheckCircle2,
  X,
  Headphones,
  Sparkles,
  HelpCircle
} from 'lucide-react';
import { useWholesaler } from '@/context/WholesalerContext';
import api from '@/lib/api';

interface SuperAdminHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SuperAdminHelpModal: React.FC<SuperAdminHelpModalProps> = ({ isOpen, onClose }) => {
  const { profile } = useWholesaler();
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [callbackPhone, setCallbackPhone] = useState(profile.phone || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);
  const [submittedTicketNo, setSubmittedTicketNo] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmitCallback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    setIsSubmitting(true);
    setError('');
    try {
      const response = await api.submitHelpRequest({
        subject: subject.trim(),
        message: message.trim(),
        callbackPhone: callbackPhone.trim(),
      });
      setSubmittedTicketNo(response.data?.ticketNo || response.data?.ticketNumber || '');
      setSubmittedSuccess(true);
      setSubject('');
      setMessage('');
      setTimeout(() => {
        setSubmittedSuccess(false);
        setSubmittedTicketNo('');
        onClose();
      }, 2500);
    } catch (err: any) {
      setError(err?.message || 'Failed to submit help request to Super Admin.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden border border-[#E7E5E4] shadow-2xl space-y-0 max-h-[92vh] flex flex-col">
        <div className="bg-tradeflow-green p-5 text-white flex items-center justify-between relative shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-amber-300 font-bold shadow-md">
              <Headphones className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold tracking-tight">Help &amp; Support</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-400 text-stone-900 font-bold uppercase tracking-wider">
                  Support ticket
                </span>
              </div>
              <p className="text-xs text-white/80">
                Send a request to the Super Admin team and follow its status in Help &amp; Support.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-5 flex-1 text-xs">
          <div className="flex gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-emerald-800">
            <HelpCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              Requests are saved as support tickets. You can view replies and status on the Help &amp; Support page.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-[#FAF9F6] border border-[#E7E5E4] space-y-3">
            <h3 className="font-bold text-[#1C1917] text-xs flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-tradeflow-green" />
              <span>Send a request</span>
            </h3>

            {submittedSuccess ? (
              <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                <div className="font-bold text-sm text-emerald-900">Support request submitted</div>
                <p className="text-xs text-emerald-700">
                  Ticket <strong>{submittedTicketNo || 'created'}</strong> is available in Help &amp; Support. The team may follow up at <strong className="font-mono">{callbackPhone}</strong>.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmitCallback} className="space-y-3">
                {error && (
                  <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">
                    {error}
                  </div>
                )}
                <div>
                  <label className="block font-bold text-[#1C1917] text-[11px] mb-1">Callback phone number *</label>
                  <input
                    type="tel"
                    required
                    value={callbackPhone}
                    onChange={(e) => setCallbackPhone(e.target.value)}
                    className="w-full px-3 py-2 border border-[#E7E5E4] rounded-xl bg-white font-mono text-xs focus:outline-none focus:border-tradeflow-green"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#1C1917] text-[11px] mb-1">Issue / Request Subject</label>
                  <input
                    type="text"
                    placeholder="e.g. KYC approval / subscription inquiry / inventory issue"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full px-3 py-2 border border-[#E7E5E4] rounded-xl bg-white text-xs focus:outline-none focus:border-tradeflow-green"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#1C1917] text-[11px] mb-1">Detailed Message for Super Admin *</label>
                  <textarea
                    required
                    rows={2}
                    placeholder="Describe what you need help with from Super Admin..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="w-full px-3 py-2 border border-[#E7E5E4] rounded-xl bg-white text-xs focus:outline-none focus:border-tradeflow-green"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || !message.trim()}
                  className="w-full py-2.5 bg-tradeflow-green hover:bg-tradeflow-green-hover disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? 'Sending request...' : 'Send request'}</span>
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
