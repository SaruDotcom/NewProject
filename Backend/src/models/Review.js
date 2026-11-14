const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    userRole: {
      type: String,
      enum: ['RETAILER', 'WHOLESALER', 'SUPER_ADMIN', 'ADMIN'],
      default: 'RETAILER',
    },
    wholesalerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      default: null,
    },
    recipientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    recipientRole: {
      type: String,
      enum: ['RETAILER', 'WHOLESALER'],
    },
    recipientReadAt: {
      type: Date,
      default: null,
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
    },
    title: {
      type: String,
      trim: true,
      default: '',
    },
    comment: {
      type: String,
      required: true,
      trim: true,
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
      default: 5,
    },
    categoryRatings: {
      productQuality: { type: Number, min: 1, max: 5 },
      packaging: { type: Number, min: 1, max: 5 },
      delivery: { type: Number, min: 1, max: 5 },
      communication: { type: Number, min: 1, max: 5 },
    },
    status: {
      type: String,
      enum: ['approved', 'pending', 'hidden'],
      default: 'approved',
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    isDemo: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

reviewSchema.index({ recipientId: 1, recipientRole: 1, status: 1, isDeleted: 1 });
reviewSchema.index(
  { userId: 1, orderId: 1 },
  { unique: true, partialFilterExpression: { orderId: { $type: 'objectId' } } }
);

module.exports = mongoose.model('Review', reviewSchema);
