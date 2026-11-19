const mongoose = require('mongoose');

const wholesalerReferralSchema = new mongoose.Schema(
  {
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
    referralCode: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },
    registeredAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    kycApprovedAt: {
      type: Date,
    },
    status: {
      type: String,
      enum: ['REGISTERED', 'QUALIFIED', 'REJECTED'],
      default: 'REGISTERED',
      index: true,
    },
    rejectionReason: {
      type: String,
      default: '',
      maxlength: 500,
    },
  },
  { timestamps: true }
);

wholesalerReferralSchema.index({ referrerId: 1, registeredAt: -1 });

module.exports = mongoose.model('WholesalerReferral', wholesalerReferralSchema);
