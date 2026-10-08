const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const User = require('./Backend/src/models/User');

const envPath = require('path').resolve(__dirname, './Backend/.env');
require('dotenv').config({ path: envPath });

async function runTest() {
  await mongoose.connect(process.env.MONGODB_URI);
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
      const res = await axios.get('http://localhost:5000/api/v1/retailer/wholesaler', {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log(`Retailer ${i + 1} Connected Wholesaler:`, res.data?.data?.businessName || 'NULL');
    } catch (err) {
      console.error(`Retailer ${i + 1} Error:`, err.response?.data || err.message);
    }
  }

  mongoose.connection.close();
}

runTest().catch(console.error);
