const request = require('supertest');
const app = require('../src/app');
const { setupTestDB, clearDatabase } = require('./setup');
const { User, AdminProfile, WholesalerProfile, Wallet, WalletTransaction, Payout } = require('../src/models');
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
