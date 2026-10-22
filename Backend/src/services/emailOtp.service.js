const crypto = require('crypto');
const env = require('../config/env');
const { EmailOtp, User, WholesalerProfile } = require('../models');
const { ROLES, USER_STATUS } = require('../config/constants');
const { BadRequestError, ForbiddenError, UnauthorizedError } = require('../utils/errors');
const EmailService = require('./email.service');

const CODE_TTL_MS = 10 * 60 * 1000;
const SEND_COOLDOWN_MS = 60 * 1000;
const SEND_WINDOW_MS = 60 * 60 * 1000;
const MAX_SENDS_PER_WINDOW = 5;
const MAX_VERIFY_ATTEMPTS = 5;

function digest(value) {
  return crypto.createHmac('sha256', env.JWT_REFRESH_SECRET).update(value).digest('hex');
}

function makeCode() {
  return crypto.randomInt(100000, 1000000).toString();
}

function maskEmail(email) {
  const [localPart, domain] = email.split('@');
  return `${localPart.slice(0, 1)}***@${domain}`;
}

function serviceError(message, code) {
  throw new BadRequestError(message, code);
}

async function getOrCreateRecord(userId, purpose) {
  let record = await EmailOtp.findOne({ userId }).select('+codeHash +challengeHash');
  if (record) return record;

  try {
    return await EmailOtp.create({
      userId,
      purpose,
      codeHash: digest(`${userId}:${purpose}:${crypto.randomBytes(32).toString('hex')}`),
      expiresAt: new Date(0),
      attempts: 0,
      sentAt: [],
    });
  } catch (error) {
    if (error.code !== 11000) throw error;
    record = await EmailOtp.findOne({ userId }).select('+codeHash +challengeHash');
    if (!record) throw error;
    return record;
  }
}

async function saveNewCode(userId, purpose, challengeToken) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const record = await getOrCreateRecord(userId, purpose);
    const now = new Date();
    const recentSends = (record.sentAt || []).filter((timestamp) => now - timestamp < SEND_WINDOW_MS);

    if (record.lastSentAt && now - record.lastSentAt < SEND_COOLDOWN_MS) {
      serviceError('Please wait 60 seconds before requesting another code.', 'OTP_RESEND_TOO_SOON');
    }
    if (recentSends.length >= MAX_SENDS_PER_WINDOW) {
      serviceError('You have reached the code sending limit. Try again in an hour.', 'OTP_SEND_LIMIT_REACHED');
    }

    const code = makeCode();
    const update = await EmailOtp.updateOne(
      { _id: record._id, __v: record.__v },
      {
        $set: {
          purpose,
          codeHash: digest(`${userId}:${purpose}:${code}`),
          challengeHash: challengeToken ? digest(challengeToken) : '',
          expiresAt: new Date(now.getTime() + CODE_TTL_MS),
          attempts: 0,
          sentAt: [...recentSends, now],
          lastSentAt: now,
        },
        $inc: { __v: 1 },
      },
    );

    if (update.modifiedCount !== 1) continue;

    const user = await User.findById(userId).select('email status isDeleted');
    if (!user || user.isDeleted || user.status === USER_STATUS.BLOCKED || user.status === USER_STATUS.SUSPENDED) {
      await EmailOtp.deleteOne({ _id: record._id });
      throw new UnauthorizedError('User account not authorized', 'ACCOUNT_UNAUTHORIZED');
    }

    await EmailService.sendVerificationCode(user.email, code);
    return { maskedEmail: maskEmail(user.email) };
  }

  serviceError('Please wait 60 seconds before requesting another code.', 'OTP_RESEND_TOO_SOON');
}

async function consumeCode(record, code) {
  const now = new Date();
  if (record.expiresAt <= now) {
    await EmailOtp.deleteOne({ _id: record._id });
    serviceError('Code expired', 'OTP_EXPIRED');
  }

  const suppliedHash = digest(`${record.userId}:${record.purpose}:${code}`);
  const expected = Buffer.from(record.codeHash, 'hex');
  const actual = Buffer.from(suppliedHash, 'hex');
  const isMatch = expected.length === actual.length && crypto.timingSafeEqual(expected, actual);

  if (!isMatch) {
    const result = await EmailOtp.updateOne(
      { _id: record._id, __v: record.__v, attempts: { $lt: MAX_VERIFY_ATTEMPTS } },
      { $inc: { attempts: 1, __v: 1 } },
    );
    if (result.modifiedCount !== 1) serviceError('Code is invalid or expired. Request a new code.', 'OTP_INVALID');

    const attempts = record.attempts + 1;
    if (attempts >= MAX_VERIFY_ATTEMPTS) {
      await EmailOtp.deleteOne({ _id: record._id });
      serviceError('Too many incorrect attempts. Request a new code.', 'OTP_ATTEMPTS_EXCEEDED');
    }
    serviceError(`Incorrect code. ${MAX_VERIFY_ATTEMPTS - attempts} attempts left`, 'OTP_INCORRECT');
  }

  const deletion = await EmailOtp.deleteOne({
    _id: record._id,
    __v: record.__v,
    expiresAt: { $gt: now },
  });
  if (deletion.deletedCount !== 1) {
    serviceError('Code is invalid or expired. Request a new code.', 'OTP_INVALID');
  }

  return record.userId;
}

async function verifyForUser(userId, purpose, code) {
  const record = await EmailOtp.findOne({ userId, purpose }).select('+codeHash');
  if (!record) serviceError('Code is invalid or expired. Request a new code.', 'OTP_INVALID');
  return consumeCode(record, code);
}

class EmailOtpService {
  static async startEnable(userId) {
    const user = await User.findById(userId).select('email role isDeleted status');
    if (!user || user.role !== ROLES.WHOLESALER) {
      throw new ForbiddenError('Only wholesaler accounts can enable email OTP 2FA.', 'INVALID_2FA_ACCOUNT');
    }
    const result = await saveNewCode(user._id, 'ENABLE_2FA', null);
    return { ...result, resendAfterSeconds: 60 };
  }

  static async resendEnable(userId) {
    const record = await EmailOtp.findOne({ userId, purpose: 'ENABLE_2FA' });
    if (!record) serviceError('Request a verification code first.', 'OTP_NOT_REQUESTED');
    const result = await saveNewCode(userId, 'ENABLE_2FA', null);
    return { ...result, resendAfterSeconds: 60 };
  }

  static async verifyEnable(userId, code) {
    await verifyForUser(userId, 'ENABLE_2FA', code);
    const profile = await WholesalerProfile.findOneAndUpdate(
      { userId },
      { $set: { twoFactorEnabled: true } },
      { new: true },
    );
    if (!profile) throw new UnauthorizedError('Wholesaler profile was not found.', 'WHOLESALER_PROFILE_NOT_FOUND');
    return { twoFactorEnabled: true };
  }

  static async disable(userId) {
    const profile = await WholesalerProfile.findOneAndUpdate(
      { userId },
      { $set: { twoFactorEnabled: false } },
      { new: true },
    );
    if (!profile) throw new UnauthorizedError('Wholesaler profile was not found.', 'WHOLESALER_PROFILE_NOT_FOUND');
    await EmailOtp.deleteOne({ userId, purpose: 'ENABLE_2FA' });
    return { twoFactorEnabled: false };
  }

  static async startLogin(user) {
    const challengeToken = crypto.randomBytes(32).toString('hex');
    const result = await saveNewCode(user._id, 'LOGIN_2FA', challengeToken);
    return { requiresTwoFactor: true, challengeToken, ...result, resendAfterSeconds: 60 };
  }

  static async resendLogin(challengeToken) {
    const challengeHash = digest(challengeToken);
    const record = await EmailOtp.findOne({ purpose: 'LOGIN_2FA', challengeHash })
      .select('+challengeHash');
    if (!record) throw new UnauthorizedError('Login verification has expired. Please sign in again.', 'LOGIN_CHALLENGE_EXPIRED');
    const result = await saveNewCode(record.userId, 'LOGIN_2FA', challengeToken);
    return { ...result, resendAfterSeconds: 60 };
  }

  static async verifyLogin(challengeToken, code) {
    const challengeHash = digest(challengeToken);
    const record = await EmailOtp.findOne({ purpose: 'LOGIN_2FA', challengeHash }).select('+codeHash +challengeHash');
    if (!record) throw new UnauthorizedError('Login verification has expired. Please sign in again.', 'LOGIN_CHALLENGE_EXPIRED');
    await consumeCode(record, code);
    return User.findById(record.userId)
      .select('+passwordHash')
      .populate('wholesalerProfile')
      .populate('retailerProfile')
      .populate('adminProfile');
  }
}

module.exports = EmailOtpService;
