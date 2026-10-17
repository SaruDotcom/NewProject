const mongoose = require('mongoose');
const { connectDB } = require('../src/config/database');
const { User, WholesalerProfile, PlatformSetting } = require('../src/models');
const WholesalerInvitesService = require('../src/modules/wholesaler-invites/wholesalerInvites.service');
const AuthService = require('../src/modules/auth/auth.service');

async function runTests() {
  console.log('--- Starting Admin Wholesaler Link Backend Tests ---');
  await connectDB();

  try {
    // 1. Get or initialize Admin link
    console.log('\nTest 1: Get Admin Link');
    const link1 = await WholesalerInvitesService.getAdminLink();
    console.log('Admin link code:', link1.code);
    console.log('isPaused:', link1.isPaused);
    console.log('linkOpens:', link1.linkOpens);
    console.log('registered:', link1.registered);
    if (!link1.code || link1.code.length < 8) {
      throw new Error('Expected referral code to have 8+ characters');
    }
    console.log('Test 1 Passed: Admin link initialized correctly');

    // 2. Validate valid code
    console.log('\nTest 2: Validate active code');
    const validRes = await WholesalerInvitesService.validateAdminRef(link1.code, {
      ip: '127.0.0.1',
      userAgent: 'TestAgent/1.0',
    });
    console.log('Validation result:', validRes);
    if (!validRes.valid) throw new Error('Expected code to be valid');
    console.log('Test 2 Passed: Active code is valid');

    // 3. Pause link & verify validation
    console.log('\nTest 3: Pause link & test validation');
    const pausedLink = await WholesalerInvitesService.toggleAdminLinkPause(true);
    if (!pausedLink.isPaused) throw new Error('Expected link to be paused');

    const pausedRes = await WholesalerInvitesService.validateAdminRef(link1.code);
    console.log('Paused validation result:', pausedRes);
    if (pausedRes.valid !== false || pausedRes.isPaused !== true) {
      throw new Error('Expected paused validation to return valid: false and isPaused: true');
    }
    console.log('Test 3 Passed: Paused link correctly detected');

    // 4. Registration with paused link should fail
    console.log('\nTest 4: Register with paused code should throw error');
    let threwOnPaused = false;
    const testEmail1 = `test_paused_${Date.now()}@example.com`;
    try {
      await AuthService.register({
        name: 'Paused Wholesaler',
        email: testEmail1,
        password: 'Password123!',
        phone: '9876543210',
        role: 'WHOLESALER',
        businessName: 'Paused Wholesaler Ltd',
        ref: link1.code,
      });
    } catch (err) {
      threwOnPaused = true;
      console.log('Caught expected error on paused code:', err.message);
    }
    if (!threwOnPaused) throw new Error('Expected registration with paused code to fail');
    console.log('Test 4 Passed: Registration blocked when link is paused');

    // 5. Resume link
    console.log('\nTest 5: Resume link');
    const resumedLink = await WholesalerInvitesService.toggleAdminLinkPause(false);
    if (resumedLink.isPaused) throw new Error('Expected link to be unpaused');
    console.log('Test 5 Passed: Link resumed successfully');

    // 6. Registration with active link & UTM parameters
    console.log('\nTest 6: Register with active link & campaign');
    const testEmail2 = `test_link_${Date.now()}@example.com`;
    const regResult = await AuthService.register({
      name: 'Ramesh Wholesale Mart',
      email: testEmail2,
      password: 'Password123!',
      phone: '9812345678',
      role: 'WHOLESALER',
      businessName: 'Ramesh Wholesale Traders',
      city: 'Pune',
      ref: link1.code,
      utmSource: 'admin',
      utmCampaign: 'diwali',
    });

    const createdProfile = await WholesalerProfile.findOne({ userId: regResult.user.id || regResult.user._id });
    if (!createdProfile) throw new Error('Wholesaler profile not found');
    console.log('Created Wholesaler registrationSource:', createdProfile.registrationSource);
    console.log('Created Wholesaler adminReferralCode:', createdProfile.adminReferralCode);
    console.log('Created Wholesaler utmCampaign:', createdProfile.utmCampaign);

    if (createdProfile.registrationSource !== 'ADMIN_LINK') {
      throw new Error(`Expected registrationSource 'ADMIN_LINK', got '${createdProfile.registrationSource}'`);
    }
    if (createdProfile.adminReferralCode !== link1.code) {
      throw new Error(`Expected adminReferralCode '${link1.code}', got '${createdProfile.adminReferralCode}'`);
    }
    if (createdProfile.utmCampaign !== 'diwali') {
      throw new Error(`Expected utmCampaign 'diwali', got '${createdProfile.utmCampaign}'`);
    }
    console.log('Test 6 Passed: Wholesaler registered with ADMIN_LINK and saved UTM campaign');

    // 7. Verify wholesaler appears in listRegisteredWholesalers
    console.log('\nTest 7: Check registered wholesalers list');
    const listResult = await WholesalerInvitesService.listRegisteredWholesalers({ search: 'Ramesh' });
    console.log('Found wholesalers count:', listResult.pagination.total);
    const found = listResult.items.find((item) => item.email === testEmail2);
    if (!found) throw new Error('Newly registered wholesaler not found in list');
    console.log('Found wholesaler item:', found);
    if (found.campaign !== 'diwali') {
      throw new Error(`Expected campaign 'diwali', got '${found.campaign}'`);
    }
    console.log('Test 7 Passed: Wholesaler appears in tracking table with campaign and details');

    // 8. Direct registration without code still works
    console.log('\nTest 8: Direct registration without code');
    const testEmail3 = `test_direct_${Date.now()}@example.com`;
    const directResult = await AuthService.register({
      name: 'Direct Wholesaler',
      email: testEmail3,
      password: 'Password123!',
      phone: '9899887766',
      role: 'WHOLESALER',
      businessName: 'Direct Wholesaler Enterprise',
    });
    const directProfile = await WholesalerProfile.findOne({ userId: directResult.user.id || directResult.user._id });
    console.log('Direct profile registrationSource:', directProfile.registrationSource);
    if (directProfile.registrationSource !== 'DIRECT') {
      throw new Error(`Expected registrationSource 'DIRECT', got '${directProfile.registrationSource}'`);
    }
    console.log('Test 8 Passed: Direct registration without code still works as expected');

    // 9. Regenerate code
    console.log('\nTest 9: Regenerate link');
    const regenResult = await WholesalerInvitesService.regenerateAdminLink();
    console.log('New code:', regenResult.code);
    if (regenResult.code === link1.code) {
      throw new Error('Expected new code to differ from old code');
    }

    const oldCodeValidation = await WholesalerInvitesService.validateAdminRef(link1.code);
    console.log('Old code validation after regen:', oldCodeValidation);
    if (oldCodeValidation.valid) {
      throw new Error('Expected old code to be invalid after regeneration');
    }
    const newCodeValidation = await WholesalerInvitesService.validateAdminRef(regenResult.code);
    console.log('New code validation:', newCodeValidation);
    if (!newCodeValidation.valid) {
      throw new Error('Expected new code to be valid');
    }
    console.log('Test 9 Passed: Link regeneration works and deactivates old link');

    // Clean up test records
    await User.deleteMany({ email: { $in: [testEmail1, testEmail2, testEmail3] } });
    await WholesalerProfile.deleteMany({ _id: { $in: [createdProfile._id, directProfile._id] } });
    console.log('\n--- ALL 9 BACKEND TESTS PASSED SUCCESSFULLY! ---');
  } finally {
    await mongoose.disconnect();
  }
}

runTests().catch((err) => {
  console.error('Test Failed:', err);
  process.exit(1);
});
