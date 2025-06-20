/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  BadRequestException,
  Injectable,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { CreateOrderDto, CreateOrderMenusDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { PrismaService } from 'prisma/prisma.service';
import * as fs from 'fs/promises';
import { createHash } from 'crypto';
import { IsPaid, OrderStatus, Order, PaymentMethodType } from '@prisma/client';
import { PaymentService } from 'src/payment/payment.service';

@Injectable()
export class OrderService {
  constructor(
    private prisma: PrismaService,
    private paymentService: PaymentService,
  ) { }

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

  async hashingFile(file: Express.Multer.File): Promise<string> {
    const buffer = await fs.readFile(file.path);
    return createHash('sha256').update(buffer).digest('hex');
  }

  async createOrderWithPayment(createOrderDto: CreateOrderDto) {
    let calculatedTotalAmount = 0;

    for (const item of createOrderDto.orderMenus) {
      const existingMenu = await this.prisma.menu.findUnique({
        where: { menuId: item.menuId },
    });

      if (!existingMenu) throw new NotFoundException(`Menu item with ID ${item.menuName} not found.`);
      if (existingMenu.price !== item.unitPrice) {
        console.warn(`Client sent mismatched unitPrice for ${item.menuId}. DB: ${existingMenu.price}, Client: ${item.unitPrice}`)
      }

      calculatedTotalAmount += item.unitPrice * item.quantity;
    }

    const providedTotalAmount = createOrderDto.orderMenus
      .map(item => (item as any).totalPrice || (item.unitPrice * item.quantity))
      .reduce((sum, price) => sum + price, 0);

    if (calculatedTotalAmount !== providedTotalAmount) {
      throw new InternalServerErrorException('Calculated amount does not match provided amount.');
    }

    return await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          restaurantId: createOrderDto.restaurantId,
          orderAt: createOrderDto.orderAt,
          deliverAt: createOrderDto.deliverAt,
          isPaid: IsPaid.unpaid,
          paymentMethodType: createOrderDto.paymentDetails.paymentMethod,
          paymentGatewayStatus: 'pending',
          totalAmount: calculatedTotalAmount,
          orderMenus: {
            create: createOrderDto.orderMenus.map(item => ({
              quantity: item.quantity,
              menuName: item.menuName,
              unitPrice: item.unitPrice,
              menuImg: item.menuImg,
              details: item.details,
              totalPrice: item.unitPrice * item.quantity,
              menu: { connect: { menuId: item.menuId } },
            })),
          },
        },
        include: {
          orderMenus: true
        }
      });

      let charge;

      try {
        const frontendReturnUri = `http://localhost:3000/user/order/done/${order.orderId}`;

        charge = await this.paymentService.createPromptPayCharge(
          calculatedTotalAmount,
          createOrderDto.paymentDetails.paymentMethod as PaymentMethodType,
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

        return {
          orderId: order.orderId,
          chargeId: charge.id,
          authorizeUri: charge.authorize_uri,
          status: charge.status,
        };
      } catch (paymentError) {
        console.error('Error initiating payment with Omise: ', paymentError.message, paymentError.stack);

        await tx.order.update({
          where: { orderId: order.orderId },
          data: {
            paymentGatewayStatus: 'failed_initiation',
            omiseChargeId: null,

          },
        });

        throw new InternalServerErrorException('Payment initiation failed. Please try again.');
      }
    });
  }

  async handleWebhookUpdate(omiseChargeId: string, omiseStatus: string) {
    const order = await this.prisma.order.findUnique({
      where: { omiseChargeId: omiseChargeId }
    });

    if (!order) {
      console.warn('Order not found for Omise charge ID: ', omiseChargeId);
      return;
    }

    let newIsPaidStatus: IsPaid;

    if (omiseStatus === 'successful') {
      newIsPaidStatus = IsPaid.paid;
      console.log(`Order ${order.orderId} payment status updated to PAID via webhook.`);
    } else if (omiseStatus === 'failed' || omiseStatus === 'expired') {
      newIsPaidStatus = IsPaid.rejected;
      console.warn(`Order ${order.orderId} payment status updated to FAILED via webhook.`);
    } else {
      console.log(`Order ${order.orderId}: Received Omise status "${omiseStatus}", no change to isPaid.`);
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
  async findAllOrders() {
    return this.prisma.order.findMany();
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
          menuImg: menu.menuImg || "",
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

  // async updateOrder(orderId: string, updateOrderDto: UpdateOrderDto) {
  //   // Find order with validate restaurant and menu logic
  //   await this.findOneOrder(orderId);

  //   if (!updateOrderDto.restaurantId)
  //     throw new Error('restaurantId is required');

  //   return this.prisma.order.update({
  //     where: { orderId },
  //     data: {
  //       status: updateOrderDto.status,
  //       deliverAt: updateOrderDto.deliverAt,
  //       isPaid: updateOrderDto.isPaid !== undefined ? (updateOrderDto.isPaid ? IsPaid.paid : IsPaid.unpaid) : undefined,
  //       isDelay: updateOrderDto.isDelay,
  //     },
  //   });
  // }

  async removeOrder(orderId: string) {
    this.findOneOrder(orderId);

    return this.prisma.order.delete({
      where: { orderId },
    });
  }
}
