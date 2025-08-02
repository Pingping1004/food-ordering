import { Module } from '@nestjs/common';
import { MenuService } from './menu.service';
import { MenuController } from './menu.controller';
import { PrismaService } from '../prisma/prisma.service';
import { RestaurantModule } from '../restaurant/restaurant.module';
import { OrderModule } from 'src/order/order.module';
import { UploadModule } from 'src/upload/upload.module';
import { CsrfModule } from 'src/csrf/csrf.module';

@Module({
  imports: [
    OrderModule,
    RestaurantModule,
    UploadModule,
    CsrfModule,
  ],
  controllers: [MenuController],
  providers: [MenuService, PrismaService],
  exports: [MenuService],
})
export class MenuModule {}
