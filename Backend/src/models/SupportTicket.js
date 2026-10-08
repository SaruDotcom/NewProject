const mongoose = require('mongoose');

const ticketMessageSchema = new mongoose.Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    senderRole: {
      type: String,
      required: true,
    },
    senderName: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    attachments: [{ type: String }],
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const supportTicketSchema = new mongoose.Schema(
  {
    ticketNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    creatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    creatorRole: {
      type: String,
      required: true,
      index: true,
    },
    recipientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
    },
    subject: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      enum: [
        'ORDER_ISSUE',
        'PAYMENT_ISSUE',
        'PRODUCT_DEFECT',
        'DELIVERY_DELAY',
        'ACCOUNT_HELP',
        'GENERAL',
        'ORDER',
        'PAYMENT',
        'PRODUCT',
        'DELIVERY',
        'RETURN',
        'OTHER',
      ],
      default: 'GENERAL',
    },
    priority: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
      default: 'MEDIUM',
    },
    status: {
      type: String,
      enum: ['OPEN', 'IN_PROGRESS', 'WAITING_FOR_USER', 'RESOLVED', 'CLOSED'],
      default: 'OPEN',
      index: true,
    },
    messages: [ticketMessageSchema],
    resolvedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

supportTicketSchema.index({ creatorId: 1, status: 1 });

const SupportTicket = mongoose.model('SupportTicket', supportTicketSchema);
module.exports = SupportTicket;
