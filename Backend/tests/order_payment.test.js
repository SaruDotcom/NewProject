const request = require('supertest');
const app = require('../src/app');
const { setupTestDB, clearDatabase } = require('./setup');
const {
  User,
  WholesalerProfile,
  RetailerProfile,
  WholesalerRetailerRelationship,
  Category,
  Product,
  Inventory,
  Order,
  Payment,
  Wallet,
  Earning,
} = require('../src/models');
const { ROLES, USER_STATUS, KYC_STATUS, RELATIONSHIP_STATUS, ORDER_STATUS, PAYMENT_STATUS } = require('../src/config/constants');

setupTestDB();

describe('Orders, Inventory Reservation & Payments Test Suite', () => {
  let wholesalerUser;
  let retailerUser;
  let wholesalerToken;
  let retailerToken;
  let product;
  let inventory;

  beforeEach(async () => {
    await clearDatabase();

    // 1. Category
    const category = await Category.create({ name: 'Gadgets', slug: 'gadgets' });

    // 2. Wholesaler
    const wsHash = await User.hashPassword('Wholesaler123');
    wholesalerUser = await User.create({
      name: 'Omni Wholesaler',
      email: 'omni@wholesale.com',
      passwordHash: wsHash,
      role: ROLES.WHOLESALER,
      status: USER_STATUS.ACTIVE,
    });
    const wallet = await Wallet.create({ ownerId: wholesalerUser._id, ownerType: 'WHOLESALER', availableBalance: 0 });
    await WholesalerProfile.create({
      userId: wholesalerUser._id,
      businessName: 'Omni Supplies',
      kycStatus: KYC_STATUS.APPROVED,
      isVerified: true,
      walletId: wallet._id,
      commissionRate: 5.0,
      paymentSettings: {
        upiId: 'omni@upi',
        upiIdPaymentsEnabled: true,
        qrPaymentsEnabled: false,
      },
    });

    const wsLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'omni@wholesale.com',
      password: 'Wholesaler123',
    });
    wholesalerToken = wsLogin.body.data.token;

    // 3. Product with 100 stock & MOQ = 10
    product = await Product.create({
      wholesalerId: wholesalerUser._id,
      name: 'Smart Bluetooth Tracker',
      slug: 'smart-bluetooth-tracker',
      sku: 'TRK-01',
      wholesalePrice: 200,
      stock: 100,
      moq: 10,
      gst: 18,
      categoryId: category._id,
      status: 'ACTIVE',
    });
    inventory = await Inventory.create({
      productId: product._id,
      wholesalerId: wholesalerUser._id,
      available: 100,
      reserved: 0,
      sold: 0,
    });

    // 4. Retailer linked to Wholesaler
    const retHash = await User.hashPassword('Retailer123');
    retailerUser = await User.create({
      name: 'Retailer Rohan',
      email: 'rohan@retail.com',
      passwordHash: retHash,
      role: ROLES.RETAILER,
      status: USER_STATUS.ACTIVE,
    });
    const retailerProfile = await RetailerProfile.create({
      userId: retailerUser._id,
      businessName: 'Rohan Tech Shop',
      assignedWholesalerId: wholesalerUser._id,
    });
    const rel = await WholesalerRetailerRelationship.create({
      wholesalerId: wholesalerUser._id,
      retailerId: retailerUser._id,
      status: RELATIONSHIP_STATUS.ACTIVE,
    });
    retailerProfile.activeRelationshipId = rel._id;
    await retailerProfile.save();

    const retLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'rohan@retail.com',
      password: 'Retailer123',
    });
    retailerToken = retLogin.body.data.token;
  });

  test('1. Retailer places order: Server calculates authoritative pricing & reserves stock', async () => {
    const orderPayload = {
      wholesalerId: wholesalerUser._id,
      items: [
        {
          productId: product._id,
          quantity: 10,
          // Intentionally passing fraudulent low price from frontend -> backend must ignore!
          pricePerUnit: 1,
        },
      ],
      shippingAddress: {
        street: '10 Main Road',
        city: 'Bengaluru',
        state: 'Karnataka',
        pincode: '560001',
      },
    };

    const res = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${retailerToken}`)
      .send(orderPayload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);

    const order = res.body.data.order;
    // Subtotal must be authoritative: 10 * 200 = 2000
    expect(order.subtotal).toBe(2000);
    // Tax: 18% of 2000 = 360
    expect(order.tax).toBe(360);
    expect(order.grandTotal).toBe(2360);
    expect(order.orderStatus).toBe(ORDER_STATUS.PENDING);
    expect(order.shippingAddress.street).toBe('10 Main Road');
    expect(order.shippingAddress.pincode).toBe('560001');

    // Verify Inventory: 10 units reserved, 90 available
    const inv = await Inventory.findOne({ productId: product._id });
    expect(inv.available).toBe(90);
    expect(inv.reserved).toBe(10);
  });

  test('wholesaler status updates persist canonically and are returned to the retailer', async () => {
    const createRes = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${retailerToken}`)
      .send({ items: [{ productId: product._id, quantity: 10 }] });
    const orderId = createRes.body.data.order._id;

    const confirmRes = await request(app)
      .patch(`/api/v1/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${wholesalerToken}`)
      .send({ status: 'Confirmed' });

    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.data.orderStatus).toBe(ORDER_STATUS.CONFIRMED);
    expect((await Order.findById(orderId)).orderStatus).toBe(ORDER_STATUS.CONFIRMED);

    await request(app)
      .patch(`/api/v1/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${wholesalerToken}`)
      .send({ status: ORDER_STATUS.CONFIRMED })
      .expect(200);
    expect((await Order.findById(orderId)).statusTimeline).toHaveLength(2);

    const inventoryAfterConfirmation = await Inventory.findOne({ productId: product._id });
    expect(inventoryAfterConfirmation.available).toBe(90);
    expect(inventoryAfterConfirmation.reserved).toBe(10);

    const shipRes = await request(app)
      .patch(`/api/v1/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${wholesalerToken}`)
      .send({ status: ORDER_STATUS.SHIPPED });
    expect(shipRes.status).toBe(200);
    expect(shipRes.body.data.orderStatus).toBe(ORDER_STATUS.SHIPPED);

    const retailerOrdersRes = await request(app)
      .get('/api/v1/orders')
      .set('Authorization', `Bearer ${retailerToken}`);
    expect(retailerOrdersRes.status).toBe(200);
    expect(retailerOrdersRes.body.data.items).toHaveLength(1);
    expect(retailerOrdersRes.body.data.items[0]._id).toBe(orderId);
    expect(retailerOrdersRes.body.data.items[0].orderStatus).toBe(ORDER_STATUS.SHIPPED);
  });

  test('invalid wholesaler order status is rejected without changing the saved status', async () => {
    const createRes = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${retailerToken}`)
      .send({ items: [{ productId: product._id, quantity: 10 }] });
    const orderId = createRes.body.data.order._id;

    const statusRes = await request(app)
      .patch(`/api/v1/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${wholesalerToken}`)
      .send({ status: 'NOT_A_STATUS' });

    expect(statusRes.status).toBe(400);
    expect(statusRes.body.code).toBe('INVALID_ORDER_STATUS');
    expect((await Order.findById(orderId)).orderStatus).toBe(ORDER_STATUS.PENDING);
  });

  test('2. MOQ of 10 rejects direct API orders below the minimum', async () => {
    const res = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${retailerToken}`)
      .send({
        items: [{ productId: product._id, quantity: 9 }],
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('MOQ_NOT_MET');
  });

  test('fractional unit quantities are rejected', async () => {
    const res = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${retailerToken}`)
      .send({
        items: [{ productId: product._id, quantity: 10.5 }],
      });

    expect(res.status).toBe(400);
  });

  test('retailer checkout returns field-level validation details for incomplete addresses', async () => {
    const res = await request(app)
      .post('/api/v1/retailer/checkout')
      .set('Authorization', `Bearer ${retailerToken}`)
      .send({
        paymentMethod: 'ONLINE',
        items: [{ productId: product._id, quantity: 10 }],
        shippingAddress: { addressLine1: '10 Main Road' },
      });

    expect(res.status).toBe(422);
    expect(res.body.message).toBe('Validation error in request parameters');
    expect(res.body.errors.map((error) => error.field)).toEqual(
      expect.arrayContaining(['shippingAddress.city', 'shippingAddress.state']),
    );
  });

  test('direct UPI checkout stays pending until the wholesaler confirms a payment report', async () => {
    const checkout = await request(app)
      .post('/api/v1/retailer/checkout')
      .set('Authorization', `Bearer ${retailerToken}`)
      .send({
        paymentMethod: 'UPI',
        items: [{ productId: product._id, quantity: 10 }],
        shippingAddress: {
          addressLine1: '10 Main Road',
          city: 'Bengaluru',
          state: 'Karnataka',
          postalCode: '560001',
          contactName: 'Rohan',
          phone: '9876543210',
        },
      });

    expect(checkout.status).toBe(201);
    expect(checkout.body.data.order.paymentStatus).toBe(PAYMENT_STATUS.PENDING);
    expect(checkout.body.data.order.paymentMethod).toBe('UPI');

    const report = await request(app)
      .post('/api/v1/retailer/payments/reports')
      .set('Authorization', `Bearer ${retailerToken}`)
      .send({
        orderId: checkout.body.data.order._id,
        amount: '2360',
        transactionReference: 'DIRECT-UPI-REF-10001',
      });

    expect(report.status).toBe(201);
    expect(report.body.data.status).toBe(PAYMENT_STATUS.PENDING);
    const verification = await request(app)
      .patch(`/api/v1/wholesaler/payment-reports/${report.body.data._id}`)
      .set('Authorization', `Bearer ${wholesalerToken}`)
      .send({ action: 'VERIFY', note: 'Matched in bank statement' });

    expect(verification.status).toBe(200);
    expect(verification.body.data.status).toBe(PAYMENT_STATUS.PAID);
    const paidOrder = await Order.findById(checkout.body.data.order._id);
    expect(paidOrder.paymentStatus).toBe(PAYMENT_STATUS.PAID);
    expect(await Payment.countDocuments({ orderId: paidOrder._id, status: PAYMENT_STATUS.PAID })).toBe(2);
  });

  test('retailer credit requests require approval and verified installments clear the balance once', async () => {
    const requestResponse = await request(app)
      .post('/api/v1/retailer/credit-request')
      .set('Authorization', `Bearer ${retailerToken}`)
      .send({});
    expect(requestResponse.status).toBe(200);
    expect(requestResponse.body.data.creditStatus).toBe('PENDING_APPROVAL');
    const unapprovedOrder = await request(app)
      .post('/api/v1/retailer/checkout')
      .set('Authorization', `Bearer ${retailerToken}`)
      .send({
        paymentMethod: 'CREDIT',
        items: [{ productId: product._id, quantity: 10 }],
        shippingAddress: {
          addressLine1: '10 Main Road',
          city: 'Bengaluru',
          state: 'Karnataka',
          postalCode: '560001',
        },
      });
    expect(unapprovedOrder.status).toBe(400);
    expect(unapprovedOrder.body.code).toBe('CREDIT_DISABLED');

    await request(app)
      .patch('/api/v1/wholesaler/credit-policy')
      .set('Authorization', `Bearer ${wholesalerToken}`)
      .send({ creditEnabled: true, defaultCreditLimit: 5000, creditPeriodDays: 15 });

    const approval = await request(app)
      .patch(`/api/v1/wholesaler/retailers/${retailerUser._id}/credit-policy`)
      .set('Authorization', `Bearer ${wholesalerToken}`)
      .send({ status: 'APPROVED', customCreditLimit: 3000, creditPeriodDays: 30 });
    expect(approval.status).toBe(200);

    const orderResponse = await request(app)
      .post('/api/v1/retailer/checkout')
      .set('Authorization', `Bearer ${retailerToken}`)
      .send({
        paymentMethod: 'CREDIT',
        items: [{ productId: product._id, quantity: 10 }],
        shippingAddress: {
          addressLine1: '10 Main Road',
          city: 'Bengaluru',
          state: 'Karnataka',
          postalCode: '560001',
        },
      });
    expect(orderResponse.status).toBe(201);
    expect(orderResponse.body.data.order.creditDueDate).toBeDefined();

    const overLimit = await request(app)
      .post('/api/v1/retailer/checkout')
      .set('Authorization', `Bearer ${retailerToken}`)
      .send({
        paymentMethod: 'CREDIT',
        items: [{ productId: product._id, quantity: 10 }],
        shippingAddress: {
          addressLine1: '10 Main Road',
          city: 'Bengaluru',
          state: 'Karnataka',
          postalCode: '560001',
        },
      });
    expect(overLimit.status).toBe(400);
    expect(overLimit.body.code).toBe('CREDIT_LIMIT_EXCEEDED');

    const firstInstallment = await request(app)
      .post('/api/v1/retailer/payments/reports')
      .set('Authorization', `Bearer ${retailerToken}`)
      .send({
        type: 'CREDIT_REPAYMENT',
        amount: '1000',
        transactionReference: 'CREDIT-UPI-REF-10001',
      });
    expect(firstInstallment.status).toBe(201);
    await request(app)
      .patch(`/api/v1/wholesaler/payment-reports/${firstInstallment.body.data._id}`)
      .set('Authorization', `Bearer ${wholesalerToken}`)
      .send({ action: 'VERIFY', note: 'First installment received' });

    const secondInstallment = await request(app)
      .post('/api/v1/retailer/payments/reports')
      .set('Authorization', `Bearer ${retailerToken}`)
      .send({
        type: 'CREDIT_REPAYMENT',
        amount: '1360',
        transactionReference: 'CREDIT-UPI-REF-10002',
      });
    expect(secondInstallment.status).toBe(201);
    const finalVerification = await request(app)
      .patch(`/api/v1/wholesaler/payment-reports/${secondInstallment.body.data._id}`)
      .set('Authorization', `Bearer ${wholesalerToken}`)
      .send({ action: 'VERIFY', note: 'Final installment received' });
    expect(finalVerification.status).toBe(200);

    const repeatedVerification = await request(app)
      .patch(`/api/v1/wholesaler/payment-reports/${secondInstallment.body.data._id}`)
      .set('Authorization', `Bearer ${wholesalerToken}`)
      .send({ action: 'VERIFY', note: 'Duplicate confirmation attempt' });
    expect(repeatedVerification.status).toBe(200);
    const relationship = await WholesalerRetailerRelationship.findOne({
      wholesalerId: wholesalerUser._id,
      retailerId: retailerUser._id,
    });
    expect(relationship.currentOutstandingPaise).toBe(0);
    expect(relationship.currentOutstandingAmount).toBe(0);
    const paidOrder = await Order.findById(orderResponse.body.data.order._id);
    expect(paidOrder.creditPaymentStatus).toBe('PAID');
    expect(paidOrder.creditPaidAmount).toBe(2360);
  });

  test('3. Insufficient stock rejected', async () => {
    // Requesting 150 units when only 100 available
    const res = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${retailerToken}`)
      .send({
        items: [{ productId: product._id, quantity: 150 }],
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INSUFFICIENT_STOCK');
  });

  test('4. Order DELIVERED transition settles Earning & credits Wholesaler Wallet', async () => {
    // Place order
    const orderRes = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${retailerToken}`)
      .send({
        items: [{ productId: product._id, quantity: 10 }],
      });

    const orderId = orderRes.body.data.order._id;

    // Wholesaler marks DELIVERED
    const statusRes = await request(app)
      .patch(`/api/v1/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${wholesalerToken}`)
      .send({ status: ORDER_STATUS.DELIVERED });

    expect(statusRes.status).toBe(200);
    expect(statusRes.body.data.orderStatus).toBe(ORDER_STATUS.DELIVERED);
    expect(statusRes.body.data.paymentStatus).toBe(PAYMENT_STATUS.PAID);

    // Verify Earning record created
    const earning = await Earning.findOne({ orderId });
    expect(earning).not.toBeNull();
    expect(earning.status).toBe('SETTLED');
    // Platform commission: 5% of 2000 = 100
    expect(earning.platformCommission).toBe(100);
    // Wholesaler net: 2360 - 100 = 2260
    expect(earning.wholesalerAmount).toBe(2260);

    // Verify Wholesaler Wallet balance credited
    const wallet = await Wallet.findOne({ ownerId: wholesalerUser._id });
    expect(wallet.availableBalance).toBe(2260);
  });

  test('5. Order CANCELLED transition releases reserved stock back to available', async () => {
    const orderRes = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${retailerToken}`)
      .send({
        items: [{ productId: product._id, quantity: 10 }],
      });

    const orderId = orderRes.body.data.order._id;

    // Cancel order
    const cancelRes = await request(app)
      .patch(`/api/v1/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${wholesalerToken}`)
      .send({ status: ORDER_STATUS.CANCELLED });

    expect(cancelRes.status).toBe(200);

    // Stock released back to 100
    const inv = await Inventory.findOne({ productId: product._id });
    expect(inv.available).toBe(100);
    expect(inv.reserved).toBe(0);
  });
});
