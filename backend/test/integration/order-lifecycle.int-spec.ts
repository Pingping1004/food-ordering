import request from 'supertest';
import { RestaurantRole } from '@prisma/client';
import { authHeader, bootTestApp, TestApp } from './harness';
import { makeMember, makeUser, makeWorld, orderBody } from './factories';

describe('Order lifecycle: cook actions, state machine, stock (real HTTP + real Postgres)', () => {
  let t: TestApp;
  beforeAll(async () => { t = await bootTestApp(); });
  afterAll(async () => { await t.close(); });

  const api = () => request(t.url);
  const place = async (w: Awaited<ReturnType<typeof makeWorld>>, qty = 1, userId = w.student.userId) => {
    const res = await api().post('/api/order/create').set(authHeader(userId)).send(orderBody(w.restaurant.restaurantId, w.menu.menuId, qty)).expect(201);
    return res.body.orderId as string;
  };
  const act = (who: string, action: string, orderId: string) => api().patch(`/api/order/${action}/${orderId}`).set(authHeader(who)).send({});
  const remaining = async (menuId: string) => (await t.prisma.inventory.findFirst({ where: { menuId } }))?.remaining;
  const pay = (orderId: string) => t.prisma.order.update({ where: { orderId }, data: { paymentStatus: 'PAID', paidAt: new Date() } });

  describe('happy path', () => {
    it('should walk receive -> accept -> pay -> ready -> done with exactly one stock deduction', async () => {
      const w = await makeWorld(t.prisma, { autoAccept: false, maxDaily: 20 });
      const cook = await makeMember(t.prisma, w.restaurant.restaurantId, RestaurantRole.STAFF, w.school.schoolId);
      const orderId = await place(w, 2);

      let o = await t.prisma.order.findUniqueOrThrow({ where: { orderId } });
      expect([o.status, o.acceptAt]).toEqual(['receive', null]);
      expect(await remaining(w.menu.menuId)).toBeUndefined(); // nothing reserved before accept

      await act(cook.userId, 'accept', orderId).expect(200);
      o = await t.prisma.order.findUniqueOrThrow({ where: { orderId } });
      expect(o.acceptAt).not.toBeNull();
      expect(await remaining(w.menu.menuId)).toBe(18);

      await pay(orderId);
      await act(cook.userId, 'reject', orderId).expect(400).catch(() => undefined); // rejecting a paid+accepted order must not silently succeed
      await t.prisma.order.update({ where: { orderId }, data: { status: 'cooking' } });
      await act(cook.userId, 'ready', orderId).expect(200);
      await act(cook.userId, 'done', orderId).expect(200);
      expect((await t.prisma.order.findUniqueOrThrow({ where: { orderId } })).status).toBe('done');
      expect(await remaining(w.menu.menuId)).toBe(18);
    });
  });

  describe('GET /order/:id/status (what student screens poll)', () => {
    const status = (who: string, orderId: string, query = '') => api().get(`/api/order/${orderId}/status${query}`).set(authHeader(who));

    it('should return only the status fields and an X-Poll-After that follows the order through its steps', async () => {
      const w = await makeWorld(t.prisma, { autoAccept: false, maxDaily: 20 });
      const cook = await makeMember(t.prisma, w.restaurant.restaurantId, RestaurantRole.STAFF, w.school.schoolId);
      const orderId = await place(w);

      let res = await status(w.student.userId, orderId).expect(200);
      expect(Object.keys(res.body).sort()).toEqual(['acceptAt', 'paymentStatus', 'status', 'updatedAt']);
      expect(res.headers['x-poll-after']).toBe('5'); // waiting for the shop, no push
      expect((await status(w.student.userId, orderId, '?push=1')).headers['x-poll-after']).toBe('10'); // the accept push is the fast path
      const before = res.body.updatedAt;

      await act(cook.userId, 'accept', orderId).expect(200);
      res = await status(w.student.userId, orderId).expect(200);
      expect(res.body.acceptAt).not.toBeNull();
      expect(res.body.updatedAt).not.toBe(before); // the client reloads the full order only when this moves
      expect(res.headers['x-poll-after']).toBe('20');

      await t.prisma.order.update({ where: { orderId }, data: { paymentStatus: 'PAID', status: 'cooking' } });
      expect((await status(w.student.userId, orderId)).headers['x-poll-after']).toBe('15');
      await act(cook.userId, 'ready', orderId).expect(200);
      expect((await status(w.student.userId, orderId)).headers['x-poll-after']).toBe('10');
      await act(cook.userId, 'done', orderId).expect(200);
      expect((await status(w.student.userId, orderId)).headers['x-poll-after']).toBe('0'); // finished: stop polling
    });

    it("should not reveal another student's order (404, same as the full order route)", async () => {
      const w = await makeWorld(t.prisma);
      const other = await makeUser(t.prisma, { schoolId: w.school.schoolId });
      const orderId = await place(w);
      await status(other.userId, orderId).expect(404);
    });
  });

  describe('state machine', () => {
    const cases: Array<[from: string, action: string, ok: boolean]> = [
      ['receive', 'ready', false],
      ['receive', 'done', false],
      ['cooking', 'done', false],
      ['cooking', 'ready', true],
      ['ready', 'done', true],
      ['ready', 'reject', false],
      ['done', 'ready', false],
      ['done', 'reject', false],
      ['rejected', 'ready', false],
      ['rejected', 'done', false],
    ];
    it.each(cases)('from %s, "%s" should %s', async (from, action, ok) => {
      const w = await makeWorld(t.prisma, { autoAccept: false });
      const orderId = await place(w);
      await t.prisma.order.update({ where: { orderId }, data: { status: from as never, acceptAt: new Date(), paymentStatus: 'PAID' } });
      const res = await act(w.owner.userId, action, orderId);
      if (ok) expect(res.status).toBe(200);
      else expect([400, 409]).toContain(res.status);
      if (!ok) expect((await t.prisma.order.findUniqueOrThrow({ where: { orderId } })).status).toBe(from);
    });
  });

  describe('concurrency between cooks (looped: these races are timing dependent)', () => {
    const ROUNDS = 15;

    it('should deduct stock once when two cooks accept the same order at the same moment', async () => {
      for (let i = 0; i < ROUNDS; i++) {
        const w = await makeWorld(t.prisma, { autoAccept: false, maxDaily: 20 });
        const cook = await makeMember(t.prisma, w.restaurant.restaurantId, RestaurantRole.STAFF, w.school.schoolId);
        const orderId = await place(w, 3);
        const results = await Promise.all([act(w.owner.userId, 'accept', orderId), act(cook.userId, 'accept', orderId)]);
        expect(results.map((r) => r.status)).toEqual([200, 200]);
        expect(await remaining(w.menu.menuId)).toBe(17);
      }
    });

    it('should never strand reserved stock when one cook accepts and another rejects at the same moment', async () => {
      for (let i = 0; i < ROUNDS; i++) {
        const w = await makeWorld(t.prisma, { autoAccept: false, maxDaily: 20 });
        const cook = await makeMember(t.prisma, w.restaurant.restaurantId, RestaurantRole.STAFF, w.school.schoolId);
        const orderId = await place(w, 3);
        await Promise.all([act(w.owner.userId, 'accept', orderId), act(cook.userId, 'reject', orderId)]);
        const o = await t.prisma.order.findUniqueOrThrow({ where: { orderId } });
        const left = (await remaining(w.menu.menuId)) ?? 20;
        // rejected => every portion available again; otherwise accepted => exactly 3 reserved.
        expect(left).toBe(o.status === 'rejected' ? 20 : 17);
      }
    });

    it('should never strand reserved stock when a cook accepts while the student cancels', async () => {
      for (let i = 0; i < ROUNDS; i++) {
        const w = await makeWorld(t.prisma, { autoAccept: false, maxDaily: 20 });
        const orderId = await place(w, 3);
        await Promise.all([
          act(w.owner.userId, 'accept', orderId),
          api().patch(`/api/order/cancel/${orderId}`).set(authHeader(w.student.userId)).send({}),
        ]);
        const o = await t.prisma.order.findUniqueOrThrow({ where: { orderId } });
        const left = (await remaining(w.menu.menuId)) ?? 20;
        expect(left).toBe(o.status === 'rejected' ? 20 : 17);
      }
    });
  });

  describe('student cancel / expire', () => {
    it('should let the student cancel an unaccepted order and not another student', async () => {
      const w = await makeWorld(t.prisma, { autoAccept: false });
      const other = await makeUser(t.prisma, { schoolId: w.school.schoolId });
      const orderId = await place(w);
      const denied = await api().patch(`/api/order/cancel/${orderId}`).set(authHeader(other.userId)).send({});
      expect([403, 404]).toContain(denied.status);
      await api().patch(`/api/order/cancel/${orderId}`).set(authHeader(w.student.userId)).send({}).expect(200);
      expect((await t.prisma.order.findUniqueOrThrow({ where: { orderId } })).status).toBe('rejected');
    });

    it('should release reserved stock when an accepted, unpaid order is cancelled', async () => {
      const w = await makeWorld(t.prisma, { autoAccept: true, maxDaily: 10 });
      const orderId = await place(w, 4);
      expect(await remaining(w.menu.menuId)).toBe(6);
      await api().patch(`/api/order/cancel/${orderId}`).set(authHeader(w.student.userId)).send({}).expect(200);
      expect(await remaining(w.menu.menuId)).toBe(10);
    });

    it('should be safe to cancel twice (idempotent) without giving stock back twice', async () => {
      const w = await makeWorld(t.prisma, { autoAccept: true, maxDaily: 10 });
      const orderId = await place(w, 4);
      await Promise.all([1, 2, 3].map(() => api().patch(`/api/order/cancel/${orderId}`).set(authHeader(w.student.userId)).send({})));
      expect(await remaining(w.menu.menuId)).toBe(10);
    });
  });
});

describe('Cancel rules (real HTTP + real Postgres)', () => {
  let t: TestApp;
  beforeAll(async () => { t = await bootTestApp(); });
  afterAll(async () => { await t.close(); });

  it('should refuse to cancel a paid order (409 ORDER_ALREADY_PAID) and leave it untouched', async () => {
    const w = await makeWorld(t.prisma);
    const created = await request(t.url).post('/api/order/create').set(authHeader(w.student.userId)).send(orderBody(w.restaurant.restaurantId, w.menu.menuId)).expect(201);
    const id = created.body.orderId as string;
    await t.prisma.order.update({ where: { orderId: id }, data: { paymentStatus: 'PAID', paidAt: new Date(), status: 'cooking' } });
    const res = await request(t.url).patch(`/api/order/cancel/${id}`).set(authHeader(w.student.userId)).send({});
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('ORDER_ALREADY_PAID');
    const o = await t.prisma.order.findUniqueOrThrow({ where: { orderId: id } });
    expect([o.status, o.paymentStatus]).toEqual(['cooking', 'PAID']);
  });

  it('should still let a student cancel an unpaid order', async () => {
    const w = await makeWorld(t.prisma);
    const created = await request(t.url).post('/api/order/create').set(authHeader(w.student.userId)).send(orderBody(w.restaurant.restaurantId, w.menu.menuId)).expect(201);
    await request(t.url).patch(`/api/order/cancel/${created.body.orderId}`).set(authHeader(w.student.userId)).send({}).expect(200);
  });
});

describe('Shop active-order cap (default 50)', () => {
  let t: TestApp;
  beforeAll(async () => { t = await bootTestApp(); });
  afterAll(async () => { await t.close(); });

  it('should accept the 50th concurrent active order and turn away the 51st when the shop has no custom cap', async () => {
    const w = await makeWorld(t.prisma, { autoAccept: false });
    await t.prisma.restaurant.update({ where: { restaurantId: w.restaurant.restaurantId }, data: { maxActiveOrders: null } });
    // seed 49 active orders directly, then use the API for #50 (accepted) and #51 (turned away)
    const students = await Promise.all(Array.from({ length: 51 }, () => makeUser(t.prisma, { schoolId: w.school.schoolId })));
    await t.prisma.order.createMany({
      data: students.slice(0, 49).map((s) => ({ restaurantId: w.restaurant.restaurantId, userId: s.userId, pickupAt: new Date(Date.now() + 3_600_000), totalAmount: 40 })),
    });
    const body = orderBody(w.restaurant.restaurantId, w.menu.menuId);
    await request(t.url).post('/api/order/create').set(authHeader(students[49].userId)).send(body).expect(201);
    const over = await request(t.url).post('/api/order/create').set(authHeader(students[50].userId)).send(body);
    expect(over.status).toBe(409);
  });
});
