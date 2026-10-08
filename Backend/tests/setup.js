const mongoose = require('mongoose');
const env = require('../src/config/env');

const clearDatabase = async () => {
  if (mongoose.connection.readyState === 1) {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }
  }
};

const setupTestDB = () => {
  beforeAll(async () => {
    if (mongoose.connection.readyState !== 1) {
      if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
      }
      await mongoose.connect(env.MONGO_URI);
    }
  });

  afterAll(async () => {
    await clearDatabase();
    await mongoose.disconnect();
  });
};

module.exports = {
  setupTestDB,
  clearDatabase,
};
