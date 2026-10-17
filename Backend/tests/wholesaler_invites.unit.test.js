jest.mock('../src/models', () => ({
  WholesalerInvite: {
    create: jest.fn(),
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
  },
}));

const { WholesalerInvite } = require('../src/models');
const WholesalerInvitesService = require('../src/modules/wholesaler-invites/wholesalerInvites.service');
const { hashToken } = require('../src/utils/crypto');

describe('Wholesaler invitations', () => {
  beforeEach(() => jest.clearAllMocks());

  test('stores a hash and returns the raw invite token only at creation', async () => {
    const now = new Date();
    WholesalerInvite.create.mockImplementation(async (record) => ({
      ...record,
      _id: 'invite-1',
      createdAt: now,
    }));

    const result = await WholesalerInvitesService.create({
      contactName: 'Ada Example',
      email: 'ada@example.com',
      phone: '9876543210',
      businessName: 'Example Wholesale',
      note: '',
    }, { _id: 'admin-1' });

    const stored = WholesalerInvite.create.mock.calls[0][0];
    expect(stored.tokenHash).toHaveLength(64);
    expect(stored.tokenHash).not.toBe(result.token);
    expect(stored.tokenHash).toBe(hashToken(result.token));
    expect(result.token).toHaveLength(64);
    expect(result.invite).not.toHaveProperty('tokenHash');
    expect(result.invite).not.toHaveProperty('token');
    expect(stored.expiresAt.getTime()).toBeGreaterThan(Date.now() + 6 * 24 * 60 * 60 * 1000);
  });

  test('claims only an active, unexpired invite using its hash', async () => {
    WholesalerInvite.findOneAndUpdate.mockResolvedValue({ _id: 'invite-1' });

    const result = await WholesalerInvitesService.claim('a'.repeat(64));
    const [filter, update] = WholesalerInvite.findOneAndUpdate.mock.calls[0];

    expect(filter.tokenHash).toBe(hashToken('a'.repeat(64)));
    expect(filter.tokenHash).not.toBe('a'.repeat(64));
    expect(filter.status.$in).toEqual(['SENT', 'OPENED']);
    expect(filter.expiresAt.$gt).toBeInstanceOf(Date);
    expect(update.$set.registrationClaimId).toBe(result.claimId);
    expect(update.$set.registrationClaimExpiresAt).toBeInstanceOf(Date);
  });

  test('public prefill marks an invite opened and omits internal token data', async () => {
    const invite = {
      contactName: 'Ada Example',
      email: 'ada@example.com',
      phone: '9876543210',
      businessName: 'Example Wholesale',
      note: 'Welcome',
      status: 'SENT',
      expiresAt: new Date(Date.now() + 86400000),
      openedAt: null,
      save: jest.fn().mockResolvedValue(undefined),
    };
    WholesalerInvite.findOne.mockReturnValue({
      select: jest.fn().mockResolvedValue(invite),
    });

    const result = await WholesalerInvitesService.getPublicPrefill('b'.repeat(64));

    expect(invite.status).toBe('OPENED');
    expect(invite.openedAt).toBeInstanceOf(Date);
    expect(invite.save).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      contactName: 'Ada Example',
      email: 'ada@example.com',
      phone: '9876543210',
      businessName: 'Example Wholesale',
      expiresAt: invite.expiresAt,
    });
    expect(result).not.toHaveProperty('tokenHash');
    expect(result).not.toHaveProperty('createdBy');
  });
});
