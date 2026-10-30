jest.mock('nodemailer', () => ({
  createTransport: jest.fn(),
}));

const nodemailer = require('nodemailer');
const env = require('../src/config/env');
const logger = require('../src/config/logger');
const EmailService = require('../src/services/email.service');

describe('Password reset email delivery', () => {
  const original = {};
  let sendMail;

  beforeEach(() => {
    ['SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE', 'SMTP_USER', 'SMTP_APP_PASSWORD', 'EMAIL_FROM'].forEach((key) => {
      original[key] = env[key];
    });
    env.SMTP_HOST = 'smtp.gmail.com';
    env.SMTP_PORT = 465;
    env.SMTP_SECURE = true;
    env.SMTP_USER = 'verified@example.test';
    env.SMTP_APP_PASSWORD = 'test-app-password';
    env.EMAIL_FROM = '';
    sendMail = jest.fn().mockResolvedValue({ messageId: 'message-id' });
    nodemailer.createTransport.mockReturnValue({ sendMail });
  });

  afterEach(() => {
    Object.assign(env, original);
    jest.clearAllMocks();
  });

  test('sends a five-minute password reset code through Gmail SMTP without logging secrets', async () => {
    const info = jest.spyOn(logger, 'info');
    await EmailService.sendPasswordResetCode('person@example.test', '037194');

    expect(nodemailer.createTransport).toHaveBeenCalledWith({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user: 'verified@example.test', pass: 'test-app-password' },
    });
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({
      from: 'verified@example.test',
      to: 'person@example.test',
      text: expect.stringContaining('expires in 5 minutes'),
      html: expect.stringContaining('037194'),
    }));
    expect(JSON.stringify(info.mock.calls)).not.toContain('037194');
    expect(JSON.stringify(info.mock.calls)).not.toContain('test-app-password');
  });

  test('reports SMTP delivery errors without exposing OTP or app password', async () => {
    const errorLog = jest.spyOn(logger, 'error');
    sendMail.mockRejectedValue(new Error('SMTP connection failed'));

    await expect(EmailService.sendPasswordResetCode('person@example.test', '428301'))
      .rejects.toMatchObject({ code: 'EMAIL_DELIVERY_FAILED' });
    expect(JSON.stringify(errorLog.mock.calls)).not.toContain('428301');
    expect(JSON.stringify(errorLog.mock.calls)).not.toContain('test-app-password');
  });
});
