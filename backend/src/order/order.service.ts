import {
  BadRequestException,
  Injectable,
  NotFoundException,
  InternalServerErrorException,
  forwardRef,
  Inject,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { CreateOrderDto, CreateOrderMenusDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { PrismaService } from '../prisma/prisma.service';
import { IsPaid, OrderStatus, PaymentMethodType } from '@prisma/client';
import { PaymentService } from 'src/payment/payment.service';
import { PayoutService } from 'src/payout/payout.service';
import { calculateWeeklyInterval } from 'src/payout/payout-calculator';
import { numberRound } from '../utils/round-number';
import Decimal from 'decimal.js';

@Injectable()
export class OrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentService: PaymentService,
    @Inject(forwardRef(() => PayoutService))
    private readonly payoutService: PayoutService,
  ) { }

  private readonly logger = new Logger('OrderService');

  private readonly statusTransitions = {
    [OrderStatus.receive]: OrderStatus.cooking,
    [OrderStatus.cooking]: OrderStatus.ready,
    [OrderStatus.ready]: OrderStatus.done,
    [OrderStatus.done]: null, // No further transition from DONE
  };

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

      const markupPrice = numberRound(markupRate * existingMenu?.price);
      const roundedUnitPrice = numberRound(item.unitPrice);
      if (!markupPrice.equals(roundedUnitPrice)) {
        this.logger.log('Markup price: ', markupPrice);
        this.logger.log('Unitprice: ', roundedUnitPrice);
        throw new BadRequestException(
          `Mismatched price for menu ${item.menuName}. Expected ${markupPrice}, got ${roundedUnitPrice}`,
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

  async createOrderWithPayment(createOrderDto: CreateOrderDto, userId: string) {
    const calculatedTotalAmount = await this.validateOrderMenus(
      createOrderDto.orderMenus,
      createOrderDto.restaurantId,
    );

    const providedTotalAmount = createOrderDto.orderMenus.reduce(
      (sum, item) => sum + item.unitPrice * item.quantity,
      0,
    );

    if (calculatedTotalAmount !== providedTotalAmount) {
      throw new InternalServerErrorException(
        'Calculated amount does not match provided amount.',
      );
    }

    return await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          restaurantId: createOrderDto.restaurantId,
          deliverAt: createOrderDto.deliverAt,
          isPaid: IsPaid.unpaid,
          paymentMethodType: createOrderDto.paymentMethod,
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

      // Validate deliver time with 10 mins time buffer
      const now = new Date();
      const deliverAtDate = new Date(order.deliverAt);
      const minimumAllowedDeliveTime = new Date(now.getTime() + 5 * 60 * 1000);

      if (deliverAtDate < minimumAllowedDeliveTime) {
        throw new BadRequestException(
          'Delivery time must be at least 5 minutes from the current time.',
        );
      }

      let charge;

      try {
        const frontendReturnUri = `${process.env.FRONTEND_BASE_URL}/order/done/${order.orderId}`;

        charge = await this.paymentService.createPromptPayCharge(
          calculatedTotalAmount,
          createOrderDto.paymentMethod as PaymentMethodType,
          frontendReturnUri,
          order.orderId,
        );

        await tx.order.update({
          where: { orderId: order.orderId },
          data: {
            omiseChargeId: charge.id,
            paymentGatewayStatus: charge.status,
          },
        });

        this.logger.log('QrImageUri: ', charge.source?.scannable_code?.image?.image_uri);

        return {
          orderId: order.orderId,
          chargeId: charge.id,
          authorizeUri: charge.authorize_uri || null,
          status: charge.status,
          qrDownloadUri: charge.source?.scannable_code?.image?.download_uri || null,
          qrImageUri: charge.source?.scannable_code?.image?.image_uri || null,
        };
      } catch (paymentError) {
        this.logger.error(
          'Error initiating payment with Omise: ',
          paymentError.message,
          paymentError.stack,
        );

        await tx.order.update({
          where: { orderId: order.orderId },
          data: {
            paymentGatewayStatus: 'failed_initiation',
            omiseChargeId: null,
          },
        });

        throw new InternalServerErrorException(
          'Payment initiation failed. Please try again.',
        );
      }
    });
  }

  async handleWebhookUpdate(omiseChargeId: string, omiseStatus: string) {
    const order = await this.prisma.order.findUnique({
      where: { omiseChargeId: omiseChargeId },
    });

    if (!order) return;
    this.logger.log('Order payment status: ', order.isPaid);

    let newIsPaidStatus: IsPaid;

    if (omiseStatus === 'successful') {
      newIsPaidStatus = IsPaid.paid;

      await this.payoutService.createPayout(order.orderId);
    } else if (omiseStatus === 'failed' || omiseStatus === 'expired') {
      newIsPaidStatus = IsPaid.rejected;
    } else {
      newIsPaidStatus = order.isPaid;
    }

    await this.prisma.order.update({
      where: { orderId: order.orderId },
      data: {
        paymentGatewayStatus: omiseStatus, // Update with the status directly from Omise
        isPaid: newIsPaidStatus, // Update your internal simplified status
      },
    });
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

  async updateOrderStatus(orderId: string) {
    const order = await this.findOneOrder(orderId);
    const nextStatus = this.statusTransitions[order.status];

    const result = await this.prisma.order.update({
      where: { orderId },
      data: {
        status: nextStatus,
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

    if (order.status !== OrderStatus.done) {
      throw new BadRequestException(
        'สามารถลบได้เฉพาะออเดอร์ที่มีสถ่านะเสร็จสมบูรณ์เรียบร้อยแล้วเท่านั้น',
      );
    }

    return this.prisma.order.delete({
      where: { orderId },
    });
  }
}
