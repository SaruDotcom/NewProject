const express = require('express');
const router = express.Router();
const orderController = require('./orders.controller');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const idempotency = require('../../middleware/idempotency');
const { ROLES } = require('../../config/constants');

router.use(authenticate);

// List orders (All authenticated roles)
router.get('/', orderController.listOrders);

// Get single order
router.get('/:id', orderController.getOrderById);

// Retailer create order (with idempotency support)
router.post('/', authorize(ROLES.RETAILER), idempotency, orderController.createOrder);

// Update order status (Super Admin, Admin, Wholesaler)
router.patch(
  '/:id/status',
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.WHOLESALER),
  orderController.updateOrderStatus
);

// Returns Management
router.get('/returns/all', authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.WHOLESALER), orderController.listReturns);
router.patch('/returns/:id/status', authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.WHOLESALER), orderController.updateReturnStatus);

module.exports = router;
