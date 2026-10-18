import { Module } from '@nestjs/common';
import { RestaurantController } from './restaurant.controller';
import { RestaurantService } from './restaurant.service';
import { OrderModule } from 'src/order/order.module';
import { S3Module } from 'src/s3/s3.module';
import { UploadModule } from 'src/upload/upload.module';
import { AnalyticsModule } from 'src/analytics/dto/analytics.module';
import { InviteModule } from '../invite/invite.module';
import { QrReaderService } from '../utils/qr-reader.service';

@Module({
  imports: [UploadModule, AnalyticsModule, OrderModule, S3Module, InviteModule],
  controllers: [RestaurantController],
  providers: [RestaurantService, QrReaderService],
  exports: [RestaurantService],
})
export class RestaurantModule {}
