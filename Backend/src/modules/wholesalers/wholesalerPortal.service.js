const mongoose = require('mongoose');
const {
  User, WholesalerProfile, WholesalerRetailerRelationship, RetailerProfile,
  Inventory, InventoryTransaction, Product, Order, Earning, Payout, SupportTicket,
} = require('../../models');
const { INVENTORY_TRANSACTION_TYPE, RELATIONSHIP_STATUS, ORDER_STATUS, NOTIFICATION_TYPE } = require('../../config/constants');
const { BadRequestError, NotFoundError, ConflictError } = require('../../utils/errors');
const { parsePagination } = require('../../utils/pagination');
const AuditService = require('../../services/audit.service');
const WholesalerReportsService = require('../../services/wholesalerReports.service');

class WholesalerPortalService {
  static formatRetailerRelationship(row) {
    const retailer = row.retailer || row.retailerId || {};
    const profile = row.profile || {};
    const address = profile.address || {};
    return {
      id: String(row._id),
      relationshipId: String(row._id),
      retailerId: String(retailer._id || row.retailerId || ''),
      wholesalerId: String(row.wholesalerId || ''),
      name: retailer.name || profile.ownerName || '',
      contactPerson: profile.ownerName || retailer.name || '',
      email: retailer.email || '',
      loginId: retailer.loginId || '',
      phone: retailer.phone || '',
      businessName: profile.businessName || retailer.name || '',
      businessType: profile.businessType || 'Independent retailer',
      category: profile.category || '',
      gstin: profile.gstin || 'NON-GST',
      gstStatus: profile.gstStatus || 'UNREGISTERED',
      address: address.street || address.addressLine1 || '',
      city: address.city || '',
      state: address.state || '',
      pincode: address.pincode || address.postalCode || '',
      profileComplete: Boolean(profile.profileComplete),
      status: row.status,
      accountStatus: retailer.status || '',
      creditLimit: row.creditLimit || 50000,
      discountPercent: row.discountPercent || 5,
      totalOrdersCount: profile.totalOrdersCount || 0,
      totalSpent: profile.totalPurchaseAmount || 0,
      joinedAt: row.joinedAt || row.createdAt,
      createdAt: row.createdAt,
    };
  }

  static async getProfile(userId) {
    const [user, profile] = await Promise.all([
      User.findById(userId).select('name email phone status createdAt'),
      WholesalerProfile.findOne({ userId, isDeleted: false }),
    ]);
    if (!user || !profile) throw new NotFoundError('Wholesaler profile not found');
    return { user, profile };
  }

  static async updateProfile(userId, payload, actor, req) {
    const allowedUser = ['name', 'phone'];
    const allowedProfile = ['businessName', 'businessLogoUrl', 'description', 'businessType', 'address', 'bankDetails', 'minOrderValue'];
    const userUpdate = Object.fromEntries(allowedUser.filter((key) => payload[key] !== undefined).map((key) => [key, payload[key]]));
    
    if (userUpdate.phone) {
      const normalizedPhone = String(userUpdate.phone).trim();
      const isValidPhone = /^\+?91?\d{10}$|^\d{10}$/.test(normalizedPhone);
      if (!isValidPhone) {
        throw new BadRequestError('Invalid mobile number format. Please provide a valid 10-digit number.', 'INVALID_PHONE');
      }
      
      const phoneExists = await User.findOne({ phone: normalizedPhone, _id: { $ne: userId } });
      if (phoneExists) {
        throw new ConflictError('This mobile number is already registered to another account.', 'PHONE_ALREADY_EXISTS');
      }
      userUpdate.phone = normalizedPhone;
    }

    const profileUpdate = Object.fromEntries(allowedProfile.filter((key) => payload[key] !== undefined).map((key) => [key, payload[key]]));
    if (Object.keys(userUpdate).length) await User.findByIdAndUpdate(userId, userUpdate, { runValidators: true });
    const profile = await WholesalerProfile.findOneAndUpdate({ userId, isDeleted: false }, profileUpdate, { new: true, runValidators: true });
    if (!profile) throw new NotFoundError('Wholesaler profile not found');
    await AuditService.log({ actorId: actor._id, actorRole: actor.role, action: 'UPDATE', entityType: 'WholesalerProfile', entityId: profile._id, metadata: { fields: Object.keys({ ...userUpdate, ...profileUpdate }) }, req });
    return this.getProfile(userId);
  }

  static async listRetailers(userId, query) {
    const { page, limit, skip, sort } = parsePagination(query);
    const filter = { wholesalerId: userId, status: query.status || RELATIONSHIP_STATUS.ACTIVE };
    const pipeline = [
      { $match: filter },
      { $lookup: { from: 'users', localField: 'retailerId', foreignField: '_id', as: 'retailer' } },
      { $unwind: '$retailer' },
      { $lookup: { from: 'retailers', localField: 'retailerId', foreignField: 'userId', as: 'profile' } },
      { $lookup: { from: 'retailerprofiles', localField: 'retailerId', foreignField: 'userId', as: 'legacyProfile' } },
      { $addFields: { profile: { $cond: [{ $gt: [{ $size: '$profile' }, 0] }, '$profile', '$legacyProfile'] } } },
      { $unwind: { path: '$profile', preserveNullAndEmptyArrays: true } },
    ];
    if (query.search) {
      const search = new RegExp(query.search, 'i');
      pipeline.push({ $match: { $or: [{ 'retailer.name': search }, { 'retailer.email': search }, { 'profile.businessName': search }] } });
    }
    pipeline.push({ $sort: { [query.sortBy || 'createdAt']: sort[query.sortBy || 'createdAt'] } }, { $skip: skip }, { $limit: limit });
    const [retailers, count] = await Promise.all([
      WholesalerRetailerRelationship.aggregate(pipeline),
      WholesalerRetailerRelationship.countDocuments(filter),
    ]);
    return {
      retailers: retailers.map((row) => this.formatRetailerRelationship(row)),
      meta: { page, limit, total: count, totalPages: Math.ceil(count / limit) },
    };
  }

  static async getRetailerDetails(userId, relationshipId) {
    if (!mongoose.isValidObjectId(relationshipId)) throw new BadRequestError('Invalid retailer relationship id');
    const relationship = await WholesalerRetailerRelationship.findOne({ _id: relationshipId, wholesalerId: userId })
      .populate('retailerId', 'name email loginId phone status createdAt')
      .lean();
    if (!relationship) throw new NotFoundError('Retailer relationship not found');

    const [profile, orders] = await Promise.all([
      RetailerProfile.findOne({ userId: relationship.retailerId._id }).lean(),
      Order.find({ wholesalerId: userId, retailerId: relationship.retailerId._id })
        .sort({ createdAt: -1 })
        .limit(20)
        .lean(),
    ]);

    return {
      ...this.formatRetailerRelationship({
        ...relationship,
        retailer: relationship.retailerId,
        profile,
      }),
      profile,
      orders,
    };
  }

  static async resetRetailerPassword(userId, relationshipId, password, actor, req) {
    if (!mongoose.isValidObjectId(relationshipId)) throw new BadRequestError('Invalid retailer relationship id');
    const nextPassword = String(password || '').trim();
    if (nextPassword.length < 6) throw new BadRequestError('Password must be at least 6 characters');

    const relationship = await WholesalerRetailerRelationship.findOne({ _id: relationshipId, wholesalerId: userId })
      .populate('retailerId', 'name loginId status')
      .lean();
    if (!relationship || !relationship.retailerId) throw new NotFoundError('Retailer relationship not found');

    const passwordHash = await User.hashPassword(nextPassword);
    await User.findByIdAndUpdate(relationship.retailerId._id, { passwordHash }, { runValidators: true });

    await AuditService.log({
      actorId: actor._id,
      actorRole: actor.role,
      action: 'UPDATE',
      entityType: 'RetailerPassword',
      entityId: relationship.retailerId._id,
      metadata: { relationshipId, loginId: relationship.retailerId.loginId },
      req,
    });

    return {
      relationshipId: String(relationship._id),
      retailerId: String(relationship.retailerId._id),
      loginId: relationship.retailerId.loginId,
      temporaryPassword: nextPassword,
    };
  }

  static async updateRetailerStatus(userId, relationshipId, status, actor, req) {
    if (!mongoose.isValidObjectId(relationshipId)) throw new BadRequestError('Invalid retailer relationship id');
    if (![RELATIONSHIP_STATUS.SUSPENDED, RELATIONSHIP_STATUS.BLOCKED, RELATIONSHIP_STATUS.ACTIVE, RELATIONSHIP_STATUS.TERMINATED].includes(status)) throw new BadRequestError('Invalid relationship status');
    const relationship = await WholesalerRetailerRelationship.findOneAndUpdate({ _id: relationshipId, wholesalerId: userId }, { status }, { new: true });
    if (!relationship) throw new NotFoundError('Retailer relationship not found');
    await AuditService.log({ actorId: actor._id, actorRole: actor.role, action: status, entityType: 'WholesalerRetailerRelationship', entityId: relationship._id, metadata: { retailerId: relationship.retailerId }, req });
    return relationship;
  }

  static async listInventory(userId, query) {
    const { page, limit, skip, sort } = parsePagination(query);
    const filter = { wholesalerId: userId };
    if (query.lowStock === 'true') filter.$expr = { $lte: ['$available', '$reorderLevel'] };
    const [inventory, total] = await Promise.all([
      Inventory.find(filter).populate('productId', 'name sku status images').sort(sort).skip(skip).limit(limit).lean(),
      Inventory.countDocuments(filter),
    ]);
    return { inventory, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  static async adjustInventory(userId, productId, quantity, notes, actor, req) {
    if (!mongoose.isValidObjectId(productId) || !Number.isInteger(quantity) || quantity === 0) throw new BadRequestError('A valid product id and non-zero integer quantity are required');
    const inventory = await Inventory.findOne({ productId, wholesalerId: userId });
    if (!inventory) throw new NotFoundError('Inventory item not found');
    const nextAvailable = inventory.available + quantity;
    if (nextAvailable < 0) throw new BadRequestError('Adjustment would make available stock negative');
    const previousAvailable = inventory.available;
    inventory.available = nextAvailable;
    await inventory.save();
    await Product.findOneAndUpdate({ _id: productId, wholesalerId: userId }, { stock: nextAvailable });
    const transaction = await InventoryTransaction.create({ inventoryId: inventory._id, productId, wholesalerId: userId, type: quantity > 0 ? INVENTORY_TRANSACTION_TYPE.RECEIVE : INVENTORY_TRANSACTION_TYPE.ADJUSTMENT, quantity: Math.abs(quantity), previousAvailable, newAvailable: nextAvailable, referenceType: 'MANUAL_ADJUSTMENT', performedBy: actor._id, notes: notes || '' });
    await AuditService.log({ actorId: actor._id, actorRole: actor.role, action: 'UPDATE', entityType: 'Inventory', entityId: inventory._id, metadata: { quantity, previousAvailable, nextAvailable }, req });
    return { inventory, transaction };
  }

  static async inventoryHistory(userId, productId, query) {
    if (!mongoose.isValidObjectId(productId)) throw new BadRequestError('Invalid product id');
    const { page, limit, skip, sort } = parsePagination(query);
    const filter = { wholesalerId: userId, productId };
    const [transactions, total] = await Promise.all([InventoryTransaction.find(filter).sort(sort).skip(skip).limit(limit).lean(), InventoryTransaction.countDocuments(filter)]);
    return { transactions, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  static async analytics(userId, query) {
    return WholesalerReportsService.getAnalytics(userId, query);
  }

  static async exportAnalyticsCsv(userId, query) {
    return WholesalerReportsService.exportCsv(userId, query);
  }

  static async listPayouts(userId, query) {
    const { page, limit, skip, sort } = parsePagination(query);
    const filter = { wholesalerId: userId };
    if (query.status) filter.status = query.status;
    const [payouts, total] = await Promise.all([Payout.find(filter).sort(sort).skip(skip).limit(limit).lean(), Payout.countDocuments(filter)]);
    return { payouts, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  static async submitHelpRequest(userId, payload) {
    const { subject, message, callbackPhone } = payload;
    if (!message || !String(message).trim()) {
      throw new BadRequestError('Message is required');
    }

    const [user, profile] = await Promise.all([
      User.findById(userId).select('name email phone businessName'),
      WholesalerProfile.findOne({ userId, isDeleted: false }),
    ]);

    const businessName = profile?.businessName || user?.businessName || user?.name || 'Wholesaler';
    const phone = callbackPhone || user?.phone || profile?.phone || '';

    const ticketNumber = `TKT-${Date.now().toString().slice(-6)}`;
    const ticket = await SupportTicket.create({
      ticketNumber,
      creatorId: userId,
      creatorRole: 'WHOLESALER',
      subject: subject?.trim() || 'Super Admin Help Request',
      category: 'ACCOUNT_HELP',
      priority: 'HIGH',
      status: 'OPEN',
      messages: [
        {
          senderId: userId,
          senderRole: 'WHOLESALER',
          senderName: businessName,
          message: String(message).trim(),
        },
      ],
    });

    const NotificationService = require('../../services/notification.service');
    await NotificationService.notifyAdmins({
      title: `Help Center Request: ${businessName}`,
      message: `Wholesaler "${businessName}" (Phone: ${phone || 'N/A'}) submitted a help request: "${subject?.trim() || 'General Issue'}" - ${String(message).trim()}`,
      type: NOTIFICATION_TYPE.SYSTEM_ALERT,
      data: {
        type: 'HELP_REQUEST',
        ticketId: String(ticket._id),
        ticketNumber,
        wholesalerId: String(userId),
        wholesalerName: businessName,
        phone,
        subject: subject?.trim() || 'Super Admin Help Request',
        message: String(message).trim(),
      },
    });

    return ticket;
  }
}
module.exports = WholesalerPortalService;
