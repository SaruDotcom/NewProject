const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema(
  {
    wholesalerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
      default: null, // null for platform/admin wide coupons
    },
    code: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
    discountType: {
      type: String,
      enum: ['PERCENTAGE', 'PERCENT', 'FLAT'],
      default: 'PERCENTAGE',
    },
    discountValue: {
      type: Number,
      required: true,
      min: 0,
    },
    maxDiscountCap: {
      type: Number,
      default: 0, // 0 = no cap
    },
    minOrderValue: {
      type: Number,
      default: 0,
    },
    validFrom: {
      type: Date,
      default: Date.now,
    },
    validUntil: {
      type: Date,
      default: null,
    },
    usageLimit: {
      type: Number,
      default: 0, // 0 = unlimited
    },
    usageCount: {
      type: Number,
      default: 0,
    },
    perRetailerLimit: {
      type: Number,
      default: 0, // 0 = unlimited
    },
    perRetailerUsage: [
      {
        retailerId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        count: {
          type: Number,
          default: 0,
        },
      },
    ],
    applicableFor: {
      type: String,
      enum: ['WHOLESALER_SUBSCRIPTION', 'RETAILER_ORDER', 'ALL'],
      default: 'RETAILER_ORDER',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Compound index for wholesaler and code
couponSchema.index({ wholesalerId: 1, code: 1, isDeleted: 1 });

// Backward compatibility virtuals/getters
couponSchema.virtual('maxDiscount').get(function () {
  return this.maxDiscountCap;
});

couponSchema.virtual('minPlanAmount').get(function () {
  return this.minOrderValue;
});

couponSchema.virtual('usedCount').get(function () {
  return this.usageCount;
});

module.exports = mongoose.model('Coupon', couponSchema);
