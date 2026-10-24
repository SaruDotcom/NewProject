const mongoose = require('mongoose');

const wholesalerSubscriptionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    wholesalerProfileId: { type: mongoose.Schema.Types.ObjectId, ref: 'WholesalerProfile', required: true, index: true },
    planId: { type: mongoose.Schema.Types.ObjectId, ref: 'SubscriptionPlan', required: true },
    planName: { type: String, required: true },
    billingPeriod: { type: String, enum: ['MONTHLY', 'YEARLY'], default: 'MONTHLY' },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'INR' },
    status: { type: String, enum: ['ACTIVE', 'EXPIRED'], default: 'ACTIVE', index: true },
    startedAt: { type: Date, required: true },
    renewalDate: { type: Date, required: true, index: true },
    razorpayOrderId: { type: String, required: true },
    razorpayPaymentId: { type: String, required: true },
  },
  { timestamps: true },
);

module.exports = mongoose.model('WholesalerSubscription', wholesalerSubscriptionSchema);
