const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { User } = require('../models');
const { UnauthorizedError } = require('../utils/errors');
const asyncHandler = require('../utils/asyncHandler');
const accountStatus = require('./account-status');

const authenticate = asyncHandler(async (req, res, next) => {
  let token;
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }

  if (!token) {
    throw new UnauthorizedError('Authentication token missing or invalid');
  }

  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET);
    const user = await User.findById(decoded.id)
      .populate('wholesalerProfile')
      .populate('retailerProfile')
      .populate('adminProfile');

    if (!user || user.isDeleted) {
      throw new UnauthorizedError('User account not found or deactivated');
    }

    req.user = user;
    accountStatus(req, res, next);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new UnauthorizedError('Authentication token has expired', 'TOKEN_EXPIRED');
    }
    if (error.name === 'JsonWebTokenError') {
      throw new UnauthorizedError('Invalid authentication token', 'INVALID_TOKEN');
    }
    throw error;
  }
});

module.exports = authenticate;
