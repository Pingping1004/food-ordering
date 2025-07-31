import { forwardRef, Module } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { PrismaService } from '../prisma/prisma.service';
import { OrderModule } from 'src/order/order.module';
import { UserModule } from 'src/user/user.module';
import { PayoutModule } from 'src/payout/payout.module';
import { CsrfModule } from 'src/csrf/csrf.module';

@Module({
  imports: [
    forwardRef(() => OrderModule),
    UserModule,
    PayoutModule,
    CsrfModule,
  ],
  controllers: [PaymentController],
  providers: [PaymentService, PrismaService],
  exports: [PaymentService],
})
export class PaymentModule {}
