'use client';

import React, { useState } from 'react';
import {
  ShieldCheck,
  Lock,
  Key,
  Smartphone,
  Laptop,
  Globe,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Mail,
  Check,
  X,
  History,
  ShieldAlert,
  ArrowRight
} from 'lucide-react';
import { useWholesaler } from '@/context/WholesalerContext';

export default function SecurityPage() {
  const {
    profile,
    sessions,
    auditLogs,
    toggleTwoFactor,
    generateNewApiKey,
    terminateSession,
    addAuditLog
  } = useWholesaler();

  // 1. CHANGE PASSWORD STATE & VALIDATION
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  // 3. 2FA EMAIL OTP FLOW STATE
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpStep, setOtpStep] = useState<'REQUEST' | 'ENTER_OTP' | 'SUCCESS'>('REQUEST');
  const [enteredOtp, setEnteredOtp] = useState('');
  const [otpError, setOtpError] = useState<string | null>(null);

  // Handle Change Password Form Submission
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (!currentPassword) {
      setPasswordError('Please enter your current password.');
      return;
    }

    // Password validation rule: min 6 chars with at least 1 letter and 1 number
    if (!/^(?=.*[A-Za-z])(?=.*\d).{6,}$/.test(newPassword)) {
      setPasswordError('New password must be at least 6 characters long and contain at least 1 letter and 1 number.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirm password do not match.');
      return;
    }

    try {
      addAuditLog('Password changed successfully.');
      setPasswordSuccess('Your password has been updated successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordSuccess(null), 4000);
    } catch (err: any) {
      setPasswordError(err?.message || 'Unable to update password. Please check your inputs.');
    }
  };

  // 2FA Enable via Email OTP Flow
  const handleStart2FAFlow = () => {
    if (profile.twoFactorEnabled) {
      // Disable 2FA
      toggleTwoFactor();
    } else {
      // Open OTP Modal to Enable
      setOtpStep('REQUEST');
      setEnteredOtp('');
      setOtpError(null);
      setShowOtpModal(true);
    }
  };

  const handleSendOtp = () => {
    setOtpStep('ENTER_OTP');
  };

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    setOtpError(null);

    if (enteredOtp.trim() !== '123456' && enteredOtp.trim().length !== 6) {
      setOtpError('Invalid OTP code. Please enter the 6-digit OTP (Try demo OTP: 123456).');
      return;
    }

    setOtpStep('SUCCESS');
    toggleTwoFactor();
    setTimeout(() => {
      setShowOtpModal(false);
    }, 2000);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#1F1F1F]">Security & Access Controls</h1>
          <p className="text-xs text-gray-500">Manage password credentials, login activity logs, email OTP 2FA, and account verification status</p>
        </div>
      </div>

      {/* Grid Row 1: Section 4 (Account Status) & Section 3 (Two-Factor Authentication) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* SECTION 4: ACCOUNT STATUS */}
        <div className="bg-white rounded-2xl border border-[#E5E5E5] p-6 shadow-sm hover:shadow-md transition-all space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-2xl bg-[#E8F5E9] text-[#2E7D32] flex items-center justify-center font-bold shadow-xs">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-extrabold uppercase ${
                profile.accountStatus === 'APPROVED'
                  ? 'bg-[#E8F5E9] text-[#2E7D32] border border-[#2E7D32]/20'
                  : 'bg-[#FFF8E1] text-[#F9A825] border border-[#FFE082]'
              }`}>
                {profile.accountStatus === 'APPROVED' ? 'VERIFIED & APPROVED' : 'PENDING ADMIN APPROVAL'}
              </span>
            </div>

            <h2 className="font-extrabold text-base text-[#1F1F1F]">Account Verification Status</h2>
            <p className="text-xs text-gray-500 mt-1">
              Super Admin approval status for wholesale trading on the platform.
            </p>

            <div className="mt-4 p-4 rounded-xl bg-[#FAF9F7] border border-[#E5E5E5] space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-gray-600 font-semibold">Wholesale Business:</span>
                <span className="font-bold text-[#1F1F1F]">{profile.businessName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600 font-semibold">GSTIN Compliance:</span>
                <span className="font-mono font-bold text-[#C62828]">{profile.gstin}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600 font-semibold">Trade License:</span>
                <span className="font-mono text-gray-700">{profile.tradeLicense}</span>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-[#E5E5E5] text-xs">
            {profile.accountStatus === 'APPROVED' ? (
              <div className="flex items-center gap-1.5 text-[#2E7D32] font-semibold">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Account fully verified. Full B2B catalog & retailer features unlocked.</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-[#F9A825] font-semibold">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Account pending Super Admin review. You will receive an email once approved.</span>
              </div>
            )}
          </div>
        </div>

        {/* SECTION 3: TWO-FACTOR AUTHENTICATION (TOGGLE WITH EMAIL OTP FLOW) */}
        <div className="bg-white rounded-2xl border border-[#E5E5E5] p-6 shadow-sm hover:shadow-md transition-all space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-2xl bg-[#FFEBEE] text-[#C62828] flex items-center justify-center font-bold shadow-xs">
                <Lock className="w-6 h-6" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-gray-600">2FA Status:</span>
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase ${
                  profile.twoFactorEnabled ? 'bg-[#E8F5E9] text-[#2E7D32]' : 'bg-gray-100 text-gray-500'
                }`}>
                  {profile.twoFactorEnabled ? 'ENABLED' : 'DISABLED'}
                </span>
              </div>
            </div>

            <h2 className="font-extrabold text-base text-[#1F1F1F]">Two-Factor Authentication (2FA)</h2>
            <p className="text-xs text-gray-500 mt-1">
              Add an extra layer of security by requiring a 6-digit Email OTP whenever you log in.
            </p>

            <div className="mt-4 p-4 rounded-xl bg-[#FAF9F7] border border-[#E5E5E5] flex items-center justify-between text-xs">
              <div className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-[#C62828] shrink-0" />
                <div>
                  <div className="font-bold text-[#1F1F1F]">OTP Verification Email</div>
                  <div className="text-gray-500 font-mono text-[11px]">{profile.email}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-[#E5E5E5] flex items-center justify-between">
            <span className="text-xs font-bold text-gray-700">Toggle 2FA Email OTP Protection</span>
            <button
              onClick={handleStart2FAFlow}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                profile.twoFactorEnabled
                  ? 'bg-red-50 text-red-600 hover:bg-red-100'
                  : 'bg-[#C62828] text-white hover:bg-[#B71C1C] shadow-md'
              }`}
            >
              {profile.twoFactorEnabled ? 'Disable 2FA' : 'Enable Email OTP 2FA'}
            </button>
          </div>
        </div>
      </div>

      {/* SECTION 1: CHANGE PASSWORD FORM */}
      <div className="bg-white rounded-2xl border border-[#E5E5E5] p-6 shadow-sm hover:shadow-md transition-all space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#E5E5E5]">
          <div className="flex items-center gap-2">
            <Key className="w-5 h-5 text-[#C62828]" />
            <h2 className="text-base font-extrabold text-[#1F1F1F]">Change Password</h2>
          </div>
          <span className="text-xs text-gray-400 font-medium">Min 6 characters, letter + number</span>
        </div>

        {passwordError && (
          <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-600 font-bold flex items-center gap-2">
            <XCircle className="w-4 h-4 shrink-0" />
            <span>{passwordError}</span>
          </div>
        )}

        {passwordSuccess && (
          <div className="p-3.5 rounded-xl bg-[#E8F5E9] border border-[#2E7D32]/20 text-xs text-[#2E7D32] font-bold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{passwordSuccess}</span>
          </div>
        )}

        <form onSubmit={handleChangePassword} className="space-y-4 text-xs max-w-2xl">
          <div>
            <label className="block font-bold text-gray-700 mb-1">Current Password *</label>
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter current password"
              className="w-full px-3.5 py-2.5 bg-[#FAF9F7] border border-[#E5E5E5] rounded-xl focus:border-[#C62828] focus:ring-1 focus:ring-[#C62828]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-gray-700 mb-1">New Password *</label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min 6 chars with letter & number"
                className="w-full px-3.5 py-2.5 bg-[#FAF9F7] border border-[#E5E5E5] rounded-xl focus:border-[#C62828] focus:ring-1 focus:ring-[#C62828]"
              />
            </div>

            <div>
              <label className="block font-bold text-gray-700 mb-1">Confirm New Password *</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                className="w-full px-3.5 py-2.5 bg-[#FAF9F7] border border-[#E5E5E5] rounded-xl focus:border-[#C62828] focus:ring-1 focus:ring-[#C62828]"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="px-6 py-2.5 bg-[#C62828] text-white text-xs font-bold rounded-xl hover:bg-[#B71C1C] shadow-md transition-all"
            >
              Update Password
            </button>
          </div>
        </form>
      </div>

      {/* SECTION 2: LOGIN ACTIVITY TABLE */}
      <div className="bg-white rounded-2xl border border-[#E5E5E5] p-6 shadow-sm hover:shadow-md transition-all space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#E5E5E5]">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-[#C62828]" />
            <h2 className="text-base font-extrabold text-[#1F1F1F]">Login Activity</h2>
          </div>
          <span className="text-xs text-gray-400 font-mono">Recent Authentication Events</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#E5E5E5] text-gray-400 font-bold uppercase tracking-wider">
                <th className="pb-3">Date & Time</th>
                <th className="pb-3">Device / Browser</th>
                <th className="pb-3">IP Address</th>
                <th className="pb-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E5E5]">
              {[
                { date: '2026-03-15 08:30:12 AM', device: 'Chrome on Windows 11 (Desktop)', ip: '103.21.124.89', status: 'Success' },
                { date: '2026-03-14 02:22:45 PM', device: 'Safari on iPhone 15 Pro (Mobile)', ip: '106.51.44.12', status: 'Success' },
                { date: '2026-03-12 11:05:10 AM', device: 'Firefox on macOS Sonoma', ip: '115.240.90.15', status: 'Success' },
                { date: '2026-03-10 11:14:02 PM', device: 'Unknown Client', ip: '45.12.89.2', status: 'Failed' },
              ].map((activity, idx) => (
                <tr key={idx} className="hover:bg-[#FAF9F7] transition-colors">
                  <td className="py-3.5 font-mono text-[#1F1F1F] font-bold">{activity.date}</td>
                  <td className="py-3.5 text-gray-700 font-medium">{activity.device}</td>
                  <td className="py-3.5 font-mono text-gray-500">{activity.ip}</td>
                  <td className="py-3.5 text-right">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase ${
                      activity.status === 'Success'
                        ? 'bg-[#E8F5E9] text-[#2E7D32] border border-[#2E7D32]/20'
                        : 'bg-red-50 text-red-600 border border-red-200'
                    }`}>
                      {activity.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* EMAIL OTP 2FA ENABLEMENT MODAL */}
      {showOtpModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 border border-[#E5E5E5] shadow-2xl text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5E5E5]">
              <h2 className="text-base font-extrabold text-[#1F1F1F]">Enable Email OTP 2FA</h2>
              <button onClick={() => setShowOtpModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {otpStep === 'REQUEST' && (
              <div className="space-y-4 text-center py-4">
                <div className="w-12 h-12 bg-[#FFEBEE] text-[#C62828] rounded-full flex items-center justify-center mx-auto font-bold">
                  <Mail className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-[#1F1F1F]">Send OTP Verification Code</h3>
                  <p className="text-gray-600 text-xs mt-1">
                    We will send a 6-digit One-Time Password to <strong className="text-[#1F1F1F] font-mono">{profile.email}</strong> to verify 2FA setup.
                  </p>
                </div>
                <button
                  onClick={handleSendOtp}
                  className="w-full py-2.5 bg-[#C62828] text-white font-bold rounded-xl hover:bg-[#B71C1C] shadow-md transition-all"
                >
                  Send OTP Code
                </button>
              </div>
            )}

            {otpStep === 'ENTER_OTP' && (
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Enter 6-Digit Email OTP *</label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={enteredOtp}
                    onChange={(e) => setEnteredOtp(e.target.value.replace(/\D/g, ''))}
                    placeholder="Enter 123456"
                    className="w-full px-3.5 py-2.5 bg-[#FAF9F7] border border-[#E5E5E5] rounded-xl font-mono text-center text-lg font-black tracking-widest focus:border-[#C62828]"
                  />
                  <span className="text-[10px] text-gray-400 mt-1 block text-center">
                    Check your email inbox. (Demo OTP: <code className="font-bold text-[#C62828]">123456</code>)
                  </span>
                </div>

                {otpError && (
                  <div className="p-2.5 bg-red-50 text-red-600 rounded-xl font-bold text-center">
                    {otpError}
                  </div>
                )}

                <div className="pt-2 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setOtpStep('REQUEST')}
                    className="font-bold text-gray-500 hover:text-gray-800"
                  >
                    Resend OTP
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-[#2E7D32] text-white font-bold rounded-xl hover:bg-[#1b5e20] shadow-md"
                  >
                    Verify & Enable 2FA
                  </button>
                </div>
              </form>
            )}

            {otpStep === 'SUCCESS' && (
              <div className="py-6 text-center space-y-3">
                <div className="w-14 h-14 bg-[#E8F5E9] text-[#2E7D32] rounded-full flex items-center justify-center mx-auto font-bold">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div className="font-extrabold text-base text-[#1F1F1F]">2FA Successfully Enabled!</div>
                <p className="text-xs text-gray-600">
                  Your wholesaler account is now protected with 2-Factor Email OTP verification.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
