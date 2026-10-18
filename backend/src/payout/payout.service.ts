import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { calculatePayout, calculateWeeklyInterval } from './payout-calculator';
import { Prisma } from '@prisma/client';
import { PayoutStatus } from './dto/update-payout.dto';
import Decimal from 'decimal.js';
import moment from 'moment';
import { OrderService } from 'src/order/order.service';

export interface Payout {
  payoutId: string;
  orderId: string;
  restaurantId: string;
  grossAmount: any;
  restaurantRevenue: any;
  platformFee: any;
  idempotencyKey?: string | null;
  transactionId?: string | null;
  payoutStatus: PayoutStatus;
  transactionFee: any;
  vat: any;
  restaurantName: string;
  startDate: Date;
  endDate: Date;
  paidAt?: Date | null;
  requestHash?: string | null;
  createdAt: Date;
}

@Injectable()
export class PayoutService {
  private readonly payouts = new Map<string, Payout>();

  constructor(
    private readonly orderService: OrderService,
    private readonly prisma: PrismaService,
  ) {}

  async createPayout(
    data: Omit<Payout, 'payoutId' | 'createdAt'> & { payoutId?: string },
  ) {
    const payoutId =
      data.payoutId ||
      `payout-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const record: Payout = {
      ...data,
      payoutId,
      createdAt: new Date(),
    };
    this.payouts.set(payoutId, record);
    return record;
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
    const totalAmount = order.totalAmount;
    const totalAmountDecimal = new Prisma.Decimal(totalAmount);

    const calculated = calculatePayout(totalAmountDecimal);
    const existing = this.payouts.get(payoutId);

    const updated: Payout = {
      payoutId,
      orderId,
      restaurantId: order.restaurantId,
      grossAmount: order.totalAmount,
      restaurantRevenue: calculated.restaurantEarning,
      platformFee: calculated.platformNetEarning,
      idempotencyKey,
      transactionId,
      payoutStatus: status as PayoutStatus,
      transactionFee: calculated.transactionFee,
      vat: new Decimal(0),
      restaurantName: order.restaurant.name,
      startDate: paidAt,
      endDate: new Date(),
      paidAt,
      createdAt: existing?.createdAt ?? new Date(),
    };

    this.payouts.set(payoutId, updated);
    return updated;
  }

  async validateOrderExistence(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { orderId },
      include: {
        orderMenus: true,
        restaurant: {
          select: {
            restaurantId: true,
            name: true,
          },
        },
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
    for (const payout of this.payouts.values()) {
      if (
        payout.idempotencyKey === idempotencyKey &&
        payout.orderId === orderId
      ) {
        return payout;
      }
    }
    return null;
  }

  async findPayoutByTransactionId(
    transactionId: string,
  ): Promise<Payout | null> {
    for (const payout of this.payouts.values()) {
      if (payout.transactionId === transactionId) {
        return payout;
      }
    }
    return null;
  }

  async findWeeklyPayout(
    date?: string,
    restaurantId?: string,
  ): Promise<Payout[]> {
    const { startDate, endDate } = calculateWeeklyInterval(date);

    return Array.from(this.payouts.values()).filter((p) => {
      if (restaurantId && p.restaurantId !== restaurantId) return false;
      return p.startDate >= startDate && p.endDate <= endDate;
    });
  }

  async getTodayPayout() {
    const startOfDay = moment().tz('Asia/Bangkok').startOf('day').toDate();
    const endOfDay = moment().tz('Asia/Bangkok').endOf('day').toDate();

    return Array.from(this.payouts.values()).filter((p) => {
      return p.createdAt >= startOfDay && p.createdAt <= endOfDay;
    });
  }

  async findPayout(payoutId: string) {
    return this.payouts.get(payoutId) ?? null;
  }

  async findExistingPayout(orderId: string): Promise<boolean> {
    for (const payout of this.payouts.values()) {
      if (payout.orderId === orderId) return true;
    }
    return false;
  }

  async findAllPayout() {
    return Array.from(this.payouts.values());
  }

  async findAllPayoutFromRestaurant(restaurantId: string): Promise<Payout[]> {
    return Array.from(this.payouts.values()).filter(
      (p) => p.restaurantId === restaurantId,
    );
  }

  async updatePayoutStatus(
    payoutId: string,
    payoutStatus: PayoutStatus | string,
  ) {
    const existing = this.payouts.get(payoutId);
    if (existing) {
      existing.payoutStatus = payoutStatus as PayoutStatus;
      this.payouts.set(payoutId, existing);
      return existing;
    }
    return null;
  }

  private async getAllRevenue() {
    const payouts = Array.from(this.payouts.values());
    const allRevenue = payouts.reduce((acc: Decimal, item) => {
      return acc.add(item.platformFee);
    }, new Decimal(0));
    return allRevenue;
  }
}
