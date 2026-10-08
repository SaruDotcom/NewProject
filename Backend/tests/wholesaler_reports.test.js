const mongoose = require('mongoose');
const {
  Earning,
  InventoryTransaction,
  Order,
  Payment,
  Product,
  Return,
  RetailerProfile,
  User,
  WholesalerRetailerRelationship,
} = require('../src/models');
const WholesalerReportsService = require('../src/services/wholesalerReports.service');
const { setupTestDB, clearDatabase } = require('./setup');
const { ROLES, USER_STATUS } = require('../src/config/constants');

setupTestDB();

describe('WholesalerReportsService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  beforeEach(async () => {
    await clearDatabase();
  });

  test('aggregates analytics for the requested wholesaler and inclusive date range', async () => {
    const wholesalerId = new mongoose.Types.ObjectId();
    const orderAggregate = jest.spyOn(Order, 'aggregate')
      .mockResolvedValueOnce([{
        totals: [{
          totalOrders: 3,
          revenue: 500,
          averageOrderValue: 250,
          totalDiscount: 20,
          creditOutstanding: 100,
          overdueAmount: 40,
        }],
        statuses: [{ _id: 'DELIVERED', count: 2 }, { _id: 'PENDING', count: 1 }],
        trend: [{ _id: '2026-04-01', revenue: 250, orders: 1 }],
      }])
      .mockResolvedValueOnce([{
        totals: [{ unitsSold: 8, profit: 150 }],
        byRevenue: [{ _id: 'product-1', name: 'Tea', unitsSold: 8, revenue: 250 }],
        byUnits: [{ _id: 'product-1', name: 'Tea', unitsSold: 8, revenue: 250 }],
        categories: [{ _id: 'Groceries', revenue: 250, unitsSold: 8 }],
      }])
      .mockResolvedValueOnce([{ _id: 'retailer-1', name: 'Shop', orders: 2, revenue: 500 }])
      .mockResolvedValueOnce([{
        totals: [{ discount: 20 }],
        mostUsed: [{ _id: 'APRIL', uses: 2, discount: 20 }],
      }]);
    jest.spyOn(WholesalerRetailerRelationship, 'aggregate')
      .mockResolvedValueOnce([{ count: 1 }]);
    jest.spyOn(Payment, 'aggregate').mockResolvedValue([{ paidAmount: 300, averagePaymentPerOrder: 150 }]);
    jest.spyOn(InventoryTransaction, 'aggregate').mockResolvedValue([{ unitsAdded: 12, unitsSold: 8 }]);
    jest.spyOn(Return, 'aggregate').mockResolvedValue([{ _id: 'Damaged', returns: 1, units: 2 }]);
    jest.spyOn(Product, 'countDocuments').mockResolvedValue(4);
    jest.spyOn(WholesalerRetailerRelationship, 'countDocuments').mockResolvedValue(5);
    jest.spyOn(Earning, 'aggregate').mockResolvedValue([{ gross: 500, net: 450 }]);

    const result = await WholesalerReportsService.getAnalytics(wholesalerId, {
      startDate: '2026-04-01',
      endDate: '2026-04-30',
    });

    expect(result.report.range).toEqual({ startDate: '2026-04-01', endDate: '2026-04-30' });
    expect(result.report.financial).toMatchObject({
      revenue: 500,
      profit: 150,
      averageOrderValue: 250,
      averagePaymentPerOrder: 150,
      paymentsReceived: 300,
      creditOutstanding: 100,
      overdueAmount: 40,
    });
    expect(result.report.orders).toMatchObject({ total: 3, pending: 1, delivered: 2 });
    expect(result.report.products).toMatchObject({ unitsSold: 8, count: 4 });
    expect(result.report.retailers).toMatchObject({ newConnected: 1, connected: 5 });
    expect(result.report.inventory).toEqual({ unitsAdded: 12, unitsSold: 8 });
    expect(result.report.orders.returnReasons).toEqual([
      { reason: 'Damaged', returns: 1, units: 2 },
    ]);
    expect(result.orders).toEqual({ count: 3, sales: 500 });
    expect(orderAggregate).toHaveBeenCalledTimes(4);
    expect(orderAggregate.mock.calls[0][0][0].$match).toMatchObject({
      wholesalerId,
      createdAt: {
        $gte: new Date('2026-04-01T00:00:00.000Z'),
        $lt: new Date('2026-05-01T00:00:00.000Z'),
      },
    });
  });

  test('rejects invalid and reversed date ranges before querying data', async () => {
    const aggregate = jest.spyOn(Order, 'aggregate');
    const wholesalerId = new mongoose.Types.ObjectId();

    await expect(
      WholesalerReportsService.getAnalytics(wholesalerId, {
        startDate: '2026-02-30',
        endDate: '2026-03-01',
      })
    ).rejects.toThrow('startDate must be a valid date');
    await expect(
      WholesalerReportsService.getAnalytics(wholesalerId, {
        startDate: '2026-04-02',
        endDate: '2026-04-01',
      })
    ).rejects.toThrow('startDate must be on or before endDate');

    expect(aggregate).not.toHaveBeenCalled();
  });

  test('runs the MongoDB aggregations over real order, product, payment and stock records', async () => {
    const wholesaler = await User.create({
      name: 'Report Wholesaler',
      email: 'reports-wholesaler@example.test',
      passwordHash: 'not-a-login-password',
      role: ROLES.WHOLESALER,
      status: USER_STATUS.ACTIVE,
    });
    const retailer = await User.create({
      name: 'Corner Shop',
      email: 'reports-retailer@example.test',
      passwordHash: 'not-a-login-password',
      role: ROLES.RETAILER,
      status: USER_STATUS.ACTIVE,
    });
    const product = await Product.create({
      wholesalerId: wholesaler._id,
      name: 'Wholesale Tea',
      slug: 'wholesale-tea',
      sku: 'TEA-REPORT',
      categoryId: new mongoose.Types.ObjectId(),
      categoryName: 'Groceries',
      costPrice: 10,
      wholesalePrice: 50,
    });
    const deliveredOrder = await Order.create({
      orderNumber: 'REPORT-DELIVERED',
      retailerId: retailer._id,
      wholesalerId: wholesaler._id,
      items: [{
        productId: product._id,
        name: product.name,
        sku: product.sku,
        quantity: 5,
        pricePerUnit: 50,
        subtotal: 250,
        total: 250,
      }],
      subtotal: 250,
      discount: 20,
      couponCode: 'APRIL',
      grandTotal: 230,
      orderStatus: 'DELIVERED',
      createdAt: new Date('2026-04-10T12:00:00.000Z'),
    });
    await Order.create({
      orderNumber: 'REPORT-CREDIT',
      retailerId: retailer._id,
      wholesalerId: wholesaler._id,
      items: [],
      subtotal: 60,
      grandTotal: 60,
      orderStatus: 'CONFIRMED',
      isCreditOrder: true,
      creditPaymentStatus: 'PENDING',
      creditDueDate: new Date('2026-04-15T00:00:00.000Z'),
      createdAt: new Date('2026-04-12T12:00:00.000Z'),
    });
    await Payment.create({
      orderId: deliveredOrder._id,
      retailerId: retailer._id,
      wholesalerId: wholesaler._id,
      amount: 230,
      status: 'PAID',
      paidAt: new Date('2026-04-10T13:00:00.000Z'),
    });
    await RetailerProfile.create({
      userId: retailer._id,
      businessName: 'Corner Shop Ltd',
    });
    await WholesalerRetailerRelationship.create({
      wholesalerId: wholesaler._id,
      retailerId: retailer._id,
      status: 'ACTIVE',
      joinedAt: new Date('2026-04-05T00:00:00.000Z'),
    });
    await InventoryTransaction.create({
      inventoryId: new mongoose.Types.ObjectId(),
      productId: product._id,
      wholesalerId: wholesaler._id,
      type: 'RECEIVE',
      quantity: 10,
      previousAvailable: 0,
      newAvailable: 10,
      performedBy: wholesaler._id,
      createdAt: new Date('2026-04-05T00:00:00.000Z'),
    });
    await InventoryTransaction.create({
      inventoryId: new mongoose.Types.ObjectId(),
      productId: product._id,
      wholesalerId: wholesaler._id,
      type: 'SALE',
      quantity: -5,
      previousAvailable: 10,
      newAvailable: 5,
      performedBy: wholesaler._id,
      createdAt: new Date('2026-04-10T12:00:00.000Z'),
    });
    await Return.create({
      returnNumber: 'REPORT-RETURN',
      orderId: deliveredOrder._id,
      retailerId: retailer._id,
      wholesalerId: wholesaler._id,
      items: [{
        productId: product._id,
        name: product.name,
        sku: product.sku,
        quantity: 1,
        reason: 'Damaged packaging',
        pricePerUnit: 50,
      }],
      totalRefundAmount: 50,
      reason: 'Damaged packaging',
      createdAt: new Date('2026-04-14T12:00:00.000Z'),
    });

    const result = await WholesalerReportsService.getAnalytics(wholesaler._id, {
      startDate: '2026-04-01',
      endDate: '2026-04-30',
    });

    expect(result.report.financial).toMatchObject({
      revenue: 290,
      profit: 180,
      averageOrderValue: 145,
      averagePaymentPerOrder: 230,
      paymentsReceived: 230,
      totalDiscount: 20,
      creditOutstanding: 60,
      overdueAmount: 60,
    });
    expect(result.report.orders).toMatchObject({
      total: 2,
      confirmed: 1,
      delivered: 1,
    });
    expect(result.report.products).toMatchObject({
      unitsSold: 5,
      byRevenue: [{ name: 'Wholesale Tea', unitsSold: 5, revenue: 250 }],
    });
    expect(result.report.categories).toEqual([
      { _id: 'Groceries', revenue: 250, unitsSold: 5 },
    ]);
    expect(result.report.retailers).toMatchObject({
      newConnected: 1,
      top: [{ name: 'Corner Shop Ltd', orders: 2, revenue: 290 }],
    });
    expect(result.report.inventory).toEqual({ unitsAdded: 10, unitsSold: 5 });
    expect(result.report.orders.returnReasons).toEqual([
      { reason: 'Damaged packaging', returns: 1, units: 1 },
    ]);
    expect(result.report.coupons).toMatchObject({
      totalDiscount: 20,
      mostUsed: [{ _id: 'APRIL', uses: 1, discount: 20 }],
    });

    const exported = await WholesalerReportsService.exportCsv(wholesaler._id, {
      startDate: '2026-04-01',
      endDate: '2026-04-30',
      sections: 'orders,products,payments',
    });
    expect(exported.filename).toBe('wholesaler-report-2026-04-01-to-2026-04-30.csv');
    expect(exported.content).toContain('Orders');
    expect(exported.content).toContain('REPORT-DELIVERED');
    expect(exported.content).toContain('Wholesale Tea');
    expect(exported.content).toContain('Payments');
    expect(exported.content).toContain('230');
  });
});
