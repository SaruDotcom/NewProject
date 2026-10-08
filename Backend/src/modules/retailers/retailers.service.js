const mongoose = require('mongoose');
const {
  User,
  RetailerProfile,
  WholesalerProfile,
  WholesalerRetailerRelationship,
  Order,
  AuditLog,
} = require('../../models');
const { USER_STATUS, AUDIT_ACTION } = require('../../config/constants');
const { NotFoundError, BadRequestError, ConflictError } = require('../../utils/errors');
const { parsePagination } = require('../../utils/pagination');
const AuditService = require('../../services/audit.service');

class RetailerService {
  static formatRetailer(profile) {
    const user = profile.userId || {};
    const assigned = profile.assignedWholesalerId || {};
    const relationshipWholesaler = profile.activeRelationshipId?.wholesalerId || {};
    const wholesaler = {
      id: String(assigned._id || relationshipWholesaler._id || profile.wholesalerId || profile.createdByWholesalerId || ''),
      name: assigned.name || relationshipWholesaler.name || profile.wholesalerInfo?.ownerName || '',
      email: assigned.email || relationshipWholesaler.email || profile.wholesalerInfo?.email || '',
      businessName: profile.wholesalerInfo?.businessName || assigned.name || relationshipWholesaler.name || '',
    };
    const address = profile.address || {};

    return {
      id: String(profile._id),
      profileId: String(profile._id),
      userId: String(user._id || profile.userId || ''),
      name: profile.ownerName || user.name || '',
      businessName: profile.businessName || '',
      company: profile.businessName || '',
      email: user.email || '',
      phone: user.phone || '',
      loginId: user.loginId || '',
      city: address.city || '',
      state: address.state || '',
      address: address.street || address.addressLine1 || '',
      pincode: address.pincode || address.postalCode || '',
      gstin: profile.gstin || '',
      gstStatus: profile.gstStatus || 'UNREGISTERED',
      category: profile.category || '',
      businessType: profile.businessType || '',
      wholesaler,
      wholesalerId: wholesaler.id,
      relationship: profile.activeRelationshipId || null,
      relationshipStatus: profile.activeRelationshipId?.status || '',
      status: String(user.status || 'PENDING').toLowerCase(),
      totalOrders: profile.totalOrdersCount || 0,
      totalAmountSpent: profile.totalPurchaseAmount || 0,
      profileComplete: Boolean(profile.profileComplete),
      createdAt: profile.createdAt || user.createdAt,
      lastLoginAt: user.lastLoginAt,
    };
  }

  /**
   * List retailers with search, filters, pagination
   */
  static async listRetailers(query = {}) {
    const { page, limit, skip, sortBy, sortOrder } = parsePagination(query);

    const sortFieldMap = {
      totalOrders: 'totalOrdersCount',
      totalAmountSpent: 'totalPurchaseAmount',
      city: 'address.city',
      state: 'address.state',
      businessName: 'businessName',
      createdAt: 'createdAt',
      updatedAt: 'updatedAt',
    };
    const mongoSortField = sortFieldMap[sortBy] || sortBy || 'createdAt';
    const sort = { [mongoSortField]: sortOrder === 'asc' ? 1 : -1 };

    const andConditions = [{ isDeleted: false }];

    // Status Filter (status lives on User model: ACTIVE, PENDING, BLOCKED)
    if (query.status && query.status !== 'all') {
      const targetStatus = query.status.toUpperCase();
      const matchingUsers = await User.find({
        status: new RegExp('^' + targetStatus + '$', 'i'),
        isDeleted: false,
      }).select('_id').lean();
      const userIds = matchingUsers.map(u => u._id);
      andConditions.push({ userId: { $in: userIds } });
    }

    // Wholesaler Filter
    const wholesalerFilter = query.wholesalerId || query.wholesaler;
    if (wholesalerFilter && wholesalerFilter !== 'all') {
      let targetWholesalerIds = [];
      if (mongoose.Types.ObjectId.isValid(wholesalerFilter)) {
        const wObjId = new mongoose.Types.ObjectId(wholesalerFilter);
        const wProfile = await WholesalerProfile.findOne({
          $or: [{ _id: wObjId }, { userId: wObjId }],
        }).select('_id userId').lean();
        if (wProfile) {
          if (wProfile._id) targetWholesalerIds.push(wProfile._id);
          if (wProfile.userId) targetWholesalerIds.push(wProfile.userId);
        } else {
          targetWholesalerIds.push(wObjId);
        }
      } else {
        targetWholesalerIds.push(wholesalerFilter);
      }

      const relationships = await WholesalerRetailerRelationship.find({
        wholesalerId: { $in: targetWholesalerIds },
      }).select('retailerId').lean();
      const retailerUserIdsFromRel = relationships.map(r => r.retailerId).filter(Boolean);

      andConditions.push({
        $or: [
          { assignedWholesalerId: { $in: targetWholesalerIds } },
          { wholesalerId: { $in: targetWholesalerIds } },
          { createdByWholesalerId: { $in: targetWholesalerIds } },
          { userId: { $in: retailerUserIdsFromRel } },
        ],
      });
    }

    // City Filter
    if (query.city && query.city !== 'all') {
      const safeCity = query.city.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      andConditions.push({ 'address.city': new RegExp('^' + safeCity + '$', 'i') });
    }

    // State Filter
    if (query.state && query.state !== 'all') {
      const safeState = query.state.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      andConditions.push({ 'address.state': new RegExp('^' + safeState + '$', 'i') });
    }

    // Date Range Filter
    if (query.dateFrom || query.dateTo) {
      const dateQuery = {};
      if (query.dateFrom) {
        const start = new Date(query.dateFrom);
        if (!isNaN(start.getTime())) dateQuery.$gte = start;
      }
      if (query.dateTo) {
        const end = new Date(query.dateTo);
        if (!isNaN(end.getTime())) {
          end.setHours(23, 59, 59, 999);
          dateQuery.$lte = end;
        }
      }
      if (Object.keys(dateQuery).length > 0) {
        andConditions.push({ createdAt: dateQuery });
      }
    }

    // Search
    if (query.search && query.search.trim()) {
      const safeSearch = query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchRegex = new RegExp(safeSearch, 'i');
      const matchingUsers = await User.find({
        $or: [{ name: searchRegex }, { email: searchRegex }, { phone: searchRegex }],
        isDeleted: false,
      }).select('_id').lean();
      const userIds = matchingUsers.map(u => u._id);

      andConditions.push({
        $or: [
          { businessName: searchRegex },
          { ownerName: searchRegex },
          { gstin: searchRegex },
          { 'address.city': searchRegex },
          { 'address.state': searchRegex },
          { userId: { $in: userIds } },
        ],
      });
    }

    const filter = andConditions.length === 1 ? andConditions[0] : { $and: andConditions };

    const [retailers, total, rawCities, rawStates] = await Promise.all([
      RetailerProfile.find(filter)
        .populate('userId', 'name email loginId phone status createdAt lastLoginAt')
        .populate('assignedWholesalerId', 'name email')
        .populate({
          path: 'activeRelationshipId',
          select: 'status joinedAt wholesalerId',
          populate: { path: 'wholesalerId', select: 'name email' },
        })
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      RetailerProfile.countDocuments(filter),
      RetailerProfile.distinct('address.city', { isDeleted: false, 'address.city': { $nin: ['', null] } }),
      RetailerProfile.distinct('address.state', { isDeleted: false, 'address.state': { $nin: ['', null] } }),
    ]);

    const formatted = retailers.map((retailer) => this.formatRetailer(retailer));

    const cities = Array.from(new Set(rawCities.filter(Boolean).map(c => String(c).trim()))).sort();
    const states = Array.from(new Set(rawStates.filter(Boolean).map(s => String(s).trim()))).sort();

    return {
      retailers: formatted,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
      filters: {
        cities,
        states,
      },
    };
  }

  /**
   * Get single retailer details
   */
  static async getRetailerById(retailerId) {
    let profile = await RetailerProfile.findById(retailerId)
      .populate('userId', 'name email phone status createdAt lastLoginAt')
      .populate('assignedWholesalerId', 'name email');

    if (!profile) {
      profile = await RetailerProfile.findOne({ userId: retailerId })
        .populate('userId', 'name email phone status createdAt lastLoginAt')
        .populate('assignedWholesalerId', 'name email');
    }

    if (!profile || profile.isDeleted) {
      throw new NotFoundError('Retailer not found');
    }

    const userId = profile.userId?._id || profile.userId;

    const [relationships, recentOrders, auditHistory] = await Promise.all([
      WholesalerRetailerRelationship.find({ retailerId: userId })
        .populate('wholesalerId', 'name email')
        .sort({ createdAt: -1 })
        .lean(),
      Order.find({ retailerId: userId })
        .populate('wholesalerId', 'name email')
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),
      AuditLog.find({
        $or: [{ entityId: String(userId) }, { entityId: String(profile._id) }, { actorId: userId }],
      })
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),
    ]);

    const formatted = this.formatRetailer(profile.toObject ? profile.toObject() : profile);

    return {
      ...formatted,
      profile: formatted,
      relationships,
      recentOrders,
      auditHistory,
    };
  }

  /**
   * Create new retailer account
   */
  static async createRetailer(payload, adminUser, req = null) {
    const { name, email, phone, businessName, company, city, state, password, wholesalerId } = payload;

    if (!name || !email || !password) {
      throw new BadRequestError('Name, email, and password are required');
    }

    const existingUser = await User.findOne({
      $or: [{ email: email.toLowerCase() }, ...(phone ? [{ phone }] : [])],
    });
    if (existingUser) {
      throw new ConflictError('User with this email or phone already exists');
    }

    let wholesalerUser = null;
    let wholesalerProfile = null;
    if (wholesalerId && mongoose.Types.ObjectId.isValid(wholesalerId)) {
      const wObjId = new mongoose.Types.ObjectId(wholesalerId);
      wholesalerProfile = await WholesalerProfile.findOne({
        $or: [{ _id: wObjId }, { userId: wObjId }],
      });
      if (wholesalerProfile) {
        wholesalerUser = await User.findById(wholesalerProfile.userId);
      }
    }

    const passwordHash = await User.hashPassword(password);
    const user = await User.create({
      name,
      email: email.toLowerCase(),
      phone: phone || undefined,
      passwordHash,
      role: 'RETAILER',
      status: 'ACTIVE',
      emailVerified: true,
    });

    const wUserId = wholesalerUser?._id || wholesalerProfile?.userId;
    const profile = await RetailerProfile.create({
      userId: user._id,
      businessName: businessName || company || `${name}'s Store`,
      ownerName: name,
      address: {
        city: city || '',
        state: state || '',
      },
      assignedWholesalerId: wUserId,
      wholesalerId: wUserId,
      wholesalerInfo: wholesalerProfile ? {
        businessName: wholesalerProfile.businessName || '',
        ownerName: wholesalerUser?.name || '',
        email: wholesalerUser?.email || '',
        phone: wholesalerUser?.phone || '',
      } : {},
    });

    if (wUserId) {
      const relationship = await WholesalerRetailerRelationship.create({
        wholesalerId: wUserId,
        retailerId: user._id,
        status: 'ACTIVE',
        joinedAt: new Date(),
      });
      profile.activeRelationshipId = relationship._id;
      await profile.save();
    }

    user.retailerProfile = profile._id;
    await user.save();

    await AuditService.log({
      actorId: adminUser._id,
      actorRole: adminUser.role,
      action: AUDIT_ACTION.CREATE,
      entityType: 'RetailerProfile',
      entityId: profile._id,
      req,
    });

    return this.formatRetailer(profile);
  }

  /**
   * Update retailer profile
   */
  static async updateRetailer(retailerId, payload, adminUser, req = null) {
    let profile = await RetailerProfile.findById(retailerId).populate('userId');
    if (!profile) {
      profile = await RetailerProfile.findOne({ userId: retailerId }).populate('userId');
    }
    if (!profile || profile.isDeleted) {
      throw new NotFoundError('Retailer not found');
    }

    const user = profile.userId;
    if (user) {
      if (payload.name) user.name = payload.name;
      if (payload.email) user.email = payload.email.toLowerCase();
      if (payload.phone) user.phone = payload.phone;
      await user.save();
    }

    if (payload.businessName || payload.company) {
      profile.businessName = payload.businessName || payload.company;
    }
    if (payload.city !== undefined || payload.state !== undefined) {
      profile.address = {
        ...profile.address,
        ...(payload.city !== undefined ? { city: payload.city } : {}),
        ...(payload.state !== undefined ? { state: payload.state } : {}),
      };
    }
    await profile.save();

    await AuditService.log({
      actorId: adminUser._id,
      actorRole: adminUser.role,
      action: AUDIT_ACTION.UPDATE,
      entityType: 'RetailerProfile',
      entityId: profile._id,
      req,
    });

    return this.formatRetailer(profile);
  }

  /**
   * Change retailer assigned wholesaler
   */
  static async changeWholesaler(retailerId, { wholesalerId }, adminUser, req = null) {
    let profile = await RetailerProfile.findById(retailerId).populate('userId');
    if (!profile) {
      profile = await RetailerProfile.findOne({ userId: retailerId }).populate('userId');
    }
    if (!profile || profile.isDeleted) {
      throw new NotFoundError('Retailer not found');
    }

    let wholesalerProfile = null;
    let wholesalerUser = null;
    if (wholesalerId && mongoose.Types.ObjectId.isValid(wholesalerId)) {
      const wObjId = new mongoose.Types.ObjectId(wholesalerId);
      wholesalerProfile = await WholesalerProfile.findOne({
        $or: [{ _id: wObjId }, { userId: wObjId }],
      });
      if (wholesalerProfile) {
        wholesalerUser = await User.findById(wholesalerProfile.userId);
      }
    }

    if (!wholesalerProfile && !wholesalerUser) {
      throw new NotFoundError('Wholesaler not found');
    }

    const wUserId = wholesalerUser?._id || wholesalerProfile.userId;

    profile.assignedWholesalerId = wUserId;
    profile.wholesalerId = wUserId;
    profile.wholesalerInfo = {
      businessName: wholesalerProfile.businessName || wholesalerUser?.name || '',
      ownerName: wholesalerUser?.name || '',
      email: wholesalerUser?.email || '',
      phone: wholesalerUser?.phone || '',
    };

    const retailerUserId = profile.userId?._id || profile.userId;
    let relationship = await WholesalerRetailerRelationship.findOne({
      retailerId: retailerUserId,
      wholesalerId: wUserId,
    });

    if (!relationship) {
      relationship = await WholesalerRetailerRelationship.create({
        wholesalerId: wUserId,
        retailerId: retailerUserId,
        status: 'ACTIVE',
        joinedAt: new Date(),
      });
    } else {
      relationship.status = 'ACTIVE';
      await relationship.save();
    }

    profile.activeRelationshipId = relationship._id;
    await profile.save();

    await AuditService.log({
      actorId: adminUser._id,
      actorRole: adminUser.role,
      action: AUDIT_ACTION.UPDATE,
      entityType: 'RetailerProfile',
      entityId: profile._id,
      metadata: { newWholesalerId: wUserId },
      req,
    });

    return this.formatRetailer(profile);
  }

  /**
   * Update retailer status
   */
  static async updateStatus(retailerId, { status, reason }, adminUser, req = null) {
    let profile = await RetailerProfile.findById(retailerId).populate('userId');
    if (!profile) {
      profile = await RetailerProfile.findOne({ userId: retailerId }).populate('userId');
    }
    if (!profile || profile.isDeleted) {
      throw new NotFoundError('Retailer not found');
    }

    const user = profile.userId;
    const beforeState = { status: user?.status };

    if (user && status) {
      user.status = status.toUpperCase();
      await user.save();
    }

    await AuditService.log({
      actorId: adminUser._id,
      actorRole: adminUser.role,
      action: AUDIT_ACTION.USER_STATUS_CHANGED,
      entityType: 'Retailer',
      entityId: profile._id,
      before: beforeState,
      after: { status, reason },
      req,
    });

    return { profile, user };
  }

  /**
   * Soft delete retailer
   */
  static async deleteRetailer(retailerId, adminUser, req = null) {
    let profile = await RetailerProfile.findById(retailerId);
    if (!profile) {
      profile = await RetailerProfile.findOne({ userId: retailerId });
    }
    if (!profile || profile.isDeleted) {
      throw new NotFoundError('Retailer not found');
    }

    profile.isDeleted = true;
    await profile.save();

    await User.findByIdAndUpdate(profile.userId, { isDeleted: true, status: USER_STATUS.DELETED });

    await AuditService.log({
      actorId: adminUser._id,
      actorRole: adminUser.role,
      action: AUDIT_ACTION.DELETE,
      entityType: 'RetailerProfile',
      entityId: profile._id,
      req,
    });

    return { message: 'Retailer deleted successfully' };
  }
}

module.exports = RetailerService;

