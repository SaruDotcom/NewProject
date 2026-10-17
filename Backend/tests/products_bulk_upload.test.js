const request = require('supertest');
const ExcelJS = require('exceljs');
const app = require('../src/app');
const { setupTestDB, clearDatabase } = require('./setup');
const { User, WholesalerProfile, Category, Product } = require('../src/models');
const { ROLES, USER_STATUS, KYC_STATUS } = require('../src/config/constants');
const AuthService = require('../src/modules/auth/auth.service');

const xlsxParser = (response, callback) => {
  const chunks = [];
  response.on('data', (chunk) => chunks.push(chunk));
  response.on('end', () => callback(null, Buffer.concat(chunks)));
};

setupTestDB();

describe('Bulk product upload', () => {
  let wholesaler;
  let otherWholesaler;
  let token;
  let electronics;
  let electronicsSubcategory;
  let clothing;
  let clothingSubcategory;
  let footwear;
  let footwearSubcategory;

  beforeEach(async () => {
    await clearDatabase();
    const passwordHash = await User.hashPassword('Password@123');
    wholesaler = await User.create({
      name: 'Bulk Wholesaler',
      email: 'bulk@wholesaler.test',
      passwordHash,
      role: ROLES.WHOLESALER,
      status: USER_STATUS.ACTIVE,
    });
    otherWholesaler = await User.create({
      name: 'Other Wholesaler',
      email: 'other@wholesaler.test',
      passwordHash,
      role: ROLES.WHOLESALER,
      status: USER_STATUS.ACTIVE,
    });
    await WholesalerProfile.create({
      userId: wholesaler._id,
      businessName: 'Bulk Wholesale',
      kycStatus: KYC_STATUS.APPROVED,
    });
    await WholesalerProfile.create({
      userId: otherWholesaler._id,
      businessName: 'Other Wholesale',
      kycStatus: KYC_STATUS.APPROVED,
    });
    token = AuthService.generateTokens(wholesaler).accessToken;

    electronics = await Category.create({ name: 'Electronics', slug: 'electronics' });
    electronicsSubcategory = await Category.create({
      name: 'Audio',
      slug: 'audio',
      parentId: electronics._id,
    });
    clothing = await Category.create({ name: 'Clothing', slug: 'clothing' });
    clothingSubcategory = await Category.create({
      name: 'Shirts',
      slug: 'shirts',
      parentId: clothing._id,
    });
    footwear = await Category.create({ name: 'Footwear', slug: 'footwear' });
    footwearSubcategory = await Category.create({
      name: 'Sneakers',
      slug: 'sneakers',
      parentId: footwear._id,
    });
  });

  const electronicsRow = (overrides = {}) => ({
    rowNumber: 4,
    data: {
      'Product Name': '=Wireless Headphones',
      SKU: '=bulk-headphones-01',
      Brand: 'Sound Co',
      Description: 'Wireless headphones for retail stores',
      Category: 'Electronics',
      Subcategory: 'Audio',
      'Cost Price': 800,
      MRP: 1999,
      'Selling Price': 1200,
      MOQ: 5,
      'Stock Quantity': 40,
      'GST %': 18,
      'Model Number': 'WH-01',
      Warranty: '1 Year Manufacturer Warranty',
      ...overrides,
    },
  });

  test('previews a row without images and strips formula prefixes', async () => {
    const response = await request(app)
      .post('/api/v1/wholesaler/products/bulk/preview')
      .set('Authorization', `Bearer ${token}`)
      .send({ rows: [electronicsRow()] });

    expect(response.status).toBe(200);
    expect(response.body.data.rows[0]).toMatchObject({
      rowNumber: 4,
      valid: true,
      errors: [],
      data: { 'Product Name': 'Wireless Headphones', SKU: 'bulk-headphones-01' },
    });
  });

  test('imports valid rows using JWT ownership, with structured size and size-chart data', async () => {
    const clothingRow = {
      rowNumber: 7,
      data: {
        'Product Name': 'Cotton Shirt',
        SKU: 'shirt-001',
        Description: 'Cotton shirt',
        Category: 'Clothing',
        Subcategory: 'Shirts',
        'Cost Price': 250,
        MRP: 800,
        'Selling Price': 450,
        MOQ: 10,
        'Stock Quantity': 100,
        Status: 'DRAFT',
        Sizes: 'S,M',
        Colors: 'Red,Navy Blue',
        'Size Chart Unit': 'cm',
        'Size Chart - S - Chest': 38,
        'Size Chart - S - Length': 26,
        'Size Chart - M - Chest': 40,
        'Size Chart - M - Length': 27,
        wholesalerId: String(otherWholesaler._id),
      },
    };

    const response = await request(app)
      .post('/api/v1/wholesaler/products/bulk/import')
      .set('Authorization', `Bearer ${token}`)
      .send({ rows: [clothingRow] });

    expect(response.status).toBe(200);
    expect(response.body.data.imported).toHaveLength(1);
    expect(response.body.data.rejected).toHaveLength(0);
    const product = await Product.findOne({ sku: 'SHIRT-001' });
    expect(String(product.wholesalerId)).toBe(String(wholesaler._id));
    expect(product.images).toEqual([]);
    expect(product.status).toBe('DRAFT');
    expect(product.sizes).toEqual(['S', 'M']);
    expect(product.colors).toEqual(['Red', 'Navy Blue']);
    expect(product.sizeChart).toEqual({
      unit: 'cm',
      measurements: [
        { size: 'S', measurements: { Chest: 38, Length: 26 } },
        { size: 'M', measurements: { Chest: 40, Length: 27 } },
      ],
    });
  });

  test('uses Footwear rules and stores footwear size measurements', async () => {
    const response = await request(app)
      .post('/api/v1/wholesaler/products/bulk/preview')
      .set('Authorization', `Bearer ${token}`)
      .send({
        rows: [{
          rowNumber: 9,
          data: {
            'Product Name': 'Canvas Sneakers',
            SKU: 'shoe-001',
            Description: 'Canvas sneakers',
            Category: 'Footwear',
            Subcategory: 'Sneakers',
            'Cost Price': 300,
            MRP: 900,
            'Selling Price': 500,
            MOQ: 2,
            'Stock Quantity': 20,
            Sizes: 'UK 5',
            Colors: 'White',
            'Size Chart Unit': 'cm',
            'Size Chart - UK 5 - Foot Length': 24,
          },
        }],
      });

    expect(response.status).toBe(200);
    expect(response.body.data.rows[0].valid).toBe(true);
    expect(response.body.data.rows[0].product.sizeChart).toEqual({
      unit: 'cm',
      measurements: [{ size: 'UK 5', measurements: { 'Foot Length': 24 } }],
    });
  });

  test('rejects repeated SKUs in the same upload and does not overwrite products', async () => {
    const response = await request(app)
      .post('/api/v1/wholesaler/products/bulk/preview')
      .set('Authorization', `Bearer ${token}`)
      .send({ rows: [electronicsRow(), { ...electronicsRow(), rowNumber: 5 }] });

    expect(response.status).toBe(200);
    expect(response.body.data.rows.every((row) => !row.valid)).toBe(true);
    expect(response.body.data.rows[0].errors.join(' ')).toMatch(/appears more than once/i);
    expect(await Product.countDocuments({ wholesalerId: wholesaler._id })).toBe(0);
  });

  test('does not allow Electronics rows to include size values', async () => {
    const response = await request(app)
      .post('/api/v1/wholesaler/products/bulk/preview')
      .set('Authorization', `Bearer ${token}`)
      .send({ rows: [electronicsRow({ Sizes: 'M', Colors: 'Black' })] });

    expect(response.status).toBe(200);
    expect(response.body.data.rows[0].valid).toBe(false);
    expect(response.body.data.rows[0].errors.join(' ')).toMatch(/not valid for category 'Electronics'/i);
  });

  test('blocks import when the wholesaler is not KYC-approved', async () => {
    await WholesalerProfile.updateOne(
      { userId: wholesaler._id },
      { kycStatus: KYC_STATUS.DRAFT },
    );

    const response = await request(app)
      .post('/api/v1/wholesaler/products/bulk/import')
      .set('Authorization', `Bearer ${token}`)
      .send({ rows: [electronicsRow()] });

    expect(response.status).toBe(403);
    expect(response.body.code).toBe('KYC_APPROVAL_REQUIRED');
  });

  test('rejects category names that are not exact entries in the wholesaler category tree', async () => {
    const response = await request(app)
      .post('/api/v1/wholesaler/products/bulk/preview')
      .set('Authorization', `Bearer ${token}`)
      .send({ rows: [electronicsRow({ Subcategory: 'Accessories' })] });

    expect(response.status).toBe(200);
    expect(response.body.data.rows[0].valid).toBe(false);
    expect(response.body.data.rows[0].errors.join(' ')).toMatch(/does not belong to category/i);
  });

  test('downloads category-specific templates with scoped dropdowns and an ignored example row', async () => {
    await Category.create({
      name: 'Wireless Audio',
      slug: 'wireless-audio',
      parentId: electronics._id,
      wholesalerId: wholesaler._id,
    });
    await Category.create({
      name: 'Other Electronics',
      slug: 'other-electronics',
      wholesalerId: otherWholesaler._id,
    });
    const response = await request(app)
      .get('/api/v1/wholesaler/products/bulk/template?category=electronics')
      .set('Authorization', `Bearer ${token}`)
      .buffer(true)
      .parse(xlsxParser);

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('spreadsheetml.sheet');
    expect(response.headers['content-disposition']).toContain('products-electronics-template.xlsx');

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(response.body);
    expect(workbook.worksheets.filter((sheet) => sheet.state === 'visible').map((sheet) => sheet.name))
      .toEqual(['Products', 'Instructions']);
    const products = workbook.getWorksheet('Products');
    expect(products.getRow(1).values).toContain('Parent Category*');
    expect(products.getRow(1).values).toContain('Sub Category*');
    expect(products.getRow(1).values).toContain('Tier 3 Price');
    expect(products.getCell(1, 1).font.bold).toBe(true);
    expect(products.getRow(1).values).not.toContain('Sizes*');
    expect(products.getRow(1).values).not.toContain('Colors*');
    expect(products.getCell(2, 1).value).toMatch(/do not import/i);
    expect(products.getCell(2, 1).fill.fgColor.argb).toBe('FFE5E7EB');
    expect(products.views[0]).toMatchObject({ state: 'frozen', ySplit: 1 });
    expect(products.getCell(3, 5).dataValidation.formulae).toEqual(['CategoryOptions']);
    expect(products.getCell(3, 6).dataValidation.formulae[0]).toContain('MATCH($E3,CategoryOptions,0)');
    expect(products.getCell(3, products.getRow(1).values.indexOf('Status')).dataValidation.formulae).toEqual(['StatusOptions']);
    expect(products.getCell(2, 5).dataValidation).toBeUndefined();
    expect(workbook.getWorksheet('Dropdowns').getColumn(2).values).toContain('Wireless Audio');
    expect(workbook.getWorksheet('Dropdowns').getColumn(1).values).not.toContain('Other Electronics');
    expect(workbook.getWorksheet('Instructions').getRow(11).getCell(2).value).toContain('unique stock-keeping unit');
  });

  test('requires choosing a supported category for the template', async () => {
    const response = await request(app)
      .get('/api/v1/wholesaler/products/bulk/template?category=all')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/supported product category/i);
  });
});
