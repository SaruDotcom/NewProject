const ReferralService = require('../src/modules/referrals/referrals.service');
const { WholesalerProfile, User, Product, Category } = require('../src/models');
const { KYC_STATUS, USER_STATUS, ROLES } = require('../src/config/constants');

jest.mock('../src/models', () => ({
  WholesalerProfile: {
    findOne: jest.fn(),
    updateOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
    findById: jest.fn(),
    find: jest.fn(),
  },
  User: {
    findOne: jest.fn(),
    findById: jest.fn(),
  },
  WholesalerRetailerRelationship: {
    countDocuments: jest.fn(),
  },
  Product: {
    find: jest.fn(),
    distinct: jest.fn(),
    countDocuments: jest.fn(),
  },
  Category: {
    find: jest.fn(),
    findOne: jest.fn(),
  },
}));

describe('ReferralService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('resolveActiveCode', () => {
    it('throws 404 if code is missing or invalid format', async () => {
      await expect(ReferralService.resolveActiveCode('')).rejects.toThrow(
        'Invalid invitation link. This referral code does not exist.'
      );
      await expect(ReferralService.resolveActiveCode('!@#$')).rejects.toThrow(
        'Invalid invitation link. This referral code does not exist.'
      );
    });

    it('resolves active wholesaler profile successfully', async () => {
      const mockProfile = {
        _id: 'prof123',
        userId: 'user123',
        retailerReferralCode: 'WDE15J',
        kycStatus: KYC_STATUS.APPROVED,
        retailerSignupsEnabled: true,
        businessName: 'Sarita Store',
        businessTagline: 'Premium Ethnic Wear & Wholesale Garments',
        isDeleted: false,
      };

      const mockWholesalerUser = {
        _id: 'user123',
        role: ROLES.WHOLESALER,
        status: USER_STATUS.ACTIVE,
        name: 'Sarita',
        isDeleted: false,
      };

      WholesalerProfile.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockProfile),
      });

      User.findOne.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(mockWholesalerUser),
        }),
      });

      const result = await ReferralService.resolveActiveCode('WDE15J');
      expect(result.profile.retailerReferralCode).toBe('WDE15J');
      expect(result.wholesaler.status).toBe(USER_STATUS.ACTIVE);
    });

    it('handles case-insensitivity correctly (wde15j -> WDE15J)', async () => {
      const mockProfile = {
        _id: 'prof123',
        userId: 'user123',
        retailerReferralCode: 'WDE15J',
        kycStatus: KYC_STATUS.APPROVED,
        retailerSignupsEnabled: true,
        businessName: 'Sarita Store',
        isDeleted: false,
      };

      WholesalerProfile.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockProfile),
      });

      User.findOne.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({ _id: 'user123', role: ROLES.WHOLESALER, status: USER_STATUS.ACTIVE }),
        }),
      });

      const result = await ReferralService.resolveActiveCode('wde15j');
      expect(result.profile.retailerReferralCode).toBe('WDE15J');
    });

    it('matches legacy lowercase codes and profiles without an isDeleted field', async () => {
      const profile = {
        _id: 'legacy-profile',
        userId: 'legacy-user',
        retailerReferralCode: 'ab12cd',
        kycStatus: KYC_STATUS.APPROVED,
        retailerSignupsEnabled: true,
      };
      WholesalerProfile.findOne
        .mockReturnValueOnce({ lean: jest.fn().mockResolvedValue(null) })
        .mockReturnValueOnce({ lean: jest.fn().mockResolvedValue(profile) });
      User.findOne.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            _id: 'legacy-user',
            role: ROLES.WHOLESALER,
            status: USER_STATUS.ACTIVE,
          }),
        }),
      });

      const result = await ReferralService.resolveActiveCode('ab12cd');

      expect(result.profile).toBe(profile);
      expect(WholesalerProfile.findOne.mock.calls[0][0]).toEqual({
        retailerReferralCode: 'AB12CD',
        isDeleted: { $ne: true },
      });
      expect(WholesalerProfile.findOne.mock.calls[1][0].retailerReferralCode)
        .toEqual(/^AB12CD$/i);
      expect(User.findOne.mock.calls[0][0].isDeleted).toEqual({ $ne: true });
    });

    it('throws 403 if wholesaler account is suspended or blocked', async () => {
      WholesalerProfile.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: 'prof123',
          userId: 'user123',
          retailerReferralCode: 'WDE15J',
          kycStatus: KYC_STATUS.APPROVED,
          retailerSignupsEnabled: true,
          isDeleted: false,
        }),
      });

      User.findOne.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            _id: 'user123',
            role: ROLES.WHOLESALER,
            status: USER_STATUS.BLOCKED,
          }),
        }),
      });

      await expect(ReferralService.resolveActiveCode('WDE15J')).rejects.toThrow(
        'This wholesaler is currently unavailable.'
      );
    });

    it('throws 403 if KYC is pending', async () => {
      WholesalerProfile.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: 'prof123',
          userId: 'user123',
          retailerReferralCode: 'WDE15J',
          kycStatus: 'PENDING',
          retailerSignupsEnabled: true,
          isDeleted: false,
        }),
      });

      await expect(ReferralService.resolveActiveCode('WDE15J')).rejects.toThrow(
        'This wholesaler is currently undergoing verification.'
      );
    });

    it('reports paused sign-ups for an existing referral code', async () => {
      WholesalerProfile.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: 'prof123',
          userId: 'user123',
          retailerReferralCode: 'WDE15J',
          kycStatus: KYC_STATUS.APPROVED,
          retailerSignupsEnabled: false,
          isDeleted: false,
        }),
      });

      await expect(ReferralService.resolveActiveCode('WDE15J')).rejects.toThrow(
        'This wholesaler has temporarily paused new retailer sign-ups.'
      );
      expect(WholesalerProfile.findOne).toHaveBeenCalledWith({
        retailerReferralCode: 'WDE15J',
        isDeleted: { $ne: true },
      });
    });
  });

  describe('ensureCode', () => {
    it('atomically saves a unique referral code and reuses the saved value', async () => {
      const profile = { _id: 'profile-without-code' };
      WholesalerProfile.findOneAndUpdate.mockImplementation(async (_filter, update) => ({
        retailerReferralCode: update.$set.retailerReferralCode,
      }));

      const code = await ReferralService.ensureCode(profile);

      expect(code).toMatch(/^[A-Z0-9]{6}$/);
      expect(profile.retailerReferralCode).toBe(code);
      expect(WholesalerProfile.findOneAndUpdate).toHaveBeenCalledWith(
        {
          _id: profile._id,
          isDeleted: { $ne: true },
          retailerReferralCode: { $in: [null, ''] },
        },
        { $set: { retailerReferralCode: code } },
        { new: true, runValidators: true },
      );
    });

    it('retries code collisions reported by the unique index', async () => {
      const profile = { _id: 'profile-without-code' };
      WholesalerProfile.findOneAndUpdate
        .mockRejectedValueOnce({ code: 11000 })
        .mockImplementationOnce(async (_filter, update) => ({
          retailerReferralCode: update.$set.retailerReferralCode,
        }));

      const code = await ReferralService.ensureCode(profile);

      expect(code).toMatch(/^[A-Z0-9]{6}$/);
      expect(WholesalerProfile.findOneAndUpdate).toHaveBeenCalledTimes(2);
    });

    it('uses the code persisted by a concurrent request instead of overwriting it', async () => {
      const profile = { _id: 'profile-without-code' };
      WholesalerProfile.findOneAndUpdate.mockResolvedValue(null);
      WholesalerProfile.findById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            retailerReferralCode: 'SAVED1',
            isDeleted: false,
          }),
        }),
      });

      await expect(ReferralService.ensureCode(profile)).resolves.toBe('SAVED1');
      expect(profile.retailerReferralCode).toBe('SAVED1');
      expect(WholesalerProfile.findOneAndUpdate).toHaveBeenCalledTimes(1);
    });
  });

  describe('getPublicReferral', () => {
    it('returns wholesaler branding, categories, and banners', async () => {
      const mockProfile = {
        _id: 'prof123',
        userId: 'user123',
        retailerReferralCode: 'WDE15J',
        kycStatus: KYC_STATUS.APPROVED,
        retailerSignupsEnabled: true,
        businessName: 'Sarita Store',
        businessTagline: 'Premium Ethnic Wear & Wholesale Garments',
        businessLogoUrl: 'https://example.com/logo.png',
        businessCategory: 'CLOTHING',
        activeStoreTheme: 'DEFAULT',
        address: { city: 'Jaipur' },
        promotionalBanners: [],
        isDeleted: false,
      };

      WholesalerProfile.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockProfile),
      });

      User.findOne.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({ _id: 'user123', role: ROLES.WHOLESALER, status: USER_STATUS.ACTIVE }),
        }),
      });

      Category.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue([
              { _id: 'cat1', name: 'clothes', slug: 'clothes-3' },
            ]),
          }),
        }),
      });

      const referral = await ReferralService.getPublicReferral('WDE15J');
      expect(referral.businessName).toBe('Sarita Store');
      expect(referral.businessTagline).toBe('Premium Ethnic Wear & Wholesale Garments');
      expect(referral.logo).toBe('https://example.com/logo.png');
      expect(referral.categories).toEqual(['clothes']);
      expect(referral.wholesalerId).toBe('user123');
    });
  });

  describe('getReferralProducts', () => {
    it('strictly isolates products to the target wholesaler', async () => {
      const mockProfile = {
        _id: 'prof123',
        userId: 'user123',
        retailerReferralCode: 'WDE15J',
        kycStatus: KYC_STATUS.APPROVED,
        retailerSignupsEnabled: true,
        isDeleted: false,
      };

      WholesalerProfile.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockProfile),
      });

      User.findOne.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({ _id: 'user123', role: ROLES.WHOLESALER, status: USER_STATUS.ACTIVE }),
        }),
      });

      const mockProducts = [
        { _id: 'p1', name: 'lehnga', price: 400, wholesalerId: 'user123' },
        { _id: 'p2', name: 'gown', price: 300, wholesalerId: 'user123' },
      ];

      Category.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([{ _id: 'cat1' }]),
        }),
      });

      const populate2 = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              lean: jest.fn().mockResolvedValue(mockProducts),
            }),
          }),
        }),
      });

      const populate1 = jest.fn().mockReturnValue({
        populate: populate2,
      });

      Product.find.mockReturnValue({
        populate: populate1,
      });

      Product.countDocuments.mockResolvedValue(2);

      const result = await ReferralService.getReferralProducts('WDE15J', { page: 1, limit: 10 });

      expect(Product.find).toHaveBeenCalledWith(
        expect.objectContaining({
          wholesalerId: 'user123',
          isDeleted: { $ne: true },
          categoryId: { $in: ['cat1'] },
        })
      );
      expect(result.products).toHaveLength(2);
      expect(result.products[0].name).toBe('lehnga');
      expect(result.meta.total).toBe(2);
    });
  });
});
