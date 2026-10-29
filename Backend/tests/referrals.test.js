const request = require('supertest');
const app = require('../src/app');
const { setupTestDB, clearDatabase } = require('./setup');
const {
  User,
  WholesalerProfile,
  RetailerProfile,
  WholesalerRetailerRelationship,
} = require('../src/models');
const { ROLES, USER_STATUS, KYC_STATUS } = require('../src/config/constants');
const AuthService = require('../src/modules/auth/auth.service');

setupTestDB();

describe('Wholesaler referral-only retailer registration', () => {
  let wholesaler;
  let wholesalerProfile;
  let wholesalerToken;
  let adminToken;
  const referralCode = 'AB12CD';

  beforeEach(async () => {
    await clearDatabase();
    wholesaler = await User.create({
      name: 'Private Owner Name',
      email: 'private-owner@example.test',
      phone: '9876543210',
      passwordHash: await User.hashPassword('Password@123'),
      role: ROLES.WHOLESALER,
      status: USER_STATUS.ACTIVE,
    });
    wholesalerProfile = await WholesalerProfile.create({
      userId: wholesaler._id,
      businessName: 'Safe Business Name',
      businessLogoUrl: 'https://example.test/logo.png',
      address: { city: 'Pune', state: 'Maharashtra' },
      kycStatus: KYC_STATUS.APPROVED,
      retailerReferralCode: referralCode,
    });
    wholesalerToken = AuthService.generateTokens(wholesaler).accessToken;
    const admin = await User.create({
      name: 'Admin',
      email: 'admin@example.test',
      passwordHash: await User.hashPassword('Password@123'),
      role: ROLES.SUPER_ADMIN,
      status: USER_STATUS.ACTIVE,
    });
    adminToken = AuthService.generateTokens(admin).accessToken;
  });

  test('public referral lookup returns only safe business-facing details', async () => {
    const response = await request(app).get(`/api/v1/referral/${referralCode}`);

    expect(response.status).toBe(200);
    expect(response.body.data.wholesaler).toEqual({
      _id: String(wholesaler._id),
      id: String(wholesaler._id),
      wholesalerId: String(wholesaler._id),
      businessName: 'Safe Business Name',
      logo: 'https://example.test/logo.png',
      city: 'Pune',
      categories: [],
      activeStoreTheme: 'DEFAULT',
    });
    expect(Object.keys(response.body.data.wholesaler).sort()).toEqual([
      '_id',
      'activeStoreTheme',
      'businessName',
      'categories',
      'city',
      'id',
      'logo',
      'wholesalerId',
    ]);
    expect(JSON.stringify(response.body)).not.toMatch(/Private Owner Name|private-owner@example\.test|9876543210|gstin|kyc/i);
  });

  test('registration rejects a missing or invalid code without creating an account', async () => {
    const payload = {
      name: 'Retailer',
      email: 'retailer@example.test',
      phone: '9123456789',
      password: 'Password@123',
    };

    const missingCode = await request(app).post('/api/v1/auth/register').send(payload);
    const invalidCode = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...payload, email: 'retailer2@example.test', referralCode: 'NOTVALID123' });

    expect(missingCode.status).toBe(403);
    expect(invalidCode.status).toBe(403);
    expect(invalidCode.body.message).toBe('This link is not valid. Please ask your wholesaler for a new link.');
    expect(await User.countDocuments({ role: ROLES.RETAILER })).toBe(0);
  });

  test('wholesaler self-registration remains independent of retailer referrals', async () => {
    const response = await request(app).post('/api/v1/auth/register').send({
      name: 'New Wholesaler',
      email: 'new-wholesaler@example.test',
      password: 'Password@123',
      phone: '9123456789',
      role: ROLES.WHOLESALER,
    });

    expect(response.status).toBe(201);
    expect(response.body.data.user.role).toBe(ROLES.WHOLESALER);
    expect(response.body.data).not.toHaveProperty('token');
    expect(response.body.data).not.toHaveProperty('accessToken');
    expect(response.body.data).not.toHaveProperty('refreshToken');

    const login = await request(app).post('/api/v1/auth/login').send({
      email: 'new-wholesaler@example.test',
      password: 'Password@123',
      role: ROLES.WHOLESALER,
    });
    expect(login.status).toBe(200);
    expect(login.body.data.token).toBeTruthy();

    const duplicateEmail = await request(app).post('/api/v1/auth/register').send({
      name: 'Duplicate Email Wholesaler',
      email: 'new-wholesaler@example.test',
      password: 'Password@123',
      phone: '9234567890',
      role: 'wholesaler',
    });
    expect(duplicateEmail.status).toBe(409);
    expect(duplicateEmail.body.code).toBe('EMAIL_ALREADY_EXISTS');

    const duplicateMobile = await request(app).post('/api/v1/auth/register').send({
      name: 'Duplicate Mobile Wholesaler',
      email: 'duplicate-mobile@example.test',
      password: 'Password@123',
      phone: '9123456789',
      role: 'wholesaler',
    });
    expect(duplicateMobile.status).toBe(409);
    expect(duplicateMobile.body.code).toBe('PHONE_ALREADY_EXISTS');
  });

  test('wholesaler invite code is generated securely and remains stable', async () => {
    wholesalerProfile.retailerReferralCode = undefined;
    await wholesalerProfile.save();

    const first = await request(app)
      .get('/api/v1/wholesaler/referral')
      .set('Authorization', `Bearer ${wholesalerToken}`);
    const second = await request(app)
      .get('/api/v1/wholesaler/referral')
      .set('Authorization', `Bearer ${wholesalerToken}`);

    expect(first.status).toBe(200);
    expect(first.body.data.code).toMatch(/^[A-Z0-9]{6}$/);
    expect(second.body.data.code).toBe(first.body.data.code);
  });

  test('legacy long invite codes are rotated to six characters on referral load', async () => {
    wholesalerProfile.retailerReferralCode = 'E17DA0E32BE5E17DC9DEBBBC459AEDCB';
    await wholesalerProfile.save();

    const response = await request(app)
      .get('/api/v1/wholesaler/referral')
      .set('Authorization', `Bearer ${wholesalerToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.code).toMatch(/^[A-Z0-9]{6}$/);
    expect(wholesalerProfile.retailerReferralCode).not.toBe(response.body.data.code);
    expect((await WholesalerProfile.findById(wholesalerProfile._id)).retailerReferralCode)
      .toBe(response.body.data.code);
    expect((await request(app).get('/api/v1/referral/E17DA0E32BE5E17DC9DEBBBC459AEDCB')).status)
      .toBe(403);
  });

  test('valid referral registration links retailer from server-resolved code and enforces unique mobile', async () => {
    const payload = {
      name: 'Retailer Owner',
      loginId: 'RETAILER01',
      businessName: 'Retailer Store',
      city: 'Jaipur',
      state: 'Rajasthan',
      address: '123 Main Road',
      pincode: '302001',
      email: 'retailer@example.test',
      phone: '9123456789',
      password: 'Password@123',
      role: 'retailer',
      referralCode,
      utmSource: 'facebook',
      utmMedium: 'paid_social',
      utmCampaign: 'diwali',
      utmTerm: 'wholesale',
      utmContent: 'banner-a',
      firstLandingAt: '2026-10-20T10:00:00.000Z',
      wholesalerId: '000000000000000000000000',
    };

    const first = await request(app).post('/api/v1/auth/register').send(payload);
    expect(first.status).toBe(201);
    const retailer = await User.findOne({ email: payload.email }).populate('retailerProfile');
    const relationship = await WholesalerRetailerRelationship.findOne({ retailerId: retailer._id });

    expect(retailer.phone).toBe('9123456789');
    expect(retailer.loginId).toBe('RETAILER01');
    expect(String(retailer.retailerProfile.assignedWholesalerId)).toBe(String(wholesaler._id));
    expect(String(relationship.wholesalerId)).toBe(String(wholesaler._id));
    expect(relationship.referralCode).toBe(referralCode);
    expect(retailer.retailerProfile.referralCodeUsed).toBe(referralCode);
    expect(retailer.retailerProfile.utmSource).toBe('facebook');
    expect(retailer.retailerProfile.utmMedium).toBe('paid_social');
    expect(retailer.retailerProfile.utmCampaign).toBe('diwali');
    expect(retailer.retailerProfile.utmTerm).toBe('wholesale');
    expect(retailer.retailerProfile.utmContent).toBe('banner-a');
    expect(retailer.retailerProfile.firstLandingAt.toISOString()).toBe('2026-10-20T10:00:00.000Z');

    const duplicateMobile = await request(app).post('/api/v1/auth/register').send({
      ...payload,
      loginId: 'RETAILER02',
      email: 'retailer-duplicate@example.test',
      phone: '+919123456789',
    });
    expect(duplicateMobile.status).toBe(409);
    expect(duplicateMobile.body.code).toBe('PHONE_ALREADY_EXISTS');

    const duplicateLoginId = await request(app).post('/api/v1/auth/register').send({
      ...payload,
      email: 'retailer-duplicate-id@example.test',
      phone: '9234567890',
    });
    expect(duplicateLoginId.status).toBe(409);
    expect(duplicateLoginId.body.code).toBe('LOGIN_ID_ALREADY_EXISTS');

    const retailerList = await request(app)
      .get('/api/v1/wholesaler/retailers')
      .set('Authorization', `Bearer ${wholesalerToken}`);
    expect(retailerList.status).toBe(200);
    expect(retailerList.body.data[0].loginId).toBeUndefined();

    const retailerDetails = await request(app)
      .get(`/api/v1/wholesaler/retailers/${relationship._id}`)
      .set('Authorization', `Bearer ${wholesalerToken}`);
    expect(retailerDetails.status).toBe(200);
    expect(retailerDetails.body.data.loginId).toBeUndefined();
    expect(JSON.stringify(retailerDetails.body)).not.toContain('RETAILER01');

    const passwordReset = await request(app)
      .patch(`/api/v1/wholesaler/retailers/${relationship._id}/password`)
      .set('Authorization', `Bearer ${wholesalerToken}`)
      .send({ password: 'NewPassword123' });
    expect(passwordReset.status).toBe(404);
  });

  test('invalid, paused, unapproved, or suspended wholesaler referrals cannot be looked up', async () => {
    const route = () => request(app).get(`/api/v1/referral/${referralCode}`);

    wholesalerProfile.retailerSignupsEnabled = false;
    await wholesalerProfile.save();
    expect((await route()).status).toBe(403);

    wholesalerProfile.retailerSignupsEnabled = true;
    wholesalerProfile.kycStatus = KYC_STATUS.DRAFT;
    await wholesalerProfile.save();
    expect((await route()).status).toBe(403);

    wholesalerProfile.kycStatus = KYC_STATUS.APPROVED;
    await wholesalerProfile.save();
    wholesaler.status = USER_STATUS.SUSPENDED;
    await wholesaler.save();
    expect((await route()).status).toBe(403);
  });

  test('wholesaler can regenerate and pause/resume the single referral code', async () => {
    const initial = await request(app)
      .get('/api/v1/wholesaler/referral')
      .set('Authorization', `Bearer ${wholesalerToken}`);
    expect(initial.status).toBe(200);
    expect(initial.body.data.code).toMatch(/^[A-Z0-9]{6}$/);
    expect(initial.body.data.joinedCount).toBe(0);

    await WholesalerRetailerRelationship.create({
      wholesalerId: wholesaler._id,
      retailerId: new User({
        name: 'Existing Retailer',
        email: 'existing@example.test',
        passwordHash: 'hash',
        role: ROLES.RETAILER,
        status: USER_STATUS.ACTIVE,
      })._id,
      referralCode,
      status: 'ACTIVE',
    });

    const regenerated = await request(app)
      .post('/api/v1/wholesaler/referral/regenerate')
      .set('Authorization', `Bearer ${wholesalerToken}`);
    expect(regenerated.status).toBe(200);
    expect(regenerated.body.data.code).not.toBe(initial.body.data.code);
    expect(regenerated.body.data.code).toMatch(/^[A-Z0-9]{6}$/);
    expect(regenerated.body.data.joinedCount).toBe(1);
    expect((await request(app).get(`/api/v1/referral/${initial.body.data.code}`)).status).toBe(403);

    const paused = await request(app)
      .patch('/api/v1/wholesaler/referral')
      .set('Authorization', `Bearer ${wholesalerToken}`)
      .send({ enabled: false });
    expect(paused.status).toBe(200);
    expect(paused.body.data.signupsEnabled).toBe(false);
    expect((await request(app).get(`/api/v1/referral/${regenerated.body.data.code}`)).status).toBe(403);

    const resumed = await request(app)
      .patch('/api/v1/wholesaler/referral')
      .set('Authorization', `Bearer ${wholesalerToken}`)
      .send({ enabled: true });
    expect(resumed.body.data.signupsEnabled).toBe(true);
  });

  test('legacy invitation registration and direct Super Admin account creation require a referral code', async () => {
    const legacyRegister = await request(app).post('/api/v1/auth/register').send({
      name: 'Legacy Retailer',
      email: 'legacy@example.test',
      phone: '9234567890',
      password: 'Password@123',
      inviteToken: 'legacy-token',
    });
    expect(legacyRegister.status).toBe(403);

    const legacyInviteCreation = await request(app)
      .post('/api/v1/wholesaler/invite-links')
      .set('Authorization', `Bearer ${wholesalerToken}`)
      .send({});
    expect(legacyInviteCreation.status).toBe(404);

    const adminCreate = await request(app)
      .post('/api/v1/admin/retailers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Admin Created Retailer',
        email: 'admin-created@example.test',
        phone: '9345678901',
        password: 'Password@123',
        wholesalerId: String(wholesaler._id),
      });
    expect(adminCreate.status).toBe(404);
    expect(await User.findOne({ email: 'admin-created@example.test' })).toBeNull();
  });
});
