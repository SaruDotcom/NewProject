const mongoose = require('mongoose');
const {
  User, WholesalerProfile, WholesalerRetailerRelationship, RetailerProfile,
  Inventory, InventoryTransaction, Product, Order, Earning, Payout,
} = require('../../models');
const { INVENTORY_TRANSACTION_TYPE, RELATIONSHIP_STATUS, ORDER_STATUS } = require('../../config/constants');
const { BadRequestError, NotFoundError, ConflictError } = require('../../utils/errors');
const { parsePagination } = require('../../utils/pagination');
const AuditService = require('../../services/audit.service');
const WholesalerReportsService = require('../../services/wholesalerReports.service');
const SupportService = require('../support/support.service');
const { RetailerIdentityService } = require('../../services/retailerIdentity.service');
const { normalizeBusinessType, getPresetsForType } = require('../../config/businessTypeBanners');

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
      phone: retailer.phone || '',
      businessName: profile.businessName || retailer.name || '',
      businessType: profile.businessType || 'Independent retailer',
      category: profile.category || '',
      gstin: profile.gstin || '',
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
      outstandingAmount: row.currentOutstandingAmount || 0,
      registrationSource: profile.registrationSource || 'DIRECT',
      lastLoginAt: retailer.lastLoginAt || null,
      verificationStatus: profile.verificationStatus || 'NOT_SUBMITTED',
      documentsSubmitted: Boolean(
        profile.pan?.numberEncrypted ||
        profile.pan?.publicId ||
        profile.aadhaar?.numberEncrypted ||
        profile.aadhaar?.frontImage?.publicId ||
        profile.aadhaar?.backImage?.publicId
      ),
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
    const allowedProfile = ['businessName', 'businessLogoUrl', 'description', 'businessType', 'businessCategory', 'address', 'bankDetails', 'minOrderValue', 'activeStoreTheme', 'promotionalBanners'];
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
    const wholesalerObjectId = mongoose.isValidObjectId(userId) ? new mongoose.Types.ObjectId(userId) : userId;
    const filter = { wholesalerId: wholesalerObjectId, status: query.status || RELATIONSHIP_STATUS.ACTIVE };
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
    const wholesalerObjectId = mongoose.isValidObjectId(userId) ? new mongoose.Types.ObjectId(userId) : userId;
    const relationship = await WholesalerRetailerRelationship.findOne({
      _id: relationshipId,
      wholesalerId: wholesalerObjectId,
      status: RELATIONSHIP_STATUS.ACTIVE,
    })
      .populate('retailerId', 'name email phone status createdAt')
      .lean();
    if (!relationship) throw new NotFoundError('Retailer relationship not found');

    const retailerUserId = relationship.retailerId?._id || relationship.retailerId;
    const [profile, orders] = await Promise.all([
      RetailerProfile.findOne({ userId: retailerUserId, isDeleted: false }).lean(),
      Order.find({ wholesalerId: wholesalerObjectId, retailerId: retailerUserId })
        .sort({ createdAt: -1 })
        .limit(20)
        .lean(),
    ]);
    const [wholesalerProfile, retailerUser] = await Promise.all([
      WholesalerProfile.findOne({ userId: wholesalerObjectId }).select('creditPolicy').lean(),
      User.findById(retailerUserId).select('lastLoginAt').lean(),
    ]);
    const identity = profile ? RetailerIdentityService.formatIdentity(profile, { includePan: true }) : null;
    const safeProfile = profile ? {
      businessName: profile.businessName || '',
      ownerName: profile.ownerName || '',
      businessType: profile.businessType || '',
      category: profile.category || '',
      gstin: profile.gstin || '',
      gstStatus: profile.gstStatus || '',
      address: profile.address || {},
      profileComplete: Boolean(profile.profileComplete),
      registrationSource: profile.registrationSource || 'DIRECT',
      createdAt: profile.createdAt || relationship.createdAt,
      pan: identity?.pan,
      aadhaar: identity?.aadhaar,
      shopPhoto: identity?.shopPhoto,
      consent: identity?.consent,
      verificationStatus: identity?.verificationStatus || 'NOT_SUBMITTED',
      verificationNote: identity?.verificationNote || '',
      documentsSubmitted: Boolean(identity?.documentsSubmitted),
    } : null;
    const creditLimit = relationship.customCreditLimit !== null && relationship.customCreditLimit !== undefined
      ? relationship.customCreditLimit
      : (wholesalerProfile?.creditPolicy?.defaultCreditLimit || 0);

    return {
      ...this.formatRetailerRelationship({
        ...relationship,
        retailer: relationship.retailerId,
        profile: safeProfile,
      }),
      retailerId: String(relationship.retailerId._id),
      phone: relationship.retailerId.phone || '',
      email: relationship.retailerId.email || '',
      lastLoginAt: retailerUser?.lastLoginAt || null,
      creditLimit,
      outstandingAmount: relationship.currentOutstandingAmount || 0,
      totalOrdersCount: profile?.totalOrdersCount || 0,
      totalSpent: profile?.totalPurchaseAmount || 0,
      registrationSource: profile?.registrationSource || 'DIRECT',
      profile: safeProfile,
      orders,
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

    const user = await User.findById(userId).populate('wholesalerProfile');
    if (!user) throw new NotFoundError('Wholesaler account not found');
    return SupportService.createTicket(user, {
      type: 'Request',
      subject: subject?.trim() || 'Super Admin Help Request',
      message: String(message).trim(),
      priority: 'High',
      callbackPhone,
    });
  }

  static async resolveBusinessCategory(profile, wholesalerUserId) {
    if (profile.businessCategory) {
      return normalizeBusinessType(profile.businessCategory);
    }
    if (profile.khataBook?.businessType) {
      return normalizeBusinessType(profile.khataBook.businessType);
    }
    try {
      const distinctCats = await Product.distinct('categoryName', {
        wholesalerId: wholesalerUserId,
        isDeleted: false,
      });
      const catText = (distinctCats || []).join(' ').toLowerCase();
      if (/cloth|apparel|saree|kurti|lehenga|ethnic|suit|dress|western|shirt|garment/.test(catText)) return 'CLOTHING';
      if (/cosmetic|beauty|skincare|makeup|serum|lipstick|lotion/.test(catText)) return 'COSMETICS';
      if (/grocery|kirana|staple|rice|pulse|snack|fmcg|beverage/.test(catText)) return 'GENERAL_STORE';
      if (/footwear|shoe|sandal|slipper|juttis|sneaker/.test(catText)) return 'FOOTWEAR';
      if (/electronic|gadget|mobile|cable|charger|appliance|headphone|audio/.test(catText)) return 'ELECTRONICS';
    } catch {
      // fallback
    }
    return 'CLOTHING';
  }

  static async getBanners(userId) {
    const profile = await WholesalerProfile.findOne({ userId, isDeleted: false });
    if (!profile) throw new NotFoundError('Wholesaler profile not found');

    const businessCategory = await this.resolveBusinessCategory(profile, userId);
    const presetOptions = getPresetsForType(businessCategory);

    // If profile has no banners saved, initialize with presets for this business category
    if (!profile.promotionalBanners || profile.promotionalBanners.length === 0) {
      profile.promotionalBanners = presetOptions.map((p, idx) => ({
        ...p,
        isActive: idx < 2, // Activate first 2 options by default
      }));
      profile.businessCategory = businessCategory;
      await profile.save();
    }

    return {
      banners: (profile.promotionalBanners || []).map((b) => ({
        id: b.id,
        title: b.title,
        subtitle: b.subtitle || '',
        badgeText: b.badgeText || '',
        tag: b.badgeText || '',
        buttonText: b.buttonText || 'Shop Trade Deals',
        ctaText: b.buttonText || 'Shop Trade Deals',
        imageUrl: b.imageUrl || '',
        targetCategory: b.targetCategory || 'All',
        category: b.targetCategory || 'All',
        discountBadge: b.discountBadge || '',
        gradient: b.gradient || '',
        isActive: b.isActive !== false,
        active: b.isActive !== false,
        businessType: b.businessType || businessCategory,
      })),
      businessCategory,
      presetOptions,
      activeStoreTheme: profile.activeStoreTheme || 'DEFAULT',
      businessName: profile.businessName,
    };
  }

  static async updateBanners(userId, payload, actor, req) {
    const profile = await WholesalerProfile.findOne({ userId, isDeleted: false });
    if (!profile) throw new NotFoundError('Wholesaler profile not found');

    const { banners, businessCategory, activeStoreTheme } = payload;
    if (businessCategory) {
      profile.businessCategory = normalizeBusinessType(businessCategory);
    }
    if (activeStoreTheme) {
      profile.activeStoreTheme = activeStoreTheme;
    }

    if (Array.isArray(banners)) {
      profile.promotionalBanners = banners.map((b, index) => {
        const isActiveVal = (b.isActive !== undefined) ? Boolean(b.isActive) : (b.active !== undefined ? Boolean(b.active) : true);
        return {
          id: b.id || `slide-${Date.now()}-${index}`,
          title: String(b.title || '').trim(),
          subtitle: String(b.subtitle || '').trim(),
          badgeText: String(b.badgeText || b.tag || '').trim(),
          buttonText: String(b.buttonText || b.ctaText || 'Shop Trade Deals').trim(),
          imageUrl: String(b.imageUrl || '').trim(),
          targetCategory: String(b.targetCategory || b.category || 'All').trim(),
          discountBadge: String(b.discountBadge || '').trim(),
          gradient: String(b.gradient || 'from-tradeflow-navy via-tradeflow-green to-tradeflow-navy').trim(),
          isActive: isActiveVal,
          businessType: b.businessType || profile.businessCategory || 'CLOTHING',
        };
      });
    }

    await profile.save();
    if (actor?._id) {
      await AuditService.log({
        actorId: actor._id,
        actorRole: actor.role,
        action: 'UPDATE',
        entityType: 'WholesalerProfile',
        entityId: profile._id,
        metadata: { action: 'updateBanners', bannerCount: profile.promotionalBanners.length },
        req,
      });
    }

    return this.getBanners(userId);
  }

  static async activatePreset(userId, presetId, actor, req) {
    const profile = await WholesalerProfile.findOne({ userId, isDeleted: false });
    if (!profile) throw new NotFoundError('Wholesaler profile not found');

    const businessCategory = await this.resolveBusinessCategory(profile, userId);
    const presets = getPresetsForType(businessCategory);
    const targetPreset = presets.find((p) => p.id === presetId);
    if (!targetPreset) throw new NotFoundError('Preset banner option not found');

    if (!Array.isArray(profile.promotionalBanners)) {
      profile.promotionalBanners = [];
    }

    const existingIndex = profile.promotionalBanners.findIndex((b) => b.id === presetId);
    if (existingIndex >= 0) {
      profile.promotionalBanners[existingIndex].isActive = true;
    } else {
      profile.promotionalBanners.push({ ...targetPreset, isActive: true });
    }

    await profile.save();
    return this.getBanners(userId);
  }

  static async updateBusinessCategory(userId, businessCategory, actor, req) {
    const profile = await WholesalerProfile.findOne({ userId, isDeleted: false });
    if (!profile) throw new NotFoundError('Wholesaler profile not found');

    const normalized = normalizeBusinessType(businessCategory);
    profile.businessCategory = normalized;

    // Load new presets for the new business type
    const presets = getPresetsForType(normalized);
    profile.promotionalBanners = presets.map((p, idx) => ({
      ...p,
      isActive: idx < 2,
    }));
    await profile.save();

    await AuditService.log({
      actorId: actor._id,
      actorRole: actor.role,
      action: 'UPDATE',
      entityType: 'WholesalerProfile',
      entityId: profile._id,
      metadata: { action: 'updateBusinessCategory', businessCategory: normalized },
      req,
    });

    return this.getBanners(userId);
  }
}
module.exports = WholesalerPortalService;
