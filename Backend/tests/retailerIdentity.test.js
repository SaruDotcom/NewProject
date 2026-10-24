const env = require('../src/config/env');
const { registerSchema } = require('../src/modules/auth/auth.validation');
const { updateBusinessProfileSchema } = require('../src/modules/retailers/retailer.validation');
const {
  encryptIdentityNumber,
  decryptIdentityNumber,
} = require('../src/utils/retailerIdentityCrypto');
const {
  RetailerIdentityService,
  detectFileType,
} = require('../src/services/retailerIdentity.service');
const { RetailerProfile, WholesalerRetailerRelationship } = require('../src/models');
const mongoose = require('mongoose');

describe('Retailer identity registration and privacy', () => {
  beforeAll(() => {
    env.RETAILER_IDENTITY_ENCRYPTION_KEY = 'a'.repeat(64);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('retailer registration accepts omitted optional identity details', () => {
    const { error } = registerSchema.validate({
      role: 'RETAILER',
      name: 'Retail Owner',
      email: 'owner@example.com',
      password: 'password123',
      phone: '9876543210',
      loginId: 'OWNER123',
      businessName: 'Retail Store',
      address: '1 Market Road',
      city: 'Pune',
      state: 'Maharashtra',
      pincode: '411001',
      referralCode: 'ABC123',
    });

    expect(error).toBeUndefined();
  });

  test('retailer registration validates PAN and Aadhaar formats', () => {
    const { error } = registerSchema.validate({
      role: 'RETAILER',
      name: 'Retail Owner',
      email: 'owner@example.com',
      password: 'password123',
      phone: '9876543210',
      loginId: 'OWNER123',
      businessName: 'Retail Store',
      address: '1 Market Road',
      city: 'Pune',
      state: 'Maharashtra',
      pincode: '411001',
      panNumber: 'BADPAN',
      aadhaarNumber: '1234',
      referralCode: 'ABC123',
    });

    expect(error).toBeDefined();
  });

  test('wholesaler registration does not inherit retailer address requirements', () => {
    const { error } = registerSchema.validate({
      role: 'WHOLESALER',
      name: 'Wholesale Owner',
      email: 'wholesaler@example.com',
      password: 'password123',
    });

    expect(error).toBeUndefined();
  });

  test('legacy business profile updates cannot store a plaintext PAN', () => {
    const { error } = updateBusinessProfileSchema.validate({ pan: 'ABCDE1234F' });

    expect(error).toBeDefined();
  });

  test('encrypts identity numbers with authenticated encryption', () => {
    const encrypted = encryptIdentityNumber('123456789012');

    expect(encrypted).not.toContain('123456789012');
    expect(decryptIdentityNumber(encrypted)).toBe('123456789012');
    expect(encryptIdentityNumber('123456789012')).not.toBe(encrypted);
  });

  test('safe identity summaries expose no full Aadhaar or encrypted fields', () => {
    const summary = RetailerIdentityService.formatIdentity({
      pan: { numberEncrypted: 'encrypted-pan', last4: '1234' },
      aadhaar: {
        numberEncrypted: 'encrypted-aadhaar',
        last4: '9012',
        frontImage: { publicId: 'private/front' },
      },
    });

    expect(summary.pan.number).toBe('');
    expect(summary.aadhaar).not.toHaveProperty('number');
    expect(JSON.stringify(summary)).not.toContain('encrypted-aadhaar');
    expect(JSON.stringify(summary)).not.toContain('private/front');
  });

  test('retailer profile JSON serialization strips encrypted numbers and private asset keys', () => {
    const profile = new RetailerProfile({
      userId: new mongoose.Types.ObjectId(),
      businessName: 'Retail Store',
      pan: { numberEncrypted: 'encrypted-pan', imageUrl: 'private-url', publicId: 'private/pan' },
      aadhaar: {
        numberEncrypted: 'encrypted-aadhaar',
        frontImage: { imageUrl: 'private-url', publicId: 'private/front' },
      },
    });
    const serialized = profile.toJSON();

    expect(serialized.pan).not.toHaveProperty('numberEncrypted');
    expect(serialized.pan).not.toHaveProperty('imageUrl');
    expect(serialized.aadhaar).not.toHaveProperty('numberEncrypted');
    expect(serialized.aadhaar.frontImage).not.toHaveProperty('publicId');
  });

  test('checks uploaded file signatures against declared type', () => {
    const jpeg = {
      buffer: Buffer.from([0xff, 0xd8, 0xff, 0x00]),
      mimetype: 'image/jpeg',
      originalname: 'pan.jpg',
    };
    expect(detectFileType(jpeg, 'panImage')).toBe('image/jpeg');
    expect(() => detectFileType({ ...jpeg, mimetype: 'image/png' }, 'panImage')).toThrow();
  });

  test('limits wholesaler identity access to an active owned relationship', async () => {
    const query = { select: jest.fn() };
    query.select.mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });
    const findOne = jest.spyOn(WholesalerRetailerRelationship, 'findOne').mockReturnValue(query);

    await expect(
      RetailerIdentityService.assertAccess('retailer-id', {
        _id: 'wholesaler-id',
        role: 'WHOLESALER',
      }),
    ).rejects.toThrow();

    expect(findOne).toHaveBeenCalledWith({
      retailerId: 'retailer-id',
      wholesalerId: 'wholesaler-id',
      status: 'ACTIVE',
    });
  });

  test('allows Super Admin identity access across retailer relationships', async () => {
    await expect(
      RetailerIdentityService.assertAccess('retailer-id', {
        _id: 'admin-id',
        role: 'SUPER_ADMIN',
      }),
    ).resolves.toBeUndefined();
  });
});
