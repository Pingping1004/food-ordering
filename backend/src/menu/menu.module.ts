import { Module } from '@nestjs/common';
import { MenuService } from './menu.service';
import { MenuController } from './menu.controller';
import { PrismaService } from '../../prisma/prisma.service';
import { RestaurantService } from '../restaurant/restaurant.service';
import { RestaurantModule } from '../restaurant/restaurant.module';

@Module({
  imports: [RestaurantModule],
  controllers: [MenuController],
  providers: [MenuService, PrismaService, RestaurantService],
  exports: [MenuService],
})
export class MenuModule {}
