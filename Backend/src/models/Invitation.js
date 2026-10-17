const mongoose = require('mongoose');
const { INVITATION_STATUS } = require('../config/constants');

const invitationSchema = new mongoose.Schema(
  {
    wholesalerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(INVITATION_STATUS),
      default: INVITATION_STATUS.ACTIVE,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    maxUses: {
      type: Number,
      default: 0, // 0 = unlimited
    },
    usedCount: {
      type: Number,
      default: 0,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    revokedAt: {
      type: Date,
    },
    revokedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    isDemo: { type: Boolean, default: false, index: true },
  },
  {
    timestamps: true,
  }
);

invitationSchema.methods.isValid = function () {
  if (this.status !== INVITATION_STATUS.ACTIVE) return false;
  if (this.expiresAt && new Date() > this.expiresAt) return false;
  if (this.maxUses > 0 && this.usedCount >= this.maxUses) return false;
  return true;
};

const Invitation = mongoose.model('Invitation', invitationSchema);
module.exports = Invitation;
