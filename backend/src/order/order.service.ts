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
import { UpdateOrderDto } from './dto/update-order.dto';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentStatus, OrderStatus, Order, Prisma } from '@prisma/client';
import { PaymentService } from 'src/payment/payment.service';
import { Cron } from '@nestjs/schedule';

import { InventoryService } from 'src/inventory/inventory.service';
import moment from 'moment-timezone';
import { PaymentPayload, toAccountType } from 'src/common/interface/accountType';
import { RestaurantService } from 'src/restaurant/restaurant.service';
import { Decimal } from '@prisma/client/runtime/client';
import { PayoutService } from 'src/payout/payout.service';

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
    private readonly paymentService: PaymentService,
    private readonly payoutService: PayoutService,
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
      if (existingMenu.restaurantId !== restaurantId) throw new BadRequestException(`เมนู ${item.menuName} ไม่ใช่ของร้านนี้`);

      // SERVER calculates price
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

  validateDeliveryTime(deliverTime: Date) {
    const nowBkk = moment().tz('Asia/Bangkok');
    const deliverAtBkk = moment(deliverTime).tz('Asia/Bangkok');

    const bufferMin = 5; // fixed 5-minute buffer at all times
    const diffMinutes = deliverAtBkk.diff(nowBkk, 'minutes'); // whole-minute difference

    if (diffMinutes < bufferMin) throw new BadRequestException(`เวลารับอาหารต้องอยู่หลังจากเวลาปัจจุบันอย่างน้อย ${bufferMin} นาที`);
  }

  async createOrder(createOrderDto: CreateOrderDto, userId?: string): Promise<Order> {
    this.validateDeliveryTime(createOrderDto.deliverAt);

    const { totalAmount, validatedMenus } = await this.validateOrderMenus(createOrderDto.orderMenus, createOrderDto.restaurantId);
    const { accountNumber, bankAccount } = await this.restaurantService.findRestaurant(createOrderDto.restaurantId);

    const accountType = toAccountType(bankAccount);
    if (!accountType) throw new ConflictException("บัญชีธนาคารไม่ถูกต้อง")

    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const paymentData: PaymentPayload = {
      payload: {
        imageBase64: createOrderDto.paymentSlipImg,
        checkCondition: {
          checkAmount: {
            type: "eq",
            amount: totalAmount.toString(),
          },
          checkDate: {
            type: "gte",
            date: fiveMinutesAgo,
          },
          checkDuplicate: true,
          checkReceiver: [
            {
              accountType: accountType,
              accountNumber: accountNumber.toString(),
            }
          ]
        }
      }
    }

    this.logger.debug(`Sending account type: ${accountType}`);
    this.logger.debug(`Sending account number${accountNumber.toString()}`)

    const paymentResult = await this.paymentService.verifyPayment(paymentData);
    this.logger.log("Payment result: ", paymentResult);
    if (!paymentResult?.data?.dateTime) throw new BadRequestException("ข้อมูลการชำระเงินไม่สมบูรณ์");

    const paymentTime = new Date(paymentResult.data.dateTime)
    if (Date.now() - paymentTime.getTime() > 5 * 60 * 1000) throw new BadRequestException("เวลาในการชำระเงินหมดอายุ กรุณาทำรายการใหม่")

    try {
      const order = await this.prisma.$transaction(async (tx) => {
        const order = await tx.order.create({
          data: {
            userId: userId ?? null,
            restaurantId: createOrderDto.restaurantId,
            deliverAt: createOrderDto.deliverAt,
            paymentStatus: PaymentStatus.paid,
            paymentSlipImg: createOrderDto.paymentSlipImg,
            paidAt: paymentTime,
            userTel: createOrderDto.userTel,
            paymentId: paymentResult.data.transRef,
            paymentGatewayStatus: 'verified',
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

      return order;
    } catch (error) {
      if (error.code === "P2002") throw new BadRequestException("ชำระเงินซ้ำ/ใช้สลิปเก่า")

      throw error
    }
  }

  async findRestaurantTodayOrders(restaurantId: string) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1)

    const orders = await this.prisma.order.findMany({
      where: { restaurantId, orderAt: { gte: yesterday } },
      include: { orderMenus: true },
      orderBy: {
        deliverAt: 'asc',
      },
    });

    const latestTimestamp = orders.length > 0 
      ? orders.reduce((latest, order) => 
        order.orderAt > latest ? order.orderAt : latest, orders[0].orderAt) : new Date();

    return { orders, latestTimestamp }
  }

  async getOrdersAfterTimeStamp(restaurantId: string, timeStamp?: Date) {
    const orders = await this.prisma.order.findMany({
      where: {
        restaurantId,
        orderAt: { gte: timeStamp }
      },
      include: { orderMenus: true },
      orderBy: {
        orderAt: 'asc'
      }
    });

    const latestTimestamp = orders.length > 0 ? orders[orders.length - 1].orderAt : timeStamp ?? null

    return { orders, latestTimestamp }
  }

  async findOneOrder(orderId: string, orderSecret?: string) {
    try {
      const order = await this.prisma.order.findUnique({
        where: { orderId },
        include: { orderMenus: true },
      });

      if (!order) throw new NotFoundException("ไม่พบออเดอร์ที่ค้นหา");

      // Only check secret if provided
      if (orderSecret !== undefined && order.orderSecret !== orderSecret) throw new UnauthorizedException("ไม่สามารถเข้าถึงออเดอร์นี้ได้");

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
      accepted: ["completed"],
      cancelled: [],
      rejected: [],
      completed: []
    };

    return await this.prisma.$transaction(async (tx) => {
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
        updateData.paymentStatus = "refund_pending";
      }

      if (newStatus === "rejected") {
        updateData.rejectedAt = new Date();
        updateData.paymentStatus = "refund_pending";
      }

      if (order.status !== "accepted" && newStatus === "accepted") {
        updateData.acceptAt = new Date();
        await this.handleInventoryDeduction(tx, order.orderMenus);
        await this.payoutService.createPayoutTx(tx, order.orderId);
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
    return await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { orderId },
      });

      if (!order) throw new NotFoundException("ไม่พบออเดอร์");

      if (order.orderSecret !== orderSecret) throw new UnauthorizedException("ไม่สามารถยกเลิกออเดอร์ที่ไม่ใช่ของคุณได้")

      if (order.status === "accepted") throw new BadRequestException("ร้านกำลังเตรียมอาหาร ไม่สามารถยกเลิกได้");
      if (order.status === "completed") throw new BadRequestException("ไม่สามารถยกเลิกออเดอร์ที่เสร็จแล้ว");
      if (order.status === "cancelled") throw new BadRequestException("ออเดอร์ถูกยกเลิกไปแล้ว");

      const updatedorder = await tx.order.update({
        where: { orderId },
        data: {
          status: "cancelled",
          paymentStatus: "refund_pending",
          cancelledAt: new Date()
        },
        select: { orderId: true, status: true, paymentStatus: true }
      });

      return { result: updatedorder, message: "ยกเลิกออเดอร์สำเร็จ" }
    })
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
        deliverAt: { lt: threshold }
      },
      data: { status: 'completed', completedAt: new Date() }
    });

    if (result.count > 0) this.logger.log(`Auto completed ${result.count} orders`)
  }

  @Cron('*/5 * * * *')
  async autoCancelledOrders() {
    const threshold = new Date(Date.now() - 5 * 60 * 1000);
    const result = await this.prisma.order.updateMany({
      where: {
        status: "sent",
        paymentStatus: "paid",
        orderAt: { lt: threshold }
      },
      data: {
        status: "cancelled",
        paymentStatus: "refund_pending",
        cancelledAt: new Date()
      }
    });

    if (result.count > 0) this.logger.log(`Auto-cancelled ${result.count} orders`);
  }
}
