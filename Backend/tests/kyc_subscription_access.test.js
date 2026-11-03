const { assertWholesalerBusinessActivated } = require('../src/services/wholesaler-access.service');
const { requireActiveWholesaler } = require('../src/middleware/wholesalerAccess');
const { WholesalerProfile, WholesalerSubscription } = require('../src/models');
const { KYC_STATUS, ROLES } = require('../src/config/constants');
const KycService = require('../src/modules/kyc/kyc.service');

describe('KYC and Subscription Access Control & Optional Bank Details', () => {
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
    test('allows business access without a subscription', async () => {
      const subscriptionLookup = jest.spyOn(WholesalerSubscription, 'findOne');
      jest.spyOn(WholesalerProfile, 'findOne').mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            userId: 'user-nosub-2',
            kycStatus: KYC_STATUS.APPROVED,
            isDeleted: false,
          }),
        }),
      });

      await expect(assertWholesalerBusinessActivated('user-nosub-2'))
        .resolves.toMatchObject({ profile: { kycStatus: KYC_STATUS.APPROVED }, subscription: null });
      expect(subscriptionLookup).not.toHaveBeenCalled();
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
    test('allows business access and leaves expired subscription unchanged', async () => {
      const expiredSubscription = {
        status: 'EXPIRED',
        save: jest.fn(),
      };
      const subscriptionLookup = jest.spyOn(WholesalerSubscription, 'findOne')
        .mockResolvedValue(expiredSubscription);
      jest.spyOn(WholesalerProfile, 'findOne').mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            userId: 'user-expired-4',
            kycStatus: KYC_STATUS.APPROVED,
            isDeleted: false,
          }),
        }),
      });
      await expect(assertWholesalerBusinessActivated('user-expired-4'))
        .resolves.toMatchObject({ profile: { kycStatus: KYC_STATUS.APPROVED }, subscription: null });
      expect(subscriptionLookup).not.toHaveBeenCalled();
      expect(expiredSubscription.save).not.toHaveBeenCalled();
    });
  });

  describe('Combination 5: KYC approved + active subscription', () => {
    test('allows full business access without checking a subscription', async () => {
      const subscriptionLookup = jest.spyOn(WholesalerSubscription, 'findOne')
        .mockResolvedValue({ status: 'ACTIVE' });
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
      expect(result.subscription).toBeNull();
      expect(subscriptionLookup).not.toHaveBeenCalled();
    });

    test('requireActiveWholesaler allows approved KYC without a subscription', async () => {
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
