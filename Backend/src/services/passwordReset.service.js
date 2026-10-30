const crypto = require('crypto');
const env = require('../config/env');
const logger = require('../config/logger');
const { User, RefreshToken } = require('../models');
const { BadRequestError } = require('../utils/errors');
const EmailService = require('./email.service');

const OTP_TTL_MS = 5 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const SEND_WINDOW_MS = 60 * 60 * 1000;
const MAX_SENDS_PER_WINDOW = 5;
const MAX_VERIFY_ATTEMPTS = 5;
const GENERIC_REQUEST_MESSAGE = 'If an account exists for this email, a password reset code will be sent.';

function digest(value) {
  return crypto.createHmac('sha256', env.JWT_REFRESH_SECRET).update(value).digest('hex');
}

function createOtp() {
  return crypto.randomInt(100000, 1000000).toString();
}

function invalidCode() {
  throw new BadRequestError('Invalid or expired code. Request a new code.', 'PASSWORD_RESET_CODE_INVALID');
}

class PasswordResetService {
  static async requestCode(email) {
    const user = await User.findOne({
      email: String(email).trim().toLowerCase(),
      isDeleted: false,
    }).select('+passwordResetOtpHash +passwordResetOtpExpiresAt +passwordResetOtpAttempts +passwordResetOtpSentAt +passwordResetOtpSendHistory');

    if (!user) return { message: GENERIC_REQUEST_MESSAGE, resendAfterSeconds: 60 };

    const now = new Date();
    const sendHistory = (user.passwordResetOtpSendHistory || [])
      .filter((sentAt) => now - sentAt < SEND_WINDOW_MS);
    if (
      user.passwordResetOtpSentAt &&
      now - user.passwordResetOtpSentAt < RESEND_COOLDOWN_MS
    ) {
      return { message: GENERIC_REQUEST_MESSAGE, resendAfterSeconds: 60 };
    }
    if (sendHistory.length >= MAX_SENDS_PER_WINDOW) {
      return { message: GENERIC_REQUEST_MESSAGE, resendAfterSeconds: 60 };
    }

    const code = createOtp();
    const codeHash = digest(`${user._id}:RESET_PASSWORD:${code}`);
    const updated = await User.findOneAndUpdate(
      {
        _id: user._id,
        __v: user.__v,
        passwordResetOtpSentAt: user.passwordResetOtpSentAt || null,
      },
      {
        $set: {
          passwordResetOtpHash: codeHash,
          passwordResetOtpExpiresAt: new Date(now.getTime() + OTP_TTL_MS),
          passwordResetOtpAttempts: 0,
          passwordResetOtpSentAt: now,
          passwordResetOtpSendHistory: [...sendHistory, now],
        },
        $unset: {
          resetPasswordTokenHash: 1,
          resetPasswordExpires: 1,
        },
        $inc: { __v: 1 },
      },
      { new: true },
    );

    if (!updated) return { message: GENERIC_REQUEST_MESSAGE, resendAfterSeconds: 60 };

    try {
      await EmailService.sendPasswordResetCode(user.email, code);
    } catch (error) {
      if (!['EMAIL_SERVICE_NOT_CONFIGURED', 'EMAIL_DELIVERY_FAILED'].includes(error.code)) {
        throw error;
      }
      logger.error('Password reset request could not deliver email.');
    }

    return { message: GENERIC_REQUEST_MESSAGE, resendAfterSeconds: 60 };
  }

  static async verifyCode(email, code) {
    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail, isDeleted: false })
      .select('+passwordResetOtpHash +passwordResetOtpExpiresAt +passwordResetOtpAttempts');
    const now = new Date();
    if (
      !user ||
      !user.passwordResetOtpHash ||
      !user.passwordResetOtpExpiresAt ||
      user.passwordResetOtpExpiresAt <= now
    ) {
      if (user?.passwordResetOtpHash && user.passwordResetOtpExpiresAt <= now) {
        await User.updateOne(
          { _id: user._id, passwordResetOtpHash: user.passwordResetOtpHash },
          { $set: { passwordResetOtpHash: '', passwordResetOtpAttempts: 0 } },
        );
      }
      invalidCode();
    }

    const providedHash = digest(`${user._id}:RESET_PASSWORD:${code}`);
    const expected = Buffer.from(user.passwordResetOtpHash, 'hex');
    const actual = Buffer.from(providedHash, 'hex');
    const matches = expected.length === actual.length && crypto.timingSafeEqual(expected, actual);

    if (!matches) {
      const attempts = user.passwordResetOtpAttempts + 1;
      const update = await User.updateOne(
        {
          _id: user._id,
          passwordResetOtpHash: user.passwordResetOtpHash,
          passwordResetOtpExpiresAt: { $gt: now },
          passwordResetOtpAttempts: { $lt: MAX_VERIFY_ATTEMPTS },
        },
        attempts >= MAX_VERIFY_ATTEMPTS
          ? { $set: { passwordResetOtpHash: '', passwordResetOtpAttempts: attempts } }
          : { $inc: { passwordResetOtpAttempts: 1 } },
      );
      if (update.modifiedCount !== 1) invalidCode();
      throw new BadRequestError(
        'Invalid or expired code. Request a new code.',
        'PASSWORD_RESET_CODE_INVALID',
      );
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const updated = await User.findOneAndUpdate(
      {
        _id: user._id,
        passwordResetOtpHash: user.passwordResetOtpHash,
        passwordResetOtpExpiresAt: { $gt: now },
        passwordResetOtpAttempts: { $lt: MAX_VERIFY_ATTEMPTS },
      },
      {
        $set: {
          passwordResetOtpHash: '',
          passwordResetOtpAttempts: 0,
          resetPasswordTokenHash: digest(resetToken),
          resetPasswordExpires: new Date(now.getTime() + OTP_TTL_MS),
        },
        $unset: {
          passwordResetOtpExpiresAt: 1,
        },
        $inc: { __v: 1 },
      },
      { new: true },
    );
    if (!updated) invalidCode();

    return {
      resetToken,
      expiresInSeconds: OTP_TTL_MS / 1000,
    };
  }

  static async resetPassword(token, newPassword) {
    const passwordHash = await User.hashPassword(newPassword);
    const user = await User.findOneAndUpdate(
      {
        resetPasswordTokenHash: digest(token),
        resetPasswordExpires: { $gt: new Date() },
        isDeleted: false,
      },
      {
        $set: {
          passwordHash,
          passwordResetOtpHash: '',
          passwordResetOtpAttempts: 0,
        },
        $unset: {
          resetPasswordTokenHash: 1,
          resetPasswordExpires: 1,
          passwordResetOtpExpiresAt: 1,
        },
      },
      { new: true },
    ).select('_id');

    if (!user) {
      throw new BadRequestError('Invalid or expired password reset session.', 'INVALID_RESET_TOKEN');
    }

    await RefreshToken.updateMany({ userId: user._id }, { isRevoked: true });
    return { message: 'Password updated successfully. Please log in with your new credentials.' };
  }
}

module.exports = PasswordResetService;
