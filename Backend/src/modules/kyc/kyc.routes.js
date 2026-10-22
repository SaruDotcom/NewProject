const express = require('express');
const router = express.Router();
const kycController = require('./kyc.controller');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const upload = require('../../middleware/upload');
const { ROLES } = require('../../config/constants');

// Secure document retrieval
router.get('/documents/:docId', authenticate, kycController.getDocumentFile);

// Named subroutes
router.post('/wholesaler', authenticate, authorize(ROLES.WHOLESALER), upload.any(), kycController.submitKyc);
router.get('/wholesaler', authenticate, authorize(ROLES.WHOLESALER), kycController.getMyKyc);

router.get('/admin', authenticate, authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN), kycController.listKyc);
router.get('/admin/documents/:docId', authenticate, kycController.getDocumentFile);
router.get('/admin/:id', authenticate, authorize(ROLES.SUPER_ADMIN), kycController.getKycById);
router.patch('/admin/:id/approve', authenticate, authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN), kycController.approveKyc);
router.patch('/admin/:id/reject', authenticate, authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN), kycController.rejectKyc);
router.patch('/admin/:id/resubmission', authenticate, authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN), kycController.requestResubmission);

// Direct root routes when mounted on /admin/kyc or /wholesaler/kyc
router.post('/', authenticate, authorize(ROLES.WHOLESALER), upload.any(), kycController.submitKyc);
router.get('/', authenticate, (req, res, next) => {
  if (req.user.role === ROLES.WHOLESALER) return kycController.getMyKyc(req, res, next);
  return kycController.listKyc(req, res, next);
});
router.get('/:id', authenticate, authorize(ROLES.SUPER_ADMIN), kycController.getKycById);
router.patch('/:id/approve', authenticate, authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN), kycController.approveKyc);
router.patch('/:id/reject', authenticate, authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN), kycController.rejectKyc);
router.patch('/:id/resubmission', authenticate, authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN), kycController.requestResubmission);

module.exports = router;
