const mongoose = require('mongoose');

const retailerProfileSchema = new mongoose.Schema(
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
      required: [true, 'Store/Business name is required'],
      trim: true,
    },
    ownerName: {
      type: String,
      trim: true,
      default: '',
    },
    category: {
      type: String,
      trim: true,
      default: '',
    },
    businessType: {
      type: String,
      trim: true,
      default: 'Independent retailer',
    },
    gstin: {
      type: String,
      trim: true,
      uppercase: true,
      sparse: true,
    },
    gstStatus: {
      type: String,
      enum: ['REGISTERED', 'UNREGISTERED', 'COMPOSITION'],
      default: 'UNREGISTERED',
    },
    shopPhoto: {
      imageUrl: { type: String, default: '' },
      publicId: { type: String, default: '' },
      resourceType: { type: String, default: '' },
      format: { type: String, default: '' },
    },
    pan: {
      numberEncrypted: { type: String, default: '' },
      last4: { type: String, default: '' },
      imageUrl: { type: String, default: '' },
      publicId: { type: String, default: '' },
      resourceType: { type: String, default: '' },
      format: { type: String, default: '' },
    },
    aadhaar: {
      last4: { type: String, default: '' },
      numberEncrypted: { type: String, default: '' },
      frontImage: {
        imageUrl: { type: String, default: '' },
        publicId: { type: String, default: '' },
        resourceType: { type: String, default: '' },
        format: { type: String, default: '' },
      },
      backImage: {
        imageUrl: { type: String, default: '' },
        publicId: { type: String, default: '' },
        resourceType: { type: String, default: '' },
        format: { type: String, default: '' },
      },
    },
    consent: {
      accepted: { type: Boolean, default: false },
      at: { type: Date, default: null },
    },
    verificationStatus: {
      type: String,
      enum: ['NOT_SUBMITTED', 'SUBMITTED', 'VERIFIED', 'REJECTED'],
      default: 'NOT_SUBMITTED',
    },
    verificationNote: { type: String, default: '', maxlength: 1000 },
    address: {
      street: { type: String, default: '' },
      city: { type: String, default: '' },
      state: { type: String, default: '' },
      pincode: { type: String, default: '' },
      country: { type: String, default: 'India' },
    },
    assignedWholesalerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    wholesalerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    createdByWholesalerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    referralCodeUsed: {
      type: String,
      uppercase: true,
      trim: true,
      default: '',
    },
    activeRelationshipId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'WholesalerRetailerRelationship',
    },
    wholesalerInfo: {
      businessName: { type: String, default: '' },
      ownerName: { type: String, default: '' },
      email: { type: String, default: '' },
      phone: { type: String, default: '' },
    },
    profileComplete: {
      type: Boolean,
      default: false,
      index: true,
    },
    totalPurchaseAmount: {
      type: Number,
      default: 0,
    },
    totalOrdersCount: {
      type: Number,
      default: 0,
    },
    lastOrderAt: {
      type: Date,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    isDemo: { type: Boolean, default: false, index: true },
    registrationSource: {
      type: String,
      default: 'DIRECT',
    },
    utmSource: { type: String, default: '', trim: true, maxlength: 100 },
    utmMedium: { type: String, default: '', trim: true, maxlength: 100 },
    utmCampaign: { type: String, default: '', trim: true, maxlength: 100 },
    utmTerm: { type: String, default: '', trim: true, maxlength: 100 },
    utmContent: { type: String, default: '', trim: true, maxlength: 100 },
    firstLandingAt: { type: Date },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, result) {
        if (result.pan) {
          delete result.pan.numberEncrypted;
          delete result.pan.imageUrl;
          delete result.pan.publicId;
          delete result.pan.resourceType;
          delete result.pan.format;
        }
        if (result.aadhaar) {
          delete result.aadhaar.numberEncrypted;
          for (const key of ['frontImage', 'backImage']) {
            if (result.aadhaar[key]) {
              delete result.aadhaar[key].imageUrl;
              delete result.aadhaar[key].publicId;
              delete result.aadhaar[key].resourceType;
              delete result.aadhaar[key].format;
            }
          }
        }
        if (result.shopPhoto) {
          delete result.shopPhoto.imageUrl;
          delete result.shopPhoto.publicId;
          delete result.shopPhoto.resourceType;
          delete result.shopPhoto.format;
        }
        return result;
      },
    },
  }
);

const RetailerProfile = mongoose.model('RetailerProfile', retailerProfileSchema, 'retailers');
module.exports = RetailerProfile;
