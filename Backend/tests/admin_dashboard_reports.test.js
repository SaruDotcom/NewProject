const request = require('supertest');
const app = require('../src/app');
const { setupTestDB, clearDatabase } = require('./setup');
const { User, AdminProfile, WholesalerProfile, Order, AuditLog } = require('../src/models');
const { ROLES, USER_STATUS, KYC_STATUS } = require('../src/config/constants');

setupTestDB();

describe('Admin Dashboard, Analytics, Audit & Reports Test Suite', () => {
  let adminToken;
  let adminUser;

  beforeEach(async () => {
    await clearDatabase();

    const adminHash = await User.hashPassword('Admin123');
    adminUser = await User.create({
      name: 'Super Admin',
      email: 'admin@nexora.b2b',
      passwordHash: adminHash,
      role: ROLES.SUPER_ADMIN,
      status: USER_STATUS.ACTIVE,
    });
    await AdminProfile.create({ userId: adminUser._id, isSuperAdmin: true });

    const adminLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'admin@nexora.b2b',
      password: 'Admin123',
    });
    adminToken = adminLogin.body.data.token;
  });

  test('1. Dashboard endpoint returns real aggregation metrics across date ranges', async () => {
    const res = await request(app)
      .get('/api/v1/admin/dashboard?range=30d')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.overview).toBeDefined();
    expect(res.body.data.overview.wholesalers).toBeDefined();
    expect(res.body.data.overview.orders).toBeDefined();
    expect(res.body.data.overview.financials).toBeDefined();
  });

  test('2. Analytics endpoint returns GMV, AOV & trends', async () => {
    const res = await request(app)
      .get('/api/v1/admin/analytics')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.aov).toBeDefined();
    expect(res.body.data.salesTrends).toBeDefined();
  });

  test('3. CSV Reports export endpoint returns valid CSV file stream', async () => {
    const res = await request(app)
      .get('/api/v1/admin/reports/sales?format=csv')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.text).toContain('orderNumber,orderDate');
  });

  test('4. Audit logs are queryable with filters', async () => {
    // Generate an audit log
    await AuditLog.create({
      actorId: adminUser._id,
      actorRole: 'SUPER_ADMIN',
      action: 'LOGIN',
      entityType: 'User',
      entityId: String(adminUser._id),
    });

    const res = await request(app)
      .get('/api/v1/admin/audit-logs')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0].action).toBe('LOGIN');
  });

  test('5. Health endpoint reports system & database status', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.status).toBe('healthy');
    expect(res.body.database).toBe('connected');
  });
});
