const request = require('supertest');
const app = require('../src/app');
const { setupTestDB, clearDatabase } = require('./setup');
const { User, AdminProfile, WholesalerProfile, KycApplication, KycDocument, AuditLog } = require('../src/models');
const { ROLES, USER_STATUS, KYC_STATUS } = require('../src/config/constants');

setupTestDB();

const submitKyc = (payload, token) => {
  const submission = request(app)
    .post('/api/v1/wholesaler/kyc')
    .set('Authorization', `Bearer ${token}`);

  Object.entries(payload).forEach(([key, value]) => submission.field(key, String(value)));

  return submission
    .field('panCard_type', 'PAN_CARD')
    .field('aadhaarFront_type', 'AADHAAR_FRONT')
    .field('aadhaarBack_type', 'AADHAAR_BACK')
    .attach('panCard', Buffer.from('pan-image'), { filename: 'pan.png', contentType: 'image/png' })
    .attach('aadhaarFront', Buffer.from('aadhaar-front'), { filename: 'aadhaar-front.png', contentType: 'image/png' })
    .attach('aadhaarBack', Buffer.from('aadhaar-back'), { filename: 'aadhaar-back.png', contentType: 'image/png' });
};

describe('KYC Workflow Test Suite', () => {
  let adminToken;
  let wholesalerToken;
  let wholesalerUser;
  let adminUser;

  beforeEach(async () => {
    await clearDatabase();

    // 1. Admin
    const adminHash = await User.hashPassword('AdminPassword123');
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
      password: 'AdminPassword123',
    });
    adminToken = adminLogin.body.data.token;

    // 2. Wholesaler
    const wsHash = await User.hashPassword('Wholesale123');
    wholesalerUser = await User.create({
      name: 'Pooja Textiles',
      email: 'pooja@textiles.com',
      passwordHash: wsHash,
      role: ROLES.WHOLESALER,
      status: USER_STATUS.ACTIVE,
    });
    await WholesalerProfile.create({
      userId: wholesalerUser._id,
      businessName: 'Pooja Textiles India',
      kycStatus: KYC_STATUS.DRAFT,
    });

    const wsLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'pooja@textiles.com',
      password: 'Wholesale123',
    });
    wholesalerToken = wsLogin.body.data.token;
  });

  test('1. Wholesaler submits KYC application', async () => {
    const kycPayload = {
      businessName: 'Pooja Textiles India Pvt Ltd',
      ownerName: 'Pooja Sharma',
      businessType: 'Private Limited',
      pan: 'AAACP1234F',
      gstin: '27AAACP1234F1Z5',
      address: '22 Textile Park',
      city: 'Surat',
      state: 'Gujarat',
      pincode: '395002',
      accountHolderName: 'Pooja Textiles India Pvt Ltd',
      accountNumber: '112233445566',
      ifscCode: 'SBIN0001234',
      bankName: 'State Bank of India',
    };

    const res = await submitKyc(kycPayload, wholesalerToken);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe(KYC_STATUS.SUBMITTED);
    expect(res.body.data.pan).toBe('AAACP1234F');
    const documents = await KycDocument.find({ wholesalerId: wholesalerUser._id });
    expect(documents.map((document) => document.documentType).sort()).toEqual([
      'AADHAAR_BACK',
      'AADHAAR_FRONT',
      'PAN_CARD',
    ]);
    const document = documents[0];
    const publicResponse = await request(app).get(`/uploads/kyc/${document.fileKey}`);
    expect(publicResponse.status).toBe(404);

    const adminResponse = await request(app)
      .get(`/api/v1/admin/kyc/documents/${document._id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(adminResponse.status).toBe(200);
    expect(adminResponse.headers['content-type']).toBe('image/png');

    // Verify Wholesaler Profile updated
    const profile = await WholesalerProfile.findOne({ userId: wholesalerUser._id });
    expect(profile.kycStatus).toBe(KYC_STATUS.SUBMITTED);
  });

  test('KYC submission requires PAN and both Aadhaar images', async () => {
    const res = await request(app)
      .post('/api/v1/wholesaler/kyc')
      .set('Authorization', `Bearer ${wholesalerToken}`)
      .send({ businessName: 'Pooja Textiles', pan: 'AAACP1234F', gstin: '27AAACP1234F1Z5' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('KYC_DOCUMENTS_REQUIRED');
  });

  test('2. Admin sees pending KYC applications', async () => {
    // Submit KYC first
    await submitKyc({
        businessName: 'Pooja Textiles',
        pan: 'AAACP1234F',
        gstin: '27AAACP1234F1Z5',
        address: '22 Textile Park',
        city: 'Surat',
        state: 'Gujarat',
        pincode: '395002',
        accountHolderName: 'Pooja Textiles',
        accountNumber: '112233445566',
        ifscCode: 'SBIN0001234',
        bankName: 'SBI',
      }, wholesalerToken);

    const res = await request(app)
      .get('/api/v1/admin/kyc')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0].status).toBe(KYC_STATUS.SUBMITTED);
    expect(res.body.data[0]._id).toBeDefined();
  });

  test('Super Admin can view a private KYC profile without exposing file keys or bank account numbers', async () => {
    const submitRes = await submitKyc({
      businessName: 'Pooja Textiles',
      ownerName: 'Pooja Sharma',
      pan: 'AAACP1234F',
      gstin: '27AAACP1234F1Z5',
      address: '22 Textile Park',
      city: 'Surat',
      state: 'Gujarat',
      pincode: '395002',
      accountHolderName: 'Pooja Textiles',
      accountNumber: '112233445566',
      ifscCode: 'SBIN0001234',
      bankName: 'State Bank of India',
    }, wholesalerToken);

    const applicationId = submitRes.body.data._id;
    const response = await request(app)
      .get(`/api/v1/admin/kyc/${applicationId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data._id).toBe(applicationId);
    expect(response.body.data.documents).toHaveLength(3);
    expect(response.body.data.documents[0]).not.toHaveProperty('fileKey');
    expect(response.body.data.bankDetails.accountNumber).toBe('•••• 5566');
    expect(response.body.data.profile.bankDetails.accountNumber).toBe('•••• 5566');
    expect(JSON.stringify(response.body)).not.toContain('112233445566');
    await expect(
      AuditLog.findOne({
        action: 'KYC_VIEWED',
        entityId: applicationId,
        actorId: adminUser._id,
      }),
    ).resolves.toBeTruthy();

    const forbiddenResponse = await request(app)
      .get(`/api/v1/admin/kyc/${applicationId}`)
      .set('Authorization', `Bearer ${wholesalerToken}`);
    expect(forbiddenResponse.status).toBe(403);

    const missingResponse = await request(app)
      .get('/api/v1/admin/kyc/not-a-valid-id')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(missingResponse.status).toBe(404);
  });

  test('3. Admin Approves KYC -> Activates Wholesaler & generates audit log', async () => {
    // Submit
    const submitRes = await submitKyc({
        businessName: 'Pooja Textiles',
        pan: 'AAACP1234F',
        gstin: '27AAACP1234F1Z5',
        address: '22 Textile Park',
        city: 'Surat',
        state: 'Gujarat',
        pincode: '395002',
        accountHolderName: 'Pooja Textiles',
        accountNumber: '112233445566',
        ifscCode: 'SBIN0001234',
        bankName: 'SBI',
      }, wholesalerToken);

    const kycId = submitRes.body.data._id;

    // Approve
    const approveRes = await request(app)
      .patch(`/api/v1/admin/kyc/${kycId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(approveRes.status).toBe(200);
    expect(approveRes.body.data.status).toBe(KYC_STATUS.APPROVED);
    expect(approveRes.body.data.reviewedBy).toBe(String(adminUser._id));

    // Wholesaler profile is verified
    const profile = await WholesalerProfile.findOne({ userId: wholesalerUser._id });
    expect(profile.kycStatus).toBe(KYC_STATUS.APPROVED);
    expect(profile.isVerified).toBe(true);

    // Audit log exists
    const audit = await AuditLog.findOne({ entityId: kycId, action: 'KYC_APPROVED' });
    expect(audit).not.toBeNull();
  });

  test('4. Admin Rejects KYC with reason', async () => {
    const submitRes = await submitKyc({
        businessName: 'Pooja Textiles',
        pan: 'AAACP1234F',
        gstin: '27AAACP1234F1Z5',
        address: '22 Textile Park',
        city: 'Surat',
        state: 'Gujarat',
        pincode: '395002',
        accountHolderName: 'Pooja Textiles',
        accountNumber: '112233445566',
        ifscCode: 'SBIN0001234',
        bankName: 'SBI',
      }, wholesalerToken);

    const kycId = submitRes.body.data._id;

    const rejectRes = await request(app)
      .patch(`/api/v1/admin/kyc/${kycId}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'GSTIN does not match legal entity name' });

    expect(rejectRes.status).toBe(200);
    expect(rejectRes.body.data.status).toBe(KYC_STATUS.REJECTED);
    expect(rejectRes.body.data.reviewReason).toBe('GSTIN does not match legal entity name');
  });

  test('5. Admin Requests KYC Resubmission', async () => {
    const submitRes = await submitKyc({
        businessName: 'Pooja Textiles',
        pan: 'AAACP1234F',
        gstin: '27AAACP1234F1Z5',
        address: '22 Textile Park',
        city: 'Surat',
        state: 'Gujarat',
        pincode: '395002',
        accountHolderName: 'Pooja Textiles',
        accountNumber: '112233445566',
        ifscCode: 'SBIN0001234',
        bankName: 'SBI',
      }, wholesalerToken);

    const kycId = submitRes.body.data._id;

    const resubRes = await request(app)
      .patch(`/api/v1/admin/kyc/${kycId}/resubmission`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Bank statement is blurry, please re-upload clear copy.' });

    expect(resubRes.status).toBe(200);
    expect([KYC_STATUS.RESUBMIT_REQUESTED, KYC_STATUS.RESUBMISSION_REQUIRED]).toContain(resubRes.body.data.status);
  });
});
