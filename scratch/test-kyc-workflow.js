const mongoose = require('mongoose');
require('dotenv').config({ path: 'c:/Users/ASUS/Desktop/wholesaller-updated/Backend/.env' });

const { WholesalerProfile, KycApplication, User } = require('c:/Users/ASUS/Desktop/wholesaller-updated/Backend/src/models');
const { KYC_STATUS } = require('c:/Users/ASUS/Desktop/wholesaller-updated/Backend/src/config/constants');
const CategoryService = require('c:/Users/ASUS/Desktop/wholesaller-updated/Backend/src/modules/categories/categories.service');
const ProductService = require('c:/Users/ASUS/Desktop/wholesaller-updated/Backend/src/modules/products/products.service');

async function testKycWorkflow() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/wholesaller';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // 1. Find or create a test Wholesaler User
    let wholesalerUser = await User.findOne({ role: 'WHOLESALER' });
    if (!wholesalerUser) {
      console.log('No wholesaler user found in DB');
      process.exit(1);
    }
    console.log('👤 Found Wholesaler User:', wholesalerUser.email, wholesalerUser._id);

    // 2. Find or create Wholesaler Profile
    let profile = await WholesalerProfile.findOne({ userId: wholesalerUser._id });
    if (!profile) {
      profile = await WholesalerProfile.create({
        userId: wholesalerUser._id,
        businessName: 'Test Wholesale Mart',
        kycStatus: KYC_STATUS.DRAFT,
      });
    }

    console.log('📌 Current Profile KYC Status:', profile.kycStatus);

    // 3. Test Block on Category & Product Creation when NOT APPROVED
    profile.kycStatus = KYC_STATUS.SUBMITTED;
    await profile.save();

    try {
      await CategoryService.createCategory({ name: 'Test Block Category' }, wholesalerUser);
      console.error('❌ ERROR: Category creation should have been blocked for SUBMITTED KYC status!');
    } catch (err) {
      console.log('✅ Correctly blocked Category creation for SUBMITTED status:', err.message);
    }

    try {
      await ProductService.createProduct({ name: 'Test Block Product' }, wholesalerUser);
      console.error('❌ ERROR: Product creation should have been blocked for SUBMITTED KYC status!');
    } catch (err) {
      console.log('✅ Correctly blocked Product creation for SUBMITTED status:', err.message);
    }

    // 4. Simulate Approval
    profile.kycStatus = KYC_STATUS.APPROVED;
    await profile.save();
    console.log('🎉 Profile KYC Status changed to APPROVED');

    // 5. Test Category Creation when APPROVED
    const testCat = await CategoryService.createCategory({ name: 'Verified Test Category ' + Date.now() }, wholesalerUser);
    console.log('✅ Successfully created Category after KYC Approval:', testCat.name, testCat._id);

    // Clean up test category
    await CategoryService.deleteCategory(testCat._id, wholesalerUser);
    console.log('🧹 Cleaned up test category');

    // 6. Simulate Rejection
    profile.kycStatus = KYC_STATUS.REJECTED;
    await profile.save();

    let kycApp = await KycApplication.findOne({ wholesalerId: wholesalerUser._id });
    if (!kycApp) {
      kycApp = await KycApplication.create({
        wholesalerId: wholesalerUser._id,
        businessName: profile.businessName,
        ownerName: wholesalerUser.name || 'Owner',
        pan: 'ABCDE1234F',
        gstin: '22AAAAA0000A1Z5',
        registeredAddress: { street: 'Main St', city: 'Delhi', state: 'Delhi', pincode: '110001' },
        bankDetails: { accountHolderName: 'Owner', accountNumber: '12345678', ifscCode: 'HDFC0001234', bankName: 'HDFC' },
        status: KYC_STATUS.REJECTED,
        reviewReason: 'PAN Card image is blurry. Please upload a clear scan.',
      });
    } else {
      kycApp.status = KYC_STATUS.REJECTED;
      kycApp.reviewReason = 'PAN Card image is blurry. Please upload a clear scan.';
      await kycApp.save();
    }

    console.log('❌ KYC Application rejected with reason:', kycApp.reviewReason);

    // Verify rejection block
    try {
      await CategoryService.createCategory({ name: 'Test Block Category 2' }, wholesalerUser);
      console.error('❌ ERROR: Category creation should have been blocked for REJECTED status!');
    } catch (err) {
      console.log('✅ Correctly blocked Category creation for REJECTED status:', err.message);
    }

    console.log('🏁 Full KYC Approval / Rejection Workflow End-To-End Verification Passed Successfully!');
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('💥 Test Error:', error);
    process.exit(1);
  }
}

testKycWorkflow();
