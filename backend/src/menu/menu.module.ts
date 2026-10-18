import { forwardRef, Module } from '@nestjs/common';
import { MenuService } from './menu.service';
import { MenuController } from './menu.controller';
import { RestaurantModule } from '../restaurant/restaurant.module';
import { UploadModule } from 'src/upload/upload.module';
import { OrderModule } from 'src/order/order.module';
import { InventoryModule } from 'src/inventory/inventory.module';

@Module({
  imports: [
    forwardRef(() => OrderModule),
    forwardRef(() => RestaurantModule),
    UploadModule,
    InventoryModule,
  ],
  controllers: [MenuController],
  providers: [MenuService],
  exports: [MenuService],
})
export class MenuModule {}
