import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { CreatePayoutDto } from './dto/create-payout.dto';
import { UpdatePayoutDto } from './dto/update-payout.dto';
import { PrismaService } from 'prisma/prisma.service';
import { calculatePayout, calculateWeeklyInterval } from './payout-calculator';
import { OrderService } from 'src/order/order.service';
import { Payout } from '@prisma/client';

@Injectable()
export class PayoutService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => OrderService))
    private readonly orderService: OrderService,
  ) { }

  async createPayout(orderId: string) {
    const order = await this.orderService.findOneOrder(orderId);
    const markupRate = Number(process.env.SELL_PRICE_MARKUP_RATE);
    const sellingPrice = order.totalAmount * (1 + markupRate);
    const { restaurantEarning, platformFee } = calculatePayout(sellingPrice);

    const now = new Date();
    const { startDate, endDate } = calculateWeeklyInterval(now);

    const newPayout: CreatePayoutDto = {
      restaurantRevenue: restaurantEarning,
      platformFee,
      startDate,
      endDate,
      orderId: order.orderId,
      restaurantId: order.restaurantId,
    };

    const result = await this.prisma.payout.create({
      data: newPayout,
    });

    return result;
  }

  async findWeeklyPayout(date?: string, restaurantId?: string): Promise<Payout[]> {
    const { startDate, endDate } = calculateWeeklyInterval(date);

    const payouts = await this.prisma.payout.findMany({
      where: {
        ...( restaurantId && {restaurantId }),
        startDate: { gte: startDate ,},
        endDate: { lte: endDate },
      },
      include: {
        order: true,
      },
      orderBy: {
        startDate: 'desc',
      }
    });

    return payouts;
  }

  async findPayout(payoutId?: string) {
    const payout = await this.prisma.payout.findUnique({
      where: { payoutId },
    });

    return payout;
  }

  async findAllPayout() {
    const payout = await this.prisma.payout.findMany({
      orderBy: {
        createdAt: 'desc',
      }
    });

    return payout;
  }

  async findAllPayoutFromRestaurant(restaurantId: string): Promise<Payout[]> {
    const payouts = await this.prisma.payout.findMany({
      where: {
        restaurantId
      },
      orderBy: {
        startDate: 'desc',
      }
    });

    return payouts;
  }

  private async getAllRevenue() {
    const payouts = await this.prisma.payout.findMany();
    const allRevenue = payouts.reduce((total, store) => total + store.platformFee, 0);
    return allRevenue;
  }

  update(id: number, updatePayoutDto: UpdatePayoutDto) {
    return `This action updates a #${id} payout`;
  }

  remove(id: number) {
    return `This action removes a #${id} payout`;
  }
}
