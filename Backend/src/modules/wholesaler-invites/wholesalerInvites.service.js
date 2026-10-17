const crypto = require('crypto');
const { WholesalerInvite, PlatformSetting, WholesalerProfile, User } = require('../../models');
const { hashToken, generateSecureToken } = require('../../utils/crypto');
const { BadRequestError, NotFoundError } = require('../../utils/errors');

const ADMIN_LINK_SETTING_KEY = 'ADMIN_WHOLESALER_REFERRAL_LINK';

function generateAdminReferralCode() {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let result = 'WHOLESALE-';
  for (let i = 0; i < 6; i += 1) {
    result += chars[crypto.randomInt(chars.length)];
  }
  return result;
}

const ACTIVE_STATUSES = ['SENT', 'OPENED'];
const EXPIRY_DAYS = 7;

function expiryDate() {
  return new Date(Date.now() + EXPIRY_DAYS * 24 * 60 * 60 * 1000);
}

function publicRecord(invite) {
  return {
    id: String(invite._id),
    contactName: invite.contactName,
    email: invite.email,
    phone: invite.phone,
    businessName: invite.businessName,
    note: invite.note,
    status: invite.expiresAt <= new Date() && ACTIVE_STATUSES.includes(invite.status)
      ? 'EXPIRED'
      : invite.status,
    expiresAt: invite.expiresAt,
    openedAt: invite.openedAt,
    registeredAt: invite.registeredAt,
    wholesalerId: invite.wholesalerId ? String(invite.wholesalerId) : null,
    createdAt: invite.createdAt,
  };
}

class WholesalerInvitesService {
  static async create(values, adminUser) {
    const token = generateSecureToken(32);
    const invite = await WholesalerInvite.create({
      ...values,
      createdBy: adminUser._id,
      tokenHash: hashToken(token),
      expiresAt: expiryDate(),
      status: 'SENT',
    });
    return { invite: publicRecord(invite), token };
  }

  static async list(query = {}) {
    const now = new Date();
    await WholesalerInvite.updateMany(
      { status: { $in: ACTIVE_STATUSES }, expiresAt: { $lte: now } },
      { $set: { status: 'EXPIRED' }, $unset: { registrationClaimId: 1, registrationClaimExpiresAt: 1 } }
    );

    const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(query.limit, 10) || 20));
    const filter = {};
    if (query.status && query.status !== 'ALL') filter.status = query.status;
    if (query.dateFrom || query.dateTo) {
      filter.createdAt = {};
      if (query.dateFrom) filter.createdAt.$gte = new Date(query.dateFrom);
      if (query.dateTo) {
        const dateTo = new Date(query.dateTo);
        dateTo.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = dateTo;
      }
    }
    if (query.search?.trim()) {
      const escaped = query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { contactName: new RegExp(escaped, 'i') },
        { businessName: new RegExp(escaped, 'i') },
        { email: new RegExp(escaped, 'i') },
        { phone: new RegExp(escaped, 'i') },
      ];
    }
    const [rows, total, stats] = await Promise.all([
      WholesalerInvite.find(filter).select('-tokenHash').populate('createdBy', 'name email')
        .sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      WholesalerInvite.countDocuments(filter),
      WholesalerInvite.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
    ]);
    const counts = Object.fromEntries(['SENT', 'OPENED', 'REGISTERED', 'EXPIRED', 'REVOKED']
      .map((status) => [status, stats.find((entry) => entry._id === status)?.count || 0]));
    return {
      items: rows.map(publicRecord),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      stats: counts,
    };
  }

  static async getPublicPrefill(rawToken) {
    const tokenHash = hashToken(rawToken);
    const invite = await WholesalerInvite.findOne({ tokenHash }).select('+tokenHash');
    if (!invite) throw new NotFoundError('This wholesaler invitation is invalid or has expired.');
    if (invite.status === 'SENT' || invite.status === 'OPENED') {
      if (invite.expiresAt <= new Date()) {
        invite.status = 'EXPIRED';
        invite.registrationClaimId = null;
        invite.registrationClaimExpiresAt = null;
        await invite.save();
        throw new NotFoundError('This wholesaler invitation is invalid or has expired.');
      }
      invite.status = 'OPENED';
      invite.openedAt ||= new Date();
      await invite.save();
    } else {
      throw new NotFoundError('This wholesaler invitation is no longer available.');
    }
    return {
      contactName: invite.contactName,
      email: invite.email,
      phone: invite.phone,
      businessName: invite.businessName,
      expiresAt: invite.expiresAt,
    };
  }

  static async claim(rawToken) {
    const tokenHash = hashToken(rawToken);
    const now = new Date();
    const claimId = generateSecureToken(16);
    const invite = await WholesalerInvite.findOneAndUpdate(
      {
        tokenHash,
        status: { $in: ACTIVE_STATUSES },
        expiresAt: { $gt: now },
        $or: [
          { registrationClaimId: null },
          { registrationClaimExpiresAt: { $lte: now } },
        ],
      },
      {
        $set: {
          registrationClaimId: claimId,
          registrationClaimExpiresAt: new Date(now.getTime() + 10 * 60 * 1000),
        },
      },
      { new: true }
    );
    if (!invite) throw new BadRequestError('This invitation has already been used or has expired.', 'INVITE_UNAVAILABLE');
    return { claimId, invite };
  }

  static async releaseClaim(claimId) {
    await WholesalerInvite.updateOne(
      { registrationClaimId: claimId, status: { $in: ACTIVE_STATUSES } },
      { $set: { registrationClaimId: null, registrationClaimExpiresAt: null } }
    );
  }

  static async completeClaim(claimId, wholesalerId) {
    const result = await WholesalerInvite.updateOne(
      { registrationClaimId: claimId, status: { $in: ACTIVE_STATUSES }, expiresAt: { $gt: new Date() } },
      {
        $set: {
          status: 'REGISTERED',
          registeredAt: new Date(),
          wholesalerId,
          registrationClaimId: null,
          registrationClaimExpiresAt: null,
        },
      }
    );
    if (result.modifiedCount !== 1) {
      throw new BadRequestError('The invitation could not be completed. Please contact support.', 'INVITE_CLAIM_LOST');
    }
  }

  static async revoke(id) {
    const now = new Date();
    const invite = await WholesalerInvite.findOneAndUpdate(
      {
        _id: id,
        status: { $in: ACTIVE_STATUSES },
        expiresAt: { $gt: now },
        $or: [
          { registrationClaimId: null },
          { registrationClaimExpiresAt: { $lte: now } },
        ],
      },
      { $set: { status: 'REVOKED', registrationClaimId: null, registrationClaimExpiresAt: null } },
      { new: true }
    ).select('-tokenHash');
    if (!invite) throw new NotFoundError('Active, unused wholesaler invitation not found.');
    return publicRecord(invite);
  }

  static async regenerate(id, adminUser) {
    const now = new Date();
    const oldInvite = await WholesalerInvite.findOne({
      _id: id,
      status: { $in: ACTIVE_STATUSES },
    }).select('-tokenHash');
    if (!oldInvite) throw new NotFoundError('Active wholesaler invitation not found.');
    const previousStatus = oldInvite.status;
    const revoked = await WholesalerInvite.findOneAndUpdate(
      {
        _id: oldInvite._id,
        status: { $in: ACTIVE_STATUSES },
        expiresAt: { $gt: now },
        $or: [
          { registrationClaimId: null },
          { registrationClaimExpiresAt: { $lte: now } },
        ],
      },
      { $set: { status: 'REVOKED', registrationClaimId: null, registrationClaimExpiresAt: null } },
      { new: true }
    );
    if (!revoked) throw new BadRequestError('This invitation is expired or currently being used.', 'INVITE_UNAVAILABLE');

    try {
      return await this.create({
        contactName: oldInvite.contactName,
        email: oldInvite.email,
        phone: oldInvite.phone,
        businessName: oldInvite.businessName,
        note: oldInvite.note,
      }, adminUser);
    } catch (error) {
      await WholesalerInvite.updateOne(
        { _id: oldInvite._id, status: 'REVOKED' },
        { $set: { status: previousStatus } }
      );
      throw error;
    }
  }

  static async getAdminLinkStats() {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const now = new Date();
    const dayOfWeek = now.getDay();
    const distanceToMonday = (dayOfWeek + 6) % 7;
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - distanceToMonday);
    startOfWeek.setHours(0, 0, 0, 0);

    const [totalRegistered, registeredToday, registeredThisWeek] = await Promise.all([
      WholesalerProfile.countDocuments({
        registrationSource: 'ADMIN_LINK',
        isDeleted: false,
      }),
      WholesalerProfile.countDocuments({
        registrationSource: 'ADMIN_LINK',
        createdAt: { $gte: startOfToday },
        isDeleted: false,
      }),
      WholesalerProfile.countDocuments({
        registrationSource: 'ADMIN_LINK',
        createdAt: { $gte: startOfWeek },
        isDeleted: false,
      }),
    ]);

    return {
      registered: totalRegistered,
      today: registeredToday,
      thisWeek: registeredThisWeek,
    };
  }

  static async recordLinkOpen(code, ip, userAgent) {
    if (!code) return;
    const today = new Date().toISOString().slice(0, 10);
    const visitorHash = crypto.createHash('sha256').update(`${today}-${ip || ''}-${userAgent || ''}`).digest('hex').slice(0, 32);

    const setting = await PlatformSetting.findOne({ key: ADMIN_LINK_SETTING_KEY });
    if (!setting) return;

    const val = setting.value || {};
    const dailyOpens = val.dailyOpens || {};

    const cleanedDailyOpens = {};
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    if (dailyOpens[today]) cleanedDailyOpens[today] = dailyOpens[today];
    if (dailyOpens[yesterday]) cleanedDailyOpens[yesterday] = dailyOpens[yesterday];

    if (!cleanedDailyOpens[today]) {
      cleanedDailyOpens[today] = [];
    }

    if (!cleanedDailyOpens[today].includes(visitorHash)) {
      cleanedDailyOpens[today].push(visitorHash);
      val.linkOpens = (Number(val.linkOpens) || 0) + 1;
      val.dailyOpens = cleanedDailyOpens;
      setting.value = val;
      setting.markModified('value');
      await setting.save();
    }
  }

  static async getAdminLink() {
    let setting = await PlatformSetting.findOne({ key: ADMIN_LINK_SETTING_KEY });
    if (!setting) {
      const code = generateAdminReferralCode();
      setting = await PlatformSetting.create({
        key: ADMIN_LINK_SETTING_KEY,
        value: {
          code,
          isPaused: false,
          linkOpens: 0,
        },
        description: 'Permanent Super Admin reusable referral link for wholesaler registration',
      });
    }

    const stats = await this.getAdminLinkStats();

    return {
      code: setting.value.code,
      isPaused: Boolean(setting.value.isPaused),
      linkOpens: Number(setting.value.linkOpens || 0),
      registered: stats.registered,
      today: stats.today,
      thisWeek: stats.thisWeek,
      updatedAt: setting.updatedAt,
    };
  }

  static async regenerateAdminLink(adminUser) {
    let setting = await PlatformSetting.findOne({ key: ADMIN_LINK_SETTING_KEY });
    const newCode = generateAdminReferralCode();
    if (!setting) {
      setting = await PlatformSetting.create({
        key: ADMIN_LINK_SETTING_KEY,
        value: {
          code: newCode,
          isPaused: false,
          linkOpens: 0,
        },
        description: 'Permanent Super Admin reusable referral link for wholesaler registration',
        updatedBy: adminUser?._id,
      });
    } else {
      const val = setting.value || {};
      val.code = newCode;
      val.isPaused = false;
      setting.value = val;
      setting.updatedBy = adminUser?._id;
      setting.markModified('value');
      await setting.save();
    }

    const stats = await this.getAdminLinkStats();

    return {
      code: setting.value.code,
      isPaused: Boolean(setting.value.isPaused),
      linkOpens: Number(setting.value.linkOpens || 0),
      registered: stats.registered,
      today: stats.today,
      thisWeek: stats.thisWeek,
      updatedAt: setting.updatedAt,
    };
  }

  static async toggleAdminLinkPause(isPaused, adminUser) {
    let setting = await PlatformSetting.findOne({ key: ADMIN_LINK_SETTING_KEY });
    if (!setting) {
      await this.getAdminLink();
      setting = await PlatformSetting.findOne({ key: ADMIN_LINK_SETTING_KEY });
    }

    const val = setting.value || {};
    val.isPaused = typeof isPaused === 'boolean' ? isPaused : !val.isPaused;
    setting.value = val;
    setting.updatedBy = adminUser?._id;
    setting.markModified('value');
    await setting.save();

    const stats = await this.getAdminLinkStats();

    return {
      code: setting.value.code,
      isPaused: Boolean(setting.value.isPaused),
      linkOpens: Number(setting.value.linkOpens || 0),
      registered: stats.registered,
      today: stats.today,
      thisWeek: stats.thisWeek,
      updatedAt: setting.updatedAt,
    };
  }

  static async validateAdminRef(code, clientInfo = {}) {
    if (!code || typeof code !== 'string') {
      return { valid: false, message: 'Invalid or missing referral code.' };
    }

    const setting = await PlatformSetting.findOne({ key: ADMIN_LINK_SETTING_KEY });
    if (!setting || !setting.value?.code) {
      return { valid: false, message: 'This registration link is not valid or has expired.' };
    }

    const activeCode = String(setting.value.code).trim().toUpperCase();
    const inputCode = String(code).trim().toUpperCase();

    if (activeCode !== inputCode) {
      return { valid: false, message: 'This registration link is not valid or has expired.' };
    }

    if (setting.value.isPaused) {
      return {
        valid: false,
        isPaused: true,
        message: 'This wholesaler registration link is currently paused by the administrator.',
      };
    }

    try {
      await this.recordLinkOpen(activeCode, clientInfo.ip, clientInfo.userAgent);
    } catch {
      // non-blocking
    }

    return {
      valid: true,
      isPaused: false,
      code: activeCode,
      platformName: 'VyaparOne',
    };
  }

  static async listRegisteredWholesalers(query = {}) {
    const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(query.limit, 10) || 20));

    const filter = {
      registrationSource: 'ADMIN_LINK',
      isDeleted: false,
    };

    if (query.dateFrom || query.dateTo) {
      filter.createdAt = {};
      if (query.dateFrom) filter.createdAt.$gte = new Date(query.dateFrom);
      if (query.dateTo) {
        const dateTo = new Date(query.dateTo);
        dateTo.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = dateTo;
      }
    }

    if (query.kycStatus && query.kycStatus !== 'ALL') {
      filter.kycStatus = query.kycStatus;
    }

    if (query.search?.trim()) {
      const escaped = query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { businessName: new RegExp(escaped, 'i') },
        { 'registrationDetails.ownerName': new RegExp(escaped, 'i') },
        { 'registrationDetails.phone': new RegExp(escaped, 'i') },
        { 'registrationDetails.email': new RegExp(escaped, 'i') },
        { 'address.city': new RegExp(escaped, 'i') },
        { utmCampaign: new RegExp(escaped, 'i') },
      ];
    }

    const [rows, total] = await Promise.all([
      WholesalerProfile.find(filter)
        .populate('userId', 'name email phone status isDeleted')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      WholesalerProfile.countDocuments(filter),
    ]);

    const items = rows.map((wp) => ({
      id: String(wp._id),
      userId: wp.userId ? String(wp.userId._id || wp.userId) : null,
      businessName: wp.businessName || '—',
      contactName: wp.registrationDetails?.ownerName || (wp.userId?.name) || '—',
      phone: wp.registrationDetails?.phone || (wp.userId?.phone) || '—',
      email: wp.registrationDetails?.email || (wp.userId?.email) || '—',
      city: wp.address?.city || '—',
      campaign: wp.utmCampaign || wp.utmSource || '—',
      kycStatus: wp.kycStatus || 'DRAFT',
      registeredDate: wp.createdAt,
    }));

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }
}

module.exports = WholesalerInvitesService;
