import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RefundService } from './refund.service';
import { CreateRefundRequestDto, ListRefundsQueryDto } from './dto/refund.dto';
import {
  RestaurantRefundController,
  SchoolRefundController,
  StudentRefundController,
} from './refund.controller';
import {
  RESTAURANT_SCOPE_KEY,
  SCHOOL_SCOPE_KEY,
} from '../access/access.constants';

const HOUR = 3_600_000;
const order = (over: any = {}) => ({
  orderId: 'o1234567-aaaa',
  userId: 'u1',
  status: 'receive',
  paymentStatus: 'PAID',
  totalAmount: 120,
  pickupAt: new Date(),
  restaurantId: 'r1',
  restaurant: {
    restaurantId: 'r1',
    name: 'Noodles',
    canteen: { schoolId: 's1' },
  },
  ...over,
});

const make = () => {
  const prisma: any = {
    order: {
      findUnique: jest.fn().mockResolvedValue(order()),
      update: jest.fn().mockResolvedValue({}),
    },
    refundRequest: {
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn().mockResolvedValue({ id: 'f1', orderId: 'o1' }),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(async ({ data }) => ({
        id: 'f1',
        createdAt: new Date(),
        updatedAt: new Date(),
        ...data,
      })),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      groupBy: jest.fn().mockResolvedValue([]),
    },
    schoolMembership: {
      findMany: jest.fn().mockResolvedValue([{ userId: 'adm1' }]),
    },
    restaurantMembership: {
      findMany: jest.fn().mockResolvedValue([{ userId: 'own1' }]),
    },
  };
  prisma.$transaction = jest.fn(async (cb: any) => cb(prisma));
  const audit: any = { record: jest.fn().mockResolvedValue(undefined) };
  const notifications: any = {
    sendToUsers: jest.fn().mockResolvedValue(undefined),
  };
  return {
    prisma,
    audit,
    notifications,
    svc: new RefundService(prisma, audit, notifications),
  };
};

describe('RefundService.create (student)', () => {
  it('files a PENDING request for the order amount and notifies shop managers and school admins', async () => {
    const { svc, prisma, notifications } = make();
    const res = await svc.create('u1', 'o1', {
      reason: 'WRONG_ORDER' as any,
      details: ' no noodles ',
    });
    const data = prisma.refundRequest.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      userId: 'u1',
      restaurantId: 'r1',
      schoolId: 's1',
      amount: 120,
      status: 'PENDING',
      details: 'no noodles',
      activeOrderId: 'o1',
    });
    expect(res.status).toBe('PENDING');
    await new Promise((r) => setImmediate(r));
    expect(notifications.sendToUsers).toHaveBeenCalledWith(
      ['own1'],
      expect.objectContaining({ path: '/cooker/refunds/r1' }),
    );
    expect(prisma.restaurantMembership.findMany.mock.calls[0][0].where).toEqual(
      {
        restaurantId: 'r1',
        role: { in: ['OWNER', 'ADMIN'] },
        status: 'APPROVED',
      },
    );
    expect(notifications.sendToUsers).toHaveBeenCalledWith(
      ['adm1'],
      expect.objectContaining({
        title: 'มีคำขอคืนเงินใหม่ (ร้านเป็นผู้ดำเนินการ)',
      }),
    );
  });

  it("404 for another user's order or a missing order (no leak)", async () => {
    const { svc, prisma } = make();
    prisma.order.findUnique.mockResolvedValue(
      order({ userId: 'someone-else' }),
    );
    await expect(
      svc.create('u1', 'o1', { reason: 'OTHER' as any }),
    ).rejects.toBeInstanceOf(NotFoundException);
    prisma.order.findUnique.mockResolvedValue(null);
    await expect(
      svc.create('u1', 'o1', { reason: 'OTHER' as any }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.refundRequest.create).not.toHaveBeenCalled();
  });

  it('400 ORDER_NOT_PAID for unpaid / already refunded orders', async () => {
    for (const paymentStatus of [
      'UNPAID',
      'PENDING_VERIFICATION',
      'REFUNDED',
      'FAILED',
    ]) {
      const { svc, prisma } = make();
      prisma.order.findUnique.mockResolvedValue(order({ paymentStatus }));
      const err: any = await svc
        .create('u1', 'o1', { reason: 'OTHER' as any })
        .catch((e) => e);
      expect(err).toBeInstanceOf(BadRequestException);
      expect(err.getResponse().code).toBe('ORDER_NOT_PAID');
    }
  });

  it('400 REFUND_WINDOW_EXPIRED when done more than 24h ago, ok within 24h', async () => {
    const old = make();
    old.prisma.order.findUnique.mockResolvedValue(
      order({ status: 'done', pickupAt: new Date(Date.now() - 25 * HOUR) }),
    );
    const err: any = await old.svc
      .create('u1', 'o1', { reason: 'QUALITY' as any })
      .catch((e) => e);
    expect(err.getResponse().code).toBe('REFUND_WINDOW_EXPIRED');

    const recent = make();
    recent.prisma.order.findUnique.mockResolvedValue(
      order({ status: 'done', pickupAt: new Date(Date.now() - 23 * HOUR) }),
    );
    await expect(
      recent.svc.create('u1', 'o1', { reason: 'QUALITY' as any }),
    ).resolves.toBeDefined();
  });

  it('409 when a non-rejected request already exists (also on the unique-index race)', async () => {
    const a = make();
    a.prisma.refundRequest.findFirst.mockResolvedValue({ id: 'old' });
    const err: any = await a.svc
      .create('u1', 'o1', { reason: 'OTHER' as any })
      .catch((e) => e);
    expect(err).toBeInstanceOf(ConflictException);
    expect(err.getResponse().code).toBe('REFUND_ALREADY_REQUESTED');
    expect(a.prisma.refundRequest.findFirst.mock.calls[0][0].where).toEqual({
      orderId: 'o1',
      status: { not: 'REJECTED' },
    });

    const b = make();
    b.prisma.refundRequest.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('dup', {
        code: 'P2002',
        clientVersion: 'x',
      }),
    );
    await expect(
      b.svc.create('u1', 'o1', { reason: 'OTHER' as any }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('a failing notification never blocks the request', async () => {
    const { svc, notifications, prisma } = make();
    notifications.sendToUsers.mockRejectedValue(new Error('fcm down'));
    prisma.schoolMembership.findMany.mockRejectedValue(new Error('db'));
    prisma.restaurantMembership.findMany.mockRejectedValue(new Error('db'));
    await expect(
      svc.create('u1', 'o1', { reason: 'OTHER' as any }),
    ).resolves.toBeDefined();
  });
});

describe('RefundService student reads', () => {
  it("only the caller's requests; 404 for others", async () => {
    const { svc, prisma } = make();
    await svc.listMine('u1');
    expect(prisma.refundRequest.findMany.mock.calls[0][0].where).toEqual({
      userId: 'u1',
    });
    prisma.refundRequest.findFirst.mockResolvedValue(null);
    await expect(svc.getMine('u1', 'f9')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.refundRequest.findFirst.mock.calls[0][0].where).toEqual({
      id: 'f9',
      userId: 'u1',
    });
  });
});

describe('RefundService school admin (read-only)', () => {
  it('lists strictly within the school, oldest pending first, cursor paginated', async () => {
    const { svc, prisma } = make();
    const rows = [1, 2, 3].map((i) => ({
      id: `f${i}`,
      orderId: 'abcd-1',
      createdAt: new Date(),
      updatedAt: new Date(),
      user: { userId: 'u', name: 'N' },
      restaurant: { restaurantId: 'r', name: 'R' },
    }));
    prisma.refundRequest.findMany.mockResolvedValue(rows);
    const res: any = await svc.listForSchool('s1', {
      status: 'PENDING' as any,
      limit: 2,
      cursor: 'c0',
    });
    const args = prisma.refundRequest.findMany.mock.calls[0][0];
    expect(args.where).toEqual({ schoolId: 's1', status: 'PENDING' });
    expect(args.orderBy[0]).toEqual({ createdAt: 'asc' });
    expect(args.cursor).toEqual({ id: 'c0' });
    expect(res.items).toHaveLength(2);
    expect(res.nextCursor).toBe('f2');
    expect(res.items[0].student).toEqual({ userId: 'u', name: 'N' });
  });

  it('summary counts per status and oldest pending age', async () => {
    const { svc, prisma } = make();
    prisma.refundRequest.groupBy.mockResolvedValue([
      { status: 'PENDING', _count: { _all: 3 } },
      { status: 'REFUNDED', _count: { _all: 1 } },
    ]);
    prisma.refundRequest.findFirst.mockResolvedValue({
      createdAt: new Date(Date.now() - 90 * 60_000),
    });
    const res = await svc.summary('s1');
    expect(res.counts).toEqual({
      PENDING: 3,
      APPROVED: 0,
      REJECTED: 0,
      REFUNDED: 1,
    });
    expect(res.oldestPendingAgeMinutes).toBeGreaterThanOrEqual(89);
    expect(prisma.refundRequest.groupBy.mock.calls[0][0].where).toEqual({
      schoolId: 's1',
    });
  });

  it('detail of a refund from another school is 404', async () => {
    const { svc, prisma } = make();
    prisma.refundRequest.findFirst.mockResolvedValue(null);
    await expect(svc.getForSchool('s1', 'f-other')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.refundRequest.findFirst.mock.calls[0][0].where).toEqual({
      id: 'f-other',
      schoolId: 's1',
    });
  });
});

describe('RefundService shop decides', () => {
  const ownerReq: any = { user: { userId: 'own1' } };
  const existing = (status = 'PENDING') => ({
    id: 'f1',
    orderId: 'o1',
    userId: 'u1',
    schoolId: 's1',
    status,
    restaurant: { name: 'Noodles' },
  });
  const withExisting = (status?: string) => {
    const m = make();
    m.prisma.refundRequest.findFirst.mockResolvedValue(existing(status));
    return m;
  };

  it('approve: PENDING -> APPROVED, audited as RESTAURANT, student notified', async () => {
    const { svc, prisma, audit, notifications } = withExisting();
    await svc.decide(ownerReq, 'r1', 'f1', { action: 'approve', note: 'ok' });
    const call = prisma.refundRequest.updateMany.mock.calls[0][0];
    expect(call.where).toEqual({
      id: 'f1',
      restaurantId: 'r1',
      status: 'PENDING',
    });
    expect(call.data).toMatchObject({
      status: 'APPROVED',
      decidedById: 'own1',
      decisionNote: 'ok',
    });
    expect(call.data.decidedAt).toBeInstanceOf(Date);
    expect(prisma.order.update).not.toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'REFUND_APPROVE',
        actorRole: 'RESTAURANT',
        schoolId: 's1',
        entityType: 'REFUND_REQUEST',
        entityId: 'f1',
        meta: {
          orderId: 'o1',
          restaurantId: 'r1',
          from: 'PENDING',
          to: 'APPROVED',
        },
      }),
    );
    expect(notifications.sendToUsers).toHaveBeenCalledWith(
      ['u1'],
      expect.any(Object),
    );
  });

  it('reject requires a note and frees the one-open-request slot', async () => {
    const a = withExisting();
    await expect(
      a.svc.decide(ownerReq, 'r1', 'f1', { action: 'reject' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      a.svc.decide(ownerReq, 'r1', 'f1', { action: 'reject', note: ' ' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(a.prisma.refundRequest.updateMany).not.toHaveBeenCalled();

    const b = withExisting();
    await b.svc.decide(ownerReq, 'r1', 'f1', {
      action: 'reject',
      note: 'photo shows full order',
    });
    expect(
      b.prisma.refundRequest.updateMany.mock.calls[0][0].data,
    ).toMatchObject({
      status: 'REJECTED',
      activeOrderId: null,
      decisionNote: 'photo shows full order',
    });
  });

  it('mark_refunded: APPROVED -> REFUNDED and Order.paymentStatus REFUNDED, in one transaction', async () => {
    const { svc, prisma, audit } = withExisting('APPROVED');
    await svc.decide(ownerReq, 'r1', 'f1', { action: 'mark_refunded' });
    const call = prisma.refundRequest.updateMany.mock.calls[0][0];
    expect(call.where.status).toBe('APPROVED');
    expect(call.data.status).toBe('REFUNDED');
    expect(call.data.refundedAt).toBeInstanceOf(Date);
    expect(prisma.order.update).toHaveBeenCalledWith({
      where: { orderId: 'o1' },
      data: { paymentStatus: 'REFUNDED' },
    });
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(audit.record.mock.calls[0][0].action).toBe('REFUND_MARK_REFUNDED');
  });

  it('invalid transition (lost compare-and-set) -> 409 INVALID_TRANSITION and no order update', async () => {
    const { svc, prisma, audit } = withExisting('REFUNDED');
    prisma.refundRequest.updateMany.mockResolvedValue({ count: 0 });
    const err: any = await svc
      .decide(ownerReq, 'r1', 'f1', { action: 'mark_refunded' })
      .catch((e) => e);
    expect(err).toBeInstanceOf(ConflictException);
    expect(err.getResponse().code).toBe('INVALID_TRANSITION');
    expect(prisma.order.update).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('decide on a refund of another restaurant -> 404 before touching anything', async () => {
    const { svc, prisma } = make();
    await expect(
      svc.decide(ownerReq, 'r1', 'f-other', { action: 'approve' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.refundRequest.findFirst.mock.calls[0][0].where).toEqual({
      id: 'f-other',
      restaurantId: 'r1',
    });
    expect(prisma.refundRequest.updateMany).not.toHaveBeenCalled();
  });

  it('a sysadmin acting with a grant is audited as SYSADMIN with the grant id', async () => {
    const { svc, audit } = withExisting();
    const req: any = {
      user: { userId: 'sys' },
      sysadminAudit: { schoolId: 's1', grantId: 'g1' },
    };
    await svc.decide(req, 'r1', 'f1', { action: 'approve' });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ actorRole: 'SYSADMIN', req }),
    );
  });
});

describe('RefundService shop view', () => {
  it('each listed request carries the order and its items', async () => {
    const { svc, prisma } = make();
    prisma.refundRequest.findMany.mockResolvedValue([
      {
        id: 'f1',
        orderId: 'abcd-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        user: { userId: 'u', name: 'N' },
        restaurant: { restaurantId: 'r1', name: 'R' },
        order: {
          orderId: 'abcd-1',
          status: 'done',
          totalAmount: 80,
          orderMenus: [
            {
              menuName: 'Pad kra pao',
              quantity: 2,
              unitPrice: 40,
              totalPrice: 80,
            },
          ],
        },
      },
    ]);
    const res: any = await svc.listForRestaurant('r1', {});
    expect(
      prisma.refundRequest.findMany.mock.calls[0][0].include.order.select
        .orderMenus,
    ).toBeDefined();
    expect(res.items[0].order).toEqual({
      orderId: 'abcd-1',
      status: 'done',
      totalAmount: 80,
      items: [
        { menuName: 'Pad kra pao', quantity: 2, unitPrice: 40, totalPrice: 80 },
      ],
    });
  });

  it("lists only that restaurant's requests", async () => {
    const { svc, prisma } = make();
    await svc.listForRestaurant('r1', { status: 'APPROVED' as any });
    expect(prisma.refundRequest.findMany.mock.calls[0][0].where).toEqual({
      restaurantId: 'r1',
      status: 'APPROVED',
    });
  });
});

describe('Refund DTOs and route guards', () => {
  it('create DTO validates the reason enum', async () => {
    expect(
      await validate(
        plainToInstance(CreateRefundRequestDto, { reason: 'QUALITY' }),
      ),
    ).toHaveLength(0);
    expect(
      (
        await validate(
          plainToInstance(CreateRefundRequestDto, { reason: 'BORED' }),
        )
      ).length,
    ).toBeGreaterThan(0);
    expect(
      (await validate(plainToInstance(ListRefundsQueryDto, { status: 'NOPE' })))
        .length,
    ).toBeGreaterThan(0);
  });

  it('school routes are read-only behind @SchoolScope; only shop OWNER/ADMIN may decide', () => {
    const p = SchoolRefundController.prototype as any;
    for (const n of ['list', 'summary', 'get'])
      expect(Reflect.getMetadata(SCHOOL_SCOPE_KEY, p[n])).toBe('schoolId');
    expect(
      Object.getOwnPropertyNames(SchoolRefundController.prototype),
    ).toEqual(['constructor', 'list', 'summary', 'get']);

    const shop = RestaurantRefundController.prototype as any;
    const read = Reflect.getMetadata(RESTAURANT_SCOPE_KEY, shop.list);
    expect([...read.roles].sort()).toEqual(['ADMIN', 'OWNER', 'STAFF']);
    const write = Reflect.getMetadata(RESTAURANT_SCOPE_KEY, shop.decide);
    expect([...write.roles].sort()).toEqual(['ADMIN', 'OWNER']);
    expect(write.allowSchoolAdmin).toBe(false);
    expect(
      Object.getOwnPropertyNames(RestaurantRefundController.prototype),
    ).toEqual(['constructor', 'list', 'decide']);
    expect(
      Object.getOwnPropertyNames(StudentRefundController.prototype),
    ).toEqual(expect.arrayContaining(['create', 'listMine', 'getMine']));
  });
});
