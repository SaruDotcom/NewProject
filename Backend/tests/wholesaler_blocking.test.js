const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const { setupTestDB, clearDatabase } = require('./setup');
const {
  User,
  AdminProfile,
  WholesalerProfile,
  WholesalerRetailerRelationship,
  Category,
  Product,
  Order,
  WholesalerSubscription,
  SubscriptionPayment,
} = require('../src/models');
const { ROLES, USER_STATUS, KYC_STATUS } = require('../src/config/constants');
const AuthService = require('../src/modules/auth/auth.service');

setupTestDB();

describe('Super Admin wholesaler block and unblock', () => {
  let adminToken;
  let regularAdminToken;
  let blockedWholesaler;
  let activeWholesaler;
  let blockedRetailerToken;
  let activeRetailerToken;
  let blockedProduct;
  let blockedProfile;
  let activeProfile;
  let order;

  beforeEach(async () => {
    await clearDatabase();

    const superAdmin = await User.create({
      name: 'Super Admin',
      email: 'blocking-superadmin@example.test',
      passwordHash: await User.hashPassword('Password@123'),
      role: ROLES.SUPER_ADMIN,
      status: USER_STATUS.ACTIVE,
    });
    const adminProfile = await AdminProfile.create({ userId: superAdmin._id, isSuperAdmin: true });
    superAdmin.adminProfile = adminProfile._id;
    await superAdmin.save();
    adminToken = AuthService.generateTokens(superAdmin).accessToken;

    const regularAdmin = await User.create({
      name: 'Admin',
      email: 'blocking-admin@example.test',
      passwordHash: await User.hashPassword('Password@123'),
      role: ROLES.ADMIN,
      status: USER_STATUS.ACTIVE,
    });
    regularAdminToken = AuthService.generateTokens(regularAdmin).accessToken;

    blockedWholesaler = await User.create({
      name: 'Wholesaler A',
      email: 'blocking-wholesaler-a@example.test',
      passwordHash: await User.hashPassword('Password@123'),
      role: ROLES.WHOLESALER,
      status: USER_STATUS.ACTIVE,
    });
    activeWholesaler = await User.create({
      name: 'Wholesaler B',
      email: 'blocking-wholesaler-b@example.test',
      passwordHash: await User.hashPassword('Password@123'),
      role: ROLES.WHOLESALER,
      status: USER_STATUS.ACTIVE,
    });
    blockedProfile = await WholesalerProfile.create({
      userId: blockedWholesaler._id,
      businessName: 'Business A',
      kycStatus: KYC_STATUS.APPROVED,
      retailerReferralCode: 'BLOCKA',
      retailerSignupsEnabled: true,
    });
    activeProfile = await WholesalerProfile.create({
      userId: activeWholesaler._id,
      businessName: 'Business B',
      kycStatus: KYC_STATUS.APPROVED,
      retailerReferralCode: 'ACTIVB',
      retailerSignupsEnabled: true,
    });

    const blockedRetailer = await User.create({
      name: 'Retailer A',
      email: 'blocking-retailer-a@example.test',
      passwordHash: await User.hashPassword('Password@123'),
      role: ROLES.RETAILER,
      status: USER_STATUS.ACTIVE,
    });
    const activeRetailer = await User.create({
      name: 'Retailer B',
      email: 'blocking-retailer-b@example.test',
      passwordHash: await User.hashPassword('Password@123'),
      role: ROLES.RETAILER,
      status: USER_STATUS.ACTIVE,
    });
    blockedRetailerToken = AuthService.generateTokens(blockedRetailer).accessToken;
    activeRetailerToken = AuthService.generateTokens(activeRetailer).accessToken;

    await WholesalerRetailerRelationship.create([
      { wholesalerId: blockedWholesaler._id, retailerId: blockedRetailer._id },
      { wholesalerId: activeWholesaler._id, retailerId: activeRetailer._id },
    ]);

    const category = await Category.create({ name: 'Blocking Test', slug: 'blocking-test' });
    [blockedProduct] = await Product.create([
      {
        wholesalerId: blockedWholesaler._id,
        name: 'Product A',
        slug: 'blocking-product-a',
        sku: 'BLOCKING-A',
        categoryId: category._id,
        wholesalePrice: 100,
        status: 'ACTIVE',
      },
      {
        wholesalerId: activeWholesaler._id,
        name: 'Product B',
        slug: 'blocking-product-b',
        sku: 'BLOCKING-B',
        categoryId: category._id,
        wholesalePrice: 100,
        status: 'ACTIVE',
      },
    ]);
    order = await Order.create({
      orderNumber: 'BLOCKING-HISTORY',
      retailerId: blockedRetailer._id,
      wholesalerId: blockedWholesaler._id,
      items: [{
        productId: blockedProduct._id,
        name: blockedProduct.name,
        sku: blockedProduct.sku,
        quantity: 1,
        pricePerUnit: 100,
        subtotal: 100,
        total: 100,
      }],
      subtotal: 100,
      grandTotal: 100,
      orderStatus: 'CONFIRMED',
    });
  });

  test('blocking is Super Admin-only, reversible, and preserves retailer history and wholesaler data', async () => {
    const endpoint = `/api/v1/admin/wholesalers/${blockedProfile._id}/block`;

    const unauthorizedBlock = await request(app)
      .patch(endpoint)
      .set('Authorization', `Bearer ${regularAdminToken}`)
      .send({ blocked: true });
    expect(unauthorizedBlock.status).toBe(403);

    const blockResponse = await request(app)
      .patch(endpoint)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ blocked: true });
    expect(blockResponse.status).toBe(200);
    expect((await User.findById(blockedWholesaler._id)).status).toBe(USER_STATUS.BLOCKED);
    expect((await WholesalerProfile.findById(blockedProfile._id)).kycStatus).toBe(KYC_STATUS.APPROVED);

    const blockedLogin = await request(app).post('/api/v1/auth/login').send({
      email: blockedWholesaler.email,
      password: 'Password@123',
    });
    expect(blockedLogin.status).toBe(403);

    const blockedDirectApi = await request(app)
      .get('/api/v1/products/wholesaler')
      .set('Authorization', `Bearer ${AuthService.generateTokens(blockedWholesaler).accessToken}`);
    expect(blockedDirectApi.status).toBe(403);

    const blockedRetailCatalog = await request(app)
      .get('/api/v1/products/retailer')
      .set('Authorization', `Bearer ${blockedRetailerToken}`);
    expect(blockedRetailCatalog.status).toBe(403);
    expect(blockedRetailCatalog.body.code).toBe('WHOLESALER_UNAVAILABLE');

    const blockedProductDetails = await request(app).get(`/api/v1/products/${blockedProduct._id}`);
    expect(blockedProductDetails.status).toBe(403);
    expect(blockedProductDetails.body.code).toBe('WHOLESALER_UNAVAILABLE');

    const blockedReferral = await request(app).get('/api/v1/referral/BLOCKA');
    expect(blockedReferral.status).toBe(403);
    expect(blockedReferral.body.code).toBe('WHOLESALER_UNAVAILABLE');

    const otherRetailerCatalog = await request(app)
      .get('/api/v1/products/retailer')
      .set('Authorization', `Bearer ${activeRetailerToken}`);
    expect(otherRetailerCatalog.status).toBe(200);
    expect(otherRetailerCatalog.body.data.map((product) => product.name)).toContain('Product B');

    const history = await request(app)
      .get('/api/v1/orders')
      .set('Authorization', `Bearer ${blockedRetailerToken}`);
    expect(history.status).toBe(200);
    expect(history.body.data.items.some((item) => item.orderNumber === order.orderNumber)).toBe(true);

    const stillStoredProduct = await Product.findById(blockedProduct._id);
    expect(stillStoredProduct).not.toBeNull();
    expect(await Order.findById(order._id)).not.toBeNull();

    const genericUnblock = await request(app)
      .patch(`/api/v1/admin/wholesalers/${blockedProfile._id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'ACTIVE' });
    expect(genericUnblock.status).toBe(403);

    const unblockResponse = await request(app)
      .patch(endpoint)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ blocked: false });
    expect(unblockResponse.status).toBe(200);
    expect((await User.findById(blockedWholesaler._id)).status).toBe(USER_STATUS.ACTIVE);
    expect((await WholesalerProfile.findById(blockedProfile._id)).kycStatus).toBe(KYC_STATUS.APPROVED);

    const restoredCatalog = await request(app)
      .get('/api/v1/products/retailer')
      .set('Authorization', `Bearer ${blockedRetailerToken}`);
    expect(restoredCatalog.status).toBe(200);
    expect(restoredCatalog.body.data.map((product) => product.name)).toContain('Product A');

    const restoredWholesalerApi = await request(app)
      .get('/api/v1/products/wholesaler')
      .set('Authorization', `Bearer ${AuthService.generateTokens(blockedWholesaler).accessToken}`);
    expect(restoredWholesalerApi.status).toBe(200);
  });

  test('returns the selected wholesaler profile and its own related records for profile or user IDs', async () => {
    const [first, second, firstByUserId] = await Promise.all([
      request(app)
        .get(`/api/v1/admin/wholesalers/${blockedProfile._id}`)
        .set('Authorization', `Bearer ${adminToken}`),
      request(app)
        .get(`/api/v1/admin/wholesalers/${activeProfile._id}`)
        .set('Authorization', `Bearer ${adminToken}`),
      request(app)
        .get(`/api/v1/admin/wholesalers/${blockedWholesaler._id}`)
        .set('Authorization', `Bearer ${adminToken}`),
    ]);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(firstByUserId.status).toBe(200);
    expect(first.body.data.profile).toMatchObject({
      id: String(blockedProfile._id),
      userId: String(blockedWholesaler._id),
      businessName: 'Business A',
    });
    expect(second.body.data.profile.businessName).toBe('Business B');
    expect(firstByUserId.body.data.profile.id).toBe(String(blockedProfile._id));
    expect(first.body.data.products.map((product) => product.name)).toEqual(['Product A']);
    expect(second.body.data.products.map((product) => product.name)).toEqual(['Product B']);
    expect(first.body.data.metrics).toMatchObject({
      totalProducts: 1,
      totalCategories: 1,
      totalOrders: 1,
    });
    expect(first.body.data.paymentMetrics.totalCount).toBe(0);
  });

  test('lists purchased subscription statuses independently from account and KYC status', async () => {
    const now = new Date();
    const activePlanId = new mongoose.Types.ObjectId();
    const expiredPlanId = new mongoose.Types.ObjectId();
    await WholesalerSubscription.create([
      {
        userId: blockedWholesaler._id,
        wholesalerProfileId: blockedProfile._id,
        planId: activePlanId,
        planName: 'Growth Monthly',
        amount: 499,
        status: 'ACTIVE',
        startedAt: now,
        renewalDate: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
        razorpayOrderId: 'active-subscription-order',
        razorpayPaymentId: 'active-subscription-payment',
      },
      {
        userId: activeWholesaler._id,
        wholesalerProfileId: activeProfile._id,
        planId: expiredPlanId,
        planName: 'Business Yearly',
        amount: 3000,
        status: 'ACTIVE',
        startedAt: new Date(now.getTime() - 400 * 24 * 60 * 60 * 1000),
        renewalDate: new Date(now.getTime() - 35 * 24 * 60 * 60 * 1000),
        razorpayOrderId: 'expired-subscription-order',
        razorpayPaymentId: 'expired-subscription-payment',
      },
    ]);
    await SubscriptionPayment.create({
      userId: blockedWholesaler._id,
      wholesalerProfileId: blockedProfile._id,
      planId: activePlanId,
      planName: 'Growth Monthly',
      amount: 499,
      amountPaise: 49900,
      status: 'PAID',
      razorpayOrderId: 'paid-subscription-order',
      razorpayPaymentId: 'paid-subscription-payment',
      verifiedAt: now,
    });
    blockedWholesaler.status = USER_STATUS.BLOCKED;
    await blockedWholesaler.save();
    activeProfile.kycStatus = KYC_STATUS.REJECTED;
    await activeProfile.save();

    const noSubscriptionUser = await User.create({
      name: 'Wholesaler C',
      email: 'blocking-wholesaler-c@example.test',
      passwordHash: await User.hashPassword('Password@123'),
      role: ROLES.WHOLESALER,
      status: USER_STATUS.ACTIVE,
    });
    const noSubscriptionProfile = await WholesalerProfile.create({
      userId: noSubscriptionUser._id,
      businessName: 'Business C',
      kycStatus: KYC_STATUS.DRAFT,
    });

    const listing = await request(app)
      .get('/api/v1/admin/wholesalers?limit=100')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(listing.status).toBe(200);
    const byBusiness = new Map(listing.body.data.items.map((row) => [row.businessName, row]));
    expect(byBusiness.get('Business A')).toMatchObject({
      status: USER_STATUS.BLOCKED,
      kycStatus: KYC_STATUS.APPROVED,
      subscriptionStatus: 'ACTIVE',
      subscription: { planName: 'Growth Monthly', status: 'ACTIVE' },
    });
    expect(byBusiness.get('Business B')).toMatchObject({
      status: USER_STATUS.ACTIVE,
      kycStatus: KYC_STATUS.REJECTED,
      subscriptionStatus: 'EXPIRED',
      subscription: { planName: 'Business Yearly', status: 'EXPIRED' },
    });
    expect(byBusiness.get('Business C')).toMatchObject({
      status: USER_STATUS.ACTIVE,
      kycStatus: KYC_STATUS.DRAFT,
      subscription: null,
      subscriptionStatus: 'NO_SUBSCRIPTION',
    });

    const filtered = await request(app)
      .get('/api/v1/admin/wholesalers?limit=100&status=active&kycStatus=rejected&subscriptionStatus=expired')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(filtered.status).toBe(200);
    expect(filtered.body.data.items.map((row) => row.id)).toEqual([String(activeProfile._id)]);

    const noSubscription = await request(app)
      .get('/api/v1/admin/wholesalers?limit=100&subscriptionStatus=no_subscription')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(noSubscription.status).toBe(200);
    expect(noSubscription.body.data.items.map((row) => row.id)).toEqual([String(noSubscriptionProfile._id)]);

    const details = await request(app)
      .get(`/api/v1/admin/wholesalers/${blockedProfile._id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(details.status).toBe(200);
    expect(details.body.data.subscription.status).toBe('ACTIVE');
    expect(details.body.data.subscriptionPayments).toHaveLength(1);
    expect(details.body.data.subscriptionPayments[0]).toMatchObject({
      planName: 'Growth Monthly',
      status: 'PAID',
    });
  });
});
