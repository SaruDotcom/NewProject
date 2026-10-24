const crypto = require('crypto');
const env = require('../src/config/env');
const { Order, Payment, RetailerCheckoutPayment } = require('../src/models');
const OrderService = require('../src/modules/orders/orders.service');
const RetailerCheckoutService = require('../src/modules/retailers/retailer-checkout.service');
const { checkoutSchema } = require('../src/modules/retailers/retailer.validation');

describe('Retailer Razorpay checkout', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    env.RAZORPAY_KEY_ID = 'rzp_test_key';
    env.RAZORPAY_KEY_SECRET = 'test_secret';
    jest.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test('Order and Payment models accept the ONLINE payment method sent by checkout', () => {
    const order = new Order({ paymentMethod: 'ONLINE' });
    const payment = new Payment({ paymentMethod: 'ONLINE' });

    expect(order.validateSync()?.errors?.paymentMethod).toBeUndefined();
    expect(payment.validateSync()?.errors?.paymentMethod).toBeUndefined();
  });

  test('direct order creation cannot bypass Razorpay verification', async () => {
    await expect(OrderService.createOrder(
      { _id: 'retailer-1' },
      { paymentMethod: 'ONLINE', items: [] },
    )).rejects.toMatchObject({ code: 'PAYMENT_VERIFICATION_REQUIRED' });
  });

  test('checkout validation accepts the online request and reports missing address fields', () => {
    const valid = checkoutSchema.validate({
      paymentMethod: 'ONLINE',
      couponCode: 'SAVE10',
      items: [{ productId: '507f1f77bcf86cd799439011', quantity: 1 }],
      shippingAddress: {
        addressLine1: '1 Main Street',
        city: 'Delhi',
        state: 'Delhi',
        postalCode: '110001',
      },
    });
    const invalid = checkoutSchema.validate({
      paymentMethod: 'ONLINE',
      shippingAddress: { addressLine1: '1 Main Street', state: 'Delhi' },
    }, { abortEarly: false });

    expect(valid.error).toBeUndefined();
    expect(valid.value.couponCode).toBe('SAVE10');
    expect(invalid.error.details.map((detail) => detail.path.join('.'))).toContain('shippingAddress.city');
  });

  test('creates a Razorpay order using the server-calculated amount', async () => {
    jest.spyOn(OrderService, 'quoteOrder').mockResolvedValue({
      amount: 2360,
      quoteHash: 'trusted-quote',
      wholesalerId: 'wholesaler-1',
    });
    jest.spyOn(RetailerCheckoutPayment, 'create').mockResolvedValue({});
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'rzp-order-1', amount: 236000, currency: 'INR' }),
    });

    const result = await RetailerCheckoutService.createPaymentOrder(
      { _id: 'retailer-1' },
      { items: [{ productId: 'product-1', quantity: 10 }], shippingAddress: {} },
    );

    expect(JSON.parse(global.fetch.mock.calls[0][1].body)).toMatchObject({
      amount: 236000,
      currency: 'INR',
    });
    expect(RetailerCheckoutPayment.create).toHaveBeenCalledWith(expect.objectContaining({
      retailerId: 'retailer-1',
      amountPaise: 236000,
      quoteHash: 'trusted-quote',
    }));
    expect(result.order).toEqual({ id: 'rzp-order-1', amount: 236000, currency: 'INR' });
  });

  test('reports when Razorpay is not configured', async () => {
    const previousKeyId = env.RAZORPAY_KEY_ID;
    const previousKeySecret = env.RAZORPAY_KEY_SECRET;
    env.RAZORPAY_KEY_ID = '';
    env.RAZORPAY_KEY_SECRET = '';

    try {
      await expect(RetailerCheckoutService.createPaymentOrder(
        { _id: 'retailer-1' },
        { items: [{ productId: 'product-1', quantity: 1 }] },
      )).rejects.toMatchObject({ code: 'PAYMENT_NOT_CONFIGURED', message: 'Online payment is not configured.' });
    } finally {
      env.RAZORPAY_KEY_ID = previousKeyId;
      env.RAZORPAY_KEY_SECRET = previousKeySecret;
    }
  });

  test('creates the order only after signed, captured amount verification', async () => {
    const orderId = 'rzp-order-verified';
    const paymentId = 'rzp-payment-captured';
    const signature = crypto.createHmac('sha256', env.RAZORPAY_KEY_SECRET)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');
    const checkoutPayment = {
      _id: 'checkout-1',
      retailerId: 'retailer-1',
      razorpayOrderId: orderId,
      amountPaise: 236000,
      currency: 'INR',
      quoteHash: 'trusted-quote',
      checkoutPayload: { items: [{ productId: 'product-1', quantity: 10 }] },
      status: 'PENDING',
    };
    jest.spyOn(RetailerCheckoutPayment, 'findOne').mockResolvedValue(checkoutPayment);
    jest.spyOn(RetailerCheckoutPayment, 'findOneAndUpdate').mockResolvedValue({ ...checkoutPayment, status: 'PROCESSING' });
    jest.spyOn(RetailerCheckoutPayment, 'updateOne').mockResolvedValue({});
    jest.spyOn(OrderService, 'quoteOrder').mockResolvedValue({
      quoteHash: 'trusted-quote',
      amount: 2360,
    });
    jest.spyOn(OrderService, 'createOrder').mockResolvedValue({
      order: { _id: 'saved-order' },
      payment: { status: 'PAID' },
    });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        order_id: orderId,
        amount: 236000,
        currency: 'INR',
        status: 'captured',
      }),
    });

    const result = await RetailerCheckoutService.verifyPayment(
      { _id: 'retailer-1' },
      {
        razorpay_order_id: orderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: signature,
      },
      {},
    );

    expect(OrderService.createOrder).toHaveBeenCalledWith(
      { _id: 'retailer-1' },
      expect.objectContaining({ paymentMethod: 'ONLINE', expectedQuoteHash: 'trusted-quote' }),
      {},
      { razorpayOrderId: orderId, razorpayPaymentId: paymentId },
    );
    expect(RetailerCheckoutPayment.updateOne).toHaveBeenCalledWith(
      { _id: 'checkout-1', status: 'PROCESSING' },
      { $set: { status: 'PAID', orderId: 'saved-order' } },
    );
    expect(result.order._id).toBe('saved-order');
  });

  test('repeated verification returns the existing order without creating a duplicate', async () => {
    const orderId = 'rzp-order-already-paid';
    const paymentId = 'rzp-payment-already-paid';
    const signature = crypto.createHmac('sha256', env.RAZORPAY_KEY_SECRET)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');
    jest.spyOn(RetailerCheckoutPayment, 'findOne').mockResolvedValue({
      status: 'PAID',
      razorpayPaymentId: paymentId,
      orderId: 'saved-order',
    });
    jest.spyOn(Order, 'findById').mockResolvedValue({ _id: 'saved-order' });
    jest.spyOn(Payment, 'findOne').mockResolvedValue({ status: 'PAID' });
    const createOrder = jest.spyOn(OrderService, 'createOrder');

    const result = await RetailerCheckoutService.verifyPayment(
      { _id: 'retailer-1' },
      {
        razorpay_order_id: orderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: signature,
      },
      {},
    );

    expect(result.order._id).toBe('saved-order');
    expect(createOrder).not.toHaveBeenCalled();
  });

  test('does not create an order when gateway amount or capture status does not match', async () => {
    const orderId = 'rzp-order-mismatch';
    const paymentId = 'rzp-payment-mismatch';
    const signature = crypto.createHmac('sha256', env.RAZORPAY_KEY_SECRET)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');
    jest.spyOn(RetailerCheckoutPayment, 'findOne').mockResolvedValue({
      _id: 'checkout-2',
      amountPaise: 236000,
      currency: 'INR',
      status: 'PENDING',
    });
    const createOrder = jest.spyOn(OrderService, 'createOrder');
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        order_id: orderId,
        amount: 100,
        currency: 'INR',
        status: 'captured',
      }),
    });

    await expect(RetailerCheckoutService.verifyPayment(
      { _id: 'retailer-1' },
      {
        razorpay_order_id: orderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: signature,
      },
      {},
    )).rejects.toMatchObject({ code: 'PAYMENT_NOT_CAPTURED' });
    expect(createOrder).not.toHaveBeenCalled();
  });

  test('refunds a captured payment if the server-side checkout quote changed', async () => {
    const orderId = 'rzp-order-stale-quote';
    const paymentId = 'rzp-payment-stale-quote';
    const signature = crypto.createHmac('sha256', env.RAZORPAY_KEY_SECRET)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');
    jest.spyOn(RetailerCheckoutPayment, 'findOne').mockResolvedValue({
      _id: 'checkout-stale',
      amountPaise: 236000,
      currency: 'INR',
      quoteHash: 'old-quote',
      checkoutPayload: { items: [{ productId: 'product-1', quantity: 10 }] },
      status: 'PENDING',
    });
    jest.spyOn(RetailerCheckoutPayment, 'findOneAndUpdate').mockResolvedValue({ status: 'PROCESSING' });
    const updatePayment = jest.spyOn(RetailerCheckoutPayment, 'updateOne').mockResolvedValue({});
    jest.spyOn(OrderService, 'quoteOrder').mockResolvedValue({ quoteHash: 'new-quote' });
    const createOrder = jest.spyOn(OrderService, 'createOrder');
    jest.spyOn(Order, 'findOne').mockResolvedValue(null);
    global.fetch = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          order_id: orderId,
          amount: 236000,
          currency: 'INR',
          status: 'captured',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'refund-1', status: 'processed' }),
      });

    await expect(RetailerCheckoutService.verifyPayment(
      { _id: 'retailer-1' },
      {
        razorpay_order_id: orderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: signature,
      },
      {},
    )).rejects.toMatchObject({ code: 'PAYMENT_REFUNDED' });
    expect(global.fetch.mock.calls[1][0]).toContain(`/payments/${paymentId}/refund`);
    expect(updatePayment).toHaveBeenCalledWith(
      { _id: 'checkout-stale' },
      { $set: { status: 'REFUNDED' } },
    );
    expect(createOrder).not.toHaveBeenCalled();
  });

  test('rejects an invalid signature before loading the checkout payment', async () => {
    const paymentLookup = jest.spyOn(RetailerCheckoutPayment, 'findOne');

    await expect(RetailerCheckoutService.verifyPayment(
      { _id: 'retailer-1' },
      {
        razorpay_order_id: 'rzp-order-invalid',
        razorpay_payment_id: 'rzp-payment-invalid',
        razorpay_signature: 'invalid',
      },
      {},
    )).rejects.toMatchObject({ code: 'INVALID_PAYMENT_SIGNATURE' });
    expect(paymentLookup).not.toHaveBeenCalled();
  });

  test('a declined or cancelled checkout is marked failed without creating an order', async () => {
    const updatePayment = jest.spyOn(RetailerCheckoutPayment, 'findOneAndUpdate').mockResolvedValue({
      status: 'FAILED',
    });

    await expect(RetailerCheckoutService.markPaymentFailed(
      { _id: 'retailer-1' },
      'rzp-order-cancelled',
    )).resolves.toEqual({ status: 'FAILED' });
    expect(updatePayment).toHaveBeenCalledWith(
      { retailerId: 'retailer-1', razorpayOrderId: 'rzp-order-cancelled', status: 'PENDING' },
      { $set: { status: 'FAILED' } },
      { new: true },
    );
  });
});
