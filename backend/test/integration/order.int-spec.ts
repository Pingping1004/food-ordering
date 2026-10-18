import request from 'supertest';
import { authHeader, bootTestApp, TestApp } from './harness';
import { makeUser, makeWorld, orderBody } from './factories';

describe('Order creation (real HTTP + real Postgres)', () => {
  let t: TestApp;
  beforeAll(async () => { t = await bootTestApp(); });
  afterAll(async () => { await t.close(); });

  const post = (userId: string, body: object, key?: string) => {
    const r = request(t.url).post('/api/order/create').set(authHeader(userId));
    return (key ? r.set('Idempotency-Key', key) : r).send(body);
  };

  it('should reject unauthenticated order creation with 401', async () => {
    const w = await makeWorld(t.prisma);
    await request(t.url).post('/api/order/create').send(orderBody(w.restaurant.restaurantId, w.menu.menuId)).expect(401);
  });

  it('should price the order server-side and ignore a tampered client unitPrice', async () => {
    const w = await makeWorld(t.prisma);
    const res = await post(w.student.userId, orderBody(w.restaurant.restaurantId, w.menu.menuId, 2)).expect(201);
    expect(res.body.totalAmount).toBe(w.menu.price * 2);
    expect(res.body.userId).toBe(w.student.userId);
    expect(res.body.paymentStatus).toBe('UNPAID');
  });

  it('should not let a student from another school order from this shop', async () => {
    const w = await makeWorld(t.prisma);
    const other = await makeWorld(t.prisma);
    await post(other.student.userId, orderBody(w.restaurant.restaurantId, w.menu.menuId)).expect(404);
  });

  it('should reject a menu item that belongs to another shop', async () => {
    const a = await makeWorld(t.prisma);
    const b = await makeWorld(t.prisma);
    await post(a.student.userId, orderBody(a.restaurant.restaurantId, b.menu.menuId)).expect(400);
  });

  it('should reject an unavailable menu item', async () => {
    const w = await makeWorld(t.prisma);
    await t.prisma.menu.update({ where: { menuId: w.menu.menuId }, data: { isAvailable: false } });
    await post(w.student.userId, orderBody(w.restaurant.restaurantId, w.menu.menuId)).expect(400);
  });

  it('should reject pickup times that are too soon', async () => {
    const w = await makeWorld(t.prisma);
    await post(w.student.userId, orderBody(w.restaurant.restaurantId, w.menu.menuId, 1, 2)).expect(400);
  });

  describe('idempotency', () => {
    it('should return the same order when the same key is replayed sequentially', async () => {
      const w = await makeWorld(t.prisma);
      const body = orderBody(w.restaurant.restaurantId, w.menu.menuId);
      const first = await post(w.student.userId, body, 'key-sequential-1').expect(201);
      const second = await post(w.student.userId, body, 'key-sequential-1').expect(201);
      expect(second.body.orderId).toBe(first.body.orderId);
      expect(await t.prisma.order.count({ where: { userId: w.student.userId } })).toBe(1);
    });

    it('should create exactly one order and one stock decrement for 20 concurrent submits with one key', async () => {
      const w = await makeWorld(t.prisma, { autoAccept: true, maxDaily: 30 });
      const body = orderBody(w.restaurant.restaurantId, w.menu.menuId, 3);
      const results = await Promise.all(Array.from({ length: 20 }, () => post(w.student.userId, body, 'key-concurrent-1')));
      const ids = new Set(results.map((r) => r.body.orderId));
      expect(results.map((r) => r.status)).toEqual(Array(20).fill(201));
      expect(ids.size).toBe(1);
      expect(await t.prisma.order.count({ where: { userId: w.student.userId } })).toBe(1);
      const inv = await t.prisma.inventory.findFirst({ where: { menuId: w.menu.menuId } });
      expect(inv?.remaining).toBe(27);
    });

    it('should return 409 when the same key is reused with a different cart', async () => {
      const w = await makeWorld(t.prisma);
      await post(w.student.userId, orderBody(w.restaurant.restaurantId, w.menu.menuId, 1), 'key-mismatch-1').expect(201);
      await post(w.student.userId, orderBody(w.restaurant.restaurantId, w.menu.menuId, 2), 'key-mismatch-1').expect(409);
    });

    it('should scope keys per user so two students can use the same key', async () => {
      const w = await makeWorld(t.prisma);
      const other = await makeUser(t.prisma, { schoolId: w.school.schoolId });
      const body = orderBody(w.restaurant.restaurantId, w.menu.menuId);
      const a = await post(w.student.userId, body, 'shared-key-1').expect(201);
      const b = await post(other.userId, body, 'shared-key-1').expect(201);
      expect(a.body.orderId).not.toBe(b.body.orderId);
    });

    it('should reject a malformed Idempotency-Key with 400', async () => {
      const w = await makeWorld(t.prisma);
      await post(w.student.userId, orderBody(w.restaurant.restaurantId, w.menu.menuId), 'x').expect(400);
    });
  });

  describe('stock (no oversell)', () => {
    it('should never sell more than maxDaily when 40 students race for 10 portions', async () => {
      const w = await makeWorld(t.prisma, { autoAccept: true, maxDaily: 10 });
      const students = await Promise.all(Array.from({ length: 40 }, () => makeUser(t.prisma, { schoolId: w.school.schoolId })));
      const results = await Promise.all(students.map((s) => post(s.userId, orderBody(w.restaurant.restaurantId, w.menu.menuId, 1))));
      const ok = results.filter((r) => r.status === 201).length;
      const inv = await t.prisma.inventory.findFirst({ where: { menuId: w.menu.menuId } });
      expect(ok).toBeLessThanOrEqual(10);
      expect(inv?.remaining).toBeGreaterThanOrEqual(0);
      expect(10 - (inv?.remaining ?? 10)).toBe(ok);
      expect(results.filter((r) => r.status >= 500)).toHaveLength(0);
    });
  });

  describe('BOLA on reading an order', () => {
    it('should let the owner read it but not another student', async () => {
      const w = await makeWorld(t.prisma);
      const other = await makeUser(t.prisma, { schoolId: w.school.schoolId });
      const created = await post(w.student.userId, orderBody(w.restaurant.restaurantId, w.menu.menuId)).expect(201);
      await request(t.url).get(`/api/order/${created.body.orderId}`).set(authHeader(w.student.userId)).expect(200);
      const res = await request(t.url).get(`/api/order/${created.body.orderId}`).set(authHeader(other.userId));
      expect([403, 404]).toContain(res.status);
    });
  });
});
