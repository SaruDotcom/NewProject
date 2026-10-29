const { User, WholesalerProfile, WholesalerRetailerRelationship } = require('../src/models');
const WholesalerPortalService = require('../src/modules/wholesalers/wholesalerPortal.service');
const RetailerService = require('../src/services/retailer.service');
const ReferralsService = require('../src/modules/referrals/referrals.service');
const { getPresetsForType, normalizeBusinessType } = require('../src/config/businessTypeBanners');

describe('Wholesaler Theme, Business Type and Dynamic Banners', () => {
  afterEach(() => jest.restoreAllMocks());

  describe('1. Business Type Presets & Recommendations', () => {
    test('normalizes business types correctly', () => {
      expect(normalizeBusinessType('Clothing & Apparel')).toBe('CLOTHING');
      expect(normalizeBusinessType('Ethnic Kurtis Store')).toBe('CLOTHING');
      expect(normalizeBusinessType('Beauty Products & Skincare')).toBe('COSMETICS');
      expect(normalizeBusinessType('Kirana & Daily Grocery')).toBe('GENERAL_STORE');
      expect(normalizeBusinessType('Sneakers and Footwear')).toBe('FOOTWEAR');
      expect(normalizeBusinessType('Electronics Wholesale')).toBe('ELECTRONICS');
      expect(normalizeBusinessType('Unknown Hardware')).toBe('OTHER');
    });

    test('provides 3-4 tailored banners for Clothing', () => {
      const presets = getPresetsForType('CLOTHING');
      expect(presets.length).toBeGreaterThanOrEqual(3);
      expect(presets.some((p) => (p.targetCategory || '').toLowerCase().includes('ethnic') || (p.targetCategory || '').toLowerCase().includes('clothing'))).toBe(true);
      expect(presets.some((p) => p.title.toLowerCase().includes('ethnic') || p.title.toLowerCase().includes('western') || p.title.toLowerCase().includes('apparel'))).toBe(true);
    });

    test('provides 3-4 tailored banners for Beauty / Cosmetics', () => {
      const presets = getPresetsForType('COSMETICS');
      expect(presets.length).toBeGreaterThanOrEqual(3);
      expect(presets.some((p) => (p.targetCategory || '').toLowerCase().includes('beauty') || (p.targetCategory || '').toLowerCase().includes('skincare'))).toBe(true);
      expect(presets.some((p) => p.title.toLowerCase().includes('glow') || p.title.toLowerCase().includes('cosmetics') || p.title.toLowerCase().includes('skincare'))).toBe(true);
    });

    test('provides 3-4 tailored banners for Kirana / General Store', () => {
      const presets = getPresetsForType('GENERAL_STORE');
      expect(presets.length).toBeGreaterThanOrEqual(3);
      expect(presets.some((p) => (p.targetCategory || '').toLowerCase().includes('grocery') || (p.targetCategory || '').toLowerCase().includes('staples'))).toBe(true);
      expect(presets.some((p) => p.title.toLowerCase().includes('grocery') || p.title.toLowerCase().includes('staples') || p.title.toLowerCase().includes('freight'))).toBe(true);
    });
  });

  describe('2. Wholesaler Banner & Theme Management', () => {
    test('activates preset and persists in promotional banners', async () => {
      const mockProfile = {
        userId: 'wholesaler-clothing-1',
        businessName: 'Surat Fashion Hub',
        businessCategory: 'CLOTHING',
        activeStoreTheme: 'DEFAULT',
        promotionalBanners: [],
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(WholesalerProfile, 'findOne').mockResolvedValue(mockProfile);

      const presets = getPresetsForType('CLOTHING');
      const targetPreset = presets[0];

      const result = await WholesalerPortalService.activatePreset(
        'wholesaler-clothing-1',
        targetPreset.id,
        { _id: 'wholesaler-clothing-1', role: 'WHOLESALER' },
        {}
      );

      expect(result.banners.length).toBe(1);
      expect(result.banners[0].title).toBe(targetPreset.title);
      expect(result.banners[0].active).toBe(true);
      expect(mockProfile.save).toHaveBeenCalled();
    });

    test('updates theme and custom genuine offer details', async () => {
      const mockProfile = {
        userId: 'wholesaler-cosmetics-1',
        businessName: 'Glow Essentials',
        businessCategory: 'COSMETICS',
        activeStoreTheme: 'DEFAULT',
        promotionalBanners: [
          {
            id: 'banner-1',
            title: 'Old Title',
            subtitle: 'Old Subtitle',
            discountBadge: '5% OFF',
            isActive: true,
          },
        ],
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(WholesalerProfile, 'findOne').mockResolvedValue(mockProfile);

      // Update theme to ROYAL and edit banner details
      const updateResult = await WholesalerPortalService.updateBanners(
        'wholesaler-cosmetics-1',
        {
          activeStoreTheme: 'ROYAL',
          banners: [
            {
              id: 'banner-1',
              title: 'Luxury Skincare Trade Tier',
              subtitle: 'Exclusive dealer discount on premium serums',
              discountBadge: '25% BULK DEAL',
              active: true,
              category: 'Skincare',
            },
          ],
        },
        { _id: 'wholesaler-cosmetics-1', role: 'WHOLESALER' },
        {}
      );

      expect(updateResult.activeStoreTheme).toBe('ROYAL');
      expect(updateResult.banners[0].title).toBe('Luxury Skincare Trade Tier');
      expect(updateResult.banners[0].discountBadge).toBe('25% BULK DEAL');
      expect(mockProfile.activeStoreTheme).toBe('ROYAL');
      expect(mockProfile.save).toHaveBeenCalled();
    });

    test('deactivating an offer marks active=false', async () => {
      const mockProfile = {
        userId: 'wholesaler-kirana-1',
        businessName: 'Metro Daily Kirana',
        businessCategory: 'GENERAL_STORE',
        activeStoreTheme: 'FESTIVE',
        promotionalBanners: [
          {
            id: 'kirana-offer-1',
            title: 'FMCG Mega Saver',
            isActive: true,
          },
        ],
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(WholesalerProfile, 'findOne').mockResolvedValue(mockProfile);

      const result = await WholesalerPortalService.updateBanners(
        'wholesaler-kirana-1',
        {
          banners: [
            {
              id: 'kirana-offer-1',
              title: 'FMCG Mega Saver',
              active: false,
            },
          ],
        },
        { _id: 'wholesaler-kirana-1', role: 'WHOLESALER' },
        {}
      );

      expect(result.banners[0].active).toBe(false);
      expect(mockProfile.promotionalBanners[0].isActive).toBe(false);
    });
  });

  describe('3. Retailer Homepage Synchronization & Wholesaler Isolation', () => {
    test('retailer connectedWholesaler receives only active banners and active theme of connected wholesaler', async () => {
      jest.spyOn(WholesalerRetailerRelationship, 'findOne').mockReturnValue({
        populate: jest.fn().mockResolvedValue({
          retailerId: 'retailer-1',
          wholesalerId: {
            _id: 'wholesaler-clothing-1',
            name: 'Surat Fashion Hub',
            email: 'ws@cloth.com',
            phone: '9876543210',
            status: 'ACTIVE',
          },
          status: 'ACTIVE',
          joinedAt: new Date(),
        }),
      });

      const clothingProfile = {
        userId: 'wholesaler-clothing-1',
        businessName: 'Surat Fashion Hub',
        businessCategory: 'CLOTHING',
        activeStoreTheme: 'ROYAL',
        promotionalBanners: [
          {
            id: 'cloth-1',
            title: 'Festive Ethnic Kurtis & Lehengas',
            discountBadge: '30% EXTRA MARGIN',
            isActive: true,
          },
          {
            id: 'cloth-2',
            title: 'Deactivated Seasonal Clearance',
            isActive: false,
          },
        ],
      };

      jest.spyOn(WholesalerProfile, 'findOne').mockResolvedValue(clothingProfile);

      const retailerData = await RetailerService.getConnectedWholesaler('retailer-1');

      expect(retailerData.businessName).toBe('Surat Fashion Hub');
      expect(retailerData.activeStoreTheme).toBe('ROYAL');
      expect(retailerData.businessCategory).toBe('CLOTHING');
      // Only the active banner should be returned
      expect(retailerData.banners.length).toBe(1);
      expect(retailerData.banners[0].title).toBe('Festive Ethnic Kurtis & Lehengas');
      expect(retailerData.banners[0].id).toBe('cloth-1');
      expect(retailerData.banners[0].active).toBe(true);
    });

    test('public referral endpoint returns only active banners and active theme for guest retailer', async () => {
      const kiranaProfile = {
        userId: 'wholesaler-kirana-1',
        retailerReferralCode: 'KIRAN1',
        retailerSignupsEnabled: true,
        kycStatus: 'APPROVED',
        isDeleted: false,
        businessName: 'Metro Daily Kirana',
        businessCategory: 'GENERAL_STORE',
        activeStoreTheme: 'FESTIVE',
        promotionalBanners: [
          {
            id: 'kirana-active-1',
            title: 'Grocery Staples Bulk Saver',
            discountBadge: 'FREE TRUCK DISPATCH',
            isActive: true,
          },
          {
            id: 'kirana-inactive-2',
            title: 'Old Monsoon Offer',
            isActive: false,
          },
        ],
      };

      jest.spyOn(WholesalerProfile, 'findOne').mockReturnValue({
        lean: jest.fn().mockResolvedValue(kiranaProfile),
      });

      jest.spyOn(User, 'findOne').mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({ _id: 'wholesaler-kirana-1' }),
        }),
      });

      const refResult = await ReferralsService.getPublicReferral('KIRAN1');

      expect(refResult.businessName).toBe('Metro Daily Kirana');
      expect(refResult.activeStoreTheme).toBe('FESTIVE');
      expect(refResult.businessCategory).toBe('GENERAL_STORE');
      expect(refResult.banners.length).toBe(1);
      expect(refResult.banners[0].title).toBe('Grocery Staples Bulk Saver');
      expect(refResult.banners[0].active).toBe(true);
    });

    test('different wholesalers do not mix themes, categories or banners', async () => {
      // Mock relationship query depending on retailerId
      jest.spyOn(WholesalerRetailerRelationship, 'findOne').mockImplementation(({ retailerId }) => ({
        populate: jest.fn().mockImplementation(() => {
          if (retailerId === 'retailer-clothing') {
            return Promise.resolve({
              retailerId: 'retailer-clothing',
              wholesalerId: { _id: 'ws-clothing', name: 'Royal Threads', status: 'ACTIVE' },
              status: 'ACTIVE',
            });
          }
          if (retailerId === 'retailer-beauty') {
            return Promise.resolve({
              retailerId: 'retailer-beauty',
              wholesalerId: { _id: 'ws-beauty', name: 'Cosmetic Emporium', status: 'ACTIVE' },
              status: 'ACTIVE',
            });
          }
          return Promise.resolve(null);
        }),
      }));

      // Mock profile query
      jest.spyOn(WholesalerProfile, 'findOne').mockImplementation((query) => {
        const id = String(query.userId);
        if (id === 'ws-clothing') {
          return Promise.resolve({
            userId: 'ws-clothing',
            businessName: 'Royal Threads',
            activeStoreTheme: 'ROYAL',
            businessCategory: 'CLOTHING',
            promotionalBanners: [{ id: 'b-cloth', title: 'Designer Sarees Bulk', isActive: true }],
          });
        }
        if (id === 'ws-beauty') {
          return Promise.resolve({
            userId: 'ws-beauty',
            businessName: 'Cosmetic Emporium',
            activeStoreTheme: 'MINIMAL',
            businessCategory: 'COSMETICS',
            promotionalBanners: [{ id: 'b-beauty', title: 'Salon Makeup Packages', isActive: true }],
          });
        }
        return Promise.resolve(null);
      });

      const storeA = await RetailerService.getConnectedWholesaler('retailer-clothing');
      const storeB = await RetailerService.getConnectedWholesaler('retailer-beauty');

      expect(storeA.activeStoreTheme).toBe('ROYAL');
      expect(storeA.businessCategory).toBe('CLOTHING');
      expect(storeA.banners[0].title).toBe('Designer Sarees Bulk');

      expect(storeB.activeStoreTheme).toBe('MINIMAL');
      expect(storeB.businessCategory).toBe('COSMETICS');
      expect(storeB.banners[0].title).toBe('Salon Makeup Packages');

      // Zero crossover
      expect(storeA.banners.some((b) => b.title.includes('Salon Makeup'))).toBe(false);
      expect(storeB.banners.some((b) => b.title.includes('Sarees'))).toBe(false);
    });

    test('when all offers are deactivated, banners array is empty (clean default fallback)', async () => {
      jest.spyOn(WholesalerRetailerRelationship, 'findOne').mockReturnValue({
        populate: jest.fn().mockResolvedValue({
          retailerId: 'retailer-no-offers',
          wholesalerId: { _id: 'ws-no-offers', name: 'Simple Supplies', status: 'ACTIVE' },
          status: 'ACTIVE',
        }),
      });

      jest.spyOn(WholesalerProfile, 'findOne').mockResolvedValue({
        userId: 'ws-no-offers',
        businessName: 'Simple Supplies',
        activeStoreTheme: 'MINIMAL',
        promotionalBanners: [
          { id: 'b-1', title: 'Expired Promo', isActive: false },
        ],
      });

      const result = await RetailerService.getConnectedWholesaler('retailer-no-offers');

      expect(result.banners).toEqual([]);
      expect(result.activeStoreTheme).toBe('MINIMAL');
    });
  });
});
