import {
  BadRequestException,
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
  Logger,
  forwardRef,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { CreateOrderDto, CreateOrderMenusDto } from './dto/create-order.dto';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentStatus, OrderStatus, Order, Prisma, EventName, EventSource } from '@prisma/client';
import { Cron } from '@nestjs/schedule';

import { InventoryService } from 'src/inventory/inventory.service';
import moment from 'moment-timezone';
import { RestaurantService } from 'src/restaurant/restaurant.service';
import { Decimal } from '@prisma/client/runtime/client';
import { NotificationService } from 'src/notification/notification.service';
import { AnalyticsService } from 'src/analytics/analytics.service';
import { EventActor } from 'src/analytics/dto/analytics.dto';

type ValidatedOrderMenu = {
  menuId: string;
  menuName: string;
  quantity: number;
  unitPrice: Decimal;
  menuImg: string | null;
  details?: string;
  maxDaily: number;
};

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
  ) { }

  private readonly logger = new Logger('OrderService');

  async validateOrderMenus(
    orderMenus: CreateOrderMenusDto[],
    restaurantId: string,
  ): Promise<{
    totalAmount: Decimal;
    validatedMenus: ValidatedOrderMenu[];
  }> {
    const menuIds = orderMenus.map((m) => m.menuId);
    const menus = await this.prisma.menu.findMany({
      where: {
        menuId: { in: menuIds },
      },
    });

    const menuMap = new Map(menus.map((m) => [m.menuId, m]));

    const markupRate = new Decimal(process.env.SELL_PRICE_MARKUP_RATE ?? "0").plus(1);
    let totalAmount = new Decimal(0);

    const validatedMenus: ValidatedOrderMenu[] = [];

    for (const item of orderMenus) {
      const existingMenu = menuMap.get(item.menuId);

      if (!existingMenu) throw new NotFoundException(`ไม่พบเมนู`);
      if (!existingMenu.isAvailable) throw new BadRequestException("เมนูนี้ไม่พร้อมให้บริการ");
      if (existingMenu.restaurantId !== restaurantId) throw new BadRequestException(`เมนู ${item.menuName} ไม่ใช่ของร้านนี้`);

      const basePrice = new Decimal(existingMenu.price);
      const markupUnitPrice = basePrice.mul(markupRate).toDecimalPlaces(2);
      const totalPrice = markupUnitPrice.mul(item.quantity);
      totalAmount = totalAmount.plus(totalPrice);

      validatedMenus.push({
        menuId: item.menuId,
        menuName: existingMenu.name,
        quantity: item.quantity,
        unitPrice: markupUnitPrice,
        menuImg: existingMenu.menuImg ?? null,
        details: item.details,
        maxDaily: existingMenu.maxDaily
      });
    }

    return {
      totalAmount: totalAmount.toDecimalPlaces(2),
      validatedMenus,
    };
  }

  async validateTimingAndQueue(restaurantId: string, deliverTime: Date) {
    const nowBkk = moment().tz('Asia/Bangkok');
    const deliverAtBkk = moment(deliverTime).tz('Asia/Bangkok');

    const { avgCookingTime, maxActiveOrder } = await this.restaurantService.findRestaurant(restaurantId);
    const ACCEPT_WINDOW_MINS = 3;
    const PAYMENT_WINDOW_MINS = 3;
    const bufferMins = avgCookingTime + ACCEPT_WINDOW_MINS + PAYMENT_WINDOW_MINS;
    const diffMinutes = deliverAtBkk.diff(nowBkk, 'minutes');

    if (diffMinutes < bufferMins) throw new BadRequestException(`เวลารับอาหารต้องอยู่หลังจากเวลาปัจจุบันอย่างน้อย ${bufferMins} นาที`);

    const activeOrderCount = await this.countActiveKitchenOrders(restaurantId);

    if (activeOrderCount >= maxActiveOrder) {
      await this.analyticService.trackEvent({
        name: EventName.queue_limit_reached,
        source: EventSource.backend_system,
        restaurantId: restaurantId,
        metadata: {
          actor: EventActor.system,
          reason: "queue_limit_reached",
          queue: {
            activeOrders: activeOrderCount,
            maxActiveOrders: maxActiveOrder,
          },
        }
      });

      throw new ConflictException(`ขณะนี้ร้านค้ามีออเดอร์จำนวนมาก กรุณาลองใหม่ภายหลัง`)
    }
  }

  async createOrder(createOrderDto: CreateOrderDto, userId?: string): Promise<Order> {
    await this.validateTimingAndQueue(createOrderDto.restaurantId, createOrderDto.deliverAt);

    const { totalAmount, validatedMenus } = await this.validateOrderMenus(createOrderDto.orderMenus, createOrderDto.restaurantId);
    const { isAutoAcceptedOrder } = await this.restaurantService.findRestaurant(createOrderDto.restaurantId)
    this.logger.debug("Restaurant in createOrder: ", isAutoAcceptedOrder);

    try {
      const order = await this.prisma.$transaction(async (tx) => {
        const order = await tx.order.create({
          data: {
            userId: userId ?? null,
            restaurantId: createOrderDto.restaurantId,
            deliverAt: createOrderDto.deliverAt,
            status: isAutoAcceptedOrder ? OrderStatus.accepted : OrderStatus.sent,
            acceptAt: isAutoAcceptedOrder ? new Date() : null,
            paymentStatus: PaymentStatus.unpaid,
            userTel: createOrderDto.userTel,
            totalAmount: totalAmount,
            orderMenus: {
              create: validatedMenus.map((item) => ({
                quantity: item.quantity,
                menuName: item.menuName,
                unitPrice: item.unitPrice,
                menuImg: item.menuImg,
                details: item.details,
                maxDaily: item.maxDaily,
                menu: { connect: { menuId: item.menuId } },
              })),
            },
          },
          include: { orderMenus: true },
        });

        if (isAutoAcceptedOrder) await this.handleInventoryDeduction(tx, order, validatedMenus);

        return order;
      });

      await this.analyticService.trackOrderEvent(
        EventName.order_submitted,
        order,
        {
          actor: EventActor.user,
          order: {
            nextStatus: order.status,
            autoAccepted: isAutoAcceptedOrder,
          },
          extra: {
            totalAmount,
            menuCount: validatedMenus.length
          }
        }
      );

      await this.notificationService.queueOrderCreated(order.orderId).catch((error: unknown) => {
        const pushError = error as Error;
        this.logger.warn(`Order created but push queue failed: ${pushError.message}`);
      });

      if (isAutoAcceptedOrder) {
        await this.analyticService.trackOrderEvent(
          EventName.order_auto_accepted,
          order,
          {
            actor: EventActor.system,
            order: {
              previousStatus: OrderStatus.sent,
              nextStatus: OrderStatus.accepted,
            },
            extra: {
              totalAmount,
              menuCount: validatedMenus.length
            }
          }
        );
      }

      return order;
    } catch (error) {
      if (error.code === "P2002") throw new BadRequestException("ชำระเงินซ้ำ/ใช้สลิปเก่า")

      throw error
    }
  }

  async findRestaurantTodayOrders(restaurantId: string) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1)

    const orders = await this.prisma.safeRead(() =>
      this.prisma.order.findMany({
        where: { restaurantId, orderAt: { gte: yesterday } },
        include: { orderMenus: true },
        orderBy: {
          deliverAt: 'asc',
        },
      }))

    const latestTimestamp = orders.length > 0 ? orders.reduce((latest, order) =>
      order.updatedAt > latest ? order.updatedAt : latest, orders[0].updatedAt) : new Date();

    return { orders, latestTimestamp }
  }

  async getOrdersAfterTimeStamp(restaurantId: string, timeStamp?: Date) {
    const orders = await this.prisma.order.findMany({
      where: {
        restaurantId,
        updatedAt: { gt: timeStamp }
      },
      include: { orderMenus: true },
      orderBy: {
        orderAt: 'asc'
      }
    });

    const latestTimestamp = orders.length > 0 ? orders[orders.length - 1].updatedAt : timeStamp ?? null

    return { orders, latestTimestamp }
  }

  async countActiveKitchenOrders(restaurantId: string): Promise<number> {
    const startOfDay = moment().tz('Asia/Bangkok').startOf('day').toDate();

    return this.prisma.order.count({
      where: {
        restaurantId,
        status: { in: [OrderStatus.sent, OrderStatus.accepted] },
        orderAt: { gte: startOfDay },
      },
    });
  }

  async findOneOrder(orderId: string, orderSecret?: string) {
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
              }
            }
          },
        }))

      if (!order) throw new NotFoundException("ไม่พบออเดอร์ที่ค้นหา");

      if (orderSecret && order.orderSecret !== orderSecret) throw new UnauthorizedException("ไม่สามารถเข้าถึงออเดอร์นี้ได้");

      return order;

    } catch (error) {
      if (error.code === "P2025") {
        throw new NotFoundException(`ไม่พบออเดอร์ที่มีID: ${orderId}`);
      }
      throw error;
    }
  }

  async updateOrderPaymentTx(tx: Prisma.TransactionClient, orderId: string, paymentStatus: PaymentStatus, paymentSlipImg?: string, paymentGatewayStatus?: string, transactionId?: string, paidAt?: Date) {
    const existing = await tx.order.findUnique({ where: { orderId } });
    if (!existing) throw new NotFoundException("ไม่พบออเดอร์");
    if (existing.paymentStatus === PaymentStatus.paid || existing.paymentGatewayStatus === "verified") return existing;

    try {
      const updatedOrder = await tx.order.update({
        where: { orderId },
        data: {
          paymentGatewayStatus: paymentGatewayStatus,
          transactionId: transactionId,
          paymentStatus: paymentStatus,
          paymentSlipImg: paymentSlipImg,
          paidAt: paidAt,
        }
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
            paidAt,
          }
        }
      );

      return updatedOrder
    } catch (error) {
      if (error.code === 'P2002' && error.meta?.target?.includes('transactionId')) {
        return await tx.order.findUnique({
          where: { transactionId }
        });
      }

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
          }
        }
      );

      throw error;
    }
  }

  async updateDelay(orderId: string, isDelay: boolean) {
    const order = await this.findOneOrder(orderId);

    if (order.isDelay) throw new BadRequestException("ออเดอร์นี้ถูกแจ้งล่าช้าแล้ว");
    if (!order.acceptAt) throw new BadRequestException("ออเดอร์นี้ยังไม่ได้รับ");

    const now = Date.now();
    const acceptedTime = new Date(order.acceptAt).getTime();
    const diffMinutes = (now - acceptedTime) / 1000 / 60;

    if (diffMinutes > 10) throw new BadRequestException("สามารถแจ้งล่าช้าได้ภายใน 10 นาทีหลังรับออเดอร์เท่านั้น");

    const updatedDeliverAt = new Date(order.deliverAt);
    updatedDeliverAt.setMinutes(updatedDeliverAt.getMinutes() + 10);

    const result = await this.prisma.order.update({
      where: { orderId },
      data: {
        isDelay: isDelay,
        deliverAt: updatedDeliverAt,
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
      }
    );

    return { result, message: `แจ้งส่งออเดอร์ล่าช้า10นาทีสำเร็จ` };
  }

  async updateOrderStatus(orderId: string, newStatus: OrderStatus) {
    const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
      sent: ["accepted", "cancelled", "rejected"],
      accepted: ["completed", "cancelled"],
      cancelled: [],
      rejected: [],
      completed: []
    };

    const result = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { orderId },
        include: { orderMenus: true }
      });

      if (!order) throw new NotFoundException("ไม่พบออเดอร์");
      if (order.status === newStatus) return { result: order, message: "สถานะเหมือนเดิม" };

      const allowed = ORDER_TRANSITIONS[order.status];
      if (!allowed || !allowed.includes(newStatus)) throw new BadRequestException(`ไม่สามารถเปลี่ยนสถานะจาก ${order.status} เป็น ${newStatus}`);

      const now = Date.now();
      const orderTime = new Date(order.orderAt).getTime();
      const diffMinutes = (now - orderTime) / 1000 / 60;

      if ((newStatus === "cancelled" || newStatus === "rejected") && diffMinutes > 5) throw new BadRequestException("สามารถยกเลิกหรือปฏิเสธออเดอร์ได้ภายใน 5 นาทีหลังสั่งเท่านั้น");

      const updateData: Prisma.OrderUpdateInput = { status: newStatus };

      if (newStatus === "cancelled") {
        updateData.cancelledAt = new Date();
      }

      if (newStatus === "rejected") {
        updateData.rejectedAt = new Date();
      }

      if (order.status !== "accepted" && newStatus === "accepted") {
        const ACCEPT_WINDOW_MS = 3 * 60 * 1000;
        if (Date.now() - order.orderAt.getTime() > ACCEPT_WINDOW_MS) throw new BadRequestException("เลยเวลาที่กำหนดในการรับออเดอร์")
        updateData.acceptAt = new Date();
        await this.handleInventoryDeduction(tx, order, order.orderMenus);
      }

      const updatedOrder = await tx.order.update({
        where: { orderId },
        data: updateData,
        select: {
          userId: true,
          orderId: true,
          restaurantId: true,
          status: true,
          paymentStatus: true,
          deliverAt: true,
          isDelay: true
        }
      });

      return { previousStatus: order.status, result: updatedOrder, message: `อัพเดทสถานะออเดอร์เป็น ${updatedOrder?.status} สำเร็จ` };
    });

    const prevStatus = result.previousStatus;
    const updatedStatus = result.result.status;
    if (updatedStatus === "accepted") {
      await this.analyticService.trackOrderEvent(
        EventName.order_accepted,
        result.result,
        {
          actor: EventActor.restaurant,
          order: {
            previousStatus: prevStatus,
            nextStatus: updatedStatus,
          },
        }
      );
    }

    if (result.result.status !== OrderStatus.sent) {
      await this.notificationService.stopRetriesForOrder(orderId).catch((error: unknown) => {
        const pushError = error as Error;
        this.logger.warn(`Failed to stop push retries for ${orderId}: ${pushError.message}`);
      });
    }

    return result;
  }

  private async handleInventoryDeduction(tx: Prisma.TransactionClient, order: Pick<Order, 'orderId' | 'restaurantId' | 'userId' | 'status' | 'paymentStatus'>, orderMenus: ValidatedOrderMenu[]) {
    const groupedMenus = new Map<string, { quantity: number; menuName: string, maxDaily: number }>();

    for (const item of orderMenus) {
      const existing = groupedMenus.get(item.menuId);

      if (existing) {
        existing.quantity += item.quantity;
      } else {
        groupedMenus.set(item.menuId, {
          quantity: item.quantity,
          menuName: item.menuName,
          maxDaily: item.maxDaily,
        });
      }
    }

    const outOfStockMenus: string[] = [];
    for (const [menuId, data] of groupedMenus.entries()) {
      const result = await this.inventoryService.deductInventoryTx(tx, menuId, data.quantity, data.menuName, data.maxDaily);

      if (result) outOfStockMenus.push(result);
    }

    if (outOfStockMenus.length > 0) {
      await this.analyticService.trackOrderEvent(
        EventName.order_rejected,
        order,
        {
          actor: EventActor.system,
          reason: "menu_out_of_stock",
          order: {
            previousStatus: order.status,
            nextStatus: OrderStatus.rejected,
          },
          inventory: {
            outOfStockMenus,
          },
        }
      );

      throw new BadRequestException(`เมนุดังต่อไปนี้หมด: ${outOfStockMenus.join(", ")}`);
    }
  }

  async cancelOrder(orderId: string, orderSecret: string) {
    const order = await this.prisma.order.findUnique({ where: { orderId } });
    if (!order) throw new NotFoundException("ไม่พบออเดอร์");
    if (order.orderSecret !== orderSecret) throw new UnauthorizedException("ไม่สามารถแก้ไขออเดอร์ที่ไม่ใช่ของคุณได้");
    if (order.status === OrderStatus.completed) throw new BadRequestException("ไม่สามารถยกเลิกออเดอร์ที่เสร็จแล้ว");
    if (order.status === OrderStatus.rejected) throw new BadRequestException("ออเดอร์นี้ถูกปฏิเสธไปแล้ว");
    if (order.status === OrderStatus.cancelled) {
      return { skipped: true as const, previousStatus: order.status, result: order, message: "ออเดอร์ถูกยกเลิกไปแล้ว" };
    }

    const { count } = await this.prisma.order.updateMany({
      where: {
        orderId,
        status: { in: [OrderStatus.sent, OrderStatus.accepted] },
      },
      data: {
        status: OrderStatus.cancelled,
        cancelledAt: new Date(),
      },
    });

    if (count === 0) {
      const latest = await this.prisma.order.findUniqueOrThrow({ where: { orderId } });
      return { skipped: true as const, previousStatus: latest.status, result: latest, message: "ออเดอร์ถูกยกเลิกไปแล้ว" };
    }

    const updatedOrder = await this.prisma.order.findUniqueOrThrow({
      where: { orderId },
      select: { orderId: true, restaurantId: true, userId: true, status: true, paymentStatus: true }
    });

    await this.notificationService.stopRetriesForOrder(orderId, 'cancelled_by_user').catch((error: unknown) => {
      const pushError = error as Error;
      this.logger.warn(`Failed to stop push retries for cancelled order ${orderId}: ${pushError.message}`);
    });

    await this.analyticService.trackOrderEvent(
      EventName.order_cancelled,
      updatedOrder,
      {
        actor: EventActor.user,
        reason: "user_cancelled",
        order: {
          previousStatus: order.status,
          nextStatus: updatedOrder.status,
        },
      }
    );

    return { skipped: false as const, previousStatus: order.status, result: updatedOrder, message: "ยกเลิกออเดอร์สำเร็จ" };
  }

  async expireOrder(orderId: string, orderSecret: string) {
    console.log("Expire order service activated")
    try {
      const order = await this.findOneOrder(orderId);
      if (order.orderSecret !== orderSecret) throw new UnauthorizedException("ไม่สามารถออเดอร์ที่ไม่ใช่ของคุณได้")

      const PAYMENT_EXPIRE_MS = 3 * 60 * 1000;
      const GRACE_MS = 3000;
      const isTimePassed = Date.now() - order.acceptAt.getTime() >= PAYMENT_EXPIRE_MS - GRACE_MS

      const isExpired =
        order.status === OrderStatus.accepted &&
        order.paymentStatus === PaymentStatus.unpaid &&
        order.acceptAt && isTimePassed;

      console.log("isExpired: ", isExpired);
      console.log(order.acceptAt.getTime())

      if (!isExpired) return;

      const { count } = await this.prisma.order.updateMany({
        where: {
          orderId,
          status: OrderStatus.accepted,
          paymentStatus: PaymentStatus.unpaid,
          acceptAt: { lt: new Date(Date.now() - 3 * 60 * 1000) },
        },
        data: {
          status: OrderStatus.cancelled,
          cancelledAt: new Date(),
        },
      });

      console.log("Count: ", count);
      if (count === 0) return;

      const updatedOrder = await this.prisma.order.findUniqueOrThrow({
        where: { orderId },
      });

      await this.analyticService.trackOrderEvent(
        EventName.order_expired,
        updatedOrder,
        {
          actor: EventActor.system,
          reason: "payment_timeout",
          order: {
            previousStatus: OrderStatus.accepted,
            nextStatus: OrderStatus.cancelled,
          },
        }
      );

      console.log("Successfully expire order")

    } catch (error) {
      this.logger.error(
        `Expire order failed (${orderId}): ${error.message}`,
      );
    }
  }

  async removeOrder(orderId: string) {
    const order = await this.findOneOrder(orderId);

    if (order.status !== OrderStatus.accepted) throw new BadRequestException('สามารถลบได้เฉพาะออเดอร์ที่มีสถ่านะเสร็จสมบูรณ์เรียบร้อยแล้วเท่านั้น');

    return this.prisma.order.delete({
      where: { orderId },
    });
  }


  @Cron('*/10 * * * *')
  async autoCompleteOrders() {
    const bufferMinutes = 10;
    const threshold = new Date(Date.now() - bufferMinutes * 60 * 1000);

    const result = await this.prisma.order.updateMany({
      where: {
        status: 'accepted',
        paymentStatus: PaymentStatus.paid,
        completedAt: null,
        deliverAt: { lt: threshold }
      },
      data: { status: 'completed', completedAt: new Date() }
    });

    if (result.count > 0) {
      await this.analyticService.trackEvent({
        name: EventName.order_completed,
        source: EventSource.cron_job,
        metadata: {
          actor: EventActor.cron_job,
          counts: {
            completed: result.count,
          },
        }
      });

      this.logger.log(`Auto completed ${result.count} orders`)
    }
  }

  @Cron('* * * * *')
  async autoRejectedOrder() {
    const now = new Date();
    const sentThreshold = new Date(Date.now() - 3 * 60 * 1000);

    try {
      const sentResult = await this.prisma.order.updateMany({
        where: { status: OrderStatus.sent, paymentStatus: PaymentStatus.unpaid, orderAt: { lt: sentThreshold } },
        data: { status: "rejected", rejectedAt: now }
      });
      if (sentResult.count > 0) {
        await this.analyticService.trackEvent({
          name: EventName.order_auto_rejected,
          source: EventSource.cron_job,
          metadata: {
            actor: EventActor.cron_job,
            reason: "restaurant_accept_timeout",
            counts: {
              rejected: sentResult.count,
            },
          },
        });

        this.logger.log(`Auto-rejected ${sentResult.count} unaccepted orders`);
      }
    } catch (error) {
      this.logger.error(`Auto-cancel (sent) failed: ${error.message}`);
    }
  }
}
