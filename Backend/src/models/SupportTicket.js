const mongoose = require('mongoose');

const ticketMessageSchema = new mongoose.Schema(
  {
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    senderRole: { type: String },
    senderName: { type: String, default: '' },
    message: { type: String, required: true, trim: true },
    attachments: [{ type: String }],
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const ticketAttachmentSchema = new mongoose.Schema(
  {
    url: { type: String, required: true, trim: true },
    publicId: { type: String, default: '', trim: true },
  },
  { _id: false }
);

const ticketReplySchema = new mongoose.Schema(
  {
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ['WHOLESALER', 'RETAILER', 'SUPER_ADMIN', 'ADMIN'], required: true },
    message: { type: String, required: true, trim: true, maxlength: 5000 },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const createdBySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ['WHOLESALER', 'RETAILER'], required: true },
  },
  { _id: false }
);

const supportTicketSchema = new mongoose.Schema(
  {
    ticketNo: { type: String, unique: true, sparse: true, index: true },
    createdBy: { type: createdBySchema, default: undefined },
    businessName: { type: String, default: '', trim: true },
    contactName: { type: String, default: '', trim: true },
    phone: { type: String, default: '', trim: true },
    email: { type: String, default: '', trim: true, lowercase: true },
    type: {
      type: String,
      enum: ['Issue', 'Request', 'Feedback', 'Payment', 'Order', 'Product', 'KYC', 'Account', 'Other'],
      default: 'Other',
    },
    subject: { type: String, required: true, trim: true, maxlength: 200 },
    message: { type: String, default: '', trim: true, maxlength: 5000 },
    priority: {
      type: String,
      enum: ['Low', 'Medium', 'High', 'LOW', 'MEDIUM', 'HIGH', 'URGENT'],
      default: 'Medium',
      index: true,
    },
    relatedOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
    attachments: { type: [ticketAttachmentSchema], default: [] },
    status: {
      type: String,
      enum: ['Open', 'In Progress', 'Resolved', 'Closed', 'OPEN', 'IN_PROGRESS', 'WAITING_FOR_USER', 'RESOLVED', 'CLOSED'],
      default: 'Open',
      index: true,
    },
    replies: { type: [ticketReplySchema], default: [] },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    unreadForCreator: { type: Boolean, default: false },

    // Legacy fields remain available for existing retailer APIs and records.
    ticketNumber: { type: String, required: true, unique: true, index: true },
    creatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    creatorRole: { type: String, index: true },
    recipientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    category: {
      type: String,
      enum: [
        'ORDER_ISSUE', 'PAYMENT_ISSUE', 'PRODUCT_DEFECT', 'DELIVERY_DELAY', 'ACCOUNT_HELP',
        'GENERAL', 'ORDER', 'PAYMENT', 'PRODUCT', 'DELIVERY', 'RETURN', 'OTHER',
      ],
      default: 'GENERAL',
    },
    messages: { type: [ticketMessageSchema], default: [] },
    resolvedAt: { type: Date },
    isDemo: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

const supportTicketSequenceSchema = new mongoose.Schema(
  { _id: String, sequence: { type: Number, default: 0 } },
  { versionKey: false }
);
const SupportTicketSequence = mongoose.models.SupportTicketSequence
  || mongoose.model('SupportTicketSequence', supportTicketSequenceSchema);

supportTicketSchema.statics.nextTicketNo = async function () {
  const sequence = await SupportTicketSequence.findOneAndUpdate(
    { _id: 'support-ticket' },
    { $inc: { sequence: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  return `TKT-${String(sequence.sequence).padStart(4, '0')}`;
};

supportTicketSchema.pre('validate', async function () {
  if (!this.ticketNo) this.ticketNo = await this.constructor.nextTicketNo();
  if (!this.ticketNumber) this.ticketNumber = this.ticketNo;
});

supportTicketSchema.index({ creatorId: 1, status: 1 });
supportTicketSchema.index({ 'createdBy.userId': 1, createdAt: -1 });
supportTicketSchema.index({ status: 1, priority: 1, createdAt: -1 });

const SupportTicket = mongoose.model('SupportTicket', supportTicketSchema);
module.exports = SupportTicket;
