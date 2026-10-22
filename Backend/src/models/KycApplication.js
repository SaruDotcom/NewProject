const mongoose = require('mongoose');
const { KYC_STATUS } = require('../config/constants');

const kycApplicationSchema = new mongoose.Schema(
  {
    wholesalerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    businessName: {
      type: String,
      required: true,
      trim: true,
    },
    ownerName: {
      type: String,
      required: true,
      trim: true,
    },
    businessType: {
      type: String,
      required: true,
      default: 'Proprietorship',
    },
    pan: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    hasGst: {
      type: Boolean,
      default: false,
    },
    gstin: {
      type: String,
      trim: true,
      uppercase: true,
      default: '',
    },
    registeredAddress: {
      street: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      pincode: { type: String, required: true },
      country: { type: String, default: 'India' },
    },
    bankDetails: {
      accountHolderName: { type: String, required: true },
      accountNumber: { type: String, required: true },
      ifscCode: { type: String, required: true },
      bankName: { type: String, required: true },
      branch: { type: String, default: '' },
    },
    documents: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'KycDocument',
      },
    ],
    status: {
      type: String,
      enum: Object.values(KYC_STATUS),
      default: KYC_STATUS.DRAFT,
      index: true,
    },
    submittedAt: {
      type: Date,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    reviewedAt: {
      type: Date,
    },
    reviewReason: {
      type: String,
      default: '',
    },
    reviewNote: {
      type: String,
      default: '',
    },
    history: [
      {
        fromStatus: { type: String },
        toStatus: { type: String },
        reason: { type: String },
        changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        changedAt: { type: Date, default: Date.now },
      },
    ],
    isDemo: { type: Boolean, default: false, index: true },
  },
  {
    timestamps: true,
  }
);

const KycApplication = mongoose.model('KycApplication', kycApplicationSchema);
module.exports = KycApplication;
