import {
  BadRequestException,
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
  Logger,
  forwardRef,
  UnauthorizedException,
} from '@nestjs/common';
import { CreateOrderDto, CreateOrderMenusDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentStatus, OrderStatus, Order, Prisma } from '@prisma/client';
import { Cron } from '@nestjs/schedule';

import { InventoryService } from 'src/inventory/inventory.service';
import moment from 'moment-timezone';
import { RestaurantService } from 'src/restaurant/restaurant.service';
import { Decimal } from '@prisma/client/runtime/client';
import { NotificationService } from 'src/notification/notification.service';

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

  async validateDeliveryTime(restaurantId: string, deliverTime: Date) {
    const nowBkk = moment().tz('Asia/Bangkok');
    const deliverAtBkk = moment(deliverTime).tz('Asia/Bangkok');

    const { avgCookingTime } = await this.restaurantService.findRestaurant(restaurantId);
    const ACCEPT_WINDOW_MINS = 3;
    const PAYMENT_WINDOW_MINS = 3;
    const bufferMins = avgCookingTime + ACCEPT_WINDOW_MINS + PAYMENT_WINDOW_MINS;
    const diffMinutes = deliverAtBkk.diff(nowBkk, 'minutes');

    if (diffMinutes < bufferMins) throw new BadRequestException(`เวลารับอาหารต้องอยู่หลังจากเวลาปัจจุบันอย่างน้อย ${bufferMins} นาที`);
  }

  async createOrder(createOrderDto: CreateOrderDto, userId?: string): Promise<Order> {
    await this.validateDeliveryTime(createOrderDto.restaurantId, createOrderDto.deliverAt);

    const { totalAmount, validatedMenus } = await this.validateOrderMenus(createOrderDto.orderMenus, createOrderDto.restaurantId);

    try {
      const order = await this.prisma.$transaction(async (tx) => {
        const order = await tx.order.create({
          data: {
            userId: userId ?? null,
            restaurantId: createOrderDto.restaurantId,
            deliverAt: createOrderDto.deliverAt,
            paymentStatus: PaymentStatus.unpaid,
            userTel: createOrderDto.userTel,
            updatedAt: new Date(),
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

        return order;
      });

      await this.notificationService.queueOrderCreated(order.orderId).catch((error: unknown) => {
        const pushError = error as Error;
        this.logger.warn(`Order created but push queue failed: ${pushError.message}`);
      });

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

  async updateOrder(orderId: string, updateOrderDto: UpdateOrderDto) {
    const order = await this.findOneOrder(orderId);

    if (order.restaurantId !== updateOrderDto.restaurantId) throw new ForbiddenException('คุณไม่ได้รับอนุญ่ติให้อัพเดทออเดอร์นี้');
    if (updateOrderDto.status && !Object.values(OrderStatus).includes(updateOrderDto.status)) throw new BadRequestException('สถานะออดเอร์ไม่ถูกต้อง');

    return this.prisma.order.update({
      where: { orderId },
      data: {
        status: updateOrderDto.status,
        deliverAt: updateOrderDto.deliverAt,
        isDelay: updateOrderDto.isDelay,
      },
    });
  }

  async updateOrderPaymentTx(tx: Prisma.TransactionClient, orderId: string, paymentStatus: PaymentStatus, paymentSlipImg?: string, paymentGatewayStatus?: string, transactionId?: string, paidAt?: Date) {
    const existing = await tx.order.findUnique({ where: { orderId } });
    if (!existing) throw new NotFoundException("ไม่พบออเดอร์");
    if (existing.paymentStatus === PaymentStatus.paid || existing.paymentGatewayStatus === "verified") return existing;

    try {
      return await tx.order.update({
        where: { orderId },
        data: {
          paymentGatewayStatus: paymentGatewayStatus,
          transactionId: transactionId,
          paymentStatus: paymentStatus,
          paymentSlipImg: paymentSlipImg,
          paidAt: paidAt,
        }
      });
    } catch (error) {
      if (error.code === 'P2002' && error.meta?.target?.includes('transactionId')) {
        return await tx.order.findUnique({
          where: { transactionId }
        });
      }
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
        await this.handleInventoryDeduction(tx, order.orderMenus);
      }

      const updatedOrder = await tx.order.update({
        where: { orderId },
        data: updateData,
        select: {
          orderId: true,
          status: true,
          paymentStatus: true,
          deliverAt: true,
          isDelay: true
        }
      });

      return { result: updatedOrder, message: `อัพเดทสถานะออเดอร์เป็น ${updatedOrder?.status} สำเร็จ` };
    });

    if (result.result.status !== OrderStatus.sent) {
      await this.notificationService.stopRetriesForOrder(orderId).catch((error: unknown) => {
        const pushError = error as Error;
        this.logger.warn(`Failed to stop push retries for ${orderId}: ${pushError.message}`);
      });
    }

    return result;
  }

  private async handleInventoryDeduction(tx: Prisma.TransactionClient, orderMenus: ValidatedOrderMenu[]) {
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

    if (outOfStockMenus.length > 0) throw new BadRequestException(`เมนุดังต่อไปนี้หมด: ${outOfStockMenus.join(", ")}`);
  }

  async cancelOrder(orderId: string, orderSecret: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { orderId },
      });

      if (!order) throw new NotFoundException("ไม่พบออเดอร์");
      if (order.orderSecret !== orderSecret) throw new UnauthorizedException("ไม่สามารถยกเลิกออเดอร์ที่ไม่ใช่ของคุณได้")

      if (order.status === "completed") throw new BadRequestException("ไม่สามารถยกเลิกออเดอร์ที่เสร็จแล้ว");
      if (order.status === "cancelled") throw new BadRequestException("ออเดอร์ถูกยกเลิกไปแล้ว");

      const updatedorder = await tx.order.update({
        where: { orderId },
        data: {
          status: "cancelled",
          cancelledAt: new Date()
        },
        select: { orderId: true, status: true, paymentStatus: true }
      });

      return { result: updatedorder, message: "ยกเลิกออเดอร์สำเร็จ" }
    })

    await this.notificationService.stopRetriesForOrder(orderId, 'cancelled_by_user').catch((error: unknown) => {
      const pushError = error as Error;
      this.logger.warn(`Failed to stop push retries for cancelled order ${orderId}: ${pushError.message}`);
    });

    return result;
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
        completedAt: null,
        deliverAt: { lt: threshold }
      },
      data: { status: 'completed', completedAt: new Date() }
    });

    if (result.count > 0) this.logger.log(`Auto completed ${result.count} orders`)
  }

  @Cron('*/3 * * * *')
  async autoCancelledOrders() {
    const now = new Date();
    const sentThreshold = new Date(Date.now() - 3 * 60 * 1000);
    const acceptedThreshold = new Date(Date.now() - 3 * 60 * 1000);

    try {
      const sentResult = await this.prisma.order.updateMany({
        where: { status: "sent", paymentStatus: "unpaid", orderAt: { lt: sentThreshold } },
        data: { status: "rejected", rejectedAt: now }
      });
      if (sentResult.count > 0) this.logger.log(`Auto-rejected ${sentResult.count} unaccepted orders`);
    } catch (e) {
      this.logger.error(`Auto-cancel (sent) failed: ${e.message}`);
    }

    try {
      const acceptedResult = await this.prisma.order.updateMany({
        where: {
          status: "accepted", paymentStatus: "unpaid", acceptAt: { lt: acceptedThreshold },
          NOT: [
            { status: { in: ["cancelled", "rejected", "completed"] } },
            { paymentStatus: "paid" }
          ]
        },
        data: { status: "cancelled", cancelledAt: now }
      });;

      this.logger.log("Cron result: ", acceptedResult);
      if (acceptedResult.count > 0) this.logger.log(`Auto-cancelled ${acceptedResult.count} unpaid orders`);
    } catch (e) {
      this.logger.error(`Auto-cancel (accepted) failed: ${e.message}`);
    }
  }
}
