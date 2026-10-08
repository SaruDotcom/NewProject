const { Earning } = require('../../models');
const { parsePagination } = require('../../utils/pagination');

class EarningService {
  /**
   * List earnings records with filters and pagination
   */
  static async listEarnings(query = {}) {
    const { page, limit, skip, sort } = parsePagination(query);
    const filter = {};

    if (query.wholesalerId) filter.wholesalerId = query.wholesalerId;
    if (query.status) filter.status = query.status;

    if (query.startDate || query.endDate) {
      filter.createdAt = {};
      if (query.startDate) filter.createdAt.$gte = new Date(query.startDate);
      if (query.endDate) filter.createdAt.$lte = new Date(query.endDate);
    }

    const [earnings, total, summary] = await Promise.all([
      Earning.find(filter)
        .populate('wholesalerId', 'name email phone')
        .populate('orderId', 'orderNumber grandTotal orderStatus')
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      Earning.countDocuments(filter),
      this.getEarningsSummary(filter),
    ]);

    return {
      earnings,
      summary,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Aggregate earnings summary
   */
  static async getEarningsSummary(filter = {}) {
    const [result] = await Earning.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalGrossAmount: { $sum: '$grossAmount' },
          totalPlatformCommission: { $sum: '$platformCommission' },
          totalWholesalerAmount: { $sum: '$wholesalerAmount' },
          totalRefundAmount: { $sum: '$refundAmount' },
          count: { $sum: 1 },
        },
      },
    ]);

    return (
      result || {
        totalGrossAmount: 0,
        totalPlatformCommission: 0,
        totalWholesalerAmount: 0,
        totalRefundAmount: 0,
        count: 0,
      }
    );
  }
}

module.exports = EarningService;
