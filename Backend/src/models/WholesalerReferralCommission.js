const mongoose = require('mongoose');

const statusHistorySchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'PROCESSING', 'PAID', 'REJECTED'],
      required: true,
    },
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    changedAt: {
      type: Date,
      default: Date.now,
    },
    reason: {
      type: String,
      default: '',
      maxlength: 500,
    },
    transactionReference: {
      type: String,
      default: '',
      maxlength: 120,
    },
  },
  { _id: false }
);

const wholesalerReferralCommissionSchema = new mongoose.Schema(
  {
    referralId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'WholesalerReferral',
      required: true,
      unique: true,
      index: true,
    },
    referrerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    referredWholesalerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0.01,
    },
    currency: {
      type: String,
      enum: ['INR'],
      default: 'INR',
    },
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'PROCESSING', 'PAID', 'REJECTED'],
      default: 'PENDING',
      index: true,
    },
    eligibleAt: {
      type: Date,
      required: true,
    },
    approvedAt: Date,
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    processingAt: Date,
    processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    paidAt: Date,
    paidBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    transactionReference: {
      type: String,
      trim: true,
      maxlength: 120,
      sparse: true,
      unique: true,
    },
    payoutBankSnapshot: {
      bankName: { type: String, default: '' },
      accountLast4: { type: String, default: '' },
      ifscCode: { type: String, default: '' },
      branch: { type: String, default: '' },
    },
    rejectedAt: Date,
    rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    rejectionReason: { type: String, default: '', maxlength: 500 },
    statusHistory: {
      type: [statusHistorySchema],
      default: [],
    },
  },
  { timestamps: true }
);

wholesalerReferralCommissionSchema.index({ referrerId: 1, createdAt: -1 });

module.exports = mongoose.model(
  'WholesalerReferralCommission',
  wholesalerReferralCommissionSchema
);
