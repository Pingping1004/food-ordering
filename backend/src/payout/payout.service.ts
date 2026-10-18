import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { calculatePayout, calculateWeeklyInterval } from './payout-calculator';
import { Prisma, Payout as PayoutRow } from '@prisma/client';
import { PayoutStatus } from './dto/update-payout.dto';
import moment from 'moment';

/** API shape of a payout (unchanged from the in-memory version): money fields are plain numbers. */
export interface Payout {
  payoutId: string;
  orderId: string;
  restaurantId: string;
  grossAmount: number;
  restaurantRevenue: number;
  platformFee: number;
  idempotencyKey?: string | null;
  transactionId?: string | null;
  payoutStatus: PayoutStatus;
  transactionFee: number;
  vat: number;
  restaurantName: string;
  startDate: Date;
  endDate: Date;
  paidAt?: Date | null;
  requestHash?: string | null;
  createdAt: Date;
}

type CreatePayoutInput = {
  idempotencyKey?: string | null;
  requestHash?: string | null;
  orderId: string;
  payoutStatus: PayoutStatus | string;
  restaurantId: string;
  restaurantName: string;
  grossAmount: Prisma.Decimal.Value;
  restaurantRevenue: Prisma.Decimal.Value;
  platformFee: Prisma.Decimal.Value;
  transactionFee: Prisma.Decimal.Value;
  vat: Prisma.Decimal.Value;
  startDate: Date;
  endDate: Date;
};

const toPayout = (r: PayoutRow): Payout => ({
  payoutId: r.payoutId,
  orderId: r.orderId,
  restaurantId: r.restaurantId,
  restaurantName: r.restaurantName,
  idempotencyKey: r.idempotencyKey,
  requestHash: r.requestHash,
  transactionId: r.transactionId,
  payoutStatus: r.payoutStatus as PayoutStatus,
  grossAmount: r.grossAmount.toNumber(),
  restaurantRevenue: r.restaurantRevenue.toNumber(),
  platformFee: r.platformFee.toNumber(),
  transactionFee: r.transactionFee.toNumber(),
  vat: r.vat.toNumber(),
  startDate: r.startDate,
  endDate: r.endDate,
  paidAt: r.paidAt,
  createdAt: r.createdAt,
});

@Injectable()
export class PayoutService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates the attempt row. A second attempt with the same (idempotencyKey, orderId) throws P2002: the payment
   * flow relies on that to detect a retry and return the first attempt's outcome.
   */
  async createPayout(data: CreatePayoutInput): Promise<Payout> {
    const row = await this.prisma.payout.create({
      data: { ...data, payoutStatus: data.payoutStatus },
    });
    return toPayout(row);
  }

  async updatePayoutTx(
    tx: Prisma.TransactionClient,
    payoutId: string,
    orderId: string,
    idempotencyKey: string,
    transactionId: string,
    status: PayoutStatus | string,
    paidAt: Date,
  ) {
    const order = await this.validateOrderExistence(orderId);
    const calculated = calculatePayout(new Prisma.Decimal(order.totalAmount));

    const row = await tx.payout.update({
      where: { payoutId },
      data: {
        orderId,
        restaurantId: order.restaurantId,
        restaurantName: order.restaurant.name,
        idempotencyKey,
        transactionId,
        payoutStatus: status,
        grossAmount: order.totalAmount,
        restaurantRevenue: calculated.restaurantEarning.toString(),
        platformFee: calculated.platformNetEarning.toString(),
        transactionFee: calculated.transactionFee.toString(),
        vat: 0,
        startDate: paidAt,
        endDate: new Date(),
        paidAt,
      },
    });
    return toPayout(row);
  }

  async validateOrderExistence(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { orderId },
      include: {
        orderMenus: true,
        restaurant: { select: { restaurantId: true, name: true } },
      },
    });
    if (!order)
      throw new NotFoundException('ไม่พบออเดอร์สำหรับไอดี: ', orderId);
    return order;
  }

  async findPayoutByIdempotencyKey(
    idempotencyKey: string,
    orderId: string,
  ): Promise<Payout | null> {
    const row = await this.prisma.payout.findUnique({
      where: { idempotencyKey_orderId: { idempotencyKey, orderId } },
    });
    return row ? toPayout(row) : null;
  }

  async findPayoutByTransactionId(
    transactionId: string,
  ): Promise<Payout | null> {
    const row = await this.prisma.payout.findUnique({ where: { transactionId } });
    return row ? toPayout(row) : null;
  }

  async findWeeklyPayout(
    date?: string,
    restaurantId?: string,
  ): Promise<Payout[]> {
    const { startDate, endDate } = calculateWeeklyInterval(date);
    const rows = await this.prisma.payout.findMany({
      where: {
        ...(restaurantId ? { restaurantId } : {}),
        startDate: { gte: startDate },
        endDate: { lte: endDate },
      },
      orderBy: { createdAt: 'desc' },
      take: 5000,
    });
    return rows.map(toPayout);
  }

  async getTodayPayout() {
    const startOfDay = moment().tz('Asia/Bangkok').startOf('day').toDate();
    const endOfDay = moment().tz('Asia/Bangkok').endOf('day').toDate();
    const rows = await this.prisma.payout.findMany({
      where: { createdAt: { gte: startOfDay, lte: endOfDay } },
      orderBy: { createdAt: 'desc' },
      take: 5000,
    });
    return rows.map(toPayout);
  }

  async findPayout(payoutId: string) {
    const row = await this.prisma.payout.findUnique({ where: { payoutId } });
    return row ? toPayout(row) : null;
  }

  async findExistingPayout(orderId: string): Promise<boolean> {
    return (await this.prisma.payout.count({ where: { orderId } })) > 0;
  }

  /** Newest first, capped: the admin screen should not pull the whole table. */
  async findAllPayout() {
    const rows = await this.prisma.payout.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5000,
    });
    return rows.map(toPayout);
  }

  async findAllPayoutFromRestaurant(restaurantId: string): Promise<Payout[]> {
    const rows = await this.prisma.payout.findMany({
      where: { restaurantId },
      orderBy: { createdAt: 'desc' },
      take: 5000,
    });
    return rows.map(toPayout);
  }

  async updatePayoutStatus(
    payoutId: string,
    payoutStatus: PayoutStatus | string,
  ) {
    try {
      const row = await this.prisma.payout.update({
        where: { payoutId },
        data: { payoutStatus },
      });
      return toPayout(row);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      )
        return null;
      throw error;
    }
  }
}
