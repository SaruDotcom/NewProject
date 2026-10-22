const env = require('../src/config/env');
const logger = require('../src/config/logger');
const EmailService = require('../src/services/email.service');

describe('Brevo email service', () => {
  const original = {};

  beforeEach(() => {
    original.NODE_ENV = env.NODE_ENV;
    original.EMAIL_PROVIDER_API_KEY = env.EMAIL_PROVIDER_API_KEY;
    original.EMAIL_FROM = env.EMAIL_FROM;
    original.EMAIL_FROM_NAME = env.EMAIL_FROM_NAME;
    env.NODE_ENV = 'production';
    env.EMAIL_PROVIDER_API_KEY = 'test-api-key';
    env.EMAIL_FROM = 'verified@example.test';
    env.EMAIL_FROM_NAME = 'TradeFlow';
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 201 });
  });

  afterEach(() => {
    env.NODE_ENV = original.NODE_ENV;
    env.EMAIL_PROVIDER_API_KEY = original.EMAIL_PROVIDER_API_KEY;
    env.EMAIL_FROM = original.EMAIL_FROM;
    env.EMAIL_FROM_NAME = original.EMAIL_FROM_NAME;
    jest.restoreAllMocks();
  });

  test('sends styled transactional email through Brevo HTTPS API and logs only status', async () => {
    const log = jest.spyOn(logger, 'info');
    await EmailService.sendVerificationCode('person@example.test', '037194');

    expect(global.fetch).toHaveBeenCalledWith('https://api.brevo.com/v3/smtp/email', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ 'api-key': 'test-api-key' }),
    }));
    const requestBody = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(requestBody.to).toEqual([{ email: 'person@example.test' }]);
    expect(requestBody.sender).toEqual({ name: 'TradeFlow', email: 'verified@example.test' });
    expect(requestBody.textContent).toContain('Your verification code is 037194. It is valid for 10 minutes.');
    expect(requestBody.htmlContent).toContain('#0f172a');
    expect(log).toHaveBeenCalledWith('Brevo email provider response status', { status: 201 });
    expect(JSON.stringify(log.mock.calls)).not.toContain('037194');
  });

  test('logs provider failure status and never logs the code', async () => {
    const log = jest.spyOn(logger, 'error');
    global.fetch.mockResolvedValue({ ok: false, status: 429 });

    await expect(EmailService.sendVerificationCode('person@example.test', '123456'))
      .rejects.toThrow('Could not send the verification email');
    expect(log).toHaveBeenCalledWith('Brevo email provider returned an unsuccessful response.', { status: 429 });
    expect(JSON.stringify(log.mock.calls)).not.toContain('123456');
  });

  test('uses terminal-only local fallback and errors in production when unconfigured', async () => {
    const terminal = jest.spyOn(console, 'info').mockImplementation(() => {});
    env.NODE_ENV = 'development';
    env.EMAIL_PROVIDER_API_KEY = '';
    await EmailService.sendVerificationCode('person@example.test', '428301');
    expect(terminal).toHaveBeenCalledWith(expect.stringContaining('428301'));
    expect(global.fetch).not.toHaveBeenCalled();

    const log = jest.spyOn(logger, 'error');
    env.NODE_ENV = 'production';
    await expect(EmailService.sendVerificationCode('person@example.test', '428301'))
      .rejects.toThrow('Email service is not configured');
    expect(log).toHaveBeenCalled();
    expect(JSON.stringify(log.mock.calls)).not.toContain('428301');
  });

  test('rejects incomplete Brevo sender configuration', async () => {
    env.EMAIL_FROM = '';
    await expect(EmailService.sendVerificationCode('person@example.test', '428301'))
      .rejects.toThrow('Email service is not configured');
  });
});
