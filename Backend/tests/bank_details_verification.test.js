const request = require('supertest');
const app = require('../src/app');
const { setupTestDB, clearDatabase } = require('./setup');
const {
  User,
  KycApplication,
  WholesalerProfile,
  RetailerProfile,
  WholesalerRetailerRelationship,
  AuditLog,
} = require('../src/models');
const {
  ROLES,
  USER_STATUS,
  KYC_STATUS,
  RELATIONSHIP_STATUS,
} = require('../src/config/constants');

setupTestDB();

describe('Separate wholesaler bank details verification', () => {
  let wholesaler;
  let retailerToken;
  let wholesalerToken;
  let superadminToken;
  let adminToken;
  let profile;
  const bankDetails = {
    accountHolderName: 'Alex Smith',
    bankName: 'Example Bank',
    accountNumber: '123456789012',
    confirmAccountNumber: '123456789012',
    ifscCode: 'ABCD0123456',
    branch: 'Central Branch',
  };

  beforeEach(async () => {
    await clearDatabase();

    const [wholesalerHash, retailerHash, superadminHash, adminHash] = await Promise.all([
      User.hashPassword('Wholesaler123'),
      User.hashPassword('Retailer123'),
      User.hashPassword('Superadmin123'),
      User.hashPassword('Admin123'),
    ]);
    wholesaler = await User.create({
      name: 'Example Wholesaler',
      email: 'wholesaler@example.com',
      passwordHash: wholesalerHash,
      role: ROLES.WHOLESALER,
      status: USER_STATUS.ACTIVE,
    });
    const retailer = await User.create({
      name: 'Example Retailer',
      email: 'retailer@example.com',
      passwordHash: retailerHash,
      role: ROLES.RETAILER,
      status: USER_STATUS.ACTIVE,
    });
    const superadmin = await User.create({
      name: 'Super Admin',
      email: 'superadmin@example.com',
      passwordHash: superadminHash,
      role: ROLES.SUPER_ADMIN,
      status: USER_STATUS.ACTIVE,
    });
    const admin = await User.create({
      name: 'Admin',
      email: 'admin@example.com',
      passwordHash: adminHash,
      role: ROLES.ADMIN,
      status: USER_STATUS.ACTIVE,
    });

    profile = await WholesalerProfile.create({
      userId: wholesaler._id,
      businessName: 'Example Supplies',
      kycStatus: KYC_STATUS.APPROVED,
      isVerified: true,
      paymentSettings: {
        upiId: 'example@upi',
        upiIdPaymentsEnabled: true,
        additionalPaymentMethods: ['NET_BANKING'],
      },
    });
    const retailerProfile = await RetailerProfile.create({
      userId: retailer._id,
      businessName: 'Example Shop',
      assignedWholesalerId: wholesaler._id,
    });
    const relationship = await WholesalerRetailerRelationship.create({
      wholesalerId: wholesaler._id,
      retailerId: retailer._id,
      status: RELATIONSHIP_STATUS.ACTIVE,
    });
    retailerProfile.activeRelationshipId = relationship._id;
    await retailerProfile.save();

    const [wholesalerLogin, retailerLogin, superadminLogin, adminLogin] = await Promise.all([
      request(app).post('/api/v1/auth/login').send({ email: wholesaler.email, password: 'Wholesaler123' }),
      request(app).post('/api/v1/auth/login').send({ email: retailer.email, password: 'Retailer123' }),
      request(app).post('/api/v1/auth/login').send({ email: superadmin.email, password: 'Superadmin123' }),
      request(app).post('/api/v1/auth/login').send({ email: admin.email, password: 'Admin123' }),
    ]);
    wholesalerToken = wholesalerLogin.body.data.token;
    retailerToken = retailerLogin.body.data.token;
    superadminToken = superadminLogin.body.data.token;
    adminToken = adminLogin.body.data.token;
  });

  it('keeps new details pending until Superadmin approval and exposes only approved masked details', async () => {
    const submitted = await request(app)
      .patch('/api/v1/wholesaler/bank-details')
      .set('Authorization', `Bearer ${wholesalerToken}`)
      .send(bankDetails);

    expect(submitted.status).toBe(200);
    expect(submitted.headers['cache-control']).toBe('no-store');
    expect(submitted.body.data.bankDetails.verificationStatus).toBe('PENDING');
    expect(submitted.body.data.bankDetails.isVerified).toBe(false);
    expect((await WholesalerProfile.findById(profile._id)).kycStatus).toBe(KYC_STATUS.APPROVED);
    expect(await KycApplication.countDocuments({ wholesalerId: wholesaler._id })).toBe(0);

    const pendingOptions = await request(app)
      .get('/api/v1/retailer/payment-options')
      .set('Authorization', `Bearer ${retailerToken}`);
    expect(pendingOptions.body.data.paymentMethods).toContain('UPI');
    expect(pendingOptions.body.data.paymentMethods).not.toContain('NET_BANKING');
    expect(pendingOptions.body.data.bankDetails).toBeNull();
    expect(pendingOptions.headers['cache-control']).toBe('no-store');

    await WholesalerProfile.updateOne(
      { _id: profile._id },
      { $set: { kycStatus: KYC_STATUS.SUBMITTED } }
    );
    const bankApprovedButKycPending = await request(app)
      .patch(`/api/v1/admin/bank-details/${wholesaler._id}/approve`)
      .set('Authorization', `Bearer ${superadminToken}`)
      .send({});
    expect(bankApprovedButKycPending.status).toBe(200);
    const kycPendingOptions = await request(app)
      .get('/api/v1/retailer/payment-options')
      .set('Authorization', `Bearer ${retailerToken}`);
    expect(kycPendingOptions.body.data.paymentMethods).toContain('UPI');
    expect(kycPendingOptions.body.data.paymentMethods).not.toContain('NET_BANKING');
    expect(kycPendingOptions.body.data.bankDetails).toBeNull();

    await WholesalerProfile.updateOne(
      { _id: profile._id },
      { $set: { kycStatus: KYC_STATUS.APPROVED } }
    );
    const afterBothApprovals = await request(app)
      .get('/api/v1/retailer/payment-options')
      .set('Authorization', `Bearer ${retailerToken}`);
    expect(afterBothApprovals.body.data.paymentMethods).toContain('NET_BANKING');

    const pendingQueue = await request(app)
      .get('/api/v1/admin/bank-details?status=APPROVED')
      .set('Authorization', `Bearer ${superadminToken}`);
    expect(pendingQueue.status).toBe(200);
    expect(pendingQueue.headers['cache-control']).toBe('no-store');
    expect(pendingQueue.body.data).toHaveLength(1);
    expect(pendingQueue.body.data[0].bankDetails.accountNumber).toBe(bankDetails.accountNumber);

    const stored = await WholesalerProfile.findById(profile._id);
    expect(stored.kycStatus).toBe(KYC_STATUS.APPROVED);
    expect(stored.bankDetails.verificationStatus).toBe('APPROVED');
    expect(stored.bankDetails.verificationHistory.map((entry) => entry.status)).toEqual([
      'PENDING',
      'APPROVED',
    ]);
    expect(stored.bankDetails.approvedAt).toBeInstanceOf(Date);
    expect(String(stored.bankDetails.approvedBy)).toBe(String((await User.findOne({ email: 'superadmin@example.com' }))._id));
    expect(await WholesalerProfile.countDocuments({ userId: wholesaler._id })).toBe(1);
    expect(await AuditLog.countDocuments({
      entityType: 'WholesalerBankDetails',
      action: { $in: ['BANK_DETAILS_SUBMITTED', 'BANK_DETAILS_APPROVED'] },
    })).toBe(2);

    const approvedOptions = await request(app)
      .get('/api/v1/retailer/payment-options')
      .set('Authorization', `Bearer ${retailerToken}`);
    expect(approvedOptions.body.data.paymentMethods).toContain('UPI');
    expect(approvedOptions.body.data.paymentMethods).toContain('NET_BANKING');
    expect(approvedOptions.body.data.bankDetails.accountNumber).not.toBe(bankDetails.accountNumber);
    expect(approvedOptions.body.data.bankDetails.accountNumber.endsWith('9012')).toBe(true);
  });

  it('persists rejection reasons and permits a corrected resubmission without another KYC application', async () => {
    await request(app)
      .patch('/api/v1/wholesaler/bank-details')
      .set('Authorization', `Bearer ${wholesalerToken}`)
      .send(bankDetails)
      .expect(200);

    const rejected = await request(app)
      .patch(`/api/v1/admin/bank-details/${wholesaler._id}/reject`)
      .set('Authorization', `Bearer ${superadminToken}`)
      .send({ reason: 'Please correct the branch details.' });
    expect(rejected.status).toBe(200);

    const afterReject = await request(app)
      .get('/api/v1/wholesaler/payment-settings')
      .set('Authorization', `Bearer ${wholesalerToken}`);
    expect(afterReject.body.data.bankDetails.verificationStatus).toBe('REJECTED');
    expect(afterReject.body.data.bankDetails.rejectionReason).toBe('Please correct the branch details.');
    const retailerOptions = await request(app)
      .get('/api/v1/retailer/payment-options')
      .set('Authorization', `Bearer ${retailerToken}`);
    expect(retailerOptions.body.data.bankDetailsStatus).toBe('REJECTED');
    expect(retailerOptions.body.data.bankDetails).toBeNull();

    const corrected = { ...bankDetails, branch: 'North Branch' };
    const resubmitted = await request(app)
      .patch('/api/v1/wholesaler/bank-details')
      .set('Authorization', `Bearer ${wholesalerToken}`)
      .send({ ...corrected, confirmAccountNumber: '' });
    expect(resubmitted.status).toBe(200);
    expect(resubmitted.body.data.bankDetails.verificationStatus).toBe('PENDING');
    expect(resubmitted.body.data.bankDetails.rejectionReason).toBe('');

    const stored = await WholesalerProfile.findById(profile._id);
    expect(stored.kycStatus).toBe(KYC_STATUS.APPROVED);
    expect(stored.bankDetails.branch).toBe('North Branch');
    expect(stored.bankDetails.verificationHistory.map((entry) => entry.status)).toEqual([
      'PENDING',
      'REJECTED',
      'PENDING',
    ]);
    expect(await KycApplication.countDocuments({ wholesalerId: wholesaler._id })).toBe(0);
  });

  it('preserves existing approved details until a wholesaler changes them', async () => {
    const savedDetails = { ...bankDetails };
    delete savedDetails.confirmAccountNumber;
    await WholesalerProfile.updateOne(
      { _id: profile._id },
      {
        $set: {
          bankDetails: {
            ...savedDetails,
            isVerified: true,
            verificationStatus: 'APPROVED',
            approvedAt: new Date(),
          },
        },
      }
    );

    const unchanged = await request(app)
      .patch('/api/v1/wholesaler/bank-details')
      .set('Authorization', `Bearer ${wholesalerToken}`)
      .send(bankDetails);
    expect(unchanged.status).toBe(200);
    expect(unchanged.body.data.bankDetails.verificationStatus).toBe('APPROVED');
    expect(unchanged.body.data.bankDetails.accountNumber).toBe(bankDetails.accountNumber);

    const changed = await request(app)
      .patch('/api/v1/wholesaler/bank-details')
      .set('Authorization', `Bearer ${wholesalerToken}`)
      .send({ ...bankDetails, branch: 'North Branch', confirmAccountNumber: '' });
    expect(changed.status).toBe(200);
    expect(changed.body.data.bankDetails.verificationStatus).toBe('PENDING');
    expect(changed.body.data.bankDetails.isVerified).toBe(false);
    expect((await WholesalerProfile.findById(profile._id)).kycStatus).toBe(KYC_STATUS.APPROVED);
  });

  it('requires matching account confirmation and blocks non-Superadmin review', async () => {
    const mismatch = await request(app)
      .patch('/api/v1/wholesaler/bank-details')
      .set('Authorization', `Bearer ${wholesalerToken}`)
      .send({ ...bankDetails, confirmAccountNumber: '123456789013' });
    expect(mismatch.status).toBe(400);
    expect(mismatch.body.code).toBe('BANK_ACCOUNT_CONFIRMATION_MISMATCH');

    const deniedList = await request(app)
      .get('/api/v1/admin/bank-details')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(deniedList.status).toBe(403);

    await request(app)
      .patch('/api/v1/wholesaler/bank-details')
      .set('Authorization', `Bearer ${wholesalerToken}`)
      .send(bankDetails)
      .expect(200);
    const deniedReview = await request(app)
      .patch(`/api/v1/admin/bank-details/${wholesaler._id}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    expect(deniedReview.status).toBe(403);
  });
});
