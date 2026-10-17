const mongoose = require('mongoose');
const {
  User,
  WholesalerProfile,
  RetailerProfile,
  KycApplication,
  Product,
  Order,
  Payment,
  Earning,
  Payout,
  PlatformSetting,
  WholesalerRetailerRelationship,
  Notification,
  AuditLog,
  Review,
  Coupon,
  WalletTransaction,
} = require('../../models');
const { ROLES, USER_STATUS, KYC_STATUS, ORDER_STATUS, PAYMENT_STATUS, PAYOUT_STATUS, RELATIONSHIP_STATUS } = require('../../config/constants');
const { BadRequestError, NotFoundError } = require('../../utils/errors');

class AdminService {
  /**
   * Helper to compute date range filter
   */
  static getDateFilter(range = '30d', customStart = null, customEnd = null) {
    const now = new Date();
    let startDate = new Date();

    if (range === 'today') {
      startDate.setHours(0, 0, 0, 0);
    } else if (range === '7d') {
      startDate.setDate(now.getDate() - 7);
    } else if (range === '30d') {
      startDate.setDate(now.getDate() - 30);
    } else if (range === '90d') {
      startDate.setDate(now.getDate() - 90);
    } else if (range === 'year') {
      startDate.setFullYear(now.getFullYear() - 1);
    } else if (range === 'custom' && customStart) {
      startDate = new Date(customStart);
      const endDate = customEnd ? new Date(customEnd) : now;
      return { $gte: startDate, $lte: endDate };
    } else {
      startDate.setDate(now.getDate() - 30);
    }

    return { $gte: startDate, $lte: now };
  }

  /**
   * Real MongoDB Aggregation Dashboard Metrics
   */
  static async getDashboardMetrics(query = {}) {
    const { range = '30d', startDate, endDate } = query;
    const dateFilter = this.getDateFilter(range, startDate, endDate);

    // Wholesalers counts
    const [wholesalerStats] = await WholesalerProfile.aggregate([
      {
        $facet: {
          total: [{ $match: { isDeleted: false } }, { $count: 'count' }],
          active: [{ $match: { isDeleted: false, kycStatus: KYC_STATUS.APPROVED } }, { $count: 'count' }],
          pendingKyc: [
            {
              $match: {
                isDeleted: false,
                kycStatus: { $in: [KYC_STATUS.SUBMITTED, KYC_STATUS.UNDER_REVIEW] },
              },
            },
            { $count: 'count' },
          ],
          suspended: [{ $match: { isDeleted: false, kycStatus: KYC_STATUS.SUSPENDED } }, { $count: 'count' }],
        },
      },
    ]);

    // Retailers counts
    const [retailerStats] = await RetailerProfile.aggregate([
      {
        $facet: {
          total: [{ $match: { isDeleted: false } }, { $count: 'count' }],
          active: [{ $match: { isDeleted: false, assignedWholesalerId: { $ne: null } } }, { $count: 'count' }],
        },
      },
    ]);

    // Products counts
    const [productStats] = await Product.aggregate([
      {
        $facet: {
          total: [{ $match: { isDeleted: false } }, { $count: 'count' }],
          active: [{ $match: { isDeleted: false, status: 'ACTIVE' } }, { $count: 'count' }],
        },
      },
    ]);

    // Orders counts and totals in date range
    const [orderStats] = await Order.aggregate([
      {
        $facet: {
          total: [{ $count: 'count' }],
          pending: [{ $match: { orderStatus: ORDER_STATUS.PENDING } }, { $count: 'count' }],
          delivered: [{ $match: { orderStatus: ORDER_STATUS.DELIVERED } }, { $count: 'count' }],
          cancelled: [{ $match: { orderStatus: ORDER_STATUS.CANCELLED } }, { $count: 'count' }],
          financials: [
            { $match: { orderStatus: { $ne: ORDER_STATUS.CANCELLED }, createdAt: dateFilter } },
            {
              $group: {
                _id: null,
                gmv: { $sum: '$grandTotal' },
                orderCount: { $sum: 1 },
              },
            },
          ],
        },
      },
    ]);

    // Earnings in date range
    const [earningsStats] = await Earning.aggregate([
      { $match: { createdAt: dateFilter } },
      {
        $group: {
          _id: null,
          platformEarnings: { $sum: '$platformCommission' },
          wholesalerEarnings: { $sum: '$wholesalerAmount' },
          grossRevenue: { $sum: '$grossAmount' },
        },
      },
    ]);

    // Payouts stats
    const [payoutStats] = await Payout.aggregate([
      {
        $facet: {
          pending: [
            {
              $match: {
                status: { $in: [PAYOUT_STATUS.REQUESTED, PAYOUT_STATUS.UNDER_REVIEW, PAYOUT_STATUS.PROCESSING] },
              },
            },
            {
              $group: {
                _id: null,
                count: { $sum: 1 },
                amount: { $sum: '$amount' },
              },
            },
          ],
          completed: [
            { $match: { status: PAYOUT_STATUS.PAID } },
            {
              $group: {
                _id: null,
                count: { $sum: 1 },
                amount: { $sum: '$amount' },
              },
            },
          ],
        },
      },
    ]);

    // Recent 5 orders
    const recentOrders = await Order.find()
      .populate('retailerId', 'name email')
      .populate('wholesalerId', 'name email')
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    // Recent 5 KYC applications
    const pendingKycList = await KycApplication.find({
      status: { $in: [KYC_STATUS.SUBMITTED, KYC_STATUS.UNDER_REVIEW] },
    })
      .populate('wholesalerId', 'name email phone')
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    return {
      overview: {
        wholesalers: {
          total: wholesalerStats.total[0]?.count || 0,
          active: wholesalerStats.active[0]?.count || 0,
          pendingKyc: wholesalerStats.pendingKyc[0]?.count || 0,
          suspended: wholesalerStats.suspended[0]?.count || 0,
        },
        retailers: {
          total: retailerStats.total[0]?.count || 0,
          active: retailerStats.active[0]?.count || 0,
        },
        products: {
          total: productStats.total[0]?.count || 0,
          active: productStats.active[0]?.count || 0,
        },
        orders: {
          total: orderStats.total[0]?.count || 0,
          pending: orderStats.pending[0]?.count || 0,
          delivered: orderStats.delivered[0]?.count || 0,
          cancelled: orderStats.cancelled[0]?.count || 0,
        },
        financials: {
          gmv: orderStats.financials[0]?.gmv || 0,
          platformEarnings: earningsStats?.platformEarnings || 0,
          wholesalerEarnings: earningsStats?.wholesalerEarnings || 0,
          grossRevenue: earningsStats?.grossRevenue || 0,
          pendingPayoutsAmount: payoutStats.pending[0]?.amount || 0,
          pendingPayoutsCount: payoutStats.pending[0]?.count || 0,
          completedPayoutsAmount: payoutStats.completed[0]?.amount || 0,
        },
      },
      recentOrders,
      pendingKycList,
      appliedDateRange: range,
    };
  }

  /**
   * Deep Analytics Aggregations
   */
  static async getAnalytics(query = {}) {
    const { range = '30d' } = query;
    const dateFilter = this.getDateFilter(range);

    // Order trends grouped by day
    const salesTrends = await Order.aggregate([
      { $match: { orderStatus: { $ne: ORDER_STATUS.CANCELLED }, createdAt: dateFilter } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          totalSales: { $sum: '$grandTotal' },
          ordersCount: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Average Order Value (AOV)
    const [aovResult] = await Order.aggregate([
      { $match: { orderStatus: { $ne: ORDER_STATUS.CANCELLED } } },
      {
        $group: {
          _id: null,
          avgOrderValue: { $avg: '$grandTotal' },
          totalOrders: { $sum: 1 },
        },
      },
    ]);

    // Top 5 Wholesalers by GMV
    const topWholesalers = await Order.aggregate([
      { $match: { orderStatus: { $ne: ORDER_STATUS.CANCELLED } } },
      {
        $group: {
          _id: '$wholesalerId',
          totalVolume: { $sum: '$grandTotal' },
          ordersCount: { $sum: 1 },
        },
      },
      { $sort: { totalVolume: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: '$user' },
      {
        $project: {
          wholesalerId: '$_id',
          name: '$user.name',
          email: '$user.email',
          totalVolume: 1,
          ordersCount: 1,
        },
      },
    ]);

    return {
      salesTrends,
      aov: Math.round((aovResult?.avgOrderValue || 0) * 100) / 100,
      totalOrders: aovResult?.totalOrders || 0,
      topWholesalers,
    };
  }

  /**
   * Get Wholesaler-Retailer Relationships with metrics
   */
  static async getRelationships(query = {}) {
    const {
      page = 1,
      limit = 10,
      search = '',
      status = 'all',
      wholesaler = 'all',
      retailer = 'all',
      dateFrom,
      dateTo,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 10);
    const skip = (pageNum - 1) * limitNum;

    const match = {};

    if (status !== 'all') {
      if (status === 'approved' || status === 'active' || status === 'Connected') {
        match.status = RELATIONSHIP_STATUS.ACTIVE;
      } else if (status === 'pending' || status === 'Pending') {
        match.status = RELATIONSHIP_STATUS.PENDING;
      } else if (status === 'blocked' || status === 'suspended' || status === 'Suspended') {
        match.status = { $in: [RELATIONSHIP_STATUS.SUSPENDED, RELATIONSHIP_STATUS.TERMINATED, RELATIONSHIP_STATUS.BLOCKED] };
      } else {
        match.status = status;
      }
    }

    if (wholesaler !== 'all' && wholesaler && mongoose.Types.ObjectId.isValid(wholesaler)) {
      match.wholesalerId = new mongoose.Types.ObjectId(wholesaler);
    }

    if (retailer !== 'all' && retailer && mongoose.Types.ObjectId.isValid(retailer)) {
      match.retailerId = new mongoose.Types.ObjectId(retailer);
    }

    if (dateFrom || dateTo) {
      match.createdAt = {};
      if (dateFrom) match.createdAt.$gte = new Date(dateFrom);
      if (dateTo) match.createdAt.$lte = new Date(dateTo);
    }

    const allRels = await WholesalerRetailerRelationship.find(match)
      .populate('wholesalerId', 'name email businessName city')
      .populate('retailerId', 'name email businessName city')
      .sort({ [sortBy === 'createdAt' ? 'createdAt' : sortBy]: sortOrder === 'asc' ? 1 : -1 })
      .lean();

    let filteredRels = allRels;
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      filteredRels = allRels.filter((rel) => {
        const wName = (rel.wholesalerId?.name || rel.wholesalerId?.businessName || '').toLowerCase();
        const rName = (rel.retailerId?.name || rel.retailerId?.businessName || '').toLowerCase();
        const city = (rel.retailerId?.city || rel.wholesalerId?.city || '').toLowerCase();
        return wName.includes(q) || rName.includes(q) || city.includes(q);
      });
    }

    const totalCount = filteredRels.length;
    const paginatedRels = filteredRels.slice(skip, skip + limitNum);

    const totalAllRels = await WholesalerRetailerRelationship.find({}).lean();
    const activeRels = totalAllRels.filter((r) => r.status === RELATIONSHIP_STATUS.ACTIVE || r.status === 'APPROVED' || r.status === 'approved' || r.status === 'ACTIVE');
    const uniqueWholesalers = new Set(activeRels.map((r) => String(r.wholesalerId?._id || r.wholesalerId))).size;
    const uniqueRetailers = new Set(activeRels.map((r) => String(r.retailerId?._id || r.retailerId))).size;

    const items = await Promise.all(
      paginatedRels.map(async (rel) => {
        const wholesalerUser = rel.wholesalerId || {};
        const retailerUser = rel.retailerId || {};

        const [wProf, rProf, orderStats] = await Promise.all([
          wholesalerUser._id ? WholesalerProfile.findOne({ userId: wholesalerUser._id }).lean() : null,
          retailerUser._id ? RetailerProfile.findOne({ userId: retailerUser._id }).lean() : null,
          (wholesalerUser._id && retailerUser._id)
            ? Order.aggregate([
                {
                  $match: {
                    wholesalerId: wholesalerUser._id,
                    retailerId: retailerUser._id,
                    orderStatus: { $ne: ORDER_STATUS.CANCELLED },
                  },
                },
                {
                  $group: {
                    _id: null,
                    count: { $sum: 1 },
                    totalValue: { $sum: '$grandTotal' },
                  },
                },
              ])
            : [],
        ]);

        const orderCount = orderStats[0]?.count || 0;
        const totalValue = orderStats[0]?.totalValue || 0;

        const wName = wProf?.businessName || wholesalerUser.businessName || wholesalerUser.name || 'Wholesaler';
        const rName = rProf?.businessName || retailerUser.businessName || retailerUser.name || 'Retailer';
        const location = rProf?.city || retailerUser.city || wProf?.city || 'India';

        const rawStatus = String(rel.status || 'ACTIVE').toUpperCase();
        const mappedStatus =
          rawStatus === 'ACTIVE' || rawStatus === 'APPROVED' ? 'approved' :
          rawStatus === 'PENDING' ? 'pending' : 'blocked';

        return {
          id: String(rel._id),
          wholesaler: { id: String(wholesalerUser._id || ''), name: wName, email: wholesalerUser.email || '' },
          retailer: { id: String(retailerUser._id || ''), name: rName, email: retailerUser.email || '' },
          location,
          orders: orderCount,
          value: totalValue,
          status: mappedStatus,
          createdAt: rel.createdAt || rel.joinedAt || rel.approvedAt,
        };
      })
    );

    const [allWholesalers, allRetailers, tradeValueAgg] = await Promise.all([
      User.find({ role: ROLES.WHOLESALER, isDeleted: false }).select('name businessName').lean(),
      User.find({ role: ROLES.RETAILER, isDeleted: false }).select('name businessName').lean(),
      Order.aggregate([
        { $match: { orderStatus: { $ne: ORDER_STATUS.CANCELLED } } },
        { $group: { _id: null, totalTradeValue: { $sum: '$grandTotal' } } },
      ]),
    ]);

    const totalTradeValue = tradeValueAgg[0]?.totalTradeValue || 0;

    return {
      items,
      metrics: {
        totalConnections: totalAllRels.length,
        activeConnections: activeRels.length,
        wholesalersConnected: uniqueWholesalers,
        retailersConnected: uniqueRetailers,
        totalTradeValue,
      },
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limitNum) || 1,
      },
      filters: {
        wholesalers: allWholesalers.map((w) => ({ id: String(w._id), name: w.businessName || w.name })),
        retailers: allRetailers.map((r) => ({ id: String(r._id), name: r.businessName || r.name })),
      },
    };
  }

  static async createRelationship(data) {
    const { wholesaler, retailer } = data;
    if (!wholesaler || !retailer) {
      throw new BadRequestError('Wholesaler and Retailer are required');
    }

    const relationship = await WholesalerRetailerRelationship.findOneAndUpdate(
      { wholesalerId: wholesaler, retailerId: retailer },
      { wholesalerId: wholesaler, retailerId: retailer, status: RELATIONSHIP_STATUS.ACTIVE, approvedAt: new Date() },
      { upsert: true, new: true }
    );
    return relationship;
  }

  static async updateRelationshipStatus(id, status) {
    const mapped =
      status === 'approved' || status === 'active' ? RELATIONSHIP_STATUS.ACTIVE :
      status === 'blocked' || status === 'suspended' ? RELATIONSHIP_STATUS.SUSPENDED : status;

    const relationship = await WholesalerRetailerRelationship.findByIdAndUpdate(
      id,
      { status: mapped },
      { new: true }
    );
    if (!relationship) throw new NotFoundError('Relationship not found');
    return relationship;
  }

  static async deleteRelationship(id) {
    const relationship = await WholesalerRetailerRelationship.findByIdAndDelete(id);
    if (!relationship) throw new NotFoundError('Relationship not found');
    return { success: true };
  }

  static async getRelationshipById(id) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new BadRequestError('Invalid relationship ID');
    }

    const rel = await WholesalerRetailerRelationship.findById(id)
      .populate('wholesalerId', 'name email phone businessName city state')
      .populate('retailerId', 'name email phone businessName city state street pincode gstin')
      .lean();

    if (!rel) {
      throw new NotFoundError('Relationship not found');
    }

    const wholesalerUser = rel.wholesalerId || {};
    const retailerUser = rel.retailerId || {};

    const [wProf, rProf, orders] = await Promise.all([
      wholesalerUser._id ? WholesalerProfile.findOne({ userId: wholesalerUser._id }).lean() : null,
      retailerUser._id ? RetailerProfile.findOne({ userId: retailerUser._id }).lean() : null,
      (wholesalerUser._id && retailerUser._id)
        ? Order.find({
            wholesalerId: wholesalerUser._id,
            retailerId: retailerUser._id,
          })
            .sort({ createdAt: -1 })
            .lean()
        : [],
    ]);

    const totalSpent = orders.reduce((sum, o) => (o.orderStatus === 'CANCELLED' ? sum : sum + Number(o.grandTotal || o.totalAmount || 0)), 0);

    const rawStatus = String(rel.status || 'ACTIVE').toUpperCase();
    const mappedStatus =
      rawStatus === 'ACTIVE' || rawStatus === 'APPROVED' ? 'approved' :
      rawStatus === 'PENDING' ? 'pending' : 'blocked';

    return {
      id: String(rel._id),
      status: mappedStatus,
      rawStatus: rel.status,
      createdAt: rel.createdAt || rel.joinedAt || rel.approvedAt,
      approvedAt: rel.approvedAt,
      wholesaler: {
        id: String(wholesalerUser._id || ''),
        name: wProf?.businessName || wholesalerUser.businessName || wholesalerUser.name || 'Wholesaler',
        ownerName: wholesalerUser.name || '—',
        email: wholesalerUser.email || '',
        phone: wholesalerUser.phone || wProf?.phone || '',
        city: wProf?.city || wholesalerUser.city || '',
        state: wProf?.state || wholesalerUser.state || '',
        businessType: wProf?.businessType || 'Wholesaler',
        gstin: wProf?.gstin || '—',
      },
      retailer: {
        id: String(retailerUser._id || ''),
        name: rProf?.businessName || retailerUser.businessName || retailerUser.name || 'Retailer',
        ownerName: retailerUser.name || '—',
        email: retailerUser.email || '',
        phone: retailerUser.phone || rProf?.phone || '',
        city: rProf?.city || retailerUser.city || '',
        state: rProf?.state || retailerUser.state || '',
        street: rProf?.street || retailerUser.street || '',
        pincode: rProf?.pincode || retailerUser.pincode || '',
        gstin: rProf?.gstin || retailerUser.gstin || '—',
        gstStatus: rProf?.gstStatus || (rProf?.gstRegistered ? 'REGISTERED' : 'UNREGISTERED'),
      },
      metrics: {
        totalOrders: orders.length,
        totalTradeValue: totalSpent,
      },
      orders: orders.map((o) => ({
        id: String(o._id),
        orderNo: o.orderNo || String(o._id).slice(-6),
        grandTotal: o.grandTotal || o.totalAmount,
        orderStatus: o.orderStatus || o.status,
        paymentStatus: o.paymentStatus || 'Unpaid',
        createdAt: o.createdAt,
        itemCount: Array.isArray(o.items) ? o.items.length : 0,
      })),
    };
  }

  /**
   * Get Platform Settings
   */
  static async getSettings() {
    const settings = await PlatformSetting.find().lean();
    const settingsMap = {};
    settings.forEach((s) => {
      settingsMap[s.key] = s.value;
    });

    if (!settingsMap.platformCommissionRate) {
      settingsMap.platformCommissionRate = 5.0;
    }
    if (settingsMap.autoApproveKyc === undefined) {
      settingsMap.autoApproveKyc = false;
    }

    return settingsMap;
  }

  /**
   * Update Platform Settings
   */
  static async updateSettings(settingsObject, user) {
    const updated = [];
    for (const [key, value] of Object.entries(settingsObject)) {
      const setting = await PlatformSetting.findOneAndUpdate(
        { key },
        { key, value, updatedBy: user._id },
        { upsert: true, new: true }
      );
      updated.push(setting);
    }
    return this.getSettings();
  }

  /**
   * Get Dashboard Stats
   */
  static async getDashboardStats(query = {}) {
    const { range = '30d' } = query;

    const [wholesalers, retailers, products, orders, users] = await Promise.all([
      WholesalerProfile.aggregate([
        {
          $facet: {
            total: [{ $match: { isDeleted: false } }, { $count: 'c' }],
            active: [{ $match: { isDeleted: false, kycStatus: KYC_STATUS.APPROVED } }, { $count: 'c' }],
          },
        },
      ]),
      RetailerProfile.aggregate([
        {
          $facet: {
            total: [{ $match: { isDeleted: false } }, { $count: 'c' }],
            active: [{ $match: { isDeleted: false, assignedWholesalerId: { $ne: null } } }, { $count: 'c' }],
          },
        },
      ]),
      Product.aggregate([
        {
          $facet: {
            total: [{ $match: { isDeleted: false } }, { $count: 'c' }],
          },
        },
      ]),
      Order.aggregate([
        {
          $facet: {
            total: [{ $count: 'c' }],
            pending: [{ $match: { orderStatus: ORDER_STATUS.PENDING } }, { $count: 'c' }],
            gmv: [{ $match: { orderStatus: { $ne: ORDER_STATUS.CANCELLED } } }, { $group: { _id: null, sum: { $sum: '$grandTotal' } } }],
          },
        },
      ]),
      User.aggregate([
        {
          $facet: {
            total: [{ $match: { isDeleted: false } }, { $count: 'c' }],
            active: [{ $match: { isDeleted: false, status: USER_STATUS.ACTIVE } }, { $count: 'c' }],
            inactive: [{ $match: { isDeleted: false, status: { $ne: USER_STATUS.ACTIVE } } }, { $count: 'c' }],
          },
        },
      ]),
    ]);

    const totalW = wholesalers[0]?.total[0]?.c || 0;
    const activeW = wholesalers[0]?.active[0]?.c || totalW;
    const totalR = retailers[0]?.total[0]?.c || 0;
    const activeR = retailers[0]?.active[0]?.c || totalR;
    const totalP = products[0]?.total[0]?.c || 0;
    const totalO = orders[0]?.total[0]?.c || 0;
    const pendingO = orders[0]?.pending[0]?.c || 0;
    const gmv = orders[0]?.gmv[0]?.sum || 0;
    const totalU = users[0]?.total[0]?.c || (totalW + totalR);
    const activeU = users[0]?.active[0]?.c || (activeW + activeR);
    const inactiveU = users[0]?.inactive[0]?.c || 0;

    return {
      totalWholesalers: totalW,
      activeWholesalers: activeW,
      pendingOrders: pendingO,
      totalRetailers: totalR,
      activeRetailers: activeR,
      totalProducts: totalP,
      totalOrders: totalO,
      totalTransactionAmount: gmv,
      totalUsers: totalU,
      activeUsers: activeU,
      inactiveUsers: inactiveU,
    };
  }

  /**
   * Get Dashboard Charts by metric
   */
  static async getDashboardChart(chartType, query = {}) {
    const { period = '30d' } = query;
    const dateFilter = this.getDateFilter(period);

    if (chartType === 'orders-over-time') {
      const agg = await Order.aggregate([
        { $match: { createdAt: dateFilter } },
        {
          $group: {
            _id: { $dateToString: { format: '%b %d', date: '$createdAt' } },
            orders: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]);
      return { data: agg.map((item) => ({ label: item._id, orders: item.orders })) };
    }

    if (chartType === 'revenue-over-time') {
      const agg = await Order.aggregate([
        { $match: { orderStatus: { $ne: ORDER_STATUS.CANCELLED }, createdAt: dateFilter } },
        {
          $group: {
            _id: { $dateToString: { format: '%b %d', date: '$createdAt' } },
            revenue: { $sum: '$grandTotal' },
          },
        },
        { $sort: { _id: 1 } },
      ]);
      return { data: agg.map((item) => ({ label: item._id, revenue: item.revenue })) };
    }

    if (chartType === 'top-wholesalers') {
      const topW = await Order.aggregate([
        { $match: { orderStatus: { $ne: ORDER_STATUS.CANCELLED } } },
        {
          $group: {
            _id: '$wholesalerId',
            sales: { $sum: '$grandTotal' },
            orders: { $sum: 1 },
          },
        },
        { $sort: { sales: -1 } },
        { $limit: 5 },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'user',
          },
        },
        { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            name: { $ifNull: ['$user.businessName', '$user.name', 'Wholesaler'] },
            sales: 1,
            orders: 1,
          },
        },
      ]);
      return topW;
    }

    if (chartType === 'top-retailers') {
      const topR = await Order.aggregate([
        { $match: { orderStatus: { $ne: ORDER_STATUS.CANCELLED } } },
        {
          $group: {
            _id: '$retailerId',
            spent: { $sum: '$grandTotal' },
            orders: { $sum: 1 },
          },
        },
        { $sort: { spent: -1 } },
        { $limit: 5 },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'user',
          },
        },
        { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            name: { $ifNull: ['$user.businessName', '$user.name', 'Retailer'] },
            spent: 1,
            orders: 1,
          },
        },
      ]);
      return topR;
    }

    if (chartType === 'orders-by-status') {
      const agg = await Order.aggregate([
        {
          $group: {
            _id: '$orderStatus',
            value: { $sum: 1 },
          },
        },
      ]);
      return {
        data: agg.map((item) => ({
          name: String(item._id || 'PENDING').toUpperCase(),
          value: item.value,
        })),
      };
    }

    return { data: [] };
  }

  /**
   * Get Dashboard Recent Records
   */
  static async getDashboardRecent() {
    const [recentOrders, recentUsers, pendingApprovals, lowStock] = await Promise.all([
      Order.find()
        .populate('retailerId', 'name businessName email')
        .populate('wholesalerId', 'name businessName email')
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
      User.find({ isDeleted: false })
        .select('name businessName email role createdAt')
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
      KycApplication.find({ status: { $in: [KYC_STATUS.SUBMITTED, KYC_STATUS.UNDER_REVIEW] } })
        .populate('wholesalerId', 'name businessName email phone')
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
      Product.find({ isDeleted: false, quantity: { $lte: 10 } })
        .select('name sku quantity wholesalePrice')
        .limit(5)
        .lean(),
    ]);

    return {
      recentOrders: recentOrders.map((o) => ({
        id: String(o._id),
        orderNumber: o.orderNumber,
        retailer: o.retailerId?.businessName || o.retailerId?.name || 'Retailer',
        wholesaler: o.wholesalerId?.businessName || o.wholesalerId?.name || 'Wholesaler',
        amount: o.grandTotal,
        status: o.orderStatus,
        createdAt: o.createdAt,
      })),
      recentRegistrations: recentUsers.map((u) => ({
        id: String(u._id),
        name: u.businessName || u.name,
        email: u.email,
        role: u.role,
        createdAt: u.createdAt,
      })),
      pendingApprovals: pendingApprovals.map((k) => ({
        id: String(k._id),
        wholesalerName: k.wholesalerId?.businessName || k.wholesalerId?.name || 'Wholesaler',
        status: k.status,
        createdAt: k.createdAt,
      })),
      lowStock: lowStock.map((p) => ({
        id: String(p._id),
        name: p.name,
        sku: p.sku,
        stock: p.quantity,
        price: p.wholesalePrice,
      })),
    };
  }

  /**
   * Get Comprehensive Super Admin Reports & Analytics Data
   */
  static async getReports(query = {}) {
    const days = parseInt(query.days, 10) || 30;
    const dateFilter = this.getDateFilter(`${days}d`);

    const [
      summaryAgg,
      dailyAgg,
      topWholesalersAgg,
      topRetailersAgg,
      topProductsAgg,
      categoryAgg,
      payoutAgg,
    ] = await Promise.all([
      // Summary Aggregation
      Order.aggregate([
        { $match: { createdAt: dateFilter } },
        {
          $group: {
            _id: null,
            totalSales: { $sum: '$grandTotal' },
            taxableAmount: { $sum: { $multiply: ['$grandTotal', 0.8475] } },
            totalGst: { $sum: { $multiply: ['$grandTotal', 0.1525] } },
            totalTds: { $sum: { $multiply: ['$grandTotal', 0.01] } },
            orders: { $sum: 1 },
            completedOrders: { $sum: { $cond: [{ $eq: ['$orderStatus', ORDER_STATUS.DELIVERED] }, 1, 0] } },
            cancelledOrders: { $sum: { $cond: [{ $eq: ['$orderStatus', ORDER_STATUS.CANCELLED] }, 1, 0] } },
            avgOrderValue: { $avg: '$grandTotal' },
          },
        },
      ]),
      // Daily Sales Trend Aggregation
      Order.aggregate([
        { $match: { orderStatus: { $ne: ORDER_STATUS.CANCELLED }, createdAt: dateFilter } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            orders: { $sum: 1 },
            sales: { $sum: '$grandTotal' },
            gst: { $sum: { $multiply: ['$grandTotal', 0.1525] } },
            tds: { $sum: { $multiply: ['$grandTotal', 0.01] } },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      // Top Earners - Wholesalers
      Order.aggregate([
        { $match: { orderStatus: { $ne: ORDER_STATUS.CANCELLED } } },
        {
          $group: {
            _id: '$wholesalerId',
            totalSales: { $sum: '$grandTotal' },
            totalOrders: { $sum: 1 },
          },
        },
        { $sort: { totalSales: -1 } },
        { $limit: 10 },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'user',
          },
        },
        { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: 'wholesalerprofiles',
            localField: '_id',
            foreignField: 'userId',
            as: 'profile',
          },
        },
        { $unwind: { path: '$profile', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            id: '$_id',
            name: { $ifNull: ['$profile.businessName', '$user.businessName', '$user.name', 'Wholesaler'] },
            email: '$user.email',
            phone: '$user.phone',
            gstin: '$profile.gstin',
            totalSales: 1,
            totalOrders: 1,
            netEarnings: { $multiply: ['$totalSales', 0.94] },
            tdsDeducted: { $multiply: ['$totalSales', 0.01] },
            gstAmount: { $multiply: ['$totalSales', 0.1525] },
          },
        },
      ]),
      // Top Buyers - Retailers
      Order.aggregate([
        { $match: { orderStatus: { $ne: ORDER_STATUS.CANCELLED } } },
        {
          $group: {
            _id: '$retailerId',
            totalSpent: { $sum: '$grandTotal' },
            totalOrders: { $sum: 1 },
          },
        },
        { $sort: { totalSpent: -1 } },
        { $limit: 10 },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'user',
          },
        },
        { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: 'retailerprofiles',
            localField: '_id',
            foreignField: 'userId',
            as: 'profile',
          },
        },
        { $unwind: { path: '$profile', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            id: '$_id',
            name: { $ifNull: ['$profile.businessName', '$user.businessName', '$user.name', 'Retailer'] },
            email: '$user.email',
            phone: '$user.phone',
            gstin: '$profile.gstin',
            totalSpent: 1,
            totalOrders: 1,
          },
        },
      ]),
      // Top Selling Products
      Product.aggregate([
        { $match: { isDeleted: false } },
        { $sort: { quantity: -1 } },
        { $limit: 10 },
        {
          $project: {
            id: '$_id',
            name: 1,
            sku: 1,
            category: 1,
            price: '$wholesalePrice',
            stock: '$quantity',
          },
        },
      ]),
      // Category Sales
      Order.aggregate([
        { $match: { orderStatus: { $ne: ORDER_STATUS.CANCELLED } } },
        { $unwind: { path: '$items', preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: '$items.categoryName',
            totalSales: { $sum: { $multiply: ['$items.unitPrice', '$items.quantity'] } },
            itemsSold: { $sum: '$items.quantity' },
          },
        },
        { $sort: { totalSales: -1 } },
      ]),
      // Payouts
      Payout.find()
        .populate('wholesalerId', 'name businessName email')
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),
    ]);

    const s = summaryAgg[0] || {};
    const totalSales = s.totalSales || 0;
    const taxableAmount = Math.round(s.taxableAmount || totalSales * 0.8475);
    const totalGst = Math.round(s.totalGst || totalSales * 0.1525);
    const totalTds = Math.round(s.totalTds || totalSales * 0.01);

    const totalProducts = await Product.countDocuments({ isDeleted: false });
    const lowStockCount = await Product.countDocuments({ isDeleted: false, quantity: { $lte: 10, $gt: 0 } });
    const zeroStockCount = await Product.countDocuments({ isDeleted: false, quantity: 0 });

    return {
      summary: {
        totalSales,
        taxableAmount,
        totalGst,
        cgst: Math.round(totalGst / 2),
        sgst: Math.round(totalGst / 2),
        igst: Math.round(totalGst),
        totalTds,
        orders: s.orders || 0,
        completedOrders: s.completedOrders || 0,
        cancelledOrders: s.cancelledOrders || 0,
        avgOrderValue: Math.round(s.avgOrderValue || 0),
        totalProducts,
        lowStockCount,
        zeroStockCount,
      },
      daily: dailyAgg,
      topWholesalers: topWholesalersAgg,
      topRetailers: topRetailersAgg,
      topProducts: topProductsAgg,
      categorySales: categoryAgg.map((c) => ({
        name: c._id || 'General',
        sales: c.totalSales || Math.round(totalSales * 0.3),
        itemsSold: c.itemsSold || 15,
      })),
      payouts: payoutAgg.map((p) => ({
        id: String(p._id),
        wholesaler: p.wholesalerId?.businessName || p.wholesalerId?.name || 'Wholesaler',
        amount: p.amount,
        status: p.status,
        referenceId: p.referenceId || `PAY-${String(p._id).slice(-6)}`,
        createdAt: p.createdAt,
      })),
      tdsLedger: topWholesalersAgg.map((w) => ({
        id: w.id,
        name: w.name,
        email: w.email,
        pan: w.gstin && w.gstin.length >= 12 ? w.gstin.substring(2, 12) : 'ABCDE1234F',
        gstin: w.gstin || 'NON-GST',
        grossTrade: w.totalSales,
        tdsDeducted: Math.round(w.totalSales * 0.01),
        netPayable: Math.round(w.totalSales * 0.99),
      })),
    };
  }

  /**
   * Payments Endpoints
   */
  static async getPaymentsSummary() {
    const [agg] = await Order.aggregate([
      {
        $facet: {
          collected: [
            { $match: { paymentStatus: 'PAID' } },
            { $group: { _id: null, amount: { $sum: '$grandTotal' }, count: { $sum: 1 } } },
          ],
          pending: [
            { $match: { paymentStatus: { $in: ['PENDING', 'UNPAID'] } } },
            { $group: { _id: null, amount: { $sum: '$grandTotal' }, count: { $sum: 1 } } },
          ],
          failed: [
            { $match: { paymentStatus: 'FAILED' } },
            { $group: { _id: null, amount: { $sum: '$grandTotal' }, count: { $sum: 1 } } },
          ],
        },
      },
    ]);

    return {
      totalCollected: agg.collected[0]?.amount || 0,
      pendingVerification: agg.pending[0]?.amount || 0,
      verifiedCount: agg.collected[0]?.count || 0,
      failedCount: agg.failed[0]?.count || 0,
    };
  }

  static async getPayments(query = {}) {
    const { page = 1, limit = 10, search, status, method, wholesaler, retailer, dateFrom, dateTo, minAmount, maxAmount, sortBy = 'createdAt', sortOrder = 'desc' } = query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 10);
    const skip = (pageNum - 1) * limitNum;

    const paymentFilter = {};
    if (status && status !== 'all') {
      const upperStatus = status.toUpperCase();
      if (upperStatus === 'SUCCESS') paymentFilter.status = { $in: [PAYMENT_STATUS.PAID, 'SUCCESS', 'COMPLETED'] };
      else if (upperStatus === 'PENDING') paymentFilter.status = { $in: [PAYMENT_STATUS.PENDING, 'UNPAID', 'PENDING_VERIFICATION'] };
      else if (upperStatus === 'FAILED') paymentFilter.status = PAYMENT_STATUS.FAILED;
      else if (upperStatus === 'REFUNDED') paymentFilter.status = PAYMENT_STATUS.REFUNDED;
    }

    if (method && method !== 'all') {
      paymentFilter.paymentMethod = method.toUpperCase();
    }

    if (wholesaler && wholesaler !== 'all') paymentFilter.wholesalerId = wholesaler;
    if (retailer && retailer !== 'all') paymentFilter.retailerId = retailer;

    if (minAmount || maxAmount) {
      paymentFilter.amount = {};
      if (minAmount) paymentFilter.amount.$gte = Number(minAmount);
      if (maxAmount) paymentFilter.amount.$lte = Number(maxAmount);
    }

    const sortDir = sortOrder === 'asc' ? 1 : -1;

    let payments = await Payment.find(paymentFilter)
      .populate('orderId')
      .populate('retailerId', 'name email phone businessName')
      .populate('wholesalerId', 'name email phone businessName')
      .sort({ [sortBy]: sortDir })
      .skip(skip)
      .limit(limitNum)
      .lean();

    let total = await Payment.countDocuments(paymentFilter);

    if (payments.length === 0 && total === 0) {
      const orderFilter = {};
      if (wholesaler && wholesaler !== 'all') orderFilter.wholesalerId = wholesaler;
      if (retailer && retailer !== 'all') orderFilter.retailerId = retailer;

      const orders = await Order.find(orderFilter)
        .populate('retailerId', 'name email phone businessName')
        .populate('wholesalerId', 'name email phone businessName')
        .sort({ createdAt: sortDir })
        .skip(skip)
        .limit(limitNum)
        .lean();

      total = await Order.countDocuments(orderFilter);

      payments = orders.map((o) => ({
        _id: o._id,
        orderId: o,
        retailerId: o.retailerId,
        wholesalerId: o.wholesalerId,
        amount: o.grandTotal,
        currency: 'INR',
        status: o.paymentStatus || 'PENDING',
        paymentMethod: o.paymentMethod || 'CREDIT',
        transactionReference: o.orderNumber ? `PAY-${o.orderNumber}` : `PAY-${o._id}`,
        createdAt: o.createdAt,
      }));
    }

    const [wholesalers, retailers] = await Promise.all([
      User.find({ role: ROLES.WHOLESALER, isDeleted: false }).select('name businessName').lean(),
      User.find({ role: ROLES.RETAILER, isDeleted: false }).select('name businessName').lean(),
    ]);

    const formatMethod = (m) => {
      const str = String(m || '').toUpperCase();
      if (str === 'CREDIT') return 'credit';
      if (str === 'COD' || str === 'CASH_ON_DELIVERY') return 'cod';
      if (str === 'UPI') return 'upi';
      if (str === 'CARD') return 'card';
      if (str === 'WALLET') return 'wallet';
      return 'credit';
    };

    const formatStatus = (s) => {
      const str = String(s || '').toUpperCase();
      if (str === 'PAID' || str === 'COMPLETED' || str === 'SUCCESS') return 'success';
      if (str === 'PENDING' || str === 'UNPAID') return 'pending';
      if (str === 'FAILED') return 'failed';
      if (str === 'REFUNDED') return 'refunded';
      return 'pending';
    };

    const items = payments.map((p) => {
      const orderDoc = p.orderId || {};
      const rUser = p.retailerId || orderDoc.retailerId || {};
      const wUser = p.wholesalerId || orderDoc.wholesalerId || {};

      return {
        id: String(p._id),
        transactionRef: p.transactionReference || (orderDoc.orderNumber ? `PAY-${orderDoc.orderNumber}` : String(p._id)),
        order: {
          id: String(orderDoc._id || ''),
          orderNo: orderDoc.orderNumber || '—',
        },
        retailer: {
          id: String(rUser._id || ''),
          name: rUser.name || 'Retailer',
          businessName: rUser.businessName || rUser.name || 'Retailer',
          email: rUser.email || '',
        },
        wholesaler: {
          id: String(wUser._id || ''),
          name: wUser.name || 'Wholesaler',
          businessName: wUser.businessName || wUser.name || 'Wholesaler',
          email: wUser.email || '',
        },
        amount: p.amount || orderDoc.grandTotal || 0,
        method: formatMethod(p.paymentMethod || orderDoc.paymentMethod),
        status: formatStatus(p.status || orderDoc.paymentStatus),
        createdAt: p.createdAt,
      };
    });

    return {
      items,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum) || 1,
      },
      filters: {
        wholesalers: wholesalers.map((w) => ({ id: String(w._id), name: w.businessName || w.name })),
        retailers: retailers.map((r) => ({ id: String(r._id), name: r.businessName || r.name })),
      },
    };
  }

  static async getPaymentById(paymentId) {
    let payment = await Payment.findById(paymentId)
      .populate({
        path: 'orderId',
        populate: [
          { path: 'retailerId', select: 'name email phone businessName address city state pincode' },
          { path: 'wholesalerId', select: 'name email phone businessName address city state pincode' },
          { path: 'items.productId', select: 'name sku unit' },
        ],
      })
      .populate('retailerId', 'name email phone businessName')
      .populate('wholesalerId', 'name email phone businessName')
      .lean();

    let order = payment?.orderId;

    if (!payment) {
      order = await Order.findById(paymentId)
        .populate('retailerId', 'name email phone businessName address city state pincode')
        .populate('wholesalerId', 'name email phone businessName address city state pincode')
        .populate('items.productId')
        .lean();

      if (order) {
        payment = {
          _id: order._id,
          orderId: order,
          retailerId: order.retailerId,
          wholesalerId: order.wholesalerId,
          amount: order.grandTotal,
          currency: 'INR',
          status: order.paymentStatus || 'PENDING',
          paymentMethod: order.paymentMethod || 'CREDIT',
          transactionReference: order.orderNumber ? `PAY-${order.orderNumber}` : `PAY-${order._id}`,
          createdAt: order.createdAt,
        };
      }
    }

    if (!payment && !order) {
      throw new NotFoundError('Payment details not found');
    }

    const formatMethod = (m) => {
      const str = String(m || '').toUpperCase();
      if (str === 'CREDIT') return 'credit';
      if (str === 'COD' || str === 'CASH_ON_DELIVERY') return 'cod';
      if (str === 'UPI') return 'upi';
      if (str === 'CARD') return 'card';
      if (str === 'WALLET') return 'wallet';
      return 'credit';
    };

    const formatStatus = (s) => {
      const str = String(s || '').toUpperCase();
      if (str === 'PAID' || str === 'COMPLETED' || str === 'SUCCESS') return 'success';
      if (str === 'PENDING' || str === 'UNPAID') return 'pending';
      if (str === 'FAILED') return 'failed';
      if (str === 'REFUNDED') return 'refunded';
      return 'pending';
    };

    const rUser = payment.retailerId || order?.retailerId || {};
    const wUser = payment.wholesalerId || order?.wholesalerId || {};

    const formattedPayment = {
      id: String(payment._id),
      transactionRef: payment.transactionReference || (order?.orderNumber ? `PAY-${order.orderNumber}` : String(payment._id)),
      amount: payment.amount || order?.grandTotal || 0,
      method: formatMethod(payment.paymentMethod || order?.paymentMethod),
      status: formatStatus(payment.status || order?.paymentStatus),
      createdAt: payment.createdAt,
      order: {
        id: String(order?._id || ''),
        orderNo: order?.orderNumber || '—',
        retailer: {
          id: String(rUser._id || ''),
          name: rUser.name || '',
          businessName: rUser.businessName || rUser.name || 'Retailer',
          email: rUser.email || '',
          phone: rUser.phone || '',
        },
        wholesaler: {
          id: String(wUser._id || ''),
          name: wUser.name || '',
          businessName: wUser.businessName || wUser.name || 'Wholesaler',
          email: wUser.email || '',
          phone: wUser.phone || '',
        },
      },
    };

    const items = (order?.items || []).map((item) => ({
      productName: item.productName || item.name || item.productId?.name || 'Product',
      sku: item.sku || item.productId?.sku || '—',
      quantity: item.quantity,
      pricePerUnit: item.pricePerUnit || item.price || 0,
      totalPrice: item.total || item.totalPrice || (item.quantity * (item.pricePerUnit || 0)),
      unit: item.unit || item.productId?.unit || 'Pcs',
    }));

    const formattedOrder = order ? {
      id: String(order._id),
      orderNo: order.orderNumber,
      orderNumber: order.orderNumber,
      grandTotal: order.grandTotal,
      subtotal: order.subtotal,
      tax: order.tax,
      items,
      retailer: formattedPayment.order.retailer,
      wholesaler: formattedPayment.order.wholesaler,
      createdAt: order.createdAt,
    } : null;

    return {
      payment: formattedPayment,
      order: formattedOrder,
      audits: [],
    };
  }

  static async verifyPayment(paymentId) {
    let payment = await Payment.findById(paymentId);
    if (!payment) {
      const order = await Order.findById(paymentId);
      if (order) {
        order.paymentStatus = 'PAID';
        await order.save();
        return { message: 'Payment verified successfully' };
      }
      throw new NotFoundError('Payment record not found');
    }

    payment.status = PAYMENT_STATUS.PAID;
    payment.paidAt = new Date();
    await payment.save();

    if (payment.orderId) {
      await Order.findByIdAndUpdate(payment.orderId, { paymentStatus: 'PAID' });
    }

    return { message: 'Payment verified successfully', payment };
  }

  static async refundPayment(paymentId, { amount }) {
    let payment = await Payment.findById(paymentId);
    if (!payment) {
      const order = await Order.findById(paymentId);
      if (order) {
        order.paymentStatus = 'REFUNDED';
        await order.save();
        return { message: 'Payment marked as refunded' };
      }
      throw new NotFoundError('Payment record not found');
    }

    payment.status = PAYMENT_STATUS.REFUNDED;
    await payment.save();

    if (payment.orderId) {
      await Order.findByIdAndUpdate(payment.orderId, { paymentStatus: 'REFUNDED' });
    }

    return { message: 'Payment refunded successfully', payment };
  }

  /**
   * Transactions Endpoint
   */
  static async getTransactions(query = {}) {
    const {
      page = 1,
      limit = 10,
      search,
      type,
      user,
      dateFrom,
      dateTo,
      minAmount,
      maxAmount,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 10);
    const skip = (pageNum - 1) * limitNum;
    const sortDir = sortOrder === 'asc' ? 1 : -1;

    let items = [];
    let total = 0;
    let summary = { credit: 0, debit: 0, creditCount: 0, debitCount: 0 };

    const wtCount = await WalletTransaction.countDocuments();

    if (wtCount > 0) {
      const filter = {};
      if (type && type !== 'all') filter.type = type.toUpperCase();
      if (user && user !== 'all') filter.ownerId = user;
      if (minAmount || maxAmount) {
        filter.amount = {};
        if (minAmount) filter.amount.$gte = Number(minAmount);
        if (maxAmount) filter.amount.$lte = Number(maxAmount);
      }
      if (dateFrom || dateTo) {
        filter.createdAt = {};
        if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
        if (dateTo) filter.createdAt.$lte = new Date(dateTo);
      }

      const txns = await WalletTransaction.find(filter)
        .populate('ownerId', 'name businessName email')
        .sort({ [sortBy]: sortDir })
        .skip(skip)
        .limit(limitNum)
        .lean();

      total = await WalletTransaction.countDocuments(filter);

      items = txns.map((t) => ({
        id: String(t._id),
        user: {
          id: String(t.ownerId?._id || ''),
          name: t.ownerId?.name || 'User',
          businessName: t.ownerId?.businessName || t.ownerId?.name || 'User',
        },
        type: t.type || 'Order_payment',
        amount: t.amount || 0,
        balanceAfter: t.balanceAfter || 0,
        referenceId: t.referenceId || `TXN-${t._id}`,
        createdAt: t.createdAt,
      }));

      const creditAgg = await WalletTransaction.aggregate([
        { $match: { type: { $in: ['CREDIT', 'TOPUP', 'REFUND'] } } },
        { $group: { _id: null, sum: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]);

      const debitAgg = await WalletTransaction.aggregate([
        { $match: { type: { $in: ['DEBIT', 'PAYOUT', 'PURCHASE', 'ORDER_PAYMENT'] } } },
        { $group: { _id: null, sum: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]);

      summary = {
        credit: creditAgg[0]?.sum || 0,
        debit: debitAgg[0]?.sum || 0,
        creditCount: creditAgg[0]?.count || 0,
        debitCount: debitAgg[0]?.count || 0,
      };
    } else {
      const orderFilter = { orderStatus: { $ne: ORDER_STATUS.CANCELLED } };
      if (user && user !== 'all') {
        orderFilter.$or = [{ retailerId: user }, { wholesalerId: user }];
      }
      if (minAmount || maxAmount) {
        orderFilter.grandTotal = {};
        if (minAmount) orderFilter.grandTotal.$gte = Number(minAmount);
        if (maxAmount) orderFilter.grandTotal.$lte = Number(maxAmount);
      }
      if (dateFrom || dateTo) {
        orderFilter.createdAt = {};
        if (dateFrom) orderFilter.createdAt.$gte = new Date(dateFrom);
        if (dateTo) orderFilter.createdAt.$lte = new Date(dateTo);
      }

      const orders = await Order.find(orderFilter)
        .populate('retailerId', 'name businessName email')
        .populate('wholesalerId', 'name businessName email')
        .sort({ [sortBy]: sortDir })
        .skip(skip)
        .limit(limitNum)
        .lean();

      total = await Order.countDocuments(orderFilter);

      items = orders.map((o) => {
        const rUser = o.retailerId || {};
        return {
          id: String(o._id),
          user: {
            id: String(rUser._id || ''),
            name: rUser.name || 'Retailer',
            businessName: rUser.businessName || rUser.name || 'Retailer Store',
          },
          type: 'Order_payment',
          amount: o.grandTotal || 0,
          balanceAfter: 0,
          referenceId: o.orderNumber || `ORD-${o._id}`,
          createdAt: o.createdAt,
        };
      });

      const totalSumAgg = await Order.aggregate([
        { $match: { orderStatus: { $ne: ORDER_STATUS.CANCELLED } } },
        { $group: { _id: null, sum: { $sum: '$grandTotal' }, count: { $sum: 1 } } },
      ]);

      summary = {
        credit: totalSumAgg[0]?.sum || 0,
        debit: 0,
        creditCount: totalSumAgg[0]?.count || 0,
        debitCount: 0,
      };
    }

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      items = items.filter(
        (i) =>
          (i.referenceId && i.referenceId.toLowerCase().includes(q)) ||
          (i.user?.name && i.user.name.toLowerCase().includes(q)) ||
          (i.user?.businessName && i.user.businessName.toLowerCase().includes(q)) ||
          (i.id && i.id.toLowerCase().includes(q))
      );
    }

    const usersList = await User.find({ isDeleted: false })
      .select('name businessName role')
      .lean();

    const formattedUsers = usersList.map((u) => ({
      id: String(u._id),
      name: u.businessName ? `${u.businessName} (${u.name})` : u.name || 'User',
    }));

    return {
      items,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum) || 1,
      },
      filters: {
        users: formattedUsers,
      },
      summary,
    };
  }

  /**
   * Commissions Endpoints
   */
  static async getCommissions(query = {}) {
    const { page = 1, limit = 10 } = query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 10);
    const skip = (pageNum - 1) * limitNum;

    const orders = await Order.find({ orderStatus: { $ne: ORDER_STATUS.CANCELLED } })
      .populate('retailerId', 'name businessName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    const total = await Order.countDocuments({ orderStatus: { $ne: ORDER_STATUS.CANCELLED } });

    const [salesAgg] = await Order.aggregate([
      { $match: { orderStatus: { $ne: ORDER_STATUS.CANCELLED } } },
      { $group: { _id: null, sales: { $sum: '$grandTotal' } } },
    ]);

    const sales = salesAgg?.sales || 0;
    const totalCommission = Math.round(sales * 0.035);

    return {
      items: orders.map((o) => ({
        id: String(o._id),
        orderNo: o.orderNumber,
        retailer: { name: o.retailerId?.businessName || o.retailerId?.name || 'Retailer' },
        amount: o.grandTotal,
        commission: Math.round((o.grandTotal || 0) * 0.035),
        status: 'Completed',
        createdAt: o.createdAt,
      })),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum) || 1,
      },
      summary: {
        totalCommission,
        sales,
        orders: total,
        pendingPayouts: 0,
      },
    };
  }

  /**
   * Reviews Endpoints
   */
  static async getReviews(query = {}) {
    const { page = 1, limit = 10, search = '', status = 'all', rating = 'all', userRole = 'all', dateFrom, dateTo } = query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 10);
    const skip = (pageNum - 1) * limitNum;

    const filter = { isDeleted: false };
    if (status !== 'all' && status) filter.status = status;
    if (rating !== 'all' && rating) filter.rating = parseInt(rating, 10);
    if (userRole !== 'all' && userRole) filter.userRole = userRole.toUpperCase();

    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
      if (dateTo) filter.createdAt.$lte = new Date(dateTo);
    }

    if (search && search.trim()) {
      const q = new RegExp(search.trim(), 'i');
      filter.$or = [{ comment: q }, { title: q }];
    }

    const [reviews, total, approvedCount, pendingCount, hiddenCount] = await Promise.all([
      Review.find(filter)
        .populate('userId', 'name email businessName role')
        .populate('wholesalerId', 'name email businessName')
        .populate('productId', 'name title')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Review.countDocuments(filter),
      Review.countDocuments({ isDeleted: false, status: 'approved' }),
      Review.countDocuments({ isDeleted: false, status: 'pending' }),
      Review.countDocuments({ isDeleted: false, status: 'hidden' }),
    ]);

    const items = reviews.map((r) => {
      const reviewerName = r.userId?.businessName || r.userId?.name || 'Anonymous User';
      const role = (r.userRole || r.userId?.role || 'RETAILER').toUpperCase();
      return {
        _id: String(r._id),
        id: String(r._id),
        comment: r.comment,
        title: r.title || 'Platform Feedback',
        rating: r.rating || 5,
        status: r.status || 'approved',
        userRole: role,
        createdAt: r.createdAt,
        product: r.productId
          ? { name: r.productId.name || r.productId.title }
          : { name: r.title || 'General Platform & Store Feedback' },
        retailer: {
          name: reviewerName,
          businessName: reviewerName,
          email: r.userId?.email || '',
          role,
        },
        reviewer: {
          name: reviewerName,
          email: r.userId?.email || '',
          role,
        },
        wholesaler: r.wholesalerId
          ? { name: r.wholesalerId.businessName || r.wholesalerId.name }
          : null,
      };
    });

    return {
      items,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum) || 1,
      },
      summary: {
        approved: { count: approvedCount },
        pending: { count: pendingCount },
        hidden: { count: hiddenCount },
      },
    };
  }

  static async createReview(user, body = {}) {
    const { wholesalerId, productId, title, comment, rating } = body;
    const review = await Review.create({
      userId: user._id,
      userRole: user?.role || 'RETAILER',
      wholesalerId: wholesalerId || null,
      productId: productId || null,
      title: title || 'General Platform Feedback',
      comment: comment || '',
      rating: Number(rating) || 5,
      status: 'approved',
    });
    return review;
  }

  static async updateReviewStatus(id, status) {
    const review = await Review.findByIdAndUpdate(id, { status }, { new: true });
    if (!review) throw new NotFoundError('Review not found');
    return review;
  }

  static async deleteReview(id) {
    const review = await Review.findByIdAndUpdate(id, { isDeleted: true }, { new: true });
    if (!review) throw new NotFoundError('Review not found');
    return { success: true };
  }

  /**
   * Coupons & Offers Management Endpoints
   */
  static async seedDefaultCouponsIfEmpty() {
    const count = await Coupon.countDocuments({ isDeleted: false });
    if (count === 0) {
      await Coupon.create([
        {
          code: 'WELCOME50',
          title: '50% Off Wholesaler Annual Subscription',
          description: 'Flat 50% discount on Annual Pro Subscription plan for new wholesalers',
          discountType: 'PERCENTAGE',
          discountValue: 50,
          maxDiscount: 2000,
          minPlanAmount: 1000,
          applicableFor: 'WHOLESALER_SUBSCRIPTION',
          usageLimit: 500,
          isActive: true,
        },
        {
          code: 'FESTIVE200',
          title: 'Flat ₹200 Off Subscription Plan',
          description: 'Special festive promo offer for all subscription plans',
          discountType: 'FLAT',
          discountValue: 200,
          maxDiscount: 200,
          minPlanAmount: 300,
          applicableFor: 'WHOLESALER_SUBSCRIPTION',
          usageLimit: 1000,
          isActive: true,
        },
        {
          code: 'SUPERVIP',
          title: 'VIP 70% Off Premium Plan',
          description: 'Exclusive 70% discount code for VIP verified wholesalers',
          discountType: 'PERCENTAGE',
          discountValue: 70,
          maxDiscount: 2500,
          minPlanAmount: 500,
          applicableFor: 'WHOLESALER_SUBSCRIPTION',
          usageLimit: 200,
          isActive: true,
        },
      ]);
    }
  }

  static async getCoupons(query = {}) {
    await this.seedDefaultCouponsIfEmpty();
    const { search = '', status = 'all' } = query;
    const filter = { isDeleted: false };

    if (search) {
      filter.$or = [
        { code: new RegExp(search.trim(), 'i') },
        { title: new RegExp(search.trim(), 'i') },
      ];
    }

    if (status !== 'all' && status) {
      filter.isActive = status === 'active';
    }

    const coupons = await Coupon.find(filter).sort({ createdAt: -1 }).lean();

    return {
      items: coupons.map((c) => ({
        id: String(c._id),
        code: c.code,
        title: c.title,
        description: c.description || c.title,
        discountType: c.discountType,
        discountValue: c.discountValue,
        maxDiscount: c.maxDiscount || 0,
        minPlanAmount: c.minPlanAmount || 0,
        validUntil: c.validUntil,
        usageLimit: c.usageLimit || 1000,
        usedCount: c.usedCount || 0,
        applicableFor: c.applicableFor,
        isActive: c.isActive,
        createdAt: c.createdAt,
      })),
      pagination: {
        page: 1,
        limit: coupons.length,
        total: coupons.length,
        totalPages: 1,
      },
    };
  }

  static async createCoupon(data, user = null) {
    const { code, title, description, discountType, discountValue, maxDiscount, minPlanAmount, validUntil, usageLimit, applicableFor } = data;
    if (!code || !title || discountValue === undefined) {
      throw new BadRequestError('Coupon code, title, and discount value are required');
    }

    const cleanCode = code.trim().toUpperCase();
    const existing = await Coupon.findOne({ code: cleanCode, isDeleted: false });
    if (existing) {
      throw new BadRequestError(`Coupon code "${cleanCode}" already exists`);
    }

    const coupon = await Coupon.create({
      code: cleanCode,
      title: title.trim(),
      description: description || '',
      discountType: discountType || 'PERCENTAGE',
      discountValue: Number(discountValue),
      maxDiscount: Number(maxDiscount || 0),
      minPlanAmount: Number(minPlanAmount || 0),
      validUntil: validUntil ? new Date(validUntil) : null,
      usageLimit: Number(usageLimit || 1000),
      applicableFor: applicableFor || 'WHOLESALER_SUBSCRIPTION',
      isActive: true,
    });
    return coupon;
  }

  static async updateCouponStatus(id, isActive) {
    const coupon = await Coupon.findById(id);
    if (!coupon || coupon.isDeleted) throw new NotFoundError('Coupon not found');
    coupon.isActive = Boolean(isActive);
    await coupon.save();
    return coupon;
  }

  static async updateCoupon(id, data) {
    const coupon = await Coupon.findById(id);
    if (!coupon || coupon.isDeleted) throw new NotFoundError('Coupon not found');

    if (data.code && data.code.trim().toUpperCase() !== coupon.code) {
      const cleanCode = data.code.trim().toUpperCase();
      const existing = await Coupon.findOne({ code: cleanCode, isDeleted: false, _id: { $ne: id } });
      if (existing) {
        throw new BadRequestError(`Coupon code "${cleanCode}" already exists`);
      }
      coupon.code = cleanCode;
    }

    if (data.title) coupon.title = data.title.trim();
    if (data.description !== undefined) coupon.description = data.description;
    if (data.discountType) coupon.discountType = data.discountType;
    if (data.discountValue !== undefined) coupon.discountValue = Number(data.discountValue);
    if (data.maxDiscount !== undefined) coupon.maxDiscount = Number(data.maxDiscount);
    if (data.minPlanAmount !== undefined) coupon.minPlanAmount = Number(data.minPlanAmount);
    if (data.usageLimit !== undefined) coupon.usageLimit = Number(data.usageLimit);
    if (data.validUntil !== undefined) coupon.validUntil = data.validUntil ? new Date(data.validUntil) : null;
    if (data.applicableFor) coupon.applicableFor = data.applicableFor;
    if (data.isActive !== undefined) coupon.isActive = Boolean(data.isActive);

    await coupon.save();
    return coupon;
  }

  static async deleteCoupon(id) {
    const coupon = await Coupon.findById(id);
    if (!coupon) throw new NotFoundError('Coupon not found');
    coupon.isDeleted = true;
    await coupon.save();
    return { success: true };
  }

  static async validateCoupon(codeInput, amountInput = 0) {
    await this.seedDefaultCouponsIfEmpty();
    if (!codeInput) throw new BadRequestError('Please enter a coupon code');

    const cleanCode = String(codeInput).trim().toUpperCase();
    const coupon = await Coupon.findOne({ code: cleanCode, isDeleted: false });

    if (!coupon) {
      throw new NotFoundError(`Coupon code "${cleanCode}" is invalid or does not exist`);
    }

    if (!coupon.isActive) {
      throw new BadRequestError(`Coupon code "${cleanCode}" is currently inactive`);
    }

    if (coupon.validUntil && new Date() > new Date(coupon.validUntil)) {
      throw new BadRequestError(`Coupon code "${cleanCode}" has expired`);
    }

    if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
      throw new BadRequestError(`Coupon code "${cleanCode}" has reached maximum usage limit`);
    }

    const planAmount = Number(amountInput) || 0;
    if (coupon.minPlanAmount && planAmount > 0 && planAmount < coupon.minPlanAmount) {
      throw new BadRequestError(`Minimum plan amount required for coupon ${cleanCode} is ₹${coupon.minPlanAmount.toLocaleString('en-IN')}`);
    }

    let discountAmount = 0;
    if (coupon.discountType === 'PERCENTAGE') {
      discountAmount = Math.round((planAmount * coupon.discountValue) / 100);
      if (coupon.maxDiscount && coupon.maxDiscount > 0) {
        discountAmount = Math.min(discountAmount, coupon.maxDiscount);
      }
    } else {
      discountAmount = Math.min(coupon.discountValue, planAmount);
    }

    const netPrice = Math.max(0, planAmount - discountAmount);

    return {
      valid: true,
      code: coupon.code,
      title: coupon.title,
      description: coupon.description,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      discountAmount,
      originalAmount: planAmount,
      netPrice,
    };
  }

  /**
   * Content Management Endpoints
   */
  static async getContent(query = {}) {
    return {
      items: [],
      pagination: { page: 1, limit: 10, total: 0, totalPages: 1 },
    };
  }

  /**
   * Notifications Endpoints
   */
  static async getAdminNotifications(query = {}, user = null) {
    const { page = 1, limit = 10, search = '', unread = 'all', module = 'all' } = query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 10);
    const skip = (pageNum - 1) * limitNum;

    const filter = {};
    if (user && user._id) {
      filter.$or = [{ recipientId: user._id }, { recipientId: { $exists: false } }, { recipientId: null }];
    }

    if (unread === 'true') {
      filter.isRead = false;
    } else if (unread === 'false') {
      filter.isRead = true;
    }

    if (module !== 'all' && module) {
      if (module === 'Help Request') filter.$or = [{ 'data.type': 'HELP_REQUEST' }, { type: 'SYSTEM_ALERT' }];
      else if (module === 'Order') filter.$or = [{ 'data.type': 'ORDER_PLACED' }, { 'data.type': 'ORDER_UPDATED' }, { type: 'ORDER_UPDATE' }];
      else if (module === 'Payment') filter.$or = [{ 'data.type': 'PAYMENT_COMPLETED' }, { type: 'PAYMENT_UPDATE' }];
      else filter.type = module;
    }

    if (search && search.trim()) {
      const q = new RegExp(search.trim(), 'i');
      filter.title = q;
    }

    const [list, total, unreadCount] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
      Notification.countDocuments(filter),
      Notification.countDocuments({ ...filter, isRead: false }),
    ]);

    const items = list.map((n) => {
      const isHelpRequest = n.data?.type === 'HELP_REQUEST' || n.title?.toLowerCase().includes('help') || n.title?.toLowerCase().includes('issue');
      const isPayment = n.data?.type === 'PAYMENT_COMPLETED' || n.type === 'PAYMENT_UPDATE' || n.title?.toLowerCase().includes('payment');
      const isOrder = n.data?.type === 'ORDER_PLACED' || n.data?.type === 'ORDER_UPDATED' || n.type === 'ORDER_UPDATE' || n.title?.toLowerCase().includes('order');

      let computedModule = 'System';
      if (isHelpRequest) computedModule = 'Help Request';
      else if (isPayment) computedModule = 'Payment';
      else if (isOrder) computedModule = 'Order';
      else if (n.type === 'KYC_UPDATE') computedModule = 'KYC';
      else if (n.type === 'PAYOUT_UPDATE') computedModule = 'Payout';

      return {
        _id: String(n._id),
        id: String(n._id),
        title: n.title,
        message: n.message,
        unread: !n.isRead,
        isRead: Boolean(n.isRead),
        module: computedModule,
        type: n.type,
        data: n.data || {},
        wholesalerName: n.data?.wholesalerName || null,
        retailerName: n.data?.retailerName || null,
        orderNumber: n.data?.orderNumber || null,
        subject: n.data?.subject || null,
        phone: n.data?.phone || null,
        createdAt: n.createdAt,
      };
    });

    return {
      items,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum) || 1,
        unreadCount,
      },
      filters: {
        modules: ['Help Request', 'Order', 'Payment', 'KYC', 'Payout'],
      },
    };
  }

  static async markAllAdminNotificationsRead(user = null) {
    const filter = user?._id ? { recipientId: user._id, isRead: false } : { isRead: false };
    await Notification.updateMany(filter, { isRead: true, readAt: new Date() });
    return { success: true };
  }

  static async markAdminNotificationRead(id, user = null) {
    const notification = await Notification.findByIdAndUpdate(id, { isRead: true, readAt: new Date() }, { new: true });
    if (!notification) throw new NotFoundError('Notification not found');
    return notification;
  }

  static async deleteAdminNotification(id) {
    const notification = await Notification.findByIdAndDelete(id);
    if (!notification) throw new NotFoundError('Notification not found');
    return { success: true };
  }

  /**
   * System Users (Admin Accounts)
   */
  static async getUsers(query = {}) {
    const users = await User.find({ isDeleted: false })
      .select('name email role status createdAt')
      .sort({ createdAt: -1 })
      .lean();

    return {
      items: users.map((u) => ({
        id: String(u._id),
        name: u.name,
        email: u.email,
        role: u.role,
        status: u.status,
        createdAt: u.createdAt,
      })),
      pagination: { page: 1, limit: 10, total: users.length, totalPages: 1 },
    };
  }

  /**
   * Activity / Audit Logs
   */
  static async getActivityLogs(query = {}) {
    const logs = await AuditLog.find()
      .populate('actorId', 'name email role')
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    return logs.map((log) => ({
      id: String(log._id),
      user: log.actorId?.name || 'System Admin',
      action: log.action,
      entity: log.entityType,
      ip: log.ipAddress || '',
      timestamp: log.createdAt,
    }));
  }
}

module.exports = AdminService;
