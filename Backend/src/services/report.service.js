const {
  Order,
  User,
  WholesalerProfile,
  RetailerProfile,
  Product,
  Earning,
  Payout,
  KycApplication,
} = require('../models');
const { ROLES } = require('../config/constants');

class ReportService {
  /**
   * Convert array of objects to CSV string
   */
  static jsonToCsv(items, fields) {
    const header = fields.join(',');
    if (!items || items.length === 0) return header;
    const rows = items.map((item) => {
      return fields
        .map((field) => {
          const val = item[field] !== undefined && item[field] !== null ? item[field] : '';
          const str = String(val).replace(/"/g, '""');
          return `"${str}"`;
        })
        .join(',');
    });
    return [header, ...rows].join('\n');
  }

  /**
   * Generate Sales & Revenue Report
   */
  static async getSalesReport(startDate, endDate) {
    const match = { orderStatus: { $ne: 'CANCELLED' } };
    if (startDate || endDate) {
      match.createdAt = {};
      if (startDate) match.createdAt.$gte = new Date(startDate);
      if (endDate) match.createdAt.$lte = new Date(endDate);
    }

    const orders = await Order.find(match)
      .populate('retailerId', 'name email')
      .populate('wholesalerId', 'name email')
      .sort({ createdAt: -1 })
      .lean();

    const data = orders.map((o) => ({
      orderNumber: o.orderNumber,
      orderDate: o.createdAt?.toISOString(),
      retailer: o.retailerId?.name || '',
      wholesaler: o.wholesalerId?.name || '',
      itemsCount: o.items?.length || 0,
      subtotal: o.subtotal,
      tax: o.tax,
      grandTotal: o.grandTotal,
      orderStatus: o.orderStatus,
      paymentStatus: o.paymentStatus,
    }));

    const fields = [
      'orderNumber',
      'orderDate',
      'retailer',
      'wholesaler',
      'itemsCount',
      'subtotal',
      'tax',
      'grandTotal',
      'orderStatus',
      'paymentStatus',
    ];

    return { data, fields, csv: this.jsonToCsv(data, fields) };
  }

  /**
   * Generate Wholesalers Report
   */
  static async getWholesalersReport() {
    const wholesalers = await WholesalerProfile.find({ isDeleted: false })
      .populate('userId', 'name email phone status createdAt')
      .lean();

    const data = wholesalers.map((w) => ({
      businessName: w.businessName,
      contactPerson: w.userId?.name || '',
      email: w.userId?.email || '',
      phone: w.userId?.phone || '',
      gstin: w.gstin || '',
      pan: w.pan || '',
      city: w.address?.city || '',
      state: w.address?.state || '',
      kycStatus: w.kycStatus,
      commissionRate: `${w.commissionRate}%`,
      accountStatus: w.userId?.status || '',
      createdAt: w.createdAt?.toISOString(),
    }));

    const fields = [
      'businessName',
      'contactPerson',
      'email',
      'phone',
      'gstin',
      'pan',
      'city',
      'state',
      'kycStatus',
      'commissionRate',
      'accountStatus',
      'createdAt',
    ];

    return { data, fields, csv: this.jsonToCsv(data, fields) };
  }

  /**
   * Generate Retailers Report
   */
  static async getRetailersReport() {
    const retailers = await RetailerProfile.find({ isDeleted: false })
      .populate('userId', 'name email phone status createdAt')
      .populate('assignedWholesalerId', 'name email')
      .lean();

    const data = retailers.map((r) => ({
      businessName: r.businessName,
      contactPerson: r.userId?.name || '',
      email: r.userId?.email || '',
      phone: r.userId?.phone || '',
      assignedWholesaler: r.assignedWholesalerId?.name || 'None',
      city: r.address?.city || '',
      state: r.address?.state || '',
      totalOrders: r.totalOrdersCount,
      totalPurchaseAmount: r.totalPurchaseAmount,
      accountStatus: r.userId?.status || '',
      createdAt: r.createdAt?.toISOString(),
    }));

    const fields = [
      'businessName',
      'contactPerson',
      'email',
      'phone',
      'assignedWholesaler',
      'city',
      'state',
      'totalOrders',
      'totalPurchaseAmount',
      'accountStatus',
      'createdAt',
    ];

    return { data, fields, csv: this.jsonToCsv(data, fields) };
  }

  /**
   * Generate Payouts Report
   */
  static async getPayoutsReport() {
    const payouts = await Payout.find()
      .populate('wholesalerId', 'name email')
      .sort({ createdAt: -1 })
      .lean();

    const data = payouts.map((p) => ({
      payoutNumber: p.payoutNumber,
      wholesaler: p.wholesalerId?.name || '',
      amount: p.amount,
      status: p.status,
      bankAccount: p.bankAccountReference?.accountNumber || '',
      ifsc: p.bankAccountReference?.ifscCode || '',
      transactionReference: p.transactionReference || '',
      requestedAt: p.createdAt?.toISOString(),
      processedAt: p.processedAt?.toISOString() || '',
    }));

    const fields = [
      'payoutNumber',
      'wholesaler',
      'amount',
      'status',
      'bankAccount',
      'ifsc',
      'transactionReference',
      'requestedAt',
      'processedAt',
    ];

    return { data, fields, csv: this.jsonToCsv(data, fields) };
  }
}

module.exports = ReportService;
