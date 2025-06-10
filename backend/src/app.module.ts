import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RestaurantModule } from './restaurant/restaurant.module';
import { MenuModule } from './menu/menu.module';
import { RestaurantService } from './restaurant/restaurant.service';
import { MenuService } from './menu/menu.service';
import { RestaurantController } from './restaurant/restaurant.controller';
import { MenuController } from './menu/menu.controller';
import { PrismaModule } from 'prisma/prisma.module';
import { PrismaService } from 'prisma/prisma.service';

@Module({
  imports: [RestaurantModule, MenuModule, PrismaModule],
  controllers: [AppController, RestaurantController, MenuController],
  providers: [AppService, RestaurantService, MenuService, PrismaService],
})
export class AppModule {}
