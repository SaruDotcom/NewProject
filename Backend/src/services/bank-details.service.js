const { KycApplication } = require('../models');

const BANK_DETAIL_FIELDS = ['accountHolderName', 'bankName', 'accountNumber', 'ifscCode', 'branch'];
const ACCOUNT_HOLDER_PATTERN = /^[\p{L}][\p{L}\s.'-]{1,99}$/u;
const BANK_NAME_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N}\s&.'()-]{1,99}$/u;
const ACCOUNT_NUMBER_PATTERN = /^\d{9,18}$/;
const IFSC_PATTERN = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const BRANCH_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N}\s&.'()-]{1,99}$/u;

function normalizeBankDetails(details = {}) {
  return Object.fromEntries(BANK_DETAIL_FIELDS.map((field) => {
    const value = String(details[field] || '').trim();
    return [field, field === 'ifscCode' ? value.toUpperCase() : value];
  }));
}

function hasAnyBankDetails(details = {}) {
  return BANK_DETAIL_FIELDS.some((field) => String(details[field] || '').trim());
}

function hasValidBankDetails(details = {}) {
  const normalized = normalizeBankDetails(details);
  return ACCOUNT_HOLDER_PATTERN.test(normalized.accountHolderName) &&
    BANK_NAME_PATTERN.test(normalized.bankName) &&
    ACCOUNT_NUMBER_PATTERN.test(normalized.accountNumber) &&
    IFSC_PATTERN.test(normalized.ifscCode) &&
    BRANCH_PATTERN.test(normalized.branch);
}

function bankDetailsMatch(left = {}, right = {}) {
  const normalizedLeft = normalizeBankDetails(left);
  const normalizedRight = normalizeBankDetails(right);
  return BANK_DETAIL_FIELDS.every((field) => normalizedLeft[field] === normalizedRight[field]);
}

async function isBankDetailsVerified(profile, details = profile?.bankDetails || {}) {
  if (!profile || profile.kycStatus !== 'APPROVED' || profile.isVerified !== true || !hasValidBankDetails(details)) {
    return false;
  }

  const verificationStatus = details.verificationStatus ?? profile.bankDetails?.verificationStatus;
  const legacyVerified = details.isVerified ?? profile.bankDetails?.isVerified;
  if (verificationStatus === 'APPROVED') return true;
  if (['PENDING', 'REJECTED'].includes(verificationStatus)) return false;
  if (legacyVerified !== true) return false;

  // Preserve accounts approved through the previous KYC-matching workflow.
  const approvedApplication = await KycApplication.findOne({
    wholesalerId: profile.userId,
    status: 'APPROVED',
  }).select('bankDetails').lean();

  return Boolean(
    approvedApplication &&
    hasValidBankDetails(approvedApplication.bankDetails) &&
    bankDetailsMatch(details, approvedApplication.bankDetails)
  );
}

module.exports = {
  BANK_DETAIL_FIELDS,
  bankDetailsMatch,
  hasAnyBankDetails,
  hasValidBankDetails,
  isBankDetailsVerified,
  normalizeBankDetails,
};
