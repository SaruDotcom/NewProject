const crypto = require('crypto');
const env = require('../../config/env');
const logger = require('../../config/logger');
const { RetailerCheckoutPayment, Order, Payment } = require('../../models');
const OrderService = require('../orders/orders.service');
const { BadRequestError, ConflictError, NotFoundError } = require('../../utils/errors');

const configured = () => Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET);
const authorizationHeader = () => `Basic ${Buffer.from(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`).toString('base64')}`;

async function gatewayRequest(path, options = {}) {
  let response;
  try {
    response = await fetch(`https://api.razorpay.com/v1${path}`, {
      ...options,
      headers: {
        Authorization: authorizationHeader(),
        ...(options.headers || {}),
      },
    });
  } catch {
    throw new BadRequestError('Unable to reach the payment gateway. Please try again.', 'PAYMENT_GATEWAY_UNAVAILABLE');
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new BadRequestError('The payment gateway returned an unreadable response.', 'PAYMENT_GATEWAY_FAILED');
  }
  if (!response.ok) {
    throw new BadRequestError(
      data?.error?.description || 'The payment gateway could not process the request.',
      'PAYMENT_GATEWAY_FAILED'
    );
  }
  return data;
}

function assertValidSignature(orderId, paymentId, signature) {
  const expected = crypto
    .createHmac('sha256', env.RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
  const suppliedBuffer = Buffer.from(String(signature));
  const expectedBuffer = Buffer.from(expected);
  if (suppliedBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(suppliedBuffer, expectedBuffer)) {
    throw new BadRequestError('Payment signature verification failed.', 'INVALID_PAYMENT_SIGNATURE');
  }
}

class RetailerCheckoutService {
  static async createPaymentOrder(retailerUser, checkoutPayload) {
    if (!configured()) {
      throw new BadRequestError('Online payment is not configured.', 'PAYMENT_NOT_CONFIGURED');
    }

    const quote = await OrderService.quoteOrder(retailerUser, {
      ...checkoutPayload,
      paymentMethod: 'ONLINE',
    });
    const amountPaise = Math.round(quote.amount * 100);
    if (!Number.isSafeInteger(amountPaise) || amountPaise < 1) {
      throw new BadRequestError('The checkout total is not a valid payment amount.', 'INVALID_PAYMENT_AMOUNT');
    }

    const gatewayOrder = await gatewayRequest('/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: amountPaise,
        currency: 'INR',
        receipt: `ret_${String(retailerUser._id).slice(-10)}_${Date.now()}`,
        notes: { retailerId: String(retailerUser._id) },
      }),
    });
    if (
      !gatewayOrder.id ||
      gatewayOrder.amount !== amountPaise ||
      gatewayOrder.currency !== 'INR'
    ) {
      throw new BadRequestError('The payment gateway returned an invalid checkout order.', 'PAYMENT_ORDER_INVALID');
    }

    await RetailerCheckoutPayment.create({
      retailerId: retailerUser._id,
      wholesalerId: quote.wholesalerId,
      razorpayOrderId: gatewayOrder.id,
      amountPaise,
      currency: gatewayOrder.currency,
      quoteHash: quote.quoteHash,
      checkoutPayload,
    });

    return {
      configured: true,
      keyId: env.RAZORPAY_KEY_ID,
      order: {
        id: gatewayOrder.id,
        amount: gatewayOrder.amount,
        currency: gatewayOrder.currency,
      },
    };
  }

  static async verifyPayment(retailerUser, payload, req) {
    const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = payload || {};
    if (!orderId || !paymentId || !signature) {
      throw new BadRequestError('Razorpay payment details are required.', 'PAYMENT_DETAILS_REQUIRED');
    }
    if (!configured()) {
      throw new BadRequestError('Online payment is not configured.', 'PAYMENT_NOT_CONFIGURED');
    }
    assertValidSignature(orderId, paymentId, signature);

    const checkoutPayment = await RetailerCheckoutPayment.findOne({
      retailerId: retailerUser._id,
      razorpayOrderId: orderId,
    });
    if (!checkoutPayment) throw new NotFoundError('Checkout payment order not found.');
    if (checkoutPayment.status === 'PAID' && checkoutPayment.razorpayPaymentId === paymentId) {
      return {
        order: await Order.findById(checkoutPayment.orderId),
        payment: await Payment.findOne({ orderId: checkoutPayment.orderId }),
      };
    }
    if (checkoutPayment.status !== 'PENDING') {
      throw new ConflictError('This checkout payment has already been processed.', 'PAYMENT_ALREADY_PROCESSED');
    }

    const gatewayPayment = await gatewayRequest(`/payments/${encodeURIComponent(paymentId)}`);
    if (
      gatewayPayment.order_id !== orderId ||
      gatewayPayment.currency !== checkoutPayment.currency ||
      gatewayPayment.amount !== checkoutPayment.amountPaise ||
      gatewayPayment.status !== 'captured'
    ) {
      throw new BadRequestError('Captured payment does not match the checkout order.', 'PAYMENT_NOT_CAPTURED');
    }

    const claimedPayment = await RetailerCheckoutPayment.findOneAndUpdate(
      { _id: checkoutPayment._id, status: 'PENDING' },
      { $set: { status: 'PROCESSING', razorpayPaymentId: paymentId } },
      { new: true }
    );
    if (!claimedPayment) throw new ConflictError('This checkout payment has already been processed.', 'PAYMENT_ALREADY_PROCESSED');

    const orderIdempotencyKey = `retailer-checkout-${orderId}`;
    try {
      const quote = await OrderService.quoteOrder(retailerUser, {
        ...checkoutPayment.checkoutPayload,
        paymentMethod: 'ONLINE',
      });
      if (quote.quoteHash !== checkoutPayment.quoteHash) {
        throw new BadRequestError('Order pricing or availability changed. Please retry checkout.', 'CHECKOUT_QUOTE_CHANGED');
      }

      const result = await OrderService.createOrder(
        retailerUser,
        {
          ...checkoutPayment.checkoutPayload,
          paymentMethod: 'ONLINE',
          idempotencyKey: orderIdempotencyKey,
          expectedQuoteHash: checkoutPayment.quoteHash,
        },
        req,
        { razorpayOrderId: orderId, razorpayPaymentId: paymentId }
      );
      await RetailerCheckoutPayment.updateOne(
        { _id: checkoutPayment._id, status: 'PROCESSING' },
        { $set: { status: 'PAID', orderId: result.order._id } }
      );
      return result;
    } catch (error) {
      const persistedOrder = await Order.findOne({ idempotencyKey: orderIdempotencyKey });
      if (persistedOrder) {
        await RetailerCheckoutPayment.updateOne(
          { _id: checkoutPayment._id },
          { $set: { status: 'PAID', orderId: persistedOrder._id } }
        );
        return {
          order: persistedOrder,
          payment: await Payment.findOne({ orderId: persistedOrder._id }),
        };
      }

      try {
        await gatewayRequest(`/payments/${encodeURIComponent(paymentId)}/refund`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount: checkoutPayment.amountPaise }),
        });
        await RetailerCheckoutPayment.updateOne(
          { _id: checkoutPayment._id },
          { $set: { status: 'REFUNDED' } }
        );
      } catch (refundError) {
        await RetailerCheckoutPayment.updateOne(
          { _id: checkoutPayment._id },
          { $set: { status: 'REFUND_PENDING' } }
        );
        logger.error('Retailer checkout payment refund is pending', {
          razorpayOrderId: orderId,
          razorpayPaymentId: paymentId,
          error: refundError.message,
        });
        throw new BadRequestError(
          'Payment was captured but the order could not be completed. Refund processing is pending.',
          'PAYMENT_REFUND_PENDING'
        );
      }
      throw new BadRequestError(
        'Payment was captured, but checkout could not be completed. The payment has been refunded.',
        'PAYMENT_REFUNDED'
      );
    }
  }

  static async markPaymentFailed(retailerUser, orderId) {
    const result = await RetailerCheckoutPayment.findOneAndUpdate(
      { retailerId: retailerUser._id, razorpayOrderId: orderId, status: 'PENDING' },
      { $set: { status: 'FAILED' } },
      { new: true }
    );
    if (!result) throw new ConflictError('This checkout payment is no longer pending.', 'PAYMENT_ALREADY_PROCESSED');
    return { status: result.status };
  }
}

module.exports = RetailerCheckoutService;
