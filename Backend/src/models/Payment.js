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
    transactionReferenceKey: { type: String, default: '' },
    isReport: { type: Boolean, default: false, index: true },
    isCreditRepayment: { type: Boolean, default: false, index: true },
    relatedOrderIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Order' }],
    screenshotPath: { type: String, default: '' },
    reviewNote: { type: String, default: '' },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
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

const Payment = mongoose.model('Payment', paymentSchema);
module.exports = Payment;
