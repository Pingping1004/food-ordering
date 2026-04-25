import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from 'src/prisma/prisma.module';
import { NotificationController } from './notification.controller';
import { firebaseAdminMessagingProvider } from './firebase-admin.provider';
import { NotificationService } from './notification.service';

@Module({
  imports: [PrismaModule, ScheduleModule],
  controllers: [NotificationController],
  providers: [NotificationService, firebaseAdminMessagingProvider],
  exports: [NotificationService],
})
export class NotificationModule {}
