const { connectDB, disconnectDB } = require('../src/config/database');
const { WholesalerProfile } = require('../src/models');
const ReferralProgramService = require('../src/modules/referrals/wholesaler-referral-program.service');

async function run() {
  await connectDB();
  const profiles = WholesalerProfile.find({ isDeleted: { $ne: true } })
    .select('_id wholesalerReferralCode')
    .lean()
    .cursor();
  let generated = 0;
  let processed = 0;

  for await (const profile of profiles) {
    const hadCode = /^[A-Z0-9]{6,12}$/i.test(String(profile.wholesalerReferralCode || ''));
    await ReferralProgramService.ensureReferralCode(profile);
    if (!hadCode) generated += 1;
    processed += 1;
  }

  console.log(`Referral code backfill complete. ${generated} code(s) generated across ${processed} wholesaler profile(s).`);
}

run()
  .catch((error) => {
    console.error('Wholesaler referral code backfill failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDB();
  });
