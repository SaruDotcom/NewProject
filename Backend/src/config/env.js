const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const requiredMongoUri = process.env.NODE_ENV === 'test'
  ? (process.env.TEST_MONGO_URI || 'mongodb://localhost:27017/b2b_wholesale_test')
  : process.env.MONGO_URI;

if (!requiredMongoUri) {
  throw new Error('MONGO_URI is required. Set it in Backend/.env so data is saved to the configured database.');
}

const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '5000', 10),
  MONGO_URI: requiredMongoUri,
  
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || 'super_secret_access_jwt_key_at_least_32_characters_long_b2b_wholesale_platform',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'super_secret_refresh_jwt_key_at_least_32_characters_long_b2b_wholesale_platform',
  JWT_ACCESS_EXPIRES: process.env.JWT_ACCESS_EXPIRES || '15m',
  JWT_REFRESH_EXPIRES: process.env.JWT_REFRESH_EXPIRES || '7d',
  
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:3000,http://localhost:5173,http://localhost:3001,http://localhost:5000,https://updated-wholeseller.vercel.app,http://updated-wholeseller.vercel.app,https://updated-wholeseller-vohj.vercel.app,http://updated-wholeseller-vohj.vercel.app,https://updated-wholeseller-op2x.vercel.app,http://updated-wholeseller-op2x.vercel.app',
  
  STORAGE_PROVIDER: process.env.STORAGE_PROVIDER || 'local',
  STORAGE_BUCKET: process.env.STORAGE_BUCKET || 'uploads',
  UPLOAD_PATH: process.env.UPLOAD_PATH || path.resolve(__dirname, '../../uploads'),
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME || '',
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY || '',
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET || '',
  RETAILER_IDENTITY_ENCRYPTION_KEY: process.env.RETAILER_IDENTITY_ENCRYPTION_KEY || '',

  LOG_LEVEL: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  
  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
  RATE_LIMIT_MAX: parseInt(process.env.RATE_LIMIT_MAX || '1000', 10),
  AUTH_RATE_LIMIT_MAX: parseInt(process.env.AUTH_RATE_LIMIT_MAX || '30', 10),
  WALLET_SETTLEMENT_DAYS: Math.max(0, parseInt(process.env.WALLET_SETTLEMENT_DAYS || '7', 10)),

  SUPER_ADMIN_EMAIL: process.env.SUPER_ADMIN_EMAIL || 'admin@yourapp.com',
  SUPER_ADMIN_PASSWORD: process.env.SUPER_ADMIN_PASSWORD || 'ChangeThisPassword123',

  EMAIL_PROVIDER_API_KEY: process.env.EMAIL_PROVIDER_API_KEY || '',
  EMAIL_FROM: process.env.EMAIL_FROM || '',
  EMAIL_FROM_NAME: process.env.EMAIL_FROM_NAME || '',
  SMTP_HOST: process.env.SMTP_HOST || 'smtp.gmail.com',
  SMTP_PORT: parseInt(process.env.SMTP_PORT || '465', 10),
  SMTP_SECURE: process.env.SMTP_SECURE !== 'false',
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_APP_PASSWORD: process.env.SMTP_APP_PASSWORD || '',
  RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID || '',
  RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET || '',
};

env.assertCloudinaryConfigured = () => {
  const missing = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET']
    .filter((key) => !env[key]);
  if (missing.length) {
    throw new Error(`Cloudinary product-image uploads require: ${missing.join(', ')}`);
  }
};

env.assertEmailConfigured = () => {
  const missing = ['EMAIL_PROVIDER_API_KEY', 'EMAIL_FROM', 'EMAIL_FROM_NAME']
    .filter((key) => !env[key]);
  if (missing.length) {
    throw new Error(`Email service is not configured. Set: ${missing.join(', ')}`);
  }
};

env.assertSmtpConfigured = () => {
  const missing = ['SMTP_HOST', 'SMTP_USER', 'SMTP_APP_PASSWORD']
    .filter((key) => !env[key]);
  if (missing.length) {
    throw new Error(`Password reset email requires Gmail SMTP settings: ${missing.join(', ')}`);
  }
};

module.exports = env;
