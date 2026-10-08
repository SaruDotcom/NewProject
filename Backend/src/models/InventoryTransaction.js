const mongoose = require('mongoose');
const { INVENTORY_TRANSACTION_TYPE } = require('../config/constants');

const inventoryTransactionSchema = new mongoose.Schema(
  {
    inventoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Inventory',
      required: true,
      index: true,
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    wholesalerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: Object.values(INVENTORY_TRANSACTION_TYPE),
      required: true,
      index: true,
    },
    quantity: {
      type: Number,
      required: true,
    },
    previousAvailable: {
      type: Number,
      required: true,
    },
    newAvailable: {
      type: Number,
      required: true,
    },
    referenceType: {
      type: String,
      enum: ['ORDER', 'RESTOCK', 'MANUAL_ADJUSTMENT', 'RETURN', 'DAMAGE', 'CANCELLATION', 'SALE'],
      default: 'MANUAL_ADJUSTMENT',
    },
    referenceId: {
      type: String,
      default: '',
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    notes: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

inventoryTransactionSchema.index({ productId: 1, createdAt: -1 });

const InventoryTransaction = mongoose.model('InventoryTransaction', inventoryTransactionSchema);
module.exports = InventoryTransaction;
