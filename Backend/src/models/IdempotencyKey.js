const mongoose = require('mongoose');

const idempotencyKeySchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    requestPath: {
      type: String,
      required: true,
    },
    requestMethod: {
      type: String,
      required: true,
    },
    responseStatus: {
      type: Number,
      required: true,
    },
    responseData: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      expires: 86400, // 24-hour TTL
    },
  },
  {
    timestamps: false,
  }
);

const IdempotencyKey = mongoose.model('IdempotencyKey', idempotencyKeySchema);
module.exports = IdempotencyKey;
