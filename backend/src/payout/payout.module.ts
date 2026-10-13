import { forwardRef, Module } from '@nestjs/common';
import { PayoutService } from './payout.service';
import { PayoutController } from './payout.controller';
import { PrismaService } from '../prisma/prisma.service';
import { OrderModule } from 'src/order/order.module';
import { RestaurantModule } from 'src/restaurant/restaurant.module';

@Module({
  imports: [
    forwardRef(() => OrderModule),
    forwardRef(() => RestaurantModule),
  ],
  controllers: [PayoutController],
  providers: [PayoutService, PrismaService],
  exports: [PayoutService],
})
export class PayoutModule {}
