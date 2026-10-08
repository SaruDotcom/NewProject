const request = require('supertest');
const app = require('../src/app');
const { setupTestDB, clearDatabase } = require('./setup');
const { User, AdminProfile } = require('../src/models');
const { ROLES, USER_STATUS } = require('../src/config/constants');

setupTestDB();

describe('Auth & RBAC Test Suite', () => {
  let superAdminUser;
  let wholesalerUser;
  let retailerUser;
  let adminToken;
  let wholesalerToken;
  let retailerToken;
  let adminRefreshToken;

  beforeEach(async () => {
    await clearDatabase();

    // 1. Create Super Admin
    const adminHash = await User.hashPassword('AdminPassword123');
    superAdminUser = await User.create({
      name: 'Super Admin',
      email: 'superadmin@test.com',
      passwordHash: adminHash,
      role: ROLES.SUPER_ADMIN,
      status: USER_STATUS.ACTIVE,
    });
    const adminProf = await AdminProfile.create({
      userId: superAdminUser._id,
      isSuperAdmin: true,
    });
    superAdminUser.adminProfile = adminProf._id;
    await superAdminUser.save();

    // 2. Create Wholesaler
    const wsHash = await User.hashPassword('Wholesaler123');
    wholesalerUser = await User.create({
      name: 'Test Wholesaler',
      email: 'wholesaler@test.com',
      passwordHash: wsHash,
      role: ROLES.WHOLESALER,
      status: USER_STATUS.ACTIVE,
    });

    // 3. Create Retailer
    const retHash = await User.hashPassword('Retailer123');
    retailerUser = await User.create({
      name: 'Test Retailer',
      email: 'retailer@test.com',
      passwordHash: retHash,
      role: ROLES.RETAILER,
      status: USER_STATUS.ACTIVE,
    });
  });

  test('1. Valid Super Admin login returns token & user', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({
      email: 'superadmin@test.com',
      password: 'AdminPassword123',
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user.role).toBe(ROLES.SUPER_ADMIN);
    expect(res.body.data.user.passwordHash).toBeUndefined();

    adminToken = res.body.data.token;
    adminRefreshToken = res.body.data.refreshToken;
  });

  test('2. Invalid password returns 401 Unauthorized', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({
      email: 'superadmin@test.com',
      password: 'WrongPassword!',
    });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('INVALID_CREDENTIALS');
  });

  test('3. Nonexistent user returns 401', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({
      email: 'ghost@test.com',
      password: 'Password123',
    });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('4. Suspended admin returns 403 Forbidden', async () => {
    superAdminUser.status = USER_STATUS.SUSPENDED;
    await superAdminUser.save();

    const res = await request(app).post('/api/v1/auth/login').send({
      email: 'superadmin@test.com',
      password: 'AdminPassword123',
    });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  test('5. Blocked user returns 403 Forbidden', async () => {
    superAdminUser.status = USER_STATUS.BLOCKED;
    await superAdminUser.save();

    const res = await request(app).post('/api/v1/auth/login').send({
      email: 'superadmin@test.com',
      password: 'AdminPassword123',
    });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  test('6. Refresh token rotates and issues new token pair', async () => {
    const loginRes = await request(app).post('/api/v1/auth/login').send({
      email: 'superadmin@test.com',
      password: 'AdminPassword123',
    });

    const oldRefresh = loginRes.body.data.refreshToken;

    const refreshRes = await request(app).post('/api/v1/auth/refresh').send({
      refreshToken: oldRefresh,
    });

    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.data.token).toBeDefined();
    expect(refreshRes.body.data.refreshToken).toBeDefined();
    expect(refreshRes.body.data.refreshToken).not.toBe(oldRefresh);

    // Old refresh token must now be revoked and rejected
    const reuseRes = await request(app).post('/api/v1/auth/refresh').send({
      refreshToken: oldRefresh,
    });
    expect(reuseRes.status).toBe(401);
  });

  test('7. Logout revokes refresh token session', async () => {
    const loginRes = await request(app).post('/api/v1/auth/login').send({
      email: 'superadmin@test.com',
      password: 'AdminPassword123',
    });

    const { token, refreshToken } = loginRes.body.data;

    const logoutRes = await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${token}`)
      .send({ refreshToken });

    expect(logoutRes.status).toBe(200);

    // Using the refresh token after logout must fail
    const refreshRes = await request(app).post('/api/v1/auth/refresh').send({
      refreshToken,
    });
    expect(refreshRes.status).toBe(401);
  });

  test('8. RBAC: Super Admin can access admin dashboard, Wholesaler and Retailer cannot', async () => {
    const adminLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'superadmin@test.com',
      password: 'AdminPassword123',
    });
    const wsLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'wholesaler@test.com',
      password: 'Wholesaler123',
    });
    const retLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'retailer@test.com',
      password: 'Retailer123',
    });

    // Super Admin accesses dashboard -> 200
    const adminRes = await request(app)
      .get('/api/v1/admin/dashboard')
      .set('Authorization', `Bearer ${adminLogin.body.data.token}`);
    expect(adminRes.status).toBe(200);

    // Wholesaler attempts admin dashboard -> 403 Forbidden
    const wsRes = await request(app)
      .get('/api/v1/admin/dashboard')
      .set('Authorization', `Bearer ${wsLogin.body.data.token}`);
    expect(wsRes.status).toBe(403);
    expect(wsRes.body.code).toBe('FORBIDDEN_ROLE');

    // Retailer attempts admin dashboard -> 403 Forbidden
    const retRes = await request(app)
      .get('/api/v1/admin/dashboard')
      .set('Authorization', `Bearer ${retLogin.body.data.token}`);
    expect(retRes.status).toBe(403);
    expect(retRes.body.code).toBe('FORBIDDEN_ROLE');
  });

  test('9. Missing or malformed token returns 401', async () => {
    const noTokenRes = await request(app).get('/api/v1/admin/dashboard');
    expect(noTokenRes.status).toBe(401);

    const malformedRes = await request(app)
      .get('/api/v1/admin/dashboard')
      .set('Authorization', 'Bearer invalid.jwt.token');
    expect(malformedRes.status).toBe(401);
  });
});
