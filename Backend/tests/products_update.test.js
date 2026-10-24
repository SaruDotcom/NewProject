const request = require('supertest');
const app = require('../src/app');
const { setupTestDB, clearDatabase } = require('./setup');
const {
  User,
  WholesalerProfile,
  WholesalerRetailerRelationship,
  Category,
  Product,
  Inventory,
} = require('../src/models');
const { ROLES, USER_STATUS, KYC_STATUS, RELATIONSHIP_STATUS } = require('../src/config/constants');

setupTestDB();

describe('Product update validation and persistence', () => {
  let wholesaler;
  let token;
  let category;
  let product;

  beforeEach(async () => {
    await clearDatabase();

    category = await Category.create({
      name: 'Clothing',
      slug: 'clothing',
    });

    wholesaler = await User.create({
      name: 'Clothing Wholesaler',
      email: 'clothing@wholesale.test',
      passwordHash: await User.hashPassword('Wholesaler123'),
      role: ROLES.WHOLESALER,
      status: USER_STATUS.ACTIVE,
    });
    await WholesalerProfile.create({
      userId: wholesaler._id,
      businessName: 'Clothing Supply',
      kycStatus: KYC_STATUS.APPROVED,
      isVerified: true,
    });

    const login = await request(app).post('/api/v1/auth/login').send({
      email: 'clothing@wholesale.test',
      password: 'Wholesaler123',
    });
    token = login.body.data.token;

    // Deliberately omit category attributes, sizes, and newer product metadata.
    product = await Product.create({
      wholesalerId: wholesaler._id,
      name: 'Chaniya choli',
      title: 'Chaniya choli',
      slug: 'chaniya-choli',
      sku: 'CHANIYA-01',
      categoryId: category._id,
      categoryName: category.name,
      costPrice: 80,
      wholesalePrice: 100,
      sellingPrice: 100,
      retailerPrice: 100,
      basePrice: 100,
      mrp: 150,
      stock: 10,
      stockQuantity: 10,
      categoryAttributes: {},
      sizes: [],
      colors: [],
      status: 'ACTIVE',
    });
    await Inventory.create({
      productId: product._id,
      wholesalerId: wholesaler._id,
      available: 10,
    });
  });

  test('partial edit of a legacy product persists name, price, and stock without category attributes', async () => {
    const response = await request(app)
      .put(`/api/v1/wholesaler/products/${product._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Chaniya choli updated',
        title: 'Chaniya choli updated',
        categoryId: String(category._id),
        sellingPrice: 120,
        wholesalePrice: 120,
        mrp: 150,
        stock: 14,
        legacyDescriptionField: 'ignored by the product schema',
      });

    expect(response.status).toBe(200);
    expect(response.body.data.name).toBe('Chaniya choli updated');
    expect(response.body.data.sellingPrice).toBe(120);
    expect(response.body.data.stock).toBe(14);

    const reloaded = await Product.findById(product._id).lean();
    expect(reloaded.name).toBe('Chaniya choli updated');
    expect(reloaded.wholesalePrice).toBe(120);
    expect(reloaded.stock).toBe(14);
    expect((await Inventory.findOne({ productId: product._id })).available).toBe(14);
  });

  test('product edits and retailer catalog preserve every product and color image', async () => {
    const retailer = await User.create({
      name: 'Catalog Retailer',
      email: 'catalog-retailer@test.com',
      passwordHash: await User.hashPassword('Retailer123'),
      role: ROLES.RETAILER,
      status: USER_STATUS.ACTIVE,
    });
    await WholesalerRetailerRelationship.create({
      wholesalerId: wholesaler._id,
      retailerId: retailer._id,
      status: RELATIONSHIP_STATUS.ACTIVE,
    });
    const retailerLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'catalog-retailer@test.com',
      password: 'Retailer123',
    });
    const retailerToken = retailerLogin.body.data.token;
    const productUrl = `/api/v1/wholesaler/products/${product._id}`;
    const singleImage = 'https://images.example.com/legacy-product.jpg';

    const legacyImageUpdate = await request(app)
      .put(productUrl)
      .set('Authorization', ['Bearer', token].join(' '))
      .send({ imageUrl: singleImage, images: [singleImage] });
    expect(legacyImageUpdate.status).toBe(200);
    expect(legacyImageUpdate.body.data.images).toEqual([singleImage]);
    const legacyRetailerCatalog = await request(app)
      .get('/api/v1/retailer/products')
      .set('Authorization', ['Bearer', retailerToken].join(' '));
    expect(legacyRetailerCatalog.body.data[0].images).toEqual([singleImage]);

    const images = [
      'https://images.example.com/product-1.jpg',
      'https://images.example.com/product-2.jpg',
      'https://images.example.com/product-3.jpg',
      'https://images.example.com/product-4.jpg',
      'https://images.example.com/product-5.jpg',
    ];
    const colorVariants = [
      { color: 'Black', sku: 'CHANIYA-BLK', images: [images[0], images[1]] },
      { color: 'Blue', sku: 'CHANIYA-BLU', images: [images[2]] },
    ];
    const updateResponse = await request(app)
      .put(productUrl)
      .set('Authorization', ['Bearer', token].join(' '))
      .send({ imageUrl: images[0], images, colors: ['Black', 'Blue'], colorVariants });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.data.images).toEqual(images);
    expect(updateResponse.body.data.colorVariants.map((variant) => variant.images)).toEqual([
      [images[0], images[1]],
      [images[2]],
    ]);

    const createResponse = await request(app)
      .post('/api/v1/wholesaler/products')
      .set('Authorization', ['Bearer', token].join(' '))
      .send({
        name: 'New multi-image chaniya choli',
        sku: 'CHANIYA-02',
        categoryId: String(category._id),
        wholesalePrice: 100,
        sellingPrice: 100,
        mrp: 150,
        stock: 10,
        imageUrl: images[0],
        images,
        sizes: ['Free Size'],
        colors: ['Black', 'Blue'],
        colorVariants,
      });
    expect(createResponse.status).toBe(201);
      expect(createResponse.body.data.product.images).toEqual(images);
      expect(createResponse.body.data.product.colorVariants.map((variant) => variant.images)).toEqual([
      [images[0], images[1]],
      [images[2]],
    ]);

    const retailerProducts = await request(app)
      .get('/api/v1/retailer/products')
      .set('Authorization', ['Bearer', retailerToken].join(' '));
    expect(retailerProducts.status).toBe(200);
    const listedUpdatedProduct = retailerProducts.body.data.find((item) => String(item._id) === String(product._id));
    const listedCreatedProduct = retailerProducts.body.data.find((item) => String(item._id) === String(createResponse.body.data.product._id));
    expect(listedUpdatedProduct.images).toEqual(images);
    expect(listedUpdatedProduct.colorVariants).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ color: 'Black', sku: 'CHANIYA-BLK', images: [images[0], images[1]] }),
        expect.objectContaining({ color: 'Blue', sku: 'CHANIYA-BLU', images: [images[2]] }),
      ])
    );
    expect(listedCreatedProduct.images).toEqual(images);
    expect(listedCreatedProduct.colorVariants).toEqual(listedUpdatedProduct.colorVariants);
  });

  test('rejects a negative price with a field-specific validation error', async () => {
    const response = await request(app)
      .put(`/api/v1/wholesaler/products/${product._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ sellingPrice: -1 });

    expect(response.status).toBe(422);
    expect(response.body.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'sellingPrice' }),
    ]));
  });

  test('enforces selling price and MRP relationships when prices are updated', async () => {
    const belowCost = await request(app)
      .put(`/api/v1/wholesaler/products/${product._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ sellingPrice: 70, wholesalePrice: 70 });
    expect(belowCost.status).toBe(422);
    expect(belowCost.body.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'sellingPrice' }),
    ]));

    const belowSellingPrice = await request(app)
      .put(`/api/v1/wholesaler/products/${product._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ sellingPrice: 120, wholesalePrice: 120, mrp: 110 });
    expect(belowSellingPrice.status).toBe(422);
    expect(belowSellingPrice.body.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'mrp' }),
    ]));
  });

  test('validates required attributes when changing to a new category', async () => {
    const electronics = await Category.create({
      name: 'Electronics',
      slug: 'electronics',
    });
    const url = `/api/v1/wholesaler/products/${product._id}`;

    const invalidResponse = await request(app)
      .put(url)
      .set('Authorization', `Bearer ${token}`)
      .send({ categoryId: String(electronics._id), categoryAttributes: {} });

    expect(invalidResponse.status).toBe(400);
    expect(invalidResponse.body.message).toContain('Model Number / Name');

    const validResponse = await request(app)
      .put(url)
      .set('Authorization', `Bearer ${token}`)
      .send({
        categoryId: String(electronics._id),
        categoryAttributes: {
          modelNumber: 'EC-100',
          warrantyPeriod: 'No Warranty',
        },
      });
    expect(validResponse.status).toBe(200);
    expect(String(validResponse.body.data.categoryId)).toBe(String(electronics._id));
  });

  test('allows update and delete when wholesaler KYC is not approved', async () => {
    await WholesalerProfile.findOneAndUpdate(
      { userId: wholesaler._id },
      { kycStatus: KYC_STATUS.DRAFT }
    );

    const updateResponse = await request(app)
      .put(`/api/v1/wholesaler/products/${product._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ description: 'Updated without KYC approval' });
    expect(updateResponse.status).toBe(200);

    const deleteResponse = await request(app)
      .delete(`/api/v1/wholesaler/products/${product._id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(deleteResponse.status).toBe(200);
  });

  test('rejects updates from a different wholesaler', async () => {
    const otherUser = await User.create({
      name: 'Other Wholesaler',
      email: 'other@wholesale.test',
      passwordHash: await User.hashPassword('Wholesaler123'),
      role: ROLES.WHOLESALER,
      status: USER_STATUS.ACTIVE,
    });
    const otherLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'other@wholesale.test',
      password: 'Wholesaler123',
    });

    const response = await request(app)
      .put(`/api/v1/wholesaler/products/${product._id}`)
      .set('Authorization', `Bearer ${otherLogin.body.data.token}`)
      .send({ description: 'Not owned by this wholesaler' });

    expect(response.status).toBe(403);
  });

  test('editing legacy product with omitted MRP and 0 existing MRP auto-bumps MRP and succeeds', async () => {
    // Set product's existing mrp to 0 like an old unconfigured legacy product
    await Product.findByIdAndUpdate(product._id, { mrp: 0 });

    const response = await request(app)
      .put(`/api/v1/wholesaler/products/${product._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Chaniya choli legacy revived',
        sellingPrice: 160,
        stock: 25,
      });

    expect(response.status).toBe(200);
    expect(response.body.data.name).toBe('Chaniya choli legacy revived');
    expect(response.body.data.sellingPrice).toBe(160);
    expect(response.body.data.stock).toBe(25);
    expect(response.body.data.mrp).toBeGreaterThanOrEqual(160);

    const reloaded = await Product.findById(product._id).lean();
    expect(reloaded.sellingPrice).toBe(160);
    expect(reloaded.stock).toBe(25);
    expect(reloaded.mrp).toBeGreaterThanOrEqual(160);
  });

  test('allows assigning Level 3 subcategory under root category hierarchy', async () => {
    const level2Women = await Category.create({
      name: 'Women',
      slug: 'women',
      parentId: category._id,
      level: 1,
    });
    const level3Saree = await Category.create({
      name: 'Saree',
      slug: 'saree',
      parentId: level2Women._id,
      level: 2,
    });

    const response = await request(app)
      .put(`/api/v1/wholesaler/products/${product._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        categoryId: String(category._id),
        subcategoryId: String(level3Saree._id),
      });

    expect(response.status).toBe(200);
    expect(String(response.body.data.subcategoryId)).toBe(String(level3Saree._id));
  });

  test('rejects negative stock and minOrderQty less than 1', async () => {
    const negativeStock = await request(app)
      .put(`/api/v1/wholesaler/products/${product._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ stock: -5 });

    expect(negativeStock.status).toBe(422);
    expect(negativeStock.body.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'stock' }),
    ]));

    const invalidMoq = await request(app)
      .put(`/api/v1/wholesaler/products/${product._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ minOrderQty: 0 });

    expect(invalidMoq.status).toBe(422);
    expect(invalidMoq.body.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'minOrderQty' }),
    ]));
  });
});
