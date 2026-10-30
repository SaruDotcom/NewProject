const mongoose = require('mongoose');
const {
  User,
  WholesalerProfile,
  RetailerProfile,
  KycApplication,
  KycDocument,
  WholesalerRetailerRelationship,
  Category,
  Product,
  Inventory,
  InventoryTransaction,
  Order,
  Payment,
  PaymentTransaction,
  Refund,
  RetailerCheckoutPayment,
  Return,
  Earning,
  Payout,
  AuditLog,
  Wallet,
  WalletTransaction,
  Coupon,
  Invitation,
  WholesalerInvite,
  WholesalerSubscription,
  SubscriptionPayment,
  Address,
  Cart,
  Wishlist,
  Review,
  SupportTicket,
  Notification,
  RefreshToken,
  EmailOtp,
  IdempotencyKey,
} = require('../../models');
const { ROLES, USER_STATUS, KYC_STATUS, AUDIT_ACTION } = require('../../config/constants');
const { NotFoundError, BadRequestError, ForbiddenError } = require('../../utils/errors');
const { parsePagination } = require('../../utils/pagination');
const AuditService = require('../../services/audit.service');
const NotificationService = require('../../services/notification.service');
const { deleteUploadedProductImage } = require('../../services/cloudinary.service');

const collectProductImageIds = (value, ids = new Set()) => {
  if (Array.isArray(value)) {
    value.forEach((item) => collectProductImageIds(item, ids));
  } else if (value && typeof value === 'object') {
    if (typeof value.publicId === 'string' && value.publicId) ids.add(value.publicId);
    if (typeof value.url === 'string') collectProductImageIds(value.url, ids);
  } else if (typeof value === 'string') {
    const gridFsId = value.match(/\/product-images\/([a-f\d]{24})(?:[/?#]|$)/i)?.[1];
    if (gridFsId) ids.add(gridFsId);
  }
  return ids;
};

class WholesalerService {
  static normalizeStatus(status) {
    if (!status) return undefined;
    const normalized = String(status).toUpperCase();
    if (normalized === 'ACTIVE') return USER_STATUS.ACTIVE;
    if (normalized === 'PENDING') return USER_STATUS.PENDING;
    if (normalized === 'BLOCKED') return USER_STATUS.BLOCKED;
    if (normalized === 'SUSPENDED') return USER_STATUS.SUSPENDED;
    if (normalized === 'DELETED') return USER_STATUS.DELETED;
    return status;
  }

  static normalizeKycStatus(status) {
    if (!status) return undefined;
    const normalized = String(status).toUpperCase();
    return Object.values(KYC_STATUS).includes(normalized) ? normalized : status;
  }

  static mapWholesaler(profile, aggregates = {}) {
    const user = profile.userId || {};
    const address = profile.address || {};
    return {
      id: String(profile._id),
      profileId: String(profile._id),
      userId: user._id ? String(user._id) : String(profile.userId || ''),
      name: user.name || profile.registrationDetails?.ownerName || '',
      businessName: profile.businessName || '',
      email: user.email || profile.registrationDetails?.email || '',
      phone: user.phone || profile.registrationDetails?.phone || '',
      status: user.status || '',
      kycStatus: profile.kycStatus || '',
      registrationSource: profile.registrationSource || 'DIRECT',
      gstStatus: profile.gstStatus || '',
      gstin: profile.gstin || '',
      businessType: profile.businessType || '',
      description: profile.description || '',
      streetAddress: address.street || '',
      city: address.city || '',
      state: address.state || '',
      pincode: address.pincode || '',
      address,
      pickupAddress: profile.pickupAddress || {},
      registrationDetails: profile.registrationDetails || {},
      wallet: profile.walletId || null,
      isVerified: Boolean(profile.isVerified),
      commissionRate: profile.commissionRate,
      minOrderValue: profile.minOrderValue,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
      lastLoginAt: user.lastLoginAt || null,
      totalConnectedRetailers: aggregates.totalConnectedRetailers || 0,
      totalOrders: aggregates.totalOrders || 0,
      totalSalesAmount: aggregates.totalSalesAmount || 0,
    };
  }

  /**
   * List all wholesalers with search, filters, pagination
   */
  static async listWholesalers(query = {}) {
    const { page, limit, skip, sort } = parsePagination(query);
    const filter = { isDeleted: false };
    const userFilter = {};

    if (query.kycStatus) {
      filter.kycStatus = this.normalizeKycStatus(query.kycStatus);
    }

    if (query.city) {
      filter['address.city'] = new RegExp(query.city, 'i');
    }

    if (query.state) {
      filter['address.state'] = new RegExp(query.state, 'i');
    }

    if (query.dateFrom || query.dateTo) {
      filter.createdAt = {};
      if (query.dateFrom) filter.createdAt.$gte = new Date(query.dateFrom);
      if (query.dateTo) filter.createdAt.$lte = new Date(query.dateTo);
    }

    if (query.status) {
      userFilter.status = this.normalizeStatus(query.status);
    }

    const allWholesalers = await WholesalerProfile.find(filter)
      .populate('userId', 'name email phone status createdAt lastLoginAt')
      .populate('walletId', 'availableBalance pendingBalance lockedBalance')
      .sort(sort)
      .lean();

    let filtered = Object.keys(userFilter).length
      ? allWholesalers.filter((w) => w.userId?.status === userFilter.status)
      : allWholesalers;

    if (query.search) {
      const search = String(query.search).toLowerCase();
      filtered = filtered.filter((w) => [
        w.businessName,
        w.gstin,
        w.pan,
        w.address?.city,
        w.address?.state,
        w.userId?.name,
        w.userId?.email,
        w.userId?.phone,
      ].some((value) => String(value || '').toLowerCase().includes(search)));
    }

    const pageItems = filtered.slice(skip, skip + limit);
    const userIds = pageItems.map((w) => w.userId?._id || w.userId).filter(Boolean);
    const [retailerCounts, orderStats] = await Promise.all([
      WholesalerRetailerRelationship.aggregate([
        { $match: { wholesalerId: { $in: userIds }, status: 'ACTIVE' } },
        { $group: { _id: '$wholesalerId', count: { $sum: 1 } } },
      ]),
      Order.aggregate([
        { $match: { wholesalerId: { $in: userIds } } },
        { $group: { _id: '$wholesalerId', count: { $sum: 1 }, totalSalesAmount: { $sum: '$totalAmount' } } },
      ]),
    ]);

    const retailerMap = new Map(retailerCounts.map((row) => [String(row._id), row.count]));
    const orderMap = new Map(orderStats.map((row) => [String(row._id), row]));
    const items = pageItems.map((w) => {
      const id = String(w.userId?._id || w.userId);
      const orders = orderMap.get(id) || {};
      return this.mapWholesaler(w, {
        totalConnectedRetailers: retailerMap.get(id) || 0,
        totalOrders: orders.count || 0,
        totalSalesAmount: orders.totalSalesAmount || 0,
      });
    });

    return {
      wholesalers: items,
      meta: {
        page,
        limit,
        total: filtered.length,
        totalPages: Math.ceil(filtered.length / limit),
      },
      filters: {
        cities: [...new Set(allWholesalers.map((w) => w.address?.city).filter(Boolean))].sort(),
        states: [...new Set(allWholesalers.map((w) => w.address?.state).filter(Boolean))].sort(),
      },
    };
  }

  /**
   * Get single wholesaler full 360-degree profile
   */
  static async getWholesalerById(wholesalerId) {
    let profile = await WholesalerProfile.findById(wholesalerId)
      .populate('userId', 'name email phone status createdAt lastLoginAt lastLoginIp')
      .populate('walletId');

    // Also support finding by user ID
    if (!profile) {
      profile = await WholesalerProfile.findOne({ userId: wholesalerId })
        .populate('userId', 'name email phone status createdAt lastLoginAt lastLoginIp')
        .populate('walletId');
    }

    if (!profile || profile.isDeleted) {
      throw new NotFoundError('Wholesaler not found');
    }

    const userId = profile.userId?._id || profile.userId;

    // Fetch related aggregated stats
    const [kycApplication, retailersCount, productsCount, ordersCount, earningsSum, recentAudit, connectedRetailers, products, recentOrders] =
      await Promise.all([
        KycApplication.findOne({ wholesalerId: userId }).populate('documents'),
        WholesalerRetailerRelationship.countDocuments({ wholesalerId: userId, status: 'ACTIVE' }),
        Product.countDocuments({ wholesalerId: userId, isDeleted: false }),
        Order.countDocuments({ wholesalerId: userId }),
        Earning.aggregate([
          { $match: { wholesalerId: userId } },
          {
            $group: {
              _id: null,
              totalGross: { $sum: '$grossAmount' },
              totalNet: { $sum: '$wholesalerAmount' },
              totalCommission: { $sum: '$platformCommission' },
            },
          },
        ]),
        AuditLog.find({
          $or: [{ entityId: String(userId) }, { entityId: String(profile._id) }, { actorId: userId }],
        })
          .sort({ createdAt: -1 })
          .limit(10),
        WholesalerRetailerRelationship.find({ wholesalerId: userId })
          .populate('retailerId', 'name email phone status createdAt')
          .lean(),
        Product.find({ wholesalerId: userId, isDeleted: false })
          .populate('categoryId', 'name')
          .sort({ createdAt: -1 })
          .limit(20)
          .lean(),
        Order.find({ wholesalerId: userId })
          .populate('retailerId', 'name email phone status')
          .sort({ createdAt: -1 })
          .limit(10)
          .lean(),
      ]);

    return {
      profile: this.mapWholesaler(profile.toObject ? profile.toObject() : profile, {
        totalConnectedRetailers: retailersCount,
        totalOrders: ordersCount,
        totalSalesAmount: earningsSum[0]?.totalGross || 0,
      }),
      kycApplication,
      connectedRetailers: connectedRetailers.map((rel) => ({
        id: String(rel.retailerId?._id || rel.retailerId),
        name: rel.retailerId?.name || '',
        email: rel.retailerId?.email || '',
        phone: rel.retailerId?.phone || '',
        status: rel.status,
        createdAt: rel.createdAt,
      })),
      products: products.map((product) => ({
        ...product,
        id: String(product._id),
        category: product.categoryId,
      })),
      recentOrders: recentOrders.map((order) => ({
        ...order,
        id: String(order._id),
        retailer: order.retailerId,
      })),
      paymentSummary: [],
      metrics: {
        connectedRetailers: retailersCount,
        totalProducts: productsCount,
        totalOrders: ordersCount,
        earnings: earningsSum[0] || { totalGross: 0, totalNet: 0, totalCommission: 0 },
      },
      auditHistory: recentAudit,
    };
  }

  /**
   * Admin updates wholesaler details
   */
  static async updateWholesaler(wholesalerId, updateData, adminUser, req = null) {
    let profile = await WholesalerProfile.findById(wholesalerId);
    if (!profile) {
      profile = await WholesalerProfile.findOne({ userId: wholesalerId });
    }
    if (!profile || profile.isDeleted) {
      throw new NotFoundError('Wholesaler not found');
    }

    const beforeState = profile.toJSON();

    if (updateData.businessName) profile.businessName = updateData.businessName;
    if (updateData.description !== undefined) profile.description = updateData.description;
    if (updateData.commissionRate !== undefined) profile.commissionRate = Number(updateData.commissionRate);
    if (updateData.minOrderValue !== undefined) profile.minOrderValue = Number(updateData.minOrderValue);
    if (updateData.gstin !== undefined) profile.gstin = updateData.gstin;
    if (updateData.businessType !== undefined) profile.businessType = updateData.businessType;
    if (updateData.gstStatus !== undefined) profile.gstStatus = updateData.gstStatus;

    if (updateData.address && typeof updateData.address === 'object') {
      profile.address = { ...profile.address, ...updateData.address };
    }
    if (updateData.street || updateData.city || updateData.state || updateData.pincode) {
      profile.address = {
        ...profile.address,
        ...(updateData.street ? { street: updateData.street } : {}),
        ...(updateData.city ? { city: updateData.city } : {}),
        ...(updateData.state ? { state: updateData.state } : {}),
        ...(updateData.pincode ? { pincode: updateData.pincode } : {}),
      };
    }
    if (updateData.bankDetails) profile.bankDetails = { ...profile.bankDetails, ...updateData.bankDetails };

    await profile.save();

    if (profile.userId) {
      const user = await User.findById(profile.userId);
      if (user) {
        if (updateData.name) user.name = updateData.name;
        if (updateData.ownerName) user.name = updateData.ownerName;
        if (updateData.email) user.email = updateData.email;
        if (updateData.phone) user.phone = updateData.phone;
        await user.save();
      }
    }

    await AuditService.log({
      actorId: adminUser._id,
      actorRole: adminUser.role,
      action: AUDIT_ACTION.UPDATE,
      entityType: 'WholesalerProfile',
      entityId: profile._id,
      before: beforeState,
      after: profile.toJSON(),
      req,
    });

    return profile;
  }

  /**
   * Admin updates wholesaler account/KYC status
   */
  static async updateStatus(wholesalerId, { status, kycStatus, reason }, adminUser, req = null) {
    let profile = await WholesalerProfile.findById(wholesalerId).populate('userId');
    if (!profile) {
      profile = await WholesalerProfile.findOne({ userId: wholesalerId }).populate('userId');
    }
    if (!profile || profile.isDeleted) {
      throw new NotFoundError('Wholesaler not found');
    }

    const user = profile.userId;
    const normalizedStatus = this.normalizeStatus(status);
    if (
      status !== undefined &&
      (normalizedStatus === USER_STATUS.BLOCKED || user?.status === USER_STATUS.BLOCKED)
    ) {
      throw new ForbiddenError('Use the Super Admin block/unblock operation to change a blocked wholesaler account.');
    }

    const beforeState = { userStatus: user?.status, kycStatus: profile.kycStatus };

    if (status && user) {
      user.status = normalizedStatus;
      await user.save();
    }

    if (kycStatus) {
      profile.kycStatus = this.normalizeKycStatus(kycStatus);
      profile.isVerified = profile.kycStatus === KYC_STATUS.APPROVED;
      await profile.save();
    }

    await AuditService.log({
      actorId: adminUser._id,
      actorRole: adminUser.role,
      action: AUDIT_ACTION.USER_STATUS_CHANGED,
      entityType: 'Wholesaler',
      entityId: profile._id,
      before: beforeState,
      after: { userStatus: user?.status, kycStatus: profile.kycStatus, reason },
      metadata: { reason },
      req,
    });

    await NotificationService.notify({
      recipientId: user._id,
      title: 'Wholesaler Account Status Updated',
      message: `Your wholesaler status has been updated to ${status || profile.kycStatus}.${reason ? ` Reason: ${reason}` : ''}`,
      data: { status, kycStatus, reason },
    });

    return { profile, user };
  }

  static async setBlocked(wholesalerId, blocked, adminUser, req = null) {
    if (adminUser?.role !== ROLES.SUPER_ADMIN) {
      throw new ForbiddenError('Only a Super Admin can block or unblock a wholesaler.');
    }
    if (typeof blocked !== 'boolean') {
      throw new BadRequestError('The blocked field must be true or false.');
    }

    let profile = await WholesalerProfile.findById(wholesalerId).populate('userId');
    if (!profile) {
      profile = await WholesalerProfile.findOne({ userId: wholesalerId }).populate('userId');
    }
    if (!profile || profile.isDeleted || !profile.userId) {
      throw new NotFoundError('Wholesaler not found');
    }

    const user = profile.userId;
    const expectedStatus = blocked ? USER_STATUS.ACTIVE : USER_STATUS.BLOCKED;
    if (user.status !== expectedStatus) {
      throw new BadRequestError(
        blocked
          ? 'Only an active wholesaler can be blocked.'
          : 'Only a blocked wholesaler can be unblocked.'
      );
    }

    const beforeState = { userStatus: user.status, kycStatus: profile.kycStatus };
    user.status = blocked ? USER_STATUS.BLOCKED : USER_STATUS.ACTIVE;
    await user.save();

    await AuditService.log({
      actorId: adminUser._id,
      actorRole: adminUser.role,
      action: AUDIT_ACTION.USER_STATUS_CHANGED,
      entityType: 'Wholesaler',
      entityId: profile._id,
      before: beforeState,
      after: { userStatus: user.status, kycStatus: profile.kycStatus },
      metadata: { reason: blocked ? 'Blocked by Super Admin' : 'Unblocked by Super Admin' },
      req,
    });

    await NotificationService.notify({
      recipientId: user._id,
      title: blocked ? 'Wholesaler Account Blocked' : 'Wholesaler Account Unblocked',
      message: blocked
        ? 'Your account has been blocked by a Super Admin.'
        : 'Your account has been unblocked and is active again.',
      data: { status: user.status },
    });

    return {
      profile,
      user,
      message: blocked ? 'Wholesaler blocked successfully.' : 'Wholesaler unblocked successfully.',
    };
  }

  /**
   * Permanently remove a wholesaler and records owned by that account.
   * Retailer accounts and shared/global categories are intentionally preserved.
   */
  static async deleteWholesaler(wholesalerId, adminUser, req = null) {
    if (adminUser?.role !== ROLES.SUPER_ADMIN) {
      throw new ForbiddenError('Only a Super Admin can permanently delete a wholesaler');
    }
    if (!mongoose.Types.ObjectId.isValid(wholesalerId)) {
      throw new BadRequestError('A valid wholesaler ID is required');
    }

    const session = await mongoose.startSession();
    const imageIds = new Set();
    let deletionSummary;

    try {
      await session.withTransaction(async () => {
        let profile = await WholesalerProfile.findById(wholesalerId).session(session);
        if (!profile) {
          profile = await WholesalerProfile.findOne({ userId: wholesalerId }).session(session);
        }
        if (!profile) throw new NotFoundError('Wholesaler not found');

        const userId = profile.userId;
        const user = await User.findOne({ _id: userId, role: ROLES.WHOLESALER }).session(session);
        if (!user) throw new NotFoundError('Wholesaler account not found');
        collectProductImageIds(profile.businessLogoUrl, imageIds);
        collectProductImageIds(profile.promotionalBanners, imageIds);

        const products = await Product.find({ wholesalerId: userId })
          .select('_id images imageUrl colorVariants').session(session).lean();
        const orders = await Order.find({ wholesalerId: userId }).select('_id retailerId').session(session).lean();
        const orderIds = orders.map((order) => order._id);
        const payments = await Payment.find({
          $or: [{ wholesalerId: userId }, { orderId: { $in: orderIds } }],
        }).select('_id').session(session).lean();
        const categories = await Category.find({ wholesalerId: userId }).select('_id').session(session).lean();
        const productIds = products.map((product) => product._id);
        const paymentIds = payments.map((payment) => payment._id);
        const categoryIds = categories.map((category) => category._id);
        const relationships = await WholesalerRetailerRelationship.find({ wholesalerId: userId })
          .select('_id retailerId').session(session).lean();
        const walletIds = (await Wallet.find({ ownerId: userId, ownerType: 'WHOLESALER' })
          .select('_id').session(session).lean()).map((wallet) => wallet._id);
        const affectedRetailerIds = [...new Set([
          ...orders.map((order) => String(order.retailerId)),
          ...relationships.map((relationship) => String(relationship.retailerId)),
        ])].filter(Boolean);

        products.forEach((product) => {
          collectProductImageIds(product.images, imageIds);
          collectProductImageIds(product.imageUrl, imageIds);
          collectProductImageIds(product.colorVariants, imageIds);
        });

        deletionSummary = {};
        const remove = async (label, Model, filter) => {
          const result = await Model.deleteMany(filter).session(session);
          deletionSummary[label] = result.deletedCount || 0;
        };

        if (productIds.length > 0) {
          const carts = await Cart.find({ 'items.productId': { $in: productIds } }).session(session);
          for (const cart of carts) {
            cart.items = cart.items.filter((item) => !productIds.some((id) => String(id) === String(item.productId)));
            cart.subtotal = cart.items.reduce((sum, item) => sum + Number(item.subtotal || 0), 0);
            cart.tax = cart.items.reduce((sum, item) => sum + Number(item.gstAmount || 0), 0);
            cart.grandTotal = cart.items.reduce((sum, item) => sum + Number(item.total || 0), 0);
            if (String(cart.wholesalerId || '') === String(userId)) {
              cart.wholesalerId = null;
            }
            await cart.save({ session });
          }
          await Wishlist.updateMany(
            { products: { $in: productIds } },
            { $pull: { products: { $in: productIds } } },
            { session },
          );
        }

        if (categoryIds.length > 0) {
          await Category.updateMany(
            {
              wholesalerId: { $ne: userId },
              $or: [
                { parentId: { $in: categoryIds } },
                { parentCategoryId: { $in: categoryIds } },
              ],
            },
            { $set: { parentId: null, parentCategoryId: null, level: 1 } },
            { session },
          );
        }

        const orderPaymentFilter = [
          ...(orderIds.length ? [{ orderId: { $in: orderIds } }] : []),
          ...(paymentIds.length ? [{ paymentId: { $in: paymentIds } }] : []),
        ];
        if (orderPaymentFilter.length > 0) {
          await remove('refunds', Refund, { $or: orderPaymentFilter });
          await remove('paymentTransactions', PaymentTransaction, { $or: orderPaymentFilter });
        } else {
          deletionSummary.refunds = 0;
          deletionSummary.paymentTransactions = 0;
        }
        await remove('retailerCheckoutPayments', RetailerCheckoutPayment, {
          $or: [
            { wholesalerId: userId },
            ...(orderIds.length ? [{ orderId: { $in: orderIds } }] : []),
          ],
        });
        await remove('returns', Return, {
          $or: [
            { wholesalerId: userId },
            ...(orderIds.length ? [{ orderId: { $in: orderIds } }] : []),
          ],
        });
        await remove('supportTickets', SupportTicket, {
          $or: [
            { 'createdBy.userId': userId },
            { creatorId: userId },
            { recipientId: userId },
            ...(orderIds.length ? [
              { orderId: { $in: orderIds } },
              { relatedOrderId: { $in: orderIds } },
            ] : []),
          ],
        });
        await SupportTicket.updateMany(
          {
            $or: [
              { 'replies.by': userId },
              { 'messages.senderId': userId },
              { assignedTo: userId },
            ],
          },
          {
            $pull: {
              replies: { by: userId },
              messages: { senderId: userId },
            },
            $set: { assignedTo: null },
          },
          { session },
        );
        await remove('reviews', Review, {
          $or: [
            { wholesalerId: userId },
            { userId },
            ...(productIds.length ? [{ productId: { $in: productIds } }] : []),
          ],
        });
        await remove('inventoryTransactions', InventoryTransaction, {
          $or: [
            { wholesalerId: userId },
            ...(productIds.length ? [{ productId: { $in: productIds } }] : []),
          ],
        });
        await remove('inventory', Inventory, {
          $or: [
            { wholesalerId: userId },
            ...(productIds.length ? [{ productId: { $in: productIds } }] : []),
          ],
        });
        await remove('earnings', Earning, { wholesalerId: userId });
        await remove('payouts', Payout, { wholesalerId: userId });
        await remove('payments', Payment, {
          $or: [
            { wholesalerId: userId },
            ...(paymentIds.length ? [{ _id: { $in: paymentIds } }] : []),
          ],
        });
        if (orderIds.length > 0) {
          await Payment.updateMany(
            { wholesalerId: { $ne: userId }, relatedOrderIds: { $in: orderIds } },
            { $pull: { relatedOrderIds: { $in: orderIds } } },
            { session },
          );
        }
        await remove('orders', Order, { wholesalerId: userId });
        await remove('coupons', Coupon, { wholesalerId: userId });
        await remove('relationships', WholesalerRetailerRelationship, { _id: { $in: relationships.map((item) => item._id) } });
        if (affectedRetailerIds.length > 0) {
          const relationshipIdSet = new Set(relationshipIds.map(String));
          const retailerProfiles = await RetailerProfile.find({ userId: { $in: affectedRetailerIds } }).session(session);
          for (const retailerProfile of retailerProfiles) {
            const wasAssignedToDeletedWholesaler =
              String(retailerProfile.assignedWholesalerId || '') === String(userId) ||
              String(retailerProfile.wholesalerId || '') === String(userId);
            if (String(retailerProfile.assignedWholesalerId || '') === String(userId)) {
              retailerProfile.assignedWholesalerId = undefined;
            }
            if (String(retailerProfile.wholesalerId || '') === String(userId)) {
              retailerProfile.wholesalerId = undefined;
            }
            if (String(retailerProfile.createdByWholesalerId || '') === String(userId)) {
              retailerProfile.createdByWholesalerId = undefined;
            }
            if (relationshipIdSet.has(String(retailerProfile.activeRelationshipId || ''))) {
              retailerProfile.activeRelationshipId = undefined;
            }
            if (wasAssignedToDeletedWholesaler) {
              retailerProfile.wholesalerInfo = { businessName: '', ownerName: '', email: '', phone: '' };
            }
            await retailerProfile.save({ session });
          }
          for (const retailerId of affectedRetailerIds) {
            const [purchaseSummary] = await Order.aggregate([
              { $match: { retailerId: new mongoose.Types.ObjectId(retailerId) } },
              {
                $group: {
                  _id: null,
                  totalPurchaseAmount: { $sum: '$grandTotal' },
                  totalOrdersCount: { $sum: 1 },
                  lastOrderAt: { $max: '$createdAt' },
                },
              },
            ]).session(session);
            await RetailerProfile.updateOne(
              { userId: retailerId },
              {
                $set: {
                  totalPurchaseAmount: purchaseSummary?.totalPurchaseAmount || 0,
                  totalOrdersCount: purchaseSummary?.totalOrdersCount || 0,
                  lastOrderAt: purchaseSummary?.lastOrderAt || null,
                },
              },
              { session },
            );
          }
        }
        await remove('wholesalerInvites', WholesalerInvite, {
          $or: [{ wholesalerId: userId }, { createdBy: userId }],
        });
        await remove('invitations', Invitation, {
          $or: [{ wholesalerId: userId }, { createdBy: userId }],
        });
        await remove('subscriptionPayments', SubscriptionPayment, { userId });
        await remove('subscriptions', WholesalerSubscription, { userId });
        await remove('notifications', Notification, { recipientId: userId });
        await remove('addresses', Address, { userId });
        await remove('emailOtps', EmailOtp, { userId });
        await remove('refreshTokens', RefreshToken, { userId });
        await remove('idempotencyKeys', IdempotencyKey, { userId });
        await remove('walletTransactions', WalletTransaction, {
          $or: [
            { ownerId: userId },
            ...(walletIds.length ? [{ walletId: { $in: walletIds } }] : []),
          ],
        });
        await remove('wallets', Wallet, { ownerId: userId, ownerType: 'WHOLESALER' });
        await remove('kycApplications', KycApplication, { wholesalerId: userId });
        await remove('kycDocuments', KycDocument, { wholesalerId: userId });
        await remove('products', Product, { wholesalerId: userId });
        await remove('categories', Category, { wholesalerId: userId });
        await remove('wholesalerProfiles', WholesalerProfile, { _id: profile._id });
        await remove('users', User, { _id: userId, role: ROLES.WHOLESALER });

        await AuditLog.create([{
          actorId: adminUser._id,
          actorRole: adminUser.role,
          action: AUDIT_ACTION.DELETE,
          entityType: 'Wholesaler',
          entityId: String(userId),
          before: { businessName: profile.businessName },
          metadata: { deletionSummary },
          ipAddress: req?.ip || '',
          userAgent: req?.get?.('user-agent') || '',
        }], { session });
      });
    } finally {
      await session.endSession();
    }

    const imageCleanupFailures = [];
    let sharedImageCount = 0;
    for (const imageId of imageIds) {
      try {
        const escapedImageId = imageId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const imageReferencePattern = new RegExp(escapedImageId);
        const sharedReference = await Promise.all([
          Product.exists({
            $or: [
              { 'images.publicId': imageId },
              { 'colorVariants.images.publicId': imageId },
              { 'images.url': imageReferencePattern },
              { imageUrl: imageReferencePattern },
            ],
          }),
          WholesalerProfile.exists({
            $or: [
              { businessLogoUrl: imageReferencePattern },
              { 'promotionalBanners.imageUrl': imageReferencePattern },
            ],
          }),
          Category.exists({ imageUrl: imageReferencePattern }),
        ]);
        if (sharedReference.some(Boolean)) {
          sharedImageCount += 1;
          continue;
        }
        await deleteUploadedProductImage(imageId);
      } catch (error) {
        imageCleanupFailures.push({ imageId, message: error.message });
      }
    }

    return {
      message: imageCleanupFailures.length
        ? `Wholesaler and associated records were deleted, but ${imageCleanupFailures.length} image asset(s) could not be removed.`
        : 'Wholesaler and associated records were permanently deleted successfully.',
      deleted: deletionSummary,
      imageCleanupFailures,
      sharedImagesPreserved: sharedImageCount,
    };
  }

  /**
   * Get Wholesaler Credit Policy
   */
  static async getCreditPolicy(wholesalerUser) {
    const wholesalerId = wholesalerUser?._id || wholesalerUser?.id || wholesalerUser;
    const profile = await WholesalerProfile.findOne({ userId: wholesalerId });
    if (!profile) throw new NotFoundError('Wholesaler profile not found');
    return profile.creditPolicy || {
      creditEnabled: false,
      allowCOD: true,
      defaultCreditLimit: 0,
      creditPeriodDays: 15,
      lateFeePercent: 0,
      minOrderForCredit: 0,
    };
  }

  /**
   * Update Wholesaler Credit Policy
   */
  static async updateCreditPolicy(wholesalerUser, policyData, req) {
    const wholesalerId = wholesalerUser?._id || wholesalerUser?.id || wholesalerUser;
    const profile = await WholesalerProfile.findOne({ userId: wholesalerId });
    if (!profile) throw new NotFoundError('Wholesaler profile not found');

    const defaultCreditLimit = policyData.defaultCreditLimit === undefined
      ? Number(profile.creditPolicy?.defaultCreditLimit || 0)
      : Number(policyData.defaultCreditLimit);
    const creditPeriodDays = policyData.creditPeriodDays === undefined
      ? Number(profile.creditPolicy?.creditPeriodDays || 15)
      : Number(policyData.creditPeriodDays);
    const lateFeePercent = policyData.lateFeePercent === undefined
      ? Number(profile.creditPolicy?.lateFeePercent || 0)
      : Number(policyData.lateFeePercent);
    const minOrderForCredit = policyData.minOrderForCredit === undefined
      ? Number(profile.creditPolicy?.minOrderForCredit || 0)
      : Number(policyData.minOrderForCredit);
    if (!Number.isFinite(defaultCreditLimit) || defaultCreditLimit < 0 || defaultCreditLimit > 100000000 || Math.round(defaultCreditLimit * 100) / 100 !== defaultCreditLimit) {
      throw new BadRequestError('Enter a valid default credit limit.');
    }
    if (!Number.isInteger(creditPeriodDays) || creditPeriodDays < 1 || creditPeriodDays > 365) {
      throw new BadRequestError('Credit period must be between 1 and 365 days.');
    }
    if (!Number.isFinite(lateFeePercent) || lateFeePercent < 0 || lateFeePercent > 100) {
      throw new BadRequestError('Late fee percentage must be between 0 and 100.');
    }
    if (!Number.isFinite(minOrderForCredit) || minOrderForCredit < 0 || minOrderForCredit > 100000000 || Math.round(minOrderForCredit * 100) / 100 !== minOrderForCredit) {
      throw new BadRequestError('Enter a valid minimum order value for credit.');
    }

    profile.creditPolicy = {
      creditEnabled: policyData.creditEnabled !== undefined ? Boolean(policyData.creditEnabled) : (profile.creditPolicy?.creditEnabled || false),
      allowCOD: policyData.allowCOD !== undefined ? Boolean(policyData.allowCOD) : (profile.creditPolicy?.allowCOD !== undefined ? profile.creditPolicy.allowCOD : true),
      defaultCreditLimit,
      creditPeriodDays,
      lateFeePercent,
      minOrderForCredit,
    };

    await profile.save();
    await AuditService.log({
      actorId: wholesalerId,
      actorRole: wholesalerUser.role,
      action: AUDIT_ACTION.UPDATE,
      entityType: 'WholesalerCreditPolicy',
      entityId: profile._id,
      after: profile.creditPolicy,
      req,
    });
    return profile.creditPolicy;
  }

  /**
   * Set custom credit limit for a specific retailer
   */
  static async setRetailerCreditLimit(wholesalerUser, retailerId, customCreditLimit, req) {
    const wholesalerId = wholesalerUser?._id || wholesalerUser?.id || wholesalerUser;
    const relationship = await WholesalerRetailerRelationship.findOne({
      wholesalerId,
      retailerId,
      status: 'ACTIVE',
    });

    if (!relationship) {
      throw new NotFoundError('Active connection with this retailer not found');
    }

    const parsedLimit = customCreditLimit !== null && customCreditLimit !== undefined && customCreditLimit !== ''
      ? Number(customCreditLimit)
      : null;
    if (parsedLimit !== null && (!Number.isFinite(parsedLimit) || parsedLimit < 0 || parsedLimit > 100000000 || Math.round(parsedLimit * 100) / 100 !== parsedLimit)) {
      throw new BadRequestError('Enter a valid retailer credit limit.');
    }
    relationship.customCreditLimit = parsedLimit;
    relationship.customCreditLimitPaise = relationship.customCreditLimit === null
      ? null
      : Math.round(relationship.customCreditLimit * 100);

    await relationship.save();
    await AuditService.log({
      actorId: wholesalerId,
      actorRole: wholesalerUser.role,
      action: AUDIT_ACTION.UPDATE,
      entityType: 'RetailerCreditPolicy',
      entityId: relationship._id,
      after: {
        retailerId: String(retailerId),
        customCreditLimitPaise: relationship.customCreditLimitPaise,
      },
      req,
    });
    return relationship;
  }

  static async updateRetailerCreditPolicy(wholesalerUser, retailerId, policyData, req) {
    const wholesalerId = wholesalerUser?._id || wholesalerUser?.id || wholesalerUser;
    const relationship = await WholesalerRetailerRelationship.findOne({
      wholesalerId,
      retailerId,
      status: 'ACTIVE',
    });
    if (!relationship) throw new NotFoundError('Active connection with this retailer not found');

    const status = String(policyData.status || '').toUpperCase();
    if (status && !['DISABLED', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED'].includes(status)) {
      throw new BadRequestError('Choose a valid retailer credit status.');
    }
    if (status) relationship.creditStatus = status;
    if (policyData.creditEnabled !== undefined) {
      relationship.creditStatus = policyData.creditEnabled ? 'APPROVED' : 'DISABLED';
    }
    relationship.creditEnabled = relationship.creditStatus === 'APPROVED';

    if (policyData.customCreditLimit !== undefined) {
      const limit = policyData.customCreditLimit === null || policyData.customCreditLimit === ''
        ? null
        : Number(policyData.customCreditLimit);
      if (limit !== null && (!Number.isFinite(limit) || limit < 0 || limit > 100000000 || Math.round(limit * 100) / 100 !== limit)) {
        throw new BadRequestError('Enter a valid credit limit.');
      }
      relationship.customCreditLimit = limit;
      relationship.customCreditLimitPaise = limit === null ? null : Math.round(limit * 100);
    }
    if (policyData.creditPeriodDays !== undefined) {
      const days = Number(policyData.creditPeriodDays);
      if (!Number.isInteger(days) || days < 1 || days > 365) {
        throw new BadRequestError('Credit terms must be between 1 and 365 days.');
      }
      relationship.creditPeriodDays = days;
    }

    await relationship.save();
    await AuditService.log({
      actorId: wholesalerId,
      actorRole: wholesalerUser.role,
      action: relationship.creditStatus === 'APPROVED' ? AUDIT_ACTION.APPROVE : AUDIT_ACTION.UPDATE,
      entityType: 'RetailerCreditPolicy',
      entityId: relationship._id,
      after: {
        retailerId: String(retailerId),
        creditEnabled: relationship.creditEnabled,
        creditStatus: relationship.creditStatus,
        customCreditLimitPaise: relationship.customCreditLimitPaise,
        creditPeriodDays: relationship.creditPeriodDays,
      },
      req,
    });
    return relationship;
  }

  /**
   * Get Wholesaler Credit Overview Dashboard Data
   */
  static async getCreditOverview(wholesalerUser) {
    const wholesalerId = wholesalerUser?._id || wholesalerUser?.id || wholesalerUser;
    const profile = await WholesalerProfile.findOne({ userId: wholesalerId });
    if (!profile) throw new NotFoundError('Wholesaler profile not found');

    const creditPolicy = profile.creditPolicy || {};
    const relationships = await WholesalerRetailerRelationship.find({
      wholesalerId,
      status: 'ACTIVE',
    }).populate('retailerId', 'name email phone');

    const retailerProfiles = await RetailerProfile.find({
      userId: { $in: relationships.map((r) => r.retailerId?._id).filter(Boolean) },
    });

    const profileMap = {};
    retailerProfiles.forEach((rp) => {
      profileMap[String(rp.userId)] = rp;
    });

    const now = new Date();

    const creditOrders = await Order.find({
      wholesalerId,
      isCreditOrder: true,
      creditPaymentStatus: { $in: ['PENDING', 'OVERDUE'] },
    }).sort({ creditDueDate: 1 });

    for (const order of creditOrders) {
      if (order.creditDueDate && order.creditDueDate < now && order.creditPaymentStatus === 'PENDING') {
        order.creditPaymentStatus = 'OVERDUE';
        order.paymentStatus = 'OVERDUE';
        await order.save();
      }
    }

    const items = relationships.map((rel) => {
      const rUser = rel.retailerId || {};
      const rProfile = profileMap[String(rUser._id)] || {};
      const effectiveLimit = Number.isSafeInteger(rel.customCreditLimitPaise)
        ? rel.customCreditLimitPaise / 100
        : (rel.customCreditLimit !== null && rel.customCreditLimit !== undefined
          ? rel.customCreditLimit
          : (creditPolicy.defaultCreditLimit || 0));

      const outstanding = Number.isSafeInteger(rel.currentOutstandingPaise)
        ? rel.currentOutstandingPaise / 100
        : Number(rel.currentOutstandingAmount || 0);
      const availableCredit = Math.max(0, effectiveLimit - outstanding);

      const retailerOrders = creditOrders.filter((o) => String(o.retailerId) === String(rUser._id));
      const overdueOrders = retailerOrders.filter((o) => o.creditPaymentStatus === 'OVERDUE' || (o.creditDueDate && o.creditDueDate < now));
      const overdueAmount = overdueOrders.reduce((sum, o) => sum + o.grandTotal, 0);

      return {
        relationshipId: String(rel._id),
        retailerId: String(rUser._id || ''),
        businessName: rProfile.businessName || `${rUser.name || 'Retailer'}'s Store`,
        ownerName: rUser.name || rProfile.ownerName || '',
        phone: rUser.phone || '',
        email: rUser.email || '',
        customCreditLimit: rel.customCreditLimit,
        creditStatus: rel.creditStatus || 'DISABLED',
        creditEnabled: Boolean(creditPolicy.creditEnabled && rel.creditEnabled && rel.creditStatus === 'APPROVED'),
        creditPeriodDays: rel.creditPeriodDays || creditPolicy.creditPeriodDays || 15,
        effectiveLimit,
        currentOutstandingAmount: outstanding,
        availableCredit,
        activeCreditOrdersCount: retailerOrders.length,
        overdueCount: overdueOrders.length,
        overdueAmount,
        oldestDueDate: retailerOrders[0]?.creditDueDate || null,
        creditOrders: retailerOrders.map((o) => ({
          orderId: String(o._id),
          orderNumber: o.orderNumber,
          grandTotal: o.grandTotal,
          creditDueDate: o.creditDueDate,
          creditPaymentStatus: o.creditPaymentStatus,
          createdAt: o.createdAt,
        })),
      };
    });

    const totalOutstanding = items.reduce((sum, i) => sum + i.currentOutstandingAmount, 0);
    const totalOverdue = items.reduce((sum, i) => sum + i.overdueAmount, 0);

    return {
      policy: creditPolicy,
      summary: {
        totalRetailersOnCredit: items.filter((i) => i.currentOutstandingAmount > 0).length,
        totalOutstandingAmount: totalOutstanding,
        totalOverdueAmount: totalOverdue,
      },
      retailers: items,
    };
  }

  /**
   * Settle an order's outstanding credit
   */
}

module.exports = WholesalerService;
