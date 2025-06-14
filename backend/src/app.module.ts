import { Module, NestModule, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { HttpExceptionFilter } from './common/http-exception.filter';
import { CatchEverythingFilter } from './common/catch-everything.filter';
import { RequestLoggerMiddleware } from 'logger.middleware';
import { MulterModule } from '@nestjs/platform-express';

// Service and controller
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
import { OrderModule } from './order/order.module';
import { OrderService } from './order/order.service';
import { OrderController } from './order/order.controller';
import { PaymentModule } from './payment/payment.module';
import { PaymentService } from './payment/payment.service';
import { PaymentController } from './payment/payment.controller';

@Module({
  imports: [
    RestaurantModule,
    MenuModule,
    PrismaModule,
    OrderModule,
    PaymentModule,

    MulterModule.registerAsync({
      useFactory: () => ({
        dest: './uploads',
        limits: { fileSize: 5 * 1024 * 1024 },
      }),
    }),
  ],
  controllers: [AppController, RestaurantController, MenuController, OrderController, PaymentController],
  providers: [
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    {
      provide: APP_FILTER,
      useClass: CatchEverythingFilter,
    },
    AppService,
    RestaurantService,
    MenuService,
    PrismaService,
    OrderService,
    PaymentService,
  ],
})

export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(RequestLoggerMiddleware)
      .forRoutes({
        path: '*',
        method: RequestMethod.ALL,
      });
  }
}
