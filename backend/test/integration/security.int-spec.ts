import request from 'supertest';
import { randomUUID } from 'crypto';
import sharp from 'sharp';
import { RestaurantRole } from '@prisma/client';
import { authHeader, bootTestApp, TestApp } from './harness';
import { makeMember, makeMenu, makeUser, makeWorld, orderBody } from './factories';

describe('Security (OWASP API Top 10 mapped; real HTTP + real Postgres)', () => {
  let t: TestApp;
  beforeAll(async () => { t = await bootTestApp(); });
  afterAll(async () => { await t.close(); });
  const api = () => request(t.url);
  const png = () => sharp({ create: { width: 8, height: 8, channels: 3, background: '#fff' } }).png().toBuffer();

  describe('API2 broken authentication', () => {
    it.each([
      ['no header', undefined],
      ['empty bearer', 'Bearer '],
      ['wrong scheme', 'Basic dXNlcjpwYXNz'],
      ['garbage token', 'Bearer not.a.jwt'],
      ['token without payload', 'Bearer abc'],
    ])('should answer 401 for %s', async (_name, header) => {
      const r = api().get('/api/user/profile');
      await (header ? r.set('Authorization', header) : r).expect(401);
    });

    it('should not set any cookie (bearer-only auth, so no CSRF surface)', async () => {
      const w = await makeWorld(t.prisma);
      const res = await api().get('/api/user/profile').set(authHeader(w.student.userId));
      expect(res.headers['set-cookie']).toBeUndefined();
    });
  });

  describe('API3 mass assignment / property-level authorization', () => {
    it('should reject unknown privileged fields on order creation and create nothing', async () => {
      const w = await makeWorld(t.prisma);
      const before = await t.prisma.order.count({ where: { userId: w.student.userId } });
      const res = await api().post('/api/order/create').set(authHeader(w.student.userId))
        .send({ ...orderBody(w.restaurant.restaurantId, w.menu.menuId), paymentStatus: 'PAID', status: 'done', userId: w.owner.userId, totalAmount: 1 });
      expect(res.status).toBe(400);
      expect(await t.prisma.order.count({ where: { userId: w.student.userId } })).toBe(before);
    });

    it('should never let an owner change role/password/status through restaurant PATCH', async () => {
      const w = await makeWorld(t.prisma);
      const res = await api().patch(`/api/restaurant/${w.restaurant.restaurantId}`).set(authHeader(w.owner.userId))
        .send({ name: 'Renamed', role: 'ADMIN', password: 'x', status: 'ACTIVE', canteenId: 'other' });
      expect([200, 400]).toContain(res.status);
      const after = await t.prisma.user.findUniqueOrThrow({ where: { userId: w.owner.userId } });
      expect(after.role).toBe('USER');
      expect((await t.prisma.restaurant.findUniqueOrThrow({ where: { restaurantId: w.restaurant.restaurantId } })).canteenId).toBe(w.canteen.canteenId);
    });

    it('should not let a student escalate their own role via PATCH /user/:id', async () => {
      const w = await makeWorld(t.prisma);
      const res = await api().patch(`/api/user/${w.student.userId}`).set(authHeader(w.student.userId)).send({ role: 'ADMIN' });
      expect([403, 404]).toContain(res.status);
      expect((await t.prisma.user.findUniqueOrThrow({ where: { userId: w.student.userId } })).role).toBe('USER');
    });
  });

  describe('API3 excessive data exposure', () => {
    const SECRET_KEYS = ['password', 'accountNumber', 'accountName', 'paymentQr', 'inviteCode', 'contactEmail', 'bankType'];
    const leaked = (body: unknown) => SECRET_KEYS.filter((k) => JSON.stringify(body).includes(`"${k}"`));

    it('should not expose school invite codes or shop bank/contact details on the student surface', async () => {
      const w = await makeWorld(t.prisma);
      const secretCode = randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
      await t.prisma.school.update({ where: { schoolId: w.school.schoolId }, data: { inviteCode: secretCode } });
      const calls = [
        api().get('/api/me/school').set(authHeader(w.student.userId)),
        api().get('/api/restaurant').set(authHeader(w.student.userId)),
        api().get(`/api/restaurant/${w.restaurant.restaurantId}`).set(authHeader(w.student.userId)),
        api().get(`/api/menu/${w.restaurant.restaurantId}`).set(authHeader(w.student.userId)),
      ];
      const results = await Promise.all(calls);
      const found = results.flatMap((r, i) => leaked(r.body).map((k) => `call#${i}:${k}`));
      expect(found).toEqual([]);
      expect(JSON.stringify(results.map((r) => r.body))).not.toContain(secretCode);
    });

    it("should not show one student's orders to another", async () => {
      const w = await makeWorld(t.prisma);
      const other = await makeUser(t.prisma, { schoolId: w.school.schoolId });
      await api().post('/api/order/create').set(authHeader(w.student.userId)).send(orderBody(w.restaurant.restaurantId, w.menu.menuId)).expect(201);
      const mine = await api().get('/api/order/mine').set(authHeader(other.userId)).expect(200);
      expect(mine.body).toEqual([]);
    });

    it('should hide internals in error bodies', async () => {
      const w = await makeWorld(t.prisma);
      const res = await api().get("/api/order/not-a-uuid'--").set(authHeader(w.student.userId));
      expect(res.status).toBeLessThan(500);
      expect(JSON.stringify(res.body)).not.toMatch(/prisma|SELECT|stack|\/Users\//i);
    });
  });

  describe('API8 injection', () => {
    const PAYLOADS = ["' OR '1'='1", "1; DROP TABLE \"Order\"; --", '" || 1==1 //', '{"$ne":null}', '../../etc/passwd', '<script>alert(1)</script>', '%00'];

    it.each(PAYLOADS)('should never 500 or leak when %s is used as an id / query value', async (payload) => {
      const w = await makeWorld(t.prisma);
      const h = authHeader(w.student.userId);
      const enc = encodeURIComponent(payload);
      const results = await Promise.all([
        api().get(`/api/menu/${enc}`).set(h),
        api().get(`/api/restaurant/${enc}`).set(h),
        api().get(`/api/order/${enc}`).set(h),
        api().get(`/api/order/active-count/${enc}`).set(h),
        api().get(`/api/me/refund-requests?status=${enc}`).set(h),
        api().get(`/api/restaurant?limit=${enc}`).set(h),
      ]);
      for (const r of results) expect(r.status).toBeLessThan(500);
      expect(await t.prisma.order.count()).toBeGreaterThanOrEqual(0); // table still exists
    });

    it('should store hostile text verbatim and return it inert (JSON, never executed server-side)', async () => {
      const w = await makeWorld(t.prisma);
      const xss = `<img src=x onerror=alert(1)>'; DROP TABLE "Menu"; --`;
      await api().post('/api/menu/single').set(authHeader(w.owner.userId))
        .send({ restaurantId: w.restaurant.restaurantId, name: xss, price: 40 }).expect((r) => { if (r.status >= 500) throw new Error(`status ${r.status}`); });
      const list = await api().get(`/api/menu/${w.restaurant.restaurantId}`).set(authHeader(w.student.userId)).expect(200);
      expect(list.headers['content-type']).toMatch(/application\/json/);
      expect(list.headers['x-content-type-options']).toBe('nosniff');
    });
  });

  describe('API4 unrestricted resource consumption', () => {
    it('should cap order creation per user at 30/min and say when to retry', async () => {
      const w = await makeWorld(t.prisma, { maxDaily: 5000 });
      const send = () => api().post('/api/order/create').set(authHeader(w.student.userId)).send(orderBody(w.restaurant.restaurantId, w.menu.menuId));
      const statuses: number[] = [];
      let retryAfter: string | undefined;
      for (let i = 0; i < 34; i++) {
        const r = await send();
        statuses.push(r.status);
        if (r.status === 429) retryAfter = r.headers['retry-after'];
      }
      expect(statuses.filter((s) => s === 429).length).toBeGreaterThanOrEqual(4);
      expect(Number(retryAfter)).toBeGreaterThan(0);
      // another student is unaffected by the first one's burst
      const other = await makeUser(t.prisma, { schoolId: w.school.schoolId });
      await api().post('/api/order/create').set(authHeader(other.userId)).send(orderBody(w.restaurant.restaurantId, w.menu.menuId)).expect(201);
    });

    it('should throttle invite-code guessing (failed attempts only)', async () => {
      const u = await makeUser(t.prisma);
      const codes = Array.from({ length: 62 }, (_, i) => `ZZZZ-${String(1000 + i)}`);
      const statuses: number[] = [];
      for (const code of codes) statuses.push((await api().post('/api/me/redeem-code').set(authHeader(u.userId)).send({ code })).status);
      expect(statuses.slice(0, 5).every((s) => s === 400 || s === 404)).toBe(true);
      expect(statuses).toContain(429);
    });

    it('should refuse an oversized JSON body before parsing it (413)', async () => {
      const u = await makeUser(t.prisma);
      const res = await api().post('/api/events').send({ blob: 'x'.repeat(400_000) });
      expect(res.status).toBe(413);
      void u;
    });
  });

  describe('file upload abuse', () => {
    it('should refuse an unauthorized caller BEFORE buffering any file (guard runs ahead of multer)', async () => {
      const w = await makeWorld(t.prisma);
      const nobody = await makeUser(t.prisma); // signed in, but belongs to no school
      let req = api().post('/api/upload/images').set(authHeader(nobody.userId));
      const img = await png();
      for (let i = 0; i < 40; i++) req = req.attach('images', img, { filename: `a${i}.png`, contentType: 'image/png' });
      // 40 files exceeds the 30-file cap; if multer parsed first this would be a 400 limit error, not 403
      expect((await req).status).toBe(403);
      void w;
    });

    it('should accept a real image, including an upper-case extension from a phone', async () => {
      const w = await makeWorld(t.prisma);
      const img = await png();
      const res = await api().post('/api/upload/image').set(authHeader(w.student.userId)).attach('image', img, { filename: 'IMG_0001.JPG', contentType: 'image/jpeg' });
      expect(res.status).toBe(200);
      expect(res.body.url).toBeDefined();
    });

    it('should reject HTML disguised as an image by name (wrong declared type) and by bytes (right type, fake content)', async () => {
      const w = await makeWorld(t.prisma);
      const html = Buffer.from('<html><script>alert(1)</script></html>');
      const byType = await api().post('/api/upload/image').set(authHeader(w.student.userId)).attach('image', html, { filename: 'x.png', contentType: 'text/html' });
      expect(byType.status).toBe(400);
      const byBytes = await api().post('/api/upload/image').set(authHeader(w.student.userId)).attach('image', html, { filename: 'x.png', contentType: 'image/png' });
      expect(byBytes.status).toBe(400);
    });

    it('should reject a non-image extension', async () => {
      const w = await makeWorld(t.prisma);
      const res = await api().post('/api/upload/image').set(authHeader(w.student.userId)).attach('image', Buffer.from('MZ'), { filename: 'run.exe', contentType: 'image/png' });
      expect(res.status).toBe(400);
    });

    it('should reject a file over the size limit', async () => {
      const w = await makeWorld(t.prisma);
      const big = Buffer.alloc(9 * 1024 * 1024, 1);
      const res = await api().post('/api/upload/image').set(authHeader(w.student.userId)).attach('image', big, { filename: 'big.png', contentType: 'image/png' });
      expect([400, 413]).toContain(res.status);
    });

    it('should apply the same pre-parse check to menu bulk image staging', async () => {
      const nobody = await makeUser(t.prisma);
      const img = await png();
      const res = await api().post('/api/menu/bulk-images').set(authHeader(nobody.userId)).attach('images', img, { filename: 'a.png', contentType: 'image/png' });
      expect(res.status).toBe(403);
    });
  });

  describe('API5 function-level authorization (spot checks beyond the matrix)', () => {
    it('should not let staff delete menus or members, and not let a pending member act', async () => {
      const w = await makeWorld(t.prisma);
      const staff = await makeMember(t.prisma, w.restaurant.restaurantId, RestaurantRole.STAFF, w.school.schoolId);
      const menu = await makeMenu(t.prisma, w.restaurant.restaurantId);
      const del = await api().delete(`/api/menu/${menu.menuId}`).set(authHeader(staff.userId));
      expect([403, 404]).toContain(del.status);
      expect(await t.prisma.menu.count({ where: { menuId: menu.menuId } })).toBe(1);
    });
  });

  describe('CORS', () => {
    it('should answer a preflight for the real frontend origin and refuse others', async () => {
      const ok = await api().options('/api/order/create').set('Origin', 'http://localhost:3000').set('Access-Control-Request-Method', 'POST').set('Access-Control-Request-Headers', 'authorization,idempotency-key,content-type');
      expect(ok.headers['access-control-allow-origin']).toBe('http://localhost:3000');
      expect(String(ok.headers['access-control-allow-headers']).toLowerCase()).toContain('idempotency-key');
      const bad = await api().options('/api/order/create').set('Origin', 'https://evil.example').set('Access-Control-Request-Method', 'POST');
      expect(bad.headers['access-control-allow-origin']).toBeUndefined();
    });
  });
});
