const mongoose = require('mongoose');

const supplierLedgerEntrySchema = new mongoose.Schema(
  {
    wholesalerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    supplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', required: true, index: true },
    type: {
      type: String,
      enum: ['OPENING_BALANCE', 'PURCHASE', 'PAYMENT', 'PURCHASE_ADJUSTMENT', 'PURCHASE_RETURN', 'REVERSAL', 'ADJUSTMENT'],
      required: true,
      index: true,
    },
    amount: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },
    effectiveDate: { type: Date, required: true, index: true },
    referenceType: { type: String, trim: true, default: '' },
    referenceId: { type: mongoose.Schema.Types.ObjectId, default: null },
    transactionKey: { type: String, required: true, trim: true },
    notes: { type: String, trim: true, default: '', maxlength: 1000 },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

supplierLedgerEntrySchema.index({ wholesalerId: 1, transactionKey: 1 }, { unique: true });
supplierLedgerEntrySchema.index({ wholesalerId: 1, supplierId: 1, createdAt: 1 });
supplierLedgerEntrySchema.index({ wholesalerId: 1, supplierId: 1, effectiveDate: 1 });

module.exports = mongoose.model('SupplierLedgerEntry', supplierLedgerEntrySchema);
