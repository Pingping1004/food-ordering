import { forwardRef, Module } from '@nestjs/common';
import { OrderService } from './order.service';
import { OrderController } from './order.controller';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { PayoutModule } from 'src/payout/payout.module';
import { CsrfModule } from 'src/csrf/csrf.module';
import { UserModule } from 'src/user/user.module';
import { MenuModule } from 'src/menu/menu.module';
import { InventoryModule } from 'src/inventory/inventory.module';
import { RestaurantModule } from 'src/restaurant/restaurant.module';

@Module({
  imports: [
    forwardRef(() => PayoutModule), 
    CsrfModule, 
    UserModule, 
    forwardRef(() => MenuModule), 
    forwardRef(() => InventoryModule), 
    forwardRef(() => RestaurantModule)
  ],
  controllers: [OrderController],
  providers: [OrderService, PrismaService, ConfigService],
  exports: [OrderService],
})
export class OrderModule {}
