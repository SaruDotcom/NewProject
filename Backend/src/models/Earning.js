const mongoose = require('mongoose');

const earningSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      unique: true,
      index: true,
    },
    wholesalerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    grossAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    platformCommissionRate: {
      type: Number,
      required: true,
      default: 5.0,
    },
    platformCommission: {
      type: Number,
      required: true,
      min: 0,
    },
    tax: {
      type: Number,
      default: 0,
      min: 0,
    },
    refundAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    wholesalerAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ['PENDING', 'SETTLED', 'REFUNDED'],
      default: 'PENDING',
      index: true,
    },
    settledAt: {
      type: Date,
    },
    settlementDate: {
      type: Date,
      index: true,
    },
    isDemo: { type: Boolean, default: false, index: true },
  },
  {
    timestamps: true,
  }
);

earningSchema.index({ wholesalerId: 1, createdAt: -1 });

const Earning = mongoose.model('Earning', earningSchema);
module.exports = Earning;
