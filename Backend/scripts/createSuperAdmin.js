const readline = require('readline');
const mongoose = require('mongoose');
const { connectDB, disconnectDB } = require('../src/config/database');
const { User, AdminProfile } = require('../src/models');
const { ROLES, USER_STATUS } = require('../src/config/constants');
const logger = require('../src/config/logger');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const askQuestion = (query) => new Promise((resolve) => rl.question(query, resolve));

const createSuperAdmin = async () => {
  try {
    await connectDB();
    console.log('\n======================================================');
    console.log('🛡️  NEXORA B2B Wholesale — Create Initial Super Admin');
    console.log('======================================================\n');

    const name = (await askQuestion('Enter Super Admin Full Name [Super Administrator]: ')) || 'Super Administrator';
    const email = (await askQuestion('Enter Super Admin Email [admin@nexora.b2b]: ')) || 'admin@nexora.b2b';
    const password = (await askQuestion('Enter Secure Password (min 8 chars) [Admin@123456]: ')) || 'Admin@123456';
    const department = (await askQuestion('Enter Department [Executive Operations]: ')) || 'Executive Operations';

    const normalizedEmail = email.toLowerCase().trim();

    // Check existing
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      if (existing.role === ROLES.SUPER_ADMIN) {
        console.log(`\n⚠️  Super Admin user with email ${normalizedEmail} already exists.`);
        rl.close();
        await disconnectDB();
        process.exit(0);
      } else {
        console.log(`\n❌ User with email ${normalizedEmail} exists with role ${existing.role}. Cannot overwrite.`);
        rl.close();
        await disconnectDB();
        process.exit(1);
      }
    }

    const passwordHash = await User.hashPassword(password);

    const user = new User({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      role: ROLES.SUPER_ADMIN,
      status: USER_STATUS.ACTIVE,
      emailVerified: true,
    });

    await user.save();

    const adminProfile = await AdminProfile.create({
      userId: user._id,
      department,
      permissions: ['*'],
      isSuperAdmin: true,
    });

    user.adminProfile = adminProfile._id;
    await user.save();

    console.log('\n✅ Super Admin created successfully!');
    console.log(`ID: ${user._id}`);
    console.log(`Email: ${user.email}`);
    console.log(`Role: ${user.role}`);
    console.log(`Status: ${user.status}`);
    console.log('======================================================\n');
  } catch (error) {
    console.error(`\n❌ Failed to create Super Admin: ${error.message}`);
  } finally {
    rl.close();
    await disconnectDB();
    process.exit(0);
  }
};

if (require.main === module) {
  createSuperAdmin();
}

module.exports = createSuperAdmin;
