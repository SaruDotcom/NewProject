const rateLimit = require('express-rate-limit');
const env = require('../config/env');

const isTest = () => process.env.NODE_ENV === 'test' || env.NODE_ENV === 'test';

const apiRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.',
    code: 'TOO_MANY_REQUESTS',
  },
  skip: isTest,
});

const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: env.AUTH_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many authentication attempts. Please try again in 15 minutes.',
    code: 'AUTH_RATE_LIMIT_EXCEEDED',
  },
  skip: isTest,
});

module.exports = {
  apiRateLimiter,
  authRateLimiter,
};
