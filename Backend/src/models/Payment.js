const mongoose = require('mongoose');
const { PAYMENT_STATUS, PAYMENT_METHOD } = require('../config/constants');

const paymentSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      index: true,
    },
    retailerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    wholesalerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    amountPaise: {
      type: Number,
      min: 1,
    },
    currency: {
      type: String,
      default: 'INR',
    },
    status: {
      type: String,
      enum: Object.values(PAYMENT_STATUS),
      default: PAYMENT_STATUS.PENDING,
      index: true,
    },
    paymentMethod: {
      type: String,
      enum: Object.values(PAYMENT_METHOD),
      default: PAYMENT_METHOD.BANK_TRANSFER,
    },
    transactionReference: {
      type: String,
      default: '',
      trim: true,
    },
    reportedPaymentDate: { type: Date, default: null },
    paymentDetails: { type: String, default: '', maxlength: 500 },
    notes: { type: String, default: '', maxlength: 500 },
    evidenceMimeType: { type: String, enum: ['', 'image/jpeg', 'image/png', 'image/webp', 'application/pdf'], default: '' },
    transactionReferenceKey: { type: String, default: '' },
    isReport: { type: Boolean, default: false, index: true },
    isCreditRepayment: { type: Boolean, default: false, index: true },
    creditOrderSpecific: { type: Boolean, default: false },
    relatedOrderIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Order' }],
    orderAllocations: [{
      orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
      amountPaise: { type: Number, required: true, min: 1 },
    }],
    screenshotPath: { type: String, default: '' },
    reviewNote: { type: String, default: '' },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
    approvalOtpHash: { type: String, default: '' },
    approvalOtpExpiresAt: { type: Date, default: null },
    approvalOtpAttempts: { type: Number, default: 0, min: 0 },
    approvalOtpSentAt: { type: Date, default: null },
    approvalOtpVerifiedAt: { type: Date, default: null },
    isReversal: { type: Boolean, default: false, index: true },
    reversesPaymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment', default: null },
    reversalReason: { type: String, default: '', maxlength: 500 },
    reversedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reversedAt: { type: Date, default: null },
    gatewayResponse: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    paidAt: {
      type: Date,
    },
    isDemo: { type: Boolean, default: false, index: true },
  },
  {
    timestamps: true,
  }
);

paymentSchema.index(
  { transactionReferenceKey: 1 },
  { unique: true, partialFilterExpression: { transactionReferenceKey: { $type: 'string', $gt: '' } } }
);
paymentSchema.index({ wholesalerId: 1, isReport: 1, status: 1, paidAt: -1 });
paymentSchema.index({ orderId: 1, isReport: 1, status: 1 });
paymentSchema.index({ wholesalerId: 1, createdAt: -1 });
paymentSchema.index(
  { reversesPaymentId: 1 },
  { unique: true, partialFilterExpression: { reversesPaymentId: { $type: 'objectId' } } }
);

const Payment = mongoose.model('Payment', paymentSchema);
module.exports = Payment;
