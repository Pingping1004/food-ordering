import { forwardRef, Module } from '@nestjs/common';
import { PayoutService } from './payout.service';
import { PayoutController } from './payout.controller';
import { PrismaService } from 'prisma/prisma.service';
import { OrderModule } from 'src/order/order.module';

@Module({
  imports: [
    forwardRef(() => OrderModule),
  ],
  controllers: [PayoutController],
  providers: [PayoutService, PrismaService],
  exports: [PayoutService],
})
export class PayoutModule {}
