const mongoose = require('mongoose');
const crypto = require('crypto');
const {
  Order,
  Product,
  Inventory,
  InventoryTransaction,
  WholesalerRetailerRelationship,
  WholesalerProfile,
  RetailerProfile,
  Payment,
  Earning,
  Return,
  User,
} = require('../../models');
const {
  ORDER_STATUS,
  PAYMENT_STATUS,
  PAYMENT_METHOD,
  INVENTORY_TRANSACTION_TYPE,
  AUDIT_ACTION,
  NOTIFICATION_TYPE,
  ROLES,
} = require('../../config/constants');
const {
  BadRequestError,
  NotFoundError,
  ForbiddenError,
} = require('../../utils/errors');
const { parsePagination } = require('../../utils/pagination');
const { generateReference } = require('../../utils/crypto');
const AuditService = require('../../services/audit.service');
const NotificationService = require('../../services/notification.service');
const WalletService = require('../../services/wallet.service');
const env = require('../../config/env');

const normalizeOrderAddress = (address = {}) => ({
  street: address.addressLine1 || address.street || '',
  addressLine2: address.addressLine2 || '',
  city: address.city || '',
  state: address.state || '',
  pincode: address.pincode || address.postalCode || '',
  country: address.country || 'India',
  contactName: address.contactName || address.fullName || address.name || '',
  phone: address.phone || '',
});

class OrderService {
  /**
   * Retailer creates new B2B order with authoritative price calculation & inventory reservation
   */
  static async createOrder(retailerUser, orderPayload, req = null, quoteOnly = false) {
    const retailerId = retailerUser._id;
    const { wholesalerId: requestedWholesalerId, items, shippingAddress, billingAddress, paymentMethod, idempotencyKey, couponCode } =
      orderPayload;
    if (paymentMethod === 'ONLINE') {
      throw new BadRequestError('Gateway checkout is no longer available. Choose direct UPI, COD, or approved credit.', 'GATEWAY_CHECKOUT_DISABLED');
    }
    if (paymentMethod && !['UPI', 'COD', 'CREDIT'].includes(paymentMethod)) {
      throw new BadRequestError('Choose direct UPI, COD, or approved credit for retailer checkout.', 'UNSUPPORTED_PAYMENT_METHOD');
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new BadRequestError('Order must contain at least one item', 'EMPTY_ORDER');
    }

    // 1. Verify retailer's active relationship with wholesaler
    const relationship = await WholesalerRetailerRelationship.findOne({
      retailerId,
      status: 'ACTIVE',
    });

    if (!relationship) {
      throw new ForbiddenError('Retailer does not have an active wholesaler connection', 'NO_ACTIVE_WHOLESALER');
    }

    const wholesalerId = relationship.wholesalerId;

    if (requestedWholesalerId && String(requestedWholesalerId) !== String(wholesalerId)) {
      throw new ForbiddenError(
        'You can only purchase products from your connected wholesaler',
        'WHOLESALER_MISMATCH'
      );
    }

    // 2. Fetch authoritative product information and calculate pricing securely
    const productIds = items.map((i) => i.productId || i.id);
    const products = await Product.find({
      _id: { $in: productIds },
      wholesalerId,
      isDeleted: false,
    });

    if (products.length !== items.length) {
      throw new BadRequestError(
        'One or more products were not found or do not belong to your connected wholesaler',
        'INVALID_PRODUCTS'
      );
    }

    const productMap = {};
    products.forEach((p) => {
      productMap[String(p._id)] = p;
    });

    const [wholesalerProfileForTax, retailerProfileForTax] = await Promise.all([
      WholesalerProfile.findOne({ userId: wholesalerId }).lean(),
      RetailerProfile.findOne({ userId: retailerId }).lean(),
    ]);
    const wholesalerState = String(wholesalerProfileForTax?.address?.state || '').trim().toLowerCase();
    const retailerState = String((billingAddress || shippingAddress || retailerProfileForTax?.address || {}).state || retailerProfileForTax?.state || '').trim().toLowerCase();
    const isIntraState = Boolean(wholesalerState && retailerState && wholesalerState === retailerState);

    let subtotal = 0;
    let totalTax = 0;
    const calculatedOrderItems = [];
    const stockDeductions = [];

    for (const item of items) {
      const pId = String(item.productId || item.id);
      const product = productMap[pId];

      if (!product) {
        throw new BadRequestError(`Product not found: ${pId}`);
      }

      if (product.status !== 'ACTIVE') {
        throw new BadRequestError(`Product '${product.name}' is currently not active for purchase`, 'PRODUCT_INACTIVE');
      }

      const quantity = Number(item.quantity);
      if (!Number.isInteger(quantity) || quantity < 1) {
        throw new BadRequestError(`Invalid quantity for product ${product.name}`);
      }

      // Verify Minimum Order Quantity (MOQ)
      const moq = product.moq || product.minOrderQty || 1;
      if (quantity < moq) {
        throw new BadRequestError(
          `Minimum order quantity for '${product.name}' is ${moq} ${product.unit || 'units'}. Requested: ${quantity}.`,
          'MOQ_NOT_MET'
        );
      }

      // Check tier pricing or authoritative wholesale price
      let unitPrice = product.wholesalePrice || product.sellingPrice || product.costPrice || 0;
      if (product.pricingTiers && product.pricingTiers.length > 0) {
        for (const tier of product.pricingTiers) {
          if (quantity >= tier.minQty && (!tier.maxQty || quantity <= tier.maxQty)) {
            unitPrice = tier.pricePerUnit;
            break;
          }
        }
      }

      const itemSubtotal = unitPrice * quantity;
      const hasSplitTax = product.cgst !== undefined || product.sgst !== undefined || product.igst !== undefined;
      const cgst = isIntraState ? Number(product.cgst || 0) : 0;
      const sgst = isIntraState ? Number(product.sgst || 0) : 0;
      const igst = isIntraState ? 0 : Number(product.igst || 0);
      const gstRate = product.taxConfigured === false ? 0 : (hasSplitTax ? cgst + sgst + igst : Number(product.gst || 0));
      const priceIncludesTax = hasSplitTax ? Boolean(product.priceIncludesTax) : false;
      const itemGst = priceIncludesTax
        ? Math.round((itemSubtotal * gstRate / (100 + gstRate)) * 100) / 100
        : Math.round((itemSubtotal * (gstRate / 100)) * 100) / 100;
      const itemTotal = priceIncludesTax ? itemSubtotal : itemSubtotal + itemGst;

      subtotal += itemSubtotal;
      totalTax += itemGst;

      calculatedOrderItems.push({
        productId: product._id,
        name: product.name || product.title,
        sku: product.sku,
        imageUrl: product.imageUrl || (product.images && product.images[0]) || '',
        quantity,
        pricePerUnit: unitPrice,
        subtotal: itemSubtotal,
        costPriceAtOrder: Number(product.costPrice || 0),
        gstRate,
        gstAmount: itemGst,
        hsnCode: product.hsnCode || product.hsn || '',
        cgst: hasSplitTax ? cgst : null,
        sgst: hasSplitTax ? sgst : null,
        igst: hasSplitTax ? igst : null,
        priceIncludesTax,
        total: itemTotal,
      });

      stockDeductions.push({
        product,
        quantity,
      });
    }

    let discountAmount = 0;
    let appliedCoupon = null;

    if (couponCode && String(couponCode).trim()) {
      const CouponService = require('../coupons/coupons.service');
      const validationResult = await CouponService.validateCoupon(retailerUser, {
        code: couponCode,
        wholesalerId,
        subtotal,
      });

      if (validationResult && validationResult.valid) {
        discountAmount = validationResult.discountAmount;
        appliedCoupon = validationResult.coupon;
      }
    }

    const grandTotal = Math.round(Math.max(0, subtotal + totalTax - discountAmount) * 100) / 100;

    // Check Wholesaler minimum order value
    const wholesalerProfile = await WholesalerProfile.findOne({ userId: wholesalerId });
    if (wholesalerProfile?.minOrderValue && grandTotal < wholesalerProfile.minOrderValue) {
      throw new BadRequestError(
        `Minimum order value for this wholesaler is ₹${wholesalerProfile.minOrderValue}. Your total: ₹${grandTotal}.`,
        'MIN_ORDER_VALUE_NOT_MET'
      );
    }

    const quote = {
      wholesalerId: String(wholesalerId),
      items: calculatedOrderItems.map((item) => ({
        ...item,
        productId: String(item.productId),
      })),
      subtotal,
      discount: discountAmount,
      couponCode: appliedCoupon ? appliedCoupon.code : (couponCode || ''),
      couponId: appliedCoupon ? String(appliedCoupon._id) : null,
      tax: totalTax,
      grandTotal,
    };
    const quoteHash = crypto.createHash('sha256').update(JSON.stringify(quote)).digest('hex');

    if (orderPayload.expectedQuoteHash && orderPayload.expectedQuoteHash !== quoteHash) {
      throw new BadRequestError('Order pricing changed. Please retry checkout.', 'CHECKOUT_QUOTE_CHANGED');
    }
    if (quoteOnly) {
      for (const deduction of stockDeductions) {
        const inventory = await Inventory.findOne({ productId: deduction.product._id });
        if (!inventory || inventory.available < deduction.quantity) {
          throw new BadRequestError(
            `Insufficient stock available for '${deduction.product.name}'. Available: ${inventory?.available || 0}, Requested: ${deduction.quantity}`,
            'INSUFFICIENT_STOCK'
          );
        }
      }
      return { wholesalerId, amount: grandTotal, quoteHash };
    }

    // Check Credit Policy if requested
    const isCreditRequested = paymentMethod === 'CREDIT' || paymentMethod === PAYMENT_METHOD.CREDIT;
    let isCreditOrder = false;
    let creditDueDate = null;
    let creditPeriodDays = 0;
    let creditPaymentStatus = 'NOT_APPLICABLE';

    if (isCreditRequested) {
      const creditPolicy = wholesalerProfile?.creditPolicy || {};
      if (!creditPolicy.creditEnabled || !relationship.creditEnabled || relationship.creditStatus !== 'APPROVED') {
        throw new BadRequestError('Credit has not been approved for this retailer.', 'CREDIT_DISABLED');
      }

      if (creditPolicy.minOrderForCredit && grandTotal < creditPolicy.minOrderForCredit) {
        throw new BadRequestError(
          `Minimum order value eligible for credit purchase is ₹${creditPolicy.minOrderForCredit}. Your total: ₹${grandTotal}.`,
          'CREDIT_MIN_ORDER_NOT_MET'
        );
      }

      const currentOutstandingPaise = Number.isSafeInteger(relationship.currentOutstandingPaise)
        ? relationship.currentOutstandingPaise
        : Math.round(Number(relationship.currentOutstandingAmount || 0) * 100);
      if (!Number.isSafeInteger(relationship.currentOutstandingPaise)) {
        await WholesalerRetailerRelationship.updateOne(
          { _id: relationship._id, currentOutstandingPaise: null },
          { $set: { currentOutstandingPaise } }
        );
      }
      const effectiveLimitPaise = Number.isSafeInteger(relationship.customCreditLimitPaise)
        ? relationship.customCreditLimitPaise
        : Math.round(Number(relationship.customCreditLimit ?? creditPolicy.defaultCreditLimit ?? 0) * 100);
      const orderAmountPaise = Math.round(grandTotal * 100);
      const availableCreditPaise = Math.max(0, effectiveLimitPaise - currentOutstandingPaise);

      if (orderAmountPaise > availableCreditPaise) {
        throw new BadRequestError(
          `Credit limit exceeded. Your available credit with this wholesaler is ₹${(availableCreditPaise / 100).toLocaleString('en-IN')}, but order total is ₹${grandTotal.toLocaleString('en-IN')}.`,
          'CREDIT_LIMIT_EXCEEDED'
        );
      }

      isCreditOrder = true;
      creditPeriodDays = relationship.creditPeriodDays || creditPolicy.creditPeriodDays || 15;
      creditDueDate = new Date(Date.now() + creditPeriodDays * 24 * 60 * 60 * 1000);
      creditPaymentStatus = 'PENDING';

      const updatedRelationship = await WholesalerRetailerRelationship.findOneAndUpdate(
        {
          _id: relationship._id,
          status: 'ACTIVE',
          creditEnabled: true,
          creditStatus: 'APPROVED',
          currentOutstandingPaise: { $exists: true },
          $expr: {
            $lte: [
              { $add: ['$currentOutstandingPaise', orderAmountPaise] },
              effectiveLimitPaise,
            ],
          },
        },
        {
          $inc: {
            currentOutstandingPaise: orderAmountPaise,
            currentOutstandingAmount: orderAmountPaise / 100,
          },
        },
        { new: true }
      );
      if (!updatedRelationship) {
        throw new BadRequestError('Credit limit exceeded or credit access is no longer active.', 'CREDIT_LIMIT_EXCEEDED');
      }
    }

    // 3. Check availability for every product before reserving stock
    const orderNumber = generateReference('ORD');
    const stockReservations = [];

    for (const deduction of stockDeductions) {
      const inventory = await Inventory.findOne({ productId: deduction.product._id });
      if (!inventory || inventory.available < deduction.quantity) {
        throw new BadRequestError(
          `Insufficient stock available for '${deduction.product.name}'. Available: ${inventory?.available || 0}, Requested: ${deduction.quantity}`,
          'INSUFFICIENT_STOCK'
        );
      }
      stockReservations.push({ ...deduction, inventory });
    }

    for (const reservation of stockReservations) {
      const { product, quantity, inventory } = reservation;
      const prevAvailable = inventory.available;
      inventory.available -= quantity;
      inventory.reserved += quantity;
      await inventory.save();

      // Update product stock display
      product.stock = inventory.available;
      await product.save();

      await InventoryTransaction.create({
        inventoryId: inventory._id,
        productId: product._id,
        wholesalerId,
        type: INVENTORY_TRANSACTION_TYPE.RESERVE,
        quantity,
        previousAvailable: prevAvailable,
        newAvailable: inventory.available,
        referenceType: 'ORDER',
        referenceId: orderNumber,
        performedBy: retailerId,
        notes: `Stock reserved for order ${orderNumber}`,
      });
    }

    // 4. Create Order document
    const order = await Order.create({
      orderNumber,
      retailerId,
      wholesalerId,
      items: calculatedOrderItems,
      subtotal,
      discount: discountAmount,
      couponCode: appliedCoupon ? appliedCoupon.code : (couponCode || ''),
      couponId: appliedCoupon ? appliedCoupon._id : null,
      tax: totalTax,
      shipping: 0,
      grandTotal,
      orderStatus: ORDER_STATUS.PENDING,
      paymentStatus: PAYMENT_STATUS.PENDING,
      paymentMethod: paymentMethod || PAYMENT_METHOD.COD,
      isCreditOrder,
      creditDueDate,
      creditPeriodDays,
      creditPaymentStatus,
      shippingAddress: normalizeOrderAddress(shippingAddress),
      billingAddress: normalizeOrderAddress(billingAddress || shippingAddress),
      statusTimeline: [
        {
          status: ORDER_STATUS.PENDING,
          timestamp: new Date(),
          note: isCreditOrder ? `Credit order placed (Due in ${creditPeriodDays} days)` : 'Order placed by retailer',
          updatedBy: retailerId,
        },
      ],
      idempotencyKey,
    });

    if (appliedCoupon && appliedCoupon._id) {
      const CouponService = require('../coupons/coupons.service');
      await CouponService.incrementCouponUsage(appliedCoupon._id, retailerId);
    }

    // 5. Create Payment record
    const payment = await Payment.create({
      orderId: order._id,
      retailerId,
      wholesalerId,
      amount: grandTotal,
      currency: 'INR',
      status: PAYMENT_STATUS.PENDING,
      paymentMethod: paymentMethod || PAYMENT_METHOD.COD,
      transactionReference: generateReference('PAY'),
    });

    // 6. Update Retailer Profile metrics
    await RetailerProfile.findOneAndUpdate(
      { userId: retailerId },
      {
        $inc: { totalOrdersCount: 1, totalPurchaseAmount: grandTotal },
        lastOrderAt: new Date(),
      }
    );

    // 7. Audit and Notifications
    await AuditService.log({
      actorId: retailerId,
      actorRole: retailerUser.role,
      action: AUDIT_ACTION.CREATE,
      entityType: 'Order',
      entityId: order._id,
      after: { orderNumber, grandTotal, itemsCount: calculatedOrderItems.length },
      req,
    });

    await NotificationService.notify({
      recipientId: wholesalerId,
      title: 'New Order Received',
      message: `You have received a new order ${orderNumber} amounting to ₹${grandTotal}.`,
      data: { orderId: order._id, orderNumber, grandTotal },
    });

    await NotificationService.notify({
      recipientId: retailerId,
      title: 'Order Confirmed',
      message: `Your order ${orderNumber} for ₹${grandTotal} has been successfully placed.`,
      data: { orderId: order._id, orderNumber },
    });

    const wholesalerUser = await User.findById(wholesalerId).lean();
    const wholesalerName = wholesalerUser?.businessName || wholesalerUser?.name || 'Wholesaler';
    const retailerName = retailerUser?.businessName || retailerUser?.name || 'Retailer';

    await NotificationService.notifyAdmins({
      title: `New Order Placed: #${orderNumber}`,
      message: `Order #${orderNumber} placed for Wholesaler "${wholesalerName}" by Retailer "${retailerName}" for ₹${grandTotal}.`,
      type: NOTIFICATION_TYPE.ORDER_UPDATE,
      data: {
        type: 'ORDER_PLACED',
        orderId: order._id,
        orderNumber,
        grandTotal,
        wholesalerId,
        wholesalerName,
        retailerId,
        retailerName,
      },
    });

    return { order, payment };
  }

  static async quoteOrder(retailerUser, orderPayload) {
    return this.createOrder(retailerUser, orderPayload, null, true);
  }

  /**
   * List orders based on user role and query filters
   */
  static async listOrders(user, query = {}) {
    const { page, limit, skip, sort } = parsePagination(query);
    const filter = { isDemo: { $ne: true } };

    if (user.role === ROLES.WHOLESALER) {
      filter.wholesalerId = user._id;
    } else if (user.role === ROLES.RETAILER) {
      filter.retailerId = user._id;
    } else if (user.role === ROLES.SUPER_ADMIN || user.role === ROLES.ADMIN) {
      if (query.wholesaler && query.wholesaler !== 'all') filter.wholesalerId = query.wholesaler;
      else if (query.wholesalerId) filter.wholesalerId = query.wholesalerId;

      if (query.retailer && query.retailer !== 'all') filter.retailerId = query.retailer;
      else if (query.retailerId) filter.retailerId = query.retailerId;
    }

    if (query.status && query.status !== 'all') {
      filter.orderStatus = query.status.toUpperCase();
    } else if (query.orderStatus) {
      filter.orderStatus = query.orderStatus.toUpperCase();
    }

    if (query.paymentStatus && query.paymentStatus !== 'all') {
      filter.paymentStatus = query.paymentStatus.toUpperCase();
    }

    if (query.search) {
      filter.orderNumber = new RegExp(query.search, 'i');
    }

    const [orders, total, wholesalers, retailers] = await Promise.all([
      Order.find(filter)
        .populate('retailerId', 'name email phone businessName')
        .populate('wholesalerId', 'name email phone businessName')
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      Order.countDocuments(filter),
      User.find({ role: ROLES.WHOLESALER, isDeleted: false }).select('name businessName').lean(),
      User.find({ role: ROLES.RETAILER, isDeleted: false }).select('name businessName').lean(),
    ]);

    const formattedOrders = orders.map((o) => {
      const itemsCount = Array.isArray(o.items)
        ? o.items.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0)
        : 0;
      const totalAmount = o.grandTotal || o.subtotal || 0;

      return {
        ...o,
        id: String(o._id || o.id),
        orderNo: o.orderNumber,
        orderNumber: o.orderNumber,
        retailer: {
          id: String(o.retailerId?._id || o.retailerId || ''),
          name: o.retailerId?.businessName || o.retailerId?.name || 'Retailer',
          businessName: o.retailerId?.businessName || o.retailerId?.name || 'Retailer',
          email: o.retailerId?.email || '',
        },
        wholesaler: {
          id: String(o.wholesalerId?._id || o.wholesalerId || ''),
          name: o.wholesalerId?.businessName || o.wholesalerId?.name || 'Wholesaler',
          businessName: o.wholesalerId?.businessName || o.wholesalerId?.name || 'Wholesaler',
          email: o.wholesalerId?.email || '',
        },
        itemsCount,
        totalAmount,
        amount: totalAmount,
        total: totalAmount,
        status: o.orderStatus ? o.orderStatus.toLowerCase() : 'pending',
        orderStatus: o.orderStatus,
        paymentStatus: o.paymentStatus ? o.paymentStatus.toLowerCase() : 'pending',
        createdAt: o.createdAt,
      };
    });

    return {
      orders: formattedOrders,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
      filters: {
        wholesalers: wholesalers.map((w) => ({ id: String(w._id), name: w.businessName || w.name })),
        retailers: retailers.map((r) => ({ id: String(r._id), name: r.businessName || r.name })),
      },
    };
  }

  /**
   * Get single order by ID with permissions check
   */
  static async getOrderById(orderId, user) {
    const order = await Order.findOne({ _id: orderId, isDemo: { $ne: true } })
      .populate('retailerId', 'name email phone businessName address city state pincode')
      .populate('wholesalerId', 'name email phone businessName address city state pincode')
      .populate('items.productId');

    if (!order) {
      throw new NotFoundError('Order not found');
    }

    // Role-based access control check
    if (user.role === ROLES.RETAILER && String(order.retailerId._id) !== String(user._id)) {
      throw new ForbiddenError('You can only access your own orders');
    }

    if (user.role === ROLES.WHOLESALER && String(order.wholesalerId._id) !== String(user._id)) {
      throw new ForbiddenError('You can only access orders for your wholesale store');
    }

    const payment = await Payment.findOne({ orderId: order._id });

    const itemsCount = Array.isArray(order.items)
      ? order.items.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0)
      : 0;
    const totalQuantity = itemsCount;
    const totalAmount = order.grandTotal || order.subtotal || 0;

    const formattedItems = (order.items || []).map((item) => ({
      product: {
        id: String(item.productId?._id || item.productId || ''),
        name: item.productName || item.productId?.name || 'Product',
        sku: item.sku || item.productId?.sku || '—',
      },
      quantity: item.quantity,
      pricePerUnit: item.pricePerUnit || item.price || 0,
      totalPrice: item.totalPrice || (item.quantity * (item.pricePerUnit || 0)),
    }));

    const formattedOrder = {
      ...order.toObject(),
      id: String(order._id),
      orderNo: order.orderNumber,
      orderNumber: order.orderNumber,
      itemsCount,
      totalAmount,
      total: totalAmount,
      items: formattedItems,
      retailer: {
        id: String(order.retailerId?._id || order.retailerId || ''),
        name: order.retailerId?.name || '',
        businessName: order.retailerId?.businessName || order.retailerId?.name || 'Retailer',
        email: order.retailerId?.email || '',
        phone: order.retailerId?.phone || '',
        city: order.retailerId?.address?.city || '',
        state: order.retailerId?.address?.state || '',
      },
      wholesaler: {
        id: String(order.wholesalerId?._id || order.wholesalerId || ''),
        name: order.wholesalerId?.name || '',
        businessName: order.wholesalerId?.businessName || order.wholesalerId?.name || 'Wholesaler',
        email: order.wholesalerId?.email || '',
        phone: order.wholesalerId?.phone || '',
        city: order.wholesalerId?.address?.city || '',
        state: order.wholesalerId?.address?.state || '',
      },
      status: order.orderStatus ? order.orderStatus.toLowerCase() : 'pending',
      paymentStatus: order.paymentStatus ? order.paymentStatus.toLowerCase() : 'pending',
    };

    const formattedPayments = payment ? [{
      amount: payment.amount,
      method: payment.paymentMethod,
      status: payment.status ? payment.status.toLowerCase() : 'pending',
      transactionRef: payment.transactionReference,
      createdAt: payment.createdAt,
    }] : [];

    const formattedTimeline = (order.statusTimeline || []).map((entry) => ({
      status: entry.status ? entry.status.toLowerCase() : 'pending',
      note: entry.note || '',
      createdAt: entry.timestamp || entry.createdAt,
    }));

    return {
      order: formattedOrder,
      payment: payment ? { ...payment.toObject(), method: payment.paymentMethod } : null,
      payments: formattedPayments,
      timeline: formattedTimeline,
      totals: {
        itemsCount: (order.items || []).length,
        totalQuantity,
        totalAmount,
      },
      allowedTransitions: ['pending', 'confirmed', 'shipped', 'out_for_delivery', 'delivered', 'cancelled'],
    };
  }

  /**
   * Update order status (with state machine transitions and financial settlements)
   */
  static async updateOrderStatus(orderId, { status, note, cancellationReason, cancellationNote }, user, req = null) {
    const order = await Order.findById(orderId);
    if (!order) {
      throw new NotFoundError('Order not found');
    }

    // Permission check
    if (user.role === ROLES.WHOLESALER && String(order.wholesalerId) !== String(user._id)) {
      throw new ForbiddenError('You can only update orders for your store');
    }

    const requestedStatus = typeof status === 'string'
      ? status.trim().toUpperCase().replace(/[\s-]+/g, '_')
      : '';
    const normalizedStatus = requestedStatus === 'DISPATCHED' ? ORDER_STATUS.SHIPPED : requestedStatus;
    if (!Object.values(ORDER_STATUS).includes(normalizedStatus)) {
      throw new BadRequestError('Invalid order status', 'INVALID_ORDER_STATUS');
    }

    const previousStatus = order.orderStatus;
    if (previousStatus === normalizedStatus) {
      return order;
    }

    order.orderStatus = normalizedStatus;
    if (normalizedStatus === ORDER_STATUS.CANCELLED && cancellationReason) {
      order.cancellationReason = cancellationReason;
      order.cancellationNote = cancellationNote || '';
    }
    order.statusTimeline.push({
      status: normalizedStatus,
      timestamp: new Date(),
      note: note || `Order status updated to ${normalizedStatus}`,
      updatedBy: user._id,
    });

    // If order is DELIVERED, settle financial earnings and update inventory sold count
    if (normalizedStatus === ORDER_STATUS.DELIVERED && previousStatus !== ORDER_STATUS.DELIVERED) {
      order.paymentStatus = PAYMENT_STATUS.PAID;
      await Payment.findOneAndUpdate(
        { orderId: order._id },
        { status: PAYMENT_STATUS.PAID, paidAt: new Date() }
      );

      // Release reserved inventory into sold
      for (const item of order.items) {
        const inventory = await Inventory.findOne({ productId: item.productId });
        if (inventory) {
          inventory.reserved = Math.max(0, inventory.reserved - item.quantity);
          inventory.sold += item.quantity;
          await inventory.save();

          await InventoryTransaction.create({
            inventoryId: inventory._id,
            productId: item.productId,
            wholesalerId: order.wholesalerId,
            type: INVENTORY_TRANSACTION_TYPE.SALE,
            quantity: item.quantity,
            previousAvailable: inventory.available,
            newAvailable: inventory.available,
            referenceType: 'SALE',
            referenceId: order.orderNumber,
            performedBy: user._id,
            notes: `Inventory sold upon delivery for order ${order.orderNumber}`,
          });
        }
      }

      // Calculate platform commission and wholesaler earning
      const wholesalerProfile = await WholesalerProfile.findOne({ userId: order.wholesalerId });
      const commissionRate = wholesalerProfile?.commissionRate || 5.0;
      const platformCommission = Math.round((order.subtotal * (commissionRate / 100)) * 100) / 100;
      const wholesalerAmount = order.grandTotal - platformCommission;

      const deliveredAt = new Date();
      const settlementDate = new Date(
        deliveredAt.getTime() + env.WALLET_SETTLEMENT_DAYS * 24 * 60 * 60 * 1000
      );
      await Earning.findOneAndUpdate(
        { orderId: order._id },
        {
          orderId: order._id,
          wholesalerId: order.wholesalerId,
          grossAmount: order.grandTotal,
          platformCommissionRate: commissionRate,
          platformCommission,
          tax: order.tax,
          wholesalerAmount,
          status: settlementDate <= deliveredAt ? 'SETTLED' : 'PENDING',
          ...(settlementDate <= deliveredAt ? { settledAt: deliveredAt } : {}),
          settlementDate,
        },
        { upsert: true, new: true }
      );

      // Credit wholesaler wallet with immutable double-entry transaction
      await WalletService.credit({
        ownerId: order.wholesalerId,
        ownerType: 'WHOLESALER',
        amount: wholesalerAmount,
        type: 'CREDIT',
        description: `Earnings credited for delivered order ${order.orderNumber}`,
        referenceType: 'ORDER',
        referenceId: order.orderNumber,
        idempotencyKey: `order-earning:${order._id}`,
        settlementDate,
      });
    }

    // If order is CANCELLED, release reserved stock back to available
    if (normalizedStatus === ORDER_STATUS.CANCELLED && previousStatus !== ORDER_STATUS.CANCELLED) {
      for (const item of order.items) {
        const inventory = await Inventory.findOne({ productId: item.productId });
        if (inventory) {
          const prev = inventory.available;
          inventory.reserved = Math.max(0, inventory.reserved - item.quantity);
          inventory.available += item.quantity;
          await inventory.save();

          await Product.findByIdAndUpdate(item.productId, { stock: inventory.available });

          await InventoryTransaction.create({
            inventoryId: inventory._id,
            productId: item.productId,
            wholesalerId: order.wholesalerId,
            type: INVENTORY_TRANSACTION_TYPE.RELEASE,
            quantity: item.quantity,
            previousAvailable: prev,
            newAvailable: inventory.available,
            referenceType: 'CANCELLATION',
            referenceId: order.orderNumber,
            performedBy: user._id,
            notes: `Stock released upon order cancellation: ${order.orderNumber}`,
          });
        }
      }
    }

    // If order is RETURNED, restore stock from sold to available
    if (normalizedStatus === ORDER_STATUS.RETURNED && previousStatus !== ORDER_STATUS.RETURNED) {
      await WalletService.reverseOrderEarnings({
        ownerId: order.wholesalerId,
        orderNumber: order.orderNumber,
        orderId: order._id,
        description: `Earnings reversed for returned order ${order.orderNumber}`,
      });
      for (const item of order.items) {
        const inventory = await Inventory.findOne({ productId: item.productId });
        if (inventory) {
          const prev = inventory.available;
          inventory.sold = Math.max(0, inventory.sold - item.quantity);
          inventory.available += item.quantity;
          await inventory.save();

          await Product.findByIdAndUpdate(item.productId, { stock: inventory.available });

          await InventoryTransaction.create({
            inventoryId: inventory._id,
            productId: item.productId,
            wholesalerId: order.wholesalerId,
            type: INVENTORY_TRANSACTION_TYPE.RETURN,
            quantity: item.quantity,
            previousAvailable: prev,
            newAvailable: inventory.available,
            referenceType: 'RETURN',
            referenceId: order.orderNumber,
            performedBy: user._id,
            notes: `Stock restored upon order return: ${order.orderNumber}`,
          });
        }

        if (normalizedStatus === ORDER_STATUS.CANCELLED && previousStatus !== ORDER_STATUS.CANCELLED) {
          await WalletService.reverseOrderEarnings({
            ownerId: order.wholesalerId,
            orderNumber: order.orderNumber,
            orderId: order._id,
            description: `Earnings reversed for cancelled order ${order.orderNumber}`,
          });
        }
      }
    }

    await order.save();

    await AuditService.log({
      actorId: user._id,
      actorRole: user.role,
      action: AUDIT_ACTION.ORDER_STATUS_CHANGED,
      entityType: 'Order',
      entityId: order._id,
      before: { orderStatus: previousStatus },
      after: { orderStatus: normalizedStatus, note },
      req,
    });

    await NotificationService.notify({
      recipientId: order.retailerId,
      title: 'Order Status Update',
      message: `Your order ${order.orderNumber} status changed to ${normalizedStatus}.`,
      data: { orderId: order._id, status: normalizedStatus },
    });

    await NotificationService.notify({
      recipientId: order.wholesalerId,
      title: normalizedStatus === ORDER_STATUS.CONFIRMED ? 'Order Confirmed' : 'Order Status Updated',
      message: `Order ${order.orderNumber} is now ${normalizedStatus.toLowerCase().replace(/_/g, ' ')}.`,
      data: { orderId: order._id, status: normalizedStatus },
    });

    const wholesalerUser = await User.findById(order.wholesalerId).lean();
    const wholesalerName = wholesalerUser?.businessName || wholesalerUser?.name || 'Wholesaler';

    await NotificationService.notifyAdmins({
      title: normalizedStatus === ORDER_STATUS.DELIVERED ? `Order Delivered & Payment Done: #${order.orderNumber}` : `Order Status Updated: #${order.orderNumber}`,
      message: `Wholesaler "${wholesalerName}" - Order #${order.orderNumber} is now ${normalizedStatus}. Payment status: ${order.paymentStatus || 'PAID'}.`,
      type: normalizedStatus === ORDER_STATUS.DELIVERED ? NOTIFICATION_TYPE.PAYMENT_UPDATE : NOTIFICATION_TYPE.ORDER_UPDATE,
      data: {
        type: normalizedStatus === ORDER_STATUS.DELIVERED ? 'PAYMENT_COMPLETED' : 'ORDER_UPDATED',
        orderId: order._id,
        orderNumber: order.orderNumber,
        status: normalizedStatus,
        wholesalerId: order.wholesalerId,
        wholesalerName,
        amount: order.grandTotal,
      },
    });

    return order;
  }

  static async listReturns(user, query = {}) {
    const { page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;
    
    const filter = {};
    if (user.role === ROLES.WHOLESALER) {
      filter.wholesalerId = user._id;
    } else if (user.role === ROLES.RETAILER) {
      filter.retailerId = user._id;
    }

    const returns = await Return.find(filter)
      .populate('orderId', 'orderNumber')
      .populate('retailerId', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await Return.countDocuments(filter);

    return {
      returns,
      meta: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async updateReturnStatus(returnId, status, adminNotes, user) {
    const returnDoc = await Return.findById(returnId).populate('orderId');
    if (!returnDoc) {
      throw new NotFoundError('Return not found');
    }

    if (user.role === ROLES.WHOLESALER && String(returnDoc.wholesalerId) !== String(user._id)) {
      throw new ForbiddenError('You can only update returns for your store');
    }

    if (!['APPROVED', 'REJECTED'].includes(status)) {
      throw new BadRequestError('Invalid return status');
    }

    returnDoc.status = status;
    returnDoc.adminNotes = adminNotes || returnDoc.adminNotes;
    returnDoc.resolvedAt = new Date();
    returnDoc.resolvedBy = user._id;
    await returnDoc.save();

    if (status === 'APPROVED') {
      // Restock inventory
      for (const item of returnDoc.items) {
        const inventory = await Inventory.findOne({ productId: item.productId });
        if (inventory) {
          inventory.sold = Math.max(0, inventory.sold - item.quantity);
          inventory.available += item.quantity;
          await inventory.save();
          await Product.findByIdAndUpdate(item.productId, { stock: inventory.available });
        }
      }
      
      // Update order status if necessary, e.g. partially returned or returned.
      // We can just set order status to RETURNED if we want to follow existing logic.
      if (returnDoc.orderId && returnDoc.orderId.orderStatus !== 'RETURNED') {
         await this.updateOrderStatus(returnDoc.orderId._id, { status: 'RETURNED', note: 'Return approved' }, user);
      }
    }

    return returnDoc;
  }
}

module.exports = OrderService;
