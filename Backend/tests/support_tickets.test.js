const request = require('supertest');
const app = require('../src/app');
const { setupTestDB, clearDatabase } = require('./setup');
const {
  User,
  AdminProfile,
  WholesalerProfile,
  RetailerProfile,
  Review,
  SupportTicket,
  Notification,
  AuditLog,
} = require('../src/models');
const { ROLES, USER_STATUS } = require('../src/config/constants');

setupTestDB();

describe('Support ticket routes', () => {
  let retailer;
  let wholesaler;
  let retailerToken;
  let wholesalerToken;
  let otherRetailerToken;
  let adminToken;

  beforeEach(async () => {
    await clearDatabase();

    const passwordHash = await User.hashPassword('SupportTest123');
    retailer = await User.create({
      name: 'Retailer Contact',
      email: 'retailer-support@test.example',
      phone: '+911234567890',
      passwordHash,
      role: ROLES.RETAILER,
      status: USER_STATUS.ACTIVE,
    });
    await RetailerProfile.create({
      userId: retailer._id,
      businessName: 'Retailer Business',
      ownerName: 'Retailer Contact',
    });

    wholesaler = await User.create({
      name: 'Wholesaler Contact',
      email: 'wholesaler-support@test.example',
      passwordHash,
      role: ROLES.WHOLESALER,
      status: USER_STATUS.ACTIVE,
    });
    await WholesalerProfile.create({
      userId: wholesaler._id,
      businessName: 'Wholesaler Business',
    });

    const otherRetailer = await User.create({
      name: 'Other Contact',
      email: 'other-retailer-support@test.example',
      passwordHash,
      role: ROLES.RETAILER,
      status: USER_STATUS.ACTIVE,
    });
    await RetailerProfile.create({ userId: otherRetailer._id, businessName: 'Other Retailer' });

    const admin = await User.create({
      name: 'Support Admin',
      email: 'support-admin@test.example',
      passwordHash,
      role: ROLES.SUPER_ADMIN,
      status: USER_STATUS.ACTIVE,
    });
    await AdminProfile.create({ userId: admin._id, isSuperAdmin: true });

    const [retailerLogin, wholesalerLogin, otherRetailerLogin, adminLogin] = await Promise.all([
      request(app).post('/api/v1/auth/login').send({ email: retailer.email, password: 'SupportTest123' }),
      request(app).post('/api/v1/auth/login').send({ email: wholesaler.email, password: 'SupportTest123' }),
      request(app).post('/api/v1/auth/login').send({ email: otherRetailer.email, password: 'SupportTest123' }),
      request(app).post('/api/v1/auth/login').send({ email: admin.email, password: 'SupportTest123' }),
    ]);
    retailerToken = retailerLogin.body.data.token;
    wholesalerToken = wholesalerLogin.body.data.token;
    otherRetailerToken = otherRetailerLogin.body.data.token;
    adminToken = adminLogin.body.data.token;
  });

  test('creates sequential ticket numbers and trusts the authenticated identity', async () => {
    const response = await request(app)
      .post('/api/v1/support/tickets')
      .set('Authorization', `Bearer ${retailerToken}`)
      .send({
        type: 'Issue',
        subject: 'Cannot access my orders',
        message: 'The order page is not loading.',
        createdBy: { userId: '000000000000000000000000', role: 'SUPER_ADMIN' },
      });

    expect(response.status).toBe(201);
    expect(response.body.data.ticketNo).toBe('TKT-0001');
    expect(response.body.data.createdBy.userId).toBe(String(retailer._id));
    expect(response.body.data.createdBy.role).toBe(ROLES.RETAILER);
    expect(response.body.data.businessName).toBe('Retailer Business');
    expect(response.body.data.replies).toHaveLength(1);
    expect(await Notification.countDocuments({ 'data.ticketNo': 'TKT-0001' })).toBe(1);

    const storedTicket = await SupportTicket.findById(response.body.data._id);
    expect(storedTicket.ticketNumber).toBe('TKT-0001');
  });

  test('restricts ticket reads to the owner and admin endpoints to Super Admins', async () => {
    const created = await request(app)
      .post('/api/v1/support/tickets')
      .set('Authorization', `Bearer ${retailerToken}`)
      .send({ type: 'Request', subject: 'Account help', message: 'Please help.' });
    const ticketId = created.body.data._id;

    const forbiddenRead = await request(app)
      .get(`/api/v1/support/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${otherRetailerToken}`);
    expect(forbiddenRead.status).toBe(404);

    const forbiddenAdminList = await request(app)
      .get('/api/v1/admin/support/tickets')
      .set('Authorization', `Bearer ${retailerToken}`);
    expect(forbiddenAdminList.status).toBe(403);

    const adminList = await request(app)
      .get('/api/v1/admin/support/tickets?role=RETAILER&status=Open&type=Request&priority=Medium')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(adminList.status).toBe(200);
    expect(adminList.body.data.items).toHaveLength(1);
    expect(adminList.body.data.stats.open).toBe(1);
  });

  test('saves wholesaler feedback ratings and filters submissions by creator ID', async () => {
    const first = await request(app)
      .post('/api/v1/support/tickets')
      .set('Authorization', `Bearer ${wholesalerToken}`)
      .send({
        type: 'Feedback',
        subject: 'Store feedback',
        message: 'The new dashboard is helpful.',
        rating: 4,
      });
    const second = await request(app)
      .post('/api/v1/support/tickets')
      .set('Authorization', `Bearer ${otherRetailerToken}`)
      .send({
        type: 'Feedback',
        subject: 'Other feedback',
        message: 'Another retailer response.',
        rating: 2,
      });

    expect(first.status).toBe(201);
    expect(first.body.data.rating).toBe(4);
    expect(second.status).toBe(201);

    const response = await request(app)
      .get(`/api/v1/admin/support/tickets?creatorId=${wholesaler._id}&role=WHOLESALER&type=Feedback&rating=4&search=dashboard%20is%20helpful`)
      .set('Authorization', `Bearer ${adminToken}`)

    expect(response.status).toBe(200);
    expect(response.body.data.items).toHaveLength(1);
    expect(response.body.data.items[0].subject).toBe('Store feedback');
    expect(response.body.data.items[0].businessName).toBe('Wholesaler Business');
    expect(response.body.data.items[0].rating).toBe(4);
  });

  test('filters reviews by the related wholesaler account and returns its business name', async () => {
    const wholesaler = await User.create({
      name: 'Wholesale Owner',
      email: 'wholesaler-review@test.example',
      passwordHash: await User.hashPassword('SupportTest123'),
      role: ROLES.WHOLESALER,
      status: USER_STATUS.ACTIVE,
    });
    const otherWholesaler = await User.create({
      name: 'Other Wholesale Owner',
      email: 'other-wholesaler-review@test.example',
      passwordHash: await User.hashPassword('SupportTest123'),
      role: ROLES.WHOLESALER,
      status: USER_STATUS.ACTIVE,
    });
    await WholesalerProfile.create({ userId: wholesaler._id, businessName: 'Wholesale Business' });
    await WholesalerProfile.create({ userId: otherWholesaler._id, businessName: 'Other Wholesale Business' });
    await Review.create([
      { userId: retailer._id, wholesalerId: wholesaler._id, rating: 5, comment: 'Great service.' },
      { userId: retailer._id, wholesalerId: otherWholesaler._id, rating: 3, comment: 'Could improve.' },
    ]);

    const response = await request(app)
      .get(`/api/v1/admin/reviews?wholesalerId=${wholesaler._id}`)
      .set('Authorization', `Bearer ${adminToken}`)

    expect(response.status).toBe(200);
    expect(response.body.data.items).toHaveLength(1);
    expect(response.body.data.items[0]).toMatchObject({
      comment: 'Great service.',
      rating: 5,
      reviewer: { name: 'Retailer Business', email: retailer.email },
      wholesaler: { id: String(wholesaler._id), name: 'Wholesale Business' },
    });
  });

  test('admin replies mark the owner ticket unread and status changes are retained', async () => {
    const created = await request(app)
      .post('/api/v1/support/tickets')
      .set('Authorization', `Bearer ${retailerToken}`)
      .send({ type: 'Payment', subject: 'Payment question', message: 'Please check my payment.' });
    const ticketId = created.body.data._id;

    const reply = await request(app)
      .post(`/api/v1/admin/support/tickets/${ticketId}/reply`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ message: 'We are looking into it.' });
    expect(reply.status).toBe(200);
    expect(reply.body.data.unreadForCreator).toBe(true);
    expect(await Notification.countDocuments({ 'data.ticketId': ticketId, recipientId: retailer._id })).toBe(1);
    expect(await AuditLog.countDocuments({ entityId: ticketId, entityType: 'SUPPORT_TICKET' })).toBe(1);

    const update = await request(app)
      .patch(`/api/v1/admin/support/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'In Progress', priority: 'High' });
    expect(update.status).toBe(200);
    expect(update.body.data.status).toBe('In Progress');
    expect(update.body.data.priority).toBe('High');
    expect(await Notification.countDocuments({ 'data.type': 'SUPPORT_TICKET_STATUS', recipientId: retailer._id })).toBe(1);
    expect(await AuditLog.countDocuments({ entityId: ticketId, entityType: 'SUPPORT_TICKET' })).toBe(2);
  });
});
