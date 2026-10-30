const request = require('supertest');
const app = require('../src/app');

describe('CORS configuration', () => {
  test('allows Cache-Control on retailer registration preflight requests', async () => {
    const response = await request(app)
      .options('/api/auth/register')
      .set('Origin', 'https://new-project-cdq2.vercel.app')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'content-type,cache-control');

    expect(response.status).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe(
      'https://new-project-cdq2.vercel.app',
    );
    expect(response.headers['access-control-allow-headers'].toLowerCase().split(',')).toContain(
      'cache-control',
    );
  });
});
