import { Module } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { PrismaService } from '../prisma/prisma.service';
import { OrderModule } from 'src/order/order.module';

@Module({
  imports: [OrderModule],
  controllers: [PaymentController],
  providers: [PaymentService, PrismaService],
  exports: [PaymentService]
})
export class PaymentModule {}
