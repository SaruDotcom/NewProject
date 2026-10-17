const mongoose = require('mongoose');
const { PAYOUT_STATUS } = require('../config/constants');

const payoutSchema = new mongoose.Schema(
  {
    payoutNumber: {
      type: String,
      required: true,
      unique: true,
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
      min: [1, 'Payout amount must be greater than 0'],
    },
    status: {
      type: String,
      enum: Object.values(PAYOUT_STATUS),
      default: PAYOUT_STATUS.REQUESTED,
      index: true,
    },
    bankAccountReference: {
      accountHolderName: String,
      accountNumber: String,
      ifscCode: String,
      bankName: String,
    },
    transactionReference: {
      type: String,
      default: '',
    },
    failureReason: {
      type: String,
      default: '',
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    approvedAt: {
      type: Date,
    },
    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    processedAt: {
      type: Date,
    },
    rejectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    rejectedAt: {
      type: Date,
    },
    idempotencyKey: {
      type: String,
      sparse: true,
      index: true,
    },
    notes: {
      type: String,
      default: '',
    },
    isDemo: { type: Boolean, default: false, index: true },
  },
  {
    timestamps: true,
  }
);

payoutSchema.index({ wholesalerId: 1, createdAt: -1 });

const Payout = mongoose.model('Payout', payoutSchema);
module.exports = Payout;
