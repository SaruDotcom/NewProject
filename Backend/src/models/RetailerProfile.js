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
  },
  {
    timestamps: true,
  }
);

const RetailerProfile = mongoose.model('RetailerProfile', retailerProfileSchema, 'retailers');
module.exports = RetailerProfile;
