const crypto = require('crypto');
const {
  PlatformSetting,
  User,
  WholesalerProfile,
  WholesalerReferral,
  WholesalerReferralCommission,
} = require('../../models');
const { AUDIT_ACTION, KYC_STATUS, ROLES, USER_STATUS } = require('../../config/constants');
const {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} = require('../../utils/errors');
const { parsePagination } = require('../../utils/pagination');
const AuditService = require('../../services/audit.service');
const NotificationService = require('../../services/notification.service');

const SETTINGS_KEY = 'WHOLESALER_REFERRAL_PROGRAM';
const DEFAULT_COMMISSION_AMOUNT = 300;
const CODE_CHARACTERS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const COMMISSION_STATUSES = ['PENDING', 'APPROVED', 'PROCESSING', 'PAID', 'REJECTED'];

const generateCode = () => `WS${Array.from(
  { length: 6 },
  () => CODE_CHARACTERS[crypto.randomInt(CODE_CHARACTERS.length)]
).join('')}`;

const maskAccountNumber = (accountNumber) => {
  const value = String(accountNumber || '');
  return value ? `•••• ${value.slice(-4)}` : '';
};

const isValidObjectId = (id) => /^[a-f\d]{24}$/i.test(String(id || ''));

class WholesalerReferralProgramService {
  static async ensureReferralCode(profile) {
    const existingCode = String(profile.wholesalerReferralCode || '').trim().toUpperCase();
    if (/^[A-Z0-9]{6,12}$/.test(existingCode)) return existingCode;

    const filter = {
      _id: profile._id,
      isDeleted: { $ne: true },
      $or: [
        { wholesalerReferralCode: { $exists: false } },
        { wholesalerReferralCode: null },
        { wholesalerReferralCode: '' },
      ],
    };

    for (let attempt = 0; attempt < 10; attempt += 1) {
      try {
        const savedProfile = await WholesalerProfile.findOneAndUpdate(
          filter,
          { $set: { wholesalerReferralCode: generateCode() } },
          { new: true, runValidators: true }
        );
        if (savedProfile) {
          profile.wholesalerReferralCode = savedProfile.wholesalerReferralCode;
          return savedProfile.wholesalerReferralCode;
        }

        const latestProfile = await WholesalerProfile.findById(profile._id)
          .select('wholesalerReferralCode isDeleted')
          .lean();
        const latestCode = String(latestProfile?.wholesalerReferralCode || '').trim().toUpperCase();
        if (latestProfile && latestProfile.isDeleted !== true && /^[A-Z0-9]{6,12}$/.test(latestCode)) {
          profile.wholesalerReferralCode = latestCode;
          return latestCode;
        }
        throw new ConflictError('Unable to generate a referral code. Please try again.', 'REFERRAL_CODE_GENERATION_FAILED');
      } catch (error) {
        if (error.code !== 11000 || attempt === 9) throw error;
      }
    }

    throw new ConflictError('Unable to generate a unique referral code. Please try again.', 'REFERRAL_CODE_GENERATION_FAILED');
  }

  static async resolveReferrer(code) {
    const normalizedCode = String(code || '').trim().toUpperCase();
    if (!/^[A-Z0-9]{6,12}$/.test(normalizedCode)) {
      throw new NotFoundError('This wholesaler referral code is invalid.', 'INVALID_WHOLESALER_REFERRAL');
    }

    const profile = await WholesalerProfile.findOne({
      wholesalerReferralCode: normalizedCode,
      isDeleted: { $ne: true },
    });
    if (!profile) {
      throw new NotFoundError('This wholesaler referral code is invalid.', 'INVALID_WHOLESALER_REFERRAL');
    }

    const user = await User.findOne({
      _id: profile.userId,
      role: ROLES.WHOLESALER,
      status: USER_STATUS.ACTIVE,
      isDeleted: { $ne: true },
    }).select('_id name status role').lean();
    if (!user) {
      throw new ForbiddenError('This wholesaler account is not available for referrals.', 'REFERRER_UNAVAILABLE');
    }

    return { profile, user };
  }

  static async validateCode(code) {
    const { profile, user } = await this.resolveReferrer(code);
    return {
      valid: true,
      code: profile.wholesalerReferralCode,
      businessName: profile.businessName || user.name,
    };
  }

  static async recordRegistration(referrerId, referralCode, referredUser, referredProfile) {
    if (String(referrerId) === String(referredUser._id)) {
      throw new BadRequestError('You cannot refer your own wholesaler account.', 'SELF_REFERRAL_NOT_ALLOWED');
    }

    const existingReferrerId = referredProfile.referredByWholesalerId
      ? String(referredProfile.referredByWholesalerId)
      : '';
    if (existingReferrerId && existingReferrerId !== String(referrerId)) {
      throw new ConflictError('This wholesaler already has a referral attribution.', 'REFERRAL_ALREADY_ATTRIBUTED');
    }

    const referral = await WholesalerReferral.findOneAndUpdate(
      { referredWholesalerId: referredUser._id },
      {
        $setOnInsert: {
          referrerId,
          referredWholesalerId: referredUser._id,
          referralCode: String(referralCode).trim().toUpperCase(),
          registeredAt: referredProfile.wholesalerReferralAt || new Date(),
          status: 'REGISTERED',
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).catch(async (error) => {
      if (error.code !== 11000) throw error;
      return WholesalerReferral.findOne({ referredWholesalerId: referredUser._id });
    });

    if (!referral || String(referral.referrerId) !== String(referrerId)) {
      throw new ConflictError('This wholesaler already has a different referral attribution.', 'REFERRAL_ALREADY_ATTRIBUTED');
    }
    return referral;
  }

  static async ensureReferralRecord(profile) {
    if (!profile.referredByWholesalerId) return null;
    return this.recordRegistration(
      profile.referredByWholesalerId,
      profile.wholesalerReferralCodeUsed,
      { _id: profile.userId },
      profile
    );
  }

  static async getCommissionAmount() {
    const setting = await PlatformSetting.findOne({ key: SETTINGS_KEY }).select('value').lean();
    if (!setting) return DEFAULT_COMMISSION_AMOUNT;

    const amount = Number(setting.value?.commissionAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error('Configured wholesaler referral commission amount is invalid.');
    }
    return Math.round(amount * 100) / 100;
  }

  static async getCommissionSettings() {
    return { commissionAmount: await this.getCommissionAmount(), currency: 'INR' };
  }

  static async updateCommissionSettings({ commissionAmount }, adminUser, req = null) {
    const amount = Number(commissionAmount);
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1000000) {
      throw new BadRequestError('Commission amount must be greater than ₹0 and no more than ₹10,00,000.', 'INVALID_REFERRAL_COMMISSION_AMOUNT');
    }

    const saved = await PlatformSetting.findOneAndUpdate(
      { key: SETTINGS_KEY },
      {
        $set: {
          value: { commissionAmount: Math.round(amount * 100) / 100 },
          description: 'Commission paid for each eligible wholesaler referral.',
          updatedBy: adminUser._id,
        },
      },
      { new: true, upsert: true, runValidators: true }
    );

    await AuditService.log({
      actorId: adminUser._id,
      actorRole: adminUser.role,
      action: AUDIT_ACTION.UPDATE,
      entityType: 'PlatformSetting',
      entityId: saved._id,
      after: { key: SETTINGS_KEY, value: saved.value },
      req,
    });

    return { commissionAmount: Number(saved.value.commissionAmount), currency: 'INR' };
  }

  static async onKycApproved(referredWholesalerId, adminUser = null, req = null) {
    const [profile, user] = await Promise.all([
      WholesalerProfile.findOne({ userId: referredWholesalerId, isDeleted: { $ne: true } }),
      User.findById(referredWholesalerId).select('role status isDeleted').lean(),
    ]);
    if (!profile?.referredByWholesalerId || !user) return null;
    if (user.role !== ROLES.WHOLESALER || user.status !== USER_STATUS.ACTIVE || user.isDeleted) return null;
    if (profile.kycStatus !== KYC_STATUS.APPROVED) return null;

    const referral = await this.ensureReferralRecord(profile);
    if (!referral || String(referral.referrerId) === String(referredWholesalerId)) return null;
    const referredPan = String(profile.pan || '').trim().toUpperCase();
    const duplicatePanProfile = referredPan
      ? await WholesalerProfile.findOne({
          pan: referredPan,
          userId: { $ne: referredWholesalerId },
          isDeleted: { $ne: true },
        }).select('userId').lean()
      : null;
    if (duplicatePanProfile) {
      const reason = String(duplicatePanProfile.userId) === String(referral.referrerId)
        ? 'Self-referrals are not eligible for commission.'
        : 'A wholesaler account with this PAN is already registered.';
      await WholesalerReferral.updateOne(
        { _id: referral._id },
        { $set: { status: 'REJECTED', rejectionReason: reason } }
      );
      await AuditService.log({
        actorId: adminUser?._id,
        actorRole: adminUser?.role || ROLES.SUPER_ADMIN,
        action: AUDIT_ACTION.UPDATE,
        entityType: 'WholesalerReferral',
        entityId: referral._id,
        after: { status: 'REJECTED', reason },
        req,
      });
      return null;
    }

    const now = new Date();
    await WholesalerReferral.updateOne(
      { _id: referral._id },
      { $set: { status: 'QUALIFIED', kycApprovedAt: now, rejectionReason: '' } }
    );

    let commission = await WholesalerReferralCommission.findOne({
      referredWholesalerId,
    });
    let created = false;
    if (!commission) {
      try {
        commission = await WholesalerReferralCommission.create({
          referralId: referral._id,
          referrerId: referral.referrerId,
          referredWholesalerId,
          amount: await this.getCommissionAmount(),
          status: 'PENDING',
          eligibleAt: now,
          statusHistory: [{ status: 'PENDING', changedBy: adminUser?._id, changedAt: now }],
        });
        created = true;
      } catch (error) {
        if (error.code !== 11000) throw error;
        commission = await WholesalerReferralCommission.findOne({ referredWholesalerId });
      }
    }

    if (!commission) {
      throw new ConflictError('Referral commission could not be created.', 'REFERRAL_COMMISSION_CREATION_FAILED');
    }
    if (created) {
      await NotificationService.notify({
        recipientId: referral.referrerId,
        title: 'Wholesaler referral earned',
        message: `Your referral has completed KYC. ₹${commission.amount} is pending Superadmin review.`,
        data: { referralId: referral._id, commissionId: commission._id, status: commission.status },
      });
      await AuditService.log({
        actorId: adminUser?._id,
        actorRole: adminUser?.role || ROLES.SUPER_ADMIN,
        action: AUDIT_ACTION.CREATE,
        entityType: 'WholesalerReferralCommission',
        entityId: commission._id,
        after: { status: commission.status, amount: commission.amount },
        req,
      });
    }
    return commission;
  }

  static async onKycRejected(referredWholesalerId, reason, adminUser = null, req = null) {
    const referredProfile = await WholesalerProfile.findOne({ userId: referredWholesalerId })
      .select('userId referredByWholesalerId wholesalerReferralCodeUsed wholesalerReferralAt');
    const referral = referredProfile?.referredByWholesalerId
      ? await this.ensureReferralRecord(referredProfile)
      : await WholesalerReferral.findOne({ referredWholesalerId });
    if (!referral) return null;

    await WholesalerReferral.updateOne(
      { _id: referral._id },
      { $set: { status: 'REJECTED', rejectionReason: String(reason || '').slice(0, 500) } }
    );
    const commission = await WholesalerReferralCommission.findOneAndUpdate(
      { referredWholesalerId, status: { $in: ['PENDING', 'APPROVED'] } },
      {
        $set: {
          status: 'REJECTED',
          rejectedAt: new Date(),
          rejectedBy: adminUser?._id,
          rejectionReason: "The referred wholesaler's KYC was rejected.",
        },
        $push: {
          statusHistory: {
            status: 'REJECTED',
            changedBy: adminUser?._id,
            reason: "The referred wholesaler's KYC was rejected.",
          },
        },
      },
      { new: true }
    );

    if (commission) {
      await AuditService.log({
        actorId: adminUser?._id,
        actorRole: adminUser?.role || ROLES.SUPER_ADMIN,
        action: AUDIT_ACTION.UPDATE,
        entityType: 'WholesalerReferralCommission',
        entityId: commission._id,
        after: { status: commission.status, reason: commission.rejectionReason },
        req,
      });
    }
    return commission;
  }

  static async getWholesalerDashboard(wholesalerUser, query = {}) {
    const [profile, user] = await Promise.all([
      WholesalerProfile.findOne({
        userId: wholesalerUser._id,
        isDeleted: { $ne: true },
      }),
      User.findOne({
        _id: wholesalerUser._id,
        role: ROLES.WHOLESALER,
        status: USER_STATUS.ACTIVE,
        isDeleted: { $ne: true },
      }).select('_id').lean(),
    ]);
    if (!profile) throw new NotFoundError('Wholesaler profile not found.');
    if (!user) throw new ForbiddenError('This wholesaler account is not available.', 'REFERRER_UNAVAILABLE');

    const code = await this.ensureReferralCode(profile);
    await this.ensureReferralRecord(profile);
    const { page, limit, skip } = parsePagination(query);
    const [referrals, referralCount, referringWholesalers, commissionTotals] = await Promise.all([
      WholesalerReferral.find({ referrerId: wholesalerUser._id })
        .sort({ registeredAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('referredWholesalerId', 'name email status')
        .lean(),
      WholesalerReferral.countDocuments({ referrerId: wholesalerUser._id }),
      WholesalerReferral.countDocuments({ referrerId: wholesalerUser._id, status: 'QUALIFIED' }),
      WholesalerReferralCommission.aggregate([
        { $match: { referrerId: wholesalerUser._id } },
        { $group: { _id: '$status', amount: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
    ]);
    const commissionAmount = await this.getCommissionAmount();

    const referralIds = referrals.map((referral) => referral._id);
    const [commissions, profiles] = await Promise.all([
      referralIds.length
        ? WholesalerReferralCommission.find({ referralId: { $in: referralIds } }).lean()
        : [],
      referrals.length
        ? WholesalerProfile.find({
            userId: { $in: referrals.map((referral) => referral.referredWholesalerId?._id).filter(Boolean) },
          }).select('userId businessName').lean()
        : [],
    ]);
    const commissionByReferral = new Map(commissions.map((commission) => [String(commission.referralId), commission]));
    const profileByUser = new Map(profiles.map((item) => [String(item.userId), item]));
    const totals = Object.fromEntries(commissionTotals.map((item) => [item._id, item.amount]));
    const earnedStatuses = ['PENDING', 'APPROVED', 'PROCESSING', 'PAID'];
    const totalCommissionEarned = earnedStatuses.reduce((sum, status) => sum + (totals[status] || 0), 0);

    return {
      code,
      commissionAmount,
      summary: {
        totalReferrals: referralCount,
        successfulReferrals: referringWholesalers,
        pendingCommissions: totals.PENDING || 0,
        totalCommissionEarned,
        totalCommissionPaid: totals.PAID || 0,
        availableCommissionBalance: totals.APPROVED || 0,
      },
      referrals: referrals.map((referral) => {
        const commission = commissionByReferral.get(String(referral._id));
        const referred = referral.referredWholesalerId || {};
        const referredProfile = profileByUser.get(String(referred._id));
        return {
          id: String(referral._id),
          referredWholesalerId: String(referred._id || ''),
          wholesalerName: referredProfile?.businessName || referred.name || 'Wholesaler',
          referralDate: referral.registeredAt,
          commissionAmount: commission?.amount || 0,
          commissionStatus: commission?.status || (referral.status === 'REJECTED' ? 'REJECTED' : 'AWAITING_KYC'),
          eligibleAt: commission?.eligibleAt || null,
          approvedAt: commission?.approvedAt || null,
          paidAt: commission?.paidAt || null,
          transactionReference: commission?.transactionReference || '',
          rejectionReason: commission?.rejectionReason || referral.rejectionReason || '',
        };
      }),
      pagination: { page, limit, total: referralCount, totalPages: Math.ceil(referralCount / limit) },
    };
  }

  static async getAdminSummary() {
    const [referringIds, totalReferred, totals] = await Promise.all([
      WholesalerReferral.distinct('referrerId'),
      WholesalerReferral.countDocuments({}),
      WholesalerReferralCommission.aggregate([
        { $group: { _id: '$status', amount: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
    ]);
    const amounts = Object.fromEntries(totals.map((item) => [item._id, item.amount]));
    return {
      totalReferringWholesalers: referringIds.length,
      totalReferredWholesalers: totalReferred,
      totalCommissionGenerated: totals.reduce((sum, item) => sum + item.amount, 0),
      pendingCommission: amounts.PENDING || 0,
      approvedCommission: amounts.APPROVED || 0,
      processingCommission: amounts.PROCESSING || 0,
      totalCommissionPaid: amounts.PAID || 0,
    };
  }

  static async listAdminCommissions(query = {}) {
    const { page, limit, skip } = parsePagination(query);
    const filter = {};
    if (query.status && query.status !== 'all') {
      const status = String(query.status).toUpperCase();
      if (!COMMISSION_STATUSES.includes(status)) {
        throw new BadRequestError('Invalid commission status filter.', 'INVALID_COMMISSION_STATUS');
      }
      filter.status = status;
    }

    const [commissions, total] = await Promise.all([
      WholesalerReferralCommission.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('referrerId', 'name email status')
        .populate('referredWholesalerId', 'name email status')
        .lean(),
      WholesalerReferralCommission.countDocuments(filter),
    ]);
    const referralIds = commissions.map((commission) => commission.referralId);
    const [referrals, profiles] = await Promise.all([
      referralIds.length ? WholesalerReferral.find({ _id: { $in: referralIds } }).select('_id registeredAt').lean() : [],
      commissions.length
        ? WholesalerProfile.find({
            userId: {
              $in: commissions.flatMap((commission) => [
                commission.referrerId?._id,
                commission.referredWholesalerId?._id,
              ]).filter(Boolean),
            },
          }).select('userId businessName kycStatus bankDetails').lean()
        : [],
    ]);
    const referralById = new Map(referrals.map((referral) => [String(referral._id), referral]));
    const profileByUser = new Map(profiles.map((profile) => [String(profile.userId), profile]));

    return {
      items: commissions.map((commission) => {
        const referringUser = commission.referrerId || {};
        const referredUser = commission.referredWholesalerId || {};
        const referringProfile = profileByUser.get(String(referringUser._id));
        const referredProfile = profileByUser.get(String(referredUser._id));
        const bank = referringProfile?.bankDetails || {};
        const bankApproved = (
          referringProfile?.kycStatus === KYC_STATUS.APPROVED
          && referringUser.status === USER_STATUS.ACTIVE
          && bank.verificationStatus === 'APPROVED'
          && bank.isVerified === true
          && Boolean(bank.approvedAt && bank.approvedBy)
          && Boolean(bank.accountHolderName && bank.bankName && bank.accountNumber && bank.ifscCode)
        );
        return {
          id: String(commission._id),
          referrer: {
            id: String(referringUser._id || ''),
            name: referringUser.name || '',
            businessName: referringProfile?.businessName || '',
          },
          referred: {
            id: String(referredUser._id || ''),
            name: referredUser.name || '',
            businessName: referredProfile?.businessName || '',
          },
          referralDate: referralById.get(String(commission.referralId))?.registeredAt || commission.createdAt,
          commissionAmount: commission.amount,
          commissionStatus: commission.status,
          paymentDetails: {
            bankApproved,
            bankName: bankApproved ? bank.bankName || '' : '',
            accountNumber: bankApproved ? maskAccountNumber(bank.accountNumber) : '',
            ifscCode: bankApproved ? bank.ifscCode || '' : '',
            branch: bankApproved ? bank.branch || '' : '',
          },
          transactionReference: commission.transactionReference || '',
          paymentDate: commission.paidAt || null,
          rejectionReason: commission.rejectionReason || '',
        };
      }),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  static async getCommissionOrThrow(id) {
    if (!isValidObjectId(id)) throw new NotFoundError('Referral commission not found.');
    const commission = await WholesalerReferralCommission.findById(id);
    if (!commission) throw new NotFoundError('Referral commission not found.');
    return commission;
  }

  static async reviewCommission(id, { decision, reason }, adminUser, req = null) {
    const commission = await this.getCommissionOrThrow(id);
    if (decision === 'approve') {
      const [referredProfile, referredUser] = await Promise.all([
        WholesalerProfile.findOne({ userId: commission.referredWholesalerId }),
        User.findById(commission.referredWholesalerId).select('role status isDeleted').lean(),
      ]);
      if (
        !referredProfile
        || referredProfile.kycStatus !== KYC_STATUS.APPROVED
        || referredUser?.role !== ROLES.WHOLESALER
        || referredUser?.status !== USER_STATUS.ACTIVE
        || referredUser?.isDeleted
      ) {
        throw new ConflictError('The referred wholesaler must have active, approved KYC before commission approval.', 'REFERRAL_NOT_ELIGIBLE');
      }
      const updated = await WholesalerReferralCommission.findOneAndUpdate(
        { _id: commission._id, status: 'PENDING' },
        {
          $set: { status: 'APPROVED', approvedAt: new Date(), approvedBy: adminUser._id },
          $push: { statusHistory: { status: 'APPROVED', changedBy: adminUser._id } },
        },
        { new: true }
      );
      if (!updated) throw new ConflictError('Only pending commissions can be approved.', 'COMMISSION_NOT_PENDING');
      await this.recordAdminDecision(updated, adminUser, 'APPROVED', req);
      await NotificationService.notify({
        recipientId: updated.referrerId,
        title: 'Referral commission approved',
        message: `Your ₹${updated.amount} wholesaler referral commission has been approved.`,
        data: { commissionId: updated._id, status: updated.status },
      });
      return updated;
    }

    if (decision !== 'reject' || !String(reason || '').trim()) {
      throw new BadRequestError('Choose approve or provide a rejection reason.', 'COMMISSION_REVIEW_INVALID');
    }
    const rejectionReason = String(reason).trim().slice(0, 500);
    const updated = await WholesalerReferralCommission.findOneAndUpdate(
      { _id: commission._id, status: { $in: ['PENDING', 'APPROVED'] } },
      {
        $set: {
          status: 'REJECTED',
          rejectedAt: new Date(),
          rejectedBy: adminUser._id,
          rejectionReason,
        },
        $push: {
          statusHistory: { status: 'REJECTED', changedBy: adminUser._id, reason: rejectionReason },
        },
      },
      { new: true }
    );
    if (!updated) throw new ConflictError('This commission can no longer be rejected.', 'COMMISSION_NOT_REJECTABLE');
    await this.recordAdminDecision(updated, adminUser, 'REJECTED', req, rejectionReason);
    await NotificationService.notify({
      recipientId: updated.referrerId,
      title: 'Referral commission rejected',
      message: `Your ₹${updated.amount} wholesaler referral commission was rejected. Reason: ${rejectionReason}`,
      data: { commissionId: updated._id, status: updated.status, reason: rejectionReason },
    });
    return updated;
  }

  static async startManualPayout(id, adminUser, req = null) {
    const commission = await this.getCommissionOrThrow(id);
    const [profile, referrer] = await Promise.all([
      WholesalerProfile.findOne({ userId: commission.referrerId }),
      User.findById(commission.referrerId).select('role status isDeleted').lean(),
    ]);
    if (
      !profile
      || profile.kycStatus !== KYC_STATUS.APPROVED
      || referrer?.role !== ROLES.WHOLESALER
      || referrer?.status !== USER_STATUS.ACTIVE
      || referrer?.isDeleted
    ) {
      throw new ForbiddenError('The referring wholesaler must have active, approved KYC before payout.', 'REFERRER_KYC_REQUIRED');
    }

    const bank = profile.bankDetails || {};
    if (
      bank.verificationStatus !== 'APPROVED'
      || bank.isVerified !== true
      || !bank.approvedAt
      || !bank.approvedBy
      || !bank.accountHolderName
      || !bank.bankName
      || !bank.accountNumber
      || !bank.ifscCode
    ) {
      throw new ForbiddenError('Payout requires Superadmin-approved bank details for the referring wholesaler.', 'APPROVED_BANK_DETAILS_REQUIRED');
    }

    const updated = await WholesalerReferralCommission.findOneAndUpdate(
      { _id: commission._id, status: 'APPROVED' },
      {
        $set: {
          status: 'PROCESSING',
          processingAt: new Date(),
          processedBy: adminUser._id,
          payoutBankSnapshot: {
            bankName: bank.bankName || '',
            accountLast4: String(bank.accountNumber).slice(-4),
            ifscCode: bank.ifscCode || '',
            branch: bank.branch || '',
          },
        },
        $push: { statusHistory: { status: 'PROCESSING', changedBy: adminUser._id } },
      },
      { new: true }
    );
    if (!updated) throw new ConflictError('Only approved commissions can enter payout processing.', 'COMMISSION_NOT_APPROVED');

    await this.recordAdminDecision(updated, adminUser, 'PROCESSING', req);
    await NotificationService.notify({
      recipientId: updated.referrerId,
      title: 'Referral payout processing',
      message: `Your ₹${updated.amount} referral commission is being paid by manual bank transfer.`,
      data: { commissionId: updated._id, status: updated.status },
    });
    return updated;
  }

  static async confirmManualPayment(id, { transactionReference }, adminUser, req = null) {
    const reference = String(transactionReference || '').trim();
    if (reference.length < 2 || reference.length > 120) {
      throw new BadRequestError('Enter the bank transfer transaction reference (2–120 characters).', 'INVALID_TRANSACTION_REFERENCE');
    }
    const commission = await this.getCommissionOrThrow(id);
    if (commission.status === 'PAID') {
      if (commission.transactionReference === reference) return commission;
      throw new ConflictError('This commission has already been paid with a different reference.', 'COMMISSION_ALREADY_PAID');
    }
    if (commission.status !== 'PROCESSING') {
      throw new ConflictError('Only processing commissions can be marked paid.', 'COMMISSION_NOT_PROCESSING');
    }

    let updated;
    try {
      updated = await WholesalerReferralCommission.findOneAndUpdate(
        { _id: commission._id, status: 'PROCESSING' },
        {
          $set: {
            status: 'PAID',
            transactionReference: reference,
            paidAt: new Date(),
            paidBy: adminUser._id,
          },
          $push: {
            statusHistory: {
              status: 'PAID',
              changedBy: adminUser._id,
              transactionReference: reference,
            },
          },
        },
        { new: true, runValidators: true }
      );
    } catch (error) {
      if (error.code === 11000) {
        throw new ConflictError('This transaction reference is already recorded.', 'TRANSACTION_REFERENCE_ALREADY_USED');
      }
      throw error;
    }
    if (!updated) throw new ConflictError('This commission is no longer processing.', 'COMMISSION_NOT_PROCESSING');

    await this.recordAdminDecision(updated, adminUser, 'PAID', req, reference);
    await NotificationService.notify({
      recipientId: updated.referrerId,
      title: 'Referral commission paid',
      message: `₹${updated.amount} has been recorded as paid by manual bank transfer. Reference: ${reference}`,
      data: { commissionId: updated._id, status: updated.status, transactionReference: reference },
    });
    return updated;
  }

  static async getPayoutBankDetails(id, adminUser, req = null) {
    const commission = await this.getCommissionOrThrow(id);
    if (!['APPROVED', 'PROCESSING'].includes(commission.status)) {
      throw new ForbiddenError('Payout details are available only for approved or processing commissions.', 'COMMISSION_NOT_READY_FOR_PAYOUT');
    }
    const [profile, user] = await Promise.all([
      WholesalerProfile.findOne({ userId: commission.referrerId }),
      User.findById(commission.referrerId).select('role status isDeleted').lean(),
    ]);
    const bank = profile?.bankDetails || {};
    if (
      !profile
      || profile.kycStatus !== KYC_STATUS.APPROVED
      || user?.role !== ROLES.WHOLESALER
      || user?.status !== USER_STATUS.ACTIVE
      || user?.isDeleted
      || bank.verificationStatus !== 'APPROVED'
      || bank.isVerified !== true
      || !bank.approvedAt
      || !bank.approvedBy
      || !bank.accountHolderName
      || !bank.bankName
      || !bank.accountNumber
      || !bank.ifscCode
    ) {
      throw new ForbiddenError('Only Superadmin-approved bank details can be shown for payout.', 'APPROVED_BANK_DETAILS_REQUIRED');
    }

    await AuditService.log({
      actorId: adminUser._id,
      actorRole: adminUser.role,
      action: 'BANK_DETAILS_VIEWED',
      entityType: 'WholesalerReferralCommissionPayout',
      entityId: commission._id,
      metadata: { referrerId: commission.referrerId },
      req,
    });

    return {
      bankName: bank.bankName || '',
      accountHolderName: bank.accountHolderName || '',
      accountNumber: bank.accountNumber,
      ifscCode: bank.ifscCode || '',
      branch: bank.branch || '',
    };
  }

  static async recordAdminDecision(commission, adminUser, status, req, note = '') {
    await AuditService.log({
      actorId: adminUser._id,
      actorRole: adminUser.role,
      action: AUDIT_ACTION.UPDATE,
      entityType: 'WholesalerReferralCommission',
      entityId: commission._id,
      after: { status, transactionReference: status === 'PAID' ? note : undefined },
      metadata: note ? { reason: note } : undefined,
      req,
    });
  }
}

module.exports = WholesalerReferralProgramService;
