const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const { setupTestDB, clearDatabase } = require('./setup');
const { User, AdminProfile, WholesalerProfile, Wallet, WalletTransaction, Payout, Order, Return } = require('../src/models');
const { ROLES, USER_STATUS, KYC_STATUS, PAYOUT_STATUS } = require('../src/config/constants');
const WalletService = require('../src/services/wallet.service');

setupTestDB();

describe('Wallet & Payouts Test Suite', () => {
  let adminToken;
  let wholesalerToken;
  let wholesalerUser;
  let adminUser;

  beforeEach(async () => {
    await clearDatabase();

    // 1. Admin
    const adminHash = await User.hashPassword('Admin123');
    adminUser = await User.create({
      name: 'Super Admin',
      email: 'admin@nexora.b2b',
      passwordHash: adminHash,
      role: ROLES.SUPER_ADMIN,
      status: USER_STATUS.ACTIVE,
    });
    await AdminProfile.create({ userId: adminUser._id, isSuperAdmin: true });
    const adminLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'admin@nexora.b2b',
      password: 'Admin123',
    });
    adminToken = adminLogin.body.data.token;

    // 2. Wholesaler
    const wsHash = await User.hashPassword('Wholesale123');
    wholesalerUser = await User.create({
      name: 'Delta Traders',
      email: 'delta@wholesale.com',
      passwordHash: wsHash,
      role: ROLES.WHOLESALER,
      status: USER_STATUS.ACTIVE,
    });
    await WholesalerProfile.create({
      userId: wholesalerUser._id,
      businessName: 'Delta Traders',
      kycStatus: KYC_STATUS.APPROVED,
      isVerified: true,
      bankDetails: {
        accountHolderName: 'Delta Traders',
        accountNumber: '1234567890',
        ifscCode: 'HDFC0000123',
        bankName: 'HDFC',
      },
    });

    const wsLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'delta@wholesale.com',
      password: 'Wholesale123',
    });
    wholesalerToken = wsLogin.body.data.token;
  });

  test('1. Credit wallet creates immutable double-entry transaction and updates balance', async () => {
    const { wallet, transaction } = await WalletService.credit({
      ownerId: wholesalerUser._id,
      amount: 15000,
      description: 'Test Credit',
      referenceType: 'ORDER',
      referenceId: 'ORD-TEST-1',
    });

    expect(wallet.availableBalance).toBe(15000);
    expect(transaction.amount).toBe(15000);
    expect(transaction.balanceAfter).toBe(15000);
    expect(transaction.type).toBe('CREDIT');

    // Balance Consistency Check
    const dbWallet = await Wallet.findOne({ ownerId: wholesalerUser._id });
    expect(dbWallet.availableBalance + dbWallet.pendingBalance + dbWallet.lockedBalance).toBe(15000);
  });

  test('wallet API derives earnings and moves due credits into available balance', async () => {
    await WalletService.credit({
      ownerId: wholesalerUser._id,
      amount: 15675,
      referenceId: 'ORD-15675',
      settlementDate: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
      idempotencyKey: 'credit-ORD-15675',
    });
    const pendingCredit = await WalletService.credit({
      ownerId: wholesalerUser._id,
      amount: 2500,
      referenceId: 'ORD-PENDING',
      settlementDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
      idempotencyKey: 'credit-ORD-PENDING',
    });
    await Payout.create({
      payoutNumber: 'PO-WALLET-TEST',
      wholesalerId: wholesalerUser._id,
      amount: 1000,
      status: PAYOUT_STATUS.REQUESTED,
    });

    const pendingTransaction = await WalletTransaction.findById(pendingCredit.transaction._id);
    pendingTransaction.settlementDate = new Date(Date.now() - 1000);
    await pendingTransaction.save();

    const response = await request(app)
      .get('/api/v1/wallets/me')
      .set('Authorization', ['Bearer', wholesalerToken].join(' '));
    expect(response.status).toBe(200);
    expect(response.body.data.totalEarned).toBe(18175);
    expect(response.body.data.pendingBalance).toBe(0);
    expect(response.body.data.availableBalance).toBe(17175);
    expect(response.body.data.withdrawnBalance).toBe(1000);
    expect(
      response.body.data.availableBalance
        + response.body.data.pendingBalance
        + response.body.data.withdrawnBalance
    ).toBe(response.body.data.totalEarned);

    const settledTransaction = await WalletTransaction.findById(pendingCredit.transaction._id);
    expect(settledTransaction.settlementStatus).toBe('SETTLED');
  });

  test('open returns hold released earnings until the return is rejected', async () => {
    const order = await Order.create({
      orderNumber: 'ORD-OPEN-RETURN',
      retailerId: wholesalerUser._id,
      wholesalerId: wholesalerUser._id,
      subtotal: 1000,
      grandTotal: 1000,
      orderStatus: 'RETURN_REQUESTED',
    });
    await Return.create({
      returnNumber: 'RET-OPEN-RETURN',
      orderId: order._id,
      retailerId: wholesalerUser._id,
      wholesalerId: wholesalerUser._id,
      totalRefundAmount: 1000,
      reason: 'Damaged item',
      status: 'REQUESTED',
    });
    await WalletService.credit({
      ownerId: wholesalerUser._id,
      amount: 1000,
      referenceId: order.orderNumber,
      settlementDate: new Date(Date.now() - 1000),
      idempotencyKey: 'credit-open-return',
    });

    const held = await WalletService.getWalletSummary(wholesalerUser._id);
    expect(held.availableBalance).toBe(0);
    expect(held.pendingBalance).toBe(1000);

    await Return.updateOne({ _id: (await Return.findOne({ orderId: order._id }))._id }, { $set: { status: 'REJECTED' } });
    await Order.updateOne({ _id: order._id }, { $set: { orderStatus: 'DELIVERED' } });
    const released = await WalletService.getWalletSummary(wholesalerUser._id);
    expect(released.availableBalance).toBe(1000);
    expect(released.pendingBalance).toBe(0);
  });

  test('returned orders reverse the original earnings credit once', async () => {
    const orderId = new mongoose.Types.ObjectId();
    await WalletService.credit({
      ownerId: wholesalerUser._id,
      amount: 1500,
      referenceId: 'ORD-RETURNED',
      idempotencyKey: `credit-${orderId}`,
    });
    const reversal = await WalletService.reverseOrderEarnings({
      ownerId: wholesalerUser._id,
      orderNumber: 'ORD-RETURNED',
      orderId,
      description: 'Returned order',
    });
    const duplicateReversal = await WalletService.reverseOrderEarnings({
      ownerId: wholesalerUser._id,
      orderNumber: 'ORD-RETURNED',
      orderId,
      description: 'Returned order',
    });

    expect(reversal.amount).toBe(1500);
    expect(String(duplicateReversal._id)).toBe(String(reversal._id));
    const summary = await WalletService.getWalletSummary(wholesalerUser._id);
    expect(summary.totalEarned).toBe(0);
  });

  test('2. Wholesaler requests payout -> locks available balance', async () => {
    // Credit 10,000 first
    await WalletService.credit({
      ownerId: wholesalerUser._id,
      amount: 10000,
      description: 'Earnings',
    });

    const res = await request(app)
      .post('/api/v1/payouts/wholesaler/request')
      .set('Authorization', `Bearer ${wholesalerToken}`)
      .send({ amount: 4000 });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.amount).toBe(4000);
    expect(res.body.data.status).toBe(PAYOUT_STATUS.REQUESTED);

    // Verify Wallet has 6000 available and 4000 locked
    const wallet = await Wallet.findOne({ ownerId: wholesalerUser._id });
    expect(wallet.availableBalance).toBe(6000);
    expect(wallet.lockedBalance).toBe(4000);
  });

  test('3. Insufficient balance rejected for payout', async () => {
    // Wallet has 0 balance
    const res = await request(app)
      .post('/api/v1/payouts/wholesaler/request')
      .set('Authorization', `Bearer ${wholesalerToken}`)
      .send({ amount: 5000 });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INSUFFICIENT_FUNDS');
  });

  test('4. Admin rejects payout -> releases locked balance back to available', async () => {
    await WalletService.credit({ ownerId: wholesalerUser._id, amount: 8000 });

    const reqRes = await request(app)
      .post('/api/v1/payouts/wholesaler/request')
      .set('Authorization', `Bearer ${wholesalerToken}`)
      .send({ amount: 5000 });

    const payoutId = reqRes.body.data._id;

    // Admin rejects
    const rejectRes = await request(app)
      .patch(`/api/v1/admin/payouts/${payoutId}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Bank IFSC code mismatch' });

    expect(rejectRes.status).toBe(200);
    expect(rejectRes.body.data.status).toBe(PAYOUT_STATUS.REJECTED);

    // Balance restored: 8000 available, 0 locked
    const wallet = await Wallet.findOne({ ownerId: wholesalerUser._id });
    expect(wallet.availableBalance).toBe(8000);
    expect(wallet.lockedBalance).toBe(0);
  });

  test('5. Admin processes payout -> settles locked balance & writes debit ledger', async () => {
    await WalletService.credit({ ownerId: wholesalerUser._id, amount: 10000 });

    const reqRes = await request(app)
      .post('/api/v1/payouts/wholesaler/request')
      .set('Authorization', `Bearer ${wholesalerToken}`)
      .send({ amount: 7000 });

    const payoutId = reqRes.body.data._id;

    // Admin processes payout
    const processRes = await request(app)
      .patch(`/api/v1/admin/payouts/${payoutId}/process`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ transactionReference: 'UTR-HDFC-991823' });

    expect(processRes.status).toBe(200);
    expect(processRes.body.data.status).toBe(PAYOUT_STATUS.PAID);
    expect(processRes.body.data.transactionReference).toBe('UTR-HDFC-991823');

    // Wallet: 3000 available, 0 locked
    const wallet = await Wallet.findOne({ ownerId: wholesalerUser._id });
    expect(wallet.availableBalance).toBe(3000);
    expect(wallet.lockedBalance).toBe(0);

    // Debit transaction logged
    const txn = await WalletTransaction.findOne({ ownerId: wholesalerUser._id, type: 'PAYOUT' });
    expect(txn).not.toBeNull();
    expect(txn.amount).toBe(7000);
  });
});
