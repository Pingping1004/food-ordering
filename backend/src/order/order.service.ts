import {
  BadRequestException,
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
  Logger,
  forwardRef,
} from '@nestjs/common';
import { CreateOrderDto, CreateOrderMenusDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentStatus, OrderStatus, PaymentMethod } from '@prisma/client';
import { PaymentService } from 'src/payment/payment.service';
import { Cron } from '@nestjs/schedule';
import { calculateWeeklyInterval } from 'src/payout/payout-calculator';

import { InventoryService } from 'src/inventory/inventory.service';
import moment from 'moment-timezone';
import { PaymentPayload } from 'src/common/interface/accountType';
import { RestaurantService } from 'src/restaurant/restaurant.service';

@Injectable()
export class OrderService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => RestaurantService))
    private readonly restaurantService: RestaurantService,
    @Inject(forwardRef(() => InventoryService))
    private readonly inventoryService: InventoryService,
    private readonly paymentService: PaymentService,
  ) { }

  private readonly logger = new Logger('OrderService');


  async validateExisting(params: {
    restaurantId: string;
    orderMenus: CreateOrderMenusDto[];
  }): Promise<void> {
    const { restaurantId, orderMenus } = params;

    // 1. Validate restaurant
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { restaurantId },
    });

    if (!restaurant) throw new BadRequestException(`ไม่พบร้านอาหารที่ระบุ`);

    // 2. Validate all menuIds are valid under single restaurant
    await Promise.all(
      orderMenus.map(async (menu) => {
        const existingMenu = await this.prisma.menu.findFirst({
          where: {
            restaurantId,
            menuId: menu.menuId,
          },
        });

        // 3. Check that user order the existingMenu not the non exist one
        if (!existingMenu)
          throw new Error(`ไม่พบเมนูรหัส ${menu.menuId} จากร้านที่เลือก`);
      }),
    );
  }

  async validateOrderMenus(
    orderMenus: CreateOrderMenusDto[],
    restaurantId: string,
  ): Promise<{
    totalAmount: number;
    validatedMenus: {
      menuId: string;
      menuName: string;
      quantity: number;
      unitPrice: number;
      menuImg?: string;
      details?: string;
    }[];
  }> {
    const markupRate = 1 + Number(process.env.SELL_PRICE_MARKUP_RATE);

    const menuIds = orderMenus.map((m) => m.menuId);
    const menus = await this.prisma.menu.findMany({
      where: {
        menuId: { in: menuIds },
      },
    });

    const menuMap = new Map(menus.map((m) => [m.menuId, m]));

    const toSatang = (amount: number) => Math.round(amount * 100) / 100;
    let totalAmount = 0;

    const validatedMenus: {
      menuId: string;
      menuName: string;
      quantity: number;
      unitPrice: number;
      menuImg?: string;
      details?: string;
    }[] = [];

    for (const item of orderMenus) {
      const existingMenu = menuMap.get(item.menuId);

      if (!existingMenu) throw new NotFoundException(`ไม่พบเมนู`);
      if (existingMenu.restaurantId !== restaurantId) throw new BadRequestException(`เมนู ${item.menuName} ไม่ใช่ของร้านนี้`);
      if (existingMenu.name !== item.menuName) throw new BadRequestException(`ชื่อเมนูไม่ตรง: ${item.menuName}`);

      // SERVER calculates price
      const markupUnitPrice = toSatang(existingMenu.price * markupRate);
      const totalPrice = toSatang(markupUnitPrice * item.quantity);

      totalAmount += totalPrice;

      validatedMenus.push({
        menuId: item.menuId,
        menuName: existingMenu.name,
        quantity: item.quantity,
        unitPrice: markupUnitPrice,
        menuImg: item.menuImg,
        details: item.details,
      });
    }

    return {
      totalAmount: toSatang(totalAmount),
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

  async createOrder(createOrderDto: CreateOrderDto, userId?: string) {
    this.validateDeliveryTime(createOrderDto.deliverAt);

    const { totalAmount, validatedMenus } = await this.validateOrderMenus(createOrderDto.orderMenus, createOrderDto.restaurantId);
    const { accountNumber } = await this.restaurantService.findRestaurant(createOrderDto.restaurantId);

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
              accountType: "01004", // Later use the bank that is platform account
              accountNumber: accountNumber.toString(), // Use the static accountNumber from platform account
            }
          ]
        }
      }
    }

    const paymentResult = await this.paymentService.verifyPayment(paymentData);
    if (paymentResult.code !== "200200") throw new BadRequestException("ยืนยันการชำระเงินล้มเหลว");
    if (!paymentResult?.data?.dateTime) throw new BadRequestException("ข้อมูลการชำระเงินไม่สมบูรณ์");

    const paymentTime = new Date(paymentResult.data.dateTime)

    if (Date.now() - paymentTime.getTime() > 5 * 60 * 1000) {
      throw new BadRequestException("เวลาในการชำระเงินหมดอายุ กรุณาทำรายการใหม่")
    }

    try {
      const order = await this.prisma.$transaction(async (tx) => {
        const outOfStockMenus: string[] = [];

        // Group duplicate menuIds
        const groupedMenus = new Map<string, { quantity: number; menuName: string }>();

        for (const item of createOrderDto.orderMenus) {
          const existing = groupedMenus.get(item.menuId);

          if (existing) {
            existing.quantity += item.quantity;
          } else {
            groupedMenus.set(item.menuId, {
              quantity: item.quantity,
              menuName: item.menuName,
            });
          }
        }

        if (outOfStockMenus.length > 0) throw new BadRequestException(`เมนูต่อไปนี้หมด: ${outOfStockMenus.join(", ")}`)

        const order = await tx.order.create({
          data: {
            userId: userId ?? null,
            restaurantId: createOrderDto.restaurantId,
            deliverAt: createOrderDto.deliverAt,
            paymentStatus: PaymentStatus.paid,
            paymentSlipImg: createOrderDto.paymentSlipImg,
            paidAt: new Date(paymentResult.data.dateTime),
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

  async findRestaurantOrders(restaurantId: string) {
    return this.prisma.order.findMany({
      where: { restaurantId },
      include: { orderMenus: true },
      orderBy: {
        deliverAt: 'asc',
      },
    });
  }

  async getOrdersAfterTimeStamp(restaurantId: string, timeStamp?: Date) {
    const orders = await this.prisma.order.findMany({
      where: {
        restaurantId,
        orderAt: {
          gt: timeStamp
        }
      },
      include: { orderMenus: true },
      orderBy: {
        orderAt: 'asc'
      }
    });

    const latestTimestamp = orders.length > 0 ? orders[orders.length - 1].orderAt : timeStamp ?? null

    return { orders, latestTimestamp }
  }

  async findOneOrder(orderId: string) {
    try {
      const order = await this.prisma.order.findUnique({
        where: { orderId },
        include: { orderMenus: true },
      });

      if (!order) throw new NotFoundException('ไม่พบออเดอร์ที่ค้นหา');

      await this.validateExisting({
        restaurantId: order.restaurantId,
        orderMenus: order.orderMenus.map((menu) => ({
          menuId: menu.menuId,
          quantity: menu.quantity,
          menuName: menu.menuName,
          unitPrice: menu.unitPrice,
          menuImg: menu.menuImg || '',
        })),
      });

      return order;
    } catch (error) {
      if (error.code === 'P2025') {
        // Prisma "Record not found"
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

  async updateOrderStatus(orderId: string, status: OrderStatus) {
    return await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { orderId },
        include: { orderMenus: true }
      });

      if (!order) throw new NotFoundException("ไม่พบออเดอร์");

      const outOfStockMenus: string[] = []

      if (status === "accepted") {
        const groupedMenus = new Map<string, { quantity: number; menuName: string }>()

        for (const item of order.orderMenus) {
          const existing = groupedMenus.get(item.menuId);

          if (existing) {
            existing.quantity += item.quantity;
          } else {
            groupedMenus.set(item.menuId, {
              quantity: item.quantity,
              menuName: item.menuName
            });
          }
        }

        for (const [menuId, data] of groupedMenus.entries()) {
          const result = await this.inventoryService.deductInventoryTx(tx, menuId, data.quantity, data.menuName);
          if (result) outOfStockMenus.push(result)
        }

        if (outOfStockMenus.length > 0) throw new BadRequestException(`เมนุดังต่อไปนี้หมด: ${outOfStockMenus.join(", ")}`)
      }

      const updatedOrder = await tx.order.update({
        where: { orderId },
        data: { status },
        select: { orderId: true, status: true, deliverAt: true, isDelay: true }
      });

      return { result: updatedOrder, message: `อัพเดทสถานะออเดอร์เป็น ${updatedOrder.status} สำเร็จ` }
    })
  }

  async removeOrder(orderId: string) {
    const order = await this.findOneOrder(orderId);

    if (order.status !== OrderStatus.accepted) throw new BadRequestException('สามารถลบได้เฉพาะออเดอร์ที่มีสถ่านะเสร็จสมบูรณ์เรียบร้อยแล้วเท่านั้น');

    return this.prisma.order.delete({
      where: { orderId },
    });
  }

  @Cron('*/5 * * * *')
  async autoCompleteOrders() {
    const bufferMinutes = 15;
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

  @Cron('*/15 * * * *')
  async autoCancelledOrders() {
    const threshold = new Date(Date.now() - 15 * 60 * 1000);
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
