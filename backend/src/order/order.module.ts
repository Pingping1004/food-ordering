import { forwardRef, Module } from '@nestjs/common';
import { OrderService } from './order.service';
import { OrderController } from './order.controller';
import { ConfigService } from '@nestjs/config';
import { PayoutModule } from 'src/payout/payout.module';
import { UserModule } from 'src/user/user.module';
import { MenuModule } from 'src/menu/menu.module';
import { InventoryModule } from 'src/inventory/inventory.module';
import { RestaurantModule } from 'src/restaurant/restaurant.module';
import { NotificationModule } from 'src/notification/notification.module';
import { AnalyticsModule } from 'src/analytics/dto/analytics.module';

@Module({
  imports: [
    forwardRef(() => PayoutModule),
    UserModule,
    AnalyticsModule,
    forwardRef(() => MenuModule),
    forwardRef(() => InventoryModule),
    forwardRef(() => RestaurantModule),
    NotificationModule,
  ],
  controllers: [OrderController],
  providers: [OrderService, ConfigService],
  exports: [OrderService],
})
export class OrderModule {}
