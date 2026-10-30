const env = require('../config/env');
const logger = require('../config/logger');
const { AppError } = require('../utils/errors');
const nodemailer = require('nodemailer');

const BREVO_EMAIL_URL = 'https://api.brevo.com/v3/smtp/email';

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

async function sendVerificationCode(to, code) {
  if (!env.EMAIL_PROVIDER_API_KEY && env.NODE_ENV === 'development') {
    console.info(`[Email OTP development fallback] ${to}: ${code} (valid for 10 minutes)`);
    return;
  }

  if (!env.EMAIL_PROVIDER_API_KEY) {
    logger.error('Email service is not configured: set EMAIL_PROVIDER_API_KEY, EMAIL_FROM, and EMAIL_FROM_NAME.');
    throw new AppError('Email service is not configured', 503, 'EMAIL_SERVICE_NOT_CONFIGURED');
  }
  try {
    env.assertEmailConfigured();
  } catch (error) {
    logger.error(error.message);
    throw new AppError('Email service is not configured', 503, 'EMAIL_SERVICE_NOT_CONFIGURED');
  }

  const escapedCode = escapeHtml(code);
  const textContent = `Your verification code is ${code}. It is valid for 10 minutes. If you did not request this, ignore this email.`;
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>TradeFlow Verification Code</title>
    </head>
    <body style="margin:0;padding:32px 16px;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a">
      <div style="max-width:480px;margin:0 auto;background-color:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;box-shadow:0 4px 6px -1px rgba(15,23,42,0.06)">
        <div style="background-color:#0f172a;padding:24px;text-align:center">
          <div style="font-size:20px;font-weight:800;letter-spacing:1px;color:#ffffff">TRADEFLOW</div>
          <div style="font-size:11px;font-weight:700;letter-spacing:1.5px;color:#10b981;margin-top:4px">TWO-FACTOR AUTHENTICATION</div>
        </div>
        <div style="padding:32px 28px;text-align:center">
          <h2 style="margin:0 0 12px;font-size:18px;font-weight:700;color:#0f172a">Verification Code</h2>
          <p style="margin:0 0 20px;font-size:14px;color:#64748b;line-height:1.5">
            Your verification code is:
          </p>
          <div style="background-color:#ecfdf5;border:2px dashed #10b981;border-radius:12px;padding:16px;margin:0 auto 24px;display:inline-block">
            <span style="font-family:'Courier New',Courier,monospace;font-size:32px;font-weight:800;letter-spacing:8px;color:#0f172a">${escapedCode}</span>
          </div>
          <p style="margin:0 0 12px;font-size:13px;font-weight:600;color:#334155">
            Your verification code is ${escapedCode}. It is valid for 10 minutes. If you did not request this, ignore this email.
          </p>
        </div>
        <div style="background-color:#f8fafc;padding:16px;border-top:1px solid #e2e8f0;text-align:center">
          <span style="font-size:11px;color:#94a3b8">&copy; TradeFlow &middot; Automated security message</span>
        </div>
      </div>
    </body>
    </html>`;

  let response;
  try {
    response = await fetch(BREVO_EMAIL_URL, {
      method: 'POST',
      headers: {
        'api-key': env.EMAIL_PROVIDER_API_KEY,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        sender: { name: env.EMAIL_FROM_NAME, email: env.EMAIL_FROM },
        to: [{ email: to }],
        subject: 'Your verification code',
        textContent,
        htmlContent,
      }),
    });
  } catch (error) {
    logger.error('Brevo email request failed before receiving a response.', { message: error.message });
    throw new AppError('Could not send the verification email', 502, 'EMAIL_DELIVERY_FAILED');
  }

  logger.info('Brevo email provider response status', { status: response.status });

  if (!response.ok) {
    logger.error('Brevo email provider returned an unsuccessful response.', { status: response.status });
    throw new AppError('Could not send the verification email', 502, 'EMAIL_DELIVERY_FAILED');
  }
}

async function sendPasswordResetCode(to, code) {
  try {
    env.assertSmtpConfigured();
  } catch (error) {
    logger.error('Password reset email is not configured.', { message: error.message });
    throw new AppError('Password reset email is not configured', 503, 'EMAIL_SERVICE_NOT_CONFIGURED');
  }

  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_APP_PASSWORD,
    },
  });

  try {
    await transporter.sendMail({
      from: env.EMAIL_FROM || env.SMTP_USER,
      to,
      subject: 'Your Vyapar Dwar password reset code',
      text: `Your password reset code is ${code}. It expires in 5 minutes. If you did not request this, ignore this email.`,
      html: `<p>Your password reset code is <strong>${escapeHtml(code)}</strong>.</p><p>It expires in 5 minutes. If you did not request this, ignore this email.</p>`,
    });
    logger.info('Password reset email sent.');
  } catch (error) {
    logger.error('Password reset email delivery failed.', { message: error.message });
    throw new AppError('Could not send the password reset email', 502, 'EMAIL_DELIVERY_FAILED');
  }
}

module.exports = {
  sendVerificationCode,
  sendOtpEmail: sendVerificationCode,
  sendPasswordResetCode,
};
