import {
  Module,
  NestModule,
  MiddlewareConsumer,
  RequestMethod,
} from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { UserRateLimitGuard } from './guards/user-rate-limit.guard';
import { SupabaseAuthGuard } from './guards/supabase-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { AccessModule } from './access/access.module';
import { HttpExceptionFilter } from './libs/http-exception.filter';
import { CatchEverythingFilter } from './libs/catch-everything.filter';
import { RequestLoggerMiddleware } from 'src/logger.middleware';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RestaurantModule } from './restaurant/restaurant.module';
import { MenuModule } from './menu/menu.module';
import { PrismaModule } from './prisma/prisma.module';
import { OrderModule } from './order/order.module';
import { PaymentModule } from './payment/payment.module';
import { PayoutModule } from './payout/payout.module';
import { UserModule } from './user/user.module';
import { SchoolModule } from './school/school.module';
import { InviteModule } from './invite/invite.module';
import { SupportGrantModule } from './support-grant/support-grant.module';
import { RefundModule } from './refund/refund.module';
import { ComplaintModule } from './complaint/complaint.module';
import { UploadModule } from './upload/upload.module';
import { ThrottlerModule } from '@nestjs/throttler';
import { S3Module } from './s3/s3.module';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { InventoryModule } from './inventory/inventory.module';
import { ScheduleModule } from '@nestjs/schedule';
import { NotificationModule } from './notification/notification.module';
import { AnalyticsModule } from './analytics/dto/analytics.module';
import { SupabaseModule } from './supabase/supabase.module';

@Module({
  imports: [
    RestaurantModule,
    InventoryModule,
    MenuModule,
    PrismaModule,
    PaymentModule,
    OrderModule,
    PaymentModule,
    UploadModule,
    NotificationModule,
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
      envFilePath:
        process.env.NODE_ENV === 'production'
          ? '.env.production'
          : process.env.NODE_ENV === 'test'
            ? '.env.test'
            : '.env',
    }),
    ScheduleModule.forRoot(),
    PayoutModule,
    SupabaseModule,
    AccessModule,
    AnalyticsModule,
    UserModule,
    SchoolModule,
    InviteModule,
    SupportGrantModule,
    RefundModule,
    ComplaintModule,
  ],
  controllers: [AppController],
  providers: [
    // Authenticated by default; opt out with @Public(). Order matters: auth first, then roles.
    { provide: APP_GUARD, useClass: SupabaseAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: UserRateLimitGuard },
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    {
      provide: APP_FILTER,
      useClass: CatchEverythingFilter,
    },
    AppService,
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
