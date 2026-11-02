const {
  SubscriptionPlan,
  SubscriptionPlanCatalog,
  WholesalerProfile,
  WholesalerSubscription,
} = require('../src/models');
const SubscriptionService = require('../src/modules/subscriptions/subscriptions.service');
const { assertWholesalerBusinessActivated } = require('../src/services/wholesaler-access.service');

describe('Wholesaler business activation', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  const mockProfile = (profile) => {
    const lean = jest.fn().mockResolvedValue(profile);
    jest.spyOn(WholesalerProfile, 'findOne').mockReturnValue({
      select: jest.fn().mockReturnValue({ lean }),
    });
  };

  test('allows business operations only for approved KYC and an unexpired active subscription', async () => {
    const profile = { kycStatus: 'APPROVED' };
    const subscription = {
      status: 'ACTIVE',
      renewalDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
      save: jest.fn(),
    };
    mockProfile(profile);
    jest.spyOn(WholesalerSubscription, 'findOne').mockResolvedValue(subscription);

    await expect(assertWholesalerBusinessActivated('wholesaler-1'))
      .resolves.toEqual({ profile, subscription });
    expect(subscription.save).not.toHaveBeenCalled();
  });

  test('requires approved KYC before checking subscription', async () => {
    mockProfile({ kycStatus: 'SUBMITTED' });
    const subscriptionLookup = jest.spyOn(WholesalerSubscription, 'findOne');

    await expect(assertWholesalerBusinessActivated('wholesaler-1'))
      .rejects.toMatchObject({ code: 'KYC_PENDING' });
    expect(subscriptionLookup).not.toHaveBeenCalled();
  });

  test.each([
    ['missing', null],
    ['cancelled', { status: 'CANCELLED', save: jest.fn() }],
  ])('blocks business operations when the subscription is %s', async (_label, subscription) => {
    mockProfile({ kycStatus: 'APPROVED' });
    jest.spyOn(WholesalerSubscription, 'findOne').mockResolvedValue(subscription);

    await expect(assertWholesalerBusinessActivated('wholesaler-1'))
      .rejects.toMatchObject({ code: 'ACTIVE_SUBSCRIPTION_REQUIRED' });
    if (subscription) expect(subscription.save).not.toHaveBeenCalled();
  });

  test('marks expired active subscriptions expired before denying access', async () => {
    const subscription = {
      status: 'ACTIVE',
      renewalDate: new Date(Date.now() - 1000),
      save: jest.fn().mockResolvedValue(undefined),
    };
    mockProfile({ kycStatus: 'APPROVED' });
    jest.spyOn(WholesalerSubscription, 'findOne').mockResolvedValue(subscription);

    await expect(assertWholesalerBusinessActivated('wholesaler-1'))
      .rejects.toMatchObject({ code: 'SUBSCRIPTION_EXPIRED' });
    expect(subscription.status).toBe('EXPIRED');
    expect(subscription.save).toHaveBeenCalledTimes(1);
  });

  test('migrates the existing subscription catalog to the four exact standard plans', async () => {
    jest.spyOn(SubscriptionPlanCatalog, 'findOne').mockResolvedValue({ initialized: true, version: 1 });
    jest.spyOn(SubscriptionPlanCatalog, 'findOneAndUpdate').mockResolvedValue({ initialized: true, version: 1 });
    const upsertPlan = jest.spyOn(SubscriptionPlan, 'findOneAndUpdate').mockResolvedValue({});
    const updateCatalog = jest.spyOn(SubscriptionPlanCatalog, 'updateOne').mockResolvedValue({});

    await SubscriptionService.ensurePlanCatalog();

    expect(upsertPlan).toHaveBeenCalledTimes(4);
    expect(upsertPlan).toHaveBeenCalledWith(
      { key: 'WHOLESALER_MONTHLY' },
      expect.objectContaining({
        $set: expect.objectContaining({ name: 'Basic Monthly', price: 299, billingPeriod: 'MONTHLY' }),
      }),
      expect.any(Object),
    );
    expect(upsertPlan).toHaveBeenCalledWith(
      { key: 'WHOLESALER_ANNUAL' },
      expect.objectContaining({
        $set: expect.objectContaining({ name: 'Basic Yearly', price: 2499, billingPeriod: 'YEARLY' }),
      }),
      expect.any(Object),
    );
    expect(upsertPlan).toHaveBeenCalledWith(
      { key: 'WHOLESALER_499' },
      expect.objectContaining({
        $set: expect.objectContaining({ name: 'Pro Monthly', price: 499, billingPeriod: 'MONTHLY' }),
      }),
      expect.any(Object),
    );
    expect(upsertPlan).toHaveBeenCalledWith(
      { key: 'WHOLESALER_PRO_YEARLY' },
      expect.objectContaining({
        $set: expect.objectContaining({ name: 'Pro Yearly', price: 4999, billingPeriod: 'YEARLY' }),
      }),
      expect.any(Object),
    );
    expect(updateCatalog).toHaveBeenCalledWith(
      { key: 'WHOLESALER' },
      { $set: { initialized: true, version: 2 } },
    );
  });
});
