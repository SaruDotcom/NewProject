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
  InventoryTransaction,
  Order,
  Return,
  Cart,
  Address,
  Wallet,
} = require('../src/models');
const { ROLES, USER_STATUS, KYC_STATUS, RELATIONSHIP_STATUS } = require('../src/config/constants');

setupTestDB();

describe('Retailer Portal Complete Layered Test Suite', () => {
  let wholesalerUser;
  let retailerUser;
  let retailerUser2;
  let wholesalerToken;
  let retailerToken;
  let retailerToken2;
  let category;
  let product;
  let inventory;

  beforeEach(async () => {
    await clearDatabase();

    // 1. Category
    category = await Category.create({ name: 'Hardware & Tools', slug: 'hardware-tools' });

    // 2. Wholesaler User & Profile
    const wsHash = await User.hashPassword('Wholesaler123');
    wholesalerUser = await User.create({
      name: 'Alpha Wholesale Corp',
      email: 'alpha@wholesaler.com',
      passwordHash: wsHash,
      role: ROLES.WHOLESALER,
      status: USER_STATUS.ACTIVE,
    });
    const wsWallet = await Wallet.create({ ownerId: wholesalerUser._id, ownerType: 'WHOLESALER', availableBalance: 0 });
    await WholesalerProfile.create({
      userId: wholesalerUser._id,
      businessName: 'Alpha Wholesale Corp',
      kycStatus: KYC_STATUS.APPROVED,
      isVerified: true,
      walletId: wsWallet._id,
      commissionRate: 5.0,
      minOrderValue: 100,
    });

    // 3. Retailer User & Profile
    const retHash = await User.hashPassword('Retailer123');
    retailerUser = await User.create({
      name: 'City Hardware Mart',
      email: 'city@retailer.com',
      passwordHash: retHash,
      role: ROLES.RETAILER,
      status: USER_STATUS.ACTIVE,
    });
    const retProfile = await RetailerProfile.create({
      userId: retailerUser._id,
      businessName: 'City Hardware Mart',
      kycStatus: KYC_STATUS.APPROVED,
      isVerified: true,
      address: {
        addressLine1: '45 Market Street',
        city: 'Mumbai',
        state: 'Maharashtra',
        postalCode: '400001',
      },
    });
    retailerUser.retailerProfile = retProfile._id;
    await retailerUser.save();

    // 4. Retailer 2 without active connection
    retailerUser2 = await User.create({
      name: 'Unconnected Store',
      email: 'unconnected@retailer.com',
      passwordHash: retHash,
      role: ROLES.RETAILER,
      status: USER_STATUS.ACTIVE,
    });
    await RetailerProfile.create({
      userId: retailerUser2._id,
      businessName: 'Unconnected Store',
      kycStatus: KYC_STATUS.APPROVED,
      isVerified: true,
    });

    // 5. Active Wholesaler-Retailer Relationship
    await WholesalerRetailerRelationship.create({
      wholesalerId: wholesalerUser._id,
      retailerId: retailerUser._id,
      status: RELATIONSHIP_STATUS.ACTIVE,
      joinedAt: new Date(),
    });

    // 6. Product & Inventory (MOQ: 5, Price: 100, Stock: 50)
    product = await Product.create({
      wholesalerId: wholesalerUser._id,
      categoryId: category._id,
      name: 'Industrial Power Drill',
      slug: 'industrial-power-drill',
      sku: 'DRILL-001',
      wholesalePrice: 100,
      minOrderQuantity: 5,
      moq: 5,
      status: 'ACTIVE',
      isDeleted: false,
    });
    inventory = await Inventory.create({
      productId: product._id,
      wholesalerId: wholesalerUser._id,
      available: 50,
      reserved: 0,
      reorderLevel: 10,
    });

    // Logins
    const retLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'city@retailer.com',
      password: 'Retailer123',
    });
    retailerToken = retLogin.body.data.token;

    const ret2Login = await request(app).post('/api/v1/auth/login').send({
      email: 'unconnected@retailer.com',
      password: 'Retailer123',
    });
    retailerToken2 = ret2Login.body.data.token;
  });

  describe('1. Dashboard & Profile Endpoints', () => {
    it('should return complete retailer dashboard metrics and connected wholesaler info', async () => {
      const res = await request(app)
        .get('/api/v1/retailer/dashboard')
        .set('Authorization', `Bearer ${retailerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.connectedWholesaler).toBeDefined();
      expect(res.body.data.connectedWholesaler.businessName).toBe('Alpha Wholesale Corp');
      expect(res.body.data.stats).toBeDefined();
      expect(res.body.data.stats.totalOrders).toBe(0);
    });

    it('should fetch and update retailer user profile', async () => {
      const getRes = await request(app)
        .get('/api/v1/retailer/profile')
        .set('Authorization', `Bearer ${retailerToken}`);

      expect(getRes.status).toBe(200);
      expect(getRes.body.data.email).toBe('city@retailer.com');

      const updateRes = await request(app)
        .patch('/api/v1/retailer/profile')
        .set('Authorization', `Bearer ${retailerToken}`)
        .send({
          name: 'City Hardware Mart Updated',
          phone: '+919876543210',
          businessName: 'City Super Hardware',
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.name).toBe('City Hardware Mart Updated');
    });

    it('should fetch and update business profile', async () => {
      const getRes = await request(app)
        .get('/api/v1/retailer/profile/business')
        .set('Authorization', `Bearer ${retailerToken}`);

      expect(getRes.status).toBe(200);
      expect(getRes.body.data.businessName).toBe('City Hardware Mart');

      const updateRes = await request(app)
        .patch('/api/v1/retailer/profile/business')
        .set('Authorization', `Bearer ${retailerToken}`)
        .send({
          businessName: 'City Hardware Corp Ltd',
          gstin: '27AAAAA0000A1Z5',
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.businessName).toBe('City Hardware Corp Ltd');
      expect(updateRes.body.data.gstin).toBe('27AAAAA0000A1Z5');
    });
  });

  describe('2. Storefront, Catalog & Products', () => {
    it('should get connected wholesaler storefront and catalog', async () => {
      const storeRes = await request(app)
        .get('/api/v1/retailer/store')
        .set('Authorization', `Bearer ${retailerToken}`);

      expect(storeRes.status).toBe(200);
      expect(storeRes.body.data.wholesaler.businessName).toBe('Alpha Wholesale Corp');
      expect(storeRes.body.data.productsCount).toBe(1);

      const catRes = await request(app)
        .get('/api/v1/retailer/categories')
        .set('Authorization', `Bearer ${retailerToken}`);

      expect(catRes.status).toBe(200);
      expect(catRes.body.data.length).toBe(1);
      expect(catRes.body.data[0].name).toBe('Hardware & Tools');

      const prodRes = await request(app)
        .get('/api/v1/retailer/products')
        .set('Authorization', `Bearer ${retailerToken}`);

      expect(prodRes.status).toBe(200);
      expect(prodRes.body.data.length).toBe(1);
      expect(prodRes.body.data[0].sku).toBe('DRILL-001');
    });

    it('should forbid store access for retailer with no active wholesaler relationship', async () => {
      const res = await request(app)
        .get('/api/v1/retailer/store')
        .set('Authorization', `Bearer ${retailerToken2}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('NO_ACTIVE_WHOLESALER');
    });
  });

  describe('3. Cart & MOQ Enforcement', () => {
    it('should reject adding to cart if quantity is below product MOQ', async () => {
      const res = await request(app)
        .post('/api/v1/retailer/cart')
        .set('Authorization', `Bearer ${retailerToken}`)
        .send({
          productId: product._id.toString(),
          quantity: 2, // MOQ is 5
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('MOQ_NOT_MET');
    });

    it('should add items to cart successfully when quantity meets MOQ', async () => {
      const res = await request(app)
        .post('/api/v1/retailer/cart')
        .set('Authorization', `Bearer ${retailerToken}`)
        .send({
          productId: product._id.toString(),
          quantity: 10,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.items.length).toBe(1);
      expect(res.body.data.items[0].quantity).toBe(10);
      expect(res.body.data.subtotal).toBe(1000); // 100 * 10
    });

    it('should update cart item quantity and clear cart', async () => {
      // Add first
      const addRes = await request(app)
        .post('/api/v1/retailer/cart')
        .set('Authorization', `Bearer ${retailerToken}`)
        .send({
          productId: product._id.toString(),
          quantity: 5,
        });

      const itemId = addRes.body.data.items[0]._id;

      // Update quantity to 15
      const updateRes = await request(app)
        .patch(`/api/v1/retailer/cart/items/${itemId}`)
        .set('Authorization', `Bearer ${retailerToken}`)
        .send({ quantity: 15 });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.items[0].quantity).toBe(15);
      expect(updateRes.body.data.subtotal).toBe(1500);

      // Clear cart
      const clearRes = await request(app)
        .delete('/api/v1/retailer/cart')
        .set('Authorization', `Bearer ${retailerToken}`);

      expect(clearRes.status).toBe(200);
      expect(clearRes.body.data.items.length).toBe(0);
    });
  });

  describe('4. Checkout, Inventory Stock & Cancellation', () => {
    it('should complete checkout from cart, deduct inventory, and create order', async () => {
      // 1. Add to cart
      await request(app)
        .post('/api/v1/retailer/cart')
        .set('Authorization', `Bearer ${retailerToken}`)
        .send({
          productId: product._id.toString(),
          quantity: 10,
        });

      // 2. Checkout
      const checkoutRes = await request(app)
        .post('/api/v1/retailer/checkout')
        .set('Authorization', `Bearer ${retailerToken}`)
        .send({
          shippingAddress: {
            addressLine1: '12 Main Rd',
            city: 'Pune',
            state: 'Maharashtra',
            postalCode: '411001',
          },
          paymentMethod: 'COD',
        });

      expect(checkoutRes.status).toBe(201);
      expect(checkoutRes.body.data.order).toBeDefined();
      expect(checkoutRes.body.data.order.orderStatus).toBe('PENDING');

      // Check inventory deduction
      const updatedInv = await Inventory.findOne({ productId: product._id });
      expect(updatedInv.available).toBe(40); // 50 - 10

      // Check cart cleared
      const cartRes = await request(app)
        .get('/api/v1/retailer/cart')
        .set('Authorization', `Bearer ${retailerToken}`);
      expect(cartRes.body.data.items.length).toBe(0);
    });

    it('should cancel pending order and restore inventory stock', async () => {
      // 1. Add to cart & checkout
      await request(app)
        .post('/api/v1/retailer/cart')
        .set('Authorization', `Bearer ${retailerToken}`)
        .send({
          productId: product._id.toString(),
          quantity: 8,
        });

      const checkoutRes = await request(app)
        .post('/api/v1/retailer/checkout')
        .set('Authorization', `Bearer ${retailerToken}`)
        .send({
          shippingAddress: {
            addressLine1: '12 Main Rd',
            city: 'Pune',
            state: 'Maharashtra',
            postalCode: '411001',
          },
          paymentMethod: 'COD',
        });

      const orderId = checkoutRes.body.data.order._id;

      // Cancel order
      const cancelRes = await request(app)
        .post(`/api/v1/retailer/orders/${orderId}/cancel`)
        .set('Authorization', `Bearer ${retailerToken}`)
        .send({ reason: 'Found better price', note: 'The price changed after checkout.' });

      expect(cancelRes.status).toBe(200);
      expect(cancelRes.body.data.orderStatus).toBe('CANCELLED');
      expect(cancelRes.body.data.cancellationReason).toBe('Found better price');
      expect(cancelRes.body.data.cancellationNote).toBe('The price changed after checkout.');

      // Check stock restored
      const updatedInv = await Inventory.findOne({ productId: product._id });
      expect(updatedInv.available).toBe(50);
      expect(updatedInv.reserved).toBe(0);
      expect(await InventoryTransaction.findOne({ referenceType: 'CANCELLATION', referenceId: cancelRes.body.data.orderNumber })).not.toBeNull();
    });

    it('should reject cancellation after an order has shipped', async () => {
      const checkoutRes = await request(app)
        .post('/api/v1/retailer/checkout')
        .set('Authorization', `Bearer ${retailerToken}`)
        .send({
          shippingAddress: { addressLine1: '12 Main Rd', city: 'Pune', state: 'Maharashtra', postalCode: '411001' },
          paymentMethod: 'COD',
          items: [{ productId: product._id, quantity: 8 }],
        });
      const orderId = checkoutRes.body.data.order._id;
      await Order.findByIdAndUpdate(orderId, { orderStatus: 'SHIPPED' });

      const cancelRes = await request(app)
        .post(`/api/v1/retailer/orders/${orderId}/cancel`)
        .set('Authorization', `Bearer ${retailerToken}`)
        .send({ reason: 'Ordered by mistake' });

      expect(cancelRes.status).toBe(400);
      expect(cancelRes.body.message).toMatch(/Only PENDING or CONFIRMED orders can be cancelled/i);
    });

    it('should only accept returns for delivered orders and store the selected reason and note', async () => {
      const checkoutRes = await request(app)
        .post('/api/v1/retailer/checkout')
        .set('Authorization', `Bearer ${retailerToken}`)
        .send({
          shippingAddress: { addressLine1: '12 Main Rd', city: 'Pune', state: 'Maharashtra', postalCode: '411001' },
          paymentMethod: 'COD',
          items: [{ productId: product._id, quantity: 8 }],
        });
      const orderId = checkoutRes.body.data.order._id;
      const returnPayload = {
        orderId,
        items: [{ productId: product._id, quantity: 2 }],
        reason: 'Damaged product',
        note: 'Two units arrived damaged.',
      };

      const earlyReturnRes = await request(app)
        .post('/api/v1/retailer/returns')
        .set('Authorization', `Bearer ${retailerToken}`)
        .send(returnPayload);
      expect(earlyReturnRes.status).toBe(400);
      expect(earlyReturnRes.body.message).toMatch(/only be requested for delivered orders/i);

      await Order.findByIdAndUpdate(orderId, { orderStatus: 'DELIVERED' });
      const returnRes = await request(app)
        .post('/api/v1/retailer/returns')
        .set('Authorization', `Bearer ${retailerToken}`)
        .send(returnPayload);

      expect(returnRes.status).toBe(201);
      expect(returnRes.body.data.reason).toBe('Damaged product');
      expect(returnRes.body.data.retailerNote).toBe('Two units arrived damaged.');
      expect(returnRes.body.data.status).toBe('REQUESTED');
      expect(await Return.findById(returnRes.body.data._id)).not.toBeNull();
    });
  });

  describe('5. Address Book CRUD & Defaults', () => {
    it('should manage delivery addresses and default flags', async () => {
      // Create Address 1
      const add1 = await request(app)
        .post('/api/v1/retailer/addresses')
        .set('Authorization', `Bearer ${retailerToken}`)
        .send({
          fullName: 'Warehouse 1',
          phone: '+919876543210',
          addressLine1: 'Plot 10, Industrial Estate',
          city: 'Thane',
          state: 'Maharashtra',
          postalCode: '400601',
          isDefault: true,
        });

      expect(add1.status).toBe(201);
      expect(add1.body.data.isDefault).toBe(true);
      const address1Id = add1.body.data._id;

      // Create Address 2 as default (should unset address 1)
      const add2 = await request(app)
        .post('/api/v1/retailer/addresses')
        .set('Authorization', `Bearer ${retailerToken}`)
        .send({
          fullName: 'Shop 2',
          phone: '+919876543211',
          addressLine1: 'Shop 4, Market Complex',
          city: 'Mumbai',
          state: 'Maharashtra',
          postalCode: '400002',
          isDefault: true,
        });

      expect(add2.status).toBe(201);
      const address2Id = add2.body.data._id;

      // Verify list
      const listRes = await request(app)
        .get('/api/v1/retailer/addresses')
        .set('Authorization', `Bearer ${retailerToken}`);

      expect(listRes.status).toBe(200);
      expect(listRes.body.data.length).toBe(2);

      // Delete Address 1
      const delRes = await request(app)
        .delete(`/api/v1/retailer/addresses/${address1Id}`)
        .set('Authorization', `Bearer ${retailerToken}`);

      expect(delRes.status).toBe(200);
    });
  });

  describe('6. Wishlist & Support Tickets', () => {
    it('should add to wishlist, list items, and remove', async () => {
      // Add
      const addRes = await request(app)
        .post(`/api/v1/retailer/wishlist/${product._id}`)
        .set('Authorization', `Bearer ${retailerToken}`);

      expect(addRes.status).toBe(200);
      expect(addRes.body.data.length).toBe(1);

      // List
      const listRes = await request(app)
        .get('/api/v1/retailer/wishlist')
        .set('Authorization', `Bearer ${retailerToken}`);

      expect(listRes.status).toBe(200);
      expect(listRes.body.data.length).toBe(1);

      // Remove
      const delRes = await request(app)
        .delete(`/api/v1/retailer/wishlist/${product._id}`)
        .set('Authorization', `Bearer ${retailerToken}`);

      expect(delRes.status).toBe(200);
      expect(delRes.body.data.length).toBe(0);
    });

    it('should create support ticket and add messages', async () => {
      const createRes = await request(app)
        .post('/api/v1/retailer/support')
        .set('Authorization', `Bearer ${retailerToken}`)
        .send({
          subject: 'Delivery Inquiry',
          category: 'DELIVERY',
          priority: 'HIGH',
          message: 'When will the next batch arrive?',
        });

      expect(createRes.status).toBe(201);
      expect(createRes.body.data.ticketNumber).toBeDefined();
      const ticketId = createRes.body.data._id;

      // Add message
      const msgRes = await request(app)
        .post(`/api/v1/retailer/support/${ticketId}/messages`)
        .set('Authorization', `Bearer ${retailerToken}`)
        .send({
          message: 'Following up on this inquiry.',
        });

      expect(msgRes.status).toBe(200);
      expect(msgRes.body.data.messages.length).toBe(2);
    });
  });

  describe('7. Financials & Wallet', () => {
    it('should retrieve wallet and analytics data for retailer', async () => {
      const walletRes = await request(app)
        .get('/api/v1/retailer/wallet')
        .set('Authorization', `Bearer ${retailerToken}`);

      expect(walletRes.status).toBe(200);
      expect(walletRes.body.data.availableBalance).toBeDefined();

      const analyticsRes = await request(app)
        .get('/api/v1/retailer/analytics')
        .set('Authorization', `Bearer ${retailerToken}`);

      expect(analyticsRes.status).toBe(200);
      expect(analyticsRes.body.data.monthlySpend).toBeDefined();
    });
  });
});
