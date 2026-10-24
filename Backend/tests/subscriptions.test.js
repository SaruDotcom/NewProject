const crypto = require('crypto');
const env = require('../src/config/env');
const {
  SubscriptionPlan,
  SubscriptionPayment,
  WholesalerProfile,
  WholesalerSubscription,
} = require('../src/models');
const SubscriptionService = require('../src/modules/subscriptions/subscriptions.service');

describe('Wholesaler subscriptions', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    env.RAZORPAY_KEY_ID = 'rzp_test_key';
    env.RAZORPAY_KEY_SECRET = 'test_secret';
    jest.restoreAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  test('the subscription plan model defaults to ₹499 monthly', () => {
    const plan = new SubscriptionPlan({ name: 'Wholesaler Plan' });

    expect(plan.price).toBe(499);
    expect(plan.billingPeriod).toBe('MONTHLY');
    expect(plan.isActive).toBe(true);
  });

  test('accepts yearly plan details and rejects unsupported billing periods', () => {
    expect(SubscriptionService.validatePlanInput({
      name: 'Annual Pro Plan',
      price: 3000,
      billingPeriod: 'YEARLY',
      recommended: true,
    }, { creating: true })).toEqual({
      name: 'Annual Pro Plan',
      price: 3000,
      billingPeriod: 'YEARLY',
      recommended: true,
    });
    expect(() => SubscriptionService.validatePlanInput({ billingPeriod: 'ANNUAL' }))
      .toThrow('Billing period must be MONTHLY or YEARLY');
  });

  test('rejects an invalid Razorpay signature before looking up a purchase', async () => {
    const purchaseLookup = jest.spyOn(SubscriptionPayment, 'findOne');

    await expect(SubscriptionService.verifyPayment('user-1', {
      razorpay_order_id: 'order-1',
      razorpay_payment_id: 'payment-1',
      razorpay_signature: 'incorrect',
    })).rejects.toMatchObject({ code: 'INVALID_PAYMENT_SIGNATURE' });
    expect(purchaseLookup).not.toHaveBeenCalled();
  });

  test('activates a subscription only after the gateway confirms the captured amount', async () => {
    const orderId = 'order-verified';
    const paymentId = 'payment-captured';
    const amountPaise = 49900;
    const signature = crypto.createHmac('sha256', env.RAZORPAY_KEY_SECRET)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');
    const purchase = {
      _id: 'purchase-1',
      planId: 'plan-1',
      planName: 'Wholesaler Plan',
      amount: 499,
      amountPaise,
      status: 'PENDING',
    };
    jest.spyOn(WholesalerProfile, 'findOne').mockReturnValue({
      select: jest.fn().mockResolvedValue({ _id: 'profile-1' }),
    });
    jest.spyOn(SubscriptionPayment, 'findOne').mockResolvedValue(purchase);
    jest.spyOn(SubscriptionPayment, 'findOneAndUpdate').mockResolvedValue({ ...purchase, status: 'PAID' });
    jest.spyOn(WholesalerSubscription, 'findOne').mockResolvedValue(null);
    jest.spyOn(WholesalerSubscription, 'findOneAndUpdate').mockResolvedValue({
      status: 'ACTIVE',
      amount: 499,
      renewalDate: new Date(),
    });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        order_id: orderId,
        amount: amountPaise,
        currency: 'INR',
        status: 'captured',
      }),
    });

    const result = await SubscriptionService.verifyPayment('user-1', {
      razorpay_order_id: orderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: signature,
    });

    expect(result.status).toBe('ACTIVE');
    expect(WholesalerSubscription.findOneAndUpdate).toHaveBeenCalledWith(
      { userId: 'user-1' },
      expect.objectContaining({ $set: expect.objectContaining({ amount: 499, razorpayPaymentId: paymentId }) }),
      expect.objectContaining({ upsert: true }),
    );
  });

  test('does not activate when captured amount differs from the saved order amount', async () => {
    const orderId = 'order-mismatch';
    const paymentId = 'payment-mismatch';
    const signature = crypto.createHmac('sha256', env.RAZORPAY_KEY_SECRET)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');
    jest.spyOn(WholesalerProfile, 'findOne').mockReturnValue({
      select: jest.fn().mockResolvedValue({ _id: 'profile-1' }),
    });
    jest.spyOn(SubscriptionPayment, 'findOne').mockResolvedValue({
      _id: 'purchase-2',
      amountPaise: 49900,
      status: 'PENDING',
    });
    jest.spyOn(WholesalerSubscription, 'findOneAndUpdate');
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        order_id: orderId,
        amount: 100,
        currency: 'INR',
        status: 'captured',
      }),
    });

    await expect(SubscriptionService.verifyPayment('user-1', {
      razorpay_order_id: orderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: signature,
    })).rejects.toMatchObject({ code: 'PAYMENT_NOT_CAPTURED' });
    expect(WholesalerSubscription.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test('extends a renewal from month-end without drifting into the following month', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2025-01-15T12:00:00.000Z'));
    const orderId = 'order-month-end';
    const paymentId = 'payment-month-end';
    const signature = crypto.createHmac('sha256', env.RAZORPAY_KEY_SECRET)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');
    const renewalDate = new Date('2025-01-31T12:00:00.000Z');
    jest.spyOn(WholesalerProfile, 'findOne').mockReturnValue({
      select: jest.fn().mockResolvedValue({ _id: 'profile-1' }),
    });
    jest.spyOn(SubscriptionPayment, 'findOne').mockResolvedValue({
      _id: 'purchase-month-end',
      planId: 'plan-1',
      planName: 'Wholesaler Plan',
      amount: 499,
      amountPaise: 49900,
      status: 'PENDING',
    });
    jest.spyOn(SubscriptionPayment, 'findOneAndUpdate').mockResolvedValue({ status: 'PAID' });
    jest.spyOn(WholesalerSubscription, 'findOne').mockResolvedValue({
      status: 'ACTIVE',
      startedAt: new Date('2024-12-31T12:00:00.000Z'),
      renewalDate,
    });
    jest.spyOn(WholesalerSubscription, 'findOneAndUpdate').mockResolvedValue({ status: 'ACTIVE' });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        order_id: orderId,
        amount: 49900,
        currency: 'INR',
        status: 'captured',
      }),
    });

    await SubscriptionService.verifyPayment('user-1', {
      razorpay_order_id: orderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: signature,
    });

    expect(WholesalerSubscription.findOneAndUpdate).toHaveBeenCalledWith(
      { userId: 'user-1' },
      expect.objectContaining({
        $set: expect.objectContaining({ renewalDate: new Date('2025-02-28T12:00:00.000Z') }),
      }),
      expect.objectContaining({ upsert: true }),
    );
  });

  test('renews annual purchases for a calendar year and stores the plan period', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2025-03-01T12:00:00.000Z'));
    const orderId = 'order-annual';
    const paymentId = 'payment-annual';
    const signature = crypto.createHmac('sha256', env.RAZORPAY_KEY_SECRET)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');
    jest.spyOn(WholesalerProfile, 'findOne').mockReturnValue({
      select: jest.fn().mockResolvedValue({ _id: 'profile-1' }),
    });
    jest.spyOn(SubscriptionPayment, 'findOne').mockResolvedValue({
      _id: 'purchase-annual',
      planId: 'annual-plan',
      planName: 'Annual Pro Plan',
      billingPeriod: 'YEARLY',
      amount: 3000,
      amountPaise: 300000,
      status: 'PENDING',
    });
    jest.spyOn(SubscriptionPayment, 'findOneAndUpdate').mockResolvedValue({ status: 'PAID' });
    jest.spyOn(WholesalerSubscription, 'findOne').mockResolvedValue(null);
    jest.spyOn(WholesalerSubscription, 'findOneAndUpdate').mockResolvedValue({ status: 'ACTIVE' });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        order_id: orderId,
        amount: 300000,
        currency: 'INR',
        status: 'captured',
      }),
    });

    await SubscriptionService.verifyPayment('user-1', {
      razorpay_order_id: orderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: signature,
    });

    expect(WholesalerSubscription.findOneAndUpdate).toHaveBeenCalledWith(
      { userId: 'user-1' },
      expect.objectContaining({
        $set: expect.objectContaining({
          billingPeriod: 'YEARLY',
          renewalDate: new Date('2026-03-01T12:00:00.000Z'),
          amount: 3000,
        }),
      }),
      expect.objectContaining({ upsert: true }),
    );
  });
});
