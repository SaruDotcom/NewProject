const { Wallet, WalletTransaction, Order, Return, Payout } = require('../models');
const { WALLET_TRANSACTION_TYPE } = require('../config/constants');
const { BadRequestError } = require('../utils/errors');
const env = require('../config/env');

class WalletService {
  /**
   * Fetch or initialize wallet for an entity
   */
  static async getOrCreateWallet(ownerId, ownerType = 'WHOLESALER', session = null) {
    let wallet = await Wallet.findOne({ ownerId }).session(session);
    if (!wallet) {
      wallet = await Wallet.create(
        [
          {
            ownerId,
            ownerType,
            availableBalance: 0,
            pendingBalance: 0,
            lockedBalance: 0,
          },
        ],
        { session }
      );
      wallet = wallet[0];
    }
    return wallet;
  }

  /**
   * Credit available balance and create immutable ledger transaction
   */
  static async credit({
    ownerId,
    ownerType = 'WHOLESALER',
    amount,
    type = WALLET_TRANSACTION_TYPE.CREDIT,
    description = '',
    referenceType = 'ORDER',
    referenceId = '',
    idempotencyKey = null,
    settlementDate = null,
    session = null,
  }) {
    if (amount <= 0) {
      throw new BadRequestError('Credit amount must be positive');
    }

    const wallet = await this.getOrCreateWallet(ownerId, ownerType, session);
    if (idempotencyKey) {
      const existingTransaction = await WalletTransaction.findOne({ ownerId, idempotencyKey }).session(session);
      if (existingTransaction) return { wallet, transaction: existingTransaction };
    }

    const isPendingSettlement = settlementDate && new Date(settlementDate) > new Date();
    const balanceBefore = isPendingSettlement ? wallet.pendingBalance : wallet.availableBalance;
    const balanceAfter = balanceBefore + amount;

    if (isPendingSettlement) wallet.pendingBalance = balanceAfter;
    else wallet.availableBalance = balanceAfter;
    await wallet.save({ session });

    const transaction = await WalletTransaction.create(
      [
        {
          walletId: wallet._id,
          ownerId,
          type,
          amount,
          balanceBefore,
          balanceAfter,
          description,
          referenceType,
          referenceId,
          idempotencyKey,
          status: 'COMPLETED',
          settlementDate,
          settlementStatus: isPendingSettlement ? 'PENDING' : 'SETTLED',
        },
      ],
      { session }
    );

    return { wallet, transaction: transaction[0] };
  }

  static async getWalletSummary(ownerId, ownerType = 'WHOLESALER') {
    const wallet = await this.getOrCreateWallet(ownerId, ownerType);
    const transactions = await WalletTransaction.find({
      ownerId,
      walletId: wallet._id,
      status: 'COMPLETED',
    }).sort({ createdAt: 1 }).lean();

    const credits = transactions.filter(
      (transaction) => transaction.type === WALLET_TRANSACTION_TYPE.CREDIT && transaction.referenceType === 'ORDER'
    );
    const orderNumbers = [...new Set(credits.map((transaction) => transaction.referenceId).filter(Boolean))];
    const orders = await Order.find({ orderNumber: { $in: orderNumbers } })
      .select('_id orderNumber orderStatus')
      .lean();
    const orderByNumber = new Map(orders.map((order) => [order.orderNumber, order]));
    const openReturns = orders.length
      ? await Return.find({
          orderId: { $in: orders.map((order) => order._id) },
          status: { $in: ['REQUESTED', 'PROCESSING'] },
        }).select('orderId').lean()
      : [];
    const openReturnOrderIds = new Set(openReturns.map((item) => String(item.orderId)));

    const deductionsByOrder = new Map();
    for (const transaction of transactions) {
      const isEarningReversal = ['COMMISSION', 'REFUND'].includes(transaction.type)
        || (transaction.type === 'DEBIT' && transaction.referenceType === 'ORDER');
      if (!isEarningReversal || !transaction.referenceId) continue;
      deductionsByOrder.set(
        transaction.referenceId,
        (deductionsByOrder.get(transaction.referenceId) || 0) + transaction.amount
      );
    }

    const earningsByOrder = new Map();
    const now = Date.now();
    const settlementUpdates = [];
    for (const transaction of credits) {
      const order = orderByNumber.get(transaction.referenceId);
      const isOnHold = Boolean(order && (
        order.orderStatus === 'RETURN_REQUESTED' || openReturnOrderIds.has(String(order._id))
      ));
      const settlementDate = transaction.settlementDate
        ? new Date(transaction.settlementDate)
        : transaction.settlementStatus
          ? new Date(transaction.createdAt)
          : new Date(new Date(transaction.createdAt).getTime() + env.WALLET_SETTLEMENT_DAYS * 24 * 60 * 60 * 1000);
      const isPending = isOnHold || settlementDate.getTime() > now;
      const nextSettlementStatus = isOnHold ? 'ON_HOLD' : isPending ? 'PENDING' : 'SETTLED';

      if (transaction.settlementStatus !== nextSettlementStatus) {
        settlementUpdates.push({ transaction, settlementDate, nextSettlementStatus });
      }

      const current = earningsByOrder.get(transaction.referenceId) || { amount: 0, pending: false };
      current.amount += transaction.amount;
      current.pending = current.pending || isPending;
      earningsByOrder.set(transaction.referenceId, current);
    }
    for (const { transaction, settlementDate, nextSettlementStatus } of settlementUpdates) {
      const settlementFilter = { _id: transaction._id };
      if (transaction.settlementStatus === undefined) {
        settlementFilter.settlementStatus = { $exists: false };
      } else {
        settlementFilter.settlementStatus = transaction.settlementStatus;
      }
      const result = await WalletTransaction.updateOne(settlementFilter, {
        $set: { settlementStatus: nextSettlementStatus, settlementDate },
      });
      if (result.modifiedCount !== 1) continue;

      const previousStatus = transaction.settlementStatus;
      if (nextSettlementStatus === 'SETTLED' && ['PENDING', 'ON_HOLD'].includes(previousStatus)) {
        await Wallet.updateOne(
          { _id: wallet._id },
          { $inc: { availableBalance: transaction.amount, pendingBalance: -transaction.amount } }
        );
      } else if (
        ['PENDING', 'ON_HOLD'].includes(nextSettlementStatus)
        && (previousStatus === 'SETTLED' || previousStatus === undefined)
      ) {
        await Wallet.updateOne(
          { _id: wallet._id },
          { $inc: { availableBalance: -transaction.amount, pendingBalance: transaction.amount } }
        );
      }
    }

    let totalEarned = 0;
    let pendingBalance = 0;
    let releasedEarnings = 0;
    for (const [orderNumber, earning] of earningsByOrder) {
      const netAmount = Math.max(0, earning.amount - (deductionsByOrder.get(orderNumber) || 0));
      totalEarned += netAmount;
      if (earning.pending) pendingBalance += netAmount;
      else releasedEarnings += netAmount;
    }

    const paidWithdrawals = transactions
      .filter((transaction) => transaction.type === WALLET_TRANSACTION_TYPE.PAYOUT
        || (transaction.type === 'DEBIT' && transaction.referenceType === 'PAYOUT'))
      .reduce((total, transaction) => total + transaction.amount, 0);
    const pendingPayouts = await Payout.aggregate([
      {
        $match: {
          wholesalerId: wallet.ownerId,
          status: { $in: ['REQUESTED', 'UNDER_REVIEW', 'APPROVED', 'PROCESSING'] },
        },
      },
      { $group: { _id: null, amount: { $sum: '$amount' } } },
    ]);
    const pendingPayoutBalance = pendingPayouts[0]?.amount || 0;
    const withdrawnBalance = paidWithdrawals + pendingPayoutBalance;
    const availableBalance = releasedEarnings - withdrawnBalance;
    await Wallet.updateOne(
      { _id: wallet._id },
      { $set: { availableBalance, pendingBalance, lockedBalance: pendingPayoutBalance } }
    );

    return {
      ...wallet.toObject(),
      availableBalance,
      pendingBalance,
      lockedBalance: pendingPayoutBalance,
      totalEarned,
      withdrawnBalance,
      pendingPayoutBalance,
    };
  }

  static async reverseOrderEarnings({ ownerId, orderNumber, orderId, description }) {
    const wallet = await this.getOrCreateWallet(ownerId, 'WHOLESALER');
    const idempotencyKey = `order-refund:${orderId}`;
    const existing = await WalletTransaction.findOne({ ownerId, idempotencyKey });
    if (existing) return existing;

    const transactions = await WalletTransaction.find({
      ownerId,
      referenceId: orderNumber,
      status: 'COMPLETED',
      type: { $in: ['CREDIT', 'COMMISSION', 'REFUND', 'DEBIT'] },
    }).lean();
    const credits = transactions
      .filter((transaction) => transaction.type === 'CREDIT')
      .reduce((total, transaction) => total + transaction.amount, 0);
    const deductions = transactions
      .filter((transaction) => transaction.type !== 'CREDIT')
      .reduce((total, transaction) => total + transaction.amount, 0);
    const amount = Math.round(Math.max(0, credits - deductions) * 100) / 100;
    if (!amount) return null;

    return WalletTransaction.create({
      walletId: wallet._id,
      ownerId,
      type: WALLET_TRANSACTION_TYPE.REFUND,
      amount,
      balanceBefore: wallet.availableBalance,
      balanceAfter: wallet.availableBalance - amount,
      description,
      referenceType: 'ORDER',
      referenceId: orderNumber,
      idempotencyKey,
      status: 'COMPLETED',
      settlementStatus: 'REVERSED',
      settlementDate: new Date(),
    });
  }

  /**
   * Debit available balance and create immutable ledger transaction
   */
  static async debit({
    ownerId,
    ownerType = 'WHOLESALER',
    amount,
    type = WALLET_TRANSACTION_TYPE.DEBIT,
    description = '',
    referenceType = 'PAYOUT',
    referenceId = '',
    idempotencyKey = null,
    session = null,
  }) {
    if (amount <= 0) {
      throw new BadRequestError('Debit amount must be positive');
    }

    const wallet = await this.getOrCreateWallet(ownerId, ownerType, session);

    if (wallet.availableBalance < amount) {
      throw new BadRequestError(
        `Insufficient available balance. Requested: ₹${amount}, Available: ₹${wallet.availableBalance}`,
        'INSUFFICIENT_FUNDS'
      );
    }

    const balanceBefore = wallet.availableBalance;
    const balanceAfter = balanceBefore - amount;

    wallet.availableBalance = balanceAfter;
    await wallet.save({ session });

    const transaction = await WalletTransaction.create(
      [
        {
          walletId: wallet._id,
          ownerId,
          type,
          amount,
          balanceBefore,
          balanceAfter,
          description,
          referenceType,
          referenceId,
          idempotencyKey,
          status: 'COMPLETED',
        },
      ],
      { session }
    );

    return { wallet, transaction: transaction[0] };
  }

  /**
   * Lock funds during payout processing
   */
  static async lockFunds({ ownerId, amount, availableBalance, session = null }) {
    const wallet = await this.getOrCreateWallet(ownerId, 'WHOLESALER', session);

    const balanceBefore = availableBalance ?? wallet.availableBalance;
    if (balanceBefore < amount) {
      throw new BadRequestError('Insufficient funds to lock for payout', 'INSUFFICIENT_FUNDS');
    }

    wallet.availableBalance = balanceBefore - amount;
    wallet.lockedBalance += amount;
    await wallet.save({ session });
    return wallet;
  }

  /**
   * Release locked funds back to available balance (e.g. on payout rejection)
   */
  static async releaseLockedFunds({ ownerId, amount, session = null }) {
    const wallet = await this.getOrCreateWallet(ownerId, 'WHOLESALER', session);

    wallet.lockedBalance = Math.max(0, wallet.lockedBalance - amount);
    wallet.availableBalance += amount;
    await wallet.save({ session });
    return wallet;
  }

  /**
   * Settle locked funds after successful payout
   */
  static async settleLockedFunds({ ownerId, amount, session = null }) {
    const wallet = await this.getOrCreateWallet(ownerId, 'WHOLESALER', session);

    wallet.lockedBalance = Math.max(0, wallet.lockedBalance - amount);
    await wallet.save({ session });
    return wallet;
  }
}

module.exports = WalletService;
