const express = require('express');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const validate = require('../../middleware/validate');
const { ROLES } = require('../../config/constants');
const controller = require('./purchases.controller');
const schemas = require('./purchases.validation');

const router = express.Router();
router.use(authenticate, authorize(ROLES.WHOLESALER));

router.get('/summary', controller.summary);

router.get('/suppliers', validate(schemas.supplierListSchema, 'query'), controller.listSuppliers);
router.post('/suppliers', validate(schemas.createSupplierSchema), controller.createSupplier);
router.get(
  '/suppliers/:supplierId/ledger',
  validate(schemas.idParamSchema('supplierId'), 'params'),
  validate(schemas.ledgerQuerySchema, 'query'),
  controller.getSupplierLedger
);
router.get(
  '/suppliers/:supplierId/payments',
  validate(schemas.idParamSchema('supplierId'), 'params'),
  controller.listSupplierPayments
);
router.post(
  '/suppliers/:supplierId/payments',
  validate(schemas.idParamSchema('supplierId'), 'params'),
  validate(schemas.paymentSchema),
  controller.createSupplierPayment
);
router.get(
  '/suppliers/:supplierId',
  validate(schemas.idParamSchema('supplierId'), 'params'),
  controller.getSupplier
);
router.patch(
  '/suppliers/:supplierId',
  validate(schemas.idParamSchema('supplierId'), 'params'),
  validate(schemas.updateSupplierSchema),
  controller.updateSupplier
);
router.delete(
  '/suppliers/:supplierId',
  validate(schemas.idParamSchema('supplierId'), 'params'),
  controller.deactivateSupplier
);

router.get('/bills/duplicate', validate(schemas.duplicateQuerySchema, 'query'), controller.checkDuplicate);
router.get('/bills', validate(schemas.purchaseListSchema, 'query'), controller.listPurchases);
router.post('/bills', validate(schemas.purchaseSchema), controller.createPurchase);
router.get('/bills/:billId', validate(schemas.idParamSchema('billId'), 'params'), controller.getPurchase);
router.put(
  '/bills/:billId',
  validate(schemas.idParamSchema('billId'), 'params'),
  validate(schemas.updatePurchaseSchema),
  controller.updatePurchase
);
router.post(
  '/bills/:billId/cancel',
  validate(schemas.idParamSchema('billId'), 'params'),
  validate(schemas.cancellationSchema),
  controller.cancelPurchase
);

router.get('/returns', validate(schemas.returnListSchema, 'query'), controller.listReturns);
router.post('/returns', validate(schemas.purchaseReturnSchema), controller.createReturn);
router.post(
  '/returns/:returnId/cancel',
  validate(schemas.idParamSchema('returnId'), 'params'),
  validate(schemas.cancellationSchema),
  controller.cancelReturn
);
router.post(
  '/payments/:paymentId/reverse',
  validate(schemas.idParamSchema('paymentId'), 'params'),
  validate(schemas.paymentReversalSchema),
  controller.reverseSupplierPayment
);

module.exports = router;
