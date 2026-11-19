const request = require('supertest');
const app = require('../src/app');
const { setupTestDB, clearDatabase } = require('./setup');
const {
  User,
  KycApplication,
  WholesalerProfile,
  RetailerProfile,
  WholesalerRetailerRelationship,
} = require('../src/models');
const {
  ROLES,
  USER_STATUS,
  KYC_STATUS,
  RELATIONSHIP_STATUS,
} = require('../src/config/constants');

setupTestDB();

describe('Wholesaler bank details and retailer payment options', () => {
  let wholesaler;
  let retailer;
  let retailerToken;
  let wholesalerToken;
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

    const [wholesalerHash, retailerHash] = await Promise.all([
      User.hashPassword('Wholesaler123'),
      User.hashPassword('Retailer123'),
    ]);
    wholesaler = await User.create({
      name: 'Example Wholesaler',
      email: 'wholesaler@example.com',
      passwordHash: wholesalerHash,
      role: ROLES.WHOLESALER,
      status: USER_STATUS.ACTIVE,
    });
    retailer = await User.create({
      name: 'Example Retailer',
      email: 'retailer@example.com',
      passwordHash: retailerHash,
      role: ROLES.RETAILER,
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

    const [wholesalerLogin, retailerLogin] = await Promise.all([
      request(app).post('/api/v1/auth/login').send({ email: wholesaler.email, password: 'Wholesaler123' }),
      request(app).post('/api/v1/auth/login').send({ email: retailer.email, password: 'Retailer123' }),
    ]);
    wholesalerToken = wholesalerLogin.body.data.token;
    retailerToken = retailerLogin.body.data.token;
  });

  it('saves complete details for approved KYC and enables Bank Transfer immediately', async () => {
    const saved = await request(app)
      .patch('/api/v1/wholesaler/bank-details')
      .set('Authorization', `Bearer ${wholesalerToken}`)
      .send(bankDetails);

    expect(saved.status).toBe(200);
    expect(saved.headers['cache-control']).toBe('no-store');
    expect(saved.body.data.kycApproved).toBe(true);
    expect(saved.body.data.bankDetails).toMatchObject({
      accountHolderName: bankDetails.accountHolderName,
      bankName: bankDetails.bankName,
      accountNumber: bankDetails.accountNumber,
      ifscCode: bankDetails.ifscCode,
      branch: bankDetails.branch,
      isVerified: true,
      verificationStatus: 'VERIFIED',
    });

    const stored = await WholesalerProfile.findById(profile._id);
    expect(stored.bankDetails.accountNumber).toBe(bankDetails.accountNumber);
    expect(stored.bankDetails.isVerified).toBe(true);
    expect(stored.kycStatus).toBe(KYC_STATUS.APPROVED);
    expect(await KycApplication.countDocuments({ wholesalerId: wholesaler._id })).toBe(0);

    const refreshedSettings = await request(app)
      .get('/api/v1/wholesaler/payment-settings')
      .set('Authorization', `Bearer ${wholesalerToken}`);
    expect(refreshedSettings.body.data.bankDetails.accountNumber).toBe(bankDetails.accountNumber);
    expect(refreshedSettings.body.data.bankDetails.verificationStatus).toBe('VERIFIED');

    const retailerOptions = await request(app)
      .get(`/api/v1/retailer/payment-options?wholesalerId=${wholesaler._id}`)
      .set('Authorization', `Bearer ${retailerToken}`);
    expect(retailerOptions.status).toBe(200);
    expect(retailerOptions.headers['cache-control']).toBe('no-store');
    expect(retailerOptions.body.data.wholesalerId).toBe(String(wholesaler._id));
    expect(retailerOptions.body.data.paymentMethods).toEqual(
      expect.arrayContaining(['UPI', 'BANK_TRANSFER', 'NET_BANKING'])
    );
    expect(retailerOptions.body.data.bankDetails.accountNumber).toBe('••••••••9012');
  });

  it('requires approved KYC to save bank details but keeps UPI independent', async () => {
    await WholesalerProfile.updateOne(
      { _id: profile._id },
      { $set: { kycStatus: KYC_STATUS.SUBMITTED, isVerified: false } }
    );

    const rejectedSave = await request(app)
      .patch('/api/v1/wholesaler/bank-details')
      .set('Authorization', `Bearer ${wholesalerToken}`)
      .send(bankDetails);
    expect(rejectedSave.status).toBe(403);
    expect(rejectedSave.body.code).toBe('KYC_APPROVAL_REQUIRED');
    expect((await WholesalerProfile.findById(profile._id)).bankDetails.accountNumber).toBe('');

    const retailerOptions = await request(app)
      .get(`/api/v1/retailer/payment-options?wholesalerId=${wholesaler._id}`)
      .set('Authorization', `Bearer ${retailerToken}`);
    expect(retailerOptions.body.data.paymentMethods).toContain('UPI');
    expect(retailerOptions.body.data.paymentMethods).not.toContain('BANK_TRANSFER');
    expect(retailerOptions.body.data.bankDetails).toBeNull();
  });

  it('keeps Bank Transfer unavailable when saved bank details are incomplete', async () => {
    await WholesalerProfile.updateOne(
      { _id: profile._id },
      {
        $set: {
          bankDetails: {
            accountHolderName: bankDetails.accountHolderName,
            bankName: bankDetails.bankName,
            accountNumber: bankDetails.accountNumber,
            ifscCode: '',
            branch: bankDetails.branch,
          },
        },
      }
    );

    const retailerOptions = await request(app)
      .get(`/api/v1/retailer/payment-options?wholesalerId=${wholesaler._id}`)
      .set('Authorization', `Bearer ${retailerToken}`);
    expect(retailerOptions.body.data.paymentMethods).toContain('UPI');
    expect(retailerOptions.body.data.paymentMethods).not.toContain('BANK_TRANSFER');
    expect(retailerOptions.body.data.bankDetailsStatus).toBe('INCOMPLETE');
    expect(retailerOptions.body.data.bankDetails).toBeNull();
  });

  it('does not return another wholesaler when a requested relationship is missing', async () => {
    const passwordHash = await User.hashPassword('OtherWholesaler123');
    const otherWholesaler = await User.create({
      name: 'Other Wholesaler',
      email: 'other-wholesaler@example.com',
      passwordHash,
      role: ROLES.WHOLESALER,
      status: USER_STATUS.ACTIVE,
    });
    await WholesalerProfile.create({
      userId: otherWholesaler._id,
      businessName: 'Other Supplies',
      kycStatus: KYC_STATUS.APPROVED,
      isVerified: true,
      bankDetails: bankDetails,
    });

    const response = await request(app)
      .get(`/api/v1/retailer/payment-options?wholesalerId=${otherWholesaler._id}`)
      .set('Authorization', `Bearer ${retailerToken}`);
    expect(response.status).toBe(403);
    expect(response.body.code).toBe('NO_ACTIVE_WHOLESALER');
  });

  it('rejects mismatched account confirmation', async () => {
    const response = await request(app)
      .patch('/api/v1/wholesaler/bank-details')
      .set('Authorization', `Bearer ${wholesalerToken}`)
      .send({ ...bankDetails, confirmAccountNumber: '123456789013' });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('BANK_ACCOUNT_CONFIRMATION_MISMATCH');
    expect((await WholesalerProfile.findById(profile._id)).bankDetails.accountNumber).toBe('');
  });
});
