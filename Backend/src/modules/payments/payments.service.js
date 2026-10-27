const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const env = require('../../config/env');
const logger = require('../../config/logger');
const {
  Order,
  Payment,
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
const FILE_SIGNATURES = {
  'image/jpeg': (buffer) => buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff,
  'image/png': (buffer) => buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  'image/webp': (buffer) => buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP',
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

function getQrDataUrl(profile) {
  const settings = profile.paymentSettings || {};
  if (!settings.qrImagePath) return '';
  ensureDirectories();
  const imagePath = path.join(QR_DIRECTORY, path.basename(settings.qrImagePath));
  if (!fs.existsSync(imagePath)) return '';
  const image = fs.readFileSync(imagePath);
  return `data:${settings.qrImageMimeType};base64,${image.toString('base64')}`;
}

class PaymentsService {
  static async getSettings(wholesalerId) {
    const profile = await getProfile(wholesalerId);
    const settings = profile.paymentSettings?.toObject?.() || profile.paymentSettings || {};
    const qrDataUrl = getQrDataUrl(profile);
    return {
      upiId: settings.upiId || '',
      accountName: settings.accountName || '',
      hasQrImage: Boolean(qrDataUrl),
      qrPaymentsEnabled: Boolean(settings.qrPaymentsEnabled && qrDataUrl),
      upiIdPaymentsEnabled: Boolean(settings.upiIdPaymentsEnabled),
      qrSessionMinutes: Number(settings.qrSessionMinutes || 10),
      qrDataUrl,
    };
  }

  static async updateSettings(wholesalerId, payload, file, actor, req) {
    const profile = await getProfile(wholesalerId);
    const current = profile.paymentSettings?.toObject?.() || profile.paymentSettings || {};
    const upiId = payload.upiId === undefined ? current.upiId || '' : String(payload.upiId).trim();
    const accountName = payload.accountName === undefined ? current.accountName || '' : String(payload.accountName).trim();
    const qrPaymentsEnabled = payload.qrPaymentsEnabled === undefined ? Boolean(current.qrPaymentsEnabled) : payload.qrPaymentsEnabled === true || payload.qrPaymentsEnabled === 'true';
    const upiIdPaymentsEnabled = payload.upiIdPaymentsEnabled === undefined ? Boolean(current.upiIdPaymentsEnabled) : payload.upiIdPaymentsEnabled === true || payload.upiIdPaymentsEnabled === 'true';
    const qrSessionMinutes = payload.qrSessionMinutes === undefined ? Number(current.qrSessionMinutes || 10) : Number(payload.qrSessionMinutes);

    if (upiId && !UPI_ID_PATTERN.test(upiId)) {
      throw new BadRequestError('Enter a valid UPI ID, such as business@upi.', 'INVALID_UPI_ID');
    }
    if (!Number.isInteger(qrSessionMinutes) || qrSessionMinutes < 1 || qrSessionMinutes > 60) {
      throw new BadRequestError('QR display duration must be between 1 and 60 minutes.', 'INVALID_QR_SESSION_DURATION');
    }
    if (upiIdPaymentsEnabled && !upiId) {
      throw new BadRequestError('Enter a UPI ID before enabling UPI ID payments.', 'UPI_ID_REQUIRED');
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
    };
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
      after: { upiId, accountName, qrPaymentsEnabled, upiIdPaymentsEnabled, qrSessionMinutes, qrImageUploaded: Boolean(uploadedPath) },
      req,
    });
    return this.getSettings(wholesalerId);
  }

  static async getRetailerPaymentOptions(retailerId) {
    const relationship = await WholesalerRetailerRelationship.findOne({ retailerId, status: 'ACTIVE' });
    if (!relationship) throw new ForbiddenError('Connect to a wholesaler before viewing payment options.', 'NO_ACTIVE_WHOLESALER');
    const profile = await getProfile(relationship.wholesalerId);
    const settings = profile.paymentSettings?.toObject?.() || profile.paymentSettings || {};
    const qrDataUrl = settings.qrPaymentsEnabled ? getQrDataUrl(profile) : '';
    return {
      wholesalerId: String(relationship.wholesalerId),
      businessName: profile.businessName,
      accountName: settings.accountName || profile.businessName,
      qrPaymentsEnabled: Boolean(settings.qrPaymentsEnabled && qrDataUrl),
      hasQrImage: Boolean(qrDataUrl),
      qrDataUrl,
      upiIdPaymentsEnabled: Boolean(settings.upiIdPaymentsEnabled && settings.upiId),
      upiId: settings.upiId || '',
      qrSessionMinutes: Number(settings.qrSessionMinutes || 10),
    };
  }

  static async createRetailerQrSession(retailerId) {
    const relationship = await WholesalerRetailerRelationship.findOne({ retailerId, status: 'ACTIVE' });
    if (!relationship) throw new ForbiddenError('Connect to a wholesaler before viewing payment options.', 'NO_ACTIVE_WHOLESALER');
    const profile = await getProfile(relationship.wholesalerId);
    const settings = profile.paymentSettings?.toObject?.() || profile.paymentSettings || {};
    if (!settings.qrPaymentsEnabled) {
      throw new BadRequestError('This wholesaler has not enabled QR payments.', 'QR_PAYMENTS_DISABLED');
    }

    const qrDataUrl = getQrDataUrl(profile);
    if (!qrDataUrl) {
      throw new NotFoundError('The wholesaler QR image is unavailable. Ask them to upload it again.', 'QR_IMAGE_UNAVAILABLE');
    }

    const qrSessionMinutes = Number(settings.qrSessionMinutes || 10);
    return {
      wholesalerId: String(relationship.wholesalerId),
      qrDataUrl,
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
      throw new BadRequestError('Enter a valid UPI transaction/reference ID.', 'INVALID_TRANSACTION_REFERENCE');
    }

    const relationship = await WholesalerRetailerRelationship.findOne({ retailerId, status: 'ACTIVE' });
    if (!relationship) throw new ForbiddenError('No active wholesaler is connected to this retailer.', 'NO_ACTIVE_WHOLESALER');
    const wholesalerId = relationship.wholesalerId;
    const profile = await getProfile(wholesalerId);
    const settings = profile.paymentSettings || {};
    const creditRepayment = payload.type === 'CREDIT_REPAYMENT';
    let order;
    let relatedOrderIds = [];
    if (!settings.qrPaymentsEnabled && !settings.upiIdPaymentsEnabled) {
      throw new BadRequestError('This wholesaler has not enabled direct UPI payments.', 'DIRECT_UPI_DISABLED');
    }

    if (creditRepayment) {
      const currentOutstandingPaise = Number.isSafeInteger(relationship.currentOutstandingPaise)
        ? relationship.currentOutstandingPaise
        : Math.round(Number(relationship.currentOutstandingAmount || 0) * 100);
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
      const orderId = String(payload.orderId || '');
      if (!/^[0-9a-fA-F]{24}$/.test(orderId)) throw new BadRequestError('A valid order ID is required.', 'INVALID_ORDER_ID');
      order = await Order.findOne({ _id: orderId, retailerId, wholesalerId });
      if (!order) throw new NotFoundError('Order not found or does not belong to this retailer.');
      if (order.isCreditOrder) throw new BadRequestError('Use the credit repayment option for credit orders.', 'CREDIT_REPAYMENT_REQUIRED');
      if (order.paymentStatus === 'PAID') throw new BadRequestError('This order is already paid.', 'ORDER_ALREADY_PAID');
      if (order.paymentMethod !== 'UPI') {
        throw new BadRequestError('Direct UPI reports are only available for UPI orders.', 'ORDER_PAYMENT_METHOD_MISMATCH');
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
    try {
      const report = await Payment.create({
        orderId: order._id,
        retailerId,
        wholesalerId,
        amount: amountInRupees(amountPaise),
        amountPaise,
        currency: 'INR',
        status: 'PENDING',
        paymentMethod: 'UPI',
        transactionReference,
        transactionReferenceKey: referenceKey,
        isReport: true,
        isCreditRepayment: creditRepayment,
        relatedOrderIds,
        screenshotPath,
      });
      await AuditService.log({
        actorId: retailerId,
        actorRole: 'RETAILER',
        action: 'CREATE',
        entityType: 'PaymentReport',
        entityId: report._id,
        after: { amountPaise, status: 'PENDING', isCreditRepayment: creditRepayment, orderId: order._id },
        req,
      });
      return this.serializeReport(report);
    } catch (error) {
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
    return items.map((item) => {
      const screenshotAvailable = Boolean(item.screenshotPath);
      delete item.screenshotPath;
      return { ...item, screenshotAvailable };
    });
  }

  static async listWholesalerReports(wholesalerId) {
    const items = await Payment.find({ wholesalerId, isReport: true })
      .populate('retailerId', 'name email phone')
      .populate('orderId', 'orderNumber grandTotal')
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();
    return items.map((item) => {
      const screenshotAvailable = Boolean(item.screenshotPath);
      delete item.screenshotPath;
      return { ...item, screenshotAvailable };
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

  static async verifyReport(wholesalerId, reportId, action, note, actor, req) {
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

    const claimed = await Payment.findOneAndUpdate(
      { _id: report._id, wholesalerId, status: 'PENDING' },
      { $set: { status: 'PROCESSING' } },
      { new: true }
    );
    if (!claimed) throw new ConflictError('This payment report is currently being reviewed.', 'PAYMENT_REPORT_PROCESSING');

    let orderPaymentAllocation = null;
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
                paymentStatus: fullyPaid ? 'PAID' : 'PENDING',
                ...(fullyPaid ? { creditSettledAt: new Date() } : {}),
              },
            },
            { new: true }
          );
          if (!updatedOrder) continue;
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
      { $set: { status: 'PAID', reviewNote: String(note || '').trim(), reviewedBy: actor._id, reviewedAt: new Date(), paidAt: new Date() } },
      { new: true }
    );

    if (orderPaymentAllocation && orderPaymentAllocation.order.directPaidPaise >= orderPaymentAllocation.orderTotalPaise) {
      await Order.updateOne(
        { _id: orderPaymentAllocation.order._id, wholesalerId, retailerId: report.retailerId },
        { $set: { paymentStatus: 'PAID' } }
      );
      await Payment.updateMany(
        { orderId: orderPaymentAllocation.order._id, isReport: { $ne: true }, status: 'PENDING' },
        { $set: { status: 'PAID', paidAt: new Date() } }
      );
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

  static async getScreenshotPath(reportId, user, req) {
    validateObjectId(reportId, 'payment report ID');
    const filter = { _id: reportId, isReport: true };
    if (user.role === 'RETAILER') filter.retailerId = user._id;
    else if (user.role === 'WHOLESALER') filter.wholesalerId = user._id;
    else if (user.role !== 'SUPER_ADMIN') throw new ForbiddenError('You are not allowed to view payment evidence.');
    const report = await Payment.findOne(filter).select('screenshotPath retailerId wholesalerId');
    if (!report || !report.screenshotPath) throw new NotFoundError('Payment screenshot not found.');
    const filePath = path.join(REPORT_DIRECTORY, path.basename(report.screenshotPath));
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
