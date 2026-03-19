import { ConflictException, forwardRef, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { calculatePayout, calculateWeeklyInterval } from './payout-calculator';
import { OrderService } from 'src/order/order.service';
import { Order, Payout, Prisma } from '@prisma/client';
import Decimal from 'decimal.js';
import { RestaurantService } from 'src/restaurant/restaurant.service';
import moment from 'moment';

@Injectable()
export class PayoutService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly restaurantService: RestaurantService,
    @Inject(forwardRef(() => OrderService))
    private readonly orderService: OrderService,
  ) {}

  async createPayout(orderId: string) {
    const { restaurantId, totalAmount } = await this.orderService.findOneOrder(orderId);
    if (await this.findExistingPayout(orderId)) throw new ConflictException("ออเดอร์นี้ถูกบันทึกไปแล้ว");

    const { name } = await this.restaurantService.findRestaurant(restaurantId);
    const { restaurantEarning, platformNetEarning, transactionFee } = calculatePayout(totalAmount, {
      platformCommissionRate: new Decimal(0.1),
      baseTransactionRate: new Decimal(0.02),
      vatRate: new Decimal(0.07)
    });

    const now = new Date();
    const { startDate, endDate } = calculateWeeklyInterval(now);

    const result = await this.prisma.payout.create({
      data: {
        grossAmount: totalAmount,
        restaurantRevenue: restaurantEarning,
        platformFee: platformNetEarning,
        transactionFee: transactionFee,
        vat: new Decimal(0.07),
        startDate,
        endDate,
        orderId,
        restaurantId,
        restaurantName: name,
      },
    });

    return result;
  }

  async createPayoutTx(tx: Prisma.TransactionClient, orderId: string) {
    const order = await tx.order.findUnique({
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

    const existing = await tx.payout.findUnique({ where: { orderId } });
    if (existing) return existing;

    const totalAmount = order.orderMenus.reduce((sum, item) => {
      return sum + Number(item.unitPrice) * item.quantity;
    }, 0);
    const totalAmountDecimal = new Prisma.Decimal(totalAmount);

    const payout = calculatePayout(totalAmountDecimal, {
      platformCommissionRate: new Decimal(0.1),
      baseTransactionRate: new Decimal(0.02),
      vatRate: new Decimal(0.07),
    });

    return await tx.payout.create({
      data: {
        orderId,
        restaurantId: order.restaurantId,
        grossAmount: order.totalAmount,
        restaurantRevenue: payout.restaurantEarning,
        platformFee: payout.platformNetEarning,
        transactionFee: payout.transactionFee,
        vat: new Decimal(0.07),
        restaurantName: order.restaurant.name,
        startDate: order.paidAt,
        endDate: new Date(),
      }
    })
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

  async updatePayout(payoutId: string, isPaid: boolean) {
    const payout = await this.prisma.payout.update({
      where: { payoutId },
      data: { isPaid: isPaid, paidAt: isPaid === true ? new Date() : null }
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
