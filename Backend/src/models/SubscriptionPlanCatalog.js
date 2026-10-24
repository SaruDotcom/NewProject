const mongoose = require('mongoose');

const subscriptionPlanCatalogSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    initialized: { type: Boolean, default: false },
  },
  { timestamps: true },
);

module.exports = mongoose.model('SubscriptionPlanCatalog', subscriptionPlanCatalogSchema);
