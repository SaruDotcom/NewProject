const mongoose = require('mongoose');

const inventorySchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      unique: true,
      index: true,
    },
    wholesalerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    available: {
      type: Number,
      default: 0,
      min: [0, 'Available stock cannot be negative'],
    },
    reserved: {
      type: Number,
      default: 0,
      min: [0, 'Reserved stock cannot be negative'],
    },
    sold: {
      type: Number,
      default: 0,
      min: 0,
    },
    damaged: {
      type: Number,
      default: 0,
      min: 0,
    },
    returned: {
      type: Number,
      default: 0,
      min: 0,
    },
    reorderLevel: {
      type: Number,
      default: 10,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

inventorySchema.virtual('totalPhysicalStock').get(function () {
  return this.available + this.reserved;
});

const Inventory = mongoose.model('Inventory', inventorySchema);
module.exports = Inventory;
