const mongoose = require('mongoose');

const khataEntrySchema = new mongoose.Schema(
  {
    wholesalerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    transactionType: {
      type: String,
      enum: ['PURCHASE', 'SALE', 'EXPENSE', 'PAYMENT_RECEIVED', 'PAYMENT_PAID'],
      required: true,
      index: true,
    },
    productName: { type: String, trim: true, default: '', maxlength: 160 },
    category: { type: String, trim: true, default: '', maxlength: 120 },
    size: { type: String, trim: true, default: '', maxlength: 80 },
    colour: { type: String, trim: true, default: '', maxlength: 80 },
    unit: { type: String, trim: true, default: '', maxlength: 40 },
    brandModel: { type: String, trim: true, default: '', maxlength: 120 },
    counterpartyName: { type: String, trim: true, default: '', maxlength: 160 },
    quantity: { type: Number, min: 0, default: 0 },
    returnedQuantity: { type: Number, min: 0, default: 0 },
    purchaseRate: { type: Number, min: 0, default: 0 },
    sellingRate: { type: Number, min: 0, default: 0 },
    purchaseAmount: { type: Number, min: 0, default: 0 },
    saleAmount: { type: Number, min: 0, default: 0 },
    discountAmount: { type: Number, min: 0, default: 0 },
    additionalExpenses: { type: Number, min: 0, default: 0 },
    paidAmount: { type: Number, min: 0, default: 0 },
    pendingAmount: { type: Number, min: 0, default: 0 },
    paymentStatus: { type: String, enum: ['PAID', 'PARTIAL', 'PENDING'], default: 'PAID', index: true },
    notes: { type: String, trim: true, default: '', maxlength: 1000 },
  },
  { timestamps: true }
);

khataEntrySchema.index({ wholesalerId: 1, date: -1, createdAt: -1 });
khataEntrySchema.index({ wholesalerId: 1, counterpartyName: 1 });

module.exports = mongoose.model('KhataEntry', khataEntrySchema);
