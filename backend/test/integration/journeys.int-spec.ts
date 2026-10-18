import request from 'supertest';
import { randomUUID } from 'crypto';
import sharp from 'sharp';
import { MembershipStatus, Role } from '@prisma/client';
import { authHeader, bootTestApp, TestApp } from './harness';
import { makeCanteen, makeMenu, makeSchool, makeUser, makeWorld, orderBody } from './factories';

const dashed = (code: string) => `${code.slice(0, 4)}-${code.slice(4)}`;

describe('Role journeys: onboarding, approvals, menu and shop settings (real HTTP + real Postgres)', () => {
  let t: TestApp;
  beforeAll(async () => { t = await bootTestApp(); });
  afterAll(async () => { await t.close(); });
  const api = () => request(t.url);
  const code8 = () => randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase().replace(/[01OIL]/g, 'X');
  const sysadmin = async () => makeUser(t.prisma, { role: Role.ADMIN, userId: `aal2-${randomUUID()}` });

  describe('student joins a school with the school code', () => {
    it('should attach the student to the school; code entry is case/dash tolerant', async () => {
      const school = await makeSchool(t.prisma);
      const code = code8();
      await t.prisma.school.update({ where: { schoolId: school.schoolId }, data: { inviteCode: code } });
      const stu = await makeUser(t.prisma);
      const res = await api().post('/api/me/redeem-code').set(authHeader(stu.userId)).send({ code: dashed(code).toLowerCase() });
      expect(res.status).toBeLessThan(300);
      expect((await t.prisma.user.findUniqueOrThrow({ where: { userId: stu.userId } })).schoolId).toBe(school.schoolId);
    });

    it('should give malformed and unknown codes the same generic answer (no code enumeration)', async () => {
      const stu = await makeUser(t.prisma);
      const a = await api().post('/api/me/redeem-code').set(authHeader(stu.userId)).send({ code: 'nope' });
      const b = await api().post('/api/me/redeem-code').set(authHeader(stu.userId)).send({ code: 'ZZZZ-ZZZZ' });
      expect(a.status).toBe(400);
      expect(b.status).toBe(400);
      expect(a.body.message).toBe(b.body.message);
    });

    it('should refuse a second school code once the student already belongs to a school', async () => {
      const w = await makeWorld(t.prisma);
      const other = await makeSchool(t.prisma);
      const code = code8();
      await t.prisma.school.update({ where: { schoolId: other.schoolId }, data: { inviteCode: code } });
      const res = await api().post('/api/me/redeem-code').set(authHeader(w.student.userId)).send({ code });
      expect(res.status).toBe(409);
      expect((await t.prisma.user.findUniqueOrThrow({ where: { userId: w.student.userId } })).schoolId).toBe(w.school.schoolId);
    });

    it('should tell the student plainly when the school is suspended', async () => {
      const school = await makeSchool(t.prisma, { status: 'SUSPENDED' });
      const code = code8();
      await t.prisma.school.update({ where: { schoolId: school.schoolId }, data: { inviteCode: code } });
      const stu = await makeUser(t.prisma);
      const res = await api().post('/api/me/redeem-code').set(authHeader(stu.userId)).send({ code });
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('SCHOOL_SUSPENDED');
    });
  });

  describe('cook (shop staff) onboarding and approval by the owner', () => {
    it('should keep a new cook out of the kitchen until the owner approves, and out again after removal', async () => {
      const w = await makeWorld(t.prisma);
      const cook = await makeUser(t.prisma, { schoolId: w.school.schoolId });
      const created = await api().post(`/api/restaurant/${w.restaurant.restaurantId}/staff-codes`).set(authHeader(w.owner.userId)).send({}).expect(201);
      const staffCode: string = created.body.code;
      expect(staffCode).toBeDefined();

      const red = await api().post('/api/me/redeem-code').set(authHeader(cook.userId)).send({ code: staffCode });
      expect(red.status).toBeLessThan(300);
      const membership = await t.prisma.restaurantMembership.findUniqueOrThrow({ where: { userId_restaurantId: { userId: cook.userId, restaurantId: w.restaurant.restaurantId } } });
      expect([membership.role, membership.status]).toEqual(['STAFF', 'PENDING']);

      const queue = () => api().get(`/api/order/today/${w.restaurant.restaurantId}`).set(authHeader(cook.userId));
      expect([403, 404]).toContain((await queue()).status); // pending: no access

      await api().patch(`/api/restaurant/${w.restaurant.restaurantId}/members/${membership.id}/approve`).set(authHeader(w.owner.userId)).expect(200);
      await queue().expect(200); // approved: access works on the very next request, no re-login

      await api().delete(`/api/restaurant/${w.restaurant.restaurantId}/members/${membership.id}`).set(authHeader(w.owner.userId)).expect(200);
      expect([403, 404]).toContain((await queue()).status); // removed: access gone immediately
    });

    it('should not let a cook approve themselves or their colleagues', async () => {
      const w = await makeWorld(t.prisma);
      const cook = await makeUser(t.prisma, { schoolId: w.school.schoolId });
      const m = await t.prisma.restaurantMembership.create({ data: { userId: cook.userId, restaurantId: w.restaurant.restaurantId, role: 'STAFF', status: MembershipStatus.PENDING } });
      const res = await api().patch(`/api/restaurant/${w.restaurant.restaurantId}/members/${m.id}/approve`).set(authHeader(cook.userId));
      expect([403, 404]).toContain(res.status);
      expect((await t.prisma.restaurantMembership.findUniqueOrThrow({ where: { id: m.id } })).status).toBe('PENDING');
    });

    it('should only approve a PENDING member once (second approve is 409) and reject cleanly', async () => {
      const w = await makeWorld(t.prisma);
      const a = await makeUser(t.prisma, { schoolId: w.school.schoolId });
      const b = await makeUser(t.prisma, { schoolId: w.school.schoolId });
      const ma = await t.prisma.restaurantMembership.create({ data: { userId: a.userId, restaurantId: w.restaurant.restaurantId, role: 'STAFF', status: 'PENDING' } });
      const mb = await t.prisma.restaurantMembership.create({ data: { userId: b.userId, restaurantId: w.restaurant.restaurantId, role: 'STAFF', status: 'PENDING' } });
      await api().patch(`/api/restaurant/${w.restaurant.restaurantId}/members/${ma.id}/approve`).set(authHeader(w.owner.userId)).expect(200);
      await api().patch(`/api/restaurant/${w.restaurant.restaurantId}/members/${ma.id}/approve`).set(authHeader(w.owner.userId)).expect(409);
      await api().patch(`/api/restaurant/${w.restaurant.restaurantId}/members/${mb.id}/reject`).set(authHeader(w.owner.userId)).expect(200);
      expect((await t.prisma.restaurantMembership.findUniqueOrThrow({ where: { id: mb.id } })).status).toBe('REJECTED');
    });
  });

  describe('school admin onboarding by a system-admin code', () => {
    it('should make the code holder an approved admin immediately (the sysadmin vouched for them)', async () => {
      const w = await makeWorld(t.prisma);
      const sys = await sysadmin();
      await t.prisma.supportGrant.create({ data: { adminId: sys.userId, schoolId: w.school.schoolId, reason: 'test', expiresAt: new Date(Date.now() + 3_600_000) } });
      const made = await api().post(`/api/admin/schools/${w.school.schoolId}/codes`).set(authHeader(sys.userId)).send({ type: 'SCHOOL_ADMIN', maxUses: 1 });
      expect(made.status).toBe(201);
      const newAdmin = await makeUser(t.prisma);
      await api().post('/api/me/redeem-code').set(authHeader(newAdmin.userId)).send({ code: made.body.code }).expect((r) => { if (r.status >= 300) throw new Error(`redeem ${r.status} ${JSON.stringify(r.body)}`); });
      await api().get(`/api/schools/${w.school.schoolId}/members`).set(authHeader(newAdmin.userId)).expect(200);
    });
  });

  describe('shop registration -> school admin approval -> students can order', () => {
    it('should keep a PENDING shop invisible to students, then orderable after the school admin approves it', async () => {
      const w = await makeWorld(t.prisma);
      const canteen = await makeCanteen(t.prisma, w.school.schoolId);
      const sys = await sysadmin();
      await t.prisma.supportGrant.create({ data: { adminId: sys.userId, schoolId: w.school.schoolId, reason: 'test', expiresAt: new Date(Date.now() + 3_600_000) } });
      const grant = await api().post(`/api/admin/schools/${w.school.schoolId}/codes`).set(authHeader(sys.userId)).send({ type: 'SHOP_OWNER', maxUses: 1 }).expect(201);
      const applicant = await makeUser(t.prisma);
      await api().post('/api/me/redeem-code').set(authHeader(applicant.userId)).send({ code: grant.body.code }).expect((r) => { if (r.status >= 300) throw new Error(`redeem ${r.status}`); });

      const qr = await sharp({ create: { width: 64, height: 64, channels: 3, background: '#ddd' } }).png().toBuffer();
      const reg = await api().post('/api/restaurant').set(authHeader(applicant.userId))
        .field('name', `Noodle ${code8()}`).field('canteenId', canteen.canteenId).field('email', 'owner@shop.test')
        .field('contactName', 'Som').field('contactSurname', 'Chai').field('contactTel', '0812345678').field('contactEmail', 'owner@shop.test')
        .field('categories', 'Noodle').field('bankAccount', 'SCB').field('accountNumber', '0812345678').field('accountName', 'Som Chai')
        .attach('paymentQr', qr, { filename: 'qr.png', contentType: 'image/png' });
      if (reg.status >= 300) throw new Error(`register ${reg.status} ${JSON.stringify(reg.body)}`);
      const restaurantId: string = reg.body.result?.restaurantId ?? (await t.prisma.restaurant.findFirstOrThrow({ where: { canteenId: canteen.canteenId } })).restaurantId;
      expect((await t.prisma.restaurant.findUniqueOrThrow({ where: { restaurantId } })).status).toBe('PENDING');
      expect((await t.prisma.restaurantMembership.findUniqueOrThrow({ where: { userId_restaurantId: { userId: applicant.userId, restaurantId } } })).role).toBe('OWNER');

      const menu = await makeMenu(t.prisma, restaurantId);
      // students cannot see or order from a shop nobody has approved
      expect((await api().get(`/api/restaurant/${restaurantId}`).set(authHeader(w.student.userId))).status).toBe(404);
      const early = await api().post('/api/order/create').set(authHeader(w.student.userId)).send(orderBody(restaurantId, menu.menuId));
      expect(early.status).toBeGreaterThanOrEqual(400);
      expect(await t.prisma.order.count({ where: { restaurantId } })).toBe(0);

      // a student cannot approve it; the school's admin can
      const byStudent = await api().patch(`/api/schools/${w.school.schoolId}/restaurants/${restaurantId}/status`).set(authHeader(w.student.userId)).send({ status: 'ACTIVE' });
      expect([403, 404]).toContain(byStudent.status);
      await api().patch(`/api/schools/${w.school.schoolId}/restaurants/${restaurantId}/status`).set(authHeader(w.admin.userId)).send({ status: 'ACTIVE' }).expect(200);

      await api().get(`/api/restaurant/${restaurantId}`).set(authHeader(w.student.userId)).expect(200);
      await api().post('/api/order/create').set(authHeader(w.student.userId)).send(orderBody(restaurantId, menu.menuId)).expect(201);

      // suspension stops new orders again, and leaves a trail
      await api().patch(`/api/schools/${w.school.schoolId}/restaurants/${restaurantId}/status`).set(authHeader(w.admin.userId)).send({ status: 'SUSPENDED' }).expect(200);
      const blocked = await api().post('/api/order/create').set(authHeader(w.student.userId)).send(orderBody(restaurantId, menu.menuId));
      expect(blocked.status).toBe(400);
      expect(await t.prisma.auditLog.count({ where: { schoolId: w.school.schoolId, entityId: restaurantId } })).toBeGreaterThanOrEqual(1);
    });

    it('should refuse an illegal status jump (REMOVED shop cannot be re-activated)', async () => {
      const w = await makeWorld(t.prisma);
      await api().patch(`/api/schools/${w.school.schoolId}/restaurants/${w.restaurant.restaurantId}/status`).set(authHeader(w.admin.userId)).send({ status: 'REMOVED' }).expect(200);
      const res = await api().patch(`/api/schools/${w.school.schoolId}/restaurants/${w.restaurant.restaurantId}/status`).set(authHeader(w.admin.userId)).send({ status: 'ACTIVE' });
      expect(res.status).toBe(409);
    });
  });

  describe('menu management by the owner', () => {
    const create = (ownerId: string, restaurantId: string, body: object) =>
      api().post('/api/menu/single').set(authHeader(ownerId)).send({ restaurantId, ...body });

    it('should create, list, reprice and toggle a dish; old orders keep the price they were placed at', async () => {
      const w = await makeWorld(t.prisma);
      const made = await create(w.owner.userId, w.restaurant.restaurantId, { name: `Pad Kra Pao ${code8()}`, price: 50 }).expect(201);
      const menuId: string = made.body.result?.menuId ?? made.body.menuId;
      expect(menuId).toBeDefined();
      const o1 = await api().post('/api/order/create').set(authHeader(w.student.userId)).send(orderBody(w.restaurant.restaurantId, menuId)).expect(201);
      expect(o1.body.totalAmount).toBe(50);

      await api().patch(`/api/menu/single/${menuId}`).set(authHeader(w.owner.userId)).send({ restaurantId: w.restaurant.restaurantId, price: '70' }).expect(200);
      const o2 = await api().post('/api/order/create').set(authHeader(w.student.userId)).send(orderBody(w.restaurant.restaurantId, menuId)).expect(201);
      expect(o2.body.totalAmount).toBe(70);
      expect((await t.prisma.order.findUniqueOrThrow({ where: { orderId: o1.body.orderId } })).totalAmount).toBe(50);

      await api().patch(`/api/menu/is-available/${menuId}`).set(authHeader(w.owner.userId)).send({ restaurantId: w.restaurant.restaurantId, isAvailable: false }).expect(200);
      await api().post('/api/order/create').set(authHeader(w.student.userId)).send(orderBody(w.restaurant.restaurantId, menuId)).expect(400);
    });

    it.each([
      ['negative price', { name: 'X1', price: -5 }],
      ['zero price', { name: 'X2', price: 0 }],
      ['fractional price', { name: 'X3', price: 10.5 }],
      ['empty name', { name: '   ', price: 10 }],
      ['name over 100 chars', { name: 'n'.repeat(101), price: 10 }],
      ['unknown field', { name: 'X4', price: 10, isFree: true }],
    ])('should reject %s with 400', async (_label, body) => {
      const w = await makeWorld(t.prisma);
      const res = await create(w.owner.userId, w.restaurant.restaurantId, body);
      expect(res.status).toBe(400);
    });

    it('should reject a duplicate dish name within the shop', async () => {
      const w = await makeWorld(t.prisma);
      const name = `Dup ${code8()}`;
      await create(w.owner.userId, w.restaurant.restaurantId, { name, price: 40 }).expect(201);
      const again = await create(w.owner.userId, w.restaurant.restaurantId, { name, price: 45 });
      expect([400, 409]).toContain(again.status);
    });

    it('should delete a never-ordered dish outright and archive an ordered one (old orders stay intact)', async () => {
      const w = await makeWorld(t.prisma);
      const fresh = await makeMenu(t.prisma, w.restaurant.restaurantId);
      await api().delete(`/api/menu/${fresh.menuId}`).set(authHeader(w.owner.userId)).expect(200);
      expect(await t.prisma.menu.count({ where: { menuId: fresh.menuId } })).toBe(0);

      const ordered = await api().post('/api/order/create').set(authHeader(w.student.userId)).send(orderBody(w.restaurant.restaurantId, w.menu.menuId)).expect(201);
      await api().delete(`/api/menu/${w.menu.menuId}`).set(authHeader(w.owner.userId)).expect(200);
      const archived = await t.prisma.menu.findUniqueOrThrow({ where: { menuId: w.menu.menuId } });
      expect(archived.deletedAt).not.toBeNull();
      expect(archived.isAvailable).toBe(false);
      expect((await t.prisma.order.findUniqueOrThrow({ where: { orderId: ordered.body.orderId }, include: { orderMenus: true } })).orderMenus).toHaveLength(1);
      const list = await api().get(`/api/menu/${w.restaurant.restaurantId}`).set(authHeader(w.student.userId)).expect(200);
      expect(JSON.stringify(list.body)).not.toContain(w.menu.menuId);
      // and the name is free to be re-used
      await create(w.owner.userId, w.restaurant.restaurantId, { name: w.menu.name, price: 55 }).expect(201);
    });

    it("should not let one shop's owner touch another shop's menu", async () => {
      const a = await makeWorld(t.prisma);
      const b = await makeWorld(t.prisma);
      const res = await api().patch(`/api/menu/single/${b.menu.menuId}`).set(authHeader(a.owner.userId)).send({ restaurantId: b.restaurant.restaurantId, price: '1' });
      expect([403, 404]).toContain(res.status);
      expect((await t.prisma.menu.findUniqueOrThrow({ where: { menuId: b.menu.menuId } })).price).toBe(b.menu.price);
    });
  });

  describe('shop settings', () => {
    it('should let a cook pause the shop (orders blocked) and resume it (orders flow again)', async () => {
      const w = await makeWorld(t.prisma);
      const cookRow = await makeUser(t.prisma, { schoolId: w.school.schoolId });
      await t.prisma.restaurantMembership.create({ data: { userId: cookRow.userId, restaurantId: w.restaurant.restaurantId, role: 'STAFF', status: 'APPROVED' } });
      await api().patch(`/api/restaurant/temporarily-close/${w.restaurant.restaurantId}`).set(authHeader(cookRow.userId)).send({ isTemporarilyClosed: true }).expect(200);
      const blocked = await api().post('/api/order/create').set(authHeader(w.student.userId)).send(orderBody(w.restaurant.restaurantId, w.menu.menuId));
      expect(blocked.status).toBe(400);
      await api().patch(`/api/restaurant/temporarily-close/${w.restaurant.restaurantId}`).set(authHeader(cookRow.userId)).send({ isTemporarilyClosed: false }).expect(200);
      await api().post('/api/order/create').set(authHeader(w.student.userId)).send(orderBody(w.restaurant.restaurantId, w.menu.menuId)).expect(201);
    });

    it('should auto-accept new orders when the owner turns it on', async () => {
      const w = await makeWorld(t.prisma, { autoAccept: false });
      const manual = await api().post('/api/order/create').set(authHeader(w.student.userId)).send(orderBody(w.restaurant.restaurantId, w.menu.menuId)).expect(201);
      expect(manual.body.acceptAt).toBeNull();
      await api().patch(`/api/restaurant/auto-accepted/${w.restaurant.restaurantId}`).set(authHeader(w.owner.userId)).send({ isAutoAcceptedOrder: true }).expect(200);
      const auto = await api().post('/api/order/create').set(authHeader(w.student.userId)).send(orderBody(w.restaurant.restaurantId, w.menu.menuId)).expect(201);
      expect(auto.body.acceptAt).not.toBeNull();
    });
  });

  describe('cook queue', () => {
    it("should show a cook only their own shop's orders, new ones appearing in time order", async () => {
      const a = await makeWorld(t.prisma);
      const b = await makeWorld(t.prisma);
      await api().post('/api/order/create').set(authHeader(a.student.userId)).send(orderBody(a.restaurant.restaurantId, a.menu.menuId)).expect(201);
      await api().post('/api/order/create').set(authHeader(b.student.userId)).send(orderBody(b.restaurant.restaurantId, b.menu.menuId)).expect(201);
      const mine = await api().get(`/api/order/today/${a.restaurant.restaurantId}`).set(authHeader(a.owner.userId)).expect(200);
      const ids = (mine.body.orders as { restaurantId: string }[]).map((o) => o.restaurantId);
      expect(ids.length).toBeGreaterThanOrEqual(1);
      expect(new Set(ids)).toEqual(new Set([a.restaurant.restaurantId]));
      const cross = await api().get(`/api/order/today/${b.restaurant.restaurantId}`).set(authHeader(a.owner.userId));
      expect([403, 404]).toContain(cross.status);
    });
  });
});

describe('School dashboard shows real numbers even for a handful of orders', () => {
  let t: TestApp;
  beforeAll(async () => { t = await bootTestApp(); });
  afterAll(async () => { await t.close(); });

  it('should report 3 of 4 orders completed as 75 %, with a real accept time and no sample flag', async () => {
    const w = await makeWorld(t.prisma);
    const now = Date.now();
    const mk = (status: 'done' | 'rejected', acceptSecs: number | null) => ({
      restaurantId: w.restaurant.restaurantId, userId: w.student.userId, status, totalAmount: 40, pickupAt: new Date(now + 3_600_000),
      orderAt: new Date(now - 60_000), acceptAt: acceptSecs === null ? null : new Date(now - 60_000 + acceptSecs * 1000), paymentStatus: status === 'done' ? ('PAID' as const) : ('UNPAID' as const),
    });
    await t.prisma.order.createMany({ data: [mk('done', 20), mk('done', 30), mk('done', 100), mk('rejected', null)] });
    const res = await request(t.url).get(`/api/schools/${w.school.schoolId}/metrics/summary?range=this_week`).set(authHeader(w.admin.userId)).expect(200);
    expect(res.body.isSample).toBeUndefined();
    expect(res.body.kpis.totalOrders.value).toBe(4);
    expect(res.body.kpis.successRate.value).toBe(75);
    expect(res.body.kpis.medianAcceptSeconds.value).toBe(30);
    expect(res.body.kpis.rating.value).toBeNull(); // no feedback yet: "no data", not an invented 4.4
    expect(JSON.stringify(res.body)).not.toContain('312');
  });

  it('should show "no data" (not 100 % or invented figures) for a school with no orders', async () => {
    const w = await makeWorld(t.prisma);
    const res = await request(t.url).get(`/api/schools/${w.school.schoolId}/metrics/summary?range=this_week`).set(authHeader(w.admin.userId)).expect(200);
    expect(res.body.kpis.totalOrders.value).toBe(0);
    expect(res.body.kpis.successRate.value).toBeNull();
    expect(res.body.kpis.medianAcceptSeconds.value).toBeNull();
  });
});
