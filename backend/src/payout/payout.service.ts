import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { calculatePayout, calculateWeeklyInterval } from './payout-calculator';
import { Payout, PayoutStatus, Prisma } from '@prisma/client';
import Decimal from 'decimal.js';
import moment from 'moment';
import { OrderService } from 'src/order/order.service';

@Injectable()
export class PayoutService {
  constructor(
    private readonly orderService: OrderService,
    private readonly prisma: PrismaService,
  ) {}

  async updatePayoutTx(tx: Prisma.TransactionClient, payoutId: string, orderId: string, idempotencyKey: string, transactionId: string, status: PayoutStatus, paidAt: Date) {
    const order = await this.validateOrderExistence(orderId)
    const totalAmount = order.totalAmount;
    const totalAmountDecimal = new Prisma.Decimal(totalAmount);

    const payout = calculatePayout(totalAmountDecimal);

    return await tx.payout.update({
      where: { payoutId },
      data: {
        orderId,
        restaurantId: order.restaurantId,
        grossAmount: order.totalAmount,
        restaurantRevenue: payout.restaurantEarning,
        platformFee: payout.platformNetEarning,
        idempotencyKey,
        transactionId: transactionId,
        payoutStatus: status,
        transactionFee: payout.transactionFee,
        vat: new Decimal(0),
        restaurantName: order.restaurant.name,
        startDate: paidAt,
        endDate: new Date(),
        paidAt: paidAt,
      }
    })
  }

  async validateOrderExistence(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { orderId },
      include: {
        orderMenus: true,
        restaurant: {
          select: {
            restaurantId: true,
            name: true
          }
        }
      }
    });

    if (!order) throw new NotFoundException("ไม่พบออดดอร์สำหรับไอดี: ", orderId);

    return order
  }

  async findPayoutByIdempotencyKey(idempotencyKey: string, orderId: string): Promise<Payout | null> {
    const payout = await this.prisma.payout.findUnique({
      where: {
        idempotencyKey_orderId: { idempotencyKey, orderId }
      },
    });

    return payout;
  }

  async findPayoutByTransactionId(transactionId: string): Promise<Payout | null> {
    const payout = await this.prisma.payout.findUnique({
      where: { transactionId },
    });

    return payout;
  }

  async findWeeklyPayout(
    date?: string,
    restaurantId?: string,
  ): Promise<Payout[]> {
    const { startDate, endDate } = calculateWeeklyInterval(date);

    const payouts = await this.prisma.payout.findMany({
      where: {
        ...(restaurantId && { restaurantId }),
        startDate: { gte: startDate },
        endDate: { lte: endDate },
      },
      include: {
        order: true,
      },
      orderBy: {
        startDate: 'desc',
      },
    });

    return payouts;
  }

  async getTodayPayout() {
    const startOfDay = moment().tz('Asia/Bangkok').startOf('day').toDate();
    const endOfDay = moment().tz('Asia/Bangkok').endOf('day').toDate();

    const payouts = await this.prisma.payout.findMany({
      where: {
        createdAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      orderBy: { createdAt: "desc" },
      include: { restaurant: true },
    });

    return payouts;
  }

  async findPayout(payoutId: string) {
    const payout = await this.prisma.payout.findUnique({
      where: { payoutId },
    });

    return payout;
  }

  async findExistingPayout(orderId: string): Promise<boolean> {
    const existingPayout = await this.prisma.payout.findUnique({
      where: { orderId },
    });

    return !!existingPayout;
  }

  async findAllPayout() {
    const payout = await this.prisma.payout.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });

    return payout;
  }

  async findAllPayoutFromRestaurant(restaurantId: string): Promise<Payout[]> {
    const payouts = await this.prisma.payout.findMany({
      where: {
        restaurantId,
      },
      orderBy: {
        startDate: 'desc',
      },
    });

    return payouts;
  }

  async updatePayoutStatus(payoutId: string, payoutStatus: PayoutStatus) {
    const payout = await this.prisma.payout.update({
      where: { payoutId },
      data: { payoutStatus }
    });

    return payout;
  }

  private async getAllRevenue() {
    const payouts = await this.prisma.payout.findMany();
    const allRevenue = payouts.reduce((acc: Decimal, item) => {
      return acc.add(item.platformFee);
    }, new Decimal(0))
    return allRevenue;
  }
}
