import { Module } from '@nestjs/common';
import { NotificationModule } from '../notification/notification.module';
import {
  RestaurantRefundController,
  SchoolRefundController,
  StudentRefundController,
} from './refund.controller';
import { RefundService } from './refund.service';

@Module({
  imports: [NotificationModule],
  controllers: [
    StudentRefundController,
    SchoolRefundController,
    RestaurantRefundController,
  ],
  providers: [RefundService],
  exports: [RefundService],
})
export class RefundModule {}
