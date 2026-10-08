const mongoose = require('mongoose');
const { connectDB, disconnectDB } = require('../src/config/database');
const {
  User,
  AdminProfile,
  WholesalerProfile,
  RetailerProfile,
  KycApplication,
  Category,
  Product,
  Inventory,
  InventoryTransaction,
  Invitation,
  WholesalerRetailerRelationship,
  Wallet,
  PlatformSetting,
} = require('../src/models');
const { ROLES, USER_STATUS, KYC_STATUS, RELATIONSHIP_STATUS } = require('../src/config/constants');
const { hashToken } = require('../src/utils/crypto');

const seedData = async () => {
  try {
    await connectDB();
    console.log('Seeding initial development & platform data...');

    // Platform Settings
    await PlatformSetting.findOneAndUpdate(
      { key: 'platformCommissionRate' },
      { key: 'platformCommissionRate', value: 5.0, description: 'Default platform commission rate (%)' },
      { upsert: true }
    );
    await PlatformSetting.findOneAndUpdate(
      { key: 'autoApproveKyc' },
      { key: 'autoApproveKyc', value: false, description: 'Whether to auto approve wholesaler KYC' },
      { upsert: true }
    );

    // Initial Categories
    const categoriesData = [
      { name: 'Electronics & Gadgets', slug: 'electronics-gadgets', icon: 'zap' },
      { name: 'Apparel & Clothing', slug: 'apparel-clothing', icon: 'shirt' },
      { name: 'Footwear & Leather', slug: 'footwear-leather', icon: 'box' },
      { name: 'Home & Kitchen', slug: 'home-kitchen', icon: 'home' },
      { name: 'Fashion Accessories', slug: 'fashion-accessories', icon: 'watch' },
    ];

    const categoryMap = {};
    for (const cat of categoriesData) {
      const created = await Category.findOneAndUpdate(
        { slug: cat.slug },
        { name: cat.name, slug: cat.slug, icon: cat.icon, isDeleted: false },
        { upsert: true, new: true }
      );
      categoryMap[cat.slug] = created;
    }

    console.log('Categories seeded.');

    // Super Admin User
    let admin = await User.findOne({ email: 'admin@nexora.b2b' });
    if (!admin) {
      const passwordHash = await User.hashPassword('Admin@123456');
      admin = await User.create({
        name: 'Super Administrator',
        email: 'admin@nexora.b2b',
        passwordHash,
        role: ROLES.SUPER_ADMIN,
        status: USER_STATUS.ACTIVE,
        emailVerified: true,
      });

      const adminProfile = await AdminProfile.create({
        userId: admin._id,
        department: 'Executive Operations',
        permissions: ['*'],
        isSuperAdmin: true,
      });
      admin.adminProfile = adminProfile._id;
      await admin.save();
      console.log('Super Admin user created: admin@nexora.b2b / Admin@123456');
    }

    // Wholesaler 1 (Apex Wholesale)
    let wholesaler1 = await User.findOne({ email: 'wholesaler@apex.com' });
    if (!wholesaler1) {
      const passwordHash = await User.hashPassword('Wholesale@123');
      wholesaler1 = await User.create({
        name: 'Rajesh Sharma',
        email: 'wholesaler@apex.com',
        phone: '+919876543210',
        passwordHash,
        role: ROLES.WHOLESALER,
        status: USER_STATUS.ACTIVE,
        emailVerified: true,
      });

      const wallet = await Wallet.create({
        ownerId: wholesaler1._id,
        ownerType: 'WHOLESALER',
        availableBalance: 25000,
      });

      const profile = await WholesalerProfile.create({
        userId: wholesaler1._id,
        businessName: 'Apex Wholesale Electronics',
        businessType: 'Private Limited',
        gstin: '27AABCA1234F1Z5',
        pan: 'AABCA1234F',
        address: {
          street: '104, Industrial Area Phase II',
          city: 'Mumbai',
          state: 'Maharashtra',
          pincode: '400001',
        },
        bankDetails: {
          accountHolderName: 'Apex Wholesale Electronics Pvt Ltd',
          accountNumber: '918237465019',
          ifscCode: 'HDFC0001234',
          bankName: 'HDFC Bank',
          branch: 'Fort, Mumbai',
        },
        kycStatus: KYC_STATUS.APPROVED,
        isVerified: true,
        walletId: wallet._id,
      });

      wholesaler1.wholesalerProfile = profile._id;
      await wholesaler1.save();

      // Seed Wholesaler Products
      const productsData = [
        {
          name: 'Pro ANC Wireless Earbuds',
          sku: 'APEX-EAR-01',
          wholesalePrice: 1200,
          retailerPrice: 1350,
          mrp: 2999,
          stock: 150,
          moq: 5,
          categoryId: categoryMap['electronics-gadgets']._id,
          pricingTiers: [
            { minQty: 5, maxQty: 19, pricePerUnit: 1200 },
            { minQty: 20, maxQty: 49, pricePerUnit: 1100 },
            { minQty: 50, pricePerUnit: 999 },
          ],
        },
        {
          name: 'Fast Charging 65W GaN Adapter',
          sku: 'APEX-CHG-65W',
          wholesalePrice: 650,
          retailerPrice: 750,
          mrp: 1899,
          stock: 200,
          moq: 10,
          categoryId: categoryMap['electronics-gadgets']._id,
        },
      ];

      for (const p of productsData) {
        const prod = await Product.create({
          wholesalerId: wholesaler1._id,
          name: p.name,
          title: p.name,
          slug: p.sku.toLowerCase(),
          sku: p.sku,
          wholesalePrice: p.wholesalePrice,
          retailerPrice: p.retailerPrice,
          mrp: p.mrp,
          stock: p.stock,
          moq: p.moq,
          categoryId: p.categoryId,
          pricingTiers: p.pricingTiers || [],
          status: 'ACTIVE',
        });

        const inv = await Inventory.create({
          productId: prod._id,
          wholesalerId: wholesaler1._id,
          available: p.stock,
        });

        await InventoryTransaction.create({
          inventoryId: inv._id,
          productId: prod._id,
          wholesalerId: wholesaler1._id,
          type: 'RECEIVE',
          quantity: p.stock,
          previousAvailable: 0,
          newAvailable: p.stock,
          referenceType: 'RESTOCK',
          performedBy: wholesaler1._id,
          notes: 'Initial Seed Restock',
        });
      }

      console.log('Wholesaler 1 created with products: wholesaler@apex.com / Wholesale@123');
    }

    // Retailer 1 (City Digital Store)
    let retailer1 = await User.findOne({ email: 'retailer@citystore.com' });
    if (!retailer1) {
      const passwordHash = await User.hashPassword('Retailer@123');
      retailer1 = await User.create({
        name: 'Amit Patel',
        email: 'retailer@citystore.com',
        phone: '+919812345678',
        passwordHash,
        role: ROLES.RETAILER,
        status: USER_STATUS.ACTIVE,
        emailVerified: true,
      });

      const profile = await RetailerProfile.create({
        userId: retailer1._id,
        businessName: 'City Digital & Mobile Store',
        gstin: '27XYZPA9876Q1Z2',
        gstStatus: 'REGISTERED',
        address: {
          street: 'Shop 12, Market Square',
          city: 'Pune',
          state: 'Maharashtra',
          pincode: '411001',
        },
        assignedWholesalerId: wholesaler1._id,
      });

      // Link relationship
      const rel = await WholesalerRetailerRelationship.create({
        wholesalerId: wholesaler1._id,
        retailerId: retailer1._id,
        status: RELATIONSHIP_STATUS.ACTIVE,
      });

      profile.activeRelationshipId = rel._id;
      await profile.save();

      retailer1.retailerProfile = profile._id;
      await retailer1.save();

      console.log('Retailer 1 created & linked to Wholesaler 1: retailer@citystore.com / Retailer@123');
    }

    console.log('\n Development data seeding completed successfully!');
  } catch (error) {
    console.error('Seeding error:', error);
  } finally {
    await disconnectDB();
    process.exit(0);
  }
};

if (require.main === module) {
  seedData();
}

module.exports = seedData;
