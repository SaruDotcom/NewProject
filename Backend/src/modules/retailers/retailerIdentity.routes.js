const express = require('express');
const router = express.Router();
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/apiResponse');
const { ROLES } = require('../../config/constants');
const { identityUpload, RetailerIdentityService } = require('../../services/retailerIdentity.service');
const { identityUploadRateLimiter } = require('../../middleware/rateLimiter');
const { BadRequestError } = require('../../utils/errors');

router.use(authenticate);
router.use(authorize(ROLES.RETAILER, ROLES.WHOLESALER, ROLES.SUPER_ADMIN));

router.get('/:retailerId/profile', asyncHandler(async (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  const profile = await RetailerIdentityService.getIdentityProfile(req.params.retailerId, req.user);
  return ApiResponse.success(res, profile, 'Retailer identity profile retrieved');
}));

router.get('/:retailerId/aadhaar', asyncHandler(async (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  const result = await RetailerIdentityService.revealAadhaar(req.params.retailerId, req.user, req);
  return ApiResponse.success(res, result, 'Aadhaar number retrieved');
}));

router.get('/:retailerId/documents/:documentType', asyncHandler(async (req, res) => {
  if (!['shop-photo', 'pan', 'aadhaar-front', 'aadhaar-back'].includes(req.params.documentType)) {
    throw new BadRequestError('Unsupported retailer document type.', 'INVALID_DOCUMENT_TYPE');
  }
  await RetailerIdentityService.streamDocument(
    req.params.retailerId,
    req.params.documentType,
    req.user,
    req,
    res
  );
}));

router.patch(
  '/:retailerId/profile',
  authorize(ROLES.RETAILER),
  identityUploadRateLimiter,
  identityUpload,
  asyncHandler(async (req, res) => {
    const result = await RetailerIdentityService.updateIdentity(
      req.params.retailerId,
      req.body,
      req.files
    );
    return ApiResponse.success(res, result, 'Retailer identity details updated');
  })
);

router.patch(
  '/:retailerId/verification',
  authorize(ROLES.WHOLESALER, ROLES.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const result = await RetailerIdentityService.updateVerification(
      req.params.retailerId,
      req.user,
      req.body.status,
      req.body.note,
      req
    );
    return ApiResponse.success(res, result, 'Retailer verification status updated');
  })
);

module.exports = router;
