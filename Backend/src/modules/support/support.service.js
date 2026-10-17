const mongoose = require('mongoose');
const {
  SupportTicket,
  User,
  WholesalerProfile,
  RetailerProfile,
  Order,
} = require('../../models');
const { BadRequestError, NotFoundError } = require('../../utils/errors');
const NotificationService = require('../../services/notification.service');
const AuditService = require('../../services/audit.service');
const { AUDIT_ACTION, NOTIFICATION_TYPE } = require('../../config/constants');

const TYPE_BY_CATEGORY = {
  ORDER_ISSUE: 'Order',
  ORDER: 'Order',
  PAYMENT_ISSUE: 'Payment',
  PAYMENT: 'Payment',
  PRODUCT_DEFECT: 'Product',
  PRODUCT: 'Product',
  ACCOUNT_HELP: 'Account',
  GENERAL: 'Other',
  DELIVERY_DELAY: 'Order',
  DELIVERY: 'Order',
  RETURN: 'Order',
  OTHER: 'Other',
};

const CATEGORY_BY_TYPE = {
  Issue: 'GENERAL',
  Request: 'ACCOUNT_HELP',
  Feedback: 'GENERAL',
  Payment: 'PAYMENT',
  Order: 'ORDER',
  Product: 'PRODUCT',
  KYC: 'ACCOUNT_HELP',
  Account: 'ACCOUNT_HELP',
  Other: 'OTHER',
};

function normalizeStatus(status) {
  return ({
    OPEN: 'Open',
    IN_PROGRESS: 'In Progress',
    WAITING_FOR_USER: 'In Progress',
    RESOLVED: 'Resolved',
    CLOSED: 'Closed',
  })[status] || status || 'Open';
}

function normalizePriority(priority) {
  return ({ LOW: 'Low', MEDIUM: 'Medium', HIGH: 'High', URGENT: 'High' })[priority] || priority || 'Medium';
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeTicket(ticket) {
  const value = typeof ticket.toObject === 'function' ? ticket.toObject() : ticket;
  const legacyReplies = (value.messages || []).map((reply) => ({
    by: reply.senderId,
    role: reply.senderRole,
    message: reply.message,
    createdAt: reply.createdAt,
  }));

  return {
    ...value,
    ticketNo: value.ticketNo || value.ticketNumber,
    createdBy: value.createdBy || {
      userId: value.creatorId,
      role: value.creatorRole,
    },
    type: value.type || TYPE_BY_CATEGORY[value.category] || 'Other',
    status: normalizeStatus(value.status),
    priority: normalizePriority(value.priority),
    relatedOrderId: value.relatedOrderId || value.orderId || null,
    replies: value.replies?.length ? value.replies : legacyReplies,
    attachments: value.attachments || [],
    message: value.message || legacyReplies[0]?.message || '',
    unreadForCreator: Boolean(value.unreadForCreator),
  };
}

function buildOwnerFilter(userId, role) {
  return {
    $or: [
      { 'createdBy.userId': userId, 'createdBy.role': role },
      { creatorId: userId, creatorRole: role },
    ],
  };
}

function assertObjectId(value, label = 'Ticket ID') {
  if (!mongoose.Types.ObjectId.isValid(value)) throw new NotFoundError(`${label} not found`);
}

class SupportService {
  static async createTicket(user, input) {
    const profile = user.role === 'WHOLESALER'
      ? (user.wholesalerProfile || await WholesalerProfile.findOne({ userId: user._id }))
      : (user.retailerProfile || await RetailerProfile.findOne({ userId: user._id }));
    const businessName = profile?.businessName || user.businessName || user.name || 'Business';
    const contactName = profile?.ownerName || profile?.contactName || user.name || '';
    const contactPhone = input.callbackPhone?.trim() || user.phone || '';

    if (input.relatedOrderId) {
      const order = await Order.findById(input.relatedOrderId).select('retailerId wholesalerId').lean();
      const isOwner = order && (
        (user.role === 'RETAILER' && String(order.retailerId) === String(user._id))
        || (user.role === 'WHOLESALER' && String(order.wholesalerId) === String(user._id))
      );
      if (!isOwner) throw new NotFoundError('Related order not found');
    }

    const ticketNo = await SupportTicket.nextTicketNo();
    const createdAt = new Date();
    const ticket = await SupportTicket.create({
      ticketNo,
      ticketNumber: ticketNo,
      createdBy: { userId: user._id, role: user.role },
      creatorId: user._id,
      creatorRole: user.role,
      businessName,
      contactName,
      phone: contactPhone,
      email: user.email || '',
      type: input.type,
      subject: input.subject,
      message: input.message,
      priority: input.priority,
      relatedOrderId: input.relatedOrderId || null,
      orderId: input.relatedOrderId || null,
      category: CATEGORY_BY_TYPE[input.type] || 'GENERAL',
      attachments: input.attachments || [],
      status: 'Open',
      replies: [{ by: user._id, role: user.role, message: input.message, createdAt }],
      messages: [{
        senderId: user._id,
        senderRole: user.role,
        senderName: contactName,
        message: input.message,
        attachments: (input.attachments || []).map((attachment) => attachment.url),
        createdAt,
      }],
    });

    await NotificationService.notifySuperAdmins({
      title: `New support ticket ${ticketNo}`,
      message: `${businessName} submitted a ${input.type.toLowerCase()} ticket: ${input.subject}`,
      type: NOTIFICATION_TYPE.SYSTEM_ALERT,
      data: {
        type: 'SUPPORT_TICKET',
        ticketId: String(ticket._id),
        ticketNo,
        role: user.role,
      },
    });

    return normalizeTicket(ticket);
  }

  static async listMine(user) {
    const tickets = await SupportTicket.find(buildOwnerFilter(user._id, user.role))
      .sort({ updatedAt: -1 })
      .lean();
    return tickets.map(normalizeTicket);
  }

  static async getMine(user, ticketId) {
    assertObjectId(ticketId);
    const ticket = await SupportTicket.findOne({
      _id: ticketId,
      ...buildOwnerFilter(user._id, user.role),
    }).populate('replies.by', 'name email role');
    if (!ticket) throw new NotFoundError('Support ticket not found');
    return normalizeTicket(ticket);
  }

  static async markMineRead(user, ticketId) {
    assertObjectId(ticketId);
    const ticket = await SupportTicket.findOneAndUpdate(
      { _id: ticketId, ...buildOwnerFilter(user._id, user.role) },
      { $set: { unreadForCreator: false } },
      { new: true }
    );
    if (!ticket) throw new NotFoundError('Support ticket not found');
    return normalizeTicket(ticket);
  }

  static async replyAsOwner(user, ticketId, message, attachments = []) {
    assertObjectId(ticketId);
    const ticket = await SupportTicket.findOne({
      _id: ticketId,
      ...buildOwnerFilter(user._id, user.role),
    });
    if (!ticket) throw new NotFoundError('Support ticket not found');
    const createdAt = new Date();
    ticket.replies.push({ by: user._id, role: user.role, message, createdAt });
    ticket.messages.push({
      senderId: user._id,
      senderRole: user.role,
      senderName: ticket.contactName || user.name || '',
      message,
      attachments,
      createdAt,
    });
    ticket.unreadForCreator = false;
    await ticket.save();
    return normalizeTicket(ticket);
  }

  static async adminList(query) {
    const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(query.limit, 10) || 20));
    const filters = [];

    if (['WHOLESALER', 'RETAILER'].includes(query.role)) {
      filters.push({ $or: [{ 'createdBy.role': query.role }, { creatorRole: query.role }] });
    }
    if (['Open', 'In Progress', 'Resolved', 'Closed'].includes(query.status)) {
      const legacyStatus = {
        Open: 'OPEN',
        'In Progress': { $in: ['IN_PROGRESS', 'WAITING_FOR_USER'] },
        Resolved: 'RESOLVED',
        Closed: 'CLOSED',
      }[query.status];
      filters.push({ $or: [{ status: query.status }, { status: legacyStatus }] });
    }
    if (['Low', 'Medium', 'High'].includes(query.priority)) {
      const legacyPriority = { Low: 'LOW', Medium: 'MEDIUM', High: { $in: ['HIGH', 'URGENT'] } }[query.priority];
      filters.push({ $or: [{ priority: query.priority }, { priority: legacyPriority }] });
    }
    if (query.type) {
      const legacyCategories = Object.entries(TYPE_BY_CATEGORY)
        .filter(([, type]) => type === query.type)
        .map(([category]) => category);
      filters.push({ $or: [{ type: query.type }, { category: { $in: legacyCategories } }] });
    }
    if (query.startDate || query.endDate) {
      const createdAt = {};
      if (query.startDate) createdAt.$gte = new Date(`${query.startDate}T00:00:00.000Z`);
      if (query.endDate) createdAt.$lte = new Date(`${query.endDate}T23:59:59.999Z`);
      filters.push({ createdAt });
    }
    if (query.search?.trim()) {
      const pattern = new RegExp(escapeRegex(query.search.trim()), 'i');
      filters.push({
        $or: [
          { ticketNo: pattern },
          { ticketNumber: pattern },
          { businessName: pattern },
          { subject: pattern },
        ],
      });
    }

    const filter = filters.length ? { $and: filters } : {};
    const [tickets, total, grouped] = await Promise.all([
      SupportTicket.find(filter)
        .populate('assignedTo', 'name email role')
        .populate('relatedOrderId', 'orderNumber')
        .sort({ updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      SupportTicket.countDocuments(filter),
      SupportTicket.aggregate([{ $group: { _id: { status: '$status', priority: '$priority' }, count: { $sum: 1 } } }]),
    ]);

    const stats = { total: 0, open: 0, inProgress: 0, resolved: 0, highPriority: 0 };
    const allCount = await SupportTicket.countDocuments({});
    stats.total = allCount;
    grouped.forEach(({ _id, count }) => {
      const status = normalizeStatus(_id.status);
      const priority = normalizePriority(_id.priority);
      if (status === 'Open') stats.open += count;
      if (status === 'In Progress') stats.inProgress += count;
      if (status === 'Resolved') stats.resolved += count;
      if (priority === 'High') stats.highPriority += count;
    });

    const adminUsers = await User.find({ role: { $in: ['SUPER_ADMIN', 'ADMIN'] }, isDeleted: { $ne: true } })
      .select('name email role')
      .sort({ name: 1 })
      .lean();

    return {
      items: tickets.map(normalizeTicket),
      stats,
      admins: adminUsers,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  static async getAdminTicket(ticketId) {
    assertObjectId(ticketId);
    const ticket = await SupportTicket.findById(ticketId)
      .populate('assignedTo', 'name email role')
      .populate('relatedOrderId', 'orderNumber')
      .populate('replies.by', 'name email role');
    if (!ticket) throw new NotFoundError('Support ticket not found');
    return normalizeTicket(ticket);
  }

  static async updateAsAdmin(adminUser, ticketId, update, req) {
    assertObjectId(ticketId);
    const ticket = await SupportTicket.findById(ticketId);
    if (!ticket) throw new NotFoundError('Support ticket not found');
    const before = normalizeTicket(ticket);

    if (update.assignedTo) {
      const assignee = await User.findOne({
        _id: update.assignedTo,
        role: { $in: ['SUPER_ADMIN', 'ADMIN'] },
        isDeleted: { $ne: true },
      }).select('_id');
      if (!assignee) throw new BadRequestError('Assigned user must be an active administrator');
    }
    if (update.status) {
      ticket.status = update.status;
      ticket.resolvedAt = update.status === 'Resolved' ? new Date() : undefined;
    }
    if (update.priority) ticket.priority = update.priority;
    if (Object.prototype.hasOwnProperty.call(update, 'assignedTo')) {
      ticket.assignedTo = update.assignedTo || null;
    }

    const statusChanged = before.status !== normalizeStatus(ticket.status);
    if (statusChanged) ticket.unreadForCreator = true;
    await ticket.save();
    const after = normalizeTicket(ticket);
    await AuditService.log({
      actorId: adminUser._id,
      actorRole: adminUser.role,
      actorEmail: adminUser.email,
      action: AUDIT_ACTION.UPDATE,
      entityType: 'SUPPORT_TICKET',
      entityId: ticket._id,
      before,
      after,
      metadata: { operation: 'UPDATE_SUPPORT_TICKET' },
      req,
    });

    if (statusChanged) {
      await NotificationService.notify({
        recipientId: ticket.createdBy?.userId || ticket.creatorId,
        title: `Support ticket ${after.ticketNo} status updated`,
        message: `Your ticket status is now ${after.status}.`,
        type: NOTIFICATION_TYPE.SYSTEM_ALERT,
        data: { type: 'SUPPORT_TICKET_STATUS', ticketId: String(ticket._id), ticketNo: after.ticketNo, status: after.status },
      });
    }

    return { before, ticket: after };
  }

  static async replyAsAdmin(user, ticketId, message, req) {
    assertObjectId(ticketId);
    const ticket = await SupportTicket.findById(ticketId);
    if (!ticket) throw new NotFoundError('Support ticket not found');
    const before = normalizeTicket(ticket);
    const createdAt = new Date();
    ticket.replies.push({ by: user._id, role: user.role, message, createdAt });
    ticket.messages.push({
      senderId: user._id,
      senderRole: user.role,
      senderName: user.name || 'Support',
      message,
      createdAt,
    });
    ticket.unreadForCreator = true;
    await ticket.save();
    const after = normalizeTicket(ticket);

    await AuditService.log({
      actorId: user._id,
      actorRole: user.role,
      actorEmail: user.email,
      action: AUDIT_ACTION.UPDATE,
      entityType: 'SUPPORT_TICKET',
      entityId: ticket._id,
      before,
      after,
      metadata: { operation: 'REPLY_TO_SUPPORT_TICKET' },
      req,
    });
    await NotificationService.notify({
      recipientId: ticket.createdBy?.userId || ticket.creatorId,
      title: `New reply on support ticket ${after.ticketNo}`,
      message: 'The Super Admin team replied to your support ticket.',
      type: NOTIFICATION_TYPE.SYSTEM_ALERT,
      data: { type: 'SUPPORT_TICKET_REPLY', ticketId: String(ticket._id), ticketNo: after.ticketNo },
    });
    return after;
  }
}

module.exports = SupportService;
