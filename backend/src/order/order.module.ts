import { forwardRef, Module } from '@nestjs/common';
import { OrderService } from './order.service';
import { OrderController } from './order.controller';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentService } from 'src/payment/payment.service';
import { ConfigService } from '@nestjs/config';
import { PayoutModule } from 'src/payout/payout.module';
import { CsrfModule } from 'src/csrf/csrf.module';
import { UserModule } from 'src/user/user.module';

@Module({
  imports: [forwardRef(() => PayoutModule), CsrfModule, UserModule],
  controllers: [OrderController],
  providers: [OrderService, PrismaService, PaymentService, ConfigService],
  exports: [OrderService],
})
export class OrderModule {}
