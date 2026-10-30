const request = require('supertest');
jest.mock('../src/services/email.service', () => ({
  sendVerificationCode: jest.fn(),
  sendPasswordResetCode: jest.fn(),
}));

const app = require('../src/app');
const { setupTestDB, clearDatabase } = require('./setup');
const { User } = require('../src/models');
const { ROLES, USER_STATUS } = require('../src/config/constants');
const EmailService = require('../src/services/email.service');

setupTestDB();

describe('Email OTP password reset', () => {
  const sentCodes = new Map();
  const originalPassword = 'OldPassword123';
  const newPassword = 'NewPassword123';

  beforeEach(async () => {
    await clearDatabase();
    sentCodes.clear();
    EmailService.sendPasswordResetCode.mockClear();
    EmailService.sendPasswordResetCode.mockImplementation(async (email, code) => {
      sentCodes.set(email, code);
    });
  });

  async function createUser(role, index = 1) {
    return User.create({
      name: `${role} Test User`,
      email: `password-reset-${index}@example.test`,
      passwordHash: await User.hashPassword(originalPassword),
      role,
      status: USER_STATUS.ACTIVE,
    });
  }

  const requestCode = (email) => request(app)
    .post('/api/v1/auth/forgot-password')
    .send({ email });

  const verifyCode = (email, code) => request(app)
    .post('/api/v1/auth/verify-password-reset')
    .send({ email, code });

  const resetPassword = (token, password) => request(app)
    .post('/api/v1/auth/reset-password')
    .send({ token, newPassword: password });

  test.each([ROLES.SUPER_ADMIN, ROLES.WHOLESALER, ROLES.RETAILER])(
    'allows %s users to reset their password through email OTP',
    async (role) => {
      const user = await createUser(role);
      const requested = await requestCode(user.email);

      expect(requested.status).toBe(200);
      expect(requested.body.data.message).toMatch(/If an account exists/);
      expect(requested.body).not.toHaveProperty('code');
      expect(JSON.stringify(requested.body)).not.toContain(sentCodes.get(user.email));
      expect(sentCodes.get(user.email)).toMatch(/^\d{6}$/);

      const stored = await User.findById(user._id)
        .select('+passwordResetOtpHash +passwordResetOtpExpiresAt');
      expect(stored.passwordResetOtpHash).not.toBe(sentCodes.get(user.email));
      expect(stored.passwordResetOtpExpiresAt.getTime()).toBeGreaterThan(Date.now());
      expect(stored.passwordResetOtpExpiresAt.getTime()).toBeLessThanOrEqual(Date.now() + 5 * 60 * 1000);

      const verified = await verifyCode(user.email, sentCodes.get(user.email));
      expect(verified.status).toBe(200);
      expect(verified.body.data.resetToken).toBeDefined();
      expect(verified.body.data.resetToken).not.toBe(sentCodes.get(user.email));

      const reset = await resetPassword(verified.body.data.resetToken, newPassword);
      expect(reset.status).toBe(200);

      const oldPasswordLogin = await request(app).post('/api/v1/auth/login').send({
        email: user.email,
        password: originalPassword,
        role,
      });
      expect(oldPasswordLogin.status).toBe(401);

      const newPasswordLogin = await request(app).post('/api/v1/auth/login').send({
        email: user.email,
        password: newPassword,
        role,
      });
      expect(newPasswordLogin.status).toBe(200);

      const reusedToken = await resetPassword(verified.body.data.resetToken, 'AnotherPassword123');
      expect(reusedToken.status).toBe(400);
    },
  );

  test('does not reveal registered emails and enforces resend cooldown', async () => {
    const user = await createUser(ROLES.RETAILER);
    const registered = await requestCode(user.email);
    const unknown = await requestCode('unknown-password-reset@example.test');

    expect(registered.status).toBe(200);
    expect(unknown.status).toBe(200);
    expect(unknown.body.message).toBe(registered.body.message);
    expect(unknown.body.data).toEqual(registered.body.data);

    const tooSoon = await requestCode(user.email);
    expect(tooSoon.status).toBe(200);
    expect(EmailService.sendPasswordResetCode).toHaveBeenCalledTimes(1);
  });

  test('expires codes and invalidates after five incorrect attempts', async () => {
    const expiredUser = await createUser(ROLES.RETAILER);
    await requestCode(expiredUser.email);
    await User.updateOne(
      { _id: expiredUser._id },
      { $set: { passwordResetOtpExpiresAt: new Date(Date.now() - 1) } },
    );
    const expired = await verifyCode(expiredUser.email, sentCodes.get(expiredUser.email));
    expect(expired.status).toBe(400);
    expect(expired.body.code).toBe('PASSWORD_RESET_CODE_INVALID');

    const limitedUser = await createUser(ROLES.WHOLESALER, 2);
    await requestCode(limitedUser.email);
    const sentCode = sentCodes.get(limitedUser.email);
    const incorrectCode = String((Number(sentCode) + 1) % 1_000_000).padStart(6, '0');
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const incorrect = await verifyCode(limitedUser.email, incorrectCode);
      expect(incorrect.status).toBe(400);
      expect(incorrect.body.code).toBe('PASSWORD_RESET_CODE_INVALID');
    }

    const savedUser = await User.findById(limitedUser._id)
      .select('+passwordResetOtpHash +passwordResetOtpAttempts');
    expect(savedUser.passwordResetOtpHash).toBe('');
    expect(savedUser.passwordResetOtpAttempts).toBe(5);
  });
});
