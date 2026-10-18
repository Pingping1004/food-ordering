import request from 'supertest';
import { authHeader, bootTestApp, TestApp } from './harness';
import { makeMember, makeUser, makeWorld, makeSchool, makeCanteen, makeSchoolAdmin } from './factories';
import { RestaurantRole } from '@prisma/client';

describe('Refund flow: manual, school-handled; PromptServe never moves money (real HTTP + real Postgres)', () => {
  let t: TestApp;
  beforeAll(async () => { t = await bootTestApp(); });
  afterAll(async () => { await t.close(); });
  const api = () => request(t.url);

  const paidOrder = async (w: Awaited<ReturnType<typeof makeWorld>>, over: Record<string, unknown> = {}) =>
    t.prisma.order.create({
      data: {
        restaurantId: w.restaurant.restaurantId, userId: w.student.userId, pickupAt: new Date(Date.now() + 3_600_000),
        totalAmount: 80, paymentStatus: 'PAID', paidAt: new Date(), acceptAt: new Date(), status: 'cooking',
        orderMenus: { create: [{ quantity: 2, menuName: w.menu.name, unitPrice: 40, totalPrice: 80, menuId: w.menu.menuId }] },
        ...over,
      },
    });
  const file = (userId: string, orderId: string, reason = 'LATE_OR_NOT_READY') =>
    api().post(`/api/order/${orderId}/refund-request`).set(authHeader(userId)).send({ reason, details: 'cold food' });
  const decide = (adminId: string, schoolId: string, id: string, body: object) =>
    api().patch(`/api/schools/${schoolId}/refund-requests/${id}`).set(authHeader(adminId)).send(body);
  const payment = async (orderId: string) => (await t.prisma.order.findUniqueOrThrow({ where: { orderId } })).paymentStatus;

  describe('student files a request', () => {
    it('should create a PENDING request for the own paid order with the amount copied from the order', async () => {
      const w = await makeWorld(t.prisma);
      const o = await paidOrder(w);
      const res = await file(w.student.userId, o.orderId).expect(201);
      expect(res.body.status).toBe('PENDING');
      expect(res.body.amount).toBe(80);
      expect(await payment(o.orderId)).toBe('PAID');
    });

    it('should refuse an unpaid order with ORDER_NOT_PAID', async () => {
      const w = await makeWorld(t.prisma);
      const o = await paidOrder(w, { paymentStatus: 'UNPAID', paidAt: null });
      const res = await file(w.student.userId, o.orderId).expect(400);
      expect(res.body.code).toBe('ORDER_NOT_PAID');
    });

    it("should return 404 for another student's order", async () => {
      const w = await makeWorld(t.prisma);
      const other = await makeUser(t.prisma, { schoolId: w.school.schoolId });
      const o = await paidOrder(w);
      await file(other.userId, o.orderId).expect(404);
    });

    it('should accept exactly one of 5 concurrent requests for the same order', async () => {
      const w = await makeWorld(t.prisma);
      const o = await paidOrder(w);
      const results = await Promise.all(Array.from({ length: 5 }, () => file(w.student.userId, o.orderId)));
      expect(results.filter((r) => r.status === 201)).toHaveLength(1);
      expect(results.filter((r) => r.status === 409)).toHaveLength(4);
      expect(await t.prisma.refundRequest.count({ where: { orderId: o.orderId } })).toBe(1);
    });

    it('should let the student re-file after a rejection', async () => {
      const w = await makeWorld(t.prisma);
      const o = await paidOrder(w);
      const first = await file(w.student.userId, o.orderId).expect(201);
      await decide(w.admin.userId, w.school.schoolId, first.body.id, { action: 'reject', note: 'not valid' }).expect(200);
      await file(w.student.userId, o.orderId).expect(201);
    });
  });

  describe('school admin decides (no money moves)', () => {
    it('should leave paymentStatus untouched on approve and on reject', async () => {
      const w = await makeWorld(t.prisma);
      const a = await paidOrder(w);
      const b = await paidOrder(w);
      const ra = await file(w.student.userId, a.orderId).expect(201);
      const rb = await file(w.student.userId, b.orderId).expect(201);
      await decide(w.admin.userId, w.school.schoolId, ra.body.id, { action: 'approve' }).expect(200);
      await decide(w.admin.userId, w.school.schoolId, rb.body.id, { action: 'reject', note: 'looks fine to us' }).expect(200);
      expect(await payment(a.orderId)).toBe('PAID');
      expect(await payment(b.orderId)).toBe('PAID');
    });

    it('should set REFUNDED only through an explicit mark_refunded after approval', async () => {
      const w = await makeWorld(t.prisma);
      const o = await paidOrder(w);
      const r = await file(w.student.userId, o.orderId).expect(201);
      await decide(w.admin.userId, w.school.schoolId, r.body.id, { action: 'mark_refunded' }).expect(409);
      expect(await payment(o.orderId)).toBe('PAID');
      await decide(w.admin.userId, w.school.schoolId, r.body.id, { action: 'approve' }).expect(200);
      expect(await payment(o.orderId)).toBe('PAID');
      await decide(w.admin.userId, w.school.schoolId, r.body.id, { action: 'mark_refunded' }).expect(200);
      expect(await payment(o.orderId)).toBe('REFUNDED');
    });

    it('should not repeat a decision: second mark_refunded / approve-after-reject are 409', async () => {
      const w = await makeWorld(t.prisma);
      const o = await paidOrder(w);
      const r = await file(w.student.userId, o.orderId).expect(201);
      await decide(w.admin.userId, w.school.schoolId, r.body.id, { action: 'approve' }).expect(200);
      await decide(w.admin.userId, w.school.schoolId, r.body.id, { action: 'approve' }).expect(409);
      await decide(w.admin.userId, w.school.schoolId, r.body.id, { action: 'mark_refunded' }).expect(200);
      await decide(w.admin.userId, w.school.schoolId, r.body.id, { action: 'mark_refunded' }).expect(409);
      await decide(w.admin.userId, w.school.schoolId, r.body.id, { action: 'reject', note: 'too late now' }).expect(409);
    });

    it('should let only one of two admins win a simultaneous approve', async () => {
      const w = await makeWorld(t.prisma);
      const second = await makeSchoolAdmin(t.prisma, w.school.schoolId);
      const o = await paidOrder(w);
      const r = await file(w.student.userId, o.orderId).expect(201);
      const results = await Promise.all([
        decide(w.admin.userId, w.school.schoolId, r.body.id, { action: 'approve' }),
        decide(second.userId, w.school.schoolId, r.body.id, { action: 'approve' }),
      ]);
      expect(results.map((x) => x.status).sort()).toEqual([200, 409]);
    });

    it('should require a reason to reject', async () => {
      const w = await makeWorld(t.prisma);
      const o = await paidOrder(w);
      const r = await file(w.student.userId, o.orderId).expect(201);
      await decide(w.admin.userId, w.school.schoolId, r.body.id, { action: 'reject' }).expect(400);
      expect((await t.prisma.refundRequest.findUniqueOrThrow({ where: { id: r.body.id } })).status).toBe('PENDING');
    });

    it('should write an audit record for every decision', async () => {
      const w = await makeWorld(t.prisma);
      const o = await paidOrder(w);
      const r = await file(w.student.userId, o.orderId).expect(201);
      await decide(w.admin.userId, w.school.schoolId, r.body.id, { action: 'approve' }).expect(200);
      const logs = await t.prisma.auditLog.findMany({ where: { entityId: r.body.id } });
      expect(logs.map((l) => l.action)).toContain('REFUND_APPROVE');
      expect(logs[0].actorId).toBe(w.admin.userId);
    });
  });

  describe('who may decide', () => {
    it('should refuse shop staff, shop owner, the requesting student and an admin of another school', async () => {
      const w = await makeWorld(t.prisma);
      const cook = await makeMember(t.prisma, w.restaurant.restaurantId, RestaurantRole.STAFF, w.school.schoolId);
      const otherSchool = await makeSchool(t.prisma);
      await makeCanteen(t.prisma, otherSchool.schoolId);
      const otherAdmin = await makeSchoolAdmin(t.prisma, otherSchool.schoolId);
      const o = await paidOrder(w);
      const r = await file(w.student.userId, o.orderId).expect(201);
      for (const who of [cook.userId, w.owner.userId, w.student.userId, otherAdmin.userId]) {
        const res = await decide(who, w.school.schoolId, r.body.id, { action: 'approve' });
        expect([403, 404]).toContain(res.status);
      }
      // the same admin cannot reach the request through another school's URL either
      const crossed = await decide(otherAdmin.userId, otherSchool.schoolId, r.body.id, { action: 'approve' });
      expect([403, 404]).toContain(crossed.status);
      expect((await t.prisma.refundRequest.findUniqueOrThrow({ where: { id: r.body.id } })).status).toBe('PENDING');
    });

    it("should hide a student's request from other students", async () => {
      const w = await makeWorld(t.prisma);
      const other = await makeUser(t.prisma, { schoolId: w.school.schoolId });
      const o = await paidOrder(w);
      const r = await file(w.student.userId, o.orderId).expect(201);
      await api().get(`/api/me/refund-requests/${r.body.id}`).set(authHeader(other.userId)).expect(404);
      await api().get(`/api/me/refund-requests/${r.body.id}`).set(authHeader(w.student.userId)).expect(200);
    });
  });
});
