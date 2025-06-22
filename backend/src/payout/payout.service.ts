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
    private prisma: PrismaService,
    @Inject(forwardRef(() => OrderService))
    private orderService: OrderService,
  ) { }

  async createPayout(orderId: string) {
    const order = await this.orderService.findOneOrder(orderId);
    const { restaurantEarning, platformFee } = calculatePayout(order.totalAmount);

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

    console.log('Created new payout service: ', newPayout);
    const result = await this.prisma.payout.create({
      data: newPayout,
    });

    return result;
  }

  async findWeeklyPayout(date?: string, restaurantId?: string): Promise<Payout[]> {
    const { startDate, endDate, formattedStartDate, formattedEndDate } = calculateWeeklyInterval(date);

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

    console.log(`Get weekly payouts from: ${formattedStartDate} - ${formattedEndDate}: \n ${payouts}`);
    return payouts;
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

  async getAllRevenue() {
    const payouts = await this.prisma.payout.findMany();
    const allRevenue = payouts.reduce((total, store) => total + store.platformFee, 0);
    console.log('This is all platform revenue: ', allRevenue);
  }

  update(id: number, updatePayoutDto: UpdatePayoutDto) {
    return `This action updates a #${id} payout`;
  }

  remove(id: number) {
    return `This action removes a #${id} payout`;
  }
}
