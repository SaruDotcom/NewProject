const mongoose = require('mongoose');

const subscriptionPlanCatalogSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    initialized: { type: Boolean, default: false },
    version: { type: Number, default: 1 },
  },
  { timestamps: true },
);

module.exports = mongoose.model('SubscriptionPlanCatalog', subscriptionPlanCatalogSchema);
