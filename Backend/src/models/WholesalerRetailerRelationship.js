const mongoose = require('mongoose');
const { RELATIONSHIP_STATUS } = require('../config/constants');

const wholesalerRetailerRelationshipSchema = new mongoose.Schema(
  {
    wholesalerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    retailerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    invitationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Invitation',
    },
    referralCode: {
      type: String,
      uppercase: true,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      enum: Object.values(RELATIONSHIP_STATUS),
      default: RELATIONSHIP_STATUS.ACTIVE,
      index: true,
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
    approvedAt: {
      type: Date,
      default: Date.now,
    },
    terminatedAt: {
      type: Date,
    },
    blockedAt: {
      type: Date,
    },
    notes: {
      type: String,
      default: '',
    },
    customCreditLimit: {
      type: Number,
      default: null,
    },
    currentOutstandingAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    isDemo: { type: Boolean, default: false, index: true },
  },
  {
    timestamps: true,
  }
);

// CRITICAL DATABASE ENFORCEMENT:
// Compound partial unique index guaranteeing a retailer can have AT MOST ONE active relationship.
wholesalerRetailerRelationshipSchema.index(
  { retailerId: 1 },
  {
    unique: true,
    partialFilterExpression: { status: RELATIONSHIP_STATUS.ACTIVE },
    name: 'unique_active_retailer_relationship',
  }
);

// General compound index for fast lookups
wholesalerRetailerRelationshipSchema.index({ wholesalerId: 1, retailerId: 1 });
wholesalerRetailerRelationshipSchema.index({ wholesalerId: 1, status: 1 });

const WholesalerRetailerRelationship = mongoose.model(
  'WholesalerRetailerRelationship',
  wholesalerRetailerRelationshipSchema
);

module.exports = WholesalerRetailerRelationship;
