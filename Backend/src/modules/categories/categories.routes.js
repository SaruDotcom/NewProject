const express = require('express');
const router = express.Router();
const categoryController = require('./categories.controller');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const { ROLES } = require('../../config/constants');

// Tree endpoints
router.get('/tree', categoryController.getCategoryTree);
router.get('/admin/tree', authenticate, authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN), categoryController.getCategoryTree);
router.get('/wholesaler/tree', authenticate, authorize(ROLES.WHOLESALER, ROLES.SUPER_ADMIN, ROLES.ADMIN), categoryController.getCategoryTree);

// Named subroutes
router.get('/admin', authenticate, authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN), categoryController.listCategories);
router.post('/admin', authenticate, authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN), categoryController.createCategory);
router.get('/admin/:id', authenticate, authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN), categoryController.getCategoryById);
router.patch('/admin/:id', authenticate, authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN), categoryController.updateCategory);
router.delete('/admin/:id', authenticate, authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN), categoryController.deleteCategory);

router.get('/wholesaler', authenticate, authorize(ROLES.WHOLESALER, ROLES.SUPER_ADMIN, ROLES.ADMIN), categoryController.listCategories);
router.post('/wholesaler', authenticate, authorize(ROLES.WHOLESALER, ROLES.SUPER_ADMIN, ROLES.ADMIN), categoryController.createCategory);
router.put('/wholesaler/:id', authenticate, authorize(ROLES.WHOLESALER, ROLES.SUPER_ADMIN, ROLES.ADMIN), categoryController.updateCategory);
router.delete('/wholesaler/:id', authenticate, authorize(ROLES.WHOLESALER, ROLES.SUPER_ADMIN, ROLES.ADMIN), categoryController.deleteCategory);

// Direct root REST routes (when mounted at /admin/categories, /wholesaler/categories, or /categories)
router.get('/', authenticate, categoryController.listCategories);
router.post('/', authenticate, authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.WHOLESALER), categoryController.createCategory);
router.get('/:id', categoryController.getCategoryById);
router.patch('/:id', authenticate, authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN), categoryController.updateCategory);
router.put('/:id', authenticate, authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.WHOLESALER), categoryController.updateCategory);
router.delete('/:id', authenticate, authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.WHOLESALER), categoryController.deleteCategory);

module.exports = router;
