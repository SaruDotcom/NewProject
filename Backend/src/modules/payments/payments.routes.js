const express = require('express');
const multer = require('multer');
const path = require('path');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const { ROLES } = require('../../config/constants');
const { identityUploadRateLimiter } = require('../../middleware/rateLimiter');
const controller = require('./payments.controller');
const { BadRequestError } = require('../../utils/errors');

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter(_req, file, callback) {
    const extension = path.extname(file.originalname || '').toLowerCase();
    const valid = {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp'],
      'application/pdf': ['.pdf'],
    };
    if (!valid[file.mimetype]?.includes(extension)) {
      return callback(new BadRequestError('Upload a JPG, PNG, WEBP, or PDF receipt up to 5 MB.', 'INVALID_PAYMENT_IMAGE'));
    }
    return callback(null, true);
  },
});

const retailerRoutes = express.Router();
retailerRoutes.use(authenticate, authorize(ROLES.RETAILER));
retailerRoutes.get('/payment-options', controller.getRetailerOptions);
retailerRoutes.post('/payment-options/qr-session', controller.createRetailerQrSession);
retailerRoutes.get('/payments/reports', controller.listRetailerReports);
retailerRoutes.post('/payments/reports', identityUploadRateLimiter, imageUpload.single('screenshot'), controller.createReport);
retailerRoutes.get('/payments/reports/:reportId/screenshot', controller.getScreenshot);

const wholesalerRoutes = express.Router();
wholesalerRoutes.use(authenticate, authorize(ROLES.WHOLESALER));
wholesalerRoutes.get('/payment-settings', controller.getSettings);
wholesalerRoutes.patch('/payment-settings', identityUploadRateLimiter, imageUpload.single('qrImage'), controller.updateSettings);
wholesalerRoutes.get('/payment-reports', controller.listWholesalerReports);
wholesalerRoutes.post('/payment-reports/:reportId/approval-otp', identityUploadRateLimiter, controller.requestApprovalOtp);
wholesalerRoutes.patch('/payment-reports/:reportId', controller.reviewReport);
wholesalerRoutes.post('/payment-reports/:reportId/reverse', controller.reverseReport);
wholesalerRoutes.get('/payment-reports/:reportId/screenshot', controller.getScreenshot);

const adminRoutes = express.Router();
adminRoutes.get('/', authenticate, authorize(ROLES.SUPER_ADMIN), controller.listAdminReports);
adminRoutes.get('/:reportId/screenshot', authenticate, authorize(ROLES.SUPER_ADMIN), controller.getScreenshot);

module.exports = { retailerRoutes, wholesalerRoutes, adminRoutes };
