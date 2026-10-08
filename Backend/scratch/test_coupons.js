const mongoose = require('mongoose');
require('dotenv').config();

async function test() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/wholesaller');
  console.log('DB Connected successfully');

  const { Coupon } = require('../src/models');
  const AdminService = require('../src/modules/admins/admins.service');

  const coupons = await AdminService.getCoupons();
  console.log('GET COUPONS RESULT:', JSON.stringify(coupons, null, 2));

  mongoose.disconnect();
}

test().catch((err) => {
  console.error('TEST ERROR:', err);
  process.exit(1);
});
