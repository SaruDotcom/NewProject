const { Wallet, WalletTransaction } = require('../models');
const { WALLET_TRANSACTION_TYPE } = require('../config/constants');
const { BadRequestError } = require('../utils/errors');

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
    session = null,
  }) {
    if (amount <= 0) {
      throw new BadRequestError('Credit amount must be positive');
    }

    const wallet = await this.getOrCreateWallet(ownerId, ownerType, session);
    const balanceBefore = wallet.availableBalance;
    const balanceAfter = balanceBefore + amount;

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
  static async lockFunds({ ownerId, amount, session = null }) {
    const wallet = await this.getOrCreateWallet(ownerId, 'WHOLESALER', session);

    if (wallet.availableBalance < amount) {
      throw new BadRequestError('Insufficient funds to lock for payout', 'INSUFFICIENT_FUNDS');
    }

    wallet.availableBalance -= amount;
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
