import { Module } from '@nestjs/common';
import { RestaurantController } from './restaurant.controller';
import { RestaurantService } from './restaurant.service';
import { PrismaService } from '../prisma/prisma.service';
import { OrderModule } from 'src/order/order.module';
import { UserModule } from 'src/user/user.module';
import { CsrfModule } from 'src/csrf/csrf.module';
import { S3Module } from 'src/s3/s3.module';

@Module({
  imports: [
    OrderModule,
    UserModule,
    CsrfModule,
    S3Module,
  ],
  controllers: [RestaurantController],
  providers: [RestaurantService, PrismaService],
  exports: [RestaurantService],
})
export class RestaurantModule {}
