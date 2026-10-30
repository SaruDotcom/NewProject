const request = require('supertest');
const app = require('../src/app');
const { setupTestDB, clearDatabase } = require('./setup');
const { User, Category, Product, WholesalerProfile } = require('../src/models');
const { ROLES, USER_STATUS, KYC_STATUS } = require('../src/config/constants');
const AuthService = require('../src/modules/auth/auth.service');

setupTestDB();

describe('Dynamic Category Attributes & Ownership RBAC Test Suite', () => {
  let wholesalerToken;
  let wholesalerUser;
  let otherWholesalerToken;
  let otherWholesalerUser;
  let electronicsCategory;
  let clothingCategory;
  let groceryCategory;

  beforeEach(async () => {
    await clearDatabase();

    // 1. Create Wholesaler 1 (Approved KYC)
    const passHash = await User.hashPassword('Password@123');
    wholesalerUser = await User.create({
      name: 'Alpha Wholesaler',
      email: 'alpha@wholesaler.com',
      passwordHash: passHash,
      role: ROLES.WHOLESALER,
      status: USER_STATUS.ACTIVE,
    });
    await WholesalerProfile.create({
      userId: wholesalerUser._id,
      businessName: 'Alpha Wholesale House',
      kycStatus: KYC_STATUS.APPROVED,
    });
    wholesalerToken = AuthService.generateTokens(wholesalerUser).accessToken;

    // 2. Create Wholesaler 2 (Other Wholesaler)
    otherWholesalerUser = await User.create({
      name: 'Beta Wholesaler',
      email: 'beta@wholesaler.com',
      passwordHash: passHash,
      role: ROLES.WHOLESALER,
      status: USER_STATUS.ACTIVE,
    });
    await WholesalerProfile.create({
      userId: otherWholesalerUser._id,
      businessName: 'Beta Wholesale House',
      kycStatus: KYC_STATUS.APPROVED,
    });
    otherWholesalerToken = AuthService.generateTokens(otherWholesalerUser).accessToken;

    // 3. Create Categories
    electronicsCategory = await Category.create({ name: 'Electronics', slug: 'electronics' });
    clothingCategory = await Category.create({ name: 'Clothing & Fashion', slug: 'clothing-fashion' });
    groceryCategory = await Category.create({ name: 'Grocery & FMCG', slug: 'grocery-fmcg' });
  });

  test('1. Submitting an Electronics product without warrantyPeriod fails with 400', async () => {
    const res = await request(app)
      .post('/api/v1/wholesaler/products')
      .set('Authorization', `Bearer ${wholesalerToken}`)
      .send({
        name: 'Wireless Bluetooth Headphones',
        sku: 'ELEC-HEADPHONE-01',
        categoryId: electronicsCategory._id,
        wholesalePrice: 1200,
        costPrice: 800,
        moq: 5,
        stock: 50,
        categoryAttributes: {
          modelNumber: 'BH-500',
          // warrantyPeriod is intentionally omitted
        },
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/warrantyPeriod/i);
  });

  test('2. Submitting a Clothing product without size/color fails with 400', async () => {
    const res = await request(app)
      .post('/api/v1/wholesaler/products')
      .set('Authorization', `Bearer ${wholesalerToken}`)
      .send({
        name: 'Classic Cotton Polo Shirt',
        sku: 'CLOTH-POLO-01',
        categoryId: clothingCategory._id,
        wholesalePrice: 450,
        costPrice: 250,
        moq: 10,
        stock: 100,
        categoryAttributes: {
          fabric: '100% Cotton',
          // size and color are intentionally omitted
        },
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/required for category/i);
  });

  test('3. Submitting a Grocery product without expiryDate or fssaiLicense fails with 400', async () => {
    const res = await request(app)
      .post('/api/v1/wholesaler/products')
      .set('Authorization', `Bearer ${wholesalerToken}`)
      .send({
        name: 'Premium Organic Rice 5kg',
        sku: 'GROC-RICE-01',
        categoryId: groceryCategory._id,
        wholesalePrice: 350,
        costPrice: 280,
        moq: 20,
        stock: 200,
        categoryAttributes: {
          netQuantity: '5 kg',
          vegNonVeg: 'Vegetarian',
          // expiryDate and fssaiLicense intentionally omitted
        },
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/required for category/i);
  });

  test('4. Submitting a valid Electronics product passes validation and saves categoryAttributes', async () => {
    const res = await request(app)
      .post('/api/v1/wholesaler/products')
      .set('Authorization', `Bearer ${wholesalerToken}`)
      .send({
        name: 'Smart Earbuds Pro',
        sku: 'ELEC-EARBUDS-01',
        categoryId: electronicsCategory._id,
        wholesalePrice: 1500,
        costPrice: 900,
        moq: 5,
        stock: 30,
        categoryAttributes: {
          modelNumber: 'EP-100',
          warrantyPeriod: '1 Year Manufacturer Warranty',
        },
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.product.categoryAttributes.warrantyPeriod).toBe('1 Year Manufacturer Warranty');
  });

  test('Wholesaler cannot create categories before KYC approval', async () => {
    await WholesalerProfile.findOneAndUpdate(
      { userId: wholesalerUser._id },
      { kycStatus: KYC_STATUS.DRAFT },
    );

    const res = await request(app)
      .post('/api/v1/wholesaler/categories')
      .set('Authorization', `Bearer ${wholesalerToken}`)
      .send({ name: 'New category' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('KYC_APPROVAL_REQUIRED');
  });

  test('Wholesaler category names are unique within their own categories', async () => {
    await Category.create({ name: 'Clothes', slug: 'clothes' });

    const firstCategory = await request(app)
      .post('/api/v1/wholesaler/categories')
      .set('Authorization', `Bearer ${wholesalerToken}`)
      .send({
        name: 'clothes',
        description: 'clothes',
        imageUrl: 'https://example.test/category.jpg',
        parentId: null,
      });

    expect(firstCategory.status).toBe(201);
    expect(String(firstCategory.body.data.wholesalerId)).toBe(String(wholesalerUser._id));

    const betaCategory = await request(app)
      .post('/api/v1/wholesaler/categories')
      .set('Authorization', `Bearer ${otherWholesalerToken}`)
      .send({ name: 'Shared Apparel' });

    expect(betaCategory.status).toBe(201);

    const alphaCategory = await request(app)
      .post('/api/v1/wholesaler/categories')
      .set('Authorization', `Bearer ${wholesalerToken}`)
      .send({ name: 'Shared Apparel' });

    expect(alphaCategory.status).toBe(201);
    expect(String(alphaCategory.body.data.wholesalerId)).toBe(String(wholesalerUser._id));
    expect(String(betaCategory.body.data.wholesalerId)).toBe(String(otherWholesalerUser._id));

    const ownDuplicate = await request(app)
      .post('/api/v1/wholesaler/categories')
      .set('Authorization', `Bearer ${wholesalerToken}`)
      .send({ name: 'Shared Apparel' });

    expect(ownDuplicate.status).toBe(409);

    const globalDuplicate = await request(app)
      .post('/api/v1/wholesaler/categories')
      .set('Authorization', `Bearer ${wholesalerToken}`)
      .send({ name: 'Electronics' });

    expect(globalDuplicate.status).toBe(201);
    expect(String(globalDuplicate.body.data.wholesalerId)).toBe(String(wholesalerUser._id));

    const ownElectronicsDuplicate = await request(app)
      .post('/api/v1/wholesaler/categories')
      .set('Authorization', `Bearer ${wholesalerToken}`)
      .send({ name: 'Electronics' });

    expect(ownElectronicsDuplicate.status).toBe(409);
  });

  test('Wholesaler category creation persists and immediately returns the saved category', async () => {
    const createResponse = await request(app)
      .post('/api/v1/wholesaler/categories')
      .set('Authorization', 'Bearer ' + wholesalerToken)
      .send({
        name: 'Seasonal Goods',
        description: 'Seasonal inventory',
        icon: 'Package',
      });

    expect(createResponse.status).toBe(201);
    const createdCategory = createResponse.body.data;
    expect(String(createdCategory.wholesalerId)).toBe(String(wholesalerUser._id));
    expect(createdCategory.slug).toBe('seasonal-goods');
    expect((await Category.findById(createdCategory._id)).name).toBe('Seasonal Goods');

    const listResponse = await request(app)
      .get('/api/v1/wholesaler/categories')
      .set('Authorization', 'Bearer ' + wholesalerToken);
    expect(listResponse.status).toBe(200);
    expect(listResponse.body.data.items.map((category) => String(category._id))).toContain(String(createdCategory._id));

    const invalidUpdateResponse = await request(app)
      .put(`/api/v1/wholesaler/categories/${createdCategory._id}`)
      .set('Authorization', 'Bearer ' + wholesalerToken)
      .send({ name: 'x'.repeat(101) });
    expect(invalidUpdateResponse.status).toBe(400);

    const updateResponse = await request(app)
      .put(`/api/v1/wholesaler/categories/${createdCategory._id}`)
      .set('Authorization', 'Bearer ' + wholesalerToken)
      .send({ name: 'Seasonal Essentials', icon: 'Tag' });
    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.data.name).toBe('Seasonal Essentials');
    expect(updateResponse.body.data.icon).toBe('Tag');

    const deleteResponse = await request(app)
      .delete(`/api/v1/wholesaler/categories/${createdCategory._id}`)
      .set('Authorization', 'Bearer ' + wholesalerToken);
    expect(deleteResponse.status).toBe(200);
    expect((await Category.findById(createdCategory._id)).isDeleted).toBe(true);
  });

  test('Wholesalers cannot edit or delete another wholesaler category', async () => {
    const createResponse = await request(app)
      .post('/api/v1/wholesaler/categories')
      .set('Authorization', 'Bearer ' + wholesalerToken)
      .send({ name: 'Owned Category' });
    const categoryId = createResponse.body.data._id;

    const updateResponse = await request(app)
      .put(`/api/v1/wholesaler/categories/${categoryId}`)
      .set('Authorization', 'Bearer ' + otherWholesalerToken)
      .send({ name: 'Hijacked Category' });
    const deleteResponse = await request(app)
      .delete(`/api/v1/wholesaler/categories/${categoryId}`)
      .set('Authorization', 'Bearer ' + otherWholesalerToken);

    expect(updateResponse.status).toBe(403);
    expect(deleteResponse.status).toBe(403);
    expect((await Category.findById(categoryId)).name).toBe('Owned Category');
  });

  test('Category creation validates the name before saving', async () => {
    const response = await request(app)
      .post('/api/v1/wholesaler/categories')
      .set('Authorization', 'Bearer ' + wholesalerToken)
      .send({ name: 'x'.repeat(101) });

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/category name/i);
    expect(await Category.countDocuments({ wholesalerId: wholesalerUser._id })).toBe(0);
  });

  test('5. Wholesaler cannot edit another wholesaler product (returns 403 Forbidden)', async () => {
    // Wholesaler 1 creates a product
    const createRes = await request(app)
      .post('/api/v1/wholesaler/products')
      .set('Authorization', `Bearer ${wholesalerToken}`)
      .send({
        name: 'Alpha Exclusive Item',
        sku: 'ALPHA-ITEM-01',
        categoryId: electronicsCategory._id,
        wholesalePrice: 800,
        costPrice: 500,
        moq: 2,
        stock: 20,
        categoryAttributes: {
          modelNumber: 'ALPHA-01',
          warrantyPeriod: '6 Months Manufacturer Warranty',
        },
      });

    expect(createRes.status).toBe(201);
    const productId = createRes.body.data.product._id;

    // Wholesaler 2 attempts to modify Wholesaler 1's product
    const updateRes = await request(app)
      .put(`/api/v1/wholesaler/products/${productId}`)
      .set('Authorization', `Bearer ${otherWholesalerToken}`)
      .send({
        name: 'Hacked Item Title',
        wholesalePrice: 10,
      });

    expect(updateRes.status).toBe(403);
    expect(updateRes.body.message).toMatch(/only update your own products/i);
  });

  test('6. Wholesaler can create a three-level category hierarchy but not exceed it', async () => {
    const childRes = await request(app)
      .post('/api/v1/wholesaler/categories')
      .set('Authorization', `Bearer ${wholesalerToken}`)
      .send({ name: 'Men', parentId: clothingCategory._id });

    expect(childRes.status).toBe(201);
    expect(String(childRes.body.data.parentId)).toBe(String(clothingCategory._id));

    const nestedRes = await request(app)
      .post('/api/v1/wholesaler/categories')
      .set('Authorization', `Bearer ${wholesalerToken}`)
      .send({ name: 'Shirts', parentId: childRes.body.data._id });

    expect(nestedRes.status).toBe(201);
    expect(nestedRes.body.data.level).toBe(3);

    const deepestRes = await request(app)
      .post('/api/v1/wholesaler/categories')
      .set('Authorization', 'Bearer ' + wholesalerToken)
      .send({ name: 'Formal Shirts', parentId: nestedRes.body.data._id });
    expect(deepestRes.status).toBe(400);
    expect(deepestRes.body.message).toMatch(/maximum 3 levels supported/i);
  });

  test('7. Wholesaler cannot use another wholesaler category as a parent', async () => {
    const foreignCategory = await Category.create({
      name: 'Beta Category',
      slug: 'beta-category',
      wholesalerId: otherWholesalerUser._id,
    });

    const response = await request(app)
      .post('/api/v1/wholesaler/categories')
      .set('Authorization', `Bearer ${wholesalerToken}`)
      .send({ name: 'Unauthorized Child', parentId: foreignCategory._id });

    expect(response.status).toBe(403);
    expect(response.body.message).toMatch(/your own or global categories/i);
  });

  test('8. Product subcategory must belong to the selected main category', async () => {
    const mensCategory = await Category.create({
      name: 'Men',
      slug: 'men',
      parentId: clothingCategory._id,
      wholesalerId: wholesalerUser._id,
    });

    const validResponse = await request(app)
      .post('/api/v1/wholesaler/products')
      .set('Authorization', `Bearer ${wholesalerToken}`)
      .send({
        name: 'Men\'s Shirt',
        sku: 'MEN-SHIRT-01',
        categoryId: clothingCategory._id,
        subcategoryId: mensCategory._id,
        wholesalePrice: 450,
        costPrice: 250,
        moq: 10,
        stock: 100,
        categoryAttributes: { fabric: 'Cotton', size: ['M'], color: ['Blue'] },
      });

    expect(validResponse.status).toBe(201);
    expect(String(validResponse.body.data.product.subcategoryId)).toBe(String(mensCategory._id));

    const invalidResponse = await request(app)
      .post('/api/v1/wholesaler/products')
      .set('Authorization', `Bearer ${wholesalerToken}`)
      .send({
        name: 'Wrongly Categorized Shirt',
        sku: 'WRONG-SUBCATEGORY-01',
        categoryId: electronicsCategory._id,
        subcategoryId: mensCategory._id,
        wholesalePrice: 450,
        costPrice: 250,
        moq: 10,
        stock: 100,
        categoryAttributes: { modelNumber: 'WRONG-CAT-01', warrantyPeriod: '1 Year' },
      });

    expect(invalidResponse.status).toBe(400);
    expect(invalidResponse.body.message).toMatch(/must belong to the selected main category/i);
  });
});
