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

setupTestDB();

describe('Invitation & One-Retailer-One-Wholesaler Rule Test Suite', () => {
  let wholesalerAUser;
  let wholesalerBUser;
  let retailerUser;
  let wholesalerAToken;
  let wholesalerBToken;
  let retailerToken;

  beforeEach(async () => {
    await clearDatabase();

    // 1. Wholesaler A (with APPROVED KYC)
    const wsAHash = await User.hashPassword('WholesalerA123');
    wholesalerAUser = await User.create({
      name: 'Wholesaler Alpha',
      email: 'alpha@wholesale.com',
      passwordHash: wsAHash,
      role: ROLES.WHOLESALER,
      status: USER_STATUS.ACTIVE,
    });
    await WholesalerProfile.create({
      userId: wholesalerAUser._id,
      businessName: 'Alpha Wholesale Corp',
      kycStatus: KYC_STATUS.APPROVED,
      isVerified: true,
    });
    const wsALogin = await request(app).post('/api/v1/auth/login').send({
      email: 'alpha@wholesale.com',
      password: 'WholesalerA123',
    });
    wholesalerAToken = wsALogin.body.data.token;

    // 2. Wholesaler B (with APPROVED KYC)
    const wsBHash = await User.hashPassword('WholesalerB123');
    wholesalerBUser = await User.create({
      name: 'Wholesaler Beta',
      email: 'beta@wholesale.com',
      passwordHash: wsBHash,
      role: ROLES.WHOLESALER,
      status: USER_STATUS.ACTIVE,
    });
    await WholesalerProfile.create({
      userId: wholesalerBUser._id,
      businessName: 'Beta Wholesale Corp',
      kycStatus: KYC_STATUS.APPROVED,
      isVerified: true,
    });
    const wsBLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'beta@wholesale.com',
      password: 'WholesalerB123',
    });
    wholesalerBToken = wsBLogin.body.data.token;

    // 3. Retailer R
    const retHash = await User.hashPassword('Retailer123');
    retailerUser = await User.create({
      name: 'Retailer Ramesh',
      email: 'ramesh@retail.com',
      passwordHash: retHash,
      role: ROLES.RETAILER,
      status: USER_STATUS.ACTIVE,
    });
    await RetailerProfile.create({
      userId: retailerUser._id,
      businessName: 'Ramesh Supermarket',
    });
    const retLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'ramesh@retail.com',
      password: 'Retailer123',
    });
    retailerToken = retLogin.body.data.token;
  });

  test('1. Wholesaler generates invitation token link', async () => {
    const res = await request(app)
      .post('/api/v1/wholesaler/invite-links')
      .set('Authorization', `Bearer ${wholesalerAToken}`)
      .send({ maxUses: 50, expiresInDays: 14 });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.inviteUrl).toContain('/join/');
  });

  test('Wholesaler cannot create retailer accounts through the removed manual endpoint', async () => {
    const res = await request(app)
      .post('/api/v1/wholesaler/retailers')
      .set('Authorization', 'Bearer ' + wholesalerAToken)
      .send({
        retailerName: 'Manual Retailer',
        loginId: 'MANUAL01',
        password: 'Manual123',
      });

    expect(res.status).toBe(404);
  });

  test('2. CRITICAL BUSINESS RULE: Connect Retailer R -> Wholesaler A, then attempt R -> Wholesaler B must return HTTP 409 RETAILER_ALREADY_LINKED', async () => {
    // Generate Invite for Wholesaler A
    const inviteARes = await request(app)
      .post('/api/v1/wholesaler/invite-links')
      .set('Authorization', `Bearer ${wholesalerAToken}`)
      .send({});
    const tokenA = inviteARes.body.data.token;

    // Generate Invite for Wholesaler B
    const inviteBRes = await request(app)
      .post('/api/v1/wholesaler/invite-links')
      .set('Authorization', `Bearer ${wholesalerBToken}`)
      .send({});
    const tokenB = inviteBRes.body.data.token;

    // Step 1: Retailer R accepts Wholesaler A's invitation -> Success
    const acceptARes = await request(app)
      .post(`/api/v1/invitations/${tokenA}/accept`)
      .set('Authorization', `Bearer ${retailerToken}`)
      .send({});

    expect(acceptARes.status).toBe(200);
    expect(acceptARes.body.success).toBe(true);
    expect(acceptARes.body.data.relationship.status).toBe('ACTIVE');
    expect(String(acceptARes.body.data.relationship.wholesalerId)).toBe(String(wholesalerAUser._id));

    // Step 2: Retailer R attempts to accept Wholesaler B's invitation -> MUST BE REJECTED WITH 409
    const acceptBRes = await request(app)
      .post(`/api/v1/invitations/${tokenB}/accept`)
      .set('Authorization', `Bearer ${retailerToken}`)
      .send({});

    expect(acceptBRes.status).toBe(409);
    expect(acceptBRes.body.success).toBe(false);
    expect(acceptBRes.body.code).toBe('RETAILER_ALREADY_LINKED');

    // Step 3: Verify database has ONLY 1 active relationship for Retailer R
    const activeRelationships = await WholesalerRetailerRelationship.find({
      retailerId: retailerUser._id,
      status: 'ACTIVE',
    });

    expect(activeRelationships.length).toBe(1);
    expect(String(activeRelationships[0].wholesalerId)).toBe(String(wholesalerAUser._id));
  });

  test('3. Unapproved wholesaler cannot generate invitation links', async () => {
    // Set Wholesaler A to DRAFT
    await WholesalerProfile.findOneAndUpdate(
      { userId: wholesalerAUser._id },
      { kycStatus: KYC_STATUS.DRAFT, isVerified: false }
    );

    const res = await request(app)
      .post('/api/v1/wholesaler/invite-links')
      .set('Authorization', `Bearer ${wholesalerAToken}`)
      .send({});

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('KYC_APPROVAL_REQUIRED');
  });

  test('4. Expired or revoked invitation link cannot be accepted', async () => {
    const inviteRes = await request(app)
      .post('/api/v1/wholesaler/invite-links')
      .set('Authorization', `Bearer ${wholesalerAToken}`)
      .send({ expiresInDays: -1 }); // already expired

    const token = inviteRes.body.data.token;

    const acceptRes = await request(app)
      .post(`/api/v1/invitations/${token}/accept`)
      .set('Authorization', `Bearer ${retailerToken}`)
      .send({});

    expect(acceptRes.status).toBe(400);
    expect(acceptRes.body.code).toBe('INVALID_INVITATION');
  });
});
