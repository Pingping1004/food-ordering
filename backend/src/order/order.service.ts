import {
  BadRequestException,
  Injectable,
  Inject,
  NotFoundException,
  InternalServerErrorException,
  ForbiddenException,
  Logger,
  ConflictException,
  forwardRef,
} from '@nestjs/common';
import { CreateOrderDto, CreateOrderMenusDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentStatus, OrderStatus, PaymentMethod } from '@prisma/client';
import { PaymentService } from 'src/payment/payment.service';
import { calculateWeeklyInterval } from 'src/payout/payout-calculator';
import axios from 'axios';

import Decimal from 'decimal.js';
import { InventoryService } from 'src/inventory/inventory.service';
import { MenuService } from 'src/menu/menu.service';
import moment from 'moment-timezone';

@Injectable()
export class OrderService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => MenuService))
    private readonly menuService: MenuService,
    @Inject(forwardRef(() => InventoryService))
    private readonly inventoryService: InventoryService,
    // private readonly paymentService: PaymentService,
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
  ): Promise<number> {
    let calculatedTotalAmount = 0;
    const markupRate: number = 1 + Number(process.env.SELL_PRICE_MARKUP_RATE);

    for (const item of orderMenus) {
      const existingMenu = await this.prisma.menu.findUnique({
        where: { menuId: item.menuId },
      });

      if (!existingMenu) {
        throw new NotFoundException(
          `Menu item with ID ${item.menuName} not found.`,
        );
      }

      if (existingMenu.restaurantId !== restaurantId) {
        throw new BadRequestException(
          `Menu item ${item.menuName} does not belong to the selected restaurant.`,
        );
      }

      const markupUnitPrice = (markupRate * existingMenu.price); // Calculated Price from backend
      const actualTotalPrice = (markupUnitPrice * item.quantity); // Backend total price
      const orderTotalPrice = (item.unitPrice * item.quantity); // Total price from user input

      const toSatang = (amount: number) => Math.round(amount * 100);
      const isEqual: boolean = toSatang(actualTotalPrice) === toSatang(orderTotalPrice);

      if (!isEqual) {
        this.logger.log(`Markup unit price: ${markupUnitPrice}`);
        this.logger.log(`Unitprice: ${markupUnitPrice}`);

        this.logger.log(`Order total price: ${orderTotalPrice}`);
        this.logger.log(`Actual total price: ${actualTotalPrice}`);
        throw new BadRequestException(
          `Mismatched price for menu ${item.menuName}. Expected ${actualTotalPrice}, got ${orderTotalPrice}`,
        );
      }

      if (existingMenu.name !== item.menuName) {
        throw new NotFoundException(
          `Name ${item.menuName} not found in the menu.`,
        );
      }

      calculatedTotalAmount += item.unitPrice * item.quantity;
    }
    return calculatedTotalAmount;
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

    const calculatedTotalAmount = await this.validateOrderMenus(createOrderDto.orderMenus, createOrderDto.restaurantId);

    const order = await this.prisma.$transaction(async (tx) => {
      const outOfStockMenus: string[] = [];

      // Group duplicate menuIds
      const groupedMenus = new Map<
        string,
        { quantity: number; menuName: string }
      >();

      for (const item of createOrderDto.orderMenus) {
        if (!groupedMenus.has(item.menuId)) {
          groupedMenus.set(item.menuId, {
            quantity: item.quantity,
            menuName: item.menuName,
          });
        } else {
          groupedMenus.get(item.menuId)!.quantity += item.quantity;
        }
      }

      // Deduct inventory per unique menu
      for (const [menuId, data] of groupedMenus.entries()) {
        const result = await this.inventoryService.deductInventoryTx(
          tx,
          menuId,
          data.quantity,
          data.menuName
        );

        if (result) {
          outOfStockMenus.push(result);
        }
      }

      if (outOfStockMenus.length > 0) throw new BadRequestException(`เมนูต่อไปนี้หมด: ${outOfStockMenus.join(", ")}`)

      const order = await tx.order.create({
        data: {
          userId: userId || null,
          restaurantId: createOrderDto.restaurantId,
          deliverAt: createOrderDto.deliverAt,
          isPaid: PaymentStatus.unpaid,
          paymentMethod: createOrderDto.paymentMethod,
          userTel: createOrderDto.userTel,
          userEmail: createOrderDto.userEmail,
          paymentGatewayStatus: 'pending',
          totalAmount: calculatedTotalAmount,
          orderMenus: {
            create: createOrderDto.orderMenus.map((item) => ({
              quantity: item.quantity,
              menuName: item.menuName,
              unitPrice: item.unitPrice,
              menuImg: item.menuImg,
              details: item.details,
              totalPrice: new Decimal(item.unitPrice * item.quantity),
              menu: { connect: { menuId: item.menuId } },
            })),
          },
        },
        include: {
          orderMenus: true,
        },
      });

      return order;
    });

    if (!process.env.AUTOMATION_WEBHOOK_URL) throw new NotFoundException('Not found automation webhook URL');

    try {
      const payload = {
        orderId: order.orderId,
        userTel: order.userTel,
        deliverAt: order.deliverAt.toISOString(),
        totalAmount: order.totalAmount.toNumber(),
        orderMenus: order.orderMenus.map(item => ({
          menuId: item.menuId,
          quantity: item.quantity,
          menuName: item.menuName,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice.toNumber(),
        })),
      };

      await axios.post(process.env.AUTOMATION_WEBHOOK_URL, payload);
    } catch (error) {
      console.warn('⚠️ Order created but Make webhook failed:', error.message);
    }

    return order;
  }

  async findRestaurantOrders(restaurantId: string) {
    return this.prisma.order.findMany({
      where: { restaurantId },
      include: { orderMenus: true },
      orderBy: {
        deliverAt: 'desc',
      },
    });
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
          totalPrice: menu.totalPrice,
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
          isPaid: true,
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
          isPaid: { set: status },
        },
      });

      this.logger.log(`Update payment status too: ${updatePaymentOrder.isPaid}`);
      return updatePaymentOrder;
    } catch (err) {
      this.logger.log(`Failed to update order payment status ${err}`);
    }
  }

  async updateOrderStatus(orderId: string, status: OrderStatus) {
    const order = await this.findOneOrder(orderId);

    if (order.isPaid === PaymentStatus.unpaid) {
      throw new ConflictException('Only paid order can be marked as done');
    }

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
