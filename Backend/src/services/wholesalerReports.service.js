const mongoose = require('mongoose');
const {
  Earning,
  InventoryTransaction,
  Order,
  Payment,
  Product,
  Return,
  WholesalerRetailerRelationship,
} = require('../models');
const { BadRequestError } = require('../utils/errors');

const EXCLUDED_REVENUE_STATUSES = ['CANCELLED', 'RETURNED', 'REFUNDED'];
const IST_TIMEZONE = '+05:30';

function parseDate(value, fieldName) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new BadRequestError(`${fieldName} must be a valid date in YYYY-MM-DD format`);
  }

  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new BadRequestError(`${fieldName} must be a valid date`);
  }

  return parsed;
}

function getDateRange(query, now = new Date()) {
  // Convert now to IST string YYYY-MM-DD
  const istNow = new Date(now.getTime() + (5 * 60 + 30) * 60 * 1000);
  const today = istNow.toISOString().slice(0, 10);

  const startDate = query.startDate || `${today.slice(0, 7)}-01`;
  const endDate = query.endDate || today;
  const start = parseDate(startDate, 'startDate');
  const end = parseDate(endDate, 'endDate');

  if (start > end) {
    throw new BadRequestError('startDate must be on or before endDate');
  }

  // End of end date (23:59:59.999 IST)
  const endExclusive = new Date(end.getTime() + 24 * 60 * 60 * 1000);
  const durationMs = endExclusive.getTime() - start.getTime();

  // Preceding period of equal length
  const prevStart = new Date(start.getTime() - durationMs);
  const prevEndExclusive = new Date(start.getTime());

  return {
    startDate,
    endDate,
    start,
    endExclusive,
    prevStart,
    prevEndExclusive,
    durationMs,
  };
}

function calcGrowth(current, previous) {
  const curr = Number(current) || 0;
  const prev = Number(previous) || 0;
  if (prev === 0) return curr > 0 ? 100 : 0;
  return Math.round(((curr - prev) / prev) * 1000) / 10;
}

function encodeCsvValue(value) {
  if (value === null || value === undefined) return '""';
  let text = value instanceof Date
    ? value.toISOString()
    : value && typeof value.toHexString === 'function'
      ? value.toHexString()
      : typeof value === 'object'
        ? JSON.stringify(value)
        : String(value);
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function rowsToCsv(fields, rows) {
  return [
    fields.map(encodeCsvValue).join(','),
    ...rows.map((row) => fields.map((field) => encodeCsvValue(row[field])).join(',')),
  ].join('\r\n');
}

function parseExportSections(sections) {
  if (Array.isArray(sections)) return sections;
  if (typeof sections === 'string' && sections.trim()) {
    return sections.split(',').map((s) => s.trim().toLowerCase());
  }
  return ['financial', 'orders', 'products', 'retailers', 'inventory'];
}

class WholesalerReportsService {
  /**
   * Backfill missing costPriceAtOrder on old orders from current Product.costPrice
   */
  static async backfillCostPrices(wholesalerObjectId) {
    try {
      const products = await Product.find({ wholesalerId: wholesalerObjectId, isDeleted: false }).select('_id costPrice');
      const costMap = new Map();
      products.forEach((p) => costMap.set(String(p._id), p.costPrice || 0));

      const ordersToUpdate = await Order.find({
        wholesalerId: wholesalerObjectId,
        'items.costPriceAtOrder': { $exists: false },
      }).limit(500);

      for (const order of ordersToUpdate) {
        let modified = false;
        order.items.forEach((item) => {
          if (!item.costPriceAtOrder) {
            item.costPriceAtOrder = costMap.get(String(item.productId)) || 0;
            modified = true;
          }
        });
        if (modified) {
          await order.save();
        }
      }
    } catch (err) {
      console.warn('Cost price backfill non-fatal error:', err?.message);
    }
  }

  static async getAnalytics(userId, query = {}) {
    if (!mongoose.isValidObjectId(userId)) {
      throw new BadRequestError('Invalid wholesaler id');
    }

    const wholesalerObjectId = new mongoose.Types.ObjectId(userId);
    const { startDate, endDate, start, endExclusive, prevStart, prevEndExclusive } = getDateRange(query);

    // Auto-backfill cost price for old orders if needed
    void this.backfillCostPrices(wholesalerObjectId);

    const dateMatch = { $gte: start, $lt: endExclusive };
    const prevDateMatch = { $gte: prevStart, $lt: prevEndExclusive };

    const orderMatch = { wholesalerId: wholesalerObjectId, createdAt: dateMatch };
    const prevOrderMatch = { wholesalerId: wholesalerObjectId, createdAt: prevDateMatch };

    const revenueOrderMatch = {
      ...orderMatch,
      orderStatus: { $nin: EXCLUDED_REVENUE_STATUSES },
    };
    const prevRevenueOrderMatch = {
      ...prevOrderMatch,
      orderStatus: { $nin: EXCLUDED_REVENUE_STATUSES },
    };

    const now = new Date();

    const [
      currentOrderAgg,
      productAgg,
      retailerAgg,
      prevOrderAgg,
      paymentAgg,
      inventoryAgg,
      returnAgg,
      newRetailerAgg,
      prevNewRetailerCount,
      productCount,
      activeRetailerCount,
      newRetailersTrendAgg,
      stockMovementTrendAgg,
      allProductsForInventory,
    ] = await Promise.all([
      // Current Order Aggregation
      Order.aggregate([
        { $match: orderMatch },
        {
          $facet: {
            totals: [
              {
                $group: {
                  _id: null,
                  totalOrders: { $sum: 1 },
                  deliveredOrders: {
                    $sum: { $cond: [{ $eq: ['$orderStatus', 'DELIVERED'] }, 1, 0] },
                  },
                  returnedOrders: {
                    $sum: { $cond: [{ $in: ['$orderStatus', ['RETURNED', 'RETURN_REQUESTED', 'REFUNDED']] }, 1, 0] },
                  },
                  cancelledOrders: {
                    $sum: { $cond: [{ $eq: ['$orderStatus', 'CANCELLED'] }, 1, 0] },
                  },
                  revenue: {
                    $sum: {
                      $cond: [
                        { $not: [{ $in: ['$orderStatus', EXCLUDED_REVENUE_STATUSES] }] },
                        '$grandTotal',
                        0,
                      ],
                    },
                  },
                  averageOrderValue: {
                    $avg: {
                      $cond: [
                        { $not: [{ $in: ['$orderStatus', EXCLUDED_REVENUE_STATUSES] }] },
                        '$grandTotal',
                        null,
                      ],
                    },
                  },
                  totalDiscount: {
                    $sum: {
                      $cond: [{ $gt: [{ $ifNull: ['$discount', 0] }, 0] }, '$discount', 0],
                    },
                  },
                  creditOutstanding: {
                    $sum: {
                      $cond: [
                        {
                          $and: [
                            { $not: [{ $in: ['$orderStatus', EXCLUDED_REVENUE_STATUSES] }] },
                            { $eq: ['$isCreditOrder', true] },
                            { $in: ['$creditPaymentStatus', ['PENDING', 'OVERDUE']] },
                          ],
                        },
                        '$grandTotal',
                        0,
                      ],
                    },
                  },
                  overdueAmount: {
                    $sum: {
                      $cond: [
                        {
                          $and: [
                            { $not: [{ $in: ['$orderStatus', EXCLUDED_REVENUE_STATUSES] }] },
                            { $eq: ['$isCreditOrder', true] },
                            { $in: ['$creditPaymentStatus', ['PENDING', 'OVERDUE']] },
                            {
                              $or: [
                                { $eq: ['$creditPaymentStatus', 'OVERDUE'] },
                                {
                                  $and: [
                                    { $ne: [{ $ifNull: ['$creditDueDate', null] }, null] },
                                    { $lt: ['$creditDueDate', now] },
                                  ],
                                },
                              ],
                            },
                          ],
                        },
                        '$grandTotal',
                        0,
                      ],
                    },
                  },
                },
              },
            ],
            statuses: [
              { $group: { _id: '$orderStatus', count: { $sum: 1 } } },
            ],
            trend: [
              { $match: { orderStatus: { $nin: EXCLUDED_REVENUE_STATUSES } } },
              {
                $group: {
                  _id: {
                    $dateToString: {
                      format: '%Y-%m-%d',
                      date: '$createdAt',
                      timezone: IST_TIMEZONE,
                    },
                  },
                  revenue: { $sum: '$grandTotal' },
                  orders: { $sum: 1 },
                },
              },
              { $sort: { _id: 1 } },
            ],
            coupons: [
              {
                $match: {
                  couponCode: { $nin: ['', null] },
                  orderStatus: { $nin: EXCLUDED_REVENUE_STATUSES },
                },
              },
              {
                $group: {
                  _id: '$couponCode',
                  uses: { $sum: 1 },
                  discount: { $sum: { $ifNull: ['$discount', 0] } },
                },
              },
              { $sort: { uses: -1, discount: -1 } },
              { $limit: 10 },
            ],
          },
        },
      ]),

      // Product Level Sales & Profit Aggregation
      Order.aggregate([
        { $match: revenueOrderMatch },
        { $unwind: '$items' },
        {
          $lookup: {
            from: 'products',
            localField: 'items.productId',
            foreignField: '_id',
            as: 'product',
          },
        },
        { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
        {
          $addFields: {
            reportProductId: { $ifNull: ['$items.productId', null] },
            reportProductName: { $ifNull: ['$items.name', '$product.name'] },
            reportSku: { $ifNull: ['$items.sku', '$product.sku'] },
            reportCategory: {
              $ifNull: [
                '$product.categoryName',
                { $ifNull: ['$categoryName', 'Uncategorized'] },
              ],
            },
            reportLineRevenue: {
              $ifNull: [
                '$items.subtotal',
                { $multiply: ['$items.pricePerUnit', '$items.quantity'] },
              ],
            },
            effectiveCostPrice: {
              $cond: [
                { $gt: [{ $ifNull: ['$items.costPriceAtOrder', 0] }, 0] },
                '$items.costPriceAtOrder',
                { $ifNull: ['$product.costPrice', 0] },
              ],
            },
          },
        },
        {
          $addFields: {
            reportCost: {
              $multiply: ['$effectiveCostPrice', '$items.quantity'],
            },
            reportAllocatedDiscount: {
              $cond: [
                { $gt: [{ $ifNull: ['$subtotal', 0] }, 0] },
                {
                  $multiply: [
                    { $ifNull: ['$discount', 0] },
                    { $divide: [{ $ifNull: ['$items.subtotal', 0] }, '$subtotal'] },
                  ],
                },
                0,
              ],
            },
          },
        },
        {
          $addFields: {
            reportProfit: {
              $subtract: [
                { $subtract: ['$reportLineRevenue', '$reportCost'] },
                '$reportAllocatedDiscount',
              ],
            },
          },
        },
        {
          $facet: {
            totals: [
              {
                $group: {
                  _id: null,
                  unitsSold: { $sum: '$items.quantity' },
                  profit: { $sum: '$reportProfit' },
                },
              },
            ],
            byRevenue: [
              {
                $group: {
                  _id: '$reportProductId',
                  name: { $first: '$reportProductName' },
                  sku: { $first: '$reportSku' },
                  category: { $first: '$reportCategory' },
                  unitsSold: { $sum: '$items.quantity' },
                  revenue: { $sum: '$reportLineRevenue' },
                  profit: { $sum: '$reportProfit' },
                },
              },
              { $sort: { revenue: -1, unitsSold: -1 } },
              { $limit: 10 },
            ],
            byUnits: [
              {
                $group: {
                  _id: '$reportProductId',
                  name: { $first: '$reportProductName' },
                  sku: { $first: '$reportSku' },
                  category: { $first: '$reportCategory' },
                  unitsSold: { $sum: '$items.quantity' },
                  revenue: { $sum: '$reportLineRevenue' },
                  profit: { $sum: '$reportProfit' },
                },
              },
              { $sort: { unitsSold: -1, revenue: -1 } },
              { $limit: 10 },
            ],
            categories: [
              {
                $group: {
                  _id: '$reportCategory',
                  revenue: { $sum: '$reportLineRevenue' },
                  unitsSold: { $sum: '$items.quantity' },
                },
              },
              { $sort: { revenue: -1 } },
              { $limit: 10 },
            ],
          },
        },
      ]),

      // Retailer Aggregation
      Order.aggregate([
        { $match: revenueOrderMatch },
        {
          $group: {
            _id: '$retailerId',
            orders: { $sum: 1 },
            revenue: { $sum: '$grandTotal' },
          },
        },
        { $sort: { revenue: -1, orders: -1 } },
        { $limit: 10 },
        {
          $lookup: {
            from: 'retailers',
            localField: '_id',
            foreignField: 'userId',
            as: 'retailerProfile',
          },
        },
        { $unwind: { path: '$retailerProfile', preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'retailerUser',
          },
        },
        { $unwind: { path: '$retailerUser', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 1,
            name: {
              $ifNull: [
                '$retailerProfile.businessName',
                { $ifNull: ['$retailerUser.name', 'Retailer'] },
              ],
            },
            orders: 1,
            revenue: 1,
          },
        },
      ]),


      // Previous Order Aggregation (for Growth Comparison)
      Order.aggregate([
        { $match: prevOrderMatch },
        {
          $group: {
            _id: null,
            totalOrders: { $sum: 1 },
            revenue: {
              $sum: {
                $cond: [
                  { $not: [{ $in: ['$orderStatus', EXCLUDED_REVENUE_STATUSES] }] },
                  '$grandTotal',
                  0,
                ],
              },
            },
            averageOrderValue: {
              $avg: {
                $cond: [
                  { $not: [{ $in: ['$orderStatus', EXCLUDED_REVENUE_STATUSES] }] },
                  '$grandTotal',
                  null,
                ],
              },
            },
          },
        },
      ]),
      // Payments Aggregation
      Payment.aggregate([
        {
          $addFields: {
            effectivePaidAt: { $ifNull: ['$paidAt', '$createdAt'] },
          },
        },
        {
          $match: {
            wholesalerId: wholesalerObjectId,
            status: { $in: ['PAID', 'SUCCESS', 'COMPLETED'] },
            effectivePaidAt: dateMatch,
          },
        },
        {
          $group: {
            _id: null,
            paidAmount: { $sum: '$amount' },
            averagePaymentPerOrder: { $avg: '$amount' },
            paidOrders: { $sum: 1 },
          },
        },
      ]),

      // Stock Movement Aggregation
      InventoryTransaction.aggregate([
        {
          $match: {
            wholesalerId: wholesalerObjectId,
            createdAt: dateMatch,
            type: { $in: ['RECEIVE', 'RETURN', 'ADJUSTMENT', 'SALE'] },
          },
        },
        {
          $group: {
            _id: null,
            unitsAdded: {
              $sum: {
                $switch: {
                  branches: [
                    {
                      case: { $in: ['$type', ['RECEIVE', 'RETURN']] },
                      then: { $abs: '$quantity' },
                    },
                    {
                      case: { $eq: ['$type', 'ADJUSTMENT'] },
                      then: {
                        $max: [{ $subtract: ['$newAvailable', '$previousAvailable'] }, 0],
                      },
                    },
                  ],
                  default: 0,
                },
              },
            },
            unitsSold: {
              $sum: {
                $cond: [{ $eq: ['$type', 'SALE'] }, { $abs: '$quantity' }, 0],
              },
            },
          },
        },
      ]),

      // Returns Aggregation
      Return.aggregate([
        {
          $match: {
            wholesalerId: wholesalerObjectId,
            createdAt: dateMatch,
          },
        },
        { $unwind: { path: '$items', preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: { $ifNull: ['$items.reason', { $ifNull: ['$reason', 'Unspecified'] }] },
            returns: { $sum: 1 },
            units: { $sum: { $ifNull: ['$items.quantity', 0] } },
          },
        },
        { $sort: { returns: -1, _id: 1 } },
      ]),

      // New Retailers count current period
      WholesalerRetailerRelationship.aggregate([
        {
          $match: {
            wholesalerId: wholesalerObjectId,
            $or: [{ createdAt: dateMatch }, { joinedAt: dateMatch }],
          },
        },
        { $count: 'count' },
      ]),

      // New Retailers count previous period (for Growth)
      WholesalerRetailerRelationship.countDocuments({
        wholesalerId: wholesalerObjectId,
        $or: [{ createdAt: prevDateMatch }, { joinedAt: prevDateMatch }],
      }),

      // Total Product Count
      Product.countDocuments({ wholesalerId: wholesalerObjectId, isDeleted: false }),

      // Active Retailer Count
      WholesalerRetailerRelationship.countDocuments({
        wholesalerId: wholesalerObjectId,
        status: 'ACTIVE',
      }),

      // New Retailers Trend over time (IST)
      WholesalerRetailerRelationship.aggregate([
        {
          $match: {
            wholesalerId: wholesalerObjectId,
            $or: [{ createdAt: dateMatch }, { joinedAt: dateMatch }],
          },
        },
        {
          $group: {
            _id: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: '$createdAt',
                timezone: IST_TIMEZONE,
              },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      // Stock Movement Trend over time (IST)
      InventoryTransaction.aggregate([
        {
          $match: {
            wholesalerId: wholesalerObjectId,
            createdAt: dateMatch,
            type: { $in: ['RECEIVE', 'RETURN', 'ADJUSTMENT', 'SALE'] },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: '$createdAt',
                timezone: IST_TIMEZONE,
              },
            },
            added: {
              $sum: {
                $switch: {
                  branches: [
                    {
                      case: { $in: ['$type', ['RECEIVE', 'RETURN']] },
                      then: { $abs: '$quantity' },
                    },
                    {
                      case: { $eq: ['$type', 'ADJUSTMENT'] },
                      then: {
                        $max: [{ $subtract: ['$newAvailable', '$previousAvailable'] }, 0],
                      },
                    },
                  ],
                  default: 0,
                },
              },
            },
            sold: {
              $sum: {
                $cond: [{ $eq: ['$type', 'SALE'] }, { $abs: '$quantity' }, 0],
              },
            },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      // Product List for Fast/Slow/Low Stock Insights
      Product.find({ wholesalerId: wholesalerObjectId, isDeleted: false }).select(
        '_id name sku stock moq minOrderQty lowStockThreshold costPrice wholesalePrice categoryName'
      ),
    ]);

    // Extract Aggregation Totals safely with optional chaining
    const newRetailerCount = typeof newRetailerAgg === 'number' ? newRetailerAgg : (newRetailerAgg?.[0]?.count || 0);
    const orderTotals = currentOrderAgg[0]?.totals?.[0] || {};
    const prevOrderTotals = prevOrderAgg[0] || {};
    const productTotals = productAgg[0]?.totals?.[0] || {};
    const paymentTotals = paymentAgg[0] || {};
    const inventoryTotals = inventoryAgg[0] || {};

    const revenue = orderTotals.revenue || 0;
    const prevRevenue = prevOrderTotals.revenue || 0;

    const profit = productTotals.profit || 0;
    // Estimate previous profit based on AOV/units if missing
    const prevProfit = (prevRevenue * (profit / (revenue || 1))) || 0;

    const totalOrders = orderTotals.totalOrders || 0;
    const prevTotalOrders = prevOrderTotals.totalOrders || 0;

    const deliveredOrders = orderTotals.deliveredOrders || 0;
    const returnedOrders = orderTotals.returnedOrders || 0;
    const cancelledOrders = orderTotals.cancelledOrders || 0;

    const returnRatePercent = deliveredOrders > 0
      ? Math.round((returnedOrders / deliveredOrders) * 1000) / 10
      : 0;

    const averageOrderValue = orderTotals.averageOrderValue || 0;
    const prevAverageOrderValue = prevOrderTotals.averageOrderValue || 0;

    // Fast-moving, Slow-moving, Low-stock Insights Calculation
    const productUnitsMap = new Map();
    (productAgg[0]?.byUnits || []).forEach((p) => {
      if (p._id) productUnitsMap.set(String(p._id), p.unitsSold || 0);
    });

    const lowStockAlerts = [];
    const productRatios = [];

    allProductsForInventory.forEach((prod) => {
      const stock = Number(prod.stock) || 0;
      const threshold = Number(
        prod.lowStockThreshold || prod.minOrderQty || prod.moq || 1
      );
      const unitsSold = productUnitsMap.get(String(prod._id)) || 0;

      if (stock <= threshold) {
        lowStockAlerts.push({
          _id: prod._id,
          name: prod.name,
          sku: prod.sku,
          stock,
          threshold,
        });
      }

      const turnoverRatio = stock > 0 ? unitsSold / stock : unitsSold;
      productRatios.push({
        _id: prod._id,
        name: prod.name,
        sku: prod.sku,
        stock,
        unitsSold,
        turnoverRatio,
      });
    });

    // Fast-moving (highest units sold / stock ratio)
    const fastMovingProducts = [...productRatios]
      .sort((a, b) => b.turnoverRatio - a.turnoverRatio)
      .slice(0, 5);

    // Slow-moving (lowest ratio among stock > 0)
    const slowMovingProducts = [...productRatios]
      .filter((p) => p.stock > 0)
      .sort((a, b) => a.turnoverRatio - b.turnoverRatio)
      .slice(0, 5);

    // Growth Rates Computation
    const growth = {
      revenueGrowth: calcGrowth(revenue, prevRevenue),
      profitGrowth: calcGrowth(profit, prevProfit),
      ordersGrowth: calcGrowth(totalOrders, prevTotalOrders),
      aovGrowth: calcGrowth(averageOrderValue, prevAverageOrderValue),
      retailersGrowth: calcGrowth(newRetailerCount, prevNewRetailerCount),
    };

    const orderStatusCounts = {};
    (currentOrderAgg[0]?.statuses || []).forEach((s) => {
      if (s._id) {
        orderStatusCounts[String(s._id).toLowerCase()] = s.count;
      }
    });

    const movementTrend = Array.isArray(stockMovementTrendAgg)
      ? stockMovementTrendAgg.map((item) => ({
          date: item._id,
          added: item.added,
          sold: item.sold,
        }))
      : [];

    const report = {
      period: { startDate, endDate },
      range: { startDate, endDate },
      growth,
      insights: {
        returnRatePercent,
        deliveredOrders,
        returnedOrders,
        cancelledOrders,
        lowStockAlerts,
        fastMovingProducts,
        slowMovingProducts,
      },
      financial: {
        revenue,
        profit,
        profitBasis: 'Item Cost Price Snapshot at Order Time',
        averageOrderValue,
        averagePaymentPerOrder: paymentTotals.averagePaymentPerOrder || 0,
        paymentsReceived: paymentTotals.paidAmount || 0,
        totalDiscount: orderTotals.totalDiscount || 0,
        creditOutstanding: orderTotals.creditOutstanding || 0,
        overdueAmount: orderTotals.overdueAmount || 0,
      },
      orders: {
        total: totalOrders,
        cancelled: cancelledOrders,
        returned: returnedOrders,
        delivered: deliveredOrders,
        ...orderStatusCounts,
        statusBreakdown: Array.isArray(currentOrderAgg[0]?.statuses)
          ? currentOrderAgg[0].statuses.map((s) => ({
              status: s._id,
              count: s.count,
            }))
          : [],
        returnReasons: Array.isArray(returnAgg)
          ? returnAgg.map((r) => ({
              reason: r._id,
              returns: r.returns,
              units: r.units,
            }))
          : [],
      },
      products: {
        count: productCount,
        totalProducts: productCount,
        unitsSold: productTotals.unitsSold || 0,
        byRevenue: Array.isArray(productAgg[0]?.byRevenue) ? productAgg[0].byRevenue : [],
        byUnits: Array.isArray(productAgg[0]?.byUnits) ? productAgg[0].byUnits : [],
      },
      categories: Array.isArray(productAgg[0]?.categories) ? productAgg[0].categories : [],
      retailers: {
        connected: activeRetailerCount,
        newConnected: newRetailerCount,
        top: Array.isArray(retailerAgg) ? retailerAgg : [],
        newRetailersTrend: Array.isArray(newRetailersTrendAgg)
          ? newRetailersTrendAgg.map((item) => ({
              date: item._id,
              count: item.count,
            }))
          : [],
      },
      inventory: {
        unitsAdded: inventoryTotals.unitsAdded || 0,
        unitsSold: inventoryTotals.unitsSold || 0,
      },
      coupons: {
        totalDiscount: orderTotals.totalDiscount || (Array.isArray(currentOrderAgg[0]?.coupons) ? currentOrderAgg[0].coupons.reduce((acc, c) => acc + (c.discount || 0), 0) : 0),
        mostUsed: Array.isArray(currentOrderAgg[0]?.coupons) ? currentOrderAgg[0].coupons : [],
      },
      trend: Array.isArray(currentOrderAgg[0]?.trend)
        ? currentOrderAgg[0].trend.map((t) => ({
            date: t._id,
            revenue: t.revenue,
            orders: t.orders,
          }))
        : [],
    };

    Object.defineProperty(report.inventory, 'movementTrend', {
      value: movementTrend,
      enumerable: false,
      writable: true,
      configurable: true,
    });
    report.inventoryTrend = movementTrend;

    return {
      report,
      orders: { count: totalOrders, sales: revenue },
    };
  }

  /**
   * Generates CSV string for exporting reports
   */
  static async exportAnalyticsCsv(userId, query = {}) {
    const wholesalerObjectId = new mongoose.Types.ObjectId(userId);
    const { startDate, endDate, start, endExclusive } = getDateRange(query);
    const dateMatch = { $gte: start, $lt: endExclusive };
    const { report } = await this.getAnalytics(userId, query);
    const sections = parseExportSections(query.sections);
    const csvParts = [];

    if (sections.includes('financial')) {
      csvParts.push(
        'Financial Summary',
        rowsToCsv(
          ['Metric', 'Value'],
          [
            { Metric: 'Total Revenue', Value: report.financial.revenue },
            { Metric: 'Total Profit', Value: report.financial.profit },
            { Metric: 'Average Order Value', Value: report.financial.averageOrderValue },
            { Metric: 'Payments Received', Value: report.financial.paymentsReceived },
            { Metric: 'Credit Outstanding', Value: report.financial.creditOutstanding },
            { Metric: 'Overdue Credit', Value: report.financial.overdueAmount },
            { Metric: 'Return Rate %', Value: `${report.insights.returnRatePercent}%` },
          ]
        )
      );
    }

    if (sections.includes('orders')) {
      const orders = await Order.find({ wholesalerId: wholesalerObjectId, createdAt: dateMatch })
        .select('orderNumber grandTotal orderStatus createdAt')
        .lean();
      csvParts.push(
        'Orders',
        rowsToCsv(
          ['orderNumber', 'grandTotal', 'orderStatus', 'createdAt'],
          orders.map((o) => ({
            orderNumber: o.orderNumber,
            grandTotal: o.grandTotal,
            orderStatus: o.orderStatus,
            createdAt: o.createdAt ? new Date(o.createdAt).toISOString() : '',
          }))
        )
      );
    }

    if (sections.includes('products')) {
      csvParts.push(
        'Products',
        rowsToCsv(
          ['name', 'sku', 'unitsSold', 'revenue', 'profit'],
          report.products.byRevenue
        )
      );
    }

    if (sections.includes('payments')) {
      const payments = await Payment.find({
        wholesalerId: wholesalerObjectId,
        $or: [{ paidAt: dateMatch }, { createdAt: dateMatch }],
      }).lean();
      csvParts.push(
        'Payments',
        rowsToCsv(
          ['amount', 'status', 'paymentMethod', 'paidAt'],
          payments.map((p) => ({
            amount: p.amount,
            status: p.status,
            paymentMethod: p.paymentMethod || '',
            paidAt: p.paidAt ? new Date(p.paidAt).toISOString() : '',
          }))
        )
      );
    }

    return {
      content: csvParts.join('\r\n\r\n'),
      filename: `wholesaler-report-${startDate}-to-${endDate}.csv`,
    };
  }

  static async exportCsv(userId, query = {}) {
    return this.exportAnalyticsCsv(userId, query);
  }
}

module.exports = WholesalerReportsService;
