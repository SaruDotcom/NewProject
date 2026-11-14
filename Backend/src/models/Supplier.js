const mongoose = require('mongoose');

const supplierSchema = new mongoose.Schema(
  {
    wholesalerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 160 },
    mobile: { type: String, required: true, trim: true, maxlength: 20 },
    address: { type: String, trim: true, default: '', maxlength: 500 },
    gstin: { type: String, trim: true, uppercase: true, default: '', maxlength: 15 },
    openingBalance: { type: Number, min: 0, default: 0 },
    currentBalance: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

supplierSchema.index({ wholesalerId: 1, name: 1 });
supplierSchema.index({ wholesalerId: 1, mobile: 1 });

module.exports = mongoose.model('Supplier', supplierSchema);
