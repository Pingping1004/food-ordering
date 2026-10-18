import { bootTestApp, TestApp } from './harness';
import { discoverRoutes } from './routes';
import { PrismaService } from '../../src/prisma/prisma.service';

describe('Application structure', () => {
  let t: TestApp;
  beforeAll(async () => { t = await bootTestApp(); });
  afterAll(async () => { await t.close(); });

  it('should register every route exactly once', () => {
    const keys = discoverRoutes(t.app).map((r) => r.key);
    const dupes = keys.filter((k, i) => keys.indexOf(k) !== i);
    expect(dupes).toEqual([]);
  });

  it('should create exactly one PrismaService (one connection pool) for the whole app', () => {
    const container = (t.app as any).container;
    let count = 0;
    for (const mod of container.getModules().values())
      for (const w of mod.providers.values()) if (w.metatype === PrismaService) count++;
    expect(count).toBe(1);
  });
});

describe('Request hardening', () => {
  let t: TestApp;
  beforeAll(async () => { t = await bootTestApp(); });
  afterAll(async () => { await t.close(); });

  it('should reject an oversized JSON body on normal routes with 413', async () => {
    const request = (await import('supertest')).default;
    const { authHeader } = await import('./harness');
    const { makeUser } = await import('./factories');
    const u = await makeUser(t.prisma);
    const res = await request(t.url).post('/api/order/create').set(authHeader(u.userId)).send({ details: 'x'.repeat(300_000) });
    expect(res.status).toBe(413);
  });

  it('should send helmet security headers', async () => {
    const request = (await import('supertest')).default;
    const res = await request(t.url).get('/api/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('should answer /api/health without auth', async () => {
    const request = (await import('supertest')).default;
    await request(t.url).get('/api/health').expect(200);
    await request(t.url).get('/api/ready').expect(200);
  });

  it('should not allow a foreign CORS origin', async () => {
    const request = (await import('supertest')).default;
    const res = await request(t.url).get('/api/health').set('Origin', 'https://evil.example');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});
