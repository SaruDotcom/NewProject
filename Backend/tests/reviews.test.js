const request = require('supertest');
const app = require('../src/app');
const { setupTestDB, clearDatabase } = require('./setup');
const {
  User,
  WholesalerProfile,
  RetailerProfile,
  WholesalerRetailerRelationship,
  Review,
} = require('../src/models');
const { ROLES, USER_STATUS, RELATIONSHIP_STATUS } = require('../src/config/constants');
const AuthService = require('../src/modules/auth/auth.service');

setupTestDB();

describe('Partner reviews', () => {
  let retailer;
  let wholesaler;
  let unrelatedRetailer;
  let retailerToken;
  let wholesalerToken;
  let adminToken;

  beforeEach(async () => {
    await clearDatabase();
    const passwordHash = await User.hashPassword('ReviewTest123!');
    [retailer, wholesaler, unrelatedRetailer] = await Promise.all([
      User.create({ name: 'Retail Store', email: 'retailer-review@test.com', passwordHash, role: ROLES.RETAILER, status: USER_STATUS.ACTIVE }),
      User.create({ name: 'Wholesale Store', email: 'wholesaler-review@test.com', passwordHash, role: ROLES.WHOLESALER, status: USER_STATUS.ACTIVE }),
      User.create({ name: 'Unrelated Store', email: 'unrelated-review@test.com', passwordHash, role: ROLES.RETAILER, status: USER_STATUS.ACTIVE }),
    ]);
    await Promise.all([
      RetailerProfile.create({ userId: retailer._id, businessName: 'Retail Business' }),
      RetailerProfile.create({ userId: unrelatedRetailer._id, businessName: 'Unrelated Business' }),
      WholesalerProfile.create({ userId: wholesaler._id, businessName: 'Wholesale Business' }),
      WholesalerRetailerRelationship.create({
        retailerId: retailer._id,
        wholesalerId: wholesaler._id,
        status: RELATIONSHIP_STATUS.ACTIVE,
      }),
    ]);
    const admin = await User.create({
      name: 'Review Admin',
      email: 'review-admin@test.com',
      passwordHash,
      role: ROLES.SUPER_ADMIN,
      status: USER_STATUS.ACTIVE,
    });
    retailerToken = AuthService.generateTokens(retailer).accessToken;
    wholesalerToken = AuthService.generateTokens(wholesaler).accessToken;
    adminToken = AuthService.generateTokens(admin).accessToken;
  });

  it('persists reviews in the correct direction and exposes both sides to their accounts and admins', async () => {
    const retailerPartners = await request(app)
      .get('/api/v1/retailer/review-partners')
      .set('Authorization', `Bearer ${retailerToken}`);
    const wholesalerPartners = await request(app)
      .get('/api/v1/wholesaler/review-partners')
      .set('Authorization', `Bearer ${wholesalerToken}`);
    expect(retailerPartners.body.data.map((partner) => partner.id)).toEqual([String(wholesaler._id)]);
    expect(wholesalerPartners.body.data.map((partner) => partner.id)).toEqual([String(retailer._id)]);

    const retailerSubmission = await request(app)
      .post('/api/v1/reviews')
      .set('Authorization', `Bearer ${retailerToken}`)
      .send({ recipientId: String(wholesaler._id), rating: 4, title: 'Great supply', comment: 'Reliable delivery.' });

    expect(retailerSubmission.status).toBe(201);
    expect(retailerSubmission.body.data.userId).toBe(String(retailer._id));
    expect(retailerSubmission.body.data.recipientId).toBe(String(wholesaler._id));
    expect(retailerSubmission.body.data.recipientRole).toBe(ROLES.WHOLESALER);

    const wholesalerReviews = await request(app)
      .get('/api/v1/wholesaler/reviews')
      .set('Authorization', `Bearer ${wholesalerToken}`);
    expect(wholesalerReviews.status).toBe(200);
    expect(wholesalerReviews.body.data).toHaveLength(1);
    expect(wholesalerReviews.body.data[0].reviewer.name).toBe('Retail Business');

    const retailerReviewsBefore = await request(app)
      .get('/api/v1/retailer/reviews')
      .set('Authorization', `Bearer ${retailerToken}`);
    expect(retailerReviewsBefore.body.data).toHaveLength(0);

    const wholesalerSubmission = await request(app)
      .post('/api/v1/reviews')
      .set('Authorization', `Bearer ${wholesalerToken}`)
      .send({ recipientId: String(retailer._id), rating: 5, title: 'Good partner', comment: 'Pays on time.' });
    expect(wholesalerSubmission.status).toBe(201);
    expect(wholesalerSubmission.body.data.recipientRole).toBe(ROLES.RETAILER);
    expect(wholesalerSubmission.body.data.wholesalerId).toBeUndefined();

    const retailerReviewsAfter = await request(app)
      .get('/api/v1/retailer/reviews')
      .set('Authorization', `Bearer ${retailerToken}`);
    expect(retailerReviewsAfter.body.data).toHaveLength(1);
    expect(retailerReviewsAfter.body.data[0].reviewer.name).toBe('Wholesale Business');

    const adminReviews = await request(app)
      .get('/api/v1/admin/reviews?status=all')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(adminReviews.status).toBe(200);
    expect(adminReviews.body.data.items).toHaveLength(2);
    expect(adminReviews.body.data.items.map((review) => review.recipient.role).sort()).toEqual([
      ROLES.RETAILER,
      ROLES.WHOLESALER,
    ]);
    expect(await Review.countDocuments({ isDeleted: false })).toBe(2);
  });

  it('rejects reviews for users without an active retailer-wholesaler relationship', async () => {
    const response = await request(app)
      .post('/api/v1/reviews')
      .set('Authorization', `Bearer ${retailerToken}`)
      .send({ recipientId: String(unrelatedRetailer._id), rating: 5, comment: 'Wrong recipient.' });

    expect(response.status).toBe(403);
    expect(await Review.countDocuments()).toBe(0);
  });
});
