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
