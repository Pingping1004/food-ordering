import { forwardRef, Module } from '@nestjs/common';
import { MenuService } from './menu.service';
import { MenuController } from './menu.controller';
import { PrismaService } from '../prisma/prisma.service';
import { RestaurantModule } from '../restaurant/restaurant.module';
import { UploadModule } from 'src/upload/upload.module';
import { CsrfModule } from 'src/csrf/csrf.module';
import { OrderModule } from 'src/order/order.module';
import { InventoryModule } from 'src/inventory/inventory.module';

@Module({
  imports: [
    forwardRef(() => OrderModule),
    forwardRef(() => RestaurantModule),
    UploadModule,
    CsrfModule,
    InventoryModule,
  ],
  controllers: [MenuController],
  providers: [MenuService, PrismaService],
  exports: [MenuService],
})
export class MenuModule {}
