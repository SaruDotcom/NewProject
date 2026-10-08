const mongoose = require('mongoose');
const { KYC_STATUS } = require('../config/constants');

const wholesalerProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    businessName: {
      type: String,
      required: [true, 'Business name is required'],
      trim: true,
      index: true,
    },
    businessLogoUrl: {
      type: String,
      default: '',
    },
    description: {
      type: String,
      default: '',
    },
    businessType: {
      type: String,
      enum: ['Proprietorship', 'Partnership', 'LLP', 'Private Limited', 'Public Limited', 'Other'],
      default: 'Proprietorship',
    },
    gstin: {
      type: String,
      trim: true,
      uppercase: true,
      sparse: true,
    },
    hasGst: {
      type: Boolean,
      default: false,
    },
    gstStatus: {
      type: String,
      enum: ['REGISTERED', 'UNREGISTERED'],
      default: 'UNREGISTERED',
    },
    pan: {
      type: String,
      trim: true,
      uppercase: true,
      sparse: true,
    },
    address: {
      street: { type: String, default: '' },
      city: { type: String, default: '' },
      state: { type: String, default: '' },
      pincode: { type: String, default: '' },
      country: { type: String, default: 'India' },
    },
    pickupAddress: {
      street: { type: String, default: '' },
      city: { type: String, default: '' },
      state: { type: String, default: '' },
      pincode: { type: String, default: '' },
      country: { type: String, default: 'India' },
      sameAsBusinessAddress: { type: Boolean, default: true },
    },
    registrationDetails: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    bankDetails: {
      accountHolderName: { type: String, default: '' },
      accountNumber: { type: String, default: '' },
      ifscCode: { type: String, default: '' },
      bankName: { type: String, default: '' },
      branch: { type: String, default: '' },
      isVerified: { type: Boolean, default: false },
    },
    kycStatus: {
      type: String,
      enum: Object.values(KYC_STATUS),
      default: KYC_STATUS.DRAFT,
      index: true,
    },
    kycApplicationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'KycApplication',
    },
    commissionRate: {
      type: Number,
      default: 5.0, // Default 5% platform commission
      min: 0,
      max: 100,
    },
    minOrderValue: {
      type: Number,
      default: 0,
    },
    creditPolicy: {
      creditEnabled: { type: Boolean, default: false },
      allowCOD: { type: Boolean, default: true },
      defaultCreditLimit: { type: Number, default: 0, min: 0 },
      creditPeriodDays: { type: Number, default: 15, min: 1 },
      lateFeePercent: { type: Number, default: 0, min: 0 },
      minOrderForCredit: { type: Number, default: 0, min: 0 },
    },
    walletId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Wallet',
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

wholesalerProfileSchema.index({ 'address.city': 1, 'address.state': 1 });

const WholesalerProfile = mongoose.model('WholesalerProfile', wholesalerProfileSchema);
module.exports = WholesalerProfile;
