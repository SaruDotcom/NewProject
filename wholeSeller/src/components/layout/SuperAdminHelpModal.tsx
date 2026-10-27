import React, { useState } from 'react';
import {
  PhoneCall,
  MessageCircle,
  Mail,
  ShieldCheck,
  Clock,
  Send,
  CheckCircle2,
  X,
  Headphones,
  Sparkles,
  MapPin,
  AlertCircle,
  HelpCircle
} from 'lucide-react';
import { useWholesaler } from '@/context/WholesalerContext';
import api from '@/lib/api';

interface SuperAdminHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SUPER_ADMIN_CONTACT = {
  name: 'Rajesh Kumar (Super Admin Head)',
  role: 'Chief Super Admin & Marketplace Ops',
  phone: '+91 98765 43210',
  tollFree: '1800-123-9999',
  whatsapp: '+91 98765 43210',
  email: 'superadmin@vyaparone.com',
  secondaryEmail: 'support@vyaparone.com',
  address: 'VyapaarDwaar Tech Tower, Sector 62, Noida, UP - 201309',
  supportHours: '24/7 Priority Emergency Line',
};

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
        {/* Top Header Banner */}
        <div className="bg-tradeflow-green p-5 text-white flex items-center justify-between relative shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-amber-300 font-bold shadow-md">
              <Headphones className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold tracking-tight">Super Admin Support Desk</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-400 text-stone-900 font-bold uppercase tracking-wider">
                  24/7 Priority
                </span>
              </div>
              <p className="text-xs text-white/80">
                Direct hotline & emergency assistance for verified wholesalers
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

        {/* Modal Body Content */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1 text-xs">
          {/* Quick Direct Action Buttons (Call / WhatsApp) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Phone Call Button */}
            <a
              href={`tel:${SUPER_ADMIN_CONTACT.phone.replace(/\s+/g, '')}`}
              className="p-4 rounded-2xl bg-tradeflow-green hover:bg-tradeflow-green-hover text-white font-bold flex items-center justify-between shadow-xs group transition-all transform hover:-translate-y-0.5"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center font-bold">
                  <PhoneCall className="w-5 h-5 text-white animate-bounce" />
                </div>
                <div>
                  <div className="text-[10px] text-white/80 uppercase tracking-wider font-semibold">Call Super Admin</div>
                  <div className="text-sm font-bold tracking-tight">{SUPER_ADMIN_CONTACT.phone}</div>
                </div>
              </div>
            </a>

            {/* WhatsApp Chat Button */}
            <a
              href={`https://wa.me/${SUPER_ADMIN_CONTACT.whatsapp.replace(/[^0-9]/g, '')}?text=Hello%20Super%20Admin,%20I%20am%20${encodeURIComponent(profile.businessName || 'Wholesaler')}%20and%20need%20urgent%20assistance.`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-4 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold flex items-center justify-between shadow-xs group transition-all transform hover:-translate-y-0.5"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center font-bold">
                  <MessageCircle className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="text-[10px] text-emerald-100 uppercase tracking-wider font-semibold">WhatsApp Chat</div>
                  <div className="text-sm font-bold tracking-tight">Direct WhatsApp</div>
                </div>
              </div>
            </a>
          </div>

          {/* Super Admin Contact Info Card */}
          <div className="p-4 rounded-2xl bg-[#FAF9F6] border border-[#E7E5E4] space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#E7E5E4]">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-tradeflow-green" />
                <span className="font-bold text-[#1C1917] text-xs">Official Super Admin Details</span>
              </div>
              <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                ● Verified Super Admin Desk
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-stone-400 block text-[10px] uppercase font-bold">Super Admin Name</span>
                <span className="font-bold text-[#1C1917]">{SUPER_ADMIN_CONTACT.name}</span>
              </div>

              <div>
                <span className="text-stone-400 block text-[10px] uppercase font-bold">Toll-Free Helpline</span>
                <a href={`tel:${SUPER_ADMIN_CONTACT.tollFree}`} className="font-bold text-tradeflow-green hover:underline">
                  {SUPER_ADMIN_CONTACT.tollFree}
                </a>
              </div>

              <div>
                <span className="text-stone-400 block text-[10px] uppercase font-bold">Official Email</span>
                <a href={`mailto:${SUPER_ADMIN_CONTACT.email}`} className="font-mono font-semibold text-tradeflow-green hover:underline">
                  {SUPER_ADMIN_CONTACT.email}
                </a>
              </div>

              <div>
                <span className="text-stone-400 block text-[10px] uppercase font-bold">Priority Support Hours</span>
                <span className="font-semibold text-emerald-700 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {SUPER_ADMIN_CONTACT.supportHours}
                </span>
              </div>
            </div>
          </div>

          {/* Urgent Support Callback Request Form */}
          <div className="p-4 rounded-2xl bg-[#FAF9F6] border border-[#E7E5E4] space-y-3">
            <h3 className="font-bold text-[#1C1917] text-xs flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-tradeflow-green" />
              <span>Request Immediate Super Admin Callback</span>
            </h3>

            {submittedSuccess ? (
              <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                <div className="font-bold text-sm text-emerald-900">Callback Request Submitted!</div>
                <p className="text-xs text-emerald-700">
                  Ticket <strong>{submittedTicketNo || 'created'}</strong> is with the Super Admin team. They will call you at <strong className="font-mono">{callbackPhone}</strong>.
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
                  <label className="block font-bold text-[#1C1917] text-[11px] mb-1">Your Contact Phone Number *</label>
                  <input
                    type="text"
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
                    placeholder="e.g. Urgent KYC Approval / Subscription Inquiry / Inventory Issue"
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
                  <span>{isSubmitting ? 'Sending Request...' : 'Send Urgent Request to Super Admin'}</span>
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
