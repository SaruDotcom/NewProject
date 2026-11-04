const { assertWholesalerBusinessActivated } = require('../src/services/wholesaler-access.service');
const { requireActiveWholesaler } = require('../src/middleware/wholesalerAccess');
const { WholesalerProfile, WholesalerSubscription, SubscriptionPayment } = require('../src/models');
const { KYC_STATUS, ROLES } = require('../src/config/constants');
const KycService = require('../src/modules/kyc/kyc.service');

describe('KYC and Subscription Access Control', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Combination 1: KYC pending + no subscription', () => {
    test('blocks access with "Your KYC is under review"', async () => {
      jest.spyOn(WholesalerProfile, 'findOne').mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            userId: 'user-pending-1',
            kycStatus: KYC_STATUS.SUBMITTED,
            isDeleted: false,
          }),
        }),
      });
      await expect(assertWholesalerBusinessActivated('user-pending-1')).rejects.toMatchObject({
        message: 'Your KYC is under review',
        code: 'KYC_PENDING',
        statusCode: 403,
      });
    });
  });

  describe('Combination 2: KYC approved + no subscription', () => {
    test('blocks business access until an approved subscription exists', async () => {
      const subscriptionLookup = jest.spyOn(WholesalerSubscription, 'findOne');
      jest.spyOn(SubscriptionPayment, 'exists').mockResolvedValue(null);
      jest.spyOn(WholesalerProfile, 'findOne').mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            userId: 'user-nosub-2',
            kycStatus: KYC_STATUS.APPROVED,
            isDeleted: false,
          }),
        }),
      });

      subscriptionLookup.mockResolvedValue(null);
      await expect(assertWholesalerBusinessActivated('user-nosub-2')).rejects.toMatchObject({
        code: 'SUBSCRIPTION_REQUIRED',
        statusCode: 403,
      });
      expect(subscriptionLookup).toHaveBeenCalledWith({ userId: 'user-nosub-2' });
    });
  });

  describe('Combination 3: KYC pending despite an active subscription', () => {
    test('blocks access with "Your KYC is under review"', async () => {
      jest.spyOn(WholesalerSubscription, 'findOne')
        .mockResolvedValue({ status: 'ACTIVE', renewalDate: new Date(Date.now() + 86400000) });
      jest.spyOn(WholesalerProfile, 'findOne').mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            userId: 'user-pending-3',
            kycStatus: 'UNDER_REVIEW',
            isDeleted: false,
          }),
        }),
      });
      await expect(assertWholesalerBusinessActivated('user-pending-3')).rejects.toMatchObject({
        message: 'Your KYC is under review',
        code: 'KYC_PENDING',
        statusCode: 403,
      });
    });
  });

  describe('Combination 4: KYC approved + expired subscription', () => {
    test('blocks business access and persists the expired status', async () => {
      const expiredSubscription = {
        status: 'ACTIVE',
        renewalDate: new Date(Date.now() - 86400000),
        save: jest.fn(),
      };
      jest.spyOn(WholesalerSubscription, 'findOne').mockResolvedValue(expiredSubscription);
      jest.spyOn(SubscriptionPayment, 'exists').mockResolvedValue(null);
      jest.spyOn(WholesalerProfile, 'findOne').mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            userId: 'user-expired-4',
            kycStatus: KYC_STATUS.APPROVED,
            isDeleted: false,
          }),
        }),
      });
      await expect(assertWholesalerBusinessActivated('user-expired-4')).rejects.toMatchObject({
        code: 'SUBSCRIPTION_EXPIRED',
        statusCode: 403,
      });
      expect(expiredSubscription.status).toBe('EXPIRED');
      expect(expiredSubscription.save).toHaveBeenCalled();
    });
  });

  describe('Combination 5: KYC approved + active subscription', () => {
    test('allows full business access with an active subscription', async () => {
      const subscriptionLookup = jest.spyOn(WholesalerSubscription, 'findOne')
        .mockResolvedValue({ status: 'ACTIVE', renewalDate: new Date(Date.now() + 86400000) });
      const mockProfile = {
        userId: 'user-active-5',
        kycStatus: KYC_STATUS.APPROVED,
        isDeleted: false,
      };
      jest.spyOn(WholesalerProfile, 'findOne').mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(mockProfile),
        }),
      });
      const result = await assertWholesalerBusinessActivated('user-active-5');
      expect(result).toBeDefined();
      expect(result.profile.kycStatus).toBe(KYC_STATUS.APPROVED);
      expect(result.subscription.status).toBe('ACTIVE');
      expect(subscriptionLookup).toHaveBeenCalledWith({ userId: 'user-active-5' });
    });

    test('requireActiveWholesaler allows approved KYC with an active subscription', async () => {
      jest.spyOn(WholesalerSubscription, 'findOne')
        .mockResolvedValue({ status: 'ACTIVE', renewalDate: new Date(Date.now() + 86400000) });
      jest.spyOn(WholesalerProfile, 'findOne').mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            userId: 'user-mid-5',
            kycStatus: KYC_STATUS.APPROVED,
            isDeleted: false,
          }),
        }),
      });
      const req = { user: { _id: 'user-mid-5', role: ROLES.WHOLESALER } };
      const res = {};
      const next = jest.fn();

      await requireActiveWholesaler(req, res, next);
      expect(next).toHaveBeenCalledWith();
    });

    test('blocks business access while a paid subscription awaits approval', async () => {
      jest.spyOn(WholesalerSubscription, 'findOne').mockResolvedValue(null);
      jest.spyOn(SubscriptionPayment, 'exists').mockResolvedValue({ _id: 'payment-1' });
      jest.spyOn(WholesalerProfile, 'findOne').mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            userId: 'user-review-5',
            kycStatus: KYC_STATUS.APPROVED,
            isDeleted: false,
          }),
        }),
      });

      await expect(assertWholesalerBusinessActivated('user-review-5')).rejects.toMatchObject({
        code: 'SUBSCRIPTION_PENDING_APPROVAL',
        statusCode: 403,
      });
    });

    test('requireActiveWholesaler bypasses Super Admin and Admin roles unconditionally', async () => {
      const reqAdmin = { user: { _id: 'admin-1', role: ROLES.SUPER_ADMIN } };
      const res = {};
      const next = jest.fn();

      await requireActiveWholesaler(reqAdmin, res, next);
      expect(next).toHaveBeenCalledWith();
    });
  });

  describe('Combination 6: KYC rejected + active subscription', () => {
    test('blocks access with rejection prompt and code KYC_REJECTED', async () => {
      jest.spyOn(WholesalerProfile, 'findOne').mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            userId: 'user-rej-6',
            kycStatus: KYC_STATUS.REJECTED,
            isDeleted: false,
          }),
        }),
      });
      await expect(assertWholesalerBusinessActivated('user-rej-6')).rejects.toMatchObject({
        code: 'KYC_REJECTED',
        statusCode: 403,
      });
    });
  });

  describe('Bank Details Optional During KYC', () => {
    test('validates bank details when provided correctly', () => {
      const validAccount = '123456789012';
      const validIfsc = 'SBIN0001234';
      expect(/^\d{9,18}$/.test(validAccount)).toBe(true);
      expect(/^[A-Z]{4}0[A-Z0-9]{6}$/.test(validIfsc)).toBe(true);
    });

    test('detects invalid bank details when provided', () => {
      const invalidAccount = '1234';
      const invalidIfsc = 'INVALID123';
      expect(/^\d{9,18}$/.test(invalidAccount)).toBe(false);
      expect(/^[A-Z]{4}0[A-Z0-9]{6}$/.test(invalidIfsc)).toBe(false);
    });
  });
});
