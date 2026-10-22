const request = require('supertest');
jest.mock('../src/services/email.service', () => ({
  sendVerificationCode: jest.fn(),
}));

const app = require('../src/app');
const { setupTestDB, clearDatabase } = require('./setup');
const { User, WholesalerProfile, EmailOtp } = require('../src/models');
const { ROLES, USER_STATUS, KYC_STATUS } = require('../src/config/constants');
const AuthService = require('../src/modules/auth/auth.service');
const EmailService = require('../src/services/email.service');

setupTestDB();

describe('Email OTP two-factor authentication', () => {
  let user;
  let token;
  let sentCode;

  beforeEach(async () => {
    await clearDatabase();
    sentCode = '';
    EmailService.sendVerificationCode.mockImplementation(async (_email, code) => {
      sentCode = code;
    });
    user = await User.create({
      name: 'OTP Wholesaler',
      email: 'otp-wholesaler@example.test',
      passwordHash: await User.hashPassword('Password@123'),
      role: ROLES.WHOLESALER,
      status: USER_STATUS.ACTIVE,
    });
    const profile = await WholesalerProfile.create({
      userId: user._id,
      businessName: 'OTP Wholesale',
      kycStatus: KYC_STATUS.SUBMITTED,
    });
    user.wholesalerProfile = profile._id;
    await user.save();
    token = AuthService.generateTokens(user).accessToken;
  });

  const sendEnableCode = () => request(app)
    .post('/api/v1/auth/2fa/enable/send')
    .set('Authorization', `Bearer ${token}`);

  test('sends a private six-digit code, rejects wrong and reused codes, and enables 2FA', async () => {
    const sent = await sendEnableCode();

    expect(sent.status).toBe(200);
    expect(sent.body.data.maskedEmail).toBe('o***@example.test');
    expect(sent.body.data).not.toHaveProperty('code');
    expect(JSON.stringify(sent.body)).not.toContain(sentCode);
    expect(sentCode).toMatch(/^\d{6}$/);

    const savedOtp = await EmailOtp.findOne({ userId: user._id }).select('+codeHash');
    expect(savedOtp.codeHash).not.toBe(sentCode);
    expect(savedOtp.attempts).toBe(0);
    expect(savedOtp.expiresAt.getTime()).toBeGreaterThan(Date.now());

    const wrongCode = String((Number(sentCode) + 1) % 1_000_000).padStart(6, '0');
    const wrong = await request(app)
      .post('/api/v1/auth/2fa/enable/verify')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: wrongCode });
    expect(wrong.status).toBe(400);
    expect(wrong.body.message).toBe('Incorrect code. 4 attempts left');

    const verified = await request(app)
      .post('/api/v1/auth/2fa/enable/verify')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: sentCode });
    expect(verified.status).toBe(200);
    expect(verified.body.data.twoFactorEnabled).toBe(true);
    expect((await WholesalerProfile.findOne({ userId: user._id })).twoFactorEnabled).toBe(true);

    const reused = await request(app)
      .post('/api/v1/auth/2fa/enable/verify')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: sentCode });
    expect(reused.status).toBe(400);
  });

  test('rejects expired and hardcoded demo codes', async () => {
    await sendEnableCode();
    await EmailOtp.updateOne({ userId: user._id }, { $set: { expiresAt: new Date(Date.now() - 1) } });

    const expired = await request(app)
      .post('/api/v1/auth/2fa/enable/verify')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: sentCode });
    expect(expired.status).toBe(400);
    expect(expired.body.message).toBe('Code expired');

    const demoCode = await request(app)
      .post('/api/v1/auth/2fa/enable/verify')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: '123456' });
    expect(demoCode.status).toBe(400);
  });

  test('enforces cooldown, hourly send limit, and invalidates after five wrong attempts', async () => {
    await sendEnableCode();
    const tooSoon = await request(app)
      .post('/api/v1/auth/2fa/enable/resend')
      .set('Authorization', `Bearer ${token}`);
    expect(tooSoon.status).toBe(400);
    expect(tooSoon.body.code).toBe('OTP_RESEND_TOO_SOON');

    for (let send = 1; send < 5; send += 1) {
      await EmailOtp.updateOne({ userId: user._id }, { $set: { lastSentAt: new Date(Date.now() - 61_000) } });
      const resend = await request(app)
        .post('/api/v1/auth/2fa/enable/resend')
        .set('Authorization', `Bearer ${token}`);
      expect(resend.status).toBe(200);
    }

    await EmailOtp.updateOne({ userId: user._id }, { $set: { lastSentAt: new Date(Date.now() - 61_000) } });
    const overLimit = await request(app)
      .post('/api/v1/auth/2fa/enable/resend')
      .set('Authorization', `Bearer ${token}`);
    expect(overLimit.status).toBe(400);
    expect(overLimit.body.code).toBe('OTP_SEND_LIMIT_REACHED');

    const wrongCode = String((Number(sentCode) + 1) % 1_000_000).padStart(6, '0');
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const badCode = await request(app)
        .post('/api/v1/auth/2fa/enable/verify')
        .set('Authorization', `Bearer ${token}`)
        .send({ code: wrongCode });
      expect(badCode.status).toBe(400);
    }
    expect(await EmailOtp.findOne({ userId: user._id })).toBeNull();
  });

  test('requires the same OTP service to complete login when 2FA is enabled', async () => {
    await sendEnableCode();
    await request(app)
      .post('/api/v1/auth/2fa/enable/verify')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: sentCode });

    const login = await request(app).post('/api/v1/auth/login').send({
      email: user.email,
      password: 'Password@123',
      role: ROLES.WHOLESALER,
    });
    expect(login.status).toBe(200);
    expect(login.body.data.requiresTwoFactor).toBe(true);
    expect(login.body.data.token).toBeUndefined();
    expect(login.body.data.maskedEmail).toBe('o***@example.test');
    const challengeToken = login.body.data.challengeToken;

    const wrongCode = String((Number(sentCode) + 1) % 1_000_000).padStart(6, '0');
    const incorrect = await request(app).post('/api/v1/auth/login/2fa/verify').send({
      challengeToken,
      code: wrongCode,
    });
    expect(incorrect.status).toBe(400);
    expect(incorrect.body.message).toBe('Incorrect code. 4 attempts left');

    const verified = await request(app).post('/api/v1/auth/login/2fa/verify').send({
      challengeToken,
      code: sentCode,
    });
    expect(verified.status).toBe(200);
    expect(verified.body.data.token).toBeTruthy();
  });
});
