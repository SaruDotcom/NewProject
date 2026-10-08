const mongoose = require('mongoose');

const walletSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    ownerType: {
      type: String,
      enum: ['WHOLESALER', 'RETAILER', 'PLATFORM'],
      default: 'WHOLESALER',
    },
    availableBalance: {
      type: Number,
      default: 0,
      min: [0, 'Available balance cannot be negative'],
    },
    pendingBalance: {
      type: Number,
      default: 0,
      min: [0, 'Pending balance cannot be negative'],
    },
    lockedBalance: {
      type: Number,
      default: 0,
      min: [0, 'Locked balance cannot be negative'],
    },
    currency: {
      type: String,
      default: 'INR',
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'FROZEN', 'SUSPENDED'],
      default: 'ACTIVE',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

walletSchema.virtual('totalBalance').get(function () {
  return this.availableBalance + this.pendingBalance + this.lockedBalance;
});

const Wallet = mongoose.model('Wallet', walletSchema);
module.exports = Wallet;
