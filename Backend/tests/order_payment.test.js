const request = require('supertest');
const fs = require('fs');
const path = require('path');
const app = require('../src/app');
const { setupTestDB, clearDatabase } = require('./setup');
const {
  User,
  KycApplication,
  WholesalerProfile,
  RetailerProfile,
  WholesalerRetailerRelationship,
  Category,
  Product,
  Inventory,
  Order,
  Payment,
  Notification,
  Wallet,
  Earning,
  Coupon,
  InventoryTransaction,
} = require('../src/models');
const { ROLES, USER_STATUS, KYC_STATUS, RELATIONSHIP_STATUS, ORDER_STATUS, PAYMENT_STATUS } = require('../src/config/constants');
const env = require('../src/config/env');

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

  test('tax-inclusive prices are not taxed twice and GST is split by supply state', async () => {
    await WholesalerProfile.updateOne(
      { userId: wholesalerUser._id },
      { $set: { 'address.state': 'Karnataka' } }
    );
    await Product.updateOne(
      { _id: product._id },
      {
        $set: {
          wholesalePrice: 118,
          sellingPrice: 118,
          retailerPrice: 118,
          basePrice: 118,
          gst: 18,
          cgst: 9,
          sgst: 9,
          igst: 18,
          priceIncludesTax: true,
          taxConfigured: true,
        },
      }
    );

    const intraState = await request(app)
      .post('/api/v1/retailer/checkout')
      .set('Authorization', `Bearer ${retailerToken}`)
      .send({
        paymentMethod: 'UPI',
        items: [{ productId: product._id, quantity: 10 }],
        shippingAddress: { addressLine1: '10 Main Road', city: 'Bengaluru', state: 'Karnataka', pincode: '560001' },
      });
    expect(intraState.status).toBe(201);
    expect(intraState.body.data.order.grandTotal).toBe(1180);
    expect(intraState.body.data.order.tax).toBe(180);
    expect(intraState.body.data.order.items[0]).toMatchObject({
      taxableValue: 1000,
      cgstAmount: 90,
      sgstAmount: 90,
      igstAmount: 0,
      total: 1180,
    });

    const interState = await request(app)
      .post('/api/v1/retailer/checkout')
      .set('Authorization', `Bearer ${retailerToken}`)
      .send({
        paymentMethod: 'UPI',
        items: [{ productId: product._id, quantity: 10 }],
        shippingAddress: { addressLine1: '10 Main Road', city: 'Mumbai', state: 'Maharashtra', pincode: '400001' },
      });
    expect(interState.status).toBe(201);
    expect(interState.body.data.order.items[0]).toMatchObject({
      taxableValue: 1000,
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: 180,
      total: 1180,
    });
  });

  test('enabled bank methods show bank details and accept cheque reports', async () => {
    await WholesalerProfile.updateOne(
      { userId: wholesalerUser._id },
      {
        $set: {
          'bankDetails.accountHolderName': 'Omni Supplies',
          'bankDetails.bankName': 'Example Bank',
          'bankDetails.accountNumber': '123456789012',
          'bankDetails.ifscCode': 'EXAM0001234',
          'bankDetails.branch': 'Bengaluru Main',
          'bankDetails.isVerified': true,
        },
      }
    );
    const settings = await request(app)
      .patch('/api/v1/wholesaler/payment-settings')
      .set('Authorization', `Bearer ${wholesalerToken}`)
      .field('accountHolderName', 'Omni Supplies')
      .field('bankName', 'Example Bank')
      .field('accountNumber', '123456789012')
      .field('ifscCode', 'EXAM0001234')
      .field('branch', 'Bengaluru Main')
      .field('additionalPaymentMethods', JSON.stringify(['NET_BANKING', 'CASH_DEPOSIT', 'CHEQUE']));
    expect(settings.status).toBe(200);

    const options = await request(app)
      .get('/api/v1/retailer/payment-options')
      .set('Authorization', `Bearer ${retailerToken}`);
    expect(options.body.data.paymentMethods).toEqual(expect.arrayContaining(['UPI', 'NET_BANKING', 'CASH_DEPOSIT', 'CHEQUE']));
    expect(options.body.data.bankDetailsStatus).toBe('VERIFIED');
    expect(options.body.data.bankDetails).toMatchObject({
      accountHolderName: 'Omni Supplies',
      bankName: 'Example Bank',
      accountNumber: '123456789012',
      ifscCode: 'EXAM0001234',
    });

    const checkout = await request(app)
      .post('/api/v1/retailer/checkout')
      .set('Authorization', `Bearer ${retailerToken}`)
      .send({
        paymentMethod: 'CHEQUE',
        items: [{ productId: product._id, quantity: 10 }],
        shippingAddress: { addressLine1: '10 Main Road', city: 'Bengaluru', state: 'Karnataka', pincode: '560001' },
      });
    expect(checkout.status).toBe(201);
    const report = await request(app)
      .post('/api/v1/retailer/payments/reports')
      .set('Authorization', `Bearer ${retailerToken}`)
      .field('orderId', checkout.body.data.order._id)
      .field('amount', '2360')
      .field('paymentMethod', 'CHEQUE')
      .field('transactionReference', 'CHEQUE-REF-10001')
      .field('paymentDetails', 'Cheque 10001 dated 2026-01-15')
      .attach('screenshot', Buffer.from('%PDF-1.4\n%%EOF'), {
        filename: 'cheque-receipt.pdf',
        contentType: 'application/pdf',
      });
    expect(report.status).toBe(201);
    expect(report.body.data.paymentMethod).toBe('CHEQUE');
    expect(report.body.data.paymentDetails).toBe('Cheque 10001 dated 2026-01-15');
    expect(report.body.data.screenshotAvailable).toBe(true);
    expect(await Notification.countDocuments({ recipientId: wholesalerUser._id, 'data.paymentReportId': report.body.data._id })).toBe(1);
    const savedReport = await Payment.findById(report.body.data._id);
    const evidence = await request(app)
      .get(`/api/v1/wholesaler/payment-reports/${report.body.data._id}/screenshot`)
      .set('Authorization', `Bearer ${wholesalerToken}`);
    if (evidence.status !== 200) throw new Error(`Evidence request failed: ${evidence.status} ${JSON.stringify(evidence.body)}`);
    expect(evidence.status).toBe(200);
    expect(evidence.headers['content-type']).toContain('application/pdf');
    expect(evidence.body.subarray(0, 5).toString()).toBe('%PDF-');
    await fs.promises.unlink(path.join(env.UPLOAD_PATH, 'payment-reports', path.basename(savedReport.screenshotPath)));
  });

  test('payment settings restore missing bank fields from the original KYC details', async () => {
    const originalBankDetails = {
      accountHolderName: 'Original Account Holder',
      bankName: 'Original Bank',
      accountNumber: '1122334455667788',
      ifscCode: 'ORIG0001234',
      branch: 'Original Branch',
    };
    await KycApplication.create({
      wholesalerId: wholesalerUser._id,
      pan: 'AAACP1234F',
      bankDetails: originalBankDetails,
    });
    await WholesalerProfile.updateOne(
      { userId: wholesalerUser._id },
      {
        $set: {
          'bankDetails.accountHolderName': originalBankDetails.accountHolderName,
          'bankDetails.bankName': originalBankDetails.bankName,
          'bankDetails.accountNumber': '',
          'bankDetails.ifscCode': originalBankDetails.ifscCode,
          'bankDetails.branch': originalBankDetails.branch,
          'bankDetails.isVerified': true,
        },
      }
    );

    const settings = await request(app)
      .get('/api/v1/wholesaler/payment-settings')
      .set('Authorization', `Bearer ${wholesalerToken}`);
    expect(settings.status).toBe(200);
    expect(settings.body.data.bankDetails).toMatchObject({ ...originalBankDetails, isVerified: true });

    const retailerOptions = await request(app)
      .get('/api/v1/retailer/payment-options')
      .set('Authorization', `Bearer ${retailerToken}`);
    expect(retailerOptions.body.data.bankDetailsStatus).toBe('VERIFIED');
    expect(retailerOptions.body.data.bankDetails).toEqual(originalBankDetails);

    const saved = await request(app)
      .patch('/api/v1/wholesaler/payment-settings')
      .set('Authorization', `Bearer ${wholesalerToken}`)
      .field('accountNumber', '');
    expect(saved.status).toBe(200);
    expect(saved.body.data.bankDetails).toMatchObject({ ...originalBankDetails, isVerified: true });
    const profile = await WholesalerProfile.findOne({ userId: wholesalerUser._id });
    expect(profile.bankDetails.accountNumber).toBe(originalBankDetails.accountNumber);
  });

  test('unverified or invalid bank details are not shared with retailers', async () => {
    const emptyOptions = await request(app)
      .get('/api/v1/retailer/payment-options')
      .set('Authorization', `Bearer ${retailerToken}`);
    expect(emptyOptions.body.data.bankDetailsStatus).toBe('NOT_ADDED');
    expect(emptyOptions.body.data.bankDetails).toBeNull();

    await request(app)
      .patch('/api/v1/wholesaler/profile')
      .set('Authorization', `Bearer ${wholesalerToken}`)
      .send({ bankDetails: { accountNumber: '123456789012' } });
    const profileAfterGenericUpdate = await WholesalerProfile.findOne({ userId: wholesalerUser._id });
    expect(profileAfterGenericUpdate.bankDetails.accountNumber).toBe('');

    const invalid = await request(app)
      .patch('/api/v1/wholesaler/payment-settings')
      .set('Authorization', `Bearer ${wholesalerToken}`)
      .field('accountHolderName', 'Omni Supplies')
      .field('bankName', 'Example Bank')
      .field('accountNumber', '12345ABC')
      .field('ifscCode', 'INVALID')
      .field('branch', 'Bengaluru Main');
    expect(invalid.status).toBe(400);

    const saved = await request(app)
      .patch('/api/v1/wholesaler/payment-settings')
      .set('Authorization', `Bearer ${wholesalerToken}`)
      .field('accountHolderName', 'Omni Supplies')
      .field('bankName', 'Example Bank')
      .field('accountNumber', '123456789012')
      .field('ifscCode', 'EXAM0001234')
      .field('branch', 'Bengaluru Main');
    expect(saved.status).toBe(200);

    const unverifiedOptions = await request(app)
      .get('/api/v1/retailer/payment-options')
      .set('Authorization', `Bearer ${retailerToken}`);
    expect(unverifiedOptions.body.data.bankDetailsStatus).toBe('UNVERIFIED');
    expect(unverifiedOptions.body.data.bankDetails).toBeNull();
    expect(unverifiedOptions.body.data.paymentMethods).not.toContain('CHEQUE');
    await WholesalerProfile.updateOne(
      { userId: wholesalerUser._id },
      { $set: { 'paymentSettings.additionalPaymentMethods': ['CHEQUE'] } }
    );
    const checkout = await request(app)
      .post('/api/v1/retailer/checkout')
      .set('Authorization', `Bearer ${retailerToken}`)
      .send({
        paymentMethod: 'CHEQUE',
        items: [{ productId: product._id, quantity: 10 }],
        shippingAddress: { addressLine1: '10 Main Road', city: 'Bengaluru', state: 'Karnataka', pincode: '560001' },
      });
    expect(checkout.status).toBe(400);
  });

  test('changing a verified bank account removes retailer visibility until reverified', async () => {
    await WholesalerProfile.updateOne(
      { userId: wholesalerUser._id },
      {
        $set: {
          'bankDetails.accountHolderName': 'Omni Supplies',
          'bankDetails.bankName': 'Example Bank',
          'bankDetails.accountNumber': '123456789012',
          'bankDetails.ifscCode': 'EXAM0001234',
          'bankDetails.branch': 'Bengaluru Main',
          'bankDetails.isVerified': true,
        },
      }
    );

    const saved = await request(app)
      .patch('/api/v1/wholesaler/payment-settings')
      .set('Authorization', `Bearer ${wholesalerToken}`)
      .field('accountHolderName', 'Omni Supplies')
      .field('bankName', 'Example Bank')
      .field('accountNumber', '123456789013')
      .field('ifscCode', 'EXAM0001234')
      .field('branch', 'Bengaluru Main');
    expect(saved.status).toBe(200);
    expect(saved.body.data.bankDetails.isVerified).toBe(false);

    const options = await request(app)
      .get('/api/v1/retailer/payment-options')
      .set('Authorization', `Bearer ${retailerToken}`);
    expect(options.body.data.bankDetailsStatus).toBe('UNVERIFIED');
    expect(options.body.data.bankDetails).toBeNull();
  });

  test('payment settings reject malformed bank fields and UPI IDs', async () => {
    const validDetails = {
      accountHolderName: 'Omni Supplies',
      bankName: 'Example Bank',
      accountNumber: '123456789012',
      ifscCode: 'EXAM0001234',
      branch: 'Bengaluru Main',
    };
    const invalidFields = [
      ['accountHolderName', 'A!'],
      ['bankName', '?'],
      ['accountNumber', '12345ABC'],
      ['ifscCode', 'INVALID'],
      ['branch', '!'],
      ['upiId', 'not-an-upi-id'],
    ];

    for (const [field, value] of invalidFields) {
      const requestBuilder = request(app)
        .patch('/api/v1/wholesaler/payment-settings')
        .set('Authorization', `Bearer ${wholesalerToken}`);
      for (const [detail, detailValue] of Object.entries(validDetails)) {
        requestBuilder.field(detail, detail === field ? value : detailValue);
      }
      if (field === 'upiId') requestBuilder.field('upiId', value);
      const response = await requestBuilder;
      expect(response.status).toBe(400);
    }
  });

  test('high-value report approval requires an owner-only MSG91 code', async () => {
    const originalAuthKey = env.MSG91_AUTH_KEY;
    const originalTemplateId = env.MSG91_TEMPLATE_ID;
    const originalFetch = global.fetch;
    env.MSG91_AUTH_KEY = 'test-auth-key';
    env.MSG91_TEMPLATE_ID = 'test-flow-id';
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ type: 'success' }) });
    await User.updateOne({ _id: wholesalerUser._id }, { $set: { phone: '9876543210' } });
    await WholesalerProfile.updateOne({ userId: wholesalerUser._id }, { $set: { 'paymentSettings.paymentOtpLimit': 1000 } });

    try {
      const checkout = await request(app)
        .post('/api/v1/retailer/checkout')
        .set('Authorization', `Bearer ${retailerToken}`)
        .send({
          paymentMethod: 'UPI',
          items: [{ productId: product._id, quantity: 10 }],
          shippingAddress: { addressLine1: '10 Main Road', city: 'Bengaluru', state: 'Karnataka', pincode: '560001' },
        });
      const report = await request(app)
        .post('/api/v1/retailer/payments/reports')
        .set('Authorization', `Bearer ${retailerToken}`)
        .send({
          orderId: checkout.body.data.order._id,
          amount: '2360',
          transactionReference: 'OTP-UPI-REF-10001',
        });
      const otpResponse = await request(app)
        .post(`/api/v1/wholesaler/payment-reports/${report.body.data._id}/approval-otp`)
        .set('Authorization', `Bearer ${wholesalerToken}`)
        .send({});
      expect(otpResponse.status).toBe(200);
      expect(otpResponse.body.data.sentTo).toBe('******3210');
      const smsBody = JSON.parse(global.fetch.mock.calls[0][1].body);
      expect(smsBody.recipients[0]).toMatchObject({ mobiles: '919876543210' });
      const otp = smsBody.recipients[0].VAR1;

      const missingOtp = await request(app)
        .patch(`/api/v1/wholesaler/payment-reports/${report.body.data._id}`)
        .set('Authorization', `Bearer ${wholesalerToken}`)
        .send({ action: 'VERIFY' });
      expect(missingOtp.status).toBe(400);
      expect(missingOtp.body.code).toBe('PAYMENT_OTP_REQUIRED');

      const verified = await request(app)
        .patch(`/api/v1/wholesaler/payment-reports/${report.body.data._id}`)
        .set('Authorization', `Bearer ${wholesalerToken}`)
        .send({ action: 'VERIFY', otp });
      expect(verified.status).toBe(200);
      expect(verified.body.data.status).toBe(PAYMENT_STATUS.PAID);
    } finally {
      env.MSG91_AUTH_KEY = originalAuthKey;
      env.MSG91_TEMPLATE_ID = originalTemplateId;
      global.fetch = originalFetch;
    }
  });

  test('approved payment reversal preserves the original and writes a separate entry', async () => {
    const checkout = await request(app)
      .post('/api/v1/retailer/checkout')
      .set('Authorization', `Bearer ${retailerToken}`)
      .send({
        paymentMethod: 'UPI',
        items: [{ productId: product._id, quantity: 10 }],
        shippingAddress: { addressLine1: '10 Main Road', city: 'Bengaluru', state: 'Karnataka', pincode: '560001' },
      });
    const report = await request(app)
      .post('/api/v1/retailer/payments/reports')
      .set('Authorization', `Bearer ${retailerToken}`)
      .send({
        orderId: checkout.body.data.order._id,
        amount: '2360',
        transactionReference: 'REVERSAL-UPI-10001',
      });
    await request(app)
      .patch(`/api/v1/wholesaler/payment-reports/${report.body.data._id}`)
      .set('Authorization', `Bearer ${wholesalerToken}`)
      .send({ action: 'VERIFY' })
      .expect(200);

    const reversalResponse = await request(app)
      .post(`/api/v1/wholesaler/payment-reports/${report.body.data._id}/reverse`)
      .set('Authorization', `Bearer ${wholesalerToken}`)
      .send({ reason: 'Payment was entered against the wrong order.' });
    expect(reversalResponse.status).toBe(200);
    expect(reversalResponse.body.data).toMatchObject({
      isReversal: true,
      reversalReason: 'Payment was entered against the wrong order.',
      status: PAYMENT_STATUS.REFUNDED,
    });
    expect((await Payment.findById(report.body.data._id)).status).toBe(PAYMENT_STATUS.PAID);
    expect((await Order.findById(checkout.body.data.order._id)).paymentStatus).toBe(PAYMENT_STATUS.PENDING);

    const duplicate = await request(app)
      .post(`/api/v1/wholesaler/payment-reports/${report.body.data._id}/reverse`)
      .set('Authorization', `Bearer ${wholesalerToken}`)
      .send({ reason: 'Duplicate reverse attempt.' });
    expect(duplicate.status).toBe(409);
  });

  test('retailer can download a PDF invoice only after delivery', async () => {
    const checkout = await request(app)
      .post('/api/v1/retailer/checkout')
      .set('Authorization', `Bearer ${retailerToken}`)
      .send({
        paymentMethod: 'UPI',
        items: [{ productId: product._id, quantity: 10 }],
        shippingAddress: { addressLine1: '10 Main Road', city: 'Bengaluru', state: 'Karnataka', pincode: '560001' },
      });
    const orderId = checkout.body.data.order._id;
    const earlyInvoice = await request(app)
      .get(`/api/v1/retailer/orders/${orderId}/invoice`)
      .set('Authorization', `Bearer ${retailerToken}`);
    expect(earlyInvoice.status).toBe(400);
    expect(earlyInvoice.body.code).toBe('INVOICE_ORDER_NOT_COMPLETED');

    await request(app)
      .patch(`/api/v1/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${wholesalerToken}`)
      .send({ status: ORDER_STATUS.DELIVERED })
      .expect(200);
    const invoice = await request(app)
      .get(`/api/v1/retailer/orders/${orderId}/invoice`)
      .set('Authorization', `Bearer ${retailerToken}`);
    expect(invoice.status).toBe(200);
    expect(invoice.headers['content-type']).toContain('application/pdf');
    expect(invoice.body.subarray(0, 5).toString()).toBe('%PDF-');
    expect(invoice.headers['content-disposition']).toContain(`INV-${checkout.body.data.order.orderNumber}.pdf`);
  });

  test('wholesaler status updates persist canonically and are returned to the retailer', async () => {
    const superAdmin = await User.create({
      name: 'Orders Super Admin',
      email: 'orders-super-admin@example.test',
      passwordHash: await User.hashPassword('SuperAdmin123'),
      role: ROLES.SUPER_ADMIN,
      status: USER_STATUS.ACTIVE,
    });
    const adminLogin = await request(app).post('/api/v1/auth/login').send({
      email: superAdmin.email,
      password: 'SuperAdmin123',
    });
    const superAdminToken = adminLogin.body.data.token;

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
      .send({
        status: ORDER_STATUS.SHIPPED,
        shippingDetails: { courierName: 'Test Courier', trackingNumber: 'TRACK-001' },
      });
    expect(shipRes.status).toBe(200);
    expect(shipRes.body.data.orderStatus).toBe(ORDER_STATUS.SHIPPED);

    const retailerOrdersRes = await request(app)
      .get('/api/v1/orders')
      .set('Authorization', `Bearer ${retailerToken}`);
    expect(retailerOrdersRes.status).toBe(200);
    expect(retailerOrdersRes.body.data.items).toHaveLength(1);
    expect(retailerOrdersRes.body.data.items[0]._id).toBe(orderId);
    expect(retailerOrdersRes.body.data.items[0].orderStatus).toBe(ORDER_STATUS.SHIPPED);

    const wholesalerOrdersRes = await request(app)
      .get('/api/v1/orders')
      .set('Authorization', `Bearer ${wholesalerToken}`);
    expect(wholesalerOrdersRes.status).toBe(200);
    expect(wholesalerOrdersRes.body.data.items).toHaveLength(1);
    expect(wholesalerOrdersRes.body.data.items[0]._id).toBe(orderId);

    const adminOrdersRes = await request(app)
      .get('/api/v1/admin/orders')
      .set('Authorization', `Bearer ${superAdminToken}`);
    expect(adminOrdersRes.status).toBe(200);
    expect(adminOrdersRes.body.data).toMatchObject({
      items: [],
      pagination: { total: 0, totalPages: 0 },
      filters: { wholesalers: [], retailers: [] },
    });
    expect(await Order.countDocuments({ _id: orderId })).toBe(1);
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
    const financialSummary = await request(app)
      .get('/api/v1/wholesaler/financial-summary')
      .set('Authorization', `Bearer ${wholesalerToken}`);
    expect(financialSummary.body.data.thisMonthIncome).toBe(2360);
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
    expect(finalVerification.body.data.orderAllocations).toEqual([
      expect.objectContaining({ orderId: String(paidOrder._id), amountPaise: 136000 }),
    ]);
  });

  test('credit payment reversal restores the balance and preserves the approved report', async () => {
    await request(app)
      .patch('/api/v1/wholesaler/credit-policy')
      .set('Authorization', `Bearer ${wholesalerToken}`)
      .send({ creditEnabled: true, defaultCreditLimit: 5000, creditPeriodDays: 15 })
      .expect(200);
    await request(app)
      .patch(`/api/v1/wholesaler/retailers/${retailerUser._id}/credit-policy`)
      .set('Authorization', `Bearer ${wholesalerToken}`)
      .send({ status: 'APPROVED', customCreditLimit: 3000, creditPeriodDays: 30 })
      .expect(200);

    const checkout = await request(app)
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
    expect(checkout.status).toBe(201);

    const report = await request(app)
      .post('/api/v1/retailer/payments/reports')
      .set('Authorization', `Bearer ${retailerToken}`)
      .send({
        type: 'CREDIT_REPAYMENT',
        amount: '500',
        transactionReference: 'CREDIT-REVERSAL-10001',
      });
    expect(report.status).toBe(201);
    await request(app)
      .patch(`/api/v1/wholesaler/payment-reports/${report.body.data._id}`)
      .set('Authorization', `Bearer ${wholesalerToken}`)
      .send({ action: 'VERIFY' })
      .expect(200);

    const reversal = await request(app)
      .post(`/api/v1/wholesaler/payment-reports/${report.body.data._id}/reverse`)
      .set('Authorization', `Bearer ${wholesalerToken}`)
      .send({ reason: 'Correcting a misapplied credit payment.' });
    expect(reversal.status).toBe(200);
    expect(reversal.body.data).toMatchObject({ isReversal: true, status: PAYMENT_STATUS.REFUNDED });
    expect((await Payment.findById(report.body.data._id)).status).toBe(PAYMENT_STATUS.PAID);

    const relationship = await WholesalerRetailerRelationship.findOne({
      wholesalerId: wholesalerUser._id,
      retailerId: retailerUser._id,
    });
    expect(relationship.currentOutstandingPaise).toBe(236000);
    const order = await Order.findById(checkout.body.data.order._id);
    expect(order.creditPaidAmount).toBe(0);
    expect(order.creditPaymentStatus).toBe('PENDING');
    expect(order.paymentStatus).toBe(PAYMENT_STATUS.PENDING);
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
    expect(statusRes.body.data.paymentStatus).toBe(PAYMENT_STATUS.PENDING);

    const deliveredOrder = await Order.findById(orderId);
    expect(deliveredOrder.inventoryState).toBe('SOLD');
    expect(await Payment.findOne({ orderId })).toMatchObject({ status: PAYMENT_STATUS.PENDING });
    const soldInventory = await Inventory.findOne({ productId: product._id });
    expect(soldInventory.available).toBe(90);
    expect(soldInventory.reserved).toBe(0);
    expect(soldInventory.sold).toBe(10);
    expect(await InventoryTransaction.countDocuments({ referenceId: deliveredOrder.orderNumber, type: 'SALE' })).toBe(1);

    await request(app)
      .patch(`/api/v1/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${wholesalerToken}`)
      .send({ status: ORDER_STATUS.DELIVERED })
      .expect(200);
    expect(await InventoryTransaction.countDocuments({ referenceId: deliveredOrder.orderNumber, type: 'SALE' })).toBe(1);

    const summary = await request(app)
      .get('/api/v1/wholesaler/financial-summary')
      .set('Authorization', `Bearer ${wholesalerToken}`);
    expect(summary.status).toBe(200);
    expect(summary.body.data).toMatchObject({
      thisMonthIncome: 0,
      completedSales: 2360,
    });
    expect(summary.body.data.pendingPayments).toEqual(expect.arrayContaining([
      expect.objectContaining({ orderId, totalAmount: 2360, amountPaid: 0, remainingAmount: 2360 }),
    ]));

    // Verify Earning record created
    const earning = await Earning.findOne({ orderId });
    expect(earning).not.toBeNull();
    expect(earning.status).toBe('PENDING');
    // Platform commission: 5% of 2000 = 100
    expect(earning.platformCommission).toBe(100);
    // Wholesaler net: 2360 - 100 = 2260
    expect(earning.wholesalerAmount).toBe(2260);

    // Verify Wholesaler Wallet balance credited
    const wallet = await Wallet.findOne({ ownerId: wholesalerUser._id });
    expect(wallet.pendingBalance).toBe(2260);
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

  test('retailer checkout rejects COD and applies a valid coupon to the saved order total', async () => {
    const cod = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${retailerToken}`)
      .send({ paymentMethod: 'COD', items: [{ productId: product._id, quantity: 10 }] });
    expect(cod.status).toBe(400);
    expect(cod.body.code).toBe('COD_DISABLED');
    expect(await Order.countDocuments()).toBe(0);

    const coupon = await Coupon.create({
      wholesalerId: wholesalerUser._id,
      code: 'SAVE10',
      title: 'Ten percent off',
      discountType: 'PERCENTAGE',
      discountValue: 10,
      applicableFor: 'RETAILER_ORDER',
    });
    const checkoutPayload = {
      paymentMethod: 'UPI',
      couponCode: 'SAVE10',
      items: [{ productId: product._id, quantity: 10 }],
      shippingAddress: {
        addressLine1: '10 Main Road',
        city: 'Bengaluru',
        state: 'Karnataka',
        pincode: '560001',
      },
    };
    const quote = await request(app)
      .post('/api/v1/retailer/checkout/quote')
      .set('Authorization', `Bearer ${retailerToken}`)
      .send(checkoutPayload);
    expect(quote.status).toBe(200);
    expect(quote.body.data).toMatchObject({ subtotal: 2000, discount: 200, tax: 324, grandTotal: 2124 });
    expect(await Order.countDocuments()).toBe(0);

    const checkout = await request(app)
      .post('/api/v1/retailer/checkout')
      .set('Authorization', `Bearer ${retailerToken}`)
      .send({
        ...checkoutPayload,
        expectedQuoteHash: quote.body.data.quoteHash,
      });

    expect(checkout.status).toBe(201);
    expect(checkout.body.data.order).toMatchObject({ discount: 200, couponCode: 'SAVE10', tax: 324, grandTotal: 2124 });
    expect((await Coupon.findById(coupon._id)).usageCount).toBe(1);
  });

  test('approved credit checkout applies coupon discount before recording the credit due', async () => {
    await request(app)
      .patch('/api/v1/wholesaler/credit-policy')
      .set('Authorization', `Bearer ${wholesalerToken}`)
      .send({ creditEnabled: true, defaultCreditLimit: 5000, creditPeriodDays: 15 })
      .expect(200);
    await request(app)
      .patch(`/api/v1/wholesaler/retailers/${retailerUser._id}/credit-policy`)
      .set('Authorization', `Bearer ${wholesalerToken}`)
      .send({ status: 'APPROVED', customCreditLimit: 3000, creditPeriodDays: 30 })
      .expect(200);
    await Coupon.create({
      wholesalerId: wholesalerUser._id,
      code: 'CREDIT10',
      title: 'Credit order discount',
      discountType: 'PERCENTAGE',
      discountValue: 10,
      applicableFor: 'RETAILER_ORDER',
    });

    const checkout = await request(app)
      .post('/api/v1/retailer/checkout')
      .set('Authorization', `Bearer ${retailerToken}`)
      .send({
        paymentMethod: 'CREDIT',
        couponCode: 'CREDIT10',
        items: [{ productId: product._id, quantity: 10 }],
        shippingAddress: {
          addressLine1: '10 Main Road',
          city: 'Bengaluru',
          state: 'Karnataka',
          pincode: '560001',
        },
      });

    expect(checkout.status).toBe(201);
    expect(checkout.body.data.order).toMatchObject({
      isCreditOrder: true,
      discount: 200,
      grandTotal: 2124,
      creditPaidAmount: 0,
    });
    const relationship = await WholesalerRetailerRelationship.findOne({
      wholesalerId: wholesalerUser._id,
      retailerId: retailerUser._id,
    });
    expect(relationship.currentOutstandingPaise).toBe(212400);
  });

  test('verified partial UPI payment remains due until the remaining installment is confirmed', async () => {
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
          pincode: '560001',
        },
      });
    const orderId = checkout.body.data.order._id;

    const firstReport = await request(app)
      .post('/api/v1/retailer/payments/reports')
      .set('Authorization', `Bearer ${retailerToken}`)
      .send({ orderId, amount: '1000', transactionReference: 'PARTIAL-DIRECT-10001' });
    const firstVerification = await request(app)
      .patch(`/api/v1/wholesaler/payment-reports/${firstReport.body.data._id}`)
      .set('Authorization', `Bearer ${wholesalerToken}`)
      .send({ action: 'VERIFY', note: 'First installment' });
    expect(firstVerification.status).toBe(200);
    expect((await Order.findById(orderId)).paymentStatus).toBe(PAYMENT_STATUS.PARTIAL);

    const history = await request(app)
      .get('/api/v1/retailer/transactions')
      .set('Authorization', `Bearer ${retailerToken}`);
    expect(history.status).toBe(200);
    expect(history.body.data).toMatchObject({
      summary: { totalPaidAmount: 1000, totalOutstandingAmount: 1360 },
      transactions: [
        expect.objectContaining({
          orderId: checkout.body.data.order.orderNumber,
          wholesalerName: 'Omni Supplies',
          amountPaid: 1000,
          remainingDueAmount: 1360,
          status: 'VERIFIED',
        }),
      ],
    });

    const secondReport = await request(app)
      .post('/api/v1/retailer/payments/reports')
      .set('Authorization', `Bearer ${retailerToken}`)
      .send({ orderId, amount: '1360', transactionReference: 'PARTIAL-DIRECT-10002' });
    await request(app)
      .patch(`/api/v1/wholesaler/payment-reports/${secondReport.body.data._id}`)
      .set('Authorization', `Bearer ${wholesalerToken}`)
      .send({ action: 'VERIFY', note: 'Final installment' })
      .expect(200);
    expect((await Order.findById(orderId)).paymentStatus).toBe(PAYMENT_STATUS.PAID);
  });
});
