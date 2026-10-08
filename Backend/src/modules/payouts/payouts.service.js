const { Payout, WholesalerProfile, Wallet } = require('../../models');
const { PAYOUT_STATUS, AUDIT_ACTION, KYC_STATUS } = require('../../config/constants');
const {
  BadRequestError,
  NotFoundError,
  ForbiddenError,
} = require('../../utils/errors');
const { parsePagination } = require('../../utils/pagination');
const { generateReference } = require('../../utils/crypto');
const WalletService = require('../../services/wallet.service');
const AuditService = require('../../services/audit.service');
const NotificationService = require('../../services/notification.service');

class PayoutService {
  /**
   * Wholesaler requests a payout
   */
  static async requestPayout(wholesalerUser, { amount, notes, idempotencyKey }, req = null) {
    const wholesalerId = wholesalerUser._id;
    const payoutAmount = parseFloat(amount);

    if (isNaN(payoutAmount) || payoutAmount <= 0) {
      throw new BadRequestError('Payout amount must be greater than 0');
    }

    // Check KYC status
    const profile = await WholesalerProfile.findOne({ userId: wholesalerId });
    if (!profile || profile.kycStatus !== KYC_STATUS.APPROVED) {
      throw new ForbiddenError('Wholesaler KYC must be approved before requesting payouts', 'KYC_APPROVAL_REQUIRED');
    }

    if (!profile.bankDetails?.accountNumber) {
      throw new BadRequestError('Bank account details must be configured in profile before requesting payout', 'NO_BANK_DETAILS');
    }

    // Check and lock wallet balance
    const wallet = await WalletService.getOrCreateWallet(wholesalerId, 'WHOLESALER');
    if (wallet.availableBalance < payoutAmount) {
      throw new BadRequestError(
        `Insufficient available wallet balance. Available: ₹${wallet.availableBalance}, Requested: ₹${payoutAmount}`,
        'INSUFFICIENT_FUNDS'
      );
    }

    await WalletService.lockFunds({ ownerId: wholesalerId, amount: payoutAmount });

    const payoutNumber = generateReference('PO');

    const payout = await Payout.create({
      payoutNumber,
      wholesalerId,
      amount: payoutAmount,
      status: PAYOUT_STATUS.REQUESTED,
      bankAccountReference: profile.bankDetails,
      idempotencyKey,
      notes: notes || '',
    });

    await AuditService.log({
      actorId: wholesalerId,
      actorRole: wholesalerUser.role,
      action: AUDIT_ACTION.CREATE,
      entityType: 'Payout',
      entityId: payout._id,
      after: { payoutNumber, amount: payoutAmount, status: PAYOUT_STATUS.REQUESTED },
      req,
    });

    await NotificationService.notifyAdmins({
      title: 'New Payout Request',
      message: `${profile.businessName} requested a payout of ₹${payoutAmount} (${payoutNumber}).`,
      data: { payoutId: payout._id, payoutNumber, amount: payoutAmount },
    });

    return payout;
  }

  /**
   * List payouts with filters and pagination
   */
  static async listPayouts(query = {}) {
    const { page, limit, skip, sort } = parsePagination(query);
    const filter = {};

    if (query.wholesalerId) filter.wholesalerId = query.wholesalerId;
    if (query.status) filter.status = query.status;

    const [payouts, total] = await Promise.all([
      Payout.find(filter)
        .populate('wholesalerId', 'name email phone')
        .populate('approvedBy', 'name email')
        .populate('processedBy', 'name email')
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      Payout.countDocuments(filter),
    ]);

    return {
      payouts,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get single payout by ID
   */
  static async getPayoutById(payoutId) {
    const payout = await Payout.findById(payoutId)
      .populate('wholesalerId', 'name email phone')
      .populate('approvedBy', 'name email')
      .populate('processedBy', 'name email');

    if (!payout) {
      throw new NotFoundError('Payout not found');
    }

    return payout;
  }

  /**
   * Super Admin approves payout
   */
  static async approvePayout(payoutId, adminUser, req = null) {
    const payout = await Payout.findById(payoutId);
    if (!payout) {
      throw new NotFoundError('Payout not found');
    }

    if (payout.status !== PAYOUT_STATUS.REQUESTED && payout.status !== PAYOUT_STATUS.UNDER_REVIEW) {
      throw new BadRequestError(`Cannot approve payout with status '${payout.status}'`);
    }

    payout.status = PAYOUT_STATUS.APPROVED;
    payout.approvedBy = adminUser._id;
    payout.approvedAt = new Date();
    await payout.save();

    await AuditService.log({
      actorId: adminUser._id,
      actorRole: adminUser.role,
      action: AUDIT_ACTION.PAYOUT_APPROVED,
      entityType: 'Payout',
      entityId: payout._id,
      after: { status: PAYOUT_STATUS.APPROVED, approvedBy: adminUser._id },
      req,
    });

    await NotificationService.notify({
      recipientId: payout.wholesalerId,
      title: 'Payout Approved',
      message: `Your payout request ${payout.payoutNumber} for ₹${payout.amount} has been approved and is being queued for processing.`,
      data: { payoutId: payout._id, status: PAYOUT_STATUS.APPROVED },
    });

    return payout;
  }

  /**
   * Super Admin rejects payout and releases locked wallet funds
   */
  static async rejectPayout(payoutId, { reason }, adminUser, req = null) {
    const payout = await Payout.findById(payoutId);
    if (!payout) {
      throw new NotFoundError('Payout not found');
    }

    if (payout.status === PAYOUT_STATUS.PAID) {
      throw new BadRequestError('Cannot reject a payout that has already been completed/paid');
    }

    // Release locked balance back to wholesaler's available balance
    await WalletService.releaseLockedFunds({
      ownerId: payout.wholesalerId,
      amount: payout.amount,
    });

    payout.status = PAYOUT_STATUS.REJECTED;
    payout.rejectedBy = adminUser._id;
    payout.rejectedAt = new Date();
    payout.failureReason = reason || 'Rejected by administrator';
    await payout.save();

    await AuditService.log({
      actorId: adminUser._id,
      actorRole: adminUser.role,
      action: AUDIT_ACTION.PAYOUT_REJECTED,
      entityType: 'Payout',
      entityId: payout._id,
      after: { status: PAYOUT_STATUS.REJECTED, reason },
      req,
    });

    await NotificationService.notify({
      recipientId: payout.wholesalerId,
      title: 'Payout Request Rejected',
      message: `Your payout request ${payout.payoutNumber} for ₹${payout.amount} was rejected. Locked funds have been released back to your available balance.${reason ? ` Reason: ${reason}` : ''}`,
      data: { payoutId: payout._id, status: PAYOUT_STATUS.REJECTED, reason },
    });

    return payout;
  }

  /**
   * Super Admin marks payout as processed / paid (settles locked balance & creates ledger entry)
   */
  static async processPayout(payoutId, { transactionReference }, adminUser, req = null) {
    const payout = await Payout.findById(payoutId);
    if (!payout) {
      throw new NotFoundError('Payout not found');
    }

    if (payout.status === PAYOUT_STATUS.PAID) {
      return payout; // Idempotent return
    }

    // Settle locked funds in wallet
    await WalletService.settleLockedFunds({
      ownerId: payout.wholesalerId,
      amount: payout.amount,
    });

    // Create immutable debit ledger record
    const { WalletTransaction } = require('../../models');
    const wallet = await Wallet.findOne({ ownerId: payout.wholesalerId });
    await WalletTransaction.create({
      walletId: wallet._id,
      ownerId: payout.wholesalerId,
      type: 'PAYOUT',
      amount: payout.amount,
      balanceBefore: wallet.availableBalance + payout.amount,
      balanceAfter: wallet.availableBalance,
      description: `Payout processed (${payout.payoutNumber}) - Ref: ${transactionReference || 'Bank Transfer'}`,
      referenceType: 'PAYOUT',
      referenceId: payout.payoutNumber,
      status: 'COMPLETED',
    });

    payout.status = PAYOUT_STATUS.PAID;
    payout.transactionReference = transactionReference || generateReference('TXN');
    payout.processedBy = adminUser._id;
    payout.processedAt = new Date();
    await payout.save();

    await AuditService.log({
      actorId: adminUser._id,
      actorRole: adminUser.role,
      action: AUDIT_ACTION.PAYOUT_PROCESSED,
      entityType: 'Payout',
      entityId: payout._id,
      after: { status: PAYOUT_STATUS.PAID, transactionReference: payout.transactionReference },
      req,
    });

    await NotificationService.notify({
      recipientId: payout.wholesalerId,
      title: 'Payout Completed 💸',
      message: `Your payout ${payout.payoutNumber} of ₹${payout.amount} has been successfully transferred to your bank account. Ref: ${payout.transactionReference}`,
      data: { payoutId: payout._id, status: PAYOUT_STATUS.PAID },
    });

    return payout;
  }
}

module.exports = PayoutService;
