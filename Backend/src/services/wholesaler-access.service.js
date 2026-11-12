const { User, WholesalerProfile, WholesalerSubscription, SubscriptionPayment } = require('../models');
const { ROLES, USER_STATUS, KYC_STATUS } = require('../config/constants');
const { ForbiddenError } = require('../utils/errors');

const WHOLESALER_UNAVAILABLE_MESSAGE = 'This wholesaler is currently unavailable.';
const KYC_APPROVAL_REQUIRED_MESSAGE = 'Approved KYC is required to manage wholesaler business features.';
const SUBSCRIPTION_APPROVAL_REQUIRED_MESSAGE = 'An approved subscription is required to manage wholesaler business features.';

const assertWholesalerAvailable = async (wholesalerId) => {
  const wholesaler = await User.findOne({
    _id: wholesalerId,
    role: ROLES.WHOLESALER,
  }).select('_id status isDeleted').lean();

  if (
    !wholesaler ||
    wholesaler.isDeleted ||
    wholesaler.status === USER_STATUS.BLOCKED ||
    wholesaler.status === USER_STATUS.SUSPENDED
  ) {
    throw new ForbiddenError(WHOLESALER_UNAVAILABLE_MESSAGE, 'WHOLESALER_UNAVAILABLE');
  }

  return wholesaler;
};

const assertWholesalerBusinessActivated = async (wholesalerId) => {
  const profile = await WholesalerProfile.findOne({ userId: wholesalerId })
    .select('kycStatus isDeleted')
    .lean();

  if (!profile || profile.isDeleted) {
    throw new ForbiddenError('Complete KYC to continue', 'KYC_APPROVAL_REQUIRED');
  }

  const kycStatus = String(profile.kycStatus || '').trim().toUpperCase();

  if (kycStatus !== KYC_STATUS.APPROVED) {
    if (kycStatus === KYC_STATUS.SUBMITTED || kycStatus === 'UNDER_REVIEW' || kycStatus === 'PENDING') {
      throw new ForbiddenError('Complete your KYC', 'KYC_PENDING');
    }
    if (kycStatus === KYC_STATUS.REJECTED || kycStatus === 'RESUBMISSION_REQUIRED' || kycStatus === 'RESUBMIT_REQUESTED') {
      throw new ForbiddenError(
        'Your KYC was rejected. Please review feedback and resubmit your KYC details to continue',
        'KYC_REJECTED'
      );
    }
    throw new ForbiddenError('Complete KYC to continue', 'KYC_APPROVAL_REQUIRED');
  }

  const subscription = await WholesalerSubscription.findOne({ userId: wholesalerId });
  const now = new Date();
  if (subscription?.status === 'ACTIVE' && subscription.renewalDate <= now) {
    subscription.status = 'EXPIRED';
    await subscription.save();
  }

  const isActive = subscription?.status === 'ACTIVE' && subscription.renewalDate > now;
  if (!isActive) {
    const pendingApproval = await SubscriptionPayment.exists({
      userId: wholesalerId,
      status: 'PAID',
      approvalStatus: 'PENDING',
    });
    if (pendingApproval) {
      throw new ForbiddenError('Your subscription payment is awaiting Superadmin approval', 'SUBSCRIPTION_PENDING_APPROVAL');
    }
    throw new ForbiddenError(
      subscription ? 'An active subscription is required. Renew or select a plan to continue.' : SUBSCRIPTION_APPROVAL_REQUIRED_MESSAGE,
      subscription ? 'SUBSCRIPTION_EXPIRED' : 'SUBSCRIPTION_REQUIRED',
    );
  }

  return { profile, subscription };
};

module.exports = {
  assertWholesalerAvailable,
  assertWholesalerBusinessActivated,
  WHOLESALER_UNAVAILABLE_MESSAGE,
};
