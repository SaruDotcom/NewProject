const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const User = require('./src/models/User');

const envPath = require('path').resolve(__dirname, './.env');
require('dotenv').config({ path: envPath });

async function runTest() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to DB");

  const retailers = await User.find({ role: 'RETAILER' }).limit(2);
  if (retailers.length < 2) {
    console.log("Not enough retailers to test");
    process.exit(0);
  }

  for (let i = 0; i < 2; i++) {
    const retailer = retailers[i];
    const payload = {
      id: retailer._id,
      email: retailer.email,
      role: retailer.role,
    };
    const token = jwt.sign(payload, process.env.JWT_ACCESS_SECRET, {
      expiresIn: process.env.JWT_ACCESS_EXPIRES,
    });

    console.log(`\n--- Testing Retailer ${i + 1} (${retailer._id}) ---`);
    try {
      const res = await fetch('http://localhost:5001/api/v1/retailer/products', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      console.log(`Retailer ${i + 1} Products:`, data?.data?.length, data?.data?.[0]?.wholesalerId);
    } catch (err) {
      console.error(`Retailer ${i + 1} Error:`, err.response?.data || err.message);
    }
  }

  mongoose.connection.close();
}

runTest().catch(console.error);
