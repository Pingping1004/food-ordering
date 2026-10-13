import { Module } from '@nestjs/common';
import { RestaurantController } from './restaurant.controller';
import { RestaurantService } from './restaurant.service';
import { PrismaService } from '../prisma/prisma.service';
import { OrderModule } from 'src/order/order.module';
import { CsrfModule } from 'src/csrf/csrf.module';
import { S3Module } from 'src/s3/s3.module';
import { UploadModule } from 'src/upload/upload.module';
import { AnalyticsModule } from 'src/analytics/dto/analytics.module';
import { QrReaderService } from '../utils/qr-reader.service';

@Module({
  imports: [
    UploadModule,
    AnalyticsModule,
    OrderModule,
    CsrfModule,
    S3Module,
  ],
  controllers: [RestaurantController],
  providers: [RestaurantService, PrismaService, QrReaderService],
  exports: [RestaurantService],
})
export class RestaurantModule {}
