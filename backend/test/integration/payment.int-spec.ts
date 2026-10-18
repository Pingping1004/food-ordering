import request from 'supertest';
import axios from 'axios';
import sharp from 'sharp';
import { randomUUID } from 'crypto';
import { authHeader, bootTestApp, TestApp } from './harness';
import { makeUser, makeWorld, orderBody } from './factories';

describe('Payment: slip verification, idempotency, no slip reuse (Slip2Go mocked; real HTTP + real Postgres)', () => {
  let t: TestApp;
  let slip: string;
  let post: jest.SpyInstance;
  beforeAll(async () => {
    t = await bootTestApp();
    const png = await sharp({ create: { width: 16, height: 16, channels: 3, background: '#0a0' } }).png().toBuffer();
    slip = `data:image/png;base64,${png.toString('base64')}`;
  });
  afterAll(async () => { await t.close(); });
  beforeEach(() => { post = jest.spyOn(axios, 'post'); });
  afterEach(() => { post.mockRestore(); });

  const api = () => request(t.url);
  const slipOk = (transRef: string, atMs?: number) => ({ data: { code: '200200', message: 'ok', data: { dateTime: new Date(atMs ?? Date.now() + 1000).toISOString(), transRef } } });
  /** Slip2Go answering at call time, like the real thing (the slip is dated after the order was placed). */
  const slipNow = (transRef: string) => async () => slipOk(transRef);
  const accepted = async (w: Awaited<ReturnType<typeof makeWorld>>, qty = 1, userId = w.student.userId) => {
    const res = await api().post('/api/order/create').set(authHeader(userId)).send(orderBody(w.restaurant.restaurantId, w.menu.menuId, qty)).expect(201);
    return res.body.orderId as string; // world shops auto-accept
  };
  const verify = (userId: string, orderId: string, key = randomUUID(), img = slip) =>
    api().post('/api/payment/verify').set(authHeader(userId)).send({ idempotencyKey: key, orderId, paymentSlipImg: img });
  const ref = () => `TX${randomUUID().replace(/-/g, '').slice(0, 14)}`;
  const state = async (orderId: string) => {
    const o = await t.prisma.order.findUniqueOrThrow({ where: { orderId } });
    return { payment: o.paymentStatus, paidAt: o.paidAt, payouts: await t.prisma.payout.findMany({ where: { orderId } }) };
  };

  beforeAll(() => { process.env.SLIP_VERIFY_SECRET = process.env.SLIP_VERIFY_SECRET || 'test'; });

  it('should mark the order PAID and record one successful payout for a valid slip', async () => {
    const w = await makeWorld(t.prisma);
    const orderId = await accepted(w, 2);
    post.mockResolvedValue(slipOk(ref()));
    const res = await verify(w.student.userId, orderId).expect(201);
    expect(res.body.success).toBe(true);
    const s = await state(orderId);
    expect(s.payment).toBe('PAID');
    expect(s.paidAt).not.toBeNull();
    expect(s.payouts).toHaveLength(1);
    expect(s.payouts[0].payoutStatus).toBe('success');
    expect(Number(s.payouts[0].grossAmount)).toBe(80);
    expect(s.payouts[0].restaurantId).toBe(w.restaurant.restaurantId);
  });

  it('should ask Slip2Go for the exact amount, a receiver check and a date lower bound', async () => {
    const w = await makeWorld(t.prisma);
    const orderId = await accepted(w, 3);
    post.mockResolvedValue(slipOk(ref()));
    await verify(w.student.userId, orderId).expect(201);
    const sent = post.mock.calls[0][1].payload.checkCondition;
    expect(sent.checkAmount).toEqual({ type: 'eq', amount: '120' });
    expect(sent.checkReceiver[0].accountNumber).toBe('0000000000');
    expect(sent.checkDate.type).toBe('gte');
  });

  describe('idempotency', () => {
    it('should return success without calling Slip2Go again when the same key is replayed', async () => {
      const w = await makeWorld(t.prisma);
      const orderId = await accepted(w);
      post.mockResolvedValue(slipOk(ref()));
      const key = randomUUID();
      await verify(w.student.userId, orderId, key).expect(201);
      const again = await verify(w.student.userId, orderId, key).expect(201);
      expect(again.body.success).toBe(true);
      expect(post).toHaveBeenCalledTimes(1);
      expect((await state(orderId)).payouts).toHaveLength(1);
    });

    it('should settle 5 simultaneous submits of one payment into exactly one payout and one verification', async () => {
      const w = await makeWorld(t.prisma);
      const orderId = await accepted(w);
      const transRef = ref();
      post.mockImplementation(async () => { await new Promise((r) => setTimeout(r, 40)); return slipOk(transRef); });
      const key = randomUUID();
      const results = await Promise.all(Array.from({ length: 5 }, () => verify(w.student.userId, orderId, key)));
      expect(results.every((r) => r.status < 500)).toBe(true);
      const s = await state(orderId);
      expect(s.payment).toBe('PAID');
      expect(s.payouts).toHaveLength(1);
      expect(post).toHaveBeenCalledTimes(1);
    });

    it('should refuse the same key with a different slip (409)', async () => {
      const w = await makeWorld(t.prisma);
      const orderId = await accepted(w);
      post.mockResolvedValue({ data: { code: '400000', message: 'bad slip' } }); // first attempt fails, key stays recorded
      const key = randomUUID();
      await verify(w.student.userId, orderId, key).expect(400);
      const other = await sharp({ create: { width: 17, height: 17, channels: 3, background: '#f00' } }).png().toBuffer();
      const res = await verify(w.student.userId, orderId, key, `data:image/png;base64,${other.toString('base64')}`);
      expect(res.status).toBe(409);
    });
  });

  describe('a slip can pay for one order only', () => {
    it('should reject the same bank reference on a second order', async () => {
      const w = await makeWorld(t.prisma);
      const a = await accepted(w);
      const b = await accepted(w);
      const transRef = ref();
      post.mockResolvedValue(slipOk(transRef));
      await verify(w.student.userId, a).expect(201);
      const second = await verify(w.student.userId, b);
      expect(second.status).toBe(409);
      expect((await state(b)).payment).toBe('UNPAID');
    });

    it('should still reject the reused slip after the API restarts (protection is in the database, not in memory)', async () => {
      const w = await makeWorld(t.prisma);
      const a = await accepted(w);
      const transRef = ref();
      post.mockImplementation(slipNow(transRef));
      await verify(w.student.userId, a).expect(201);

      const second = await bootTestApp(); // a fresh process-equivalent: new Nest app, empty in-memory state
      try {
        const b = (await request(second.url).post('/api/order/create').set(authHeader(w.student.userId)).send(orderBody(w.restaurant.restaurantId, w.menu.menuId)).expect(201)).body.orderId;
        const res = await request(second.url).post('/api/payment/verify').set(authHeader(w.student.userId)).send({ idempotencyKey: randomUUID(), orderId: b, paymentSlipImg: slip });
        expect(res.status).toBe(409);
        expect((await state(b)).payment).toBe('UNPAID');
      } finally {
        await second.close();
      }
    });

    it('should let only one of two orders win when they race with the same slip', async () => {
      const w = await makeWorld(t.prisma);
      const a = await accepted(w);
      const b = await accepted(w);
      const transRef = ref();
      post.mockImplementation(async () => { await new Promise((r) => setTimeout(r, 30)); return slipOk(transRef); });
      const [ra, rb] = await Promise.all([verify(w.student.userId, a), verify(w.student.userId, b)]);
      const paid = [(await state(a)).payment, (await state(b)).payment].filter((p) => p === 'PAID');
      expect(paid).toHaveLength(1);
      expect([ra.status, rb.status].filter((s) => s === 201)).toHaveLength(1);
      expect(await t.prisma.payout.count({ where: { transactionId: transRef } })).toBe(1);
    });
  });

  describe('failures leave the order payable', () => {
    it('should keep the order UNPAID and mark the payout failed when Slip2Go rejects the slip (wrong amount / receiver)', async () => {
      const w = await makeWorld(t.prisma);
      const orderId = await accepted(w);
      post.mockResolvedValue({ data: { code: '200404', message: 'Amount mismatch' } });
      const res = await verify(w.student.userId, orderId).expect(400);
      expect(res.body.code).toBe('200404');
      const s = await state(orderId);
      expect(s.payment).toBe('UNPAID');
      expect(s.payouts[0].payoutStatus).toBe('failed');
    });

    it('should allow a retry with a good slip after a rejected one', async () => {
      const w = await makeWorld(t.prisma);
      const orderId = await accepted(w);
      post.mockResolvedValueOnce({ data: { code: '200404', message: 'Amount mismatch' } });
      await verify(w.student.userId, orderId).expect(400);
      post.mockResolvedValueOnce(slipOk(ref()));
      await verify(w.student.userId, orderId).expect(201);
      expect((await state(orderId)).payment).toBe('PAID');
    });

    it('should fail cleanly (4xx, still payable) when the verification service is down or times out', async () => {
      const w = await makeWorld(t.prisma);
      const orderId = await accepted(w);
      post.mockRejectedValueOnce(Object.assign(new Error('timeout of 5000ms exceeded'), { code: 'ECONNABORTED' }));
      const down = await verify(w.student.userId, orderId);
      expect(down.status).toBe(400);
      expect((await state(orderId)).payment).toBe('UNPAID');
      post.mockResolvedValueOnce(slipOk(ref()));
      await verify(w.student.userId, orderId).expect(201);
    });

    it('should refuse a slip dated before the order was placed', async () => {
      const w = await makeWorld(t.prisma);
      const orderId = await accepted(w);
      post.mockResolvedValue(slipOk(ref(), Date.now() - 3 * 3_600_000));
      const res = await verify(w.student.userId, orderId);
      expect(res.status).toBe(400);
      expect((await state(orderId)).payment).toBe('UNPAID');
    });

    it('should refuse a non-image payload as the slip', async () => {
      const w = await makeWorld(t.prisma);
      const orderId = await accepted(w);
      post.mockResolvedValue(slipOk(ref()));
      const res = await verify(w.student.userId, orderId, randomUUID(), `data:image/png;base64,${Buffer.from('<html>').toString('base64')}`);
      expect(res.status).toBe(400);
      expect(post).not.toHaveBeenCalled(); // junk never reaches the paid verification API
      expect((await state(orderId)).payment).toBe('UNPAID');
      expect((await state(orderId)).payouts).toHaveLength(0);
    });
  });

  describe('who and when', () => {
    it('should not let a student pay for (or probe) someone else\'s order', async () => {
      const w = await makeWorld(t.prisma);
      const other = await makeUser(t.prisma, { schoolId: w.school.schoolId });
      const orderId = await accepted(w);
      post.mockResolvedValue(slipOk(ref()));
      const res = await verify(other.userId, orderId);
      expect([403, 404]).toContain(res.status);
      expect(post).not.toHaveBeenCalled();
      expect((await state(orderId)).payment).toBe('UNPAID');
    });

    it('should not take payment before the shop has accepted the order', async () => {
      const w = await makeWorld(t.prisma, { autoAccept: false });
      const orderId = await accepted(w);
      post.mockResolvedValue(slipOk(ref()));
      const res = await verify(w.student.userId, orderId);
      expect(res.status).toBe(400);
      expect(post).not.toHaveBeenCalled();
    });

    it('should not take payment for a cancelled order', async () => {
      const w = await makeWorld(t.prisma);
      const orderId = await accepted(w);
      await api().patch(`/api/order/cancel/${orderId}`).set(authHeader(w.student.userId)).send({}).expect(200);
      post.mockResolvedValue(slipOk(ref()));
      const res = await verify(w.student.userId, orderId);
      expect(res.status).toBe(409);
      expect(post).not.toHaveBeenCalled();
    });

    it('should treat an already-paid order as success without a second verification', async () => {
      const w = await makeWorld(t.prisma);
      const orderId = await accepted(w);
      post.mockResolvedValue(slipOk(ref()));
      await verify(w.student.userId, orderId).expect(201);
      post.mockClear();
      const again = await verify(w.student.userId, orderId);
      expect(again.body.success).toBe(true);
      expect(post).not.toHaveBeenCalled();
    });
  });

  describe('payouts are durable and scoped', () => {
    it('should list a shop\'s payments to its owner only, from the database', async () => {
      const w = await makeWorld(t.prisma);
      const orderId = await accepted(w);
      post.mockResolvedValue(slipOk(ref()));
      await verify(w.student.userId, orderId).expect(201);
      const mine = await api().get(`/api/payout/weekly?restaurantId=${w.restaurant.restaurantId}`).set(authHeader(w.owner.userId)).expect(200);
      expect(mine.body.map((p: { orderId: string }) => p.orderId)).toContain(orderId);
      const notMine = await api().get(`/api/payout/weekly?restaurantId=${w.restaurant.restaurantId}`).set(authHeader(w.student.userId));
      expect([403, 404]).toContain(notMine.status);
    });
  });
});
