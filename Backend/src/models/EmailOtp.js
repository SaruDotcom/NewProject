const mongoose = require('mongoose');

const emailOtpSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    purpose: {
      type: String,
      enum: ['ENABLE_2FA', 'LOGIN_2FA'],
      required: true,
    },
    codeHash: {
      type: String,
      required: true,
      select: false,
    },
    challengeHash: {
      type: String,
      default: '',
      select: false,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    attempts: {
      type: Number,
      default: 0,
      min: 0,
    },
    sentAt: {
      type: [Date],
      default: [],
    },
    lastSentAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model('EmailOtp', emailOtpSchema);
