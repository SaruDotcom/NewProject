const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const env = require('../src/config/env');
const mongoose = require('mongoose');
const models = require('../src/models');

async function cleanupDemoData(args = process.argv.slice(2)) {
  if (!args.includes('--confirm')) {
    throw new Error('Pass --confirm to permanently remove records explicitly marked isDemo=true.');
  }
  if (env.NODE_ENV === 'production' && !args.includes('--confirm-production')) {
    throw new Error('Refusing to clean demo records in production without --confirm-production.');
  }
  if (!env.MONGO_URI) {
    throw new Error('MONGO_URI is required.');
  }

  try {
    const connection = await mongoose.connect(env.MONGO_URI, { autoIndex: true, serverSelectionTimeoutMS: 5000 });
    console.log(`Cleaning only records marked isDemo=true in database: ${connection.connection.name}`);

    const demoModels = Object.values(models)
      .filter((model) => model?.schema?.path('isDemo'))
      .reverse();

    for (const Model of demoModels) {
      const { deletedCount = 0 } = await Model.deleteMany({ isDemo: true });
      if (deletedCount > 0) console.log(`${Model.modelName}: removed ${deletedCount} demo record(s)`);
    }
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  cleanupDemoData().catch((error) => {
    console.error(`Demo data cleanup failed: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = cleanupDemoData;
