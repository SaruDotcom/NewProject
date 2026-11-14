const mongoose = require('mongoose');

const purchaseReturnItemSchema = new mongoose.Schema(
  {
    billItemId: { type: mongoose.Schema.Types.ObjectId, required: true },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    productName: { type: String, required: true, trim: true, maxlength: 160 },
    quantity: { type: Number, required: true, min: 0.001 },
    unit: { type: String, enum: ['KG', 'BOX', 'CARTON', 'PIECES', 'METER'], required: true },
    purchaseRate: { type: Number, required: true, min: 0 },
    gstPercent: { type: Number, min: 0, max: 100, default: 0 },
    returnAmount: { type: Number, required: true, min: 0 },
    stockReduced: { type: Boolean, default: false },
    stockNote: { type: String, trim: true, default: '', maxlength: 250 },
  },
  { _id: false }
);

const purchaseReturnSchema = new mongoose.Schema(
  {
    wholesalerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    supplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', required: true, index: true },
    purchaseBillId: { type: mongoose.Schema.Types.ObjectId, ref: 'PurchaseBill', required: true, index: true },
    returnDate: { type: Date, required: true, index: true },
    items: { type: [purchaseReturnItemSchema], required: true },
    returnAmount: { type: Number, required: true, min: 0 },
    reason: { type: String, enum: ['DAMAGED', 'WRONG_PRODUCT', 'EXCESS_QUANTITY', 'OTHER'], required: true },
    refundStatus: { type: String, enum: ['REFUNDED', 'ADJUSTED', 'PENDING'], required: true },
    refundMode: { type: String, enum: ['CASH', 'UPI', 'CHEQUE', 'BANK_TRANSFER', ''], default: '' },
    notes: { type: String, trim: true, default: '', maxlength: 1000 },
    idempotencyKey: { type: String, required: true, trim: true },
    status: { type: String, enum: ['ACTIVE', 'CANCELLED'], default: 'ACTIVE', index: true },
    cancelledAt: { type: Date, default: null },
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    cancellationReason: { type: String, trim: true, default: '', maxlength: 500 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    auditHistory: {
      type: [{
        action: { type: String, enum: ['CREATED', 'CANCELLED'], required: true },
        actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        at: { type: Date, required: true, default: Date.now },
        reason: { type: String, trim: true, default: '', maxlength: 500 },
      }],
      default: [],
    },
  },
  { timestamps: true }
);

purchaseReturnSchema.index({ wholesalerId: 1, idempotencyKey: 1 }, { unique: true });
purchaseReturnSchema.index({ wholesalerId: 1, supplierId: 1, returnDate: -1 });

module.exports = mongoose.model('PurchaseReturn', purchaseReturnSchema);
