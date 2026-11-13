jest.mock('../src/services/cloudinary.service', () => {
  const actual = jest.requireActual('../src/services/cloudinary.service');
  return {
    ...actual,
    uploadProductImage: jest.fn().mockResolvedValue({
      url: 'https://images.example.test/no-subscription.png',
      publicId: 'no-subscription-image',
    }),
  };
});

const request = require('supertest');
const app = require('../src/app');
const { setupTestDB, clearDatabase } = require('./setup');
const { User, WholesalerProfile, Category, Product } = require('../src/models');
const { ROLES, USER_STATUS, KYC_STATUS } = require('../src/config/constants');
const AuthService = require('../src/modules/auth/auth.service');
const { uploadProductImage } = require('../src/services/cloudinary.service');

setupTestDB();

describe('Wholesaler business APIs with optional subscriptions', () => {
  let wholesaler;
  let token;
  let category;

  beforeEach(async () => {
    await clearDatabase();

    wholesaler = await User.create({
      name: 'KYC Approved Wholesaler',
      email: 'no-subscription@wholesale.test',
      passwordHash: await User.hashPassword('Wholesaler123'),
      role: ROLES.WHOLESALER,
      status: USER_STATUS.ACTIVE,
    });
    await WholesalerProfile.create({
      userId: wholesaler._id,
      businessName: 'No Subscription Supply',
      kycStatus: KYC_STATUS.APPROVED,
      isVerified: true,
    });
    token = AuthService.generateTokens(wholesaler).accessToken;
    category = await Category.create({ name: 'No Subscription Category', slug: 'no-subscription-category' });
  });

  const api = () => ({
    post: (path) => request(app).post(path).set('Authorization', `Bearer ${token}`),
    put: (path) => request(app).put(path).set('Authorization', `Bearer ${token}`),
    delete: (path) => request(app).delete(path).set('Authorization', `Bearer ${token}`),
  });

  test('allows category create, update, and delete without a subscription', async () => {
    const created = await api()
      .post('/api/v1/wholesaler/categories')
      .send({ name: 'Wholesaler Category' });
    expect(created.status).toBe(201);

    const categoryId = created.body.data._id;
    const updated = await api()
      .put(`/api/v1/wholesaler/categories/${categoryId}`)
      .send({ description: 'Updated without a subscription' });
    expect(updated.status).toBe(200);

    const deleted = await api().delete(`/api/v1/wholesaler/categories/${categoryId}`);
    expect(deleted.status).toBe(200);
  });

  test('allows product create, update, delete, and image upload without a subscription', async () => {
    const uploaded = await api()
      .post('/api/v1/wholesaler/products/upload')
      .attach('images', Buffer.from('mock-image'), {
        filename: 'product.png',
        contentType: 'image/png',
      });
    expect(uploaded.status).toBe(200);
    expect(uploadProductImage).toHaveBeenCalled();

    const created = await api()
      .post('/api/v1/wholesaler/products')
      .send({
        name: 'No Subscription Product',
        sku: 'NO-SUB-001',
        categoryId: String(category._id),
        wholesalePrice: 100,
        costPrice: 80,
        moq: 1,
        stock: 5,
        categoryAttributes: {},
      });
    expect(created.status).toBe(201);
    const productId = created.body.data.product._id;

    const updated = await api()
      .put(`/api/v1/wholesaler/products/${productId}`)
      .send({
        name: 'Updated No Subscription Product',
        title: 'Updated No Subscription Product',
        categoryId: String(category._id),
        sellingPrice: 120,
        wholesalePrice: 120,
        mrp: 150,
        stock: 8,
      });
    expect(updated.status).toBe(200);

    const deleted = await api().delete(`/api/v1/wholesaler/products/${productId}`);
    expect(deleted.status).toBe(200);
    expect((await Product.findById(productId)).isDeleted).toBe(true);
  });

  test('allows retailer referral-link regeneration without a subscription', async () => {
    const response = await api().post('/api/v1/wholesaler/referral/regenerate');
    expect(response.status).toBe(200);
    expect(response.body.data.code).toMatch(/^[A-Z0-9]{4,10}$/);
  });
});
