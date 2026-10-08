const express = require('express');
const router = express.Router();
const retailerController = require('./retailer.controller');
const retailerPortalController = require('./retailerPortal.controller');
const notificationController = require('../notifications/notifications.controller');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const validate = require('../../middleware/validate');
const idempotency = require('../../middleware/idempotency');
const { ROLES } = require('../../config/constants');
const {
  addToCartSchema,
  updateCartItemSchema,
  checkoutSchema,
  addressSchema,
  updateAddressSchema,
  createReturnSchema,
  createTicketSchema,
  sendTicketMessageSchema,
  updateProfileSchema,
  updateBusinessProfileSchema,
  acceptInviteSchema,
  cancelOrderSchema,
} = require('./retailer.validation');

// Require authentication and RETAILER role for all routes in this router
router.use(authenticate, authorize(ROLES.RETAILER));

// Dashboard
router.get('/dashboard', retailerController.getDashboard);

// Profile
router.get('/profile', retailerController.getProfile);
router.patch('/profile', validate(updateProfileSchema), retailerController.updateProfile);
router.get('/profile/business', retailerController.getBusinessProfile);
router.patch('/profile/business', validate(updateBusinessProfileSchema), retailerController.updateBusinessProfile);

// Connected Wholesaler & Storefront
router.get('/wholesaler', retailerController.getConnectedWholesaler);
router.get('/credit-info', retailerController.getCreditInfo);
router.get('/store', retailerController.getStore);
router.get('/connections', retailerPortalController.getConnections);

// Catalog: Categories & Products
router.get('/categories', retailerController.getCategories);
router.get('/products', retailerController.getProducts);
router.get('/products/:wholesalerId/catalog', retailerPortalController.getWholesalerCatalog);
router.get('/products/:id', retailerController.getProductById);

// Cart
router.get('/cart', retailerController.getCart);
router.post('/cart', validate(addToCartSchema), retailerController.addToCart);
router.post('/cart/items', validate(addToCartSchema), retailerController.addToCart);
router.put('/cart/items/:itemId', validate(updateCartItemSchema), retailerController.updateCartItem);
router.patch('/cart/items/:itemId', validate(updateCartItemSchema), retailerController.updateCartItem);
router.delete('/cart/items/:itemId', retailerController.removeCartItem);
router.delete('/cart', retailerController.clearCart);

// Checkout & Orders
router.post('/checkout', idempotency, validate(checkoutSchema), retailerController.checkout);
router.get('/orders', retailerController.getOrders);
router.get('/orders/:id', retailerController.getOrderById);
router.post('/orders/:id/cancel', validate(cancelOrderSchema), retailerController.cancelOrder);
router.patch('/orders/:id/cancel', validate(cancelOrderSchema), retailerController.cancelOrder);

// Address Book
router.get('/addresses', retailerController.getAddresses);
router.post('/addresses', validate(addressSchema), retailerController.createAddress);
router.put('/addresses/:id', validate(updateAddressSchema), retailerController.updateAddress);
router.patch('/addresses/:id', validate(updateAddressSchema), retailerController.updateAddress);
router.delete('/addresses/:id', retailerController.deleteAddress);
router.patch('/addresses/:id/default', retailerController.setDefaultAddress);

// Wishlist
router.get('/wishlist', retailerController.getWishlist);
router.post('/wishlist', retailerController.addToWishlist);
router.post('/wishlist/:productId', retailerController.addToWishlist);
router.delete('/wishlist/:productId', retailerController.removeFromWishlist);

// Returns
router.get('/returns', retailerController.getReturns);
router.post('/returns', validate(createReturnSchema), retailerController.createReturn);
router.get('/returns/:id', retailerController.getReturnById);
router.post('/returns/:id/cancel', retailerController.cancelReturn);

// Support Tickets
router.get('/support/tickets', retailerController.getSupportTickets);
router.post('/support/tickets', validate(createTicketSchema), retailerController.createSupportTicket);
router.get('/support/tickets/:id', retailerController.getSupportTicketById);
router.post('/support/tickets/:id/messages', validate(sendTicketMessageSchema), retailerController.sendSupportMessage);
router.get('/support', retailerController.getSupportTickets);
router.post('/support', validate(createTicketSchema), retailerController.createSupportTicket);
router.get('/support/:id', retailerController.getSupportTicketById);
router.post('/support/:id/messages', validate(sendTicketMessageSchema), retailerController.sendSupportMessage);

// Financials & Wallet
router.get('/payments', retailerController.getPayments);
router.get('/transactions', retailerController.getTransactions);
router.get('/wallet', retailerController.getWallet);
router.get('/wallet/transactions', retailerController.getWalletTransactions);
router.get('/analytics', retailerController.getAnalytics);
router.get('/analytics/summary', retailerController.getAnalyticsSummary);
router.get('/analytics/orders', retailerController.getAnalyticsOrders);
router.get('/analytics/spending', retailerController.getAnalyticsSpending);
router.get('/analytics/products', retailerController.getAnalyticsProducts);

// Notifications
router.get('/notifications', notificationController.listNotifications);
router.patch('/notifications/read-all', notificationController.markAllRead);
router.patch('/notifications/read', notificationController.markAllRead);
router.patch('/notifications/:id/read', notificationController.markAsRead);

// Invitations
router.post('/invitations/accept', validate(acceptInviteSchema), retailerController.acceptInvitation);
router.post('/invite/accept', validate(acceptInviteSchema), retailerController.acceptInvitation);

// Coupons & Offers
const couponController = require('../coupons/coupons.controller');
router.get('/coupons', couponController.getRetailerCoupons);
router.post('/coupons/validate', couponController.validateCoupon);

module.exports = router;
