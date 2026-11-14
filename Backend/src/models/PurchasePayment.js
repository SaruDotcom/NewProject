const mongoose = require('mongoose');

const paymentAllocationSchema = new mongoose.Schema(
  {
    billId: { type: mongoose.Schema.Types.ObjectId, ref: 'PurchaseBill', required: true },
    amount: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const purchasePaymentSchema = new mongoose.Schema(
  {
    wholesalerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    supplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', required: true, index: true },
    billId: { type: mongoose.Schema.Types.ObjectId, ref: 'PurchaseBill', default: null, index: true },
    amount: { type: Number, required: true, min: 0.01 },
    direction: { type: String, enum: ['OUTGOING', 'REFUND_RECEIVED'], default: 'OUTGOING' },
    paymentDate: { type: Date, required: true },
    paymentMode: { type: String, enum: ['CASH', 'UPI', 'CHEQUE', 'BANK_TRANSFER'], required: true },
    notes: { type: String, trim: true, default: '', maxlength: 1000 },
    source: { type: String, enum: ['BILL', 'SUPPLIER'], required: true },
    allocations: { type: [paymentAllocationSchema], default: [] },
    idempotencyKey: { type: String, required: true, trim: true },
    status: { type: String, enum: ['POSTED', 'REVERSED'], default: 'POSTED', index: true },
    reversedAt: { type: Date, default: null },
    reversedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reversalReason: { type: String, trim: true, default: '', maxlength: 500 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

purchasePaymentSchema.index({ wholesalerId: 1, idempotencyKey: 1 }, { unique: true });
purchasePaymentSchema.index({ wholesalerId: 1, supplierId: 1, paymentDate: -1 });

module.exports = mongoose.model('PurchasePayment', purchasePaymentSchema);
