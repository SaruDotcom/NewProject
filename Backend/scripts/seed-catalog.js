const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const mongoose = require('mongoose');
const slugify = require('slugify');
const env = require('../src/config/env');
const models = require('../src/models');
const { INVENTORY_TRANSACTION_TYPE, PRODUCT_STATUS } = require('../src/config/constants');

const TARGET_DATABASE = 'test';
const scriptArgs = process.argv.slice(2);
const mode = scriptArgs.find((arg) => !arg.startsWith('--')) || 'insert';
const unsupportedArgs = scriptArgs.filter((arg) => arg.startsWith('--'));
const imagePools = {
  clothing: [
    'photo-1490481651871-ab68de25d43d',
    'photo-1521572163474-6864f9cf17ab',
    'photo-1529139574466-a303027c1d8b',
    'photo-1551028719-00167b16eac5',
  ],
  footwear: [
    'photo-1543163521-1bf539c55dd2',
    'photo-1542291026-7eec264c27ff',
    'photo-1600185365483-26d7a4cc7519',
    'photo-1608231387042-66d1773070a5',
  ],
  electronics: [
    'photo-1572569511254-d8f925fe2cbb',
    'photo-1505740420928-5e560c06d30e',
    'photo-1550009158-9ebf69173e03',
    'photo-1583394838336-acd977736f90',
  ],
  skincare: [
    'photo-1608248543803-ba4f8c70ae0b',
    'photo-1556229010-6c3f2c9ca5f8',
    'photo-1601049541289-9b1b7bbbfe19',
    'photo-1556228720-195a672e8a03',
  ],
  grocery: [
    'photo-1542838132-92c53300491e',
    'photo-1586201375761-83865001e31c',
    'photo-1604908176997-125f25cc6f3d',
    'photo-1490645935967-10de6ba17061',
  ],
  home: [
    'photo-1494438639946-1ebd1d20bf85',
    'photo-1556911220-bff31c812dba',
    'photo-1600585154340-be6161a56a0c',
    'photo-1490312278390-ab64016e0aa9',
  ],
  jewelry: [
    'photo-1515562141207-7a88fb7ce338',
    'photo-1617038220319-276d3cfab638',
    'photo-1535632066927-ab7c9ab60908',
    'photo-1611652022419-a9419f74343d',
  ],
  bags: [
    'photo-1553062407-98eeb64c6a62',
    'photo-1584917865442-de89df76afd3',
    'photo-1548036328-c9fa89d128fa',
    'photo-1590874103328-eac38a683ce7',
  ],
};

const categoryTree = [
  { name: 'Clothing', imagePool: 'clothing', children: {
    Women: ['Saree', 'Kurti', 'Lehenga', 'Gown'],
    Men: ['Shirts', 'T-Shirts', 'Kurta'],
    Kids: ['Frocks', 'Boys Wear'],
  } },
  { name: 'Footwear', imagePool: 'footwear', children: {
    Women: ['Sandals', 'Heels'],
    Men: ['Casual Shoes', 'Sports Shoes'],
  } },
  { name: 'Electronics', imagePool: 'electronics', children: {
    'Home Appliances': ['Mixer Grinder', 'Fans'],
    'Mobile Accessories': ['Speakers', 'Chargers'],
  } },
  { name: 'Skincare', imagePool: 'skincare', children: {
    Face: ['Sunscreen', 'Serum', 'Face Wash'],
    Hair: ['Shampoo', 'Hair Oil'],
  } },
  { name: 'Grocery', imagePool: 'grocery', children: {
    Staples: ['Rice', 'Tea'],
    Snacks: ['Namkeen', 'Biscuits'],
  } },
  { name: 'Home and Kitchen', imagePool: 'home', children: {
    Kitchenware: ['Steel Utensils'],
    'Home Decor': ['Wall Art'],
  } },
  { name: 'Jewelry', imagePool: 'jewelry', children: {
    Artificial: ['Necklace Sets', 'Earrings'],
  } },
  { name: 'Bags and Accessories', imagePool: 'bags', children: {
    Bags: ['Handbags', 'Backpacks'],
  } },
];

const products = [
  { name: 'Jaipur Indigo Cotton Saree', sku: 'ST-CL-001', brand: 'Shorya Weaves', path: ['Clothing', 'Women', 'Saree'], pool: 'clothing', cost: 740, price: 1120, mrp: 1499, moq: 10, stock: 84, hsn: '500720', attrs: { size: ['Free Size'], color: ['Indigo', 'Maroon'], fabric: 'Cotton', fit: 'Regular Fit', pattern: 'Printed', gender: 'Women' }, colors: ['Indigo', 'Maroon'] },
  { name: 'Everyday Rayon Kurti', sku: 'ST-CL-002', brand: 'Shorya Studio', path: ['Clothing', 'Women', 'Kurti'], pool: 'clothing', cost: 310, price: 485, mrp: 699, moq: 15, stock: 125, hsn: '620640', attrs: { size: ['S', 'M', 'L', 'XL'], color: ['Blue', 'White'], fabric: 'Rayon', fit: 'Regular Fit', pattern: 'Floral', gender: 'Women' }, colors: ['Blue', 'White'] },
  { name: 'Festive Embroidered Lehenga Set', sku: 'ST-CL-003', brand: 'Shorya Celebrations', path: ['Clothing', 'Women', 'Lehenga'], pool: 'clothing', cost: 2480, price: 3690, mrp: 4999, moq: 5, stock: 6, hsn: '620443', attrs: { size: ['S', 'M', 'L', 'XL'], color: ['Wine', 'Navy'], fabric: 'Silk', fit: 'Regular Fit', pattern: 'Embroidered', gender: 'Women' }, colors: ['Wine', 'Navy'], stockType: 'low' },
  { name: 'Classic Oxford Office Shirt', sku: 'ST-CL-004', brand: 'North Loom', path: ['Clothing', 'Men', 'Shirts'], pool: 'clothing', cost: 520, price: 790, mrp: 1099, moq: 20, stock: 96, hsn: '620520', attrs: { size: ['S', 'M', 'L', 'XL'], color: ['White', 'Blue'], fabric: '100% Cotton', fit: 'Slim Fit', pattern: 'Solid', gender: 'Men' }, colors: ['White', 'Blue'] },
  { name: 'Little Bloom Printed Frock', sku: 'ST-CL-005', brand: 'Tiny Trail', path: ['Clothing', 'Kids', 'Frocks'], pool: 'clothing', cost: 285, price: 440, mrp: 599, moq: 12, stock: 72, hsn: '620442', attrs: { size: ['S', 'M', 'L'], color: ['Pink', 'Yellow'], fabric: 'Blended', fit: 'Loose Fit', pattern: 'Floral', gender: 'Girls' }, colors: ['Pink', 'Yellow'] },
  { name: 'Comfort Walk Everyday Sandals', sku: 'ST-FW-001', brand: 'Stride Co.', path: ['Footwear', 'Women', 'Sandals'], pool: 'footwear', cost: 420, price: 645, mrp: 899, moq: 10, stock: 90, hsn: '640299', attrs: { size: ['UK 5', 'UK 6', 'UK 7', 'UK 8'], color: ['Tan', 'Black'], material: 'Synthetic Leather', soleType: 'TPR', closureType: 'Buckle', occasion: 'Casual' }, colors: ['Tan', 'Black'] },
  { name: 'City Glow Block Heels', sku: 'ST-FW-002', brand: 'Stride Co.', path: ['Footwear', 'Women', 'Heels'], pool: 'footwear', cost: 690, price: 990, mrp: 1399, moq: 8, stock: 7, hsn: '640299', attrs: { size: ['UK 5', 'UK 6', 'UK 7', 'UK 8'], color: ['Black', 'Nude'], material: 'Synthetic Leather', soleType: 'TPR', closureType: 'Buckle', occasion: 'Party Wear' }, colors: ['Black', 'Nude'], stockType: 'low' },
  { name: 'Metro Flex Casual Shoes', sku: 'ST-FW-003', brand: 'Urban Trek', path: ['Footwear', 'Men', 'Casual Shoes'], pool: 'footwear', cost: 880, price: 1290, mrp: 1799, moq: 10, stock: 115, hsn: '640411', attrs: { size: ['UK 7', 'UK 8', 'UK 9', 'UK 10'], color: ['Navy', 'Grey'], material: 'Mesh', soleType: 'EVA', closureType: 'Lace-Up', occasion: 'Casual' }, colors: ['Navy', 'Grey'] },
  { name: 'WhirlPro 750W Mixer Grinder', sku: 'ST-EL-001', brand: 'VoltEdge', path: ['Electronics', 'Home Appliances', 'Mixer Grinder'], pool: 'electronics', cost: 1850, price: 2490, mrp: 3299, moq: 5, stock: 64, hsn: '850940', attrs: { modelNumber: 'VE-MG750', warrantyPeriod: '1 Year Manufacturer Warranty', variant: '750W, 3 stainless-steel jars', includedAccessories: 'Three jars, spatula, user guide' } },
  { name: 'BreezeLine Pedestal Fan', sku: 'ST-EL-002', brand: 'VoltEdge', path: ['Electronics', 'Home Appliances', 'Fans'], pool: 'electronics', cost: 2140, price: 2890, mrp: 3799, moq: 5, stock: 65, hsn: '841451', attrs: { modelNumber: 'VE-PF400', warrantyPeriod: '1 Year Manufacturer Warranty', variant: '400 mm, 3 speed settings', connectivity: ['230V AC'] } },
  { name: 'Pulse Mini Bluetooth Speaker', sku: 'ST-EL-003', brand: 'SonicArc', path: ['Electronics', 'Mobile Accessories', 'Speakers'], pool: 'electronics', cost: 620, price: 940, mrp: 1299, moq: 10, stock: 135, hsn: '851821', attrs: { modelNumber: 'SA-PULSE-M', warrantyPeriod: '6 Months Manufacturer Warranty', variant: 'Bluetooth 5.3, USB-C charging', connectivity: ['Bluetooth 5.3', 'USB-C'], includedAccessories: 'USB-C cable, user guide' }, colors: ['Black', 'Blue', 'White'] },
  { name: 'SwiftCharge 33W USB-C Adapter', sku: 'ST-EL-004', brand: 'VoltEdge', path: ['Electronics', 'Mobile Accessories', 'Chargers'], pool: 'electronics', cost: 360, price: 560, mrp: 799, moq: 20, stock: 0, hsn: '850440', attrs: { modelNumber: 'VE-SC33', warrantyPeriod: '6 Months Manufacturer Warranty', variant: '33W PD fast charging', connectivity: ['USB-C'], includedAccessories: 'Power adapter, safety leaflet' }, colors: ['White', 'Black'], stockType: 'out' },
  { name: 'Sunveil SPF 50 Daily Sunscreen', sku: 'ST-SK-001', brand: 'Nira Botanics', path: ['Skincare', 'Face', 'Sunscreen'], pool: 'skincare', cost: 155, price: 245, mrp: 349, moq: 20, stock: 150, hsn: '330499', attrs: { volumeWeight: '50 ml', suitableFor: 'All Skin Types', keyIngredients: 'Aloe vera, vitamin E', expiryDate: '2027-12-31', fssaiLicense: 'DEMO-SKIN-001' } },
  { name: 'C-Glow Vitamin Serum', sku: 'ST-SK-002', brand: 'Nira Botanics', path: ['Skincare', 'Face', 'Serum'], pool: 'skincare', cost: 220, price: 345, mrp: 499, moq: 15, stock: 9, hsn: '330499', attrs: { volumeWeight: '30 ml', suitableFor: 'Normal Skin', keyIngredients: 'Vitamin C, hyaluronic acid', expiryDate: '2027-09-30', fssaiLicense: 'DEMO-SKIN-002' }, stockType: 'low' },
  { name: 'Herbal Daily Nourish Shampoo', sku: 'ST-SK-003', brand: 'Nira Botanics', path: ['Skincare', 'Hair', 'Shampoo'], pool: 'skincare', cost: 118, price: 185, mrp: 259, moq: 24, stock: 180, hsn: '330510', attrs: { volumeWeight: '250 ml', suitableFor: 'All Hair Types', keyIngredients: 'Bhringraj, aloe vera', expiryDate: '2027-11-30', fssaiLicense: 'DEMO-SKIN-003' } },
  { name: 'Amber Field Basmati Rice', sku: 'ST-GR-001', brand: 'Harvest Table', path: ['Grocery', 'Staples', 'Rice'], pool: 'grocery', cost: 390, price: 495, mrp: 620, moq: 25, stock: 210, hsn: '100630', attrs: { netQuantity: '5 kg', expiryDate: '2027-10-31', vegNonVeg: 'Veg', fssaiLicense: 'DEMO-GROCERY-001', storageInstructions: 'Store in a cool, dry place.' } },
  { name: 'Assam Gold CTC Tea', sku: 'ST-GR-002', brand: 'Harvest Table', path: ['Grocery', 'Staples', 'Tea'], pool: 'grocery', cost: 165, price: 220, mrp: 285, moq: 20, stock: 175, hsn: '090240', attrs: { netQuantity: '500 g', expiryDate: '2027-08-31', vegNonVeg: 'Veg', fssaiLicense: 'DEMO-GROCERY-002', storageInstructions: 'Keep sealed and away from moisture.' } },
  { name: 'Masala Crunch Namkeen Family Pack', sku: 'ST-GR-003', brand: 'Harvest Table', path: ['Grocery', 'Snacks', 'Namkeen'], pool: 'grocery', cost: 82, price: 119, mrp: 160, moq: 30, stock: 95, hsn: '210690', attrs: { netQuantity: '400 g', expiryDate: '2027-04-30', vegNonVeg: 'Veg', fssaiLicense: 'DEMO-GROCERY-003', storageInstructions: 'Store in an airtight container after opening.' } },
  { name: 'Everyday Stainless Steel Thali Set', sku: 'ST-HK-001', brand: 'GharCraft', path: ['Home and Kitchen', 'Kitchenware', 'Steel Utensils'], pool: 'home', cost: 540, price: 795, mrp: 1099, moq: 10, stock: 88, hsn: '732393', attrs: { material: 'Stainless Steel', colorFinish: 'Mirror Finish', capacity: '6-piece dinner set', warrantyPeriod: 'No Warranty' } },
  { name: 'Saffron Horizon Framed Wall Art', sku: 'ST-HK-002', brand: 'GharCraft', path: ['Home and Kitchen', 'Home Decor', 'Wall Art'], pool: 'home', cost: 720, price: 1080, mrp: 1499, moq: 5, stock: 58, hsn: '970199', attrs: { material: 'Wood', colorFinish: 'Natural frame', assemblyRequired: 'No (Pre-assembled)' } },
  { name: 'Mogra Pearl Necklace Set', sku: 'ST-JW-001', brand: 'Aarohi Adornments', path: ['Jewelry', 'Artificial', 'Necklace Sets'], pool: 'jewelry', cost: 430, price: 690, mrp: 999, moq: 10, stock: 76, hsn: '711719', attrs: { material: 'Brass / Alloy', purity: 'Artificial / One Gram Gold', weight: 24.5, gemstoneDetails: 'Imitation pearl accents' }, colors: ['Gold', 'Rose Gold'] },
  { name: 'Dewdrop Everyday Earrings', sku: 'ST-JW-002', brand: 'Aarohi Adornments', path: ['Jewelry', 'Artificial', 'Earrings'], pool: 'jewelry', cost: 145, price: 235, mrp: 349, moq: 20, stock: 140, hsn: '711719', attrs: { material: 'Brass / Alloy', purity: 'Artificial / One Gram Gold', weight: 6.2, gemstoneDetails: 'Glass crystal detail' }, colors: ['Gold', 'Silver', 'Rose Gold'] },
  { name: 'Everyday Canvas Handbag', sku: 'ST-BA-001', brand: 'CarryKind', path: ['Bags and Accessories', 'Bags', 'Handbags'], pool: 'bags', cost: 610, price: 920, mrp: 1299, moq: 8, stock: 74, hsn: '420222', colors: ['Olive', 'Black'] },
  { name: 'TrailMate Utility Backpack', sku: 'ST-BA-002', brand: 'CarryKind', path: ['Bags and Accessories', 'Bags', 'Backpacks'], pool: 'bags', cost: 890, price: 1340, mrp: 1899, moq: 5, stock: 62, hsn: '420292', colors: ['Navy', 'Charcoal'] },
  { name: 'Market Day Woven Sling Bag', sku: 'ST-BA-003', brand: 'CarryKind', path: ['Bags and Accessories', 'Bags', 'Handbags'], pool: 'bags', cost: 475, price: 735, mrp: 999, moq: 12, stock: 105, hsn: '420222', colors: ['Rust', 'Beige', 'Teal'] },
];

function publicImage(photoId) {
  return `https://images.unsplash.com/${photoId}?auto=format&fit=crop&w=1000&q=85`;
}

function imagesFor(poolName, offset = 0, count = 4) {
  const pool = imagePools[poolName];
  return Array.from({ length: count }, (_, index) => ({
    url: publicImage(pool[(offset + index) % pool.length]),
    publicId: null,
  }));
}

function intendedSlug(node, ancestors) {
  return slugify([...ancestors, node.name].join('-'), { lower: true, strict: true });
}

function sameId(left, right) {
  return String(left || '') === String(right || '');
}

function matchesCategoryScope(category, wholesalerId) {
  return !category.wholesalerId || sameId(category.wholesalerId, wholesalerId);
}

async function getWholesaler() {
  const matches = await models.WholesalerProfile.find({
    businessName: /^Shorya Techno$/i,
    isDeleted: { $ne: true },
  }).select('businessName userId').lean();

  if (matches.length !== 1) {
    throw new Error(`Expected exactly one active wholesaler named "Shorya Techno"; found ${matches.length}.`);
  }
  const user = await models.User.findOne({
    _id: matches[0].userId,
    role: 'WHOLESALER',
    isDeleted: { $ne: true },
  }).select('_id name').lean();
  if (!user) throw new Error('The Shorya Techno profile has no active wholesaler user.');
  return { ...matches[0], user };
}

async function printCounts(label) {
  const rows = await Promise.all(
    [models.Category, models.Product, models.Inventory, models.InventoryTransaction].map(async (Model) => ({
      collection: Model.collection.collectionName,
      documents: await Model.countDocuments({}),
    })),
  );
  console.log(`\n${label} collection counts:`);
  console.table(rows);
  return Object.fromEntries(rows.map((row) => [row.collection, row.documents]));
}

async function clearCatalog(wholesalerId) {
  const demoProducts = await models.Product.find({ wholesalerId, isDemo: true }).select('_id').lean();
  const productIds = demoProducts.map((product) => product._id);
  if (productIds.length) {
    await models.InventoryTransaction.deleteMany({
      wholesalerId,
      productId: { $in: productIds },
      isDemo: true,
    });
    await models.Inventory.deleteMany({
      wholesalerId,
      productId: { $in: productIds },
      isDemo: true,
    });
    await models.Product.deleteMany({ wholesalerId, _id: { $in: productIds }, isDemo: true });
  }
  await models.Category.deleteMany({ wholesalerId, isDemo: true });
}

async function createCategoryTree(wholesalerId) {
  const categoriesByPath = new Map();
  const created = [];
  const skipped = [];

  for (const rootDefinition of categoryTree) {
    const rootWithImage = {
      ...rootDefinition,
      imageUrl: publicImage(imagePools[rootDefinition.imagePool][0]),
      description: `${rootDefinition.name} wholesale products for Shorya Techno retailers.`,
    };
    const rootSlug = intendedSlug(rootWithImage, []);
    const root = await getOrCreateCategory({
      definition: rootWithImage,
      slug: rootSlug,
      parent: null,
      ancestors: [],
      wholesalerId,
      created,
      skipped,
    });
    categoriesByPath.set(rootDefinition.name, root);

    for (const [branchName, leaves] of Object.entries(rootDefinition.children)) {
      const branchDefinition = {
        name: branchName,
        description: `${branchName} products in ${rootDefinition.name}.`,
        imageUrl: publicImage(imagePools[rootDefinition.imagePool][1]),
      };
      const branch = await getOrCreateCategory({
        definition: branchDefinition,
        slug: intendedSlug(branchDefinition, [rootDefinition.name]),
        parent: root,
        ancestors: [rootDefinition.name],
        wholesalerId,
        created,
        skipped,
      });
      categoriesByPath.set(`${rootDefinition.name}/${branchName}`, branch);

      for (const leafName of leaves) {
        const leafDefinition = {
          name: leafName,
          description: `${leafName} selected for Shorya Techno wholesale customers.`,
          imageUrl: publicImage(imagePools[rootDefinition.imagePool][2]),
        };
        const leaf = await getOrCreateCategory({
          definition: leafDefinition,
          slug: intendedSlug(leafDefinition, [rootDefinition.name, branchName]),
          parent: branch,
          ancestors: [rootDefinition.name, branchName],
          wholesalerId,
          created,
          skipped,
        });
        categoriesByPath.set(`${rootDefinition.name}/${branchName}/${leafName}`, leaf);
      }
    }
  }
  return { categoriesByPath, created, skipped };
}

async function getOrCreateCategory({ definition, slug, parent, ancestors, wholesalerId, created, skipped }) {
  const expectedParentId = parent?._id || null;
  const samePath = await models.Category.findOne({
    name: new RegExp(`^${definition.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
    parentId: expectedParentId,
    isDeleted: { $ne: true },
    $or: [{ wholesalerId: null }, { wholesalerId }],
  }).lean();
  if (samePath) {
    skipped.push(`${[...ancestors, definition.name].join(' > ')} (existing matching category)`);
    return samePath;
  }

  const slugCollision = await models.Category.findOne({ slug }).lean();
  if (slugCollision) {
    const collisionParent = slugCollision.parentCategoryId || slugCollision.parentId || null;
    if (
      slugCollision.name.toLowerCase() === definition.name.toLowerCase() &&
      sameId(collisionParent, expectedParentId) &&
      matchesCategoryScope(slugCollision, wholesalerId) &&
      !slugCollision.isDeleted
    ) {
      skipped.push(`${[...ancestors, definition.name].join(' > ')} (existing matching slug)`);
      return slugCollision;
    }
    throw new Error(`Category slug collision "${slug}" exists on a different category path; no existing category was changed.`);
  }

  const category = new models.Category({
    name: definition.name,
    slug,
    description: definition.description || `${definition.name} products for Shorya Techno.`,
    imageUrl: definition.imageUrl,
    parentId: expectedParentId,
    parentCategoryId: expectedParentId,
    level: parent ? parent.level + 1 : 1,
    wholesalerId,
    isActive: true,
    isDeleted: false,
    isDemo: true,
  });
  await category.save();
  created.push(category);
  return category;
}

function getCategoryAttributes(product) {
  if (product.attrs) return product.attrs;
  return {};
}

function buildColorVariants(product, images) {
  if (!product.colors?.length) return undefined;
  return product.colors.map((color, index) => ({
    color,
    sku: `${product.sku}-${slugify(color, { lower: true, strict: true }).toUpperCase()}`,
    images: [
      images[index % images.length],
      images[(index + 1) % images.length],
    ],
  }));
}

function productSizeData(product) {
  if (product.path[0] !== 'Clothing') return {};
  return {
    sizes: product.attrs?.size || ['Free Size'],
    sizeChart: {
      unit: 'inches',
      measurements: [
        { size: 'S', chest: 36, waist: 30, length: 26 },
        { size: 'M', chest: 38, waist: 32, length: 27 },
        { size: 'L', chest: 40, waist: 34, length: 28 },
        { size: 'XL', chest: 42, waist: 36, length: 29 },
      ],
    },
  };
}

async function createProducts(wholesalerId, categoriesByPath) {
  if (products.length !== 25) throw new Error(`Catalog definition must contain 25 products; found ${products.length}.`);
  const createdProducts = [];
  const skipped = [];
  const now = new Date();

  for (const [index, definition] of products.entries()) {
    const [rootName, branchName, leafName] = definition.path;
    const root = categoriesByPath.get(rootName);
    const branch = categoriesByPath.get(`${rootName}/${branchName}`);
    const leaf = categoriesByPath.get(`${rootName}/${branchName}/${leafName}`);
    if (!root || !branch || !leaf) {
      throw new Error(`Missing category path for ${definition.name}: ${definition.path.join(' > ')}.`);
    }

    const slug = slugify(definition.name, { lower: true, strict: true });
    const duplicate = await models.Product.findOne({
      $or: [{ slug }, { sku: definition.sku.toUpperCase() }],
    }).select('_id sku slug wholesalerId').lean();
    if (duplicate) {
      skipped.push(`${definition.name} (${duplicate.sku || duplicate.slug} already exists)`);
      continue;
    }

    const images = imagesFor(definition.pool, index % 4);
    const colorVariants = buildColorVariants(definition, images);
    const stock = definition.stock;
    const product = new models.Product({
      wholesalerId,
      name: definition.name,
      productName: definition.name,
      title: definition.name,
      slug,
      sku: definition.sku,
      brand: definition.brand,
      description: `${definition.name} is selected for dependable everyday retail and wholesale demand. It is quality checked and packed for reliable delivery to Shorya Techno's retail partners.`,
      category: root._id,
      categoryId: root._id,
      subCategory: branch._id,
      subcategoryId: branch._id,
      subSubcategoryId: leaf._id,
      categoryName: root.name,
      subcategoryName: branch.name,
      subSubcategoryName: leaf.name,
      images,
      imageUrl: images[0].url,
      costPrice: definition.cost,
      mrp: definition.mrp,
      wholesalePrice: definition.price,
      sellingPrice: definition.price,
      retailerPrice: definition.price,
      basePrice: definition.price,
      moq: definition.moq,
      minOrderQty: definition.moq,
      stock,
      stockQuantity: stock,
      quantity: stock,
      lowStockThreshold: 10,
      unit: 'piece',
      pricingTiers: [
        { minQty: 50, maxQty: 99, pricePerUnit: Math.max(definition.cost + 1, Math.round(definition.price * 0.96)) },
        { minQty: 100, pricePerUnit: Math.max(definition.cost + 1, Math.round(definition.price * 0.92)) },
      ],
      bulkPricingTiers: [
        { minQty: 50, maxQty: 99, pricePerUnit: Math.max(definition.cost + 1, Math.round(definition.price * 0.96)) },
        { minQty: 100, pricePerUnit: Math.max(definition.cost + 1, Math.round(definition.price * 0.92)) },
      ],
      hsn: definition.hsn,
      hsnCode: definition.hsn,
      gst: 18,
      gstPercent: 18,
      cgst: 9,
      sgst: 9,
      igst: 18,
      priceIncludesTax: index % 2 === 0,
      taxConfigured: true,
      colors: definition.colors || [],
      colorVariants,
      categoryAttributes: getCategoryAttributes(definition),
      status: PRODUCT_STATUS.ACTIVE,
      isDeleted: false,
      isDemo: true,
      ...productSizeData(definition),
      createdAt: new Date(now.getTime() - (products.length - index) * 60000),
    });
    await product.save();
    createdProducts.push(product);

    const existingInventory = await models.Inventory.findOne({ productId: product._id }).lean();
    let inventory = existingInventory;
    if (!inventory) {
      inventory = await models.Inventory.create({
        productId: product._id,
        wholesalerId,
        available: stock,
        reserved: 0,
        sold: 0,
        damaged: 0,
        returned: 0,
        reorderLevel: 10,
        isDemo: true,
      });
    }

    const existingLog = await models.InventoryTransaction.findOne({
      productId: product._id,
      wholesalerId,
      isDemo: true,
      notes: 'Demo seed',
    }).lean();
    if (!existingLog) {
      await models.InventoryTransaction.create({
        inventoryId: inventory._id,
        productId: product._id,
        wholesalerId,
        type: INVENTORY_TRANSACTION_TYPE.RECEIVE,
        quantity: stock,
        previousAvailable: 0,
        newAvailable: stock,
        referenceType: 'RESTOCK',
        referenceId: `DEMO-OPENING-${definition.sku}`,
        performedBy: wholesalerId,
        notes: 'Demo seed',
        isDemo: true,
        createdAt: new Date(now.getTime() - (products.length - index) * 60000),
      });
    }
  }
  return { createdProducts, skipped };
}

async function printCatalog(wholesalerId, categoriesByPath, createdCategories, skippedCategories, skippedProducts) {
  const allDemoProducts = await models.Product.find({ wholesalerId, isDemo: true })
    .select('name sku categoryName subcategoryName subSubcategoryName categoryId subcategoryId subSubcategoryId sellingPrice stock')
    .lean();
  const categoryRows = [];
  for (const rootDefinition of categoryTree) {
    for (const [branchName, leafNames] of Object.entries(rootDefinition.children)) {
      for (const leafName of leafNames) {
        const path = `${rootDefinition.name}/${branchName}/${leafName}`;
        const category = categoriesByPath.get(path);
        const count = allDemoProducts.filter((product) => sameId(product.subSubcategoryId, category?._id)).length;
        categoryRows.push({
          name: category?.name || leafName,
          level: 3,
          parent: branchName,
          productCount: count,
        });
      }
      const branch = categoriesByPath.get(`${rootDefinition.name}/${branchName}`);
      const count = allDemoProducts.filter((product) => sameId(product.subcategoryId, branch?._id)).length;
      categoryRows.push({ name: branch?.name || branchName, level: 2, parent: rootDefinition.name, productCount: count });
    }
    const root = categoriesByPath.get(rootDefinition.name);
    const count = allDemoProducts.filter((product) => sameId(product.categoryId, root?._id)).length;
    categoryRows.push({ name: root?.name || rootDefinition.name, level: 1, parent: '', productCount: count });
  }

  console.log('\nCategories (new demo product counts):');
  console.table(categoryRows);
  console.log('\nDemo products in the catalog:');
  console.table(allDemoProducts.map((product) => ({
    name: product.name,
    sku: product.sku,
    categoryPath: `${product.categoryName} > ${product.subcategoryName} > ${product.subSubcategoryName}`,
    price: product.sellingPrice,
    stock: product.stock,
  })));
  console.log(`Categories inserted: ${createdCategories.length}; categories reused: ${skippedCategories.length}.`);
  if (skippedCategories.length) console.log(`Reused categories: ${skippedCategories.join('; ')}`);
  console.log(`Products in catalog: ${allDemoProducts.length}; products skipped this run: ${skippedProducts.length}.`);
  if (skippedProducts.length) console.log(`Skipped products: ${skippedProducts.join('; ')}`);
}

async function main() {
  if (unsupportedArgs.length) {
    throw new Error(`Unsupported option(s): ${unsupportedArgs.join(', ')}. Use only "insert" or "clear".`);
  }
  if (!['insert', 'clear'].includes(mode)) {
    throw new Error('Usage: npm run seed:catalog [-- insert|clear]');
  }
  const uri = new URL(env.MONGO_URI);
  const uriDatabase = decodeURIComponent(uri.pathname.replace(/^\/+/, ''));
  const expectedDatabase = uriDatabase || TARGET_DATABASE;
  if (expectedDatabase !== TARGET_DATABASE) {
    throw new Error(`Catalog seeding is authorized only for "${TARGET_DATABASE}", but MONGO_URI targets "${expectedDatabase}".`);
  }

  await mongoose.connect(env.MONGO_URI);
  const databaseName = mongoose.connection.name;
  console.log(`MongoDB database: ${databaseName}`);
  if (databaseName !== TARGET_DATABASE) {
    throw new Error(`Connected to "${databaseName}", not the confirmed "${TARGET_DATABASE}" database. No writes performed.`);
  }

  const countsBefore = await printCounts('Before');
  const wholesaler = await getWholesaler();
  console.log(`Wholesaler target: ${wholesaler.businessName} (${wholesaler.user.name})`);

  if (mode === 'clear') {
    await clearCatalog(wholesaler.user._id);
    const countsAfter = await printCounts('After clear');
    console.log(`Document deltas: ${JSON.stringify(Object.fromEntries(Object.entries(countsAfter).map(([name, count]) => [name, count - countsBefore[name]])))}`);
    return;
  }

  const { categoriesByPath, created: createdCategories, skipped: skippedCategories } =
    await createCategoryTree(wholesaler.user._id);
  const { createdProducts, skipped: skippedProducts } =
    await createProducts(wholesaler.user._id, categoriesByPath);
  await printCatalog(wholesaler.user._id, categoriesByPath, createdCategories, skippedCategories, skippedProducts);

  const countsAfter = await printCounts('After insert');
  console.log(`Document deltas: ${JSON.stringify(Object.fromEntries(Object.entries(countsAfter).map(([name, count]) => [name, count - countsBefore[name]])))}`);
  console.log(`\nDemo catalog verification: ${createdCategories.length} new categories, ${createdProducts.length} new products, all marked isDemo=true.`);
}

main()
  .catch((error) => {
    console.error(`Catalog seed failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
