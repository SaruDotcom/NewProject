const mongoose = require('mongoose');
const { KYC_STATUS } = require('../config/constants');

const bannerSlideSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    title: { type: String, required: true, trim: true },
    subtitle: { type: String, default: '', trim: true },
    badgeText: { type: String, default: '', trim: true },
    buttonText: { type: String, default: 'Shop Trade Deals', trim: true },
    imageUrl: { type: String, default: '', trim: true },
    targetCategory: { type: String, default: 'All', trim: true },
    discountBadge: { type: String, default: '', trim: true },
    gradient: { type: String, default: 'from-tradeflow-navy via-tradeflow-green to-tradeflow-navy', trim: true },
    isActive: { type: Boolean, default: true },
    businessType: { type: String, default: '', trim: true },
  },
  { _id: false, timestamps: true }
);

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
    businessCategory: {
      type: String,
      enum: ['', 'CLOTHING', 'COSMETICS', 'GENERAL_STORE', 'FOOTWEAR', 'ELECTRONICS', 'OTHER'],
      default: '',
    },
    activeStoreTheme: {
      type: String,
      enum: ['DEFAULT', 'ROYAL', 'FESTIVE', 'MINIMAL'],
      default: 'DEFAULT',
    },
    promotionalBanners: {
      type: [bannerSlideSchema],
      default: [],
    },
    retailerReferralCode: {
      type: String,
      uppercase: true,
      trim: true,
      unique: true,
      sparse: true,
      index: true,
    },
    retailerSignupsEnabled: {
      type: Boolean,
      default: true,
    },
    description: {
      type: String,
      default: '',
    },
    khataBook: {
      businessType: {
        type: String,
        enum: ['', 'CLOTHING', 'GENERAL_STORE', 'ELECTRONICS', 'FOOTWEAR', 'COSMETICS', 'OTHER'],
        default: '',
      },
      otherBusinessType: { type: String, trim: true, default: '', maxlength: 80 },
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
    registrationSource: {
      type: String,
      enum: ['DIRECT', 'ADMIN_INVITE', 'CAMPAIGN', 'ADMIN_LINK'],
      default: 'DIRECT',
      index: true,
    },
    adminReferralCode: { type: String, default: '', trim: true, index: true },
    utmSource: { type: String, default: '', maxlength: 100 },
    utmMedium: { type: String, default: '', maxlength: 100 },
    utmCampaign: { type: String, default: '', maxlength: 100 },
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
    paymentSettings: {
      upiId: { type: String, trim: true, lowercase: true, default: '' },
      accountName: { type: String, trim: true, default: '' },
      qrImagePath: { type: String, default: '' },
      qrImageMimeType: { type: String, enum: ['', 'image/jpeg', 'image/png', 'image/webp'], default: '' },
      qrPaymentsEnabled: { type: Boolean, default: false },
      upiIdPaymentsEnabled: { type: Boolean, default: false },
      qrSessionMinutes: { type: Number, default: 10, min: 1, max: 60 },
    },
    walletId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Wallet',
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    twoFactorEnabled: {
      type: Boolean,
      default: false,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    isDemo: { type: Boolean, default: false, index: true },
  },
  {
    timestamps: true,
  }
);

wholesalerProfileSchema.index({ 'address.city': 1, 'address.state': 1 });

const WholesalerProfile = mongoose.model('WholesalerProfile', wholesalerProfileSchema);
module.exports = WholesalerProfile;
