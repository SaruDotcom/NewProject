const request = require('supertest');
const path = require('path');
const fs = require('fs');
const app = require('../src/app');
const {
  User,
  WholesalerProfile,
  RetailerProfile,
  WholesalerRetailerRelationship,
  Product,
  Inventory,
  Order,
} = require('../src/models');
const { ORDER_STATUS } = require('../src/config/constants');
const AuthService = require('../src/modules/auth/auth.service');
const { setupTestDB, clearDatabase } = require('./setup');

setupTestDB();

describe('Order Status Flow, Shipping Details & COD Disabled', () => {
  let wholesalerUser;
  let retailerUser;
  let wholesalerToken;
  let retailerToken;
  let product;
  let testFilePath;

  beforeAll(async () => {
    // Create test document for upload
    const uploadsDir = path.join(__dirname, '../uploads/shipping');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    testFilePath = path.join(__dirname, 'test-bilty.pdf');
    fs.writeFileSync(testFilePath, '%PDF-1.4 test bilty document content');
  });

  afterAll(async () => {
    if (fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath);
    }
  });

  beforeEach(async () => {
    await clearDatabase();

    // 1. Setup Wholesaler
    wholesalerUser = await User.create({
      name: 'Apex Wholesaler',
      email: `apex_${Date.now()}@example.com`,
      phone: `987654${Math.floor(1000 + Math.random() * 9000)}`,
      passwordHash: 'dummy-hash',
      role: 'WHOLESALER',
      status: 'ACTIVE',
      isEmailVerified: true,
      isPhoneVerified: true,
      businessName: 'Apex Wholesale Pvt Ltd',
    });

    await WholesalerProfile.create({
      userId: wholesalerUser._id,
      companyName: 'Apex Wholesale Pvt Ltd',
      businessName: 'Apex Wholesale Pvt Ltd',
      gstin: '07AAAAA0000A1Z5',
      kycStatus: 'APPROVED',
      subscriptionStatus: 'ACTIVE',
      paymentSettings: {
        upiId: 'apex@upi',
        upiIdPaymentsEnabled: true,
      },
    });

    wholesalerToken = AuthService.generateTokens(wholesalerUser).accessToken;

    // 2. Setup Retailer
    retailerUser = await User.create({
      name: 'Retailer Sharma',
      email: `sharma_${Date.now()}@example.com`,
      phone: `981111${Math.floor(1000 + Math.random() * 9000)}`,
      passwordHash: 'dummy-hash',
      role: 'RETAILER',
      status: 'ACTIVE',
      isEmailVerified: true,
      isPhoneVerified: true,
      businessName: 'Sharma Kirana Store',
    });

    await RetailerProfile.create({
      userId: retailerUser._id,
      businessName: 'Sharma Kirana Store',
      address: {
        line1: 'Shop 12, Main Bazaar',
        city: 'New Delhi',
        state: 'Delhi',
        pincode: '110001',
      },
    });

    retailerToken = AuthService.generateTokens(retailerUser).accessToken;

    // 3. Connect Wholesaler & Retailer
    await WholesalerRetailerRelationship.create({
      wholesalerId: wholesalerUser._id,
      retailerId: retailerUser._id,
      status: 'ACTIVE',
    });

    // 4. Create Product with image & Inventory
    product = await Product.create({
      wholesalerId: wholesalerUser._id,
      name: 'Organic Basmati Rice 5kg',
      slug: `organic-basmati-rice-5kg-${Date.now()}`,
      sku: 'RICE-BAS-05',
      price: 500,
      wholesalePrice: 450,
      stock: 100,
      images: ['https://cdn.example.com/products/rice-5kg.jpg'],
      status: 'ACTIVE',
      minOrderQuantity: 1,
    });

    await Inventory.create({
      wholesalerId: wholesalerUser._id,
      productId: product._id,
      available: 100,
      reserved: 0,
      sold: 0,
    });
  });

  describe('1. COD Payment Option Disabled', () => {
    it('should reject retailer checkout with COD payment method', async () => {
      const res = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${retailerToken}`)
        .send({
          items: [{ productId: product._id.toString(), quantity: 2 }],
          paymentMethod: 'COD',
          shippingAddress: {
            addressLine1: 'Shop 12, Main Bazaar',
            city: 'New Delhi',
            state: 'Delhi',
            postalCode: '110001',
          },
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('COD_DISABLED');
    });

    it('should allow checkout with Direct UPI', async () => {
      const res = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${retailerToken}`)
        .send({
          items: [{ productId: product._id.toString(), quantity: 2 }],
          paymentMethod: 'UPI',
          shippingAddress: {
            addressLine1: 'Shop 12, Main Bazaar',
            city: 'New Delhi',
            state: 'Delhi',
            postalCode: '110001',
          },
        });

      expect(res.status).toBe(201);
      expect(res.body.data.order).toBeDefined();
      expect(res.body.data.order.orderStatus).toBe(ORDER_STATUS.PENDING);
      expect(res.body.data.order.paymentMethod).toBe('UPI');
    });
  });

  describe('2. Order Status Flow: Confirmed -> Processing -> Shipped -> Delivered', () => {
    let orderId;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${retailerToken}`)
        .send({
          items: [{ productId: product._id.toString(), quantity: 2 }],
          paymentMethod: 'UPI',
          shippingAddress: {
            addressLine1: 'Shop 12, Main Bazaar',
            city: 'New Delhi',
            state: 'Delhi',
            postalCode: '110001',
          },
        });
      orderId = res.body.data.order._id;
    });

    it('should update status to CONFIRMED', async () => {
      const res = await request(app)
        .patch(`/api/v1/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${wholesalerToken}`)
        .send({ status: 'CONFIRMED', note: 'Order confirmed by wholesaler' });

      expect(res.status).toBe(200);
      expect(res.body.data.orderStatus).toBe(ORDER_STATUS.CONFIRMED);

      const dbOrder = await Order.findById(orderId);
      expect(dbOrder.orderStatus).toBe(ORDER_STATUS.CONFIRMED);
    });

    it('should update status to PROCESSING', async () => {
      // Move to CONFIRMED first
      await request(app)
        .patch(`/api/v1/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${wholesalerToken}`)
        .send({ status: 'CONFIRMED' });

      // Move to PROCESSING
      const res = await request(app)
        .patch(`/api/v1/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${wholesalerToken}`)
        .send({ status: 'PROCESSING', note: 'Packing items in warehouse' });

      expect(res.status).toBe(200);
      expect(res.body.data.orderStatus).toBe(ORDER_STATUS.PROCESSING);

      const dbOrder = await Order.findById(orderId);
      expect(dbOrder.orderStatus).toBe(ORDER_STATUS.PROCESSING);
    });

    it('should reject status update to SHIPPED if shipping details are missing', async () => {
      // Without any shipping details
      const resNoDetails = await request(app)
        .patch(`/api/v1/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${wholesalerToken}`)
        .send({ status: 'SHIPPED' });

      expect(resNoDetails.status).toBe(400);
      expect(resNoDetails.body.code).toBe('SHIPPING_COURIER_REQUIRED');

      // With only courier but missing bilty/tracking
      const resNoTracking = await request(app)
        .patch(`/api/v1/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${wholesalerToken}`)
        .send({
          status: 'SHIPPED',
          shippingDetails: { courierName: 'VRL Logistics' },
        });

      expect(resNoTracking.status).toBe(400);
      expect(resNoTracking.body.code).toBe('SHIPPING_TRACKING_REQUIRED');
    });

    it('should update status to SHIPPED when required shipping details are provided', async () => {
      const shippingPayload = {
        courierName: 'VRL Transport Logistics',
        biltyNumber: 'VRL-BLT-884920',
        trackingNumber: 'VRL-TRK-10029',
        shippingDate: '2026-11-02',
        estimatedDeliveryDate: '2026-11-06',
        biltyUrl: 'https://cdn.example.com/bilty/doc-123.pdf',
        biltyFileName: 'VRL_Bilty_884920.pdf',
        shippingNotes: 'Fragile packing, keep upright.',
      };

      const res = await request(app)
        .patch(`/api/v1/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${wholesalerToken}`)
        .send({
          status: 'SHIPPED',
          shippingDetails: shippingPayload,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.orderStatus).toBe(ORDER_STATUS.SHIPPED);

      const dbOrder = await Order.findById(orderId);
      expect(dbOrder.orderStatus).toBe(ORDER_STATUS.SHIPPED);
      expect(dbOrder.shippingDetails).toBeDefined();
      expect(dbOrder.shippingDetails.courierName).toBe('VRL Transport Logistics');
      expect(dbOrder.shippingDetails.biltyNumber).toBe('VRL-BLT-884920');
      expect(dbOrder.shippingDetails.trackingNumber).toBe('VRL-TRK-10029');
      expect(dbOrder.shippingDetails.biltyUrl).toBe('https://cdn.example.com/bilty/doc-123.pdf');
    });

    it('should update status to DELIVERED and maintain saved shipping details', async () => {
      // 1. Mark as Shipped first
      await request(app)
        .patch(`/api/v1/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${wholesalerToken}`)
        .send({
          status: 'SHIPPED',
          shippingDetails: {
            courierName: 'BlueDart Express',
            biltyNumber: 'BLU-LR-1234',
            trackingNumber: '7788990011',
          },
        });

      // 2. Mark as DELIVERED
      const res = await request(app)
        .patch(`/api/v1/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${wholesalerToken}`)
        .send({ status: 'DELIVERED', note: 'Order delivered to retailer shop' });

      expect(res.status).toBe(200);
      expect(res.body.data.orderStatus).toBe(ORDER_STATUS.DELIVERED);

      const dbOrder = await Order.findById(orderId);
      expect(dbOrder.orderStatus).toBe(ORDER_STATUS.DELIVERED);
      expect(dbOrder.shippingDetails.courierName).toBe('BlueDart Express');
      expect(dbOrder.shippingDetails.biltyNumber).toBe('BLU-LR-1234');
    });
  });

  describe('3. Order Details Retrieval & Persistence', () => {
    let orderId;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${retailerToken}`)
        .send({
          items: [{ productId: product._id.toString(), quantity: 5 }],
          paymentMethod: 'UPI',
          shippingAddress: {
            addressLine1: 'Shop 12, Main Bazaar',
            city: 'New Delhi',
            state: 'Delhi',
            postalCode: '110001',
          },
        });
      orderId = res.body.data.order._id;

      await request(app)
        .patch(`/api/v1/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${wholesalerToken}`)
        .send({
          status: 'SHIPPED',
          shippingDetails: {
            courierName: 'Safechem Logistics',
            biltyNumber: 'LR-992211',
            trackingNumber: 'TRK-992211',
            biltyUrl: 'https://cdn.example.com/bilty/doc.png',
            biltyFileName: 'doc.png',
          },
        });
    });

    it('should return shippingDetails and product imageUrl when queried by retailer', async () => {
      const res = await request(app)
        .get(`/api/v1/orders/${orderId}`)
        .set('Authorization', `Bearer ${retailerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.order).toBeDefined();
      expect(res.body.data.order.shippingDetails).toMatchObject({
        courierName: 'Safechem Logistics',
        biltyNumber: 'LR-992211',
        trackingNumber: 'TRK-992211',
        biltyUrl: 'https://cdn.example.com/bilty/doc.png',
      });

      // Product item imageUrl should be present
      expect(res.body.data.order.items[0].imageUrl).toBe('https://cdn.example.com/products/rice-5kg.jpg');
      expect(res.body.data.order.items[0].product.imageUrl).toBe('https://cdn.example.com/products/rice-5kg.jpg');
    });

    it('should include shippingDetails in orders list query', async () => {
      const res = await request(app)
        .get('/api/v1/orders')
        .set('Authorization', `Bearer ${retailerToken}`);

      expect(res.status).toBe(200);
      const targetOrder = res.body.data.items.find((o) => o.id === orderId.toString());
      expect(targetOrder).toBeDefined();
      expect(targetOrder.shippingDetails).toBeDefined();
      expect(targetOrder.shippingDetails.courierName).toBe('Safechem Logistics');
    });
  });

  describe('4. Bilty Document Upload API', () => {
    it('should upload a shipping document / bilty file successfully', async () => {
      const res = await request(app)
        .post('/api/v1/orders/upload-shipping-document')
        .set('Authorization', `Bearer ${wholesalerToken}`)
        .attach('bilty', testFilePath);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.url).toMatch(/\/uploads\/shipping\//);
      expect(res.body.data.fileName).toBe('test-bilty.pdf');
    });
  });
});
