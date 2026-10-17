const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const args = new Set(process.argv.slice(2));
const mode = process.argv.slice(2).find((arg) => !arg.startsWith('--')) || 'insert';
const allowedModes = new Set(['insert', 'reset', 'clear']);

if (!allowedModes.has(mode)) {
  console.error('Usage: node scripts/seed-demo.js [insert|reset|clear] [--confirm]');
  process.exit(1);
}

if (process.env.NODE_ENV === 'production' && !args.has('--confirm')) {
  console.error('Refusing to run demo seeding in production without the explicit --confirm flag.');
  process.exit(1);
}

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const models = require('../src/models');
const {
  ROLES,
  USER_STATUS,
  KYC_STATUS,
  RELATIONSHIP_STATUS,
  PRODUCT_STATUS,
  INVENTORY_TRANSACTION_TYPE,
  ORDER_STATUS,
  PAYMENT_STATUS,
  PAYMENT_METHOD,
  WALLET_TRANSACTION_TYPE,
  PAYOUT_STATUS,
  NOTIFICATION_TYPE,
  NOTIFICATION_CHANNEL,
  AUDIT_ACTION,
} = require('../src/config/constants');
const env = require('../src/config/env');
const { connectDB, disconnectDB } = require('../src/config/database');

const demoModels = [
  models.User,
  models.WholesalerProfile,
  models.RetailerProfile,
  models.WholesalerRetailerRelationship,
  models.KycApplication,
  models.KycDocument,
  models.Category,
  models.Product,
  models.Inventory,
  models.InventoryTransaction,
  models.Address,
  models.Order,
  models.Coupon,
  models.Payment,
  models.PaymentTransaction,
  models.Return,
  models.Wallet,
  models.WalletTransaction,
  models.Earning,
  models.Payout,
  models.SupportTicket,
  models.Review,
  models.Wishlist,
  models.Notification,
  models.AuditLog,
];

const wholesalersSeed = [
  { key: 'amberloom', business: 'Amber Loom Collective', owner: 'Mira Solanki', city: 'Jaipur', state: 'Rajasthan', phone: '9000000001', code: 'AMBERDEMO', status: KYC_STATUS.APPROVED },
  { key: 'orbit', business: 'Orbit Home & Tech Supply', owner: 'Ishaan Mehta', city: 'Mumbai', state: 'Maharashtra', phone: '9000000002', code: 'ORBITDEMO', status: KYC_STATUS.APPROVED },
  { key: 'evergreen', business: 'Evergreen Daily Goods', owner: 'Nila Desai', city: 'Ahmedabad', state: 'Gujarat', phone: '9000000003', code: 'EVERGREENDEMO', status: KYC_STATUS.SUBMITTED },
];

const retailerSeed = [
  { business: 'Pink City Corner Shop', name: 'Aarav Khandelwal', city: 'Jaipur', state: 'Rajasthan', wholesaler: 0 },
  { business: 'Capital Lane Market', name: 'Sana Qureshi', city: 'Delhi', state: 'Delhi', wholesaler: 1 },
  { business: 'Harbour View Stores', name: 'Devika Nair', city: 'Mumbai', state: 'Maharashtra', wholesaler: 2 },
  { business: 'Sabarmati Neighbourhood Mart', name: 'Rohan Shah', city: 'Ahmedabad', state: 'Gujarat', wholesaler: 0 },
  { business: 'Deccan Daily Bazaar', name: 'Anaya Kulkarni', city: 'Pune', state: 'Maharashtra', wholesaler: 1 },
  { business: 'Lakeview Family Store', name: 'Kabir Rathore', city: 'Udaipur', state: 'Rajasthan', wholesaler: 2 },
  { business: 'Bengaluru Green Basket', name: 'Tara Menon', city: 'Bengaluru', state: 'Karnataka', wholesaler: 0 },
  { business: 'Chennai Marina Retail', name: 'Arjun Iyer', city: 'Chennai', state: 'Tamil Nadu', wholesaler: 1 },
  { business: 'Surat Textile & Home', name: 'Meera Trivedi', city: 'Surat', state: 'Gujarat', wholesaler: 2 },
  { business: 'Noida Community Store', name: 'Vivaan Batra', city: 'Noida', state: 'Uttar Pradesh', wholesaler: 0 },
];

const productDefinitions = [
  { family: 'Clothing', category: 'Saree', names: ['Indigo Block Print Saree', 'Festive Woven Cotton Saree', 'Everyday Floral Saree', 'Soft Linen Blend Saree', 'Classic Border Saree'], brand: 'Amber Loom', cost: 620, price: 890, hsn: '620442', rate: 5 },
  { family: 'Clothing', category: 'Kurti', names: ['Jaipur Buti Cotton Kurti', 'Everyday Straight Kurti', 'Printed Rayon Kurti', 'Embroidered Festive Kurti'], brand: 'Amber Loom', cost: 330, price: 520, hsn: '620640', rate: 5 },
  { family: 'Clothing', category: 'Shirts', names: ['Oxford Cotton Casual Shirt', 'Checked Workday Shirt'], brand: 'Northline', cost: 390, price: 620, hsn: '620520', rate: 5 },
  { family: 'Electronics', category: 'Smartphones', names: ['Nova 5G Smartphone 128GB', 'Orbit Lite Smartphone 64GB', 'Aster Pro Smartphone 256GB'], brand: 'Orbit Devices', cost: 9200, price: 11990, hsn: '851713', rate: 18 },
  { family: 'Electronics', category: 'Kitchen Appliances', names: ['Compact Mixer Grinder 750W', 'Digital Electric Kettle 1.5L'], brand: 'Orbit Home', cost: 1350, price: 1890, hsn: '850940', rate: 18 },
  { family: 'Electronics', category: 'Audio', names: ['Wireless Earbuds with Case', 'Portable Bluetooth Speaker'], brand: 'Orbit Devices', cost: 780, price: 1190, hsn: '851821', rate: 18 },
  { family: 'Skincare', category: 'Face Wash', names: ['Aloe Calm Face Wash 100ml', 'Citrus Daily Cleanser 150ml'], brand: 'Evergreen Botanics', cost: 95, price: 159, hsn: '330499', rate: 18 },
  { family: 'Skincare', category: 'Shampoo', names: ['Herbal Balance Shampoo 250ml', 'Nourish & Shine Shampoo 200ml'], brand: 'Evergreen Botanics', cost: 120, price: 199, hsn: '330510', rate: 18 },
  { family: 'Grocery', category: 'Rice', names: ['Aromatic Basmati Rice 5kg', 'Everyday Kolam Rice 5kg'], brand: 'Evergreen Pantry', cost: 410, price: 520, hsn: '100630', rate: 5 },
  { family: 'Grocery', category: 'Biscuits', names: ['Butter Crunch Biscuits 12-pack', 'Cardamom Tea Biscuits 10-pack'], brand: 'Evergreen Pantry', cost: 105, price: 149, hsn: '190531', rate: 18 },
];

const categoryTree = {
  Clothing: {
    Women: ['Saree', 'Kurti', 'Lehenga'],
    Men: ['Shirts', 'T-Shirts'],
    Kids: ['Kids Wear'],
  },
  Electronics: {
    Mobiles: ['Smartphones', 'Feature Phones'],
    Appliances: ['Kitchen Appliances', 'Home Appliances'],
    Audio: ['Audio'],
  },
  Skincare: {
    Face: ['Face Wash', 'Moisturizer'],
    Hair: ['Shampoo', 'Conditioner'],
  },
  Grocery: {
    Staples: ['Rice', 'Pulses', 'Spices'],
    Snacks: ['Biscuits', 'Namkeen'],
  },
};

const imageUrls = [
  'https://images.unsplash.com/photo-1591047139829-d91AECb6caea?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1550009158-9ebf69173e03?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?auto=format&fit=crop&w=900&q=80',
];

const cities = [
  ['Jaipur', 'Rajasthan'], ['Delhi', 'Delhi'], ['Mumbai', 'Maharashtra'],
  ['Ahmedabad', 'Gujarat'], ['Pune', 'Maharashtra'], ['Udaipur', 'Rajasthan'],
  ['Bengaluru', 'Karnataka'], ['Chennai', 'Tamil Nadu'], ['Surat', 'Gujarat'],
  ['Noida', 'Uttar Pradesh'],
];

const roundMoney = (number) => Math.round((number + Number.EPSILON) * 100) / 100;
const daysBefore = (date, days) => new Date(date.getTime() - days * 24 * 60 * 60 * 1000);
const daysAfter = (date, days) => new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
const safeKey = (value) => String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-');

async function upsertDemo(Model, filter, values) {
  let document = await Model.findOne(filter);
  if (document && !document.isDemo) {
    throw new Error(`${Model.modelName} collision: ${JSON.stringify(filter)} matches a non-demo record; no record was changed.`);
  }
  if (!document) document = new Model();
  document.set({ ...values, isDemo: true });
  await document.save();
  return document;
}

async function clearDemoData() {
  for (const Model of [...demoModels].reverse()) {
    await Model.deleteMany({ isDemo: true });
  }
}

async function createUsers(passwordHash) {
  const superAdmin = await models.User.findOne({
    email: String(env.SUPER_ADMIN_EMAIL).toLowerCase(),
    role: ROLES.SUPER_ADMIN,
    isDeleted: { $ne: true },
  }).select('+passwordHash');
  if (!superAdmin) {
    throw new Error(`Configured Super Admin ${env.SUPER_ADMIN_EMAIL} was not found. Create/configure that account first; the demo seed will not create one.`);
  }

  const wholesalers = [];
  for (const seed of wholesalersSeed) {
    const email = `${seed.key}.owner@example.com`;
    const user = await upsertDemo(models.User, { email }, {
      name: seed.owner,
      email,
      phone: seed.phone,
      passwordHash,
      role: ROLES.WHOLESALER,
      status: USER_STATUS.ACTIVE,
      emailVerified: true,
      phoneVerified: true,
      isDeleted: false,
    });
    wholesalers.push({ ...seed, user });
  }

  const retailers = [];
  for (const [index, seed] of retailerSeed.entries()) {
    const email = `retailer${String(index + 1).padStart(2, '0')}@example.com`;
    const user = await upsertDemo(models.User, { email }, {
      name: seed.name,
      email,
      phone: `90000000${String(11 + index).padStart(2, '0')}`,
      passwordHash,
      role: ROLES.RETAILER,
      status: index === 9 ? USER_STATUS.SUSPENDED : USER_STATUS.ACTIVE,
      emailVerified: true,
      phoneVerified: true,
      isDeleted: false,
    });
    retailers.push({ ...seed, user });
  }

  return { superAdmin, wholesalers, retailers };
}

async function createProfiles(accounts, now) {
  const { superAdmin, wholesalers, retailers } = accounts;
  for (const [index, entry] of wholesalers.entries()) {
    const businessAddress = {
      street: `${14 + index} Market Road`,
      city: entry.city,
      state: entry.state,
      pincode: `30200${index + 1}`,
      country: 'India',
    };
    const wallet = await upsertDemo(models.Wallet, { ownerId: entry.user._id }, {
      ownerId: entry.user._id,
      ownerType: 'WHOLESALER',
      availableBalance: 0,
      pendingBalance: 0,
      lockedBalance: 0,
      currency: 'INR',
      status: 'ACTIVE',
    });
    const profile = await upsertDemo(models.WholesalerProfile, { userId: entry.user._id }, {
      userId: entry.user._id,
      businessName: entry.business,
      businessLogoUrl: imageUrls[index],
      retailerReferralCode: entry.code,
      retailerSignupsEnabled: true,
      description: `Fictional wholesale supplier based in ${entry.city}, serving independent retailers.`,
      businessType: 'Partnership',
      gstin: `DEMO-GST-${entry.key.toUpperCase()}`,
      hasGst: true,
      gstStatus: 'REGISTERED',
      pan: `DEMO-PAN-${entry.key.toUpperCase()}`,
      address: businessAddress,
      pickupAddress: { ...businessAddress, sameAsBusinessAddress: true },
      registrationDetails: { demoRegistration: true },
      bankDetails: {
        accountHolderName: entry.business,
        accountNumber: `DEMO${String(index + 1).padStart(4, '0')}`,
        ifscCode: 'DEMO0000001',
        bankName: 'Example Cooperative Bank',
        branch: entry.city,
        isVerified: false,
      },
      kycStatus: entry.status,
      commissionRate: 5,
      minOrderValue: 500,
      creditPolicy: {
        creditEnabled: true,
        allowCOD: true,
        defaultCreditLimit: 150000,
        creditPeriodDays: 30,
        lateFeePercent: 2,
        minOrderForCredit: 1000,
      },
      walletId: wallet._id,
      isVerified: entry.status === KYC_STATUS.APPROVED,
      isDeleted: false,
    });
    entry.profile = profile;
    entry.wallet = wallet;
    entry.address = businessAddress;

    await models.User.updateOne(
      { _id: entry.user._id, isDemo: true },
      { $set: { wholesalerProfile: profile._id } }
    );

    const application = await upsertDemo(models.KycApplication, { wholesalerId: entry.user._id }, {
      wholesalerId: entry.user._id,
      businessName: entry.business,
      ownerName: entry.owner,
      businessType: 'Partnership',
      pan: `DEMO-PAN-${entry.key.toUpperCase()}`,
      hasGst: true,
      gstin: `DEMO-GST-${entry.key.toUpperCase()}`,
      registeredAddress: businessAddress,
      bankDetails: {
        accountHolderName: entry.business,
        accountNumber: `DEMO${String(index + 1).padStart(4, '0')}`,
        ifscCode: 'DEMO0000001',
        bankName: 'Example Cooperative Bank',
        branch: entry.city,
      },
      documents: [],
      status: entry.status,
      submittedAt: daysBefore(now, 14 + index),
      reviewedBy: entry.status === KYC_STATUS.APPROVED ? superAdmin._id : undefined,
      reviewedAt: entry.status === KYC_STATUS.APPROVED ? daysBefore(now, 8 + index) : undefined,
      history: [{
        fromStatus: KYC_STATUS.DRAFT,
        toStatus: entry.status,
        reason: 'Demo KYC application seeded for presentation.',
        changedBy: superAdmin._id,
        changedAt: daysBefore(now, 14 + index),
      }],
    });
    profile.kycApplicationId = application._id;
    await profile.save();
  }

  for (const [index, retailer] of retailers.entries()) {
    const supplier = wholesalers[retailer.wholesaler];
    const [city, state] = [retailer.city, retailer.state];
    const address = {
      street: `${20 + index} Sample Bazaar Street`,
      city,
      state,
      pincode: `30${String(2000 + index).slice(-4)}`,
      country: 'India',
    };
    const profile = await upsertDemo(models.RetailerProfile, { userId: retailer.user._id }, {
      userId: retailer.user._id,
      businessName: retailer.business,
      ownerName: retailer.name,
      category: 'General Retail',
      businessType: 'Independent retailer',
      gstin: `DEMO-RETAIL-${String(index + 1).padStart(2, '0')}`,
      gstStatus: 'REGISTERED',
      address,
      assignedWholesalerId: supplier.user._id,
      wholesalerId: supplier.user._id,
      createdByWholesalerId: supplier.user._id,
      referralCodeUsed: supplier.code,
      profileComplete: true,
      totalPurchaseAmount: 0,
      totalOrdersCount: 0,
      isDeleted: false,
    });
    retailer.profile = profile;
    retailer.address = address;
    retailer.wholesalerAccount = supplier;

    await models.User.updateOne(
      { _id: retailer.user._id, isDemo: true },
      { $set: { retailerProfile: profile._id } }
    );
    const savedAddress = await upsertDemo(models.Address, { userId: retailer.user._id, isDefault: true }, {
      userId: retailer.user._id,
      type: 'BOTH',
      recipientName: retailer.name,
      phone: retailer.user.phone,
      businessName: retailer.business,
      ...address,
      isDefault: true,
    });
    retailer.savedAddress = savedAddress;

    const relationship = await upsertDemo(models.WholesalerRetailerRelationship, {
      retailerId: retailer.user._id,
      wholesalerId: supplier.user._id,
    }, {
      wholesalerId: supplier.user._id,
      retailerId: retailer.user._id,
      referralCode: supplier.code,
      status: index === 9 ? RELATIONSHIP_STATUS.SUSPENDED : RELATIONSHIP_STATUS.ACTIVE,
      joinedAt: daysBefore(now, 80 - index * 3),
      approvedAt: daysBefore(now, 78 - index * 3),
      notes: 'Fictional demo referral relationship.',
      customCreditLimit: 150000,
      currentOutstandingAmount: 0,
    });
    retailer.relationship = relationship;
    profile.activeRelationshipId = relationship._id;
    await profile.save();
  }
}

async function createCategories(wholesalers) {
  for (const supplier of wholesalers) {
    supplier.categoryNodes = {};
    for (const [rootName, branches] of Object.entries(categoryTree)) {
      const root = await upsertDemo(models.Category, {
        slug: `demo-${supplier.key}-${safeKey(rootName)}`,
      }, {
        name: rootName,
        slug: `demo-${supplier.key}-${safeKey(rootName)}`,
        description: `${rootName} catalog for ${supplier.business}.`,
        imageUrl: imageUrls[Object.keys(categoryTree).indexOf(rootName) % imageUrls.length],
        parentId: null,
        parentCategoryId: null,
        level: 1,
        wholesalerId: supplier.user._id,
        sortOrder: Object.keys(categoryTree).indexOf(rootName),
        isActive: true,
        isDeleted: false,
      });
      for (const [branchName, leaves] of Object.entries(branches)) {
        const branch = await upsertDemo(models.Category, {
          slug: `demo-${supplier.key}-${safeKey(rootName)}-${safeKey(branchName)}`,
        }, {
          name: branchName,
          slug: `demo-${supplier.key}-${safeKey(rootName)}-${safeKey(branchName)}`,
          parentId: root._id,
          parentCategoryId: root._id,
          level: 2,
          wholesalerId: supplier.user._id,
          isActive: true,
          isDeleted: false,
        });
        for (const leafName of leaves) {
          const leaf = await upsertDemo(models.Category, {
            slug: `demo-${supplier.key}-${safeKey(rootName)}-${safeKey(branchName)}-${safeKey(leafName)}`,
          }, {
            name: leafName,
            slug: `demo-${supplier.key}-${safeKey(rootName)}-${safeKey(branchName)}-${safeKey(leafName)}`,
            parentId: branch._id,
            parentCategoryId: branch._id,
            level: 3,
            wholesalerId: supplier.user._id,
            isActive: true,
            isDeleted: false,
          });
          supplier.categoryNodes[leafName] = { root, branch, leaf };
        }
      }
    }
  }
}

function categoryAttributes(definition, index, now) {
  if (definition.family === 'Clothing') {
    return {
      fabric: index % 2 ? 'Cotton blend' : 'Rayon',
      fit: 'Regular Fit',
      pattern: index % 2 ? 'Printed' : 'Solid',
      occasion: 'Casual',
      gender: definition.category === 'Shirts' ? 'Men' : 'Women',
      careInstructions: 'Gentle machine wash; dry in shade.',
    };
  }
  if (definition.family === 'Electronics') {
    return {
      modelNumber: `DEMO-${String(index + 1).padStart(3, '0')}`,
      variant: 'Standard retail pack',
      warrantyPeriod: '1 Year Manufacturer Warranty',
      includedAccessories: 'Standard charging cable and guide',
    };
  }
  if (definition.family === 'Skincare') {
    return {
      volumeWeight: '100 ml',
      suitableFor: 'All Skin Types',
      keyIngredients: 'Aloe vera and botanical extracts',
      expiryDate: daysAfter(now, 540).toISOString().slice(0, 10),
    };
  }
  return {
    netQuantity: '1 retail case',
    expiryDate: daysAfter(now, 365).toISOString().slice(0, 10),
    vegNonVeg: 'Veg',
    fssaiLicense: 'DEMO-FSSAI-NOT-A-LICENSE',
    storageInstructions: 'Store in a cool, dry place.',
  };
}

async function createProducts(wholesalers, now) {
  for (const supplier of wholesalers) {
    supplier.products = [];
    for (let index = 0; index < 15; index += 1) {
      const definition = productDefinitions[index % productDefinitions.length];
      const chosenCategory = supplier.categoryNodes[definition.category];
      const colorNames = ['Blue', 'White', 'Black'];
      const image = imageUrls[(index + wholesalers.indexOf(supplier)) % imageUrls.length];
      const sizes = definition.family === 'Clothing' ? ['S', 'M', 'L', 'XL'] : [];
      const variants = definition.family === 'Clothing'
        ? colorNames.map((color, colorIndex) => ({
          color,
          sku: `${supplier.key}-${String(index + 1).padStart(2, '0')}-${color.toUpperCase()}`,
          images: colorIndex === 0 ? [{ url: image, publicId: '' }] : [],
        }))
        : [];
      const sku = `DEMO-${supplier.key.toUpperCase()}-${String(index + 1).padStart(3, '0')}`;
      const product = await upsertDemo(models.Product, {
        wholesalerId: supplier.user._id,
        sku,
      }, {
        wholesalerId: supplier.user._id,
        name: `${definition.names[index % definition.names.length]} ${supplier.key === 'amberloom' ? 'Select' : supplier.key === 'orbit' ? 'Trade Pack' : 'Value Pack'}`,
        productName: `${definition.names[index % definition.names.length]} ${supplier.key === 'amberloom' ? 'Select' : supplier.key === 'orbit' ? 'Trade Pack' : 'Value Pack'}`,
        title: `${definition.names[index % definition.names.length]} ${supplier.key === 'amberloom' ? 'Select' : supplier.key === 'orbit' ? 'Trade Pack' : 'Value Pack'}`,
        slug: `demo-${supplier.key}-${String(index + 1).padStart(3, '0')}`,
        sku,
        brand: definition.brand,
        description: `Quality-checked ${definition.category.toLowerCase()} wholesale stock for independent retailers. Fictional demo listing.`,
        category: chosenCategory.root._id,
        categoryId: chosenCategory.root._id,
        subCategory: chosenCategory.branch._id,
        subcategoryId: chosenCategory.branch._id,
        subSubcategoryId: chosenCategory.leaf._id,
        categoryName: definition.family,
        subcategoryName: chosenCategory.branch.name,
        subSubcategoryName: chosenCategory.leaf.name,
        images: [{ url: image, publicId: '' }],
        imageUrl: image,
        mrp: roundMoney(definition.price * 1.38),
        costPrice: definition.cost,
        wholesalePrice: definition.price,
        sellingPrice: definition.price,
        retailerPrice: definition.price,
        basePrice: definition.price,
        moq: 5,
        minOrderQty: 5,
        stock: 0,
        stockQuantity: 0,
        quantity: 0,
        unit: definition.family === 'Grocery' ? 'case' : 'piece',
        pricingTiers: [
          { minQty: 10, maxQty: 24, pricePerUnit: roundMoney(definition.price * 0.97) },
          { minQty: 25, pricePerUnit: roundMoney(definition.price * 0.93) },
        ],
        bulkPricingTiers: [
          { minQty: 10, maxQty: 24, pricePerUnit: roundMoney(definition.price * 0.97) },
          { minQty: 25, pricePerUnit: roundMoney(definition.price * 0.93) },
        ],
        gst: definition.rate,
        gstPercent: definition.rate,
        hsn: definition.hsn,
        hsnCode: definition.hsn,
        cgst: definition.rate / 2,
        sgst: definition.rate / 2,
        igst: definition.rate,
        priceIncludesTax: false,
        taxConfigured: true,
        sizes,
        colors: definition.family === 'Clothing' ? colorNames : [],
        colorVariants: variants,
        sizeChart: definition.family === 'Clothing'
          ? { unit: 'cm', rows: [{ size: 'S', chest: 90, length: 66 }, { size: 'M', chest: 96, length: 68 }, { size: 'L', chest: 102, length: 70 }, { size: 'XL', chest: 108, length: 72 }] }
          : null,
        categoryAttributes: categoryAttributes(definition, index, now),
        lowStockThreshold: 10,
        countryOfOrigin: 'India',
        status: PRODUCT_STATUS.ACTIVE,
        isDeleted: false,
      });
      supplier.products.push(product);
    }
  }
}

async function createCoupons(now) {
  const definitions = [
    { code: 'DIWALI-DEMO', title: 'Diwali Special', discountType: 'PERCENTAGE', discountValue: 15, maxDiscountCap: 750, minOrderValue: 2500, active: true, fromDays: 20, untilDays: 45 },
    { code: 'FESTIVE10-DEMO', title: 'Festive 10%', discountType: 'PERCENT', discountValue: 10, maxDiscountCap: 500, minOrderValue: 1200, active: true, fromDays: 15, untilDays: 60 },
    { code: 'NEWRETAILER-DEMO', title: 'New Retailer', discountType: 'FLAT', discountValue: 250, maxDiscountCap: 250, minOrderValue: 2000, active: true, fromDays: 10, untilDays: 30 },
    { code: 'BULKBUYER-DEMO', title: 'Bulk Buyer', discountType: 'PERCENTAGE', discountValue: 8, maxDiscountCap: 1000, minOrderValue: 5000, active: false, fromDays: 150, untilDays: -60 },
  ];
  const coupons = [];
  for (const definition of definitions) {
    coupons.push(await upsertDemo(models.Coupon, { code: definition.code, wholesalerId: null }, {
      wholesalerId: null,
      code: definition.code,
      title: definition.title,
      description: `Fictional ${definition.title.toLowerCase()} marketplace promotion.`,
      discountType: definition.discountType,
      discountValue: definition.discountValue,
      maxDiscountCap: definition.maxDiscountCap,
      minOrderValue: definition.minOrderValue,
      validFrom: daysBefore(now, definition.fromDays),
      validUntil: daysAfter(now, definition.untilDays),
      usageLimit: 500,
      usageCount: 0,
      perRetailerLimit: 2,
      perRetailerUsage: [],
      applicableFor: 'RETAILER_ORDER',
      isActive: definition.active,
      isDeleted: false,
    }));
  }
  return coupons;
}

function couponDiscount(coupon, subtotal) {
  if (subtotal < coupon.minOrderValue) return 0;
  const discount = ['PERCENT', 'PERCENTAGE'].includes(coupon.discountType)
    ? subtotal * coupon.discountValue / 100
    : coupon.discountValue;
  return roundMoney(coupon.maxDiscountCap ? Math.min(discount, coupon.maxDiscountCap) : discount);
}

function couponForOrder(index, coupons) {
  if (index % 13 === 2) return coupons[1];
  if (index % 17 === 4) return coupons[2];
  if (index % 19 === 7) return coupons[0];
  return null;
}

function makeOrderDate(now, index, total) {
  const progress = Math.pow((index + 1) / total, 1.65);
  return daysBefore(now, Math.max(2, Math.round(90 - progress * 88)));
}

function orderStatusFor(index) {
  if (index < 5) return ORDER_STATUS.CANCELLED;
  if (index < 40) return ORDER_STATUS.DELIVERED;
  if (index < 48) return ORDER_STATUS.SHIPPED;
  if (index < 54) return ORDER_STATUS.CONFIRMED;
  return ORDER_STATUS.PENDING;
}

function paymentMethodFor(index, creditOrders) {
  if (creditOrders.has(index)) return PAYMENT_METHOD.CREDIT;
  return [PAYMENT_METHOD.COD, PAYMENT_METHOD.UPI, PAYMENT_METHOD.CARD][index % 3];
}

async function createOrders(accounts, coupons, now) {
  const { wholesalers, retailers } = accounts;
  const creditOrderIndexes = new Set([8, 50, 54, 59]);
  const orders = [];
  const allocations = new Map();

  for (let index = 0; index < 60; index += 1) {
    const retailer = retailers[index % retailers.length];
    const supplier = wholesalers[retailer.wholesaler];
    const availableProducts = supplier.products.slice(0, 12);
    const products = [
      availableProducts[(index * 3 + 1) % availableProducts.length],
      availableProducts[(index * 5 + 6) % availableProducts.length],
    ];
    const quantity = 5 + (index % 3);
    const sameState = retailer.state === supplier.state;
    const orderItems = products.map((product, itemIndex) => {
      const itemQuantity = quantity + itemIndex;
      const subtotal = roundMoney(product.wholesalePrice * itemQuantity);
      const taxRate = sameState ? Number(product.cgst) + Number(product.sgst) : Number(product.igst);
      const taxAmount = roundMoney(subtotal * taxRate / 100);
      return {
        product,
        quantity: itemQuantity,
        subtotal,
        taxRate,
        taxAmount,
        total: roundMoney(subtotal + taxAmount),
      };
    });
    const subtotal = roundMoney(orderItems.reduce((sum, item) => sum + item.subtotal, 0));
    const tax = roundMoney(orderItems.reduce((sum, item) => sum + item.taxAmount, 0));
      const coupon = couponForOrder(index, coupons);
    const discount = coupon && coupon.isActive ? couponDiscount(coupon, subtotal) : 0;
    const grandTotal = roundMoney(subtotal + tax - discount);
    const createdAt = makeOrderDate(now, index, 60);
    const status = orderStatusFor(index);
    const isCreditOrder = creditOrderIndexes.has(index);
    const isOverdue = index === 8;
    const creditStatus = isCreditOrder ? (isOverdue ? 'OVERDUE' : 'PENDING') : 'NOT_APPLICABLE';
    const paymentMethod = paymentMethodFor(index, creditOrderIndexes);
    const paymentStatus = status === ORDER_STATUS.CANCELLED
      ? PAYMENT_STATUS.REFUNDED
      : (isCreditOrder
        ? (isOverdue ? PAYMENT_STATUS.OVERDUE : PAYMENT_STATUS.PENDING)
        : (paymentMethod === PAYMENT_METHOD.COD && status !== ORDER_STATUS.DELIVERED
          ? PAYMENT_STATUS.PENDING
          : PAYMENT_STATUS.PAID));
    const orderNumber = `DEMO-ORD-${String(index + 1).padStart(4, '0')}`;
    const updatedAt = daysAfter(createdAt, status === ORDER_STATUS.PENDING ? 0 : Math.min(2, index % 3));
    const items = orderItems.map(({ product, quantity: itemQuantity, subtotal: itemSubtotal, taxRate, taxAmount, total }) => ({
      productId: product._id,
      name: product.name,
      sku: product.sku,
      imageUrl: product.imageUrl,
      quantity: itemQuantity,
      pricePerUnit: product.wholesalePrice,
      unitPrice: product.wholesalePrice,
      categoryName: product.categoryName,
      subtotal: itemSubtotal,
      costPriceAtOrder: product.costPrice,
      gstRate: taxRate,
      gstAmount: taxAmount,
      hsnCode: product.hsnCode,
      cgst: sameState ? product.cgst : null,
      sgst: sameState ? product.sgst : null,
      igst: sameState ? null : product.igst,
      priceIncludesTax: false,
      total,
    }));
    const timeline = [
      { status: ORDER_STATUS.PENDING, timestamp: createdAt, note: 'Demo order placed.', updatedBy: retailer.user._id },
    ];
    if (status !== ORDER_STATUS.PENDING) {
      timeline.push({
        status,
        timestamp: updatedAt,
        note: status === ORDER_STATUS.CANCELLED ? 'Cancelled by retailer in demo data.' : 'Status updated for demo history.',
        updatedBy: status === ORDER_STATUS.CANCELLED ? retailer.user._id : supplier.user._id,
      });
    }

    const order = await upsertDemo(models.Order, { orderNumber }, {
      orderNumber,
      retailerId: retailer.user._id,
      wholesalerId: supplier.user._id,
      items,
      subtotal,
      discount,
      couponCode: coupon && discount > 0 ? coupon.code : '',
      couponId: coupon && discount > 0 ? coupon._id : null,
      tax,
      shipping: 0,
      grandTotal,
      totalAmount: grandTotal,
      orderStatus: status,
      paymentStatus,
      paymentMethod,
      isCreditOrder,
      creditDueDate: isCreditOrder ? daysAfter(createdAt, 30) : undefined,
      creditPeriodDays: isCreditOrder ? 30 : 0,
      creditPaymentStatus: creditStatus,
      billingAddress: { ...retailer.address, recipientName: retailer.name },
      shippingAddress: { ...retailer.address, recipientName: retailer.name },
      statusTimeline: timeline,
      cancellationReason: status === ORDER_STATUS.CANCELLED ? 'Retailer changed stock plans' : '',
      cancellationNote: status === ORDER_STATUS.CANCELLED ? 'Demo cancellation record.' : '',
      notes: 'Fictional demo order.',
      createdAt,
      updatedAt,
    });
    orders.push({ order, items: orderItems, retailer, supplier, status, createdAt, updatedAt, paymentStatus, paymentMethod, isCreditOrder, creditStatus });

    for (const item of orderItems) {
      const previous = allocations.get(String(item.product._id)) || { product: item.product, active: 0, cancelled: 0, delivered: 0, reserved: 0 };
      if (status !== ORDER_STATUS.CANCELLED) previous.active += item.quantity;
      if (status === ORDER_STATUS.CANCELLED) previous.cancelled += item.quantity;
      if (status === ORDER_STATUS.DELIVERED) previous.delivered += item.quantity;
      if (![ORDER_STATUS.CANCELLED, ORDER_STATUS.DELIVERED].includes(status)) previous.reserved += item.quantity;
      allocations.set(String(item.product._id), previous);
    }
  }

  const outstandingByRelationship = new Map();
  for (const orderEntry of orders) {
    if (orderEntry.isCreditOrder && orderEntry.creditStatus !== 'PAID') {
      const relationshipId = String(orderEntry.retailer.relationship._id);
      outstandingByRelationship.set(
        relationshipId,
        roundMoney((outstandingByRelationship.get(relationshipId) || 0) + orderEntry.order.grandTotal)
      );
    }
  }
  for (const retailer of retailers) {
    retailer.relationship.currentOutstandingAmount =
      outstandingByRelationship.get(String(retailer.relationship._id)) || 0;
    await retailer.relationship.save();
  }

  return { orders, allocations };
}

async function createInventory(wholesalers, allocations, orders, now) {
  const transactionDocs = [];
  for (const supplier of wholesalers) {
    for (const [index, product] of supplier.products.entries()) {
      const allocation = allocations.get(String(product._id)) || { active: 0, cancelled: 0, delivered: 0, reserved: 0 };
      const targetStock = index === 14 ? 0 : index >= 12 ? [4, 7][index - 12] : 45;
      const initialStock = targetStock + allocation.active;
      const inventory = await upsertDemo(models.Inventory, { productId: product._id }, {
        productId: product._id,
        wholesalerId: supplier.user._id,
        available: initialStock,
        reserved: 0,
        sold: 0,
        damaged: 0,
        returned: 0,
        reorderLevel: 10,
      });
      await models.Product.updateOne(
        { _id: product._id, isDemo: true },
        {
          $set: {
            stock: targetStock,
            stockQuantity: targetStock,
            quantity: targetStock,
            status: targetStock === 0 ? PRODUCT_STATUS.OUT_OF_STOCK : PRODUCT_STATUS.ACTIVE,
          },
        }
      );
      product.stock = targetStock;
      product.status = targetStock === 0 ? PRODUCT_STATUS.OUT_OF_STOCK : PRODUCT_STATUS.ACTIVE;
      transactionDocs.push({
        inventoryId: inventory._id,
        productId: product._id,
        wholesalerId: supplier.user._id,
        type: INVENTORY_TRANSACTION_TYPE.RECEIVE,
        quantity: initialStock,
        previousAvailable: 0,
        newAvailable: initialStock,
        referenceType: 'RESTOCK',
        referenceId: `DEMO-RESTOCK-${product.sku}`,
        performedBy: supplier.user._id,
        notes: 'Initial demo stock.',
        createdAt: daysBefore(now, 91),
      });
    }
  }

  const inventoryByProduct = new Map();
  for (const inventory of await models.Inventory.find({ isDemo: true })) {
    inventoryByProduct.set(String(inventory.productId), inventory);
  }
  for (const entry of orders) {
    for (const item of entry.items) {
      const inventory = inventoryByProduct.get(String(item.product._id));
      const before = inventory.available;
      inventory.available -= item.quantity;
      inventory.reserved += item.quantity;
      if (entry.status === ORDER_STATUS.CANCELLED) {
        const afterReserve = inventory.available;
        inventory.available += item.quantity;
        inventory.reserved -= item.quantity;
        transactionDocs.push({
          inventoryId: inventory._id,
          productId: item.product._id,
          wholesalerId: entry.supplier.user._id,
          type: INVENTORY_TRANSACTION_TYPE.RESERVE,
          quantity: item.quantity,
          previousAvailable: before,
          newAvailable: afterReserve,
          referenceType: 'ORDER',
          referenceId: entry.order.orderNumber,
          performedBy: entry.retailer.user._id,
          notes: `Reserved for ${entry.order.orderNumber}, then released after cancellation.`,
          createdAt: entry.createdAt,
        });
        transactionDocs.push({
          inventoryId: inventory._id,
          productId: item.product._id,
          wholesalerId: entry.supplier.user._id,
          type: INVENTORY_TRANSACTION_TYPE.RELEASE,
          quantity: item.quantity,
          previousAvailable: afterReserve,
          newAvailable: inventory.available,
          referenceType: 'CANCELLATION',
          referenceId: entry.order.orderNumber,
          performedBy: entry.retailer.user._id,
          notes: `Released after cancellation of ${entry.order.orderNumber}.`,
          createdAt: entry.updatedAt,
        });
      } else {
        transactionDocs.push({
          inventoryId: inventory._id,
          productId: item.product._id,
          wholesalerId: entry.supplier.user._id,
          type: INVENTORY_TRANSACTION_TYPE.RESERVE,
          quantity: item.quantity,
          previousAvailable: before,
          newAvailable: inventory.available,
          referenceType: 'ORDER',
          referenceId: entry.order.orderNumber,
          performedBy: entry.retailer.user._id,
          notes: `Reserved for ${entry.order.orderNumber}.`,
          createdAt: entry.createdAt,
        });
        if (entry.status === ORDER_STATUS.DELIVERED) {
          inventory.reserved -= item.quantity;
          inventory.sold += item.quantity;
          transactionDocs.push({
            inventoryId: inventory._id,
            productId: item.product._id,
            wholesalerId: entry.supplier.user._id,
            type: INVENTORY_TRANSACTION_TYPE.SALE,
            quantity: item.quantity,
            previousAvailable: inventory.available,
            newAvailable: inventory.available,
            referenceType: 'SALE',
            referenceId: entry.order.orderNumber,
            performedBy: entry.supplier.user._id,
            notes: `Delivered under ${entry.order.orderNumber}.`,
            createdAt: entry.updatedAt,
          });
        }
      }
      if (inventory.available < 0 || inventory.reserved < 0) {
        throw new Error(`Inventory ledger went negative for ${item.product.sku}.`);
      }
    }
  }

  for (const inventory of inventoryByProduct.values()) await inventory.save();
  await models.InventoryTransaction.deleteMany({ isDemo: true });
  for (const record of transactionDocs.sort((left, right) => left.createdAt - right.createdAt)) {
    await models.InventoryTransaction.create({ ...record, isDemo: true });
  }
}

async function createFinancialRecords(accounts, orderEntries, now) {
  const { superAdmin, wholesalers } = accounts;
  const walletTransactions = [];
  const earningsByWholesaler = new Map(wholesalers.map((supplier) => [String(supplier.user._id), { settled: 0, pending: 0 }]));

  for (const entry of orderEntries) {
    const { order, supplier, status, paymentStatus, paymentMethod } = entry;
    const payment = await upsertDemo(models.Payment, { orderId: order._id }, {
      orderId: order._id,
      retailerId: entry.retailer.user._id,
      wholesalerId: supplier.user._id,
      amount: order.grandTotal,
      currency: 'INR',
      status: paymentStatus,
      paymentMethod,
      transactionReference: `DEMO-PAY-${order.orderNumber}`,
      gatewayResponse: { demo: true },
      paidAt: paymentStatus === PAYMENT_STATUS.PAID ? entry.updatedAt : undefined,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    });

    const cancelled = status === ORDER_STATUS.CANCELLED;
    const paid = paymentStatus === PAYMENT_STATUS.PAID;
    const commission = roundMoney(order.grandTotal * supplier.profile.commissionRate / 100);
    const wholesalerAmount = roundMoney(order.grandTotal - commission);
    const settled = paid && status === ORDER_STATUS.DELIVERED;
    await upsertDemo(models.Earning, { orderId: order._id }, {
      orderId: order._id,
      wholesalerId: supplier.user._id,
      grossAmount: order.grandTotal,
      platformCommissionRate: supplier.profile.commissionRate,
      platformCommission: commission,
      tax: order.tax,
      refundAmount: cancelled ? order.grandTotal : 0,
      wholesalerAmount: cancelled ? 0 : wholesalerAmount,
      status: cancelled ? 'REFUNDED' : settled ? 'SETTLED' : 'PENDING',
      settledAt: settled ? entry.updatedAt : undefined,
    });
    const ledger = earningsByWholesaler.get(String(supplier.user._id));
    if (!cancelled) {
      if (settled) ledger.settled = roundMoney(ledger.settled + wholesalerAmount);
      else ledger.pending = roundMoney(ledger.pending + wholesalerAmount);
    }
  }

  for (const [index, supplier] of wholesalers.entries()) {
    const ledger = earningsByWholesaler.get(String(supplier.user._id));
    const paidPayout = index === 0 ? 1000 : index === 1 ? 600 : 0;
    const requestedPayout = index === 1 ? 400 : index === 2 ? 500 : 0;
    const available = Math.max(0, roundMoney(ledger.settled - paidPayout - requestedPayout));
    const wallet = await upsertDemo(models.Wallet, { ownerId: supplier.user._id }, {
      ownerId: supplier.user._id,
      ownerType: 'WHOLESALER',
      availableBalance: available,
      pendingBalance: ledger.pending,
      lockedBalance: requestedPayout,
      currency: 'INR',
      status: 'ACTIVE',
    });
    supplier.wallet = wallet;
    let balance = 0;
    const settledOrders = orderEntries.filter((entry) => entry.supplier.user.id === supplier.user.id
      && entry.paymentStatus === PAYMENT_STATUS.PAID
      && entry.status === ORDER_STATUS.DELIVERED);
    for (const entry of settledOrders) {
      const amount = roundMoney(entry.order.grandTotal - entry.order.grandTotal * supplier.profile.commissionRate / 100);
      const before = balance;
      balance = roundMoney(balance + amount);
      walletTransactions.push({
        walletId: wallet._id,
        ownerId: supplier.user._id,
        type: WALLET_TRANSACTION_TYPE.CREDIT,
        amount,
        balanceBefore: before,
        balanceAfter: balance,
        description: `Earnings for ${entry.order.orderNumber} after platform commission.`,
        referenceType: 'ORDER',
        referenceId: entry.order.orderNumber,
        idempotencyKey: `demo-credit-${entry.order.orderNumber}`,
        status: 'COMPLETED',
        createdAt: entry.updatedAt,
      });
    }
    if (paidPayout) {
      const before = balance;
      balance = roundMoney(balance - paidPayout);
      walletTransactions.push({
        walletId: wallet._id,
        ownerId: supplier.user._id,
        type: WALLET_TRANSACTION_TYPE.PAYOUT,
        amount: -paidPayout,
        balanceBefore: before,
        balanceAfter: balance,
        description: 'Completed demo payout.',
        referenceType: 'PAYOUT',
        referenceId: `DEMO-PAYOUT-${index + 1}`,
        idempotencyKey: `demo-payout-paid-${index + 1}`,
        status: 'COMPLETED',
        createdAt: daysBefore(now, 6),
      });
    }
    if (requestedPayout) {
      walletTransactions.push({
        walletId: wallet._id,
        ownerId: supplier.user._id,
        type: WALLET_TRANSACTION_TYPE.PAYOUT,
        amount: -requestedPayout,
        balanceBefore: balance,
        balanceAfter: roundMoney(balance - requestedPayout),
        description: 'Requested demo payout held in the wallet.',
        referenceType: 'PAYOUT',
        referenceId: `DEMO-PAYOUT-${index + 1}`,
        idempotencyKey: `demo-payout-requested-${index + 1}`,
        status: 'PENDING',
        createdAt: daysBefore(now, 2),
      });
    }
    const payoutEntries = [];
    if (paidPayout) payoutEntries.push({
      payoutNumber: `DEMO-PAYOUT-${index + 1}-PAID`,
      wholesalerId: supplier.user._id,
      amount: paidPayout,
      status: PAYOUT_STATUS.PAID,
      bankAccountReference: { accountHolderName: supplier.business, accountNumber: `DEMO${index + 1}`, ifscCode: 'DEMO0000001', bankName: 'Example Cooperative Bank' },
      transactionReference: `DEMO-TRANSFER-${index + 1}`,
      approvedBy: superAdmin._id,
      approvedAt: daysBefore(now, 7),
      processedBy: superAdmin._id,
      processedAt: daysBefore(now, 6),
      notes: 'Fictional completed demo payout.',
    });
    if (requestedPayout) payoutEntries.push({
      payoutNumber: `DEMO-PAYOUT-${index + 1}-REQUESTED`,
      wholesalerId: supplier.user._id,
      amount: requestedPayout,
      status: PAYOUT_STATUS.REQUESTED,
      bankAccountReference: { accountHolderName: supplier.business, accountNumber: `DEMO${index + 1}`, ifscCode: 'DEMO0000001', bankName: 'Example Cooperative Bank' },
      notes: 'Fictional pending demo payout.',
    });
    for (const payout of payoutEntries) {
      await upsertDemo(models.Payout, { payoutNumber: payout.payoutNumber }, payout);
    }
  }
  await models.PaymentTransaction.deleteMany({ isDemo: true });
  await models.WalletTransaction.deleteMany({ isDemo: true });
  for (const entry of orderEntries) {
    const payment = await models.Payment.findOne({ orderId: entry.order._id, isDemo: true });
    const cancelled = entry.status === ORDER_STATUS.CANCELLED;
    const paid = entry.paymentStatus === PAYMENT_STATUS.PAID;
    await models.PaymentTransaction.create({
      paymentId: payment._id,
      orderId: entry.order._id,
      amount: entry.order.grandTotal,
      type: cancelled ? 'REVERSAL' : 'CHARGE',
      status: cancelled || paid ? 'SUCCESS' : 'PENDING',
      gatewayTransactionId: `DEMO-TXN-${entry.order.orderNumber}`,
      rawPayload: { source: 'demo-seed', orderNumber: entry.order.orderNumber },
      createdAt: entry.updatedAt,
      isDemo: true,
    });
  }
  for (const record of walletTransactions.filter((transaction) => transaction.walletId)) {
    await models.WalletTransaction.create({ ...record, isDemo: true });
  }
}

async function createReturnsAndCoupons(orderEntries, coupons, now) {
  const deliveredOrders = orderEntries.filter((entry) => entry.status === ORDER_STATUS.DELIVERED).slice(0, 5);
  const reasons = ['Damaged', 'Wrong item', 'Quality issue', 'Damaged', 'Quality issue'];
  const statuses = ['REQUESTED', 'APPROVED', 'REJECTED', 'PROCESSING', 'COMPLETED'];
  const returnEntries = [];
  for (const [index, entry] of deliveredOrders.entries()) {
    const item = entry.items[0];
    returnEntries.push(await upsertDemo(models.Return, { returnNumber: `DEMO-RET-${String(index + 1).padStart(4, '0')}` }, {
      returnNumber: `DEMO-RET-${String(index + 1).padStart(4, '0')}`,
      orderId: entry.order._id,
      retailerId: entry.retailer.user._id,
      wholesalerId: entry.supplier.user._id,
      items: [{
        productId: item.product._id,
        name: item.product.name,
        sku: item.product.sku,
        quantity: 1,
        reason: reasons[index],
        pricePerUnit: item.product.wholesalePrice,
      }],
      totalRefundAmount: item.product.wholesalePrice,
      status: statuses[index],
      reason: reasons[index],
      retailerNote: `Fictional return request: ${reasons[index].toLowerCase()}.`,
      images: [],
      adminNotes: index === 4 ? 'Demo return completed.' : '',
      resolvedAt: ['REJECTED', 'COMPLETED'].includes(statuses[index]) ? daysBefore(now, 2) : undefined,
      resolvedBy: ['REJECTED', 'COMPLETED'].includes(statuses[index]) ? entry.supplier.user._id : undefined,
    }));
  }

  for (const entry of orderEntries) {
    if (!entry.order.couponId) continue;
    const coupon = coupons.find((candidate) => candidate._id.equals(entry.order.couponId));
    if (!coupon) continue;
    coupon.usageCount += 1;
    const prior = coupon.perRetailerUsage.find((item) => item.retailerId.equals(entry.retailer.user._id));
    if (prior) prior.count += 1;
    else coupon.perRetailerUsage.push({ retailerId: entry.retailer.user._id, count: 1 });
  }
  for (const coupon of coupons) await coupon.save();
  return returnEntries;
}

async function createSupport(accounts, orderEntries, now) {
  const { superAdmin, wholesalers, retailers } = accounts;
  const seeds = [
    { role: 'WHOLESALER', from: 0, type: 'Payment', priority: 'High', status: 'Open', subject: 'Payout reconciliation question', message: 'Could you help reconcile the latest demo settlement?', replies: [] },
    { role: 'WHOLESALER', from: 1, type: 'Product', priority: 'Medium', status: 'In Progress', subject: 'Bulk tier display request', message: 'Please review how case pricing is shown to retailers.', replies: [{ message: 'Our team is checking the catalog settings.', role: 'SUPER_ADMIN' }] },
    { role: 'WHOLESALER', from: 2, type: 'KYC', priority: 'Low', status: 'Resolved', subject: 'KYC document checklist', message: 'Which supporting documents should we attach?', replies: [{ message: 'The checklist is available in the KYC panel.', role: 'SUPER_ADMIN' }] },
    { role: 'RETAILER', from: 0, type: 'Order', priority: 'High', status: 'In Progress', subject: 'Delivery timing for recent order', message: 'Please share an update for my wholesale shipment.', replies: [] },
    { role: 'RETAILER', from: 2, type: 'Issue', priority: 'Medium', status: 'Open', subject: 'Invoice address correction', message: 'I need help correcting the billing address on a future order.', replies: [] },
    { role: 'RETAILER', from: 4, type: 'Feedback', priority: 'Low', status: 'Resolved', subject: 'Catalog filters feedback', message: 'Category filters would be useful on smaller screens.', replies: [{ message: 'Thanks, we have recorded this feedback.', role: 'SUPER_ADMIN' }] },
    { role: 'RETAILER', from: 5, type: 'Request', priority: 'Low', status: 'Closed', subject: 'Request a new supplier category', message: 'Please consider adding regional pantry products.', replies: [] },
    { role: 'RETAILER', from: 7, type: 'Account', priority: 'Medium', status: 'Open', subject: 'Help with account settings', message: 'I would like assistance updating my shop profile.', replies: [] },
    { role: 'RETAILER', from: 8, type: 'Other', priority: 'Low', status: 'Resolved', subject: 'Thank you for the support', message: 'The previous issue was resolved quickly.', replies: [{ message: 'Glad we could help.', role: 'SUPER_ADMIN' }] },
  ];
  for (const [index, seed] of seeds.entries()) {
    const account = seed.role === 'WHOLESALER' ? wholesalers[seed.from] : retailers[seed.from];
    const businessName = account.business;
    const createdAt = daysBefore(now, 2 + index * 4);
    const replies = seed.replies.map((reply, replyIndex) => ({
      by: superAdmin._id,
      role: reply.role,
      message: reply.message,
      createdAt: daysAfter(createdAt, replyIndex + 1),
    }));
    const related = seed.type === 'Order' ? orderEntries.find((entry) => entry.retailer.user.id === account.user.id) : null;
    await upsertDemo(models.SupportTicket, { ticketNo: `TKT-DEMO-${String(index + 1).padStart(4, '0')}` }, {
      ticketNo: `TKT-DEMO-${String(index + 1).padStart(4, '0')}`,
      ticketNumber: `TKT-DEMO-${String(index + 1).padStart(4, '0')}`,
      createdBy: { userId: account.user._id, role: seed.role },
      businessName,
      contactName: seed.role === 'WHOLESALER' ? account.owner : account.name,
      phone: account.user.phone,
      email: account.user.email,
      type: seed.type,
      subject: seed.subject,
      message: seed.message,
      priority: seed.priority,
      status: seed.status,
      relatedOrderId: related?.order._id || null,
      attachments: [],
      replies,
      assignedTo: superAdmin._id,
      unreadForCreator: index === 1 || index === 5,
      creatorId: account.user._id,
      creatorRole: seed.role,
      recipientId: superAdmin._id,
      category: ({
        Payment: 'PAYMENT_ISSUE',
        Product: 'PRODUCT_DEFECT',
        KYC: 'GENERAL',
        Order: 'ORDER_ISSUE',
        Issue: 'GENERAL',
        Request: 'GENERAL',
        Feedback: 'GENERAL',
        Account: 'ACCOUNT_HELP',
        Other: 'OTHER',
      })[seed.type],
      messages: [{
        senderId: account.user._id,
        senderRole: seed.role,
        senderName: seed.role === 'WHOLESALER' ? account.owner : account.name,
        message: seed.message,
        attachments: [],
        createdAt,
      }],
      resolvedAt: ['Resolved', 'Closed'].includes(seed.status) ? daysAfter(createdAt, 1) : undefined,
      createdAt,
      updatedAt: replies.length ? replies[replies.length - 1].createdAt : createdAt,
    });
  }
}

async function createEngagement(accounts, orderEntries, now) {
  const { superAdmin, wholesalers, retailers } = accounts;
  for (const entry of orderEntries) {
    const retailer = entry.retailer;
    const previous = await models.RetailerProfile.findOne({ userId: retailer.user._id, isDemo: true });
    if (previous) {
      previous.totalOrdersCount += 1;
      if (entry.status !== ORDER_STATUS.CANCELLED) {
        previous.totalPurchaseAmount = roundMoney(previous.totalPurchaseAmount + entry.order.grandTotal);
      }
      previous.lastOrderAt = entry.createdAt;
      await previous.save();
    }
  }
  for (const [index, retailer] of retailers.entries()) {
    const supplier = wholesalers[retailer.wholesaler];
    if (index < 5) {
      const product = supplier.products[(index + 2) % 12];
      await upsertDemo(models.Review, {
        userId: retailer.user._id,
        productId: product._id,
      }, {
        userId: retailer.user._id,
        userRole: ROLES.RETAILER,
        wholesalerId: supplier.user._id,
        productId: product._id,
        title: ['Reliable quality', 'Good wholesale value', 'Retail-ready packaging', 'Consistent stock', 'Helpful supplier'][index],
        comment: 'Fictional demo review from a retailer account.',
        rating: index === 4 ? 4 : 5,
        status: index === 3 ? 'pending' : 'approved',
        isDeleted: false,
      });
      const wishlistProducts = supplier.products.slice(index, index + 3).map((product) => product._id);
      await upsertDemo(models.Wishlist, { retailerId: retailer.user._id }, {
        retailerId: retailer.user._id,
        products: wishlistProducts,
      });
    }
    await models.Notification.findOneAndUpdate({
      recipientId: retailer.user._id,
      'data.demoKey': `retailer-${index + 1}`,
      isDemo: true,
    }, {
      $set: {
        title: 'Welcome to the demo marketplace',
        message: `Your ${retailer.business} account is connected to ${supplier.business}.`,
        type: NOTIFICATION_TYPE.SYSTEM_ALERT,
        channel: NOTIFICATION_CHANNEL.IN_APP,
        data: { demoKey: `retailer-${index + 1}` },
        isRead: index % 2 === 0,
        isDemo: true,
      },
      $setOnInsert: { recipientId: retailer.user._id },
    }, { upsert: true, new: true, runValidators: true });
  }
  for (const [index, supplier] of wholesalers.entries()) {
    await models.Notification.findOneAndUpdate({
      recipientId: supplier.user._id,
      'data.demoKey': `wholesaler-${index + 1}`,
      isDemo: true,
    }, {
      $set: {
        title: 'Demo catalog ready',
        message: `Your ${supplier.business} catalog has demo inventory and orders.`,
        type: NOTIFICATION_TYPE.SYSTEM_ALERT,
        channel: NOTIFICATION_CHANNEL.IN_APP,
        data: { demoKey: `wholesaler-${index + 1}` },
        isRead: false,
        isDemo: true,
      },
      $setOnInsert: { recipientId: supplier.user._id },
    }, { upsert: true, new: true, runValidators: true });
  }
  await models.Notification.findOneAndUpdate({
    recipientId: superAdmin._id,
    'data.demoKey': 'admin-demo-summary',
    isDemo: true,
  }, {
    $set: {
      title: 'Demo support queue is ready',
      message: 'Fictional support requests are available in the admin inbox.',
      type: NOTIFICATION_TYPE.SYSTEM_ALERT,
      channel: NOTIFICATION_CHANNEL.IN_APP,
      data: { demoKey: 'admin-demo-summary' },
      isRead: false,
      isDemo: true,
    },
    $setOnInsert: { recipientId: superAdmin._id },
  }, { upsert: true, new: true, runValidators: true });

  const auditEntries = [
    { action: AUDIT_ACTION.APPROVE, entityType: 'KycApplication', entityId: 'demo-kyc-approved-01', metadata: { demoKey: 'audit-kyc-approved', summary: 'Approved fictional wholesaler KYC.' } },
    { action: AUDIT_ACTION.APPROVE, entityType: 'KycApplication', entityId: 'demo-kyc-approved-02', metadata: { demoKey: 'audit-kyc-approved-02', summary: 'Approved fictional wholesaler KYC.' } },
    { action: AUDIT_ACTION.UPDATE, entityType: 'SupportTicket', entityId: 'TKT-DEMO-0002', metadata: { demoKey: 'audit-support-progress', summary: 'Updated fictional support ticket.' } },
    { action: AUDIT_ACTION.PAYOUT_PROCESSED, entityType: 'Payout', entityId: 'DEMO-PAYOUT-1-PAID', metadata: { demoKey: 'audit-payout-processed', summary: 'Processed fictional wholesaler payout.' } },
    { action: AUDIT_ACTION.CREATE, entityType: 'Product', entityId: 'demo-products-created', metadata: { demoKey: 'audit-products-created', summary: 'Loaded fictional demo catalog.' } },
  ];
  for (const [index, audit] of auditEntries.entries()) {
    await models.AuditLog.findOneAndUpdate({ 'metadata.demoKey': audit.metadata.demoKey, isDemo: true }, {
      $set: {
        actorId: superAdmin._id,
        actorRole: ROLES.SUPER_ADMIN,
        actorEmail: superAdmin.email,
        action: audit.action,
        entityType: audit.entityType,
        entityId: audit.entityId,
        before: null,
        after: { demo: true },
        metadata: audit.metadata,
        ipAddress: '127.0.0.1',
        userAgent: 'demo-seed',
        isDemo: true,
      },
      $setOnInsert: { createdAt: daysBefore(now, index + 1) },
    }, { upsert: true, new: true, runValidators: true });
  }
}

async function printCounts() {
  console.log('\nDemo records by collection:');
  console.table(await Promise.all(demoModels.map(async (Model) => ({
    collection: Model.collection.collectionName,
    demoRecords: await Model.countDocuments({ isDemo: true }),
  }))));
}

function writeCredentials(accounts, password) {
  const rows = [
    { role: 'WHOLESALER', name: wholesalersSeed[0].business, email: 'amberloom.owner@example.com' },
    { role: 'WHOLESALER', name: wholesalersSeed[1].business, email: 'orbit.owner@example.com' },
    { role: 'WHOLESALER', name: wholesalersSeed[2].business, email: 'evergreen.owner@example.com' },
    ...retailerSeed.map((retailer, index) => ({
      role: 'RETAILER',
      name: retailer.business,
      email: `retailer${String(index + 1).padStart(2, '0')}@example.com`,
    })),
  ];
  const markdown = [
    '# Demo logins',
    '',
    'The shared demo password is set by `DEMO_PASSWORD` (default: `Demo@12345`).',
    '',
    '| Role | Name | Email | Password |',
    '| --- | --- | --- | --- |',
    ...rows.map((row) => `| ${row.role} | ${row.name} | ${row.email} | ${password} |`),
    '',
    `Super Admin: use the existing account configured by \`SUPER_ADMIN_EMAIL\` (${env.SUPER_ADMIN_EMAIL}); its password is not changed by this script.`,
    '',
  ].join('\n');
  const credentialsPath = path.join(__dirname, 'demo-credentials.md');
  fs.writeFileSync(credentialsPath, markdown, { encoding: 'utf8', mode: 0o600 });
  console.log(markdown);
  console.log(`Credentials sheet written to ${credentialsPath}`);
}

async function main() {
  if (!env.MONGO_URI) throw new Error('MONGO_URI is required.');
  await connectDB();
  console.log(`Writing to MongoDB database: ${mongoose.connection.name || '(default)'}`);

  if (mode === 'clear' || mode === 'reset') {
    await clearDemoData();
    if (mode === 'clear') {
      await printCounts();
      return;
    }
  }

  const now = new Date();
  const password = process.env.DEMO_PASSWORD || 'Demo@12345';
  if (password.length < 8) throw new Error('DEMO_PASSWORD must be at least 8 characters.');
  const passwordHash = await bcrypt.hash(password, 12);
  const accounts = await createUsers(passwordHash);

  // Generated append-only rows are replaced each run; natural-key records are safely upserted.
  await models.InventoryTransaction.deleteMany({ isDemo: true });
  await models.PaymentTransaction.deleteMany({ isDemo: true });
  await models.WalletTransaction.deleteMany({ isDemo: true });
  await models.Notification.deleteMany({ isDemo: true });
  await models.AuditLog.deleteMany({ isDemo: true });

  await createProfiles(accounts, now);
  await createCategories(accounts.wholesalers);
  await createProducts(accounts.wholesalers, now);
  const coupons = await createCoupons(now);
  const { orders, allocations } = await createOrders(accounts, coupons, now);
  await createInventory(accounts.wholesalers, allocations, orders, now);
  const returns = await createReturnsAndCoupons(orders, coupons, now);
  await createFinancialRecords(accounts, orders, now);
  await createSupport(accounts, orders, now);
  await createEngagement(accounts, orders, now);
  writeCredentials(accounts, password);
  await printCounts();
  await verifySeed(accounts, orders, allocations);
}

async function verifySeed(accounts, orders, allocations) {
  if (orders.length !== 60) throw new Error(`Expected 60 seeded orders; found ${orders.length}.`);
  for (const entry of orders) {
    const itemTotal = roundMoney(entry.order.items.reduce((sum, item) => sum + item.total, 0));
    if (Math.abs(itemTotal - entry.order.discount - entry.order.grandTotal) > 0.02) {
      throw new Error(`Order total mismatch in ${entry.order.orderNumber}: items ${itemTotal}, grand total ${entry.order.grandTotal}.`);
    }
  }
  for (const [productId, allocation] of allocations.entries()) {
    const inventory = await models.Inventory.findOne({ productId, isDemo: true });
    if (!inventory || inventory.available < 0 || inventory.sold !== allocation.delivered) {
      throw new Error(`Inventory balance verification failed for product ${allocation.product.sku}.`);
    }
  }
  const demoAdmin = await models.User.findOne({ email: env.SUPER_ADMIN_EMAIL, role: ROLES.SUPER_ADMIN });
  if (!demoAdmin || demoAdmin.isDemo) throw new Error('The configured Super Admin account was unexpectedly changed.');
  console.log(`\nVerified ${orders.length} demo orders and non-negative inventory. Super Admin account remained non-demo.`);
}

main()
  .catch((error) => {
    console.error(`Demo seed failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDB();
  });
