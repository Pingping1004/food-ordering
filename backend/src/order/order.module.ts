import { forwardRef, Module } from '@nestjs/common';
import { OrderService } from './order.service';
import { OrderController } from './order.controller';
import { PrismaService } from 'prisma/prisma.service';
import { PaymentService } from 'src/payment/payment.service';
import { PaymentModule } from 'src/payment/payment.module';
import { ConfigService } from '@nestjs/config';
import { MenuModule } from 'src/menu/menu.module';
import { PayoutModule } from 'src/payout/payout.module';

@Module({
  imports: [forwardRef(() => PayoutModule)],
  controllers: [OrderController],
  providers: [OrderService, PrismaService, PaymentService, ConfigService],
  exports: [OrderService],
})
export class OrderModule {}
