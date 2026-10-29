const mongoose = require('mongoose');
require('dotenv').config();
const { User, WholesalerProfile, WholesalerRetailerRelationship } = require('../src/models');
const WholesalerPortalService = require('../src/modules/wholesalers/wholesalerPortal.service');
const RetailerService = require('../src/services/retailer.service');
const ReferralsService = require('../src/modules/referrals/referrals.service');
const { getPresetsForType } = require('../src/config/businessTypeBanners');

async function runVerification() {
  console.log('Connecting to database...');
  const { connectDB } = require('../src/config/database');
  await connectDB();
  console.log('Connected to MongoDB.');

  try {
    // 1. Setup or find 3 wholesalers: Clothing, Beauty, Kirana
    console.log('\n--- 1. Testing Business Types & Banners Setup ---');

    // Find or create test wholesaler profiles
    const testWholesalers = [
      {
        email: 'test_ws_clothing@example.com',
        businessName: 'Surat Royal Apparels',
        category: 'CLOTHING',
        theme: 'ROYAL',
        referralCode: 'CLOTH1',
      },
      {
        email: 'test_ws_beauty@example.com',
        businessName: 'Glow Cosmetics & Skincare',
        category: 'COSMETICS',
        theme: 'FESTIVE',
        referralCode: 'BEAUT1',
      },
      {
        email: 'test_ws_kirana@example.com',
        businessName: 'Metro Bulk Kirana',
        category: 'GENERAL_STORE',
        theme: 'MINIMAL',
        referralCode: 'KIRAN1',
      },
    ];

    const profiles = [];

    for (const tw of testWholesalers) {
      let user = await User.findOne({ email: tw.email });
      if (!user) {
        const bcrypt = require('bcryptjs');
        const hash = await bcrypt.hash('Password@123', 10);
        user = await User.create({
          name: tw.businessName,
          email: tw.email,
          passwordHash: hash,
          role: 'WHOLESALER',
          status: 'ACTIVE',
        });
      }

      let profile = await WholesalerProfile.findOne({ userId: user._id });
      if (!profile) {
        profile = await WholesalerProfile.create({
          userId: user._id,
          businessName: tw.businessName,
          businessCategory: tw.category,
          activeStoreTheme: tw.theme,
          retailerReferralCode: tw.referralCode,
          retailerSignupsEnabled: true,
          kycStatus: 'APPROVED',
        });
      } else {
        profile.businessCategory = tw.category;
        profile.activeStoreTheme = tw.theme;
        profile.retailerReferralCode = tw.referralCode;
        profile.retailerSignupsEnabled = true;
        profile.kycStatus = 'APPROVED';
        await profile.save();
      }
      profiles.push({ user, profile, config: tw });
    }

    console.log('✓ 3 Wholesalers initialized in DB: Clothing, Beauty, Kirana.');

    // 2. Test Wholesaler 1: Clothing with ROYAL theme
    console.log('\n--- 2. Testing Clothing Wholesaler (ROYAL theme) ---');
    const clothing = profiles[0];
    const clothingPresets = await WholesalerPortalService.getBanners(clothing.user._id);
    console.log(`Clothing presets available: ${clothingPresets.presetOptions.length} options`);
    console.log(`First preset title: "${clothingPresets.presetOptions[0].title}" (${clothingPresets.presetOptions[0].targetCategory})`);

    // Activate 1st preset, and deactivate others
    await WholesalerPortalService.activatePreset(clothing.user._id, clothingPresets.presetOptions[0].id, clothing.user, {});
    const updatedClothing = await WholesalerPortalService.updateBanners(
      clothing.user._id,
      {
        activeStoreTheme: 'ROYAL',
        banners: [
          {
            ...clothingPresets.presetOptions[0],
            discountBadge: '35% EXTRA BULK MARGIN',
            isActive: true,
          },
          {
            ...clothingPresets.presetOptions[1],
            isActive: false,
          },
        ],
      },
      clothing.user,
      {}
    );
    console.log(`Clothing Active Store Theme: ${updatedClothing.activeStoreTheme}`);
    console.log(`Clothing Active Banners Count: ${updatedClothing.banners.filter(b => b.active).length}`);

    // 3. Test Wholesaler 2: Beauty / Cosmetics with FESTIVE theme
    console.log('\n--- 3. Testing Beauty Wholesaler (FESTIVE theme) ---');
    const beauty = profiles[1];
    const beautyBanners = await WholesalerPortalService.getBanners(beauty.user._id);
    console.log(`Beauty presets available: ${beautyBanners.presetOptions.length} options`);
    console.log(`First preset title: "${beautyBanners.presetOptions[0].title}" (${beautyBanners.presetOptions[0].targetCategory})`);

    await WholesalerPortalService.updateBanners(
      beauty.user._id,
      {
        activeStoreTheme: 'FESTIVE',
        banners: [
          {
            ...beautyBanners.presetOptions[0],
            title: 'Salon Professional Skincare Fair',
            discountBadge: 'EXCLUSIVE 20% EXTRA DEAL',
            isActive: true,
          },
        ],
      },
      beauty.user,
      {}
    );
    const beautyResult = await WholesalerPortalService.getBanners(beauty.user._id);
    console.log(`Beauty Active Store Theme: ${beautyResult.activeStoreTheme}`);
    console.log(`Beauty Banner Title: "${beautyResult.banners[0].title}"`);

    // 4. Test Wholesaler 3: Kirana / General Store with MINIMAL theme
    console.log('\n--- 4. Testing Kirana Wholesaler (MINIMAL theme) ---');
    const kirana = profiles[2];
    const kiranaBanners = await WholesalerPortalService.getBanners(kirana.user._id);
    console.log(`Kirana presets available: ${kiranaBanners.presetOptions.length} options`);
    console.log(`First preset title: "${kiranaBanners.presetOptions[0].title}" (${kiranaBanners.presetOptions[0].targetCategory})`);

    await WholesalerPortalService.updateBanners(
      kirana.user._id,
      {
        activeStoreTheme: 'MINIMAL',
        banners: [
          {
            ...kiranaBanners.presetOptions[0],
            title: 'Daily Grocery Staples Saver Week',
            discountBadge: 'DOORSTEP TRUCK FREIGHT',
            isActive: true,
          },
        ],
      },
      kirana.user,
      {}
    );
    const kiranaResult = await WholesalerPortalService.getBanners(kirana.user._id);
    console.log(`Kirana Active Store Theme: ${kiranaResult.activeStoreTheme}`);

    // 5. Test Retailer Homepage Display via Referral / Connected Storefront
    console.log('\n--- 5. Testing Retailer Homepage Sync & Wholesaler Isolation ---');

    // Check referral for Clothing
    const refClothing = await ReferralsService.getPublicReferral('CLOTH1');
    console.log(`[Store 1] Theme: ${refClothing.activeStoreTheme}, Category: ${refClothing.businessCategory}`);
    console.log(`[Store 1] Active Offers: ${refClothing.banners.map(b => b.title).join(' | ')}`);
    if (refClothing.activeStoreTheme !== 'ROYAL' || refClothing.banners.length !== 1 || !refClothing.banners[0].title.toLowerCase().includes('ethnic')) {
      throw new Error('Clothing storefront did not match expected theme or banner!');
    }

    // Check referral for Beauty
    const refBeauty = await ReferralsService.getPublicReferral('BEAUT1');
    console.log(`[Store 2] Theme: ${refBeauty.activeStoreTheme}, Category: ${refBeauty.businessCategory}`);
    console.log(`[Store 2] Active Offers: ${refBeauty.banners.map(b => b.title).join(' | ')}`);
    if (refBeauty.activeStoreTheme !== 'FESTIVE' || refBeauty.banners.length !== 1 || !refBeauty.banners[0].title.toLowerCase().includes('skincare')) {
      throw new Error('Beauty storefront did not match expected theme or banner!');
    }

    // Check referral for Kirana
    const refKirana = await ReferralsService.getPublicReferral('KIRAN1');
    console.log(`[Store 3] Theme: ${refKirana.activeStoreTheme}, Category: ${refKirana.businessCategory}`);
    console.log(`[Store 3] Active Offers: ${refKirana.banners.map(b => b.title).join(' | ')}`);
    if (refKirana.activeStoreTheme !== 'MINIMAL' || refKirana.banners.length !== 1 || !refKirana.banners[0].title.toLowerCase().includes('staples')) {
      throw new Error('Kirana storefront did not match expected theme or banner!');
    }

    // Check isolation: No crossover
    if (refClothing.banners.some(b => b.title.includes('Skincare') || b.title.includes('Grocery'))) {
      throw new Error('Leak detected! Clothing storefront has non-clothing banners!');
    }
    if (refBeauty.banners.some(b => b.title.includes('Ethnic') || b.title.includes('Grocery'))) {
      throw new Error('Leak detected! Beauty storefront has non-beauty banners!');
    }
    console.log('✓ Wholesaler isolation verified: Zero cross-contamination between different business types.');

    // 6. Test Deactivating an offer removes it from the retailer homepage
    console.log('\n--- 6. Testing Deactivation & Clean Default Handling ---');
    await WholesalerPortalService.updateBanners(
      kirana.user._id,
      {
        banners: [
          {
            ...kiranaResult.banners[0],
            isActive: false, // Deactivate
          },
        ],
      },
      kirana.user,
      {}
    );

    const refKiranaDeactivated = await ReferralsService.getPublicReferral('KIRAN1');
    console.log(`Kirana storefront active banners after deactivation: ${refKiranaDeactivated.banners.length}`);
    if (refKiranaDeactivated.banners.length !== 0) {
      throw new Error('Deactivated banner still appeared in retailer response!');
    }
    console.log('✓ Deactivated banner successfully removed from retailer homepage (returns empty array for clean default welcome banner).');

    console.log('\n=================================================');
    console.log('ALL VERIFICATION CHECKS PASSED SUCCESSFULLY!');
    console.log('=================================================');
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from database.');
  }
}

runVerification().catch((err) => {
  console.error('Verification failed with error:', err);
  process.exit(1);
});
