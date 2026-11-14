const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const env = require('../../config/env');
const logger = require('../../config/logger');
const {
  Order,
  Payment,
  User,
  Notification,
  KycApplication,
  WholesalerProfile,
  WholesalerRetailerRelationship,
} = require('../../models');
const AuditService = require('../../services/audit.service');
const {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} = require('../../utils/errors');

const QR_DIRECTORY = path.join(env.UPLOAD_PATH, 'payment-qr');
const REPORT_DIRECTORY = path.join(env.UPLOAD_PATH, 'payment-reports');
const UPI_ID_PATTERN = /^[a-zA-Z0-9._-]{2,128}@[a-zA-Z][a-zA-Z0-9.-]{1,63}$/;
const BANK_DETAIL_FIELDS = ['accountHolderName', 'bankName', 'accountNumber', 'ifscCode', 'branch'];
const ACCOUNT_HOLDER_PATTERN = /^[\p{L}][\p{L}\s.'-]{1,99}$/u;
const BANK_NAME_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N}\s&.'()-]{1,99}$/u;
const ACCOUNT_NUMBER_PATTERN = /^\d{9,18}$/;
const IFSC_PATTERN = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const BRANCH_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N}\s&.'()-]{1,99}$/u;
const ADDITIONAL_PAYMENT_METHODS = ['NET_BANKING', 'CASH_DEPOSIT', 'CHEQUE'];
const PAYMENT_OTP_LIMIT_RUPEES = 10000;
const PAYMENT_OTP_TTL_MS = 5 * 60 * 1000;
const PAYMENT_OTP_RESEND_MS = 60 * 1000;
const PAYMENT_OTP_MAX_ATTEMPTS = 5;
const FILE_SIGNATURES = {
  'image/jpeg': (buffer) => buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff,
  'image/png': (buffer) => buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  'image/webp': (buffer) => buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP',
  'application/pdf': (buffer) => buffer.length >= 5 && buffer.toString('ascii', 0, 5) === '%PDF-',
};

function ensureDirectories() {
  fs.mkdirSync(QR_DIRECTORY, { recursive: true });
  fs.mkdirSync(REPORT_DIRECTORY, { recursive: true });
}

function fileMimeType(file) {
  const detectedType = Object.entries(FILE_SIGNATURES).find(([, check]) => check(file.buffer))?.[0];
  if (!detectedType || detectedType !== file.mimetype) {
    throw new BadRequestError('The uploaded image content does not match an allowed image type.', 'INVALID_PAYMENT_IMAGE');
  }
  return detectedType;
}

function getEnabledPaymentMethods(settings = {}, bankDetailsVerified = false) {
  const methods = new Set(
    bankDetailsVerified && Array.isArray(settings.additionalPaymentMethods)
      ? settings.additionalPaymentMethods
      : []
  );
  if (
    settings.qrPaymentsEnabled ||
    (settings.upiIdPaymentsEnabled && UPI_ID_PATTERN.test(String(settings.upiId || '')))
  ) methods.add('UPI');
  return ['UPI', ...ADDITIONAL_PAYMENT_METHODS].filter((method) => methods.has(method));
}

function hasAnyBankDetails(details = {}) {
  return BANK_DETAIL_FIELDS.some((field) => String(details[field] || '').trim());
}

function hasValidBankDetails(details = {}) {
  return ACCOUNT_HOLDER_PATTERN.test(String(details.accountHolderName || '').trim()) &&
    BANK_NAME_PATTERN.test(String(details.bankName || '').trim()) &&
    ACCOUNT_NUMBER_PATTERN.test(String(details.accountNumber || '').trim()) &&
    IFSC_PATTERN.test(String(details.ifscCode || '').trim().toUpperCase()) &&
    BRANCH_PATTERN.test(String(details.branch || '').trim());
}

function getBankDetailsStatus(details, verified) {
  if (!hasAnyBankDetails(details)) return 'NOT_ADDED';
  if (!hasValidBankDetails(details)) return 'INCOMPLETE';
  return verified ? 'VERIFIED' : 'UNVERIFIED';
}

function parseAdditionalPaymentMethods(value, fallback = []) {
  if (value === undefined) return fallback;
  let methods = value;
  if (typeof methods === 'string') {
    try {
      methods = JSON.parse(methods);
    } catch {
      throw new BadRequestError('Payment methods must be a valid list.', 'INVALID_PAYMENT_METHODS');
    }
  }
  if (!Array.isArray(methods) || methods.some((method) => !ADDITIONAL_PAYMENT_METHODS.includes(method))) {
    throw new BadRequestError('Choose valid additional payment methods.', 'INVALID_PAYMENT_METHODS');
  }
  return [...new Set(methods)];
}

function normalizeOwnerMobile(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (/^\d{10}$/.test(digits)) return `91${digits}`;
  if (/^91\d{10}$/.test(digits)) return digits;
  throw new BadRequestError('The owner account must have a valid 10-digit Indian mobile number for payment OTPs.', 'OWNER_MOBILE_INVALID');
}

function paymentOtpHash(reportId, otp) {
  return crypto.createHmac('sha256', env.JWT_ACCESS_SECRET)
    .update(`${reportId}:${otp}`)
    .digest('hex');
}

async function sendPaymentApprovalOtp(phone, otp) {
  const missing = ['MSG91_AUTH_KEY', 'MSG91_TEMPLATE_ID'].filter((key) => !env[key]);
  if (missing.length) {
    throw new BadRequestError(`Payment OTP delivery is not configured. Set ${missing.join(' and ')} on the backend.`, 'PAYMENT_OTP_NOT_CONFIGURED');
  }
  if (typeof fetch !== 'function') {
    throw new Error('The configured Node.js runtime does not provide fetch for MSG91 requests.');
  }
  const response = await fetch('https://control.msg91.com/api/v5/flow/', {
    method: 'POST',
    headers: {
      authkey: env.MSG91_AUTH_KEY,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      template_id: env.MSG91_TEMPLATE_ID,
      recipients: [{ mobiles: phone, VAR1: otp }],
    }),
  });
  const result = await response.json();
  if (!response.ok || String(result?.type || '').toLowerCase() === 'error') {
    logger.error('MSG91 payment approval OTP request failed', { status: response.status, providerMessage: result?.message });
    throw new BadRequestError('MSG91 could not deliver the payment approval code. Try again later.', 'PAYMENT_OTP_DELIVERY_FAILED');
  }
}

function parseAmountPaise(value) {
  const amount = String(value ?? '').trim();
  if (!/^(?:0|[1-9]\d{0,8})(?:\.\d{1,2})?$/.test(amount)) {
    throw new BadRequestError('Enter a valid payment amount with up to two decimal places.', 'INVALID_PAYMENT_AMOUNT');
  }
  const amountPaise = Math.round(Number(amount) * 100);
  if (!Number.isSafeInteger(amountPaise) || amountPaise < 1) {
    throw new BadRequestError('Payment amount must be greater than zero.', 'INVALID_PAYMENT_AMOUNT');
  }
  return amountPaise;
}

function amountInRupees(amountPaise) {
  return amountPaise / 100;
}

function makeReferenceKey(wholesalerId, reference) {
  return crypto.createHash('sha256').update(`${wholesalerId}:${reference.trim().toUpperCase()}`).digest('hex');
}

function validateObjectId(value, label) {
  if (!/^[0-9a-fA-F]{24}$/.test(String(value || ''))) {
    throw new BadRequestError(`A valid ${label} is required.`, 'INVALID_ID');
  }
}

async function getProfile(wholesalerId) {
  const profile = await WholesalerProfile.findOne({ userId: wholesalerId });
  if (!profile) throw new NotFoundError('Wholesaler profile not found.');
  return profile;
}

async function getBankDetails(profile) {
  const profileDetails = profile.bankDetails || {};
  const needsKycFallback = BANK_DETAIL_FIELDS.some((field) => !String(profileDetails[field] || '').trim());
  const kycApplication = needsKycFallback
    ? await KycApplication.findOne({ wholesalerId: profile.userId }).select('bankDetails').lean()
    : null;
  const kycDetails = kycApplication?.bankDetails || {};
  return Object.fromEntries(BANK_DETAIL_FIELDS.map((field) => [
    field,
    String(profileDetails[field] || kycDetails[field] || ''),
  ]));
}

function getQrDataUrl(profile) {
  const settings = profile?.paymentSettings || {};
  if (!settings.qrImagePath) return '';
  ensureDirectories();
  const filename = path.basename(settings.qrImagePath);
  const candidates = [
    path.join(QR_DIRECTORY, filename),
    path.join(env.UPLOAD_PATH, settings.qrImagePath),
    path.join(env.UPLOAD_PATH, 'payment-qr', filename),
    path.resolve(settings.qrImagePath),
  ];
  let imagePath = '';
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      imagePath = candidate;
      break;
    }
  }
  if (!imagePath) {
    logger.warn('Payment QR image file not found on disk', {
      wholesalerId: profile.userId,
      qrImagePath: settings.qrImagePath,
      candidates,
    });
    return '';
  }
  const image = fs.readFileSync(imagePath);
  let mimeType = settings.qrImageMimeType;
  if (!mimeType) {
    const ext = path.extname(imagePath).toLowerCase();
    if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg';
    else if (ext === '.png') mimeType = 'image/png';
    else if (ext === '.webp') mimeType = 'image/webp';
    else mimeType = 'image/png';
  }
  return `data:${mimeType};base64,${image.toString('base64')}`;
}

class PaymentsService {
  static async hasVerifiedBankDetails(profile) {
    const bankDetails = await getBankDetails(profile);
    return profile.bankDetails?.isVerified === true && hasValidBankDetails(bankDetails);
  }

  static async getSettings(wholesalerId) {
    const profile = await getProfile(wholesalerId);
    const bankDetails = await getBankDetails(profile);
    const bankDetailsVerified = profile.bankDetails?.isVerified === true && hasValidBankDetails(bankDetails);
    const settings = profile.paymentSettings?.toObject?.() || profile.paymentSettings || {};
    const qrDataUrl = getQrDataUrl(profile);
    const qrImageUrl = settings.qrImagePath ? `/uploads/payment-qr/${path.basename(settings.qrImagePath)}` : '';
    return {
      upiId: settings.upiId || '',
      accountName: settings.accountName || '',
      bankDetails: { ...bankDetails, isVerified: bankDetailsVerified },
      additionalPaymentMethods: settings.additionalPaymentMethods || [],
      paymentOtpLimit: Number(settings.paymentOtpLimit ?? PAYMENT_OTP_LIMIT_RUPEES),
      hasQrImage: Boolean(qrDataUrl),
      qrPaymentsEnabled: Boolean(settings.qrPaymentsEnabled && qrDataUrl),
      upiIdPaymentsEnabled: Boolean(settings.upiIdPaymentsEnabled),
      qrSessionMinutes: Number(settings.qrSessionMinutes || 10),
      qrDataUrl,
      qrImageUrl,
    };
  }

  static async updateSettings(wholesalerId, payload, file, actor, req) {
    const profile = await getProfile(wholesalerId);
    const originalBankDetails = await getBankDetails(profile);
    const current = profile.paymentSettings?.toObject?.() || profile.paymentSettings || {};
    const upiId = payload.upiId === undefined ? current.upiId || '' : String(payload.upiId).trim();
    const accountName = payload.accountName === undefined ? current.accountName || '' : String(payload.accountName).trim();
    const qrPaymentsEnabled = payload.qrPaymentsEnabled === undefined ? Boolean(current.qrPaymentsEnabled) : payload.qrPaymentsEnabled === true || payload.qrPaymentsEnabled === 'true';
    const upiIdPaymentsEnabled = payload.upiIdPaymentsEnabled === undefined ? Boolean(current.upiIdPaymentsEnabled) : payload.upiIdPaymentsEnabled === true || payload.upiIdPaymentsEnabled === 'true';
    const qrSessionMinutes = payload.qrSessionMinutes === undefined ? Number(current.qrSessionMinutes || 10) : Number(payload.qrSessionMinutes);
    const additionalPaymentMethods = parseAdditionalPaymentMethods(payload.additionalPaymentMethods, current.additionalPaymentMethods || []);
    const paymentOtpLimit = payload.paymentOtpLimit === undefined
      ? Number(current.paymentOtpLimit ?? PAYMENT_OTP_LIMIT_RUPEES)
      : Number(payload.paymentOtpLimit);
    const bankDetails = {
      accountHolderName: String(payload.accountHolderName || originalBankDetails.accountHolderName).trim(),
      bankName: String(payload.bankName || originalBankDetails.bankName).trim(),
      accountNumber: String(payload.accountNumber || originalBankDetails.accountNumber).trim(),
      ifscCode: String(payload.ifscCode || originalBankDetails.ifscCode).trim().toUpperCase(),
      branch: String(payload.branch || originalBankDetails.branch).trim(),
    };
    const bankDetailsChanged = BANK_DETAIL_FIELDS.some((field) => bankDetails[field] !== originalBankDetails[field]);
    bankDetails.isVerified = !bankDetailsChanged && profile.bankDetails?.isVerified === true;

    if (upiId && !UPI_ID_PATTERN.test(upiId)) {
      throw new BadRequestError('Enter a valid UPI ID.', 'INVALID_UPI_ID');
    }
    if (!Number.isInteger(qrSessionMinutes) || qrSessionMinutes < 1 || qrSessionMinutes > 60) {
      throw new BadRequestError('QR display duration must be between 1 and 60 minutes.', 'INVALID_QR_SESSION_DURATION');
    }
    if (!Number.isFinite(paymentOtpLimit) || paymentOtpLimit < 0 || paymentOtpLimit > 100000000) {
      throw new BadRequestError('Payment OTP limit must be between ₹0 and ₹100,000,000.', 'INVALID_PAYMENT_OTP_LIMIT');
    }
    if (upiIdPaymentsEnabled && !upiId) {
      throw new BadRequestError('Enter a UPI ID before enabling UPI ID payments.', 'UPI_ID_REQUIRED');
    }
    if (hasAnyBankDetails(bankDetails) && !hasValidBankDetails(bankDetails)) {
      throw new BadRequestError(
        'Enter a valid account holder name, bank name, 9–18 digit account number, IFSC code, and branch name.',
        'INVALID_BANK_DETAILS'
      );
    }
    if (additionalPaymentMethods.length && (!hasValidBankDetails(bankDetails) || !bankDetails.isVerified)) {
      throw new BadRequestError(
        'Complete and verify bank details before enabling Net Banking, Cash Deposit, or Cheque.',
        'BANK_DETAILS_VERIFICATION_REQUIRED'
      );
    }
    const existingQrPath = current.qrImagePath
      ? path.join(QR_DIRECTORY, path.basename(current.qrImagePath))
      : '';
    if (qrPaymentsEnabled && !file && (!existingQrPath || !fs.existsSync(existingQrPath))) {
      throw new BadRequestError('Upload a QR image before enabling QR payments.', 'QR_IMAGE_REQUIRED');
    }

    let uploadedPath = current.qrImagePath || '';
    let mimeType = current.qrImageMimeType || '';
    if (file) {
      mimeType = fileMimeType(file);
      ensureDirectories();
      uploadedPath = `${crypto.randomUUID()}.${mimeType === 'image/jpeg' ? 'jpg' : mimeType.split('/')[1]}`;
      await fs.promises.writeFile(path.join(QR_DIRECTORY, uploadedPath), file.buffer, { flag: 'wx' });
    }

    profile.paymentSettings = {
      upiId,
      accountName,
      qrImagePath: uploadedPath,
      qrImageMimeType: mimeType,
      qrPaymentsEnabled,
      upiIdPaymentsEnabled,
      qrSessionMinutes,
      additionalPaymentMethods,
      paymentOtpLimit,
    };
    profile.bankDetails = bankDetails;
    try {
      await profile.save();
    } catch (error) {
      if (file && uploadedPath) {
        await fs.promises.unlink(path.join(QR_DIRECTORY, uploadedPath)).catch((cleanupError) => {
          if (cleanupError.code !== 'ENOENT') logger.error('Failed to remove an uncommitted payment QR upload', { cleanupError });
        });
      }
      throw error;
    }
    if (file && current.qrImagePath && current.qrImagePath !== uploadedPath) {
      await fs.promises.unlink(path.join(QR_DIRECTORY, path.basename(current.qrImagePath))).catch((error) => {
        if (error.code !== 'ENOENT') logger.error('Failed to remove a replaced payment QR image', { error });
      });
    }
    await AuditService.log({
      actorId: actor._id,
      actorRole: actor.role,
      action: 'UPDATE',
      entityType: 'WholesalerPaymentSettings',
      entityId: profile._id,
      after: {
        upiId,
        accountName,
        qrPaymentsEnabled,
        upiIdPaymentsEnabled,
        qrSessionMinutes,
        additionalPaymentMethods,
        paymentOtpLimit,
        bankDetailsUpdated: Boolean(bankDetails.accountNumber),
        qrImageUploaded: Boolean(uploadedPath),
      },
      req,
    });
    return this.getSettings(wholesalerId);
  }

  static async resolveWholesalerProfile(retailerId, requestedWholesalerId = null) {
    let wholesalerUserId = null;
    if (requestedWholesalerId) {
      const isOid = mongoose.isValidObjectId(requestedWholesalerId);
      if (isOid) {
        const byProfile = await WholesalerProfile.findOne({
          $or: [{ userId: requestedWholesalerId }, { _id: requestedWholesalerId }],
        });
        if (byProfile) {
          wholesalerUserId = byProfile.userId;
        } else {
          wholesalerUserId = requestedWholesalerId;
        }
      }
    }

    let relationship = null;
    if (wholesalerUserId) {
      relationship = await WholesalerRetailerRelationship.findOne({
        retailerId,
        wholesalerId: wholesalerUserId,
        status: 'ACTIVE',
      });
    }

    if (!relationship) {
      relationship = await WholesalerRetailerRelationship.findOne({ retailerId, status: 'ACTIVE' });
    }

    if (!relationship) {
      throw new ForbiddenError('Connect to a wholesaler before viewing payment options.', 'NO_ACTIVE_WHOLESALER');
    }

    const profile = await getProfile(relationship.wholesalerId);
    return { relationship, profile };
  }

  static async getRetailerPaymentOptions(retailerId, requestedWholesalerId = null) {
    const { relationship, profile } = await this.resolveWholesalerProfile(retailerId, requestedWholesalerId);
    const bankDetails = await getBankDetails(profile);
    const bankDetailsVerified = profile.bankDetails?.isVerified === true && hasValidBankDetails(bankDetails);
    const settings = profile.paymentSettings?.toObject?.() || profile.paymentSettings || {};
    const upiIdIsValid = UPI_ID_PATTERN.test(String(settings.upiId || ''));
    const qrDataUrl = settings.qrPaymentsEnabled ? getQrDataUrl(profile) : '';
    const qrImageUrl = settings.qrImagePath ? `/uploads/payment-qr/${path.basename(settings.qrImagePath)}` : '';
    return {
      wholesalerId: String(relationship.wholesalerId),
      businessName: profile.businessName,
      accountName: settings.accountName || profile.businessName,
      qrPaymentsEnabled: Boolean(settings.qrPaymentsEnabled && qrDataUrl),
      hasQrImage: Boolean(qrDataUrl),
      qrDataUrl,
      qrImageUrl,
      upiIdPaymentsEnabled: Boolean(settings.upiIdPaymentsEnabled && upiIdIsValid),
      upiId: upiIdIsValid ? settings.upiId : '',
      qrSessionMinutes: Number(settings.qrSessionMinutes || 10),
      paymentMethods: getEnabledPaymentMethods(settings, bankDetailsVerified),
      bankDetailsStatus: getBankDetailsStatus(bankDetails, bankDetailsVerified),
      bankDetails: bankDetailsVerified ? bankDetails : null,
    };
  }

  static async createRetailerQrSession(retailerId, requestedWholesalerId = null) {
    const { relationship, profile } = await this.resolveWholesalerProfile(retailerId, requestedWholesalerId);
    const settings = profile.paymentSettings?.toObject?.() || profile.paymentSettings || {};
    if (!settings.qrPaymentsEnabled) {
      throw new BadRequestError('This wholesaler has not enabled QR payments.', 'QR_PAYMENTS_DISABLED');
    }

    const qrDataUrl = getQrDataUrl(profile);
    if (!qrDataUrl) {
      throw new NotFoundError('The wholesaler QR image is unavailable. Ask them to upload it again.', 'QR_IMAGE_UNAVAILABLE');
    }

    const qrSessionMinutes = Number(settings.qrSessionMinutes || 10);
    const qrImageUrl = settings.qrImagePath ? `/uploads/payment-qr/${path.basename(settings.qrImagePath)}` : '';
    return {
      wholesalerId: String(relationship.wholesalerId),
      qrDataUrl,
      qrImageUrl,
      qrSessionMinutes,
      expiresAt: new Date(Date.now() + qrSessionMinutes * 60_000).toISOString(),
    };
  }

  static async saveScreenshot(file) {
    if (!file) return '';
    const mimeType = fileMimeType(file);
    ensureDirectories();
    const filename = `${crypto.randomUUID()}.${mimeType === 'image/jpeg' ? 'jpg' : mimeType.split('/')[1]}`;
    await fs.promises.writeFile(path.join(REPORT_DIRECTORY, filename), file.buffer, { flag: 'wx' });
    return filename;
  }

  static async createPaymentReport(retailerId, payload, file, req) {
    const amountPaise = parseAmountPaise(payload.amount);
    const transactionReference = String(payload.transactionReference || '').trim();
    if (transactionReference.length < 4 || transactionReference.length > 100) {
      throw new BadRequestError('Enter a valid payment transaction/reference ID.', 'INVALID_TRANSACTION_REFERENCE');
    }
    const paymentDetails = String(payload.paymentDetails || '').trim();
    const creditRepayment = payload.type === 'CREDIT_REPAYMENT';
    const paymentMethod = String(payload.paymentMethod || 'UPI').toUpperCase();
    if (!['UPI', ...ADDITIONAL_PAYMENT_METHODS].includes(paymentMethod)) {
      throw new BadRequestError('Choose a supported direct payment method.', 'UNSUPPORTED_PAYMENT_METHOD');
    }
    if (['CASH_DEPOSIT', 'CHEQUE'].includes(paymentMethod) && (paymentDetails.length < 3 || paymentDetails.length > 500)) {
      throw new BadRequestError('Add the deposit or cheque details (up to 500 characters).', 'PAYMENT_DETAILS_REQUIRED');
    }

    let order;
    let relatedOrderIds = [];
    let wholesalerId;

    if (creditRepayment) {
      const relationship = await WholesalerRetailerRelationship.findOne({
        retailerId,
        ...(payload.wholesalerId ? { wholesalerId: payload.wholesalerId } : {}),
        status: 'ACTIVE',
      });
      if (!relationship) throw new ForbiddenError('No active wholesaler is connected to this retailer.', 'NO_ACTIVE_WHOLESALER');
      wholesalerId = relationship.wholesalerId;
    } else {
      const orderId = String(payload.orderId || '');
      if (!/^[0-9a-fA-F]{24}$/.test(orderId)) throw new BadRequestError('A valid order ID is required.', 'INVALID_ORDER_ID');
      order = await Order.findOne({ _id: orderId, retailerId });
      if (!order) throw new NotFoundError('Order not found or does not belong to this retailer.');
      wholesalerId = order.wholesalerId;
      const relationship = await WholesalerRetailerRelationship.findOne({ retailerId, wholesalerId, status: 'ACTIVE' });
      if (!relationship) throw new ForbiddenError('No active wholesaler connection for this order.', 'NO_ACTIVE_WHOLESALER');
    }

    const profile = await getProfile(wholesalerId);
    const settings = profile.paymentSettings || {};
    const bankDetails = await getBankDetails(profile);
    const bankDetailsVerified = profile.bankDetails?.isVerified === true && hasValidBankDetails(bankDetails);
    if (!getEnabledPaymentMethods(settings, bankDetailsVerified).includes(paymentMethod)) {
      throw new BadRequestError('This wholesaler has not enabled the selected payment method.', 'PAYMENT_METHOD_DISABLED');
    }

    if (creditRepayment) {
      const relForOutstanding = await WholesalerRetailerRelationship.findOne({ retailerId, wholesalerId, status: 'ACTIVE' });
      const currentOutstandingPaise = Number.isSafeInteger(relForOutstanding?.currentOutstandingPaise)
        ? relForOutstanding.currentOutstandingPaise
        : Math.round(Number(relForOutstanding?.currentOutstandingAmount || 0) * 100);
      if (amountPaise > currentOutstandingPaise) {
        throw new BadRequestError('Repayment amount cannot exceed the current outstanding balance.', 'REPAYMENT_EXCEEDS_OUTSTANDING');
      }
      const openOrders = await Order.find({
        retailerId,
        wholesalerId,
        isCreditOrder: true,
        creditPaymentStatus: { $in: ['PENDING', 'OVERDUE'] },
      }).sort({ creditDueDate: 1, createdAt: 1 }).select('_id grandTotal creditPaidAmount');
      relatedOrderIds = openOrders
        .filter((item) => Math.round(Number(item.grandTotal || 0) * 100) > Math.round(Number(item.creditPaidAmount || 0) * 100))
        .map((item) => item._id);
      if (!relatedOrderIds.length) throw new BadRequestError('No outstanding credit orders were found.', 'NO_OUTSTANDING_CREDIT');
      order = openOrders.find((item) => String(item._id) === String(relatedOrderIds[0]));
    } else {
      if (order.isCreditOrder) throw new BadRequestError('Use the credit repayment option for credit orders.', 'CREDIT_REPAYMENT_REQUIRED');
      if (order.paymentStatus === 'PAID') throw new BadRequestError('This order is already paid.', 'ORDER_ALREADY_PAID');
      if (order.paymentMethod !== paymentMethod) {
        throw new BadRequestError('The reported payment method must match the order payment method.', 'ORDER_PAYMENT_METHOD_MISMATCH');
      }
      const verifiedReports = await Payment.find({ orderId: order._id, isReport: true, status: 'PAID' }).select('amountPaise amount');
      const paidPaise = verifiedReports.reduce((sum, payment) => sum + (payment.amountPaise || Math.round(Number(payment.amount || 0) * 100)), 0);
      const remainingPaise = Math.max(0, Math.round(Number(order.grandTotal) * 100) - paidPaise);
      if (amountPaise > remainingPaise) {
        throw new BadRequestError('Reported amount cannot exceed the remaining order balance.', 'PAYMENT_EXCEEDS_ORDER_BALANCE');
      }
    }

    const referenceKey = makeReferenceKey(wholesalerId, transactionReference);
    const screenshotPath = await this.saveScreenshot(file);
    let report;
    try {
      report = await Payment.create({
        orderId: order._id,
        retailerId,
        wholesalerId,
        amount: amountInRupees(amountPaise),
        amountPaise,
        currency: 'INR',
        status: 'PENDING',
        paymentMethod,
        transactionReference,
        paymentDetails,
        transactionReferenceKey: referenceKey,
        isReport: true,
        isCreditRepayment: creditRepayment,
        relatedOrderIds,
        screenshotPath,
        evidenceMimeType: file ? fileMimeType(file) : '',
      });
      await Notification.create({
        recipientId: wholesalerId,
        title: 'Retailer payment submitted',
        message: `${amountInRupees(amountPaise).toFixed(2)} payment submitted for owner verification.`,
        type: 'PAYMENT_UPDATE',
        channel: 'IN_APP',
        data: {
          paymentReportId: String(report._id),
          orderId: String(order._id),
          paymentMethod,
          isCreditRepayment: creditRepayment,
        },
      });
      await AuditService.log({
        actorId: retailerId,
        actorRole: 'RETAILER',
        action: 'CREATE',
        entityType: 'PaymentReport',
        entityId: report._id,
        after: { amountPaise, status: 'PENDING', isCreditRepayment: creditRepayment, orderId: order._id, paymentMethod },
        req,
      });
      return this.serializeReport(report);
    } catch (error) {
      if (report?._id) await Payment.deleteOne({ _id: report._id });
      if (report?._id) {
        await Notification.deleteMany({ 'data.paymentReportId': String(report._id) }).catch((cleanupError) => {
          logger.error('Failed to remove a notification for an uncommitted payment report', { cleanupError });
        });
      }
      if (screenshotPath) {
        await fs.promises.unlink(path.join(REPORT_DIRECTORY, screenshotPath)).catch((cleanupError) => {
          if (cleanupError.code !== 'ENOENT') logger.error('Failed to remove an uncommitted payment screenshot', { cleanupError });
        });
      }
      if (error.code === 11000) throw new ConflictError('This UPI transaction/reference ID has already been reported.', 'DUPLICATE_TRANSACTION_REFERENCE');
      throw error;
    }
  }

  static serializeReport(report) {
    const item = report.toObject ? report.toObject() : report;
    delete item.screenshotPath;
    return {
      ...item,
      screenshotAvailable: Boolean(report.screenshotPath || item.screenshotPath),
    };
  }

  static async listRetailerReports(retailerId) {
    const items = await Payment.find({ retailerId, isReport: true }).sort({ createdAt: -1 }).limit(100).lean();
    const reversedIds = await Payment.distinct('reversesPaymentId', {
      isReversal: true,
      reversesPaymentId: { $in: items.map((item) => item._id) },
    });
    const reversedSet = new Set(reversedIds.map(String));
    return items.map((item) => {
      const screenshotAvailable = Boolean(item.screenshotPath);
      delete item.screenshotPath;
      return { ...item, screenshotAvailable, wasReversed: reversedSet.has(String(item._id)) };
    });
  }

  static async listWholesalerReports(wholesalerId) {
    const items = await Payment.find({ wholesalerId, isReport: true })
      .populate('retailerId', 'name email phone')
      .populate('orderId', 'orderNumber grandTotal')
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();
    const reversedIds = await Payment.distinct('reversesPaymentId', {
      isReversal: true,
      reversesPaymentId: { $in: items.map((item) => item._id) },
    });
    const reversedSet = new Set(reversedIds.map(String));
    return items.map((item) => {
      const screenshotAvailable = Boolean(item.screenshotPath);
      delete item.screenshotPath;
      return { ...item, screenshotAvailable, wasReversed: reversedSet.has(String(item._id)) };
    });
  }

  static async listAdminReports() {
    const items = await Payment.find({ isReport: true })
      .populate('retailerId', 'name email phone')
      .populate('wholesalerId', 'name email phone businessName')
      .populate('orderId', 'orderNumber grandTotal')
      .sort({ createdAt: -1 })
      .limit(500)
      .lean();
    return items.map((item) => {
      const screenshotAvailable = Boolean(item.screenshotPath);
      delete item.screenshotPath;
      return { ...item, screenshotAvailable };
    });
  }

  static async requestApprovalOtp(wholesalerId, reportId, actor, req) {
    validateObjectId(reportId, 'payment report ID');
    const report = await Payment.findOne({ _id: reportId, wholesalerId, isReport: true, status: 'PENDING' });
    if (!report) throw new NotFoundError('Pending payment report not found for this wholesaler.');

    const profile = await getProfile(wholesalerId);
    const otpLimit = Number(profile.paymentSettings?.paymentOtpLimit ?? PAYMENT_OTP_LIMIT_RUPEES);
    const amountPaise = report.amountPaise || Math.round(Number(report.amount || 0) * 100);
    if (amountPaise <= Math.round(otpLimit * 100)) {
      return { otpRequired: false };
    }

    if (report.approvalOtpSentAt && Date.now() - report.approvalOtpSentAt.getTime() < PAYMENT_OTP_RESEND_MS) {
      throw new ConflictError('Wait 60 seconds before requesting another payment approval code.', 'PAYMENT_OTP_RESEND_TOO_SOON');
    }
    const owner = await User.findById(wholesalerId).select('phone');
    const phone = normalizeOwnerMobile(owner?.phone);
    const otp = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
    const otpHash = paymentOtpHash(report._id, otp);
    const now = new Date();
    const claimed = await Payment.findOneAndUpdate(
      { _id: report._id, wholesalerId, status: 'PENDING' },
      {
        $set: {
          approvalOtpHash: otpHash,
          approvalOtpExpiresAt: new Date(now.getTime() + PAYMENT_OTP_TTL_MS),
          approvalOtpAttempts: 0,
          approvalOtpSentAt: now,
          approvalOtpVerifiedAt: null,
        },
      },
      { new: true }
    );
    if (!claimed) throw new ConflictError('This payment report is currently being reviewed.', 'PAYMENT_REPORT_PROCESSING');

    try {
      await sendPaymentApprovalOtp(phone, otp);
    } catch (error) {
      await Payment.updateOne(
        { _id: report._id, approvalOtpHash: otpHash },
        { $set: { approvalOtpHash: '', approvalOtpExpiresAt: null, approvalOtpSentAt: null } }
      );
      throw error;
    }

    await AuditService.log({
      actorId: actor._id,
      actorRole: actor.role,
      action: 'UPDATE',
      entityType: 'PaymentApprovalOtp',
      entityId: report._id,
      after: { requested: true, amountPaise },
      req,
    });
    return {
      otpRequired: true,
      expiresAt: claimed.approvalOtpExpiresAt,
      sentTo: `******${phone.slice(-4)}`,
    };
  }

  static async verifyReport(wholesalerId, reportId, action, note, otp, actor, req) {
    validateObjectId(reportId, 'payment report ID');
    if (!['VERIFY', 'REJECT'].includes(action)) {
      throw new BadRequestError('Choose VERIFY or REJECT for a payment report.', 'INVALID_PAYMENT_REVIEW_ACTION');
    }
    if (String(note || '').length > 500) {
      throw new BadRequestError('Review notes must not exceed 500 characters.', 'PAYMENT_REVIEW_NOTE_TOO_LONG');
    }
    if (action === 'REJECT' && !String(note || '').trim()) {
      throw new BadRequestError('Add a reason when rejecting a payment report.', 'PAYMENT_REJECTION_NOTE_REQUIRED');
    }
    const report = await Payment.findOne({ _id: reportId, wholesalerId, isReport: true });
    if (!report) throw new NotFoundError('Payment report not found for this wholesaler.');
    if (report.status === 'PAID' && action === 'VERIFY') return this.serializeReport(report);
    if (report.status !== 'PENDING') throw new ConflictError('This payment report has already been reviewed.', 'PAYMENT_REPORT_ALREADY_REVIEWED');

    if (action === 'VERIFY') {
      const profile = await getProfile(wholesalerId);
      const otpLimit = Number(profile.paymentSettings?.paymentOtpLimit ?? PAYMENT_OTP_LIMIT_RUPEES);
      const amountPaise = report.amountPaise || Math.round(Number(report.amount || 0) * 100);
      if (amountPaise > Math.round(otpLimit * 100)) {
        if (!/^\d{6}$/.test(String(otp || ''))) {
          throw new BadRequestError('A valid 6-digit owner approval code is required for this payment.', 'PAYMENT_OTP_REQUIRED');
        }
        if (!report.approvalOtpHash || !report.approvalOtpExpiresAt || report.approvalOtpExpiresAt <= new Date()) {
          throw new BadRequestError('The payment approval code is missing or expired. Request a new code.', 'PAYMENT_OTP_EXPIRED');
        }
        if (report.approvalOtpAttempts >= PAYMENT_OTP_MAX_ATTEMPTS) {
          throw new ForbiddenError('Too many incorrect payment approval codes. Request a new code later.', 'PAYMENT_OTP_ATTEMPTS_EXCEEDED');
        }
        const expectedHash = paymentOtpHash(report._id, String(otp));
        const hashesMatch = crypto.timingSafeEqual(Buffer.from(expectedHash, 'hex'), Buffer.from(report.approvalOtpHash, 'hex'));
        if (!hashesMatch) {
          const attempts = await Payment.findOneAndUpdate(
            { _id: report._id, wholesalerId, status: 'PENDING', approvalOtpAttempts: { $lt: PAYMENT_OTP_MAX_ATTEMPTS } },
            { $inc: { approvalOtpAttempts: 1 } },
            { new: true }
          );
          if (!attempts || attempts.approvalOtpAttempts >= PAYMENT_OTP_MAX_ATTEMPTS) {
            throw new ForbiddenError('Too many incorrect payment approval codes. Request a new code later.', 'PAYMENT_OTP_ATTEMPTS_EXCEEDED');
          }
          throw new ForbiddenError('The payment approval code is incorrect.', 'PAYMENT_OTP_INVALID');
        }
        const verifiedOtp = await Payment.findOneAndUpdate(
          {
            _id: report._id,
            wholesalerId,
            status: 'PENDING',
            approvalOtpHash: expectedHash,
            approvalOtpExpiresAt: { $gt: new Date() },
            approvalOtpAttempts: { $lt: PAYMENT_OTP_MAX_ATTEMPTS },
            approvalOtpVerifiedAt: null,
          },
          { $set: { approvalOtpVerifiedAt: new Date() } },
          { new: true }
        );
        if (!verifiedOtp) {
          throw new ConflictError('The payment approval code has expired or was already used. Request a new code.', 'PAYMENT_OTP_ALREADY_USED');
        }
      }
    }

    const claimed = await Payment.findOneAndUpdate(
      { _id: report._id, wholesalerId, status: 'PENDING' },
      { $set: { status: 'PROCESSING' } },
      { new: true }
    );
    if (!claimed) throw new ConflictError('This payment report is currently being reviewed.', 'PAYMENT_REPORT_PROCESSING');

    let orderPaymentAllocation = null;
    const orderAllocations = [];
    if (action === 'VERIFY' && !report.isCreditRepayment) {
      const order = await Order.findOne({ _id: report.orderId, wholesalerId, retailerId: report.retailerId });
      if (!order || order.isCreditOrder) {
        await Payment.updateOne({ _id: report._id, status: 'PROCESSING' }, { $set: { status: 'PENDING' } });
        throw new NotFoundError('Order not found or is not eligible for a direct payment report.');
      }
      const orderTotalPaise = Math.round(Number(order.grandTotal || 0) * 100);
      let paidPaise = order.directPaidPaise;
      if (!Number.isSafeInteger(paidPaise)) {
        const verifiedReports = await Payment.find({
          orderId: order._id,
          isReport: true,
          status: 'PAID',
          _id: { $ne: report._id },
        }).select('amountPaise amount');
        paidPaise = verifiedReports.reduce((sum, payment) => sum + (payment.amountPaise || Math.round(Number(payment.amount || 0) * 100)), 0);
        await Order.updateOne(
          { _id: order._id, directPaidPaise: null },
          { $set: { directPaidPaise: paidPaise } }
        );
      }
      const amountPaise = report.amountPaise || Math.round(Number(report.amount || 0) * 100);
      const allocatedOrder = await Order.findOneAndUpdate(
        {
          _id: order._id,
          wholesalerId,
          retailerId: report.retailerId,
          directPaidPaise: { $lte: orderTotalPaise - amountPaise },
        },
        { $inc: { directPaidPaise: amountPaise } },
        { new: true }
      );
      if (!allocatedOrder) {
        await Payment.updateOne({ _id: report._id, status: 'PROCESSING' }, { $set: { status: 'PENDING' } });
        throw new ConflictError('Reported payments exceed the remaining order balance.', 'PAYMENT_EXCEEDS_ORDER_BALANCE');
      }
      orderPaymentAllocation = { order: allocatedOrder, orderTotalPaise };
    }

    if (action === 'REJECT') {
      const rejected = await Payment.findOneAndUpdate(
        { _id: report._id, wholesalerId, status: 'PROCESSING' },
        { $set: { status: 'REJECTED', reviewNote: String(note || '').trim(), reviewedBy: actor._id, reviewedAt: new Date() } },
        { new: true }
      );
      await AuditService.log({
        actorId: actor._id,
        actorRole: actor.role,
        action: 'UPDATE',
        entityType: 'PaymentReport',
        entityId: report._id,
        before: { status: 'PENDING' },
        after: { status: 'REJECTED', note: rejected.reviewNote },
        req,
      });
      return this.serializeReport(rejected);
    }

    if (report.isCreditRepayment) {
      const amountPaise = report.amountPaise || Math.round(Number(report.amount) * 100);
      const currentRelationship = await WholesalerRetailerRelationship.findOne({
        wholesalerId,
        retailerId: report.retailerId,
        status: 'ACTIVE',
      });
      if (currentRelationship && !Number.isSafeInteger(currentRelationship.currentOutstandingPaise)) {
        await WholesalerRetailerRelationship.updateOne(
          { _id: currentRelationship._id, currentOutstandingPaise: null },
          { $set: { currentOutstandingPaise: Math.round(Number(currentRelationship.currentOutstandingAmount || 0) * 100) } }
        );
      }
      const relationship = await WholesalerRetailerRelationship.findOneAndUpdate(
        {
          wholesalerId,
          retailerId: report.retailerId,
          status: 'ACTIVE',
          currentOutstandingPaise: { $gte: amountPaise },
        },
        { $inc: { currentOutstandingPaise: -amountPaise, currentOutstandingAmount: -amountInRupees(amountPaise) } },
        { new: true }
      );
      if (!relationship) {
        await Payment.updateOne({ _id: report._id, status: 'PROCESSING' }, { $set: { status: 'PENDING' } });
        throw new ConflictError('The outstanding balance changed. Refresh and review the report again.', 'CREDIT_BALANCE_CHANGED');
      }

      let remainingPaise = amountPaise;
      for (const orderId of report.relatedOrderIds) {
        if (remainingPaise <= 0) break;
        for (let attempt = 0; attempt < 3 && remainingPaise > 0; attempt += 1) {
          const creditOrder = await Order.findOne({
            _id: orderId,
            retailerId: report.retailerId,
            wholesalerId,
            isCreditOrder: true,
            creditPaymentStatus: { $in: ['PENDING', 'OVERDUE'] },
          });
          if (!creditOrder) break;
          const previouslyPaidPaise = Math.round(Number(creditOrder.creditPaidAmount || 0) * 100);
          const orderTotalPaise = Math.round(Number(creditOrder.grandTotal || 0) * 100);
          const duePaise = Math.max(0, orderTotalPaise - previouslyPaidPaise);
          if (!duePaise) break;
          const appliedPaise = Math.min(remainingPaise, duePaise);
          const newPaidPaise = previouslyPaidPaise + appliedPaise;
          const fullyPaid = newPaidPaise >= orderTotalPaise;
          const updatedOrder = await Order.findOneAndUpdate(
            {
              _id: creditOrder._id,
              retailerId: report.retailerId,
              wholesalerId,
              creditPaymentStatus: { $in: ['PENDING', 'OVERDUE'] },
              creditPaidAmount: creditOrder.creditPaidAmount,
            },
            {
              $inc: { creditPaidAmount: amountInRupees(appliedPaise) },
              $set: {
                creditPaymentStatus: fullyPaid ? 'PAID' : 'PENDING',
                paymentStatus: fullyPaid ? 'PAID' : 'PARTIAL',
                ...(fullyPaid ? { creditSettledAt: new Date() } : {}),
              },
            },
            { new: true }
          );
          if (!updatedOrder) continue;
          orderAllocations.push({ orderId: creditOrder._id, amountPaise: appliedPaise });
          remainingPaise -= appliedPaise;
          if (fullyPaid) {
            await Payment.updateMany(
              { orderId: creditOrder._id, isReport: { $ne: true }, status: 'PENDING' },
              { $set: { status: 'PAID', paidAt: new Date() } }
            );
          }
          break;
        }
      }
      if (remainingPaise > 0) {
        await WholesalerRetailerRelationship.updateOne(
          { _id: relationship._id },
          { $inc: { currentOutstandingPaise: amountPaise, currentOutstandingAmount: amountInRupees(amountPaise) } }
        );
        await Payment.updateOne({ _id: report._id, status: 'PROCESSING' }, { $set: { status: 'PENDING' } });
        throw new ConflictError('The linked credit orders no longer match the outstanding balance.', 'CREDIT_ORDERS_CHANGED');
      }
    }

    const verified = await Payment.findOneAndUpdate(
      { _id: report._id, wholesalerId, status: 'PROCESSING' },
      {
        $set: {
          status: 'PAID',
          orderAllocations,
          reviewNote: String(note || '').trim(),
          reviewedBy: actor._id,
          reviewedAt: new Date(),
          paidAt: new Date(),
        },
      },
      { new: true }
    );

    if (orderPaymentAllocation) {
      const fullyPaid = orderPaymentAllocation.order.directPaidPaise >= orderPaymentAllocation.orderTotalPaise;
      await Order.updateOne(
        { _id: orderPaymentAllocation.order._id, wholesalerId, retailerId: report.retailerId },
        { $set: { paymentStatus: fullyPaid ? 'PAID' : 'PARTIAL' } }
      );
      if (fullyPaid) {
        await Payment.updateMany(
          { orderId: orderPaymentAllocation.order._id, isReport: { $ne: true }, status: 'PENDING' },
          { $set: { status: 'PAID', paidAt: new Date() } }
        );
      }
    }

    await AuditService.log({
      actorId: actor._id,
      actorRole: actor.role,
      action: 'UPDATE',
      entityType: 'PaymentReport',
      entityId: report._id,
      before: { status: 'PENDING' },
      after: { status: 'PAID', amountPaise: report.amountPaise, isCreditRepayment: report.isCreditRepayment },
      req,
    });
    return this.serializeReport(verified);
  }

  static async reverseReport(wholesalerId, reportId, reason, actor, req) {
    validateObjectId(reportId, 'payment report ID');
    const reversalReason = String(reason || '').trim();
    if (reversalReason.length < 3 || reversalReason.length > 500) {
      throw new BadRequestError('Enter a reversal reason between 3 and 500 characters.', 'PAYMENT_REVERSAL_REASON_REQUIRED');
    }

    const original = await Payment.findOne({
      _id: reportId,
      wholesalerId,
      isReport: true,
      isReversal: { $ne: true },
      status: 'PAID',
    });
    if (!original) throw new NotFoundError('Approved payment report not found for this wholesaler.');
    if (await Payment.exists({ reversesPaymentId: original._id })) {
      throw new ConflictError('This approved payment already has a reversal entry.', 'PAYMENT_ALREADY_REVERSED');
    }

    const amountPaise = original.amountPaise || Math.round(Number(original.amount || 0) * 100);
    let reversal;
    try {
      reversal = await Payment.create({
        orderId: original.orderId,
        retailerId: original.retailerId,
        wholesalerId,
        amount: amountInRupees(amountPaise),
        amountPaise,
        currency: original.currency || 'INR',
        status: 'PROCESSING',
        paymentMethod: original.paymentMethod,
        transactionReference: `REVERSAL-${String(original._id)}`,
        isReport: true,
        isCreditRepayment: original.isCreditRepayment,
        relatedOrderIds: original.relatedOrderIds,
        orderAllocations: original.orderAllocations,
        isReversal: true,
        reversesPaymentId: original._id,
        reversalReason,
        reversedBy: actor._id,
        reversedAt: new Date(),
      });
    } catch (error) {
      if (error.code === 11000) {
        throw new ConflictError('This approved payment already has a reversal entry.', 'PAYMENT_ALREADY_REVERSED');
      }
      throw error;
    }

    const changedCreditOrders = [];
    let updatedRelationship = null;
    let changedDirectOrder = null;
    try {
      if (original.isCreditRepayment) {
        let relationship = await WholesalerRetailerRelationship.findOne({
          wholesalerId,
          retailerId: original.retailerId,
          status: 'ACTIVE',
        });
        if (!relationship) {
          throw new ConflictError('The retailer credit balance could not be found for reversal.', 'PAYMENT_REVERSAL_BALANCE_MISSING');
        }
        let outstandingPaise = Number.isSafeInteger(relationship.currentOutstandingPaise)
          ? relationship.currentOutstandingPaise
          : Math.round(Number(relationship.currentOutstandingAmount || 0) * 100);
        if (!Number.isSafeInteger(relationship.currentOutstandingPaise)) {
          const initialized = await WholesalerRetailerRelationship.updateOne(
            { _id: relationship._id, currentOutstandingPaise: null },
            { $set: { currentOutstandingPaise: outstandingPaise } }
          );
          if (!initialized.matchedCount) {
            throw new ConflictError('The retailer credit balance changed. Refresh and retry the reversal.', 'PAYMENT_REVERSAL_BALANCE_CHANGED');
          }
          relationship = await WholesalerRetailerRelationship.findById(relationship._id);
          outstandingPaise = relationship.currentOutstandingPaise;
        }

        const allocations = original.orderAllocations || [];
        if (!allocations.length || allocations.reduce((sum, allocation) => sum + allocation.amountPaise, 0) !== amountPaise) {
          throw new ConflictError('The original credit payment allocations are incomplete.', 'PAYMENT_REVERSAL_ALLOCATIONS_INVALID');
        }
        const creditOrders = [];
        for (const allocation of original.orderAllocations || []) {
          const order = await Order.findOne({
            _id: allocation.orderId,
            wholesalerId,
            retailerId: original.retailerId,
            isCreditOrder: true,
          });
          if (!order) throw new ConflictError('A linked credit order could not be found for reversal.', 'PAYMENT_REVERSAL_ORDER_MISSING');
          const paidPaise = Math.round(Number(order.creditPaidAmount || 0) * 100);
          if (paidPaise < allocation.amountPaise) {
            throw new ConflictError('A linked credit balance changed; the reversal was not fully applied.', 'PAYMENT_REVERSAL_BALANCE_CHANGED');
          }
          const remainingPaise = paidPaise - allocation.amountPaise;
          creditOrders.push({ order, allocation, remainingPaise });
        }

        updatedRelationship = await WholesalerRetailerRelationship.findOneAndUpdate(
          {
            _id: relationship._id,
            currentOutstandingPaise: outstandingPaise,
          },
          { $inc: { currentOutstandingPaise: amountPaise, currentOutstandingAmount: amountInRupees(amountPaise) } },
          { new: true }
        );
        if (!updatedRelationship) {
          throw new ConflictError('The retailer credit balance changed. Refresh and retry the reversal.', 'PAYMENT_REVERSAL_BALANCE_CHANGED');
        }

        for (const { order, allocation, remainingPaise } of creditOrders) {
          const orderTotalPaise = Math.round(Number(order.grandTotal || 0) * 100);
          const updatedOrder = await Order.findOneAndUpdate(
            {
              _id: order._id,
              wholesalerId,
              retailerId: original.retailerId,
              creditPaidAmount: order.creditPaidAmount,
            },
            {
              $set: {
                creditPaidAmount: amountInRupees(remainingPaise),
                creditPaymentStatus: remainingPaise >= orderTotalPaise ? 'PAID' : 'PENDING',
                paymentStatus: remainingPaise > 0 ? 'PARTIAL' : 'PENDING',
                creditSettledAt: null,
              },
            },
            { new: true }
          );
          if (!updatedOrder) {
            throw new ConflictError('A linked credit balance changed during reversal.', 'PAYMENT_REVERSAL_BALANCE_CHANGED');
          }
          changedCreditOrders.push({ order, allocation, updatedOrder });
        }
      } else {
        const order = await Order.findOne({
          _id: original.orderId,
          wholesalerId,
          retailerId: original.retailerId,
        });
        if (!order) throw new ConflictError('The linked order could not be found for reversal.', 'PAYMENT_REVERSAL_ORDER_MISSING');
        let directPaidPaise = order.directPaidPaise;
        if (!Number.isSafeInteger(directPaidPaise)) {
          const verifiedReports = await Payment.find({
            orderId: order._id,
            isReport: true,
            status: 'PAID',
            isReversal: { $ne: true },
          }).select('amountPaise amount');
          directPaidPaise = verifiedReports.reduce((sum, payment) => sum + (payment.amountPaise || Math.round(Number(payment.amount || 0) * 100)), 0);
        }
        if (directPaidPaise < amountPaise) {
          throw new ConflictError('The order payment balance changed; the reversal was not applied.', 'PAYMENT_REVERSAL_BALANCE_CHANGED');
        }
        const remainingPaise = directPaidPaise - amountPaise;
        const updatedOrder = await Order.findOneAndUpdate(
          {
            _id: order._id,
            wholesalerId,
            retailerId: original.retailerId,
            directPaidPaise: order.directPaidPaise,
          },
          {
            $set: {
              directPaidPaise: remainingPaise,
              paymentStatus: remainingPaise >= Math.round(Number(order.grandTotal || 0) * 100) ? 'PAID' : remainingPaise > 0 ? 'PARTIAL' : 'PENDING',
            },
          },
          { new: true }
        );
        if (!updatedOrder) {
          throw new ConflictError('The order payment balance changed during reversal.', 'PAYMENT_REVERSAL_BALANCE_CHANGED');
        }
        changedDirectOrder = { order, updatedOrder };
      }

      reversal.status = 'REFUNDED';
      await reversal.save();
    } catch (error) {
      const rollbackErrors = [];
      const rollback = async (operation) => {
        try {
          const result = await operation();
          if (result && result.matchedCount === 0) {
            throw new Error('The previous payment state changed before rollback could be applied.');
          }
        } catch (rollbackError) {
          rollbackErrors.push(rollbackError);
        }
      };
      if (changedDirectOrder) {
        await rollback(() => Order.updateOne(
          { _id: changedDirectOrder.order._id, directPaidPaise: changedDirectOrder.updatedOrder.directPaidPaise },
          {
            $set: {
              directPaidPaise: changedDirectOrder.order.directPaidPaise,
              paymentStatus: changedDirectOrder.order.paymentStatus,
            },
          }
        ));
      }
      for (const { order, updatedOrder } of changedCreditOrders.reverse()) {
        await rollback(() => Order.updateOne(
          { _id: order._id, creditPaidAmount: updatedOrder.creditPaidAmount },
          {
            $set: {
              creditPaidAmount: order.creditPaidAmount,
              creditPaymentStatus: order.creditPaymentStatus,
              paymentStatus: order.paymentStatus,
              creditSettledAt: order.creditSettledAt,
            },
          }
        ));
      }
      if (updatedRelationship) {
        await rollback(() => WholesalerRetailerRelationship.updateOne(
          {
            _id: updatedRelationship._id,
            currentOutstandingPaise: updatedRelationship.currentOutstandingPaise,
          },
          { $inc: { currentOutstandingPaise: -amountPaise, currentOutstandingAmount: -amountInRupees(amountPaise) } }
        ));
      }
      if (rollbackErrors.length) {
        logger.error('Payment reversal rollback failed; manual reconciliation is required', {
          reversalId: reversal._id,
          rollbackErrors,
        });
      } else {
        await Payment.deleteOne({ _id: reversal._id, status: 'PROCESSING' });
      }
      logger.error('Payment reversal was not applied', { reversalId: reversal._id, error });
      throw error;
    }

    await AuditService.log({
      actorId: actor._id,
      actorRole: actor.role,
      action: 'UPDATE',
      entityType: 'PaymentReportReversal',
      entityId: reversal._id,
      before: { originalPaymentId: original._id },
      after: { amountPaise, reason: reversalReason, status: 'REFUNDED' },
      req,
    });
    return this.serializeReport(reversal);
  }

  static async getScreenshotPath(reportId, user, req) {
    validateObjectId(reportId, 'payment report ID');
    const filter = { _id: reportId, isReport: true };
    if (user.role === 'RETAILER') filter.retailerId = user._id;
    else if (user.role === 'WHOLESALER') filter.wholesalerId = user._id;
    else if (user.role !== 'SUPER_ADMIN') throw new ForbiddenError('You are not allowed to view payment evidence.');
    const report = await Payment.findOne(filter).select('screenshotPath retailerId wholesalerId');
    if (!report || !report.screenshotPath) throw new NotFoundError('Payment screenshot not found.');
    const filePath = path.resolve(REPORT_DIRECTORY, path.basename(report.screenshotPath));
    if (!fs.existsSync(filePath)) throw new NotFoundError('Payment screenshot not found.');
    await AuditService.log({
      actorId: user._id,
      actorRole: user.role,
      action: 'VIEW_DOCUMENT',
      entityType: 'PaymentReportScreenshot',
      entityId: report._id,
      req,
    });
    return filePath;
  }
}

module.exports = PaymentsService;
