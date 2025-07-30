import {
  Module,
  NestModule,
  MiddlewareConsumer,
  RequestMethod,
} from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { HttpExceptionFilter } from './libs/http-exception.filter';
import { CatchEverythingFilter } from './libs/catch-everything.filter';
import { RequestLoggerMiddleware } from 'src/logger.middleware';
import configuration from './config/configuration';

// Service and controller
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RestaurantModule } from './restaurant/restaurant.module';
import { MenuModule } from './menu/menu.module';
import { RestaurantService } from './restaurant/restaurant.service';
import { MenuService } from './menu/menu.service';
import { RestaurantController } from './restaurant/restaurant.controller';
import { MenuController } from './menu/menu.controller';
import { PrismaModule } from './prisma/prisma.module';
import { PrismaService } from './prisma/prisma.service';
import { OrderModule } from './order/order.module';
import { OrderService } from './order/order.service';
import { OrderController } from './order/order.controller';
import { PaymentModule } from './payment/payment.module';
import { PaymentService } from './payment/payment.service';
import { PaymentController } from './payment/payment.controller';
import { ConfigModule } from '@nestjs/config';
import { PayoutModule } from './payout/payout.module';
import { PayoutController } from './payout/payout.controller';
import { PayoutService } from './payout/payout.service';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { AdminModule } from './admin/admin.module';
import { UploadModule } from './upload/upload.module';
import { UploadController } from './upload/upload.controller';
import { RefreshTokenModule } from './refreshToken/refresh-token.module';
import { CsrfTokenService } from './csrf/csrf.service';
import { CsrfModule } from './csrf/csrf.module';
import { RefreshTokenService } from './refreshToken/refresh-token.service';
import { ThrottlerModule } from '@nestjs/throttler';
import { S3Module } from './s3/s3.module';
import { S3Service } from './s3/s3.service';

@Module({
  imports: [
    RestaurantModule,
    MenuModule,
    PrismaModule,
    OrderModule,
    PaymentModule,
    UploadModule,
    CsrfModule,
    RefreshTokenModule,
    S3Module,
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: 60000,
          limit: 10,
        },
      ],
    }),
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: '.env',
    }),
    PayoutModule,
    AuthModule,
    UserModule,
    AdminModule,
  ],
  controllers: [
    AppController,
    RestaurantController,
    MenuController,
    OrderController,
    PaymentController,
    PayoutController,
    UploadController,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    {
      provide: APP_FILTER,
      useClass: CatchEverythingFilter,
    },
    CsrfTokenService,
    AppService,
    RestaurantService,
    MenuService,
    PrismaService,
    OrderService,
    PaymentService,
    PayoutService,
    RefreshTokenService,
    S3Service,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggerMiddleware).forRoutes({
      path: '*',
      method: RequestMethod.ALL,
    });
  }
}
