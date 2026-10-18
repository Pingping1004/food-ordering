import {
  BadRequestException,
  Injectable,
  Inject,
  NotFoundException,
  Logger,
  forwardRef,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { CreateOrderDto, CreateOrderMenusDto } from './dto/create-order.dto';
import { PrismaService } from '../prisma/prisma.service';
import {
  PaymentStatus,
  OrderStatus,
  Order,
  Prisma,
  DayOfWeek,
} from '@prisma/client';
import { isDebugAlwaysOpen } from '../utils/debug';
import { Cron } from '@nestjs/schedule';

import { InventoryService } from 'src/inventory/inventory.service';
import moment from 'moment-timezone';
import { TtlCache } from '../common/ttl-cache';
import { RestaurantService } from 'src/restaurant/restaurant.service';
import { NotificationService } from 'src/notification/notification.service';
import { AnalyticsService } from 'src/analytics/analytics.service';
import {
  EventActor,
  EventName,
  EventSource,
} from 'src/analytics/dto/analytics.dto';

export type ValidatedOrderMenu = {
  menuId: string;
  menuName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  menuImg: string | null;
  details?: string;
  maxDaily: number;
};

/** The shop has this long to accept; after accepting, the student has this long to pay. */
const ACCEPT_WINDOW_MS = 3 * 60 * 1000;
const PAYMENT_WINDOW_MS = 3 * 60 * 1000;

@Injectable()
export class OrderService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => RestaurantService))
    private readonly restaurantService: RestaurantService,
    @Inject(forwardRef(() => InventoryService))
    private readonly inventoryService: InventoryService,
    private readonly analyticService: AnalyticsService,
    private readonly notificationService: NotificationService,
  ) {}

  private readonly logger = new Logger('OrderService');
  /** Display-only queue length (shop page header); every student opening a shop asked for a fresh COUNT(*). */
  private readonly activeCountCache = new TtlCache<number>(3_000, 1_000);

  async validateOrderMenus(
    orderMenus: CreateOrderMenusDto[],
    restaurantId: string,
  ): Promise<{
    totalAmount: number;
    validatedMenus: ValidatedOrderMenu[];
  }> {
    const menuIds = orderMenus.map((m) => m.menuId);
    const menus = await this.prisma.menu.findMany({
      where: {
        menuId: { in: menuIds },
      },
    });

    const menuMap = new Map(menus.map((m) => [m.menuId, m]));

    const markupRate = Number(process.env.SELL_PRICE_MARKUP_RATE ?? '0') + 1;
    let totalAmount = 0;

    const validatedMenus: ValidatedOrderMenu[] = [];

    for (const item of orderMenus) {
      const existingMenu = menuMap.get(item.menuId);

      if (!existingMenu) throw new NotFoundException(`ไม่พบเมนู`);
      if (!existingMenu.isAvailable)
        throw new BadRequestException('เมนูนี้ไม่พร้อมให้บริการ');
      if (existingMenu.restaurantId !== restaurantId)
        throw new BadRequestException(`เมนู ${item.menuName} ไม่ใช่ของร้านนี้`);

      const basePrice = existingMenu.price;
      const markupUnitPrice = Math.round(basePrice * markupRate);
      const totalPrice = markupUnitPrice * item.quantity;
      totalAmount += totalPrice;

      validatedMenus.push({
        menuId: item.menuId,
        menuName: existingMenu.name,
        quantity: item.quantity,
        unitPrice: markupUnitPrice,
        totalPrice,
        menuImg: existingMenu.menuImg ?? null,
        maxDaily: existingMenu.maxDaily ?? 999,
      });
    }

    return {
      totalAmount,
      validatedMenus,
    };
  }

  async validateTimingAndQueue(restaurantId: string, deliverTime: Date) {
    const nowBkk = moment().tz('Asia/Bangkok');
    const deliverAtBkk = moment(deliverTime).tz('Asia/Bangkok');

    const restaurant =
      await this.restaurantService.findRestaurant(restaurantId);
    const avgCookingTime =
      restaurant.avgCookingTimeMins ?? restaurant.avgCookingTime ?? 10;
    const maxActiveOrder =
      restaurant.maxActiveOrders ?? restaurant.maxActiveOrder ?? 50;

    const ACCEPT_WINDOW_MINS = 3;
    const PAYMENT_WINDOW_MINS = 3;
    const bufferMins =
      avgCookingTime + ACCEPT_WINDOW_MINS + PAYMENT_WINDOW_MINS;
    const diffMinutes = deliverAtBkk.diff(nowBkk, 'minutes');

    if (diffMinutes < bufferMins) {
      throw new BadRequestException(
        `เวลารับอาหารต้องอยู่หลังจากเวลาปัจจุบันอย่างน้อย ${bufferMins} นาที`,
      );
    }

    const activeOrderCount = await this.countActiveKitchenOrders(restaurantId);

    if (activeOrderCount >= maxActiveOrder) {
      await this.analyticService.trackEvent({
        name: EventName.queue_limit_reached,
        source: EventSource.backend_system,
        restaurantId: restaurantId,
        metadata: {
          actor: EventActor.system,
          reason: 'queue_limit_reached',
          queue: {
            activeOrders: activeOrderCount,
            maxActiveOrders: maxActiveOrder,
          },
        },
      });

      throw new ConflictException(
        `ขณะนี้ร้านค้ามีออเดอร์จำนวนมาก กรุณาลองใหม่ภายหลัง`,
      );
    }
  }

  private async afterOrderCreated(
    order: Order,
    isAutoAcceptedOrder: boolean,
    totalAmount: number,
    menuCount: number,
  ): Promise<void> {
    try {
      await this.analyticService.trackOrderEvent(
        EventName.order_submitted,
        order,
        {
          actor: EventActor.user,
          order: {
            nextStatus: order.status,
            autoAccepted: isAutoAcceptedOrder,
          },
          extra: { totalAmount, menuCount },
        },
      );
      await this.notificationService
        .queueOrderCreated(order.orderId)
        .catch((error: unknown) => {
          this.logger.warn(
            `Order created but push queue failed: ${(error as Error).message}`,
          );
        });
      if (isAutoAcceptedOrder) {
        await this.analyticService.trackOrderEvent(
          EventName.order_auto_accepted,
          order,
          {
            actor: EventActor.system,
            order: {
              previousStatus: OrderStatus.receive,
              nextStatus: OrderStatus.receive,
            },
            extra: { totalAmount, menuCount },
          },
        );
      }
    } catch (error) {
      this.logger.warn(
        `Post-create side effects failed for ${order.orderId}: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Returns the order a previous submit with this key created, or null. A key reused for a different cart is a
   * client bug (or tampering): 409 rather than silently returning someone else's order.
   */
  private async findIdempotentOrder(
    userId: string,
    idempotencyKey: string,
    dto: CreateOrderDto,
  ) {
    const existing = await this.prisma.order.findUnique({
      where: { userId_idempotencyKey: { userId, idempotencyKey } },
      include: { orderMenus: true },
    });
    if (!existing) return null;
    const lines = (items: { menuId: string; quantity: number }[]) =>
      items
        .map((i) => `${i.menuId}:${i.quantity}`)
        .sort()
        .join(',');
    if (
      existing.restaurantId !== dto.restaurantId ||
      lines(existing.orderMenus) !== lines(dto.orderMenus)
    ) {
      throw new ConflictException(
        'Idempotency-Key ถูกใช้กับคำสั่งซื้ออื่นแล้ว',
      );
    }
    return existing;
  }

  async createOrder(
    createOrderDto: CreateOrderDto,
    userId: string,
    idempotencyKey?: string,
  ): Promise<Order> {
    if (idempotencyKey) {
      const replay = await this.findIdempotentOrder(
        userId,
        idempotencyKey,
        createOrderDto,
      );
      if (replay) return replay;
    }
    const pickupAt =
      createOrderDto.pickupAt ??
      createOrderDto.deliverAt ??
      moment().tz('Asia/Bangkok').add(30, 'minutes').toDate();
    await this.validateTimingAndQueue(createOrderDto.restaurantId, pickupAt);

    const { totalAmount, validatedMenus } = await this.validateOrderMenus(
      createOrderDto.orderMenus,
      createOrderDto.restaurantId,
    );
    const restaurant = await this.restaurantService.findRestaurant(
      createOrderDto.restaurantId,
    );
    const isAutoAcceptedOrder = Boolean(restaurant.isAutoAcceptedOrder);
    this.logger.debug(
      'Restaurant in createOrder autoAccepted: ',
      isAutoAcceptedOrder,
    );

    try {
      const menuIds = createOrderDto.orderMenus.map((m) => m.menuId);
      const quotas = await this.inventoryService.getRemainingQuotas(menuIds);

      for (const item of validatedMenus) {
        if (quotas[item.menuId] < item.quantity) {
          throw new BadRequestException(`เมนู ${item.menuName} เหลือไม่พอ`);
        }
      }

      const order = await this.prisma.$transaction(async (tx) => {
        // Accept first, then pay, then cook: the order always starts as `receive`; accepting (the shop, or
        // auto-accept right here) sets `acceptAt`, which is what unlocks the payment step for the student.
        const initialStatus = OrderStatus.receive;
        const newOrder = await tx.order.create({
          data: {
            restaurantId: createOrderDto.restaurantId,
            userId,
            idempotencyKey: idempotencyKey ?? null,
            pickupAt,
            status: initialStatus,
            acceptAt: isAutoAcceptedOrder ? new Date() : null,
            paymentStatus: PaymentStatus.UNPAID,
            totalAmount,
            details: createOrderDto.details ?? null,
            orderMenus: {
              create: validatedMenus.map((item) => ({
                quantity: item.quantity,
                menuName: item.menuName,
                unitPrice: item.unitPrice,
                totalPrice: item.totalPrice,
                menuImg: item.menuImg,
                menu: { connect: { menuId: item.menuId } },
              })),
            },
          },
          include: { orderMenus: true },
        });

        if (isAutoAcceptedOrder) {
          await this.handleInventoryDeduction(tx, newOrder, validatedMenus);
        }

        return newOrder;
      });

      // Analytics and the shop push are best-effort and must not hold the student's response (or a DB connection
      // slot) while they run: the order is already committed. Failures are logged, never surfaced.
      void this.afterOrderCreated(order, isAutoAcceptedOrder, totalAmount, validatedMenus.length);

      return order;
    } catch (error) {
      if (error.code === 'P2002') {
        // Lost the race against a concurrent submit with the same key: hand back the winner's order.
        if (idempotencyKey) {
          const winner = await this.findIdempotentOrder(
            userId,
            idempotencyKey,
            createOrderDto,
          );
          if (winner) return winner;
        }
        throw new BadRequestException('ชำระเงินซ้ำ/ใช้สลิปเก่า');
      }
      throw error;
    }
  }

  async findRestaurantTodayOrders(restaurantId: string) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const orders = await this.prisma.safeRead(() =>
      this.prisma.order.findMany({
        where: { restaurantId, orderAt: { gte: yesterday } },
        include: { orderMenus: true },
        orderBy: {
          pickupAt: 'asc',
        },
      }),
    );

    const latestTimestamp =
      orders.length > 0 ? this.latestActivityAt(orders) : new Date();

    return { orders, latestTimestamp };
  }

  /** Orders placed in a reporting window (Asia/Bangkok), for the cooker summary page. */
  async findRestaurantOrdersInRange(
    restaurantId: string,
    range: 'today' | 'week' | 'month' | '3months' | 'year' | 'all',
  ) {
    const now = moment().tz('Asia/Bangkok');
    const since = {
      all: () => moment(0).tz('Asia/Bangkok'),
      today: () => now.clone().startOf('day'),
      week: () => now.clone().startOf('isoWeek'),
      month: () => now.clone().startOf('month'),
      '3months': () => now.clone().subtract(3, 'months').startOf('day'),
      year: () => now.clone().subtract(1, 'year').startOf('day'),
    }[range]();

    const orders = await this.prisma.safeRead(() =>
      this.prisma.order.findMany({
        where: { restaurantId, orderAt: { gte: since.toDate() } },
        include: {
          orderMenus: true,
          // Money going back to the student (approved or paid out): such orders must not count as sales.
          refundRequests: {
            where: { status: { in: ['APPROVED', 'REFUNDED'] } },
            select: { status: true },
          },
        },
        orderBy: { orderAt: 'desc' },
        take: 5000,
      }),
    );
    return { orders, since: since.toDate() };
  }

  /**
   * Returns `isOpen(start, end)`: does [start, end) overlap the time the shop may actually trade?
   * = school hours (incl. date overrides) ∩ canteen hours ∩ shop hours. A level with no configured hours is skipped.
   */
  private async openWindowChecker(restaurantId: string, from: Date, to: Date) {
    const r = await this.prisma.restaurant.findUnique({
      where: { restaurantId },
      select: {
        operatingHours: true,
        canteen: {
          select: {
            operatingHours: true,
            school: {
              select: {
                operatingHours: true,
                dateOverrides: {
                  where: {
                    date: {
                      gte: moment(from).tz('Asia/Bangkok').startOf('day').toDate(),
                      lte: moment(to).tz('Asia/Bangkok').endOf('day').toDate(),
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    type Hours = { dayOfWeek: DayOfWeek; openMinute: number; closeMinute: number };
    type Iv = [number, number];
    const DAY: DayOfWeek[] = [
      DayOfWeek.SUNDAY, DayOfWeek.MONDAY, DayOfWeek.TUESDAY, DayOfWeek.WEDNESDAY,
      DayOfWeek.THURSDAY, DayOfWeek.FRIDAY, DayOfWeek.SATURDAY,
    ];
    const forDay = (rows: Hours[] | undefined, d: DayOfWeek): Iv[] | null =>
      !rows || rows.length === 0
        ? null
        : rows.filter((h) => h.dayOfWeek === d).map((h) => [h.openMinute, h.closeMinute] as Iv);
    const intersect = (a: Iv[], b: Iv[]): Iv[] =>
      a.flatMap(([a0, a1]) =>
        b.flatMap(([b0, b1]) => {
          const lo = Math.max(a0, b0);
          const hi = Math.min(a1, b1);
          return lo < hi ? [[lo, hi] as Iv] : [];
        }),
      );

    const school = r?.canteen?.school;
    const overrides = new Map(
      (school?.dateOverrides ?? []).map((o) => [moment.utc(o.date).format('YYYY-MM-DD'), o]),
    );
    const cache = new Map<string, Iv[]>();

    const intervalsFor = (day: moment.Moment): Iv[] => {
      const key = day.format('YYYY-MM-DD');
      const hit = cache.get(key);
      if (hit) return hit;
      const dow = DAY[day.day()];
      const ov = overrides.get(key);
      const schoolIv: Iv[] | null = ov
        ? ov.isClosed ? [] : ov.openMinute != null && ov.closeMinute != null ? [[ov.openMinute, ov.closeMinute]] : forDay(school?.operatingHours, dow)
        : forDay(school?.operatingHours, dow);
      const levels = [schoolIv, forDay(r?.canteen?.operatingHours, dow), forDay(r?.operatingHours, dow)].filter(
        (x): x is Iv[] => x !== null,
      );
      const result = levels.length === 0 ? ([[0, 1440]] as Iv[]) : levels.reduce(intersect);
      cache.set(key, result);
      return result;
    };

    return (start: moment.Moment, end: moment.Moment) => {
      for (let d = start.clone().startOf('day'); d.isBefore(end); d.add(1, 'day')) {
        const dayStart = d.clone();
        const lo = Math.max(0, start.diff(dayStart, 'minutes'));
        const hi = Math.min(1440, end.diff(dayStart, 'minutes'));
        if (intervalsFor(d).some(([o, c]) => o < hi && c > lo)) return true;
      }
      return false;
    };
  }

  /**
   * Sales trend: revenue for a window vs. the same window one period earlier (like-for-like, so "today" is compared
   * with yesterday up to the same time of day). Revenue = paid, not rejected (same rule as the summary page).
   */
  async findSalesTrend(
    restaurantId: string,
    range: 'today' | 'week' | 'month' | '3months' | 'year',
  ) {
    const now = moment().tz('Asia/Bangkok');
    const cfg = {
      today: { since: now.clone().startOf('day'), shift: [1, 'day'], unit: 'hours' },
      week: { since: now.clone().startOf('isoWeek'), shift: [1, 'week'], unit: 'days' },
      month: { since: now.clone().startOf('month'), shift: [1, 'month'], unit: 'days' },
      '3months': { since: now.clone().subtract(3, 'months').startOf('day'), shift: [3, 'months'], unit: 'weeks' },
      year: { since: now.clone().subtract(1, 'year').startOf('day'), shift: [1, 'year'], unit: 'months' },
    }[range] as {
      since: moment.Moment;
      shift: [number, moment.unitOfTime.DurationConstructor];
      unit: 'hours' | 'days' | 'weeks' | 'months';
    };

    const curStart = cfg.since;
    const prevStart = curStart.clone().subtract(...cfg.shift);
    const prevEnd = now.clone().subtract(...cfg.shift);

    const rows = await this.prisma.safeRead(() =>
      this.prisma.order.findMany({
        where: {
          restaurantId,
          orderAt: { gte: prevStart.toDate(), lte: now.toDate() },
        },
        select: { orderAt: true, totalAmount: true, status: true, paymentStatus: true },
      }),
    );

    const restricted = !isDebugAlwaysOpen();
    const isOpen = restricted
      ? await this.openWindowChecker(restaurantId, prevStart.toDate(), now.toDate())
      : () => true;

    const bucketCount = Math.floor(now.diff(curStart, cfg.unit)) + 1;
    const buckets = Array.from({ length: bucketCount }, (_, i) => ({
      start: curStart.clone().add(i, cfg.unit).toISOString(),
      open:
        isOpen(curStart.clone().add(i, cfg.unit), curStart.clone().add(i + 1, cfg.unit)) ||
        isOpen(prevStart.clone().add(i, cfg.unit), prevStart.clone().add(i + 1, cfg.unit)),
      current: 0,
      previous: 0,
      currentOrders: 0,
      previousOrders: 0,
    }));
    let currentTotal = 0;
    let previousTotal = 0;
    let currentOrders = 0;
    let previousOrders = 0;

    for (const o of rows) {
      const t = moment(o.orderAt).tz('Asia/Bangkok');
      const isCurrent = !t.isBefore(curStart);
      if (!isCurrent && t.isAfter(prevEnd)) continue;
      const idx = Math.floor(
        isCurrent ? t.diff(curStart, cfg.unit) : t.diff(prevStart, cfg.unit),
      );
      const b = buckets[idx];
      if (!b) continue;
      const revenue =
        o.paymentStatus === PaymentStatus.PAID && o.status !== OrderStatus.rejected
          ? o.totalAmount
          : 0;
      if (isCurrent) {
        b.current += revenue;
        b.currentOrders += 1;
        currentTotal += revenue;
        currentOrders += 1;
      } else {
        b.previous += revenue;
        b.previousOrders += 1;
        previousTotal += revenue;
        previousOrders += 1;
      }
    }

    const pct = (cur: number, prev: number) =>
      prev === 0 ? null : Math.round(((cur - prev) / prev) * 1000) / 10;

    return {
      unit: cfg.unit,
      restricted,
      currentTotal,
      previousTotal,
      revenuePct: pct(currentTotal, previousTotal),
      currentOrders,
      previousOrders,
      ordersPct: pct(currentOrders, previousOrders),
      previousFrom: prevStart.toISOString(),
      previousTo: prevEnd.toISOString(),
      buckets,
    };
  }

  /** Newest moment anything happened to these orders: placed, accepted or paid. */
  private latestActivityAt(
    orders: Array<{ orderAt: Date; acceptAt: Date | null; paidAt: Date | null }>,
  ): Date {
    let latest = orders[0].orderAt;
    for (const o of orders) {
      for (const t of [o.orderAt, o.acceptAt, o.paidAt]) {
        if (t && t > latest) latest = t;
      }
    }
    return latest;
  }

  /**
   * Orders placed, accepted or paid after `timeStamp` – the kitchen board needs the "student just paid" update
   * (the order then moves to cooking by itself), not only brand-new orders.
   */
  async getOrdersAfterTimeStamp(restaurantId: string, timeStamp?: Date) {
    const orders = await this.prisma.order.findMany({
      where: {
        restaurantId,
        ...(timeStamp
          ? {
              OR: [
                { orderAt: { gt: timeStamp } },
                { acceptAt: { gt: timeStamp } },
                { paidAt: { gt: timeStamp } },
              ],
            }
          : {}),
      },
      include: { orderMenus: true },
      orderBy: {
        orderAt: 'asc',
      },
    });

    const latestTimestamp =
      orders.length > 0
        ? this.latestActivityAt(orders)
        : (timeStamp ?? null);

    return { orders, latestTimestamp };
  }

  async countActiveKitchenOrders(restaurantId: string): Promise<number> {
    const startOfDay = moment().tz('Asia/Bangkok').startOf('day').toDate();

    return this.prisma.order.count({
      where: {
        restaurantId,
        status: { in: [OrderStatus.receive, OrderStatus.cooking] },
        orderAt: { gte: startOfDay },
      },
    });
  }

  /** Up to 3 s stale. Never use it for the queue-cap check in order creation (that one must be exact). */
  countActiveKitchenOrdersForDisplay(restaurantId: string): Promise<number> {
    return this.activeCountCache.get(restaurantId, () =>
      this.countActiveKitchenOrders(restaurantId),
    );
  }

  async assertOrderOwner(orderId: string, userId: string): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { orderId },
      select: { userId: true },
    });
    if (!order || !userId || order.userId !== userId)
      throw new NotFoundException('ไม่พบออเดอร์ที่ค้นหา');
  }

  async listOrdersForUser(userId: string) {
    const orders = await this.prisma.order.findMany({
      where: { userId },
      orderBy: { orderAt: 'desc' },
      take: 100,
      select: {
        orderId: true,
        status: true,
        paymentStatus: true,
        totalAmount: true,
        orderAt: true,
        pickupAt: true,
        restaurant: { select: { name: true } },
        orderMenus: { select: { menuName: true, quantity: true } },
      },
    });
    return orders.map((o) => ({
      orderId: o.orderId,
      code: o.orderId.replace(/-/g, '').slice(0, 4).toUpperCase(),
      restaurantName: o.restaurant.name,
      status: o.status,
      paymentStatus: o.paymentStatus,
      totalAmount: o.totalAmount,
      itemCount: o.orderMenus.reduce((n, m) => n + m.quantity, 0),
      itemsLabel: o.orderMenus
        .map((m) => `${m.menuName} ×${m.quantity}`)
        .join(', '),
      orderAt: o.orderAt,
      pickupAt: o.pickupAt,
    }));
  }

  async findOneOrderForUser(orderId: string, userId: string) {
    const order = await this.findOneOrder(orderId);
    if (!userId || order.userId !== userId)
      throw new NotFoundException('ไม่พบออเดอร์ที่ค้นหา');
    return order;
  }

  /** One indexed single-row read (no items, no shop): what student screens poll. The full order is loaded only on change. */
  async findOrderStatusForUser(orderId: string, userId: string) {
    const order = await this.prisma.safeRead(() =>
      this.prisma.order.findUnique({
        where: { orderId },
        select: {
          userId: true,
          status: true,
          paymentStatus: true,
          acceptAt: true,
          updatedAt: true,
        },
      }),
    );
    if (!order || !userId || order.userId !== userId)
      throw new NotFoundException('ไม่พบออเดอร์ที่ค้นหา');
    const { userId: _owner, ...state } = order;
    return state;
  }

  async findOneOrder(orderId: string) {
    try {
      const order = await this.prisma.safeRead(() =>
        this.prisma.order.findUnique({
          where: { orderId },
          include: {
            orderMenus: true,
            restaurant: {
              select: {
                name: true,
                paymentQr: true,
              },
            },
          },
        }),
      );

      if (!order) throw new NotFoundException('ไม่พบออเดอร์ที่ค้นหา');

      return order;
    } catch (error) {
      if (error.code === 'P2025') {
        throw new NotFoundException(`ไม่พบออเดอร์ที่มีID: ${orderId}`);
      }
      throw error;
    }
  }

  async updateOrderPaymentTx(
    tx: Prisma.TransactionClient,
    orderId: string,
    paymentStatus: PaymentStatus,
    _paymentSlipImg?: string,
    paymentGatewayStatus?: string,
    transactionId?: string,
    paidAt?: Date,
  ) {
    const existing = await tx.order.findUnique({ where: { orderId } });
    if (!existing) throw new NotFoundException('ไม่พบออเดอร์');
    if (existing.paymentStatus === PaymentStatus.PAID) return existing;

    try {
      // Paid after the shop accepted → the kitchen can start cooking right away.
      const startCooking =
        paymentStatus === PaymentStatus.PAID &&
        existing.status === OrderStatus.receive &&
        !!existing.acceptAt;
      const updatedOrder = await tx.order.update({
        where: { orderId },
        data: {
          paymentStatus: paymentStatus,
          paidAt: paidAt ?? new Date(),
          ...(startCooking ? { status: OrderStatus.cooking } : {}),
        },
      });

      await this.analyticService.trackOrderEvent(
        EventName.order_paid,
        existing,
        {
          actor: EventActor.payment_gateway,
          payment: {
            status: paymentStatus,
            gatewayStatus: paymentGatewayStatus,
            transactionId: transactionId,
            paidAt: paidAt ?? new Date(),
          },
        },
      );

      return updatedOrder;
    } catch (error) {
      await this.analyticService.trackOrderEvent(
        EventName.payment_verification_failed,
        existing,
        {
          actor: EventActor.payment_gateway,
          payment: {
            status: paymentStatus,
            gatewayStatus: paymentGatewayStatus,
            transactionId: transactionId,
            paidAt,
          },
        },
      );

      throw error;
    }
  }

  async updateDelay(orderId: string, isDelay: boolean) {
    const order = await this.findOneOrder(orderId);

    if (order.isDelay)
      throw new BadRequestException('ออเดอร์นี้ถูกแจ้งล่าช้าแล้ว');

    const updatedPickupAt = new Date(order.pickupAt);
    updatedPickupAt.setMinutes(updatedPickupAt.getMinutes() + 10);

    const result = await this.prisma.order.update({
      where: { orderId },
      data: {
        isDelay: isDelay,
        status: OrderStatus.delay,
        pickupAt: updatedPickupAt,
      },
    });

    await this.analyticService.trackOrderEvent(
      EventName.order_delayed,
      result,
      {
        actor: EventActor.restaurant,
        extra: {
          isDelay,
          delayedMinutes: 10,
        },
      },
    );

    void this.notificationService.notifyStudentOrderUpdate(orderId, 'delay');

    return { result, message: `แจ้งส่งออเดอร์ล่าช้า10นาทีสำเร็จ` };
  }

  /**
   * Serializes state changes on one order. Every transition reads the order and then acts on what it read (deduct or
   * release stock, move the status), so without a row lock two cooks pressing accept/reject at the same moment both
   * act on the same stale read: stock is deducted twice, or reserved for an order that ended up rejected.
   * The lock is held until the surrounding transaction ends.
   */
  private async lockOrder(tx: Prisma.TransactionClient, orderId: string) {
    await tx.$queryRaw`SELECT "orderId" FROM "Order" WHERE "orderId" = ${orderId} FOR UPDATE`;
  }

  /** Stock is reserved when the order is accepted; give it back if the order dies before being paid. */
  private async releaseReservedStock(
    tx: Prisma.TransactionClient,
    orderMenus: Array<{ menuId: string; quantity: number }>,
  ) {
    const perMenu = new Map<string, number>();
    for (const m of orderMenus)
      perMenu.set(m.menuId, (perMenu.get(m.menuId) ?? 0) + m.quantity);
    for (const [menuId, quantity] of perMenu)
      await this.inventoryService.restoreInventoryTx(tx, menuId, quantity);
  }

  /**
   * The shop accepts an order: stock is reserved and the student may now pay. Cooking starts by itself once
   * the slip is verified (see `updateOrderPaymentTx`).
   */
  async acceptOrder(orderId: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      await this.lockOrder(tx, orderId);
      const order = await tx.order.findUnique({
        where: { orderId },
        include: { orderMenus: true },
      });
      if (!order) throw new NotFoundException('ไม่พบออเดอร์');
      if (order.acceptAt)
        return {
          previousStatus: order.status,
          result: order,
          message: 'สถานะเหมือนเดิม',
          changed: false,
        };
      if (order.status !== OrderStatus.receive)
        throw new BadRequestException(
          `ไม่สามารถรับออเดอร์ที่มีสถานะ ${order.status}`,
        );

      await this.handleInventoryDeduction(tx, order, order.orderMenus);

      // Orders paid before this flow existed (paid + still `receive`) go straight to cooking.
      const alreadyPaid = order.paymentStatus === PaymentStatus.PAID;
      const updated = await tx.order.update({
        where: { orderId },
        data: {
          acceptAt: new Date(),
          ...(alreadyPaid ? { status: OrderStatus.cooking } : {}),
        },
        include: { orderMenus: true },
      });
      return {
        previousStatus: order.status,
        result: updated,
        message: alreadyPaid
          ? 'รับออเดอร์แล้ว เริ่มทำอาหารได้เลย'
          : 'รับออเดอร์แล้ว รอนักเรียนชำระเงิน',
        changed: true,
      };
    });

    if (result.changed) {
      await this.analyticService.trackOrderEvent(
        EventName.order_accepted,
        result.result,
        {
          actor: EventActor.restaurant,
          order: {
            previousStatus: result.previousStatus,
            nextStatus: result.result.status,
          },
        },
      );
      await this.notificationService
        .stopRetriesForOrder(orderId)
        .catch((error: unknown) => {
          this.logger.warn(
            `Failed to stop push retries for ${orderId}: ${(error as Error).message}`,
          );
        });
      // The payment window starts now: tell the student at once instead of waiting for their next poll.
      if (result.result.paymentStatus !== PaymentStatus.PAID)
        void this.notificationService.notifyStudentOrderUpdate(orderId, 'accepted');
    }

    const { changed: _changed, ...rest } = result;
    return rest;
  }

  async updateOrderStatus(orderId: string, newStatus: OrderStatus) {
    const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
      [OrderStatus.receive]: [
        OrderStatus.cooking,
        OrderStatus.delay,
        OrderStatus.rejected,
      ],
      [OrderStatus.cooking]: [
        OrderStatus.ready,
        OrderStatus.delay,
        OrderStatus.rejected,
      ],
      [OrderStatus.ready]: [OrderStatus.done, OrderStatus.delay],
      [OrderStatus.delay]: [
        OrderStatus.cooking,
        OrderStatus.ready,
        OrderStatus.done,
        OrderStatus.rejected,
      ],
      [OrderStatus.done]: [],
      [OrderStatus.rejected]: [],
    };

    const result = await this.prisma.$transaction(async (tx) => {
      await this.lockOrder(tx, orderId);
      const order = await tx.order.findUnique({
        where: { orderId },
        include: { orderMenus: true },
      });

      if (!order) throw new NotFoundException('ไม่พบออเดอร์');
      if (order.status === newStatus)
        return {
          previousStatus: order.status,
          result: order,
          message: 'สถานะเหมือนเดิม',
        };

      const allowed = ORDER_TRANSITIONS[order.status];
      if (!allowed || !allowed.includes(newStatus)) {
        throw new BadRequestException(
          `ไม่สามารถเปลี่ยนสถานะจาก ${order.status} เป็น ${newStatus}`,
        );
      }

      if (
        order.status === OrderStatus.receive &&
        newStatus === OrderStatus.cooking &&
        !order.acceptAt
      ) {
        await this.handleInventoryDeduction(tx, order, order.orderMenus);
      }

      if (
        order.status === OrderStatus.receive &&
        newStatus === OrderStatus.rejected &&
        order.acceptAt &&
        order.paymentStatus === PaymentStatus.UNPAID
      ) {
        await this.releaseReservedStock(tx, order.orderMenus);
      }

      const updatedOrder = await tx.order.update({
        where: { orderId },
        data: { status: newStatus },
        select: {
          orderId: true,
          restaurantId: true,
          status: true,
          paymentStatus: true,
          pickupAt: true,
          isDelay: true,
        },
      });

      return {
        previousStatus: order.status,
        result: updatedOrder,
        message: `อัพเดทสถานะออเดอร์เป็น ${updatedOrder?.status} สำเร็จ`,
      };
    });

    const prevStatus = result.previousStatus;
    const updatedStatus = result.result.status;

    if (updatedStatus === OrderStatus.cooking) {
      await this.analyticService.trackOrderEvent(
        EventName.order_accepted,
        result.result,
        {
          actor: EventActor.restaurant,
          order: {
            previousStatus: prevStatus,
            nextStatus: updatedStatus,
          },
        },
      );
    }

    // Students hear about two things only: food ready, and the shop running late (cooking would be noise).
    if (prevStatus !== updatedStatus) {
      if (updatedStatus === OrderStatus.ready)
        void this.notificationService.notifyStudentOrderUpdate(orderId, 'ready');
      else if (updatedStatus === OrderStatus.delay)
        void this.notificationService.notifyStudentOrderUpdate(orderId, 'delay');
    }

    if (result.result.status !== OrderStatus.receive) {
      await this.notificationService
        .stopRetriesForOrder(orderId)
        .catch((error: unknown) => {
          const pushError = error as Error;
          this.logger.warn(
            `Failed to stop push retries for ${orderId}: ${pushError.message}`,
          );
        });
    }

    return result;
  }

  private async handleInventoryDeduction(
    tx: Prisma.TransactionClient,
    order: Pick<Order, 'orderId' | 'restaurantId' | 'status' | 'paymentStatus'>,
    orderMenus: Array<{
      menuId: string;
      quantity: number;
      menuName: string;
      maxDaily?: number;
    }>,
  ) {
    const groupedMenus = new Map<
      string,
      { quantity: number; menuName: string; maxDaily: number }
    >();
    const menuIds = orderMenus.map((m) => m.menuId);
    const menus = await tx.menu.findMany({
      where: { menuId: { in: menuIds } },
      select: { menuId: true, name: true, maxDaily: true },
    });
    const menuMap = new Map(menus.map((m) => [m.menuId, m]));

    for (const item of orderMenus) {
      const menuInfo = menuMap.get(item.menuId);
      const maxDaily = item.maxDaily ?? menuInfo?.maxDaily ?? 999;
      const name = item.menuName ?? menuInfo?.name ?? 'Menu';
      const existing = groupedMenus.get(item.menuId);

      if (existing) {
        existing.quantity += item.quantity;
      } else {
        groupedMenus.set(item.menuId, {
          quantity: item.quantity,
          menuName: name,
          maxDaily,
        });
      }
    }

    const outOfStockMenus: string[] = [];
    for (const [menuId, data] of groupedMenus.entries()) {
      const result = await this.inventoryService.deductInventoryTx(
        tx,
        menuId,
        data.quantity,
        data.menuName,
        data.maxDaily,
      );
      if (result) outOfStockMenus.push(result);
    }

    if (outOfStockMenus.length > 0) {
      await this.analyticService.trackOrderEvent(
        EventName.order_rejected,
        order,
        {
          actor: EventActor.system,
          reason: 'menu_out_of_stock',
          order: {
            previousStatus: order.status,
            nextStatus: OrderStatus.rejected,
          },
          inventory: {
            outOfStockMenus,
          },
        },
      );

      throw new BadRequestException(
        `เมนุดังต่อไปนี้หมด: ${outOfStockMenus.join(', ')}`,
      );
    }
  }

  async cancelOrder(orderId: string) {
    const existing = await this.prisma.order.findUnique({ where: { orderId } });
    if (!existing) throw new NotFoundException('ไม่พบออเดอร์');
    if (existing.status === OrderStatus.done)
      throw new BadRequestException('ไม่สามารถยกเลิกออเดอร์ที่เสร็จแล้ว');
    // Once paid the shop is cooking on the student's money: cancelling is a refund request, not a cancel.
    if (existing.paymentStatus === PaymentStatus.PAID)
      throw new ConflictException({
        message: 'ออเดอร์ที่ชำระเงินแล้วยกเลิกเองไม่ได้ หากมีปัญหากรุณาขอคืนเงิน',
        code: 'ORDER_ALREADY_PAID',
      });
    if (existing.status === OrderStatus.rejected) {
      return {
        skipped: true as const,
        previousStatus: existing.status,
        result: existing,
        message: 'ออเดอร์ถูกยกเลิกไปแล้ว',
      };
    }

    const { count } = await this.prisma.$transaction(async (tx) => {
      await this.lockOrder(tx, orderId);
      // Re-read under the lock: whether stock is reserved depends on whether a cook accepted in the meantime.
      const order = await tx.order.findUnique({ where: { orderId } });
      if (!order) return { count: 0 };
      const wasReservedUnpaid =
        order.status === OrderStatus.receive &&
        !!order.acceptAt &&
        order.paymentStatus === PaymentStatus.UNPAID;
      const res = await tx.order.updateMany({
        where: {
          orderId,
          status: { in: [OrderStatus.receive, OrderStatus.cooking] },
        },
        data: {
          status: OrderStatus.rejected,
        },
      });
      if (res.count > 0 && wasReservedUnpaid) {
        const menus = await tx.orderMenu.findMany({ where: { orderId } });
        await this.releaseReservedStock(tx, menus);
      }
      return res;
    });

    if (count === 0) {
      const latest = await this.prisma.order.findUniqueOrThrow({
        where: { orderId },
      });
      return {
        skipped: true as const,
        previousStatus: latest.status,
        result: latest,
        message: 'ออเดอร์ถูกยกเลิกไปแล้ว',
      };
    }

    const updatedOrder = await this.prisma.order.findUniqueOrThrow({
      where: { orderId },
      select: {
        orderId: true,
        restaurantId: true,
        status: true,
        paymentStatus: true,
      },
    });

    await this.notificationService
      .stopRetriesForOrder(orderId, 'cancelled_by_user')
      .catch((error: unknown) => {
        const pushError = error as Error;
        this.logger.warn(
          `Failed to stop push retries for cancelled order ${orderId}: ${pushError.message}`,
        );
      });

    await this.analyticService.trackOrderEvent(
      EventName.order_cancelled,
      updatedOrder,
      {
        actor: EventActor.user,
        reason: 'user_cancelled',
        order: {
          previousStatus: existing.status,
          nextStatus: updatedOrder.status,
        },
      },
    );

    return {
      skipped: false as const,
      previousStatus: existing.status,
      result: updatedOrder,
      message: 'ยกเลิกออเดอร์สำเร็จ',
    };
  }

  async expireOrder(orderId: string) {
    try {
      const order = await this.findOneOrder(orderId);
      // Not accepted yet: the shop has 3 min. Accepted: the student has 5 min (counted from acceptance) to pay.
      const accepted = !!order.acceptAt;
      const EXPIRE_MS = accepted ? PAYMENT_WINDOW_MS : ACCEPT_WINDOW_MS;
      const GRACE_MS = 3000;
      const startedAt = new Date(order.acceptAt ?? order.orderAt).getTime();
      const isTimePassed = Date.now() - startedAt >= EXPIRE_MS - GRACE_MS;

      const isExpired =
        order.status === OrderStatus.receive &&
        order.paymentStatus === PaymentStatus.UNPAID &&
        isTimePassed;

      if (!isExpired) return;

      const { count } = await this.prisma.$transaction(async (tx) => {
        const res = await tx.order.updateMany({
          where: {
            orderId,
            status: OrderStatus.receive,
            paymentStatus: PaymentStatus.UNPAID,
            ...(accepted
              ? { acceptAt: { lt: new Date(Date.now() - EXPIRE_MS) } }
              : {
                  acceptAt: null,
                  orderAt: { lt: new Date(Date.now() - EXPIRE_MS) },
                }),
          },
          data: {
            status: OrderStatus.rejected,
          },
        });
        if (res.count > 0 && accepted)
          await this.releaseReservedStock(tx, order.orderMenus);
        return res;
      });

      if (count === 0) return;

      const updatedOrder = await this.prisma.order.findUniqueOrThrow({
        where: { orderId },
      });

      await this.analyticService.trackOrderEvent(
        EventName.order_expired,
        updatedOrder,
        {
          actor: EventActor.system,
          reason: 'payment_timeout',
          order: {
            previousStatus: OrderStatus.receive,
            nextStatus: OrderStatus.rejected,
          },
        },
      );
    } catch (error) {
      this.logger.error(
        `Expire order failed (${orderId}): ${(error as Error).message}`,
      );
    }
  }

  async removeOrder(orderId: string) {
    const order = await this.findOneOrder(orderId);

    if (
      order.status !== OrderStatus.done &&
      order.status !== OrderStatus.rejected
    ) {
      throw new BadRequestException(
        'สามารถลบได้เฉพาะออเดอร์ที่มีสถานะเสร็จสมบูรณ์เรียบร้อยแล้วเท่านั้น',
      );
    }

    return this.prisma.order.delete({
      where: { orderId },
    });
  }

  @Cron('* * * * *')
  async autoCompleteOrders() {
    try {
      // Safety net for cooks who forget to press done. pickupAt moves later when a shop delays an order.
      const bufferMinutes = 15;
      const threshold = new Date(Date.now() - bufferMinutes * 60 * 1000);

      const result = await this.prisma.withRetry(() =>
        this.prisma.order.updateMany({
          where: {
            status: { in: [OrderStatus.cooking, OrderStatus.ready] },
            paymentStatus: PaymentStatus.PAID,
            pickupAt: { lt: threshold },
          },
          data: { status: OrderStatus.done },
        }),
      );

      if (result.count > 0) {
        await this.analyticService.trackEvent({
          name: EventName.order_completed,
          source: EventSource.cron_job,
          metadata: {
            actor: EventActor.cron_job,
            counts: {
              completed: result.count,
            },
          },
        });

        this.logger.log(`Auto completed ${result.count} orders`);
      }
    } catch (error) {
      this.logger.error(
        `Auto-complete orders failed: ${(error as Error).message}`,
      );
    }
  }

  @Cron('* * * * *')
  async autoRejectedOrder() {
    const sentThreshold = new Date(Date.now() - 3 * 60 * 1000);

    try {
      // Accepted but never paid: give the stock back and close the order.
      const payThreshold = new Date(Date.now() - PAYMENT_WINDOW_MS);
      const unpaid = await this.prisma.order.findMany({
        where: {
          status: OrderStatus.receive,
          paymentStatus: PaymentStatus.UNPAID,
          acceptAt: { lt: payThreshold },
        },
        include: { orderMenus: true },
      });
      for (const o of unpaid) {
        await this.prisma.$transaction(async (tx) => {
          const res = await tx.order.updateMany({
            where: {
              orderId: o.orderId,
              status: OrderStatus.receive,
              paymentStatus: PaymentStatus.UNPAID,
            },
            data: { status: OrderStatus.rejected },
          });
          if (res.count > 0) await this.releaseReservedStock(tx, o.orderMenus);
        });
      }

      // Never accepted by the shop in time.
      const sentResult = await this.prisma.withRetry(() =>
        this.prisma.order.updateMany({
          where: {
            status: OrderStatus.receive,
            paymentStatus: PaymentStatus.UNPAID,
            acceptAt: null,
            orderAt: { lt: sentThreshold },
          },
          data: { status: OrderStatus.rejected },
        }),
      );

      if (sentResult.count > 0) {
        await this.analyticService.trackEvent({
          name: EventName.order_auto_rejected,
          source: EventSource.cron_job,
          metadata: {
            actor: EventActor.cron_job,
            reason: 'restaurant_accept_timeout',
            counts: {
              rejected: sentResult.count,
            },
          },
        });

        this.logger.log(`Auto-rejected ${sentResult.count} unaccepted orders`);
      }
    } catch (error) {
      this.logger.error(
        `Auto-cancel (sent) failed: ${(error as Error).message}`,
      );
    }
  }
}
