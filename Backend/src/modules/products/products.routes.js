const express = require('express');
const router = express.Router();
const productController = require('./products.controller');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const { validateCategoryAttributesMiddleware } = require('./products.validation');
const { ROLES } = require('../../config/constants');
const upload = require('../../middleware/upload');

// Explicit named subroutes
router.post('/upload', authenticate, authorize(ROLES.WHOLESALER, ROLES.SUPER_ADMIN, ROLES.ADMIN), upload.array('images', 5), productController.uploadImages);
router.get('/admin', authenticate, authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN), productController.listAdminProducts);
router.patch('/admin/:id/status', authenticate, authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN), productController.updateStatus);
router.delete('/admin/:id', authenticate, authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN), productController.deleteProduct);

router.get('/wholesaler', authenticate, authorize(ROLES.WHOLESALER, ROLES.SUPER_ADMIN, ROLES.ADMIN), productController.listWholesalerProducts);
router.post('/wholesaler', authenticate, authorize(ROLES.WHOLESALER, ROLES.SUPER_ADMIN, ROLES.ADMIN), validateCategoryAttributesMiddleware, productController.createProduct);
router.put('/wholesaler/:id', authenticate, authorize(ROLES.WHOLESALER, ROLES.SUPER_ADMIN, ROLES.ADMIN), validateCategoryAttributesMiddleware, productController.updateProduct);
router.delete('/wholesaler/:id', authenticate, authorize(ROLES.WHOLESALER, ROLES.SUPER_ADMIN, ROLES.ADMIN), productController.deleteProduct);

router.get('/retailer', authenticate, authorize(ROLES.RETAILER), productController.listRetailerProducts);

// Direct root REST routes (when mounted at /wholesaler/products or /admin/products or /products)
router.post('/', authenticate, authorize(ROLES.WHOLESALER, ROLES.SUPER_ADMIN, ROLES.ADMIN), validateCategoryAttributesMiddleware, productController.createProduct);
router.get('/', authenticate, (req, res, next) => {
  if (req.user.role === ROLES.WHOLESALER) return productController.listWholesalerProducts(req, res, next);
  if (req.user.role === ROLES.SUPER_ADMIN || req.user.role === ROLES.ADMIN) return productController.listAdminProducts(req, res, next);
  return productController.listRetailerProducts(req, res, next);
});
router.put('/:id', authenticate, authorize(ROLES.WHOLESALER, ROLES.SUPER_ADMIN, ROLES.ADMIN), validateCategoryAttributesMiddleware, productController.updateProduct);
router.patch('/:id/status', authenticate, authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN), productController.updateStatus);
router.delete('/:id', authenticate, authorize(ROLES.WHOLESALER, ROLES.SUPER_ADMIN, ROLES.ADMIN), productController.deleteProduct);
router.get('/:id', productController.getProductById);

module.exports = router;
