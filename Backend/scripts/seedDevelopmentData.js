const { connectDB, disconnectDB } = require('../src/config/database');
const { PlatformSetting } = require('../src/models');

async function seedPlatformSettings() {
  try {
    await connectDB();

    await PlatformSetting.updateOne(
      { key: 'platformCommissionRate' },
      { $setOnInsert: { key: 'platformCommissionRate', value: 5, description: 'Default platform commission rate (%)' } },
      { upsert: true }
    );
    await PlatformSetting.updateOne(
      { key: 'autoApproveKyc' },
      { $setOnInsert: { key: 'autoApproveKyc', value: false, description: 'Whether to auto approve wholesaler KYC' } },
      { upsert: true }
    );

    console.log('Platform settings initialized. No sample accounts, catalog, or orders were created.');
  } finally {
    await disconnectDB();
  }
}

if (require.main === module) {
  seedPlatformSettings().catch((error) => {
    console.error(`Platform settings initialization failed: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = seedPlatformSettings;
