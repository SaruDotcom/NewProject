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
    recipientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    recipientRole: {
      type: String,
      enum: ['RETAILER', 'WHOLESALER'],
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

module.exports = mongoose.model('Review', reviewSchema);
