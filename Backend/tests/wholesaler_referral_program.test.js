const request = require('supertest');
const app = require('../src/app');
const { setupTestDB, clearDatabase } = require('./setup');
const {
  KycApplication,
  PlatformSetting,
  User,
  WholesalerProfile,
  WholesalerReferral,
  WholesalerReferralCommission,
  Notification,
} = require('../src/models');
const { KYC_STATUS, ROLES, USER_STATUS } = require('../src/config/constants');

setupTestDB();

describe('Wholesaler referral commission program', () => {
  let referrer;
  let superadmin;
  let superadminToken;
  let adminToken;

  const registerWholesaler = async (email, referralCode, phone) => {
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: `Referred ${email.split('@')[0]}`,
        email,
        password: 'Wholesaler123',
        phone,
        role: ROLES.WHOLESALER,
        businessName: `Business ${email.split('@')[0]}`,
        wholesalerReferralCode: referralCode,
      });
    expect(response.status).toBe(201);
    return User.findOne({ email });
  };

  const createKycApplication = (wholesaler, pan = 'BCDEF2345G') => KycApplication.create({
    wholesalerId: wholesaler._id,
    businessName: `Business ${wholesaler.email}`,
    ownerName: wholesaler.name,
    pan,
    status: KYC_STATUS.SUBMITTED,
  });

  const approveKyc = (applicationId) => request(app)
    .patch(`/api/v1/kyc/${applicationId}/approve`)
    .set('Authorization', `Bearer ${superadminToken}`)
    .send({});

  beforeEach(async () => {
    await clearDatabase();
    const [referrerHash, adminHash, superadminHash] = await Promise.all([
      User.hashPassword('Referrer123'),
      User.hashPassword('Admin123'),
      User.hashPassword('Superadmin123'),
    ]);

    referrer = await User.create({
      name: 'Referring Wholesaler',
      email: 'referrer@example.com',
      passwordHash: referrerHash,
      role: ROLES.WHOLESALER,
      status: USER_STATUS.ACTIVE,
    });
    await WholesalerProfile.create({
      userId: referrer._id,
      businessName: 'Referrer Supply Co.',
      kycStatus: KYC_STATUS.APPROVED,
      pan: 'ABCDE1234F',
      bankDetails: {
        accountHolderName: 'Referrer Supply Co.',
        bankName: 'Example Bank',
        accountNumber: '123456789012',
        ifscCode: 'ABCD0123456',
        branch: 'Central Branch',
        isVerified: false,
        verificationStatus: 'PENDING',
      },
    });
    const admin = await User.create({
      name: 'Admin',
      email: 'admin@example.com',
      passwordHash: adminHash,
      role: ROLES.ADMIN,
      status: USER_STATUS.ACTIVE,
    });
    superadmin = await User.create({
      name: 'Super Admin',
      email: 'superadmin@example.com',
      passwordHash: superadminHash,
      role: ROLES.SUPER_ADMIN,
      status: USER_STATUS.ACTIVE,
    });

    const [referrerLogin, adminLogin, superadminLogin] = await Promise.all([
      request(app).post('/api/v1/auth/login').send({ email: referrer.email, password: 'Referrer123' }),
      request(app).post('/api/v1/auth/login').send({ email: admin.email, password: 'Admin123' }),
      request(app).post('/api/v1/auth/login').send({ email: superadmin.email, password: 'Superadmin123' }),
    ]);
    referrer.token = referrerLogin.body.data.token;
    adminToken = adminLogin.body.data.token;
    superadminToken = superadminLogin.body.data.token;
  });

  it('attributes referrals after KYC and pays commissions using KYC-approved bank details', async () => {
    const referralResponse = await request(app)
      .get('/api/v1/wholesaler/referral-program')
      .set('Authorization', `Bearer ${referrer.token}`);
    expect(referralResponse.status).toBe(200);
    expect(referralResponse.headers['cache-control']).toBe('no-store');
    const code = referralResponse.body.data.code;
    expect(code).toMatch(/^WS[A-Z0-9]{6}$/);

    const validation = await request(app).get(`/api/v1/wholesaler-referral/${code}/validate`);
    expect(validation.status).toBe(200);
    expect(validation.body.data.businessName).toBe('Referrer Supply Co.');

    const defaultSettings = await request(app)
      .get('/api/v1/admin/referral-program/settings')
      .set('Authorization', `Bearer ${superadminToken}`);
    expect(defaultSettings.body.data.commissionAmount).toBe(300);

    const changedSettings = await request(app)
      .put('/api/v1/admin/referral-program/settings')
      .set('Authorization', `Bearer ${superadminToken}`)
      .send({ commissionAmount: 450 });
    expect(changedSettings.status).toBe(200);

    const referred = await registerWholesaler('new-wholesaler@example.com', code, '9876543210');
    const duplicateRegistration = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Duplicate Wholesaler',
        email: 'new-wholesaler@example.com',
        password: 'Wholesaler123',
        phone: '9876543210',
        role: ROLES.WHOLESALER,
        wholesalerReferralCode: code,
      });
    expect(duplicateRegistration.status).toBe(409);
    const referredProfile = await WholesalerProfile.findOne({ userId: referred._id });
    expect(String(referredProfile.referredByWholesalerId)).toBe(String(referrer._id));
    expect(referredProfile.wholesalerReferralCodeUsed).toBe(code);
    expect(referredProfile.wholesalerReferralCode).toMatch(/^WS[A-Z0-9]{6}$/);
    expect(referredProfile.wholesalerReferralCode).not.toBe(code);
    expect(await WholesalerReferral.countDocuments({ referredWholesalerId: referred._id })).toBe(1);

    const referredLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: referred.email, password: 'Wholesaler123' });
    const kyc = await createKycApplication(referred);
    const approval = await approveKyc(kyc._id);
    expect(approval.status).toBe(200);

    let commission = await WholesalerReferralCommission.findOne({ referredWholesalerId: referred._id });
    expect(commission.amount).toBe(450);
    expect(commission.status).toBe('PENDING');

    await approveKyc(kyc._id);
    expect(await WholesalerReferralCommission.countDocuments({ referredWholesalerId: referred._id })).toBe(1);

    const wholesalerDashboard = await request(app)
      .get('/api/v1/wholesaler/referral-program')
      .set('Authorization', `Bearer ${referrer.token}`);
    expect(wholesalerDashboard.body.data.summary.totalReferrals).toBe(1);
    expect(wholesalerDashboard.body.data.summary.successfulReferrals).toBe(1);
    expect(wholesalerDashboard.body.data.summary.pendingCommissions).toBe(450);
    expect(wholesalerDashboard.body.data.referrals[0].commissionStatus).toBe('PENDING');

    const adminListDenied = await request(app)
      .get('/api/v1/admin/referral-program')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(adminListDenied.status).toBe(403);

    const commissionId = String(commission._id);
    const approved = await request(app)
      .patch(`/api/v1/admin/referral-program/${commissionId}/review`)
      .set('Authorization', `Bearer ${superadminToken}`)
      .send({ decision: 'approve' });
    expect(approved.status).toBe(200);
    expect(approved.body.data.status).toBe('APPROVED');

    const payoutStarted = await request(app)
      .patch(`/api/v1/admin/referral-program/${commissionId}/process`)
      .set('Authorization', `Bearer ${superadminToken}`)
      .send({});
    expect(payoutStarted.status).toBe(200);
    expect(payoutStarted.body.data.status).toBe('PROCESSING');

    const payoutDetails = await request(app)
      .get(`/api/v1/admin/referral-program/${commissionId}/payout-details`)
      .set('Authorization', `Bearer ${superadminToken}`);
    expect(payoutDetails.status).toBe(200);
    expect(payoutDetails.headers['cache-control']).toBe('no-store');
    expect(payoutDetails.body.data.accountNumber).toBe('123456789012');

    const paidWithoutReference = await request(app)
      .patch(`/api/v1/admin/referral-program/${commissionId}/paid`)
      .set('Authorization', `Bearer ${superadminToken}`)
      .send({});
    expect(paidWithoutReference.status).toBe(400);

    const paid = await request(app)
      .patch(`/api/v1/admin/referral-program/${commissionId}/paid`)
      .set('Authorization', `Bearer ${superadminToken}`)
      .send({ transactionReference: 'BANK-TXN-0001' });
    expect(paid.status).toBe(200);
    expect(paid.body.data.status).toBe('PAID');
    expect(paid.body.data.transactionReference).toBe('BANK-TXN-0001');

    const repeatedPayment = await request(app)
      .patch(`/api/v1/admin/referral-program/${commissionId}/paid`)
      .set('Authorization', `Bearer ${superadminToken}`)
      .send({ transactionReference: 'BANK-TXN-0001' });
    expect(repeatedPayment.status).toBe(200);
    expect(await WholesalerReferralCommission.countDocuments({ referredWholesalerId: referred._id })).toBe(1);

    const savedCommission = await WholesalerReferralCommission.findById(commissionId);
    expect(savedCommission.paidAt).toBeInstanceOf(Date);
    expect(savedCommission.statusHistory.map((entry) => entry.status)).toEqual([
      'PENDING',
      'APPROVED',
      'PROCESSING',
      'PAID',
    ]);

    const summary = await request(app)
      .get('/api/v1/admin/referral-program/summary')
      .set('Authorization', `Bearer ${superadminToken}`);
    expect(summary.body.data.totalReferringWholesalers).toBe(1);
    expect(summary.body.data.totalReferredWholesalers).toBe(1);
    expect(summary.body.data.totalCommissionPaid).toBe(450);

    const finalDashboard = await request(app)
      .get('/api/v1/wholesaler/referral-program')
      .set('Authorization', `Bearer ${referrer.token}`);
    expect(finalDashboard.body.data.summary.totalCommissionPaid).toBe(450);
    expect(finalDashboard.body.data.referrals[0].transactionReference).toBe('BANK-TXN-0001');
    expect(referredLogin.status).toBe(200);
  });

  it('does not create commissions for rejected, blocked, or same-PAN self-referrals', async () => {
    const { code } = (await request(app)
      .get('/api/v1/wholesaler/referral-program')
      .set('Authorization', `Bearer ${referrer.token}`)).body.data;

    const rejected = await registerWholesaler('rejected@example.com', code, '9876543211');
    const rejectedKyc = await createKycApplication(rejected);
    const rejection = await request(app)
      .patch(`/api/v1/kyc/${rejectedKyc._id}/reject`)
      .set('Authorization', `Bearer ${superadminToken}`)
      .send({ reason: 'Identity documents do not match.' });
    expect(rejection.status).toBe(200);
    expect(await WholesalerReferralCommission.countDocuments({ referredWholesalerId: rejected._id })).toBe(0);

    const blocked = await registerWholesaler('blocked@example.com', code, '9876543212');
    const blockedKyc = await createKycApplication(blocked);
    await User.updateOne({ _id: blocked._id }, { $set: { status: USER_STATUS.BLOCKED } });
    const blockedApproval = await approveKyc(blockedKyc._id);
    expect(blockedApproval.status).toBe(200);
    expect((await User.findById(blocked._id)).status).toBe(USER_STATUS.BLOCKED);
    expect(await WholesalerReferralCommission.countDocuments({ referredWholesalerId: blocked._id })).toBe(0);

    const selfReferral = await registerWholesaler('same-owner@example.com', code, '9876543213');
    const selfKyc = await createKycApplication(selfReferral, 'ABCDE1234F');
    await WholesalerProfile.updateOne(
      { userId: selfReferral._id },
      { $set: { pan: 'ABCDE1234F' } }
    );
    const selfApproval = await approveKyc(selfKyc._id);
    expect(selfApproval.status).toBe(200);
    expect(await WholesalerReferralCommission.countDocuments({ referredWholesalerId: selfReferral._id })).toBe(0);
    const selfReferralRecord = await WholesalerReferral.findOne({ referredWholesalerId: selfReferral._id });
    expect(selfReferralRecord.status).toBe('REJECTED');
  });

  it('requires a rejection reason and notifies the referrer when a commission is rejected', async () => {
    const referralCode = (await request(app)
      .get('/api/v1/wholesaler/referral-program')
      .set('Authorization', `Bearer ${referrer.token}`)).body.data.code;
    const referred = await registerWholesaler('commission-reject@example.com', referralCode, '9876543216');
    const kyc = await createKycApplication(referred);
    await approveKyc(kyc._id);
    const commission = await WholesalerReferralCommission.findOne({ referredWholesalerId: referred._id });

    const missingReason = await request(app)
      .patch(`/api/v1/admin/referral-program/${commission._id}/review`)
      .set('Authorization', `Bearer ${superadminToken}`)
      .send({ decision: 'reject' });
    expect(missingReason.status).toBe(400);

    const rejected = await request(app)
      .patch(`/api/v1/admin/referral-program/${commission._id}/review`)
      .set('Authorization', `Bearer ${superadminToken}`)
      .send({ decision: 'reject', reason: 'Referral information could not be verified.' });
    expect(rejected.status).toBe(200);
    expect(rejected.body.data.status).toBe('REJECTED');

    const notification = await Notification.findOne({
      recipientId: referrer._id,
      title: 'Referral commission rejected',
    });
    expect(notification).toBeDefined();
    expect(notification.message).toContain('Referral information could not be verified.');
  });

  it('rejects invalid codes and restricts referral history to the signed-in wholesaler', async () => {
    const invalid = await request(app).get('/api/v1/wholesaler-referral/INVALID/validate');
    expect(invalid.status).toBe(404);

    const registration = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Invalid Referral',
        email: 'invalid-referral@example.com',
        password: 'Wholesaler123',
        phone: '9876543214',
        role: ROLES.WHOLESALER,
        wholesalerReferralCode: 'INVALID',
      });
    expect(registration.status).toBe(404);
    expect(await User.findOne({ email: 'invalid-referral@example.com' })).toBeNull();

    const referralCode = (await request(app)
      .get('/api/v1/wholesaler/referral-program')
      .set('Authorization', `Bearer ${referrer.token}`)).body.data.code;
    await registerWholesaler('private-referral@example.com', referralCode, '9876543215');
    const otherUser = await User.create({
      name: 'Other Wholesaler',
      email: 'other-wholesaler@example.com',
      passwordHash: await User.hashPassword('Other123'),
      role: ROLES.WHOLESALER,
      status: USER_STATUS.ACTIVE,
    });
    await WholesalerProfile.create({
      userId: otherUser._id,
      businessName: 'Other Business',
      kycStatus: KYC_STATUS.APPROVED,
    });
    const otherLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: otherUser.email, password: 'Other123' });
    const privateDashboard = await request(app)
      .get(`/api/v1/wholesaler/referral-program?wholesalerId=${referrer._id}`)
      .set('Authorization', `Bearer ${otherLogin.body.data.token}`);
    expect(privateDashboard.status).toBe(200);
    expect(privateDashboard.body.data.summary.totalReferrals).toBe(0);
    expect(privateDashboard.body.data.referrals).toHaveLength(0);

    const settingsDenied = await request(app)
      .put('/api/v1/admin/referral-program/settings')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ commissionAmount: 999 });
    expect(settingsDenied.status).toBe(403);
    expect(await PlatformSetting.findOne({ key: 'WHOLESALER_REFERRAL_PROGRAM' })).toBeNull();
  });
});
