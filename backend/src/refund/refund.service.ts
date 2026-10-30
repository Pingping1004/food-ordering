import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  MembershipStatus,
  PaymentStatus,
  Prisma,
  RefundStatus,
  RestaurantRole,
  SchoolRole,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../access/audit.service';
import { NotificationService } from '../notification/notification.service';
import {
  REFUND_DEFAULT_LIMIT,
  REFUND_MAX_LIMIT,
  REFUND_WINDOW_HOURS,
} from './refund.constants';
import {
  CreateRefundRequestDto,
  DecideRefundDto,
  ListRefundsQueryDto,
} from './dto/refund.dto';

const orderCode = (orderId: string) =>
  orderId.replace(/-/g, '').slice(0, 4).toUpperCase();

const itemSelect = {
  menuName: true,
  quantity: true,
  unitPrice: true,
  totalPrice: true,
} as const;

const REASON_LABEL: Record<string, string> = {
  APPROVE: 'อนุมัติแล้ว',
  REJECT: 'ปฏิเสธ',
  MARK_REFUNDED: 'โอนคืนเงินแล้ว',
};

@Injectable()
export class RefundService {
  private readonly logger = new Logger('RefundService');

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationService,
  ) {}

  // ------------------------------------------------------------------ mapping

  private base(r: any) {
    return {
      id: r.id,
      orderId: r.orderId,
      reason: r.reason,
      details: r.details ?? null,
      amount: r.amount,
      status: r.status,
      decisionNote: r.decisionNote ?? null,
      decidedAt: r.decidedAt ?? null,
      refundedAt: r.refundedAt ?? null,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      restaurant: r.restaurant
        ? { restaurantId: r.restaurant.restaurantId, name: r.restaurant.name }
        : null,
    };
  }

  private listItem(r: any) {
    return {
      ...this.base(r),
      orderCode: orderCode(r.orderId),
      student: r.user ? { userId: r.user.userId, name: r.user.name } : null,
    };
  }

  private page(rows: any[], limit: number, mapper: (r: any) => unknown) {
    const items = rows.slice(0, limit);
    return {
      items: items.map(mapper),
      nextCursor: rows.length > limit ? items[items.length - 1].id : null,
    };
  }

  private limitOf(limit?: number) {
    return Math.min(
      Math.max(
        Math.trunc(limit ?? REFUND_DEFAULT_LIMIT) || REFUND_DEFAULT_LIMIT,
        1,
      ),
      REFUND_MAX_LIMIT,
    );
  }

  private readonly include = {
    restaurant: { select: { restaurantId: true, name: true } },
    user: { select: { userId: true, name: true } },
  } as const;

  // ------------------------------------------------------------------ student

  async create(userId: string, orderId: string, dto: CreateRefundRequestDto) {
    const order = await this.prisma.order.findUnique({
      where: { orderId },
      select: {
        orderId: true,
        userId: true,
        status: true,
        paymentStatus: true,
        totalAmount: true,
        pickupAt: true,
        restaurantId: true,
        restaurant: {
          select: {
            restaurantId: true,
            name: true,
            canteen: { select: { schoolId: true } },
          },
        },
      },
    });
    if (!order || order.userId !== userId)
      throw new NotFoundException('ไม่พบข้อมูล');

    const open = await this.prisma.refundRequest.findFirst({
      where: { orderId, status: { not: RefundStatus.REJECTED } },
      select: { id: true },
    });
    if (open) throw this.alreadyRequested();

    if (order.paymentStatus !== PaymentStatus.PAID)
      throw new BadRequestException({
        message: 'ออเดอร์นี้ยังไม่ได้ชำระเงิน จึงขอคืนเงินไม่ได้',
        code: 'ORDER_NOT_PAID',
      });
    if (
      order.status === 'done' &&
      Date.now() - order.pickupAt.getTime() > REFUND_WINDOW_HOURS * 3_600_000
    )
      throw new BadRequestException({
        message: `ขอคืนเงินได้ภายใน ${REFUND_WINDOW_HOURS} ชั่วโมงหลังรับอาหาร`,
        code: 'REFUND_WINDOW_EXPIRED',
      });

    const schoolId = order.restaurant.canteen.schoolId;
    let created;
    try {
      created = await this.prisma.refundRequest.create({
        data: {
          orderId,
          userId,
          restaurantId: order.restaurantId,
          schoolId,
          reason: dto.reason,
          details: dto.details?.trim() || null,
          amount: order.totalAmount,
          status: RefundStatus.PENDING,
          activeOrderId: orderId,
        },
        include: this.include,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )
        throw this.alreadyRequested();
      throw error;
    }

    void this.notifyShopManagers(
      order.restaurantId,
      order.restaurant.name,
      orderId,
    );
    void this.notifySchoolAdmins(schoolId, order.restaurant.name, orderId);
    return this.base(created);
  }

  private alreadyRequested() {
    return new ConflictException({
      message: 'ออเดอร์นี้มีคำขอคืนเงินอยู่แล้ว',
      code: 'REFUND_ALREADY_REQUESTED',
    });
  }

  async listMine(userId: string) {
    const rows = await this.prisma.refundRequest.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: this.include,
    });
    return { items: rows.map((r) => this.base(r)) };
  }

  async getMine(userId: string, id: string) {
    const r = await this.prisma.refundRequest.findFirst({
      where: { id, userId },
      include: {
        ...this.include,
        order: {
          select: {
            orderId: true,
            status: true,
            paymentStatus: true,
            totalAmount: true,
            orderAt: true,
            orderMenus: { select: itemSelect },
          },
        },
      },
    });
    if (!r) throw new NotFoundException('ไม่พบข้อมูล');
    const { orderMenus, ...order } = r.order;
    return { ...this.base(r), order: { ...order, items: orderMenus } };
  }

  // ------------------------------------------------------------------ school admin (read-only)

  async listForSchool(schoolId: string, q: ListRefundsQueryDto) {
    const limit = this.limitOf(q.limit);
    const rows = await this.prisma.refundRequest.findMany({
      where: { schoolId, ...(q.status ? { status: q.status } : {}) },
      orderBy: [
        { createdAt: q.status === RefundStatus.PENDING ? 'asc' : 'desc' },
        { id: 'asc' },
      ],
      take: limit + 1,
      ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
      include: this.include,
    });
    return this.page(rows, limit, (r) => this.listItem(r));
  }

  async summary(schoolId: string) {
    const [groups, oldest] = await Promise.all([
      this.prisma.refundRequest.groupBy({
        by: ['status'],
        where: { schoolId },
        _count: { _all: true },
      }),
      this.prisma.refundRequest.findFirst({
        where: { schoolId, status: RefundStatus.PENDING },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
      }),
    ]);
    const counts: Record<RefundStatus, number> = {
      PENDING: 0,
      APPROVED: 0,
      REJECTED: 0,
      REFUNDED: 0,
    };
    for (const g of groups) counts[g.status] = g._count._all;
    return {
      counts,
      oldestPendingAt: oldest?.createdAt ?? null,
      oldestPendingAgeMinutes: oldest
        ? Math.floor((Date.now() - oldest.createdAt.getTime()) / 60_000)
        : null,
    };
  }

  async getForSchool(schoolId: string, id: string) {
    const r = await this.prisma.refundRequest.findFirst({
      where: { id, schoolId },
      include: {
        ...this.include,
        decidedBy: { select: { userId: true, name: true } },
        order: {
          select: {
            orderId: true,
            status: true,
            paymentStatus: true,
            totalAmount: true,
            orderAt: true,
            pickupAt: true,
            paidAt: true,
            orderMenus: { select: itemSelect },
          },
        },
      },
    });
    if (!r) throw new NotFoundException('ไม่พบข้อมูล');
    const { orderMenus, ...order } = r.order;
    return {
      ...this.listItem(r),
      order: { ...order, items: orderMenus },
      payment: {
        paymentStatus: order.paymentStatus,
        paidAt: order.paidAt,
        amount: order.totalAmount,
      },
      decidedBy: r.decidedBy
        ? { userId: r.decidedBy.userId, name: r.decidedBy.name }
        : null,
    };
  }

  /**
   * The shop (OWNER / ADMIN) decides: PENDING -> APPROVED | REJECTED, APPROVED -> REFUNDED.
   * The school only watches. Compare-and-set so two managers cannot both win.
   */
  async decide(
    req: any,
    restaurantId: string,
    id: string,
    dto: DecideRefundDto,
  ) {
    const note = dto.note?.trim() || undefined;
    if (dto.action === 'reject' && (!note || note.length < 3))
      throw new BadRequestException('กรุณาระบุเหตุผลในการปฏิเสธ');

    const existing = await this.prisma.refundRequest.findFirst({
      where: { id, restaurantId },
      select: {
        id: true,
        orderId: true,
        userId: true,
        schoolId: true,
        status: true,
        restaurant: { select: { name: true } },
      },
    });
    if (!existing) throw new NotFoundException('ไม่พบข้อมูล');

    const plan = {
      approve: { from: RefundStatus.PENDING, to: RefundStatus.APPROVED },
      reject: { from: RefundStatus.PENDING, to: RefundStatus.REJECTED },
      mark_refunded: { from: RefundStatus.APPROVED, to: RefundStatus.REFUNDED },
    }[dto.action];

    const now = new Date();
    const actorId: string = req.user.userId;
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.refundRequest.updateMany({
        where: { id, restaurantId, status: plan.from },
        data: {
          status: plan.to,
          decidedById: actorId,
          ...(note !== undefined ? { decisionNote: note } : {}),
          ...(dto.action === 'mark_refunded'
            ? { refundedAt: now }
            : { decidedAt: now }),
          // Releases the "one open request per order" slot so the student may re-file.
          ...(dto.action === 'reject' ? { activeOrderId: null } : {}),
        },
      });
      if (count === 0)
        throw new ConflictException({
          message: 'สถานะคำขอไม่รองรับการดำเนินการนี้',
          code: 'INVALID_TRANSITION',
        });
      if (dto.action === 'mark_refunded')
        await tx.order.update({
          where: { orderId: existing.orderId },
          data: { paymentStatus: PaymentStatus.REFUNDED },
        });
    });

    await this.audit.record({
      req,
      actorRole: req.sysadminAudit ? 'SYSADMIN' : 'RESTAURANT',
      schoolId: existing.schoolId,
      action: `REFUND_${dto.action.toUpperCase()}`,
      entityType: 'REFUND_REQUEST',
      entityId: id,
      reason: note ?? null,
      meta: {
        orderId: existing.orderId,
        restaurantId,
        from: plan.from,
        to: plan.to,
      },
    });

    if (existing.userId)
      void this.notifications.sendToUsers([existing.userId], {
        title: `คำขอคืนเงิน${REASON_LABEL[dto.action.toUpperCase()] ?? ''}`,
        body: `ออเดอร์ ${orderCode(existing.orderId)} จาก ${existing.restaurant.name}`,
        path: `/user/order/refund/${existing.orderId}`,
      });

    return this.getRefundBase(id);
  }

  private async getRefundBase(id: string) {
    const r = await this.prisma.refundRequest.findUnique({
      where: { id },
      include: this.include,
    });
    return this.base(r);
  }

  // ------------------------------------------------------------------ shop

  async listForRestaurant(restaurantId: string, q: ListRefundsQueryDto) {
    const limit = this.limitOf(q.limit);
    const rows = await this.prisma.refundRequest.findMany({
      where: { restaurantId, ...(q.status ? { status: q.status } : {}) },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: limit + 1,
      ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
      include: this.include,
    });
    return this.page(rows, limit, (r) => this.listItem(r));
  }

  // ------------------------------------------------------------------ notifications (best effort)

  private async notifySchoolAdmins(
    schoolId: string,
    restaurantName: string,
    orderId: string,
  ) {
    try {
      const admins = await this.prisma.schoolMembership.findMany({
        where: {
          schoolId,
          role: SchoolRole.ADMIN,
          status: MembershipStatus.APPROVED,
        },
        select: { userId: true },
      });
      await this.notifications.sendToUsers(
        admins.map((a) => a.userId),
        {
          title: 'มีคำขอคืนเงินใหม่ (ร้านเป็นผู้ดำเนินการ)',
          body: `ออเดอร์ ${orderCode(orderId)} จาก ${restaurantName}`,
          path: `/school/${schoolId}/refunds`,
        },
      );
    } catch (error) {
      this.logger.warn(`notifySchoolAdmins failed: ${error}`);
    }
  }

  private async notifyShopManagers(
    restaurantId: string,
    restaurantName: string,
    orderId: string,
  ) {
    try {
      const managers = await this.prisma.restaurantMembership.findMany({
        where: {
          restaurantId,
          role: { in: [RestaurantRole.OWNER, RestaurantRole.ADMIN] },
          status: MembershipStatus.APPROVED,
        },
        select: { userId: true },
      });
      await this.notifications.sendToUsers(
        managers.map((m) => m.userId),
        {
          title: 'มีคำขอคืนเงินใหม่',
          body: `ออเดอร์ ${orderCode(orderId)} ที่ ${restaurantName} รอร้านพิจารณา`,
          path: `/cooker/refunds/${restaurantId}`,
        },
      );
    } catch (error) {
      this.logger.warn(`notifyShopManagers failed: ${error}`);
    }
  }
}
