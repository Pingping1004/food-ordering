import { Module } from '@nestjs/common';
import { OrderService } from './order.service';
import { OrderController } from './order.controller';
import { PrismaService } from 'prisma/prisma.service';
import { PaymentService } from 'src/payment/payment.service';

@Module({
  controllers: [OrderController],
  providers: [OrderService, PrismaService, PaymentService],
  exports: [OrderService],
})
export class OrderModule {}
