const { WholesalerRetailerRelationship, WholesalerProfile } = require('../../models');
const AuditService = require('../../services/audit.service');
const RetailerService = require('../../services/retailer.service');
const ApiResponse = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');

class RetailerController {
  // Dashboard & Metrics
  getDashboard = asyncHandler(async (req, res) => {
    const data = await RetailerService.getDashboard(req.user._id);
    return ApiResponse.success(res, data, 'Retailer dashboard data retrieved successfully');
  });

  getCreditInfo = asyncHandler(async (req, res) => {
    const relationship = await WholesalerRetailerRelationship.findOne({
      retailerId: req.user._id,
      status: 'ACTIVE',
    });

    if (!relationship) {
      return ApiResponse.success(
        res,
        { creditEnabled: false, reason: 'NO_ACTIVE_WHOLESALER' },
        'No active wholesaler relationship'
      );
    }

    const wholesalerProfile = await WholesalerProfile.findOne({ userId: relationship.wholesalerId });
    const creditPolicy = wholesalerProfile?.creditPolicy || {};

    const effectiveLimit = relationship.customCreditLimit !== null && relationship.customCreditLimit !== undefined
      ? relationship.customCreditLimit
      : (creditPolicy.defaultCreditLimit || 0);

    const outstanding = Number.isSafeInteger(relationship.currentOutstandingPaise)
      ? relationship.currentOutstandingPaise / 100
      : Number(relationship.currentOutstandingAmount || 0);
    const availableCredit = Math.max(0, effectiveLimit - outstanding);

    return ApiResponse.success(
      res,
      {
        wholesalerId: String(relationship.wholesalerId),
        creditEnabled: Boolean(creditPolicy.creditEnabled && relationship.creditEnabled && relationship.creditStatus === 'APPROVED'),
        creditStatus: relationship.creditStatus || 'DISABLED',
        defaultCreditLimit: creditPolicy.defaultCreditLimit || 0,
        customCreditLimit: relationship.customCreditLimit,
        effectiveLimit,
        currentOutstandingAmount: outstanding,
        availableCredit,
        creditPeriodDays: creditPolicy.creditPeriodDays || 15,
        lateFeePercent: creditPolicy.lateFeePercent || 0,
        minOrderForCredit: creditPolicy.minOrderForCredit || 0,
        allowCOD: creditPolicy.allowCOD !== undefined ? Boolean(creditPolicy.allowCOD) : true,
      },
      'Credit info retrieved'
    );
  });

  requestCredit = asyncHandler(async (req, res) => {
    const relationship = await WholesalerRetailerRelationship.findOne({
      retailerId: req.user._id,
      status: 'ACTIVE',
    });
    if (!relationship) {
      return ApiResponse.error(res, 'Connect to a wholesaler before requesting credit.', 403, 'NO_ACTIVE_WHOLESALER');
    }
    if (relationship.creditStatus === 'APPROVED' && relationship.creditEnabled) {
      return ApiResponse.success(res, { creditStatus: 'APPROVED' }, 'Credit is already enabled');
    }
    relationship.creditStatus = 'PENDING_APPROVAL';
    relationship.creditEnabled = false;
    await relationship.save();
    await AuditService.log({
      actorId: req.user._id,
      actorRole: req.user.role,
      action: 'CREATE',
      entityType: 'RetailerCreditRequest',
      entityId: relationship._id,
      after: { wholesalerId: String(relationship.wholesalerId), creditStatus: relationship.creditStatus },
      req,
    });
    return ApiResponse.success(res, { creditStatus: relationship.creditStatus }, 'Credit request submitted');
  });

  // Profile Management
  getProfile = asyncHandler(async (req, res) => {
    const user = await RetailerService.getProfile(req.user._id);
    return ApiResponse.success(res, user, 'Profile retrieved successfully');
  });

  updateProfile = asyncHandler(async (req, res) => {
    const updated = await RetailerService.updateProfile(req.user._id, req.body);
    return ApiResponse.success(res, updated, 'Profile updated successfully');
  });

  getBusinessProfile = asyncHandler(async (req, res) => {
    const profile = await RetailerService.getBusinessProfile(req.user._id);
    return ApiResponse.success(res, profile, 'Business profile retrieved successfully');
  });

  updateBusinessProfile = asyncHandler(async (req, res) => {
    const updated = await RetailerService.updateBusinessProfile(req.user._id, req.body);
    return ApiResponse.success(res, updated, 'Business profile updated successfully');
  });

  // Store & Connected Wholesaler
  getConnectedWholesaler = asyncHandler(async (req, res) => {
    const wholesaler = await RetailerService.getConnectedWholesaler(req.user._id);
    console.log(`[DEBUG] getConnectedWholesaler - Retailer ID: ${req.user._id} | Connected Wholesaler Data:`, wholesaler ? wholesaler.businessName : 'NULL');
    return ApiResponse.success(res, wholesaler, 'Connected wholesaler details retrieved');
  });

  getStore = asyncHandler(async (req, res) => {
    const store = await RetailerService.getStore(req.user._id);
    return ApiResponse.success(res, store, 'Storefront retrieved successfully');
  });

  // Catalog: Categories & Products
  getCategories = asyncHandler(async (req, res) => {
    const { categories, meta } = await RetailerService.getCategories(req.user._id, req.query);
    return ApiResponse.paginated(res, categories, meta, 'Categories retrieved successfully');
  });

  getProducts = asyncHandler(async (req, res) => {
    const { products, meta } = await RetailerService.getProducts(req.user._id, req.query);
    return ApiResponse.paginated(res, products, meta, 'Products retrieved successfully');
  });

  getProductById = asyncHandler(async (req, res) => {
    const product = await RetailerService.getProductById(req.user._id, req.params.id);
    return ApiResponse.success(res, product, 'Product details retrieved successfully');
  });

  // Cart Operations
  getCart = asyncHandler(async (req, res) => {
    const cart = await RetailerService.getCart(req.user._id);
    return ApiResponse.success(res, cart, 'Cart retrieved successfully');
  });

  addToCart = asyncHandler(async (req, res) => {
    const cart = await RetailerService.addToCart(req.user._id, req.body);
    return ApiResponse.success(res, cart, 'Item added to cart successfully');
  });

  updateCartItem = asyncHandler(async (req, res) => {
    const cart = await RetailerService.updateCartItem(req.user._id, req.params.itemId, req.body.quantity);
    return ApiResponse.success(res, cart, 'Cart item updated successfully');
  });

  removeCartItem = asyncHandler(async (req, res) => {
    const cart = await RetailerService.removeCartItem(req.user._id, req.params.itemId);
    return ApiResponse.success(res, cart, 'Item removed from cart successfully');
  });

  clearCart = asyncHandler(async (req, res) => {
    const cart = await RetailerService.clearCart(req.user._id);
    return ApiResponse.success(res, cart, 'Cart cleared successfully');
  });

  // Checkout
  checkout = asyncHandler(async (req, res) => {
    const order = await RetailerService.checkout(req.user, req.body, req);
    return ApiResponse.created(res, order, 'Order placed successfully');
  });

  // Orders
  getOrders = asyncHandler(async (req, res) => {
    const { orders, meta } = await RetailerService.getOrders(req.user._id, req.query);
    return ApiResponse.paginated(res, orders, meta, 'Orders retrieved successfully');
  });

  getOrderById = asyncHandler(async (req, res) => {
    const orderData = await RetailerService.getOrderById(req.user._id, req.params.id);
    return ApiResponse.success(res, orderData, 'Order details retrieved successfully');
  });

  cancelOrder = asyncHandler(async (req, res) => {
    const order = await RetailerService.cancelOrder(req.user._id, req.params.id, req.body.reason, req.body.note, req.user, req);
    return ApiResponse.success(res, order, 'Order cancelled successfully');
  });

  // Address Book
  getAddresses = asyncHandler(async (req, res) => {
    const addresses = await RetailerService.getAddresses(req.user._id);
    return ApiResponse.success(res, addresses, 'Addresses retrieved successfully');
  });

  createAddress = asyncHandler(async (req, res) => {
    const address = await RetailerService.createAddress(req.user._id, req.body);
    return ApiResponse.created(res, address, 'Address added successfully');
  });

  updateAddress = asyncHandler(async (req, res) => {
    const address = await RetailerService.updateAddress(req.user._id, req.params.id, req.body);
    return ApiResponse.success(res, address, 'Address updated successfully');
  });

  deleteAddress = asyncHandler(async (req, res) => {
    const result = await RetailerService.deleteAddress(req.user._id, req.params.id);
    return ApiResponse.success(res, result, 'Address deleted successfully');
  });

  setDefaultAddress = asyncHandler(async (req, res) => {
    const address = await RetailerService.setDefaultAddress(req.user._id, req.params.id);
    return ApiResponse.success(res, address, 'Default address updated successfully');
  });

  // Wishlist
  getWishlist = asyncHandler(async (req, res) => {
    const wishlist = await RetailerService.getWishlist(req.user._id);
    return ApiResponse.success(res, wishlist, 'Wishlist retrieved successfully');
  });

  addToWishlist = asyncHandler(async (req, res) => {
    const productId = req.params.productId || req.body.productId;
    const wishlist = await RetailerService.addToWishlist(req.user._id, productId);
    return ApiResponse.success(res, wishlist, 'Item added to wishlist');
  });

  removeFromWishlist = asyncHandler(async (req, res) => {
    const wishlist = await RetailerService.removeFromWishlist(req.user._id, req.params.productId);
    return ApiResponse.success(res, wishlist, 'Item removed from wishlist');
  });

  // Returns
  getReturns = asyncHandler(async (req, res) => {
    const returns = await RetailerService.getReturns(req.user._id, req.query);
    return ApiResponse.success(res, returns, 'Returns retrieved successfully');
  });

  createReturn = asyncHandler(async (req, res) => {
    const returnDoc = await RetailerService.createReturn(req.user._id, req.body);
    return ApiResponse.created(res, returnDoc, 'Return request submitted successfully');
  });

  getReturnById = asyncHandler(async (req, res) => {
    const returnDoc = await RetailerService.getReturnById(req.user._id, req.params.id);
    return ApiResponse.success(res, returnDoc, 'Return details retrieved successfully');
  });

  cancelReturn = asyncHandler(async (req, res) => {
    const returnDoc = await RetailerService.cancelReturn(req.user._id, req.params.id);
    return ApiResponse.success(res, returnDoc, 'Return request cancelled successfully');
  });

  // Support Tickets
  getSupportTickets = asyncHandler(async (req, res) => {
    const tickets = await RetailerService.getSupportTickets(req.user._id);
    return ApiResponse.success(res, tickets, 'Support tickets retrieved successfully');
  });

  createSupportTicket = asyncHandler(async (req, res) => {
    const ticket = await RetailerService.createSupportTicket(req.user, req.body);
    return ApiResponse.created(res, ticket, 'Support ticket created successfully');
  });

  getSupportTicketById = asyncHandler(async (req, res) => {
    const ticket = await RetailerService.getSupportTicketById(req.user._id, req.params.id);
    return ApiResponse.success(res, ticket, 'Support ticket details retrieved successfully');
  });

  sendSupportMessage = asyncHandler(async (req, res) => {
    const ticket = await RetailerService.sendSupportMessage(req.user, req.params.id, req.body);
    return ApiResponse.success(res, ticket, 'Message sent successfully');
  });

  // Financials & Wallet
  getPayments = asyncHandler(async (req, res) => {
    const { payments, meta } = await RetailerService.getPayments(req.user._id, req.query);
    return ApiResponse.paginated(res, payments, meta, 'Payments retrieved successfully');
  });

  getWallet = asyncHandler(async (req, res) => {
    const wallet = await RetailerService.getWallet(req.user._id);
    return ApiResponse.success(res, wallet, 'Wallet details retrieved successfully');
  });

  getWalletTransactions = asyncHandler(async (req, res) => {
    const { transactions, meta } = await RetailerService.getWalletTransactions(req.user._id, req.query);
    return ApiResponse.paginated(res, transactions, meta, 'Wallet transactions retrieved successfully');
  });

  getTransactions = asyncHandler(async (req, res) => {
    const { transactions, meta } = await RetailerService.getTransactions(req.user._id, req.query);
    return ApiResponse.paginated(res, transactions, meta, 'Transactions retrieved successfully');
  });

  getAnalytics = asyncHandler(async (req, res) => {
    const analytics = await RetailerService.getAnalytics(req.user._id);
    return ApiResponse.success(res, analytics, 'Analytics data retrieved successfully');
  });

  getAnalyticsSummary = asyncHandler(async (req, res) => {
    const analytics = await RetailerService.getAnalyticsSummary(req.user._id);
    return ApiResponse.success(res, analytics, 'Analytics summary retrieved successfully');
  });

  getAnalyticsOrders = asyncHandler(async (req, res) => {
    const analytics = await RetailerService.getAnalyticsOrders(req.user._id);
    return ApiResponse.success(res, analytics, 'Order analytics retrieved successfully');
  });

  getAnalyticsSpending = asyncHandler(async (req, res) => {
    const analytics = await RetailerService.getAnalyticsSpending(req.user._id);
    return ApiResponse.success(res, analytics, 'Spending analytics retrieved successfully');
  });

  getAnalyticsProducts = asyncHandler(async (req, res) => {
    const analytics = await RetailerService.getAnalyticsProducts(req.user._id);
    return ApiResponse.success(res, analytics, 'Product analytics retrieved successfully');
  });

  acceptInvitation = asyncHandler(async (req, res) => {
    const result = await RetailerService.acceptInvitation(req.user, req.body.token, req);
    return ApiResponse.success(res, result, 'Wholesaler invitation accepted successfully');
  });
}

module.exports = new RetailerController();
