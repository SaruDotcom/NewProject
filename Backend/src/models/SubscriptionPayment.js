const mongoose = require('mongoose');

const subscriptionPaymentSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    wholesalerProfileId: { type: mongoose.Schema.Types.ObjectId, ref: 'WholesalerProfile', required: true },
    planId: { type: mongoose.Schema.Types.ObjectId, ref: 'SubscriptionPlan', required: true },
    planName: { type: String, required: true },
    billingPeriod: { type: String, enum: ['MONTHLY', 'YEARLY'], default: 'MONTHLY' },
    amount: { type: Number, required: true, min: 0 },
    amountPaise: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'INR' },
    status: { type: String, enum: ['PENDING', 'PAID', 'FAILED'], default: 'PENDING', index: true },
    razorpayOrderId: { type: String, required: true, unique: true, index: true },
    razorpayPaymentId: { type: String, default: '' },
    verifiedAt: { type: Date },
  },
  { timestamps: true },
);

module.exports = mongoose.model('SubscriptionPayment', subscriptionPaymentSchema);
