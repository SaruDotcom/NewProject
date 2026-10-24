const mongoose = require('mongoose');

const subscriptionPlanSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0, default: 499 },
    billingPeriod: { type: String, enum: ['MONTHLY', 'YEARLY'], default: 'MONTHLY' },
    description: { type: String, trim: true, default: '' },
    taxNote: { type: String, trim: true, default: 'Taxes may apply.' },
    isActive: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
    recommended: { type: Boolean, default: false },
    features: [{
      title: { type: String, required: true, trim: true },
      enabled: { type: Boolean, default: true },
      order: { type: Number, default: 0 },
    }],
  },
  { timestamps: true },
);

module.exports = mongoose.model('SubscriptionPlan', subscriptionPlanSchema);
