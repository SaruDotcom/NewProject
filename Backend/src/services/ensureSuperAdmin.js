const { User, AdminProfile } = require('../models');
const { ROLES, USER_STATUS } = require('../config/constants');
const env = require('../config/env');
const logger = require('../config/logger');

const ensureSuperAdmin = async () => {
  try {
    const email = (env.SUPER_ADMIN_EMAIL || 'admin@yourapp.com').toLowerCase().trim();
    const password = env.SUPER_ADMIN_PASSWORD || 'ChangeThisPassword123';
    
    let user = await User.findOne({ email });
    const passwordHash = await User.hashPassword(password);

    if (!user) {
      user = new User({
        name: 'Super Administrator',
        email,
        passwordHash,
        role: ROLES.SUPER_ADMIN,
        status: USER_STATUS.ACTIVE,
        emailVerified: true,
      });
      await user.save();

      const adminProfile = await AdminProfile.create({
        userId: user._id,
        department: 'Executive Operations',
        permissions: ['*'],
        isSuperAdmin: true,
      });

      user.adminProfile = adminProfile._id;
      await user.save();
      logger.info(`👑 Initialized Super Admin user: ${email}`);
    } else {
      user.passwordHash = passwordHash;
      user.role = ROLES.SUPER_ADMIN;
      user.status = USER_STATUS.ACTIVE;
      user.emailVerified = true;
      await user.save();
      logger.info(`👑 Super Admin account verified: ${email}`);
    }
  } catch (err) {
    logger.error(`Ensure Super Admin warning: ${err.message}`);
  }
};

module.exports = ensureSuperAdmin;
