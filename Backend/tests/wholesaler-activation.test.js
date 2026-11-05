const {
  SubscriptionPlan,
  SubscriptionPlanCatalog,
  WholesalerProfile,
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

  test('allows business operations for approved KYC without a subscription', async () => {
    const profile = { kycStatus: 'APPROVED' };
    mockProfile(profile);

    await expect(assertWholesalerBusinessActivated('wholesaler-1'))
      .resolves.toEqual({ profile, subscription: null });
  });

  test('requires approved KYC', async () => {
    mockProfile({ kycStatus: 'SUBMITTED' });

    await expect(assertWholesalerBusinessActivated('wholesaler-1'))
      .rejects.toMatchObject({ code: 'KYC_PENDING' });
  });

  test('migrates the existing subscription catalog to the six exact standard plans', async () => {
    jest.spyOn(SubscriptionPlanCatalog, 'findOne').mockResolvedValue({ initialized: true, version: 1 });
    jest.spyOn(SubscriptionPlanCatalog, 'findOneAndUpdate').mockResolvedValue({ initialized: true, version: 1 });
    const upsertPlan = jest.spyOn(SubscriptionPlan, 'findOneAndUpdate').mockResolvedValue({});
    const retireOldPlans = jest.spyOn(SubscriptionPlan, 'updateMany').mockResolvedValue({});
    const updateCatalog = jest.spyOn(SubscriptionPlanCatalog, 'updateOne').mockResolvedValue({});

    await SubscriptionService.ensurePlanCatalog();

    expect(upsertPlan).toHaveBeenCalledTimes(6);
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
        $set: expect.objectContaining({ name: 'Basic Yearly', price: 1499, billingPeriod: 'YEARLY' }),
      }),
      expect.any(Object),
    );
    expect(upsertPlan).toHaveBeenCalledWith(
      { key: 'WHOLESALER_MEDIUM_MONTHLY' },
      expect.objectContaining({
        $set: expect.objectContaining({ name: 'Medium Monthly', price: 399, billingPeriod: 'MONTHLY' }),
      }),
      expect.any(Object),
    );
    expect(upsertPlan).toHaveBeenCalledWith(
      { key: 'WHOLESALER_MEDIUM_YEARLY' },
      expect.objectContaining({
        $set: expect.objectContaining({ name: 'Medium Yearly', price: 2499, billingPeriod: 'YEARLY' }),
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
        $set: expect.objectContaining({ name: 'Pro Yearly', price: 4499, billingPeriod: 'YEARLY' }),
      }),
      expect.any(Object),
    );
    expect(retireOldPlans).toHaveBeenCalledWith(
      { key: { $regex: '^WHOLESALER_', $nin: [
        'WHOLESALER_MONTHLY',
        'WHOLESALER_ANNUAL',
        'WHOLESALER_MEDIUM_MONTHLY',
        'WHOLESALER_MEDIUM_YEARLY',
        'WHOLESALER_499',
        'WHOLESALER_PRO_YEARLY',
      ] } },
      { $set: { isActive: false } },
    );
    expect(updateCatalog).toHaveBeenCalledWith(
      { key: 'WHOLESALER' },
      { $set: { initialized: true, version: 3 } },
    );
  });
});
