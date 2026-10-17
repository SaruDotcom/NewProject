const request = require('supertest');
const app = require('../src/app');
const { setupTestDB, clearDatabase } = require('./setup');
const { User, WholesalerProfile, Category, Product, Inventory } = require('../src/models');
const { ROLES, USER_STATUS, KYC_STATUS } = require('../src/config/constants');
const ProductService = require('../src/modules/products/products.service');

setupTestDB();

describe('Products & Inventory Test Suite', () => {
  let wholesalerUser;
  let wholesalerToken;
  let category;

  beforeEach(async () => {
    await clearDatabase();

    category = await Category.create({
      name: 'Electronics',
      slug: 'electronics',
    });

    const wsHash = await User.hashPassword('Wholesaler123');
    wholesalerUser = await User.create({
      name: 'Tech Wholesaler',
      email: 'tech@wholesale.com',
      passwordHash: wsHash,
      role: ROLES.WHOLESALER,
      status: USER_STATUS.ACTIVE,
    });
    await WholesalerProfile.create({
      userId: wholesalerUser._id,
      businessName: 'Tech World Supplies',
      kycStatus: KYC_STATUS.APPROVED,
      isVerified: true,
    });

    const loginRes = await request(app).post('/api/v1/auth/login').send({
      email: 'tech@wholesale.com',
      password: 'Wholesaler123',
    });
    wholesalerToken = loginRes.body.data.token;
  });

  test('1. Wholesaler creates product with inventory and tier pricing', async () => {
    const productPayload = {
      name: 'USB-C Fast Cable 100W',
      sku: 'USBC-100W-01',
      wholesalePrice: 150,
      retailerPrice: 180,
      mrp: 399,
      stock: 500,
      moq: 10,
      categoryId: category._id,
      categoryAttributes: {
        modelNumber: 'USBC-100W',
        warrantyPeriod: '1 Year Manufacturer Warranty',
      },
      pricingTiers: [
        { minQty: 10, maxQty: 49, pricePerUnit: 150 },
        { minQty: 50, pricePerUnit: 125 },
      ],
    };

    const res = await request(app)
      .post('/api/v1/wholesaler/products')
      .set('Authorization', `Bearer ${wholesalerToken}`)
      .send(productPayload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.product.name).toBe('USB-C Fast Cable 100W');
    expect(res.body.data.product.sku).toBe('USBC-100W-01');
    expect(res.body.data.inventory.available).toBe(500);

    // Verify inventory doc created in database
    const inv = await Inventory.findOne({ productId: res.body.data.product._id });
    expect(inv.available).toBe(500);
  });

  test('2. Duplicate SKU rejected for same wholesaler', async () => {
    const payload = {
      name: 'Item One',
      sku: 'UNIQUE-SKU-99',
      wholesalePrice: 100,
      stock: 10,
      categoryId: category._id,
      categoryAttributes: {
        modelNumber: 'UNIQUE-1',
        warrantyPeriod: '6 Months Manufacturer Warranty',
      },
    };

    await request(app)
      .post('/api/v1/wholesaler/products')
      .set('Authorization', `Bearer ${wholesalerToken}`)
      .send(payload);

    // Attempt second creation with same SKU
    const res = await request(app)
      .post('/api/v1/wholesaler/products')
      .set('Authorization', `Bearer ${wholesalerToken}`)
      .send({
        name: 'Item Two',
        sku: 'UNIQUE-SKU-99',
        wholesalePrice: 120,
        stock: 5,
        categoryId: category._id,
        categoryAttributes: {
          modelNumber: 'UNIQUE-2',
          warrantyPeriod: '6 Months Manufacturer Warranty',
        },
      });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('DUPLICATE_SKU');
  });

  test('3. Unapproved wholesaler cannot create products', async () => {
    await WholesalerProfile.findOneAndUpdate(
      { userId: wholesalerUser._id },
      { kycStatus: KYC_STATUS.DRAFT }
    );

    const res = await request(app)
      .post('/api/v1/wholesaler/products')
      .set('Authorization', `Bearer ${wholesalerToken}`)
      .send({
        name: 'Item Test',
        sku: 'TEST-SKU',
        wholesalePrice: 50,
        categoryId: category._id,
        categoryAttributes: {
          modelNumber: 'TEST-ITEM',
          warrantyPeriod: 'No Warranty',
        },
      });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('KYC_APPROVAL_REQUIRED');
  });

  test('4. Admin product list includes wholesaler business name', async () => {
    await Product.create({
      wholesalerId: wholesalerUser._id,
      name: 'Admin Listing Product',
      title: 'Admin Listing Product',
      slug: 'admin-listing-product',
      sku: 'ADMIN-LISTING-PRODUCT',
      categoryId: category._id,
      categoryName: category.name,
      wholesalePrice: 200,
      stock: 12,
      status: 'ACTIVE',
      isDeleted: false,
    });

    const { products } = await ProductService.listAdminProducts({ page: 1, limit: 20 });

    expect(products).toHaveLength(1);
    expect(products[0].wholesaler).toBeDefined();
    expect(products[0].wholesaler.businessName).toBe('Tech World Supplies');
  });
});
