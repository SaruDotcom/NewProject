const mongoose = require('mongoose');

const wholesalerInviteSchema = new mongoose.Schema(
  {
    tokenHash: { type: String, required: true, unique: true, index: true, select: false },
    contactName: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
    phone: { type: String, required: true, trim: true, maxlength: 16 },
    businessName: { type: String, required: true, trim: true, maxlength: 150 },
    note: { type: String, default: '', trim: true, maxlength: 500 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    expiresAt: { type: Date, required: true, index: true },
    status: {
      type: String,
      enum: ['SENT', 'OPENED', 'REGISTERED', 'EXPIRED', 'REVOKED'],
      default: 'SENT',
      index: true,
    },
    openedAt: { type: Date, default: null },
    registeredAt: { type: Date, default: null },
    wholesalerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    registrationClaimId: { type: String, default: null, select: false },
    registrationClaimExpiresAt: { type: Date, default: null, select: false },
  },
  { timestamps: true }
);

wholesalerInviteSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('WholesalerInvite', wholesalerInviteSchema);
