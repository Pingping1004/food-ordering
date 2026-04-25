import { forwardRef, Module } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { PrismaService } from '../prisma/prisma.service';
import { OrderModule } from 'src/order/order.module';
import { UserModule } from 'src/user/user.module';
import { PayoutModule } from 'src/payout/payout.module';
import { CsrfModule } from 'src/csrf/csrf.module';
import { RestaurantModule } from 'src/restaurant/restaurant.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { UploadModule } from 'src/upload/upload.module';
import { NotificationModule } from 'src/notification/notification.module';

@Module({
  imports: [
    forwardRef(() => OrderModule),
    UserModule,
    PayoutModule,
    RestaurantModule,
    PrismaModule,
    UploadModule,
    OrderModule,
    CsrfModule,
    NotificationModule,
  ],
  controllers: [PaymentController],
  providers: [PaymentService, PrismaService],
  exports: [PaymentService],
})
export class PaymentModule {}
