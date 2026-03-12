import {
  BadRequestException,
  Injectable,
  Inject,
  NotFoundException,
  InternalServerErrorException,
  ForbiddenException,
  Logger,
  forwardRef,
} from '@nestjs/common';
import { CreateOrderDto, CreateOrderMenusDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentStatus, OrderStatus, PaymentMethod } from '@prisma/client';
import { PaymentService } from 'src/payment/payment.service';
import { calculateWeeklyInterval } from 'src/payout/payout-calculator';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

import Decimal from 'decimal.js';
import { InventoryService } from 'src/inventory/inventory.service';
import { MenuService } from 'src/menu/menu.service';
import moment from 'moment-timezone';
import { PaymentPayload } from 'src/common/interface/accountType';
import { RestaurantService } from 'src/restaurant/restaurant.service';

@Injectable()
export class OrderService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => MenuService))
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
      totalPrice: number;
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
      totalPrice: number;
      menuImg?: string;
      details?: string;
    }[] = [];
  
    for (const item of orderMenus) {
      const existingMenu = menuMap.get(item.menuId);
  
      if (!existingMenu) {
        throw new NotFoundException(
          `Menu item with ID ${item.menuId} not found`,
        );
      }
  
      if (existingMenu.restaurantId !== restaurantId) {
        throw new BadRequestException(
          `Menu ${item.menuName} does not belong to this restaurant`,
        );
      }
  
      if (existingMenu.name !== item.menuName) {
        throw new BadRequestException(
          `Menu name mismatch for ${item.menuName}`,
        );
      }
  
      // SERVER calculates price
      const markupUnitPrice = toSatang(existingMenu.price * markupRate);
      const totalPrice = toSatang(markupUnitPrice * item.quantity);
  
      totalAmount += totalPrice;
  
      validatedMenus.push({
        menuId: item.menuId,
        menuName: existingMenu.name,
        quantity: item.quantity,
        unitPrice: markupUnitPrice,
        totalPrice,
        menuImg: item.menuImg,
        details: item.details,
      });
    }
  
    return {
      totalAmount: toSatang(totalAmount),
      validatedMenus,
    };
  }

  validateDeliveryTime(deliverTime: Date | string) {
    const nowBkk = moment().tz('Asia/Bangkok');
    const deliverAtBkk = moment(deliverTime).tz('Asia/Bangkok');

    const bufferMin = 5; // fixed 5-minute buffer at all times
    const diffMinutes = deliverAtBkk.diff(nowBkk, 'minutes'); // whole-minute difference

    if (diffMinutes < bufferMin) {
      throw new BadRequestException(
        `เวลารับอาหารต้องอยู่หลังจากเวลาปัจจุบันอย่างน้อย ${bufferMin} นาที`,
      );
    }
  }

  async createOrder(createOrderDto: CreateOrderDto, userId?: string) {
    this.validateDeliveryTime(createOrderDto.deliverAt);

    const { totalAmount, validatedMenus } = await this.validateOrderMenus(createOrderDto.orderMenus, createOrderDto.restaurantId);
    const restaurant = await this.restaurantService.findRestaurant(createOrderDto.restaurantId);

    const paymentData: PaymentPayload = {
      payload: {
        qrCode: createOrderDto.paymentSlipImg,
        checkCondition: {
          checkAmount: {
            type: "eq",
            amount: totalAmount.toString(),
          },
          checkDate: {
            type: "gte",
            date: createOrderDto.paidAt,
          },
          checkDuplicate: true,
          checkReceiver: [
            {
              accountNumber: restaurant.accountNumber.toString(),
              accountNameTH: restaurant.accountHolderFullName,
            }
          ]
        }
      }
    }

    const paymentResult = await this.paymentService.verifyPayment(paymentData);
    if (!paymentResult?.success) throw new BadRequestException("Payment verification failed");

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

      // Deduct inventory per unique menu
      for (const [menuId, data] of groupedMenus.entries()) {
        const result = await this.inventoryService.deductInventoryTx(tx, menuId, data.quantity, data.menuName);

        if (result) outOfStockMenus.push(result)
      }

      if (outOfStockMenus.length > 0) throw new BadRequestException(`เมนูต่อไปนี้หมด: ${outOfStockMenus.join(", ")}`)

      const order = await tx.order.create({
        data: {
          userId: userId ?? null,
          restaurantId: createOrderDto.restaurantId,
          deliverAt: createOrderDto.deliverAt,
          paymentStatus: PaymentStatus.paid,
          paymentSlipImg: createOrderDto.paymentSlipImg,
          acceptAt: new Date(),
          paidAt: createOrderDto.paidAt,
          userTel: createOrderDto.userTel,
          paymentId: paymentResult.referenceId ?? uuidv4(),
          paymentGatewayStatus: 'verified',
          totalAmount: totalAmount,
          orderMenus: {
            create: validatedMenus.map((item) => ({
              quantity: item.quantity,
              menuName: item.menuName,
              unitPrice: item.unitPrice,
              menuImg: item.menuImg,
              details: item.details,
              totalPrice: new Decimal(item.totalPrice),
              menu: { connect: { menuId: item.menuId } },
            })),
          },
        },
        include: { orderMenus: true },
      });

      return order;
    });

    return order;
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

    console.log('New orders: ', orders)
    console.log('Latest timestamp: ', latestTimestamp)

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

  async findWeeklyOrderForRestaurant(restaurantId: string) {
    const now = new Date();
    const { startDate, endDate } = calculateWeeklyInterval(now);
    try {
      const orders = await this.prisma.order.findMany({
        where: {
          restaurantId,
          deliverAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        orderBy: {
          deliverAt: 'desc',
        },
        select: {
          orderId: true,
          totalAmount: true,
          paymentStatus: true,
          orderAt: true,
          deliverAt: true,
          status: true,
        },
      });

      return orders;
    } catch (error) {
      this.logger.error(
        'Error finding weekly orders: ',
        error.message,
        error.stack,
      );
      throw new InternalServerErrorException(
        'Finding weekly orders failed. Please try again.',
      );
    }
  }

  async updateOrder(orderId: string, updateOrderDto: UpdateOrderDto) {
    const order = await this.findOneOrder(orderId);

    if (order.restaurantId !== updateOrderDto.restaurantId) {
      throw new ForbiddenException(
        'You do not have permission to update this order.',
      );
    }

    if (
      updateOrderDto.status &&
      !Object.values(OrderStatus).includes(updateOrderDto.status)
    ) {
      throw new BadRequestException('Invalid order status');
    }

    return this.prisma.order.update({
      where: { orderId },
      data: {
        status: updateOrderDto.status,
        deliverAt: updateOrderDto.deliverAt,
        isDelay: updateOrderDto.isDelay,
      },
    });
  }

  async updateDelay(orderId: string, updateOrderDto: UpdateOrderDto) {
    const order = await this.findOneOrder(orderId);

    const updatedDeliverAt = order.deliverAt;
    updatedDeliverAt.setMinutes(updatedDeliverAt.getMinutes() + 10);

    const result = await this.prisma.order.update({
      where: { orderId },
      data: {
        isDelay: updateOrderDto.isDelay,
        deliverAt: updatedDeliverAt,
      },
    });

    return { result, message: `Successfully update delay status for 10 mins` };
  }

  async updateOrderPaymentStatus(orderId: string, status: PaymentStatus) {
    try {
      this.logger.log(`Update order payment status function is activated!`);
      const updatePaymentOrder = await this.prisma.order.update({
        where: { orderId },
        data: {
          paymentStatus: { set: status },
        },
      });

      this.logger.log(`Update payment status too: ${updatePaymentOrder.paymentStatus}`);
      return updatePaymentOrder;
    } catch (err) {
      this.logger.log(`Failed to update order payment status ${err}`);
    }
  }

  async updateOrderStatus(orderId: string, status: OrderStatus) {
    const order = await this.findOneOrder(orderId);

    // if (order.isPaid === PaymentStatus.unpaid) {
    //   throw new ConflictException('Only paid order can be marked as done');
    // }

    const result = await this.prisma.order.update({
      where: { orderId },
      data: {
        status: status,
      },
      select: { orderId: true, status: true, deliverAt: true },
    });

    return {
      result,
      message: `Successfully update order status to ${result.status} `,
    };
  }

  async removeOrder(orderId: string) {
    const order = await this.findOneOrder(orderId);

    if (order.status !== OrderStatus.accepted) {
      throw new BadRequestException(
        'สามารถลบได้เฉพาะออเดอร์ที่มีสถ่านะเสร็จสมบูรณ์เรียบร้อยแล้วเท่านั้น',
      );
    }

    return this.prisma.order.delete({
      where: { orderId },
    });
  }
}
