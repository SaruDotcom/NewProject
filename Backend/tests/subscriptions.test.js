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

  test('the subscription plan model defaults to the Basic Monthly price', () => {
    const plan = new SubscriptionPlan({ name: 'Wholesaler Plan' });

    expect(plan.price).toBe(299);
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

  test('does not create another order while a paid subscription awaits approval', async () => {
    jest.spyOn(SubscriptionPayment, 'exists').mockResolvedValue({ _id: 'payment-pending-approval' });

    await expect(SubscriptionService.createOrder('user-1', 'plan-1')).rejects.toMatchObject({
      code: 'CONFLICT',
      message: 'A paid subscription is already awaiting Superadmin approval',
    });
  });

  test('records captured payments as awaiting Superadmin approval', async () => {
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
    const paymentUpdate = jest.spyOn(SubscriptionPayment, 'findOneAndUpdate')
      .mockResolvedValue({ ...purchase, status: 'PAID', approvalStatus: 'PENDING' });
    jest.spyOn(WholesalerSubscription, 'findOne').mockResolvedValue(null);
    const subscriptionUpdate = jest.spyOn(WholesalerSubscription, 'findOneAndUpdate');
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

    expect(result).toBeNull();
    expect(paymentUpdate).toHaveBeenCalledWith(
      { _id: 'purchase-1', status: { $in: ['PENDING', 'FAILED', 'CANCELLED'] } },
      { $set: expect.objectContaining({ status: 'PAID', approvalStatus: 'PENDING', razorpayPaymentId: paymentId }) },
      { new: true },
    );
    expect(subscriptionUpdate).not.toHaveBeenCalled();
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

  test('recovers a captured payment after checkout cancellation was recorded', async () => {
    const orderId = 'order-cancel-race';
    const paymentId = 'payment-captured-after-cancel';
    const signature = crypto.createHmac('sha256', env.RAZORPAY_KEY_SECRET)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');
    jest.spyOn(WholesalerProfile, 'findOne').mockReturnValue({
      select: jest.fn().mockResolvedValue({ _id: 'profile-1' }),
    });
    jest.spyOn(SubscriptionPayment, 'findOne').mockResolvedValue({
      _id: 'purchase-cancel-race',
      amountPaise: 49900,
      status: 'CANCELLED',
    });
    jest.spyOn(SubscriptionPayment, 'findOneAndUpdate').mockResolvedValue({
      _id: 'purchase-cancel-race',
      status: 'PAID',
      approvalStatus: 'PENDING',
    });
    jest.spyOn(WholesalerSubscription, 'findOne').mockResolvedValue(null);
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        order_id: orderId,
        amount: 49900,
        currency: 'INR',
        status: 'captured',
      }),
    });

    await expect(SubscriptionService.verifyPayment('user-1', {
      razorpay_order_id: orderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: signature,
    })).resolves.toBeNull();
    expect(SubscriptionPayment.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'purchase-cancel-race', status: { $in: ['PENDING', 'FAILED', 'CANCELLED'] } },
      expect.objectContaining({ $set: expect.objectContaining({ status: 'PAID' }) }),
      { new: true },
    );
  });

  test('extends a renewal from month-end without drifting into the following month', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2025-01-15T12:00:00.000Z'));
    const paymentId = 'payment-month-end';
    const renewalDate = new Date('2025-01-31T12:00:00.000Z');
    jest.spyOn(WholesalerProfile, 'findOne').mockReturnValue({
      select: jest.fn().mockResolvedValue({ _id: 'profile-1', kycStatus: 'APPROVED' }),
    });
    jest.spyOn(SubscriptionPayment, 'findById').mockResolvedValue({
      _id: 'purchase-month-end',
      userId: 'user-1',
      planId: 'plan-1',
      planName: 'Wholesaler Plan',
      amount: 499,
      billingPeriod: 'MONTHLY',
      status: 'PAID',
      approvalStatus: 'PENDING',
      razorpayOrderId: 'order-month-end',
      razorpayPaymentId: paymentId,
    });
    jest.spyOn(SubscriptionPayment, 'findOneAndUpdate').mockResolvedValue({
      _id: 'purchase-month-end',
      status: 'PAID',
      approvalStatus: 'APPROVED',
      planId: 'plan-1',
      planName: 'Wholesaler Plan',
      amount: 499,
      billingPeriod: 'MONTHLY',
      razorpayOrderId: 'order-month-end',
      razorpayPaymentId: paymentId,
    });
    jest.spyOn(WholesalerSubscription, 'findOne').mockResolvedValue({
      _id: 'subscription-1',
      razorpayPaymentId: 'previous-payment',
      status: 'ACTIVE',
      startedAt: new Date('2024-12-31T12:00:00.000Z'),
      renewalDate,
    });
    jest.spyOn(WholesalerSubscription, 'findOneAndUpdate').mockResolvedValue({ status: 'ACTIVE' });

    await SubscriptionService.approvePayment('purchase-month-end', 'admin-1');

    expect(WholesalerSubscription.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'subscription-1', razorpayPaymentId: 'previous-payment' },
      expect.objectContaining({
        $set: expect.objectContaining({ renewalDate: new Date('2025-02-28T12:00:00.000Z') }),
      }),
      { new: true, runValidators: true },
    );
  });

  test('renews annual purchases for a calendar year and stores the plan period', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2025-03-01T12:00:00.000Z'));
    const paymentId = 'payment-annual';
    jest.spyOn(WholesalerProfile, 'findOne').mockReturnValue({
      select: jest.fn().mockResolvedValue({ _id: 'profile-1', kycStatus: 'APPROVED' }),
    });
    jest.spyOn(SubscriptionPayment, 'findById').mockResolvedValue({
      _id: 'purchase-annual',
      userId: 'user-1',
      planId: 'annual-plan',
      planName: 'Annual Pro Plan',
      billingPeriod: 'YEARLY',
      amount: 3000,
      status: 'PAID',
      approvalStatus: 'PENDING',
      razorpayOrderId: 'order-annual',
      razorpayPaymentId: paymentId,
      paymentMethod: 'card',
    });
    jest.spyOn(SubscriptionPayment, 'findOneAndUpdate').mockResolvedValue({
      _id: 'purchase-annual',
      status: 'PAID',
      approvalStatus: 'APPROVED',
      planId: 'annual-plan',
      planName: 'Annual Pro Plan',
      amount: 3000,
      billingPeriod: 'YEARLY',
      razorpayOrderId: 'order-annual',
      razorpayPaymentId: paymentId,
    });
    jest.spyOn(WholesalerSubscription, 'findOne').mockResolvedValue(null);
    jest.spyOn(WholesalerSubscription, 'findOneAndUpdate').mockResolvedValue({ status: 'ACTIVE' });

    await SubscriptionService.approvePayment('purchase-annual', 'admin-1');

    expect(WholesalerSubscription.findOneAndUpdate).toHaveBeenCalledWith(
      { userId: 'user-1' },
      expect.objectContaining({
        $set: expect.objectContaining({
          billingPeriod: 'YEARLY',
          renewalDate: new Date('2026-03-01T12:00:00.000Z'),
          amount: 3000,
        }),
      }),
      { new: true, upsert: true, runValidators: true },
    );
  });

  test('requires approved KYC before Superadmin can approve a paid subscription', async () => {
    jest.spyOn(SubscriptionPayment, 'findById').mockResolvedValue({
      _id: 'paid-payment-1',
      userId: 'user-1',
      status: 'PAID',
      approvalStatus: 'PENDING',
      razorpayPaymentId: 'gateway-payment-1',
    });
    jest.spyOn(WholesalerProfile, 'findOne').mockReturnValue({
      select: jest.fn().mockResolvedValue({ _id: 'profile-1', kycStatus: 'SUBMITTED' }),
    });
    const subscriptionUpdate = jest.spyOn(WholesalerSubscription, 'findOneAndUpdate');
    const paymentUpdate = jest.spyOn(SubscriptionPayment, 'findOneAndUpdate');

    await expect(SubscriptionService.approvePayment('paid-payment-1', 'admin-1')).rejects.toMatchObject({
      code: 'CONFLICT',
      message: 'Wholesaler KYC must be approved before approving a subscription',
    });
    expect(subscriptionUpdate).not.toHaveBeenCalled();
    expect(paymentUpdate).not.toHaveBeenCalled();
  });

  test('records payment failure with error reason and payment method', async () => {
    jest.spyOn(SubscriptionPayment, 'findOne').mockResolvedValue({
      _id: 'payment-failed-1',
      planId: 'plan-1',
      planName: 'Wholesaler Plan',
      amount: 499,
      amountPaise: 49900,
      status: 'PENDING',
      razorpayOrderId: 'order-fail-1',
    });
    jest.spyOn(SubscriptionPayment, 'findOneAndUpdate').mockResolvedValue({
      _id: 'payment-failed-1',
      status: 'FAILED',
      errorReason: 'Payment declined by bank',
      paymentMethod: 'card',
    });

    const result = await SubscriptionService.recordPaymentFailure('user-1', {
      razorpayOrderId: 'order-fail-1',
      razorpayPaymentId: 'pay_failed_123',
      errorReason: 'Payment declined by bank',
      paymentMethod: 'card',
    });

    expect(result.status).toBe('FAILED');
    expect(result.errorReason).toBe('Payment declined by bank');
    expect(result.paymentMethod).toBe('card');
  });

  test('records payment cancellation for pending orders', async () => {
    jest.spyOn(SubscriptionPayment, 'findOne').mockResolvedValue({
      _id: 'payment-cancel-1',
      planId: 'plan-1',
      planName: 'Wholesaler Plan',
      amount: 499,
      amountPaise: 49900,
      status: 'PENDING',
      razorpayOrderId: 'order-cancel-1',
    });
    jest.spyOn(SubscriptionPayment, 'findOneAndUpdate').mockResolvedValue({
      _id: 'payment-cancel-1',
      status: 'CANCELLED',
      errorReason: 'Cancelled by user',
    });

    const result = await SubscriptionService.recordPaymentCancellation('user-1', {
      razorpayOrderId: 'order-cancel-1',
      reason: 'Cancelled by user',
    });

    expect(result.status).toBe('CANCELLED');
    expect(result.errorReason).toBe('Cancelled by user');
  });

  test('prevents duplicate processing if payment already paid', async () => {
    jest.spyOn(WholesalerProfile, 'findOne').mockReturnValue({
      select: jest.fn().mockResolvedValue({ _id: 'profile-1' }),
    });
    jest.spyOn(SubscriptionPayment, 'findOne').mockResolvedValue({
      _id: 'purchase-already-paid',
      userId: 'user-1',
      status: 'PAID',
      razorpayPaymentId: 'pay_already_123',
    });
    jest.spyOn(WholesalerSubscription, 'findOne').mockResolvedValue({
      status: 'ACTIVE',
      planName: 'Wholesaler Plan',
    });

    const result = await SubscriptionService.verifyPayment('user-1', {
      razorpay_order_id: 'order-dup',
      razorpay_payment_id: 'pay_already_123',
      razorpay_signature: crypto.createHmac('sha256', env.RAZORPAY_KEY_SECRET)
        .update('order-dup|pay_already_123')
        .digest('hex'),
    });

    expect(result.status).toBe('ACTIVE');
  });
});
