import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { OrderStatus, PushEventType } from '@prisma/client';
import { Messaging } from 'firebase-admin/messaging';
import { PrismaService } from 'src/prisma/prisma.service';
import { RegisterDeviceTokenDto } from './dto/register-device-token.dto';
import { FIREBASE_ADMIN_MESSAGING } from './firebase-admin.provider';

type NotificationOrder = {
  orderId: string;
  restaurantId: string;
  status: OrderStatus;
  paymentStatus: string;
  restaurant: {
    name: string;
    userId: string;
  };
  orderMenus: Array<{
    quantity: number;
    menuName: string;
  }>;
};

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    @Inject(FIREBASE_ADMIN_MESSAGING)
    private readonly messaging: Messaging | null,
  ) {}

  async registerDeviceToken(userId: string, dto: RegisterDeviceTokenDto) {
    return this.prisma.deviceToken.upsert({
      where: { token: dto.token },
      create: {
        token: dto.token,
        userId,
        platform: dto.platform,
        userAgent: dto.userAgent,
        isActive: true,
        lastSeenAt: new Date(),
      },
      update: {
        userId,
        platform: dto.platform,
        userAgent: dto.userAgent,
        isActive: true,
        lastSeenAt: new Date(),
      },
    });
  }

  async deactivateDeviceToken(userId: string, token: string) {
    await this.prisma.deviceToken.updateMany({
      where: { userId, token },
      data: {
        isActive: false,
        lastSeenAt: new Date(),
      },
    });
  }

  async queueOrderCreated(orderId: string) {
    const order = await this.getOrderForNotification(orderId);
    if (!order) return;

    const targetUserId = order.restaurant.userId;

    await this.prisma.pushNotificationJob.upsert({
      where: {
        orderId_userId_eventType: {
          orderId,
          userId: targetUserId,
          eventType: PushEventType.new_order,
        },
      },
      create: {
        orderId,
        userId: targetUserId,
        restaurantId: order.restaurantId,
        eventType: PushEventType.new_order,
        nextAttemptAt: new Date(),
      },
      update: {
        cancelledAt: null,
        completedAt: null,
        nextAttemptAt: new Date(),
        lastError: null,
      },
    });

    await this.dispatchJob(orderId, targetUserId, PushEventType.new_order);
  }

  async sendPaymentVerified(orderId: string) {
    const order = await this.getOrderForNotification(orderId);
    if (!order) return;

    const targetUserId = order.restaurant.userId;
    await this.dispatchEvent({
      order,
      eventType: PushEventType.payment_verified,
      userId: targetUserId,
      attemptNumber: 1,
    });
  }

  async stopRetriesForOrder(orderId: string, reason = 'acknowledged') {
    await this.prisma.pushNotificationJob.updateMany({
      where: {
        orderId,
        eventType: PushEventType.new_order,
        completedAt: null,
        cancelledAt: null,
      },
      data: {
        completedAt: new Date(),
        lastError: reason,
      },
    });
  }

  @Cron('*/20 * * * * *')
  async processPendingNotificationJobs() {
    const dueJobs = await this.prisma.pushNotificationJob.findMany({
      where: {
        eventType: PushEventType.new_order,
        completedAt: null,
        cancelledAt: null,
        attemptCount: { lt: 3 },
        nextAttemptAt: { lte: new Date() },
      },
      take: 20,
      orderBy: {
        nextAttemptAt: 'asc',
      },
    });

    for (const job of dueJobs) {
      await this.dispatchJob(job.orderId, job.userId, job.eventType);
    }
  }

  private async dispatchJob(
    orderId: string,
    userId: string,
    eventType: PushEventType,
  ) {
    const job = await this.prisma.pushNotificationJob.findUnique({
      where: {
        orderId_userId_eventType: {
          orderId,
          userId,
          eventType,
        },
      },
    });

    if (!job || job.completedAt || job.cancelledAt) {
      return;
    }

    const order = await this.getOrderForNotification(orderId);
    if (!order) {
      await this.cancelJob(job.pushNotificationJobId, 'order_missing');
      return;
    }

    if (eventType === PushEventType.new_order && order.status !== OrderStatus.sent) {
      await this.completeJob(job.pushNotificationJobId, 'order_already_acknowledged');
      return;
    }

    const attemptNumber = job.attemptCount + 1;
    const dispatchResult = await this.dispatchEvent({
      order,
      eventType,
      userId,
      attemptNumber,
      jobId: job.pushNotificationJobId,
    });

    const shouldRetry = false;

    await this.prisma.pushNotificationJob.update({
      where: { pushNotificationJobId: job.pushNotificationJobId },
      data: {
        attemptCount: attemptNumber,
        lastAttemptAt: new Date(),
        nextAttemptAt: new Date(),
        completedAt: shouldRetry ? null : new Date(),
        lastError: dispatchResult.errorMessage ?? null,
      },
    });
  }

  private async dispatchEvent(params: {
    order: NotificationOrder;
    eventType: PushEventType;
    userId: string;
    attemptNumber: number;
    jobId?: string;
  }) {
    const { order, eventType, userId, attemptNumber, jobId } = params;
    const tokens = await this.prisma.deviceToken.findMany({
      where: {
        userId,
        isActive: true,
      },
    });

    if (!tokens.length) {
      await this.createDeliveryLog({
        orderId: order.orderId,
        restaurantId: order.restaurantId,
        userId,
        eventType,
        attemptNumber,
        success: false,
        errorMessage: 'No active notification tokens',
        pushNotificationJobId: jobId,
      });

      return { errorMessage: 'No active notification tokens' };
    }

    if (!this.messaging) {
      await Promise.all(
        tokens.map((tokenRecord) =>
          this.createDeliveryLog({
            orderId: order.orderId,
            restaurantId: order.restaurantId,
            userId,
            eventType,
            attemptNumber,
            success: false,
            errorMessage: 'Firebase Admin SDK is not configured',
            deviceTokenId: tokenRecord.deviceTokenId,
            pushNotificationJobId: jobId,
          }),
        ),
      );

      this.logger.warn('Skipping push send because Firebase Admin config is missing');
      return { errorMessage: 'Firebase Admin SDK is not configured' };
    }

    const messagePayload = this.buildMessagePayload(order, eventType, attemptNumber);
    const response = await this.messaging.sendEachForMulticast({
      tokens: tokens.map((tokenRecord) => tokenRecord.token),
      data: messagePayload.data,
      webpush: {
        headers: {
          Urgency: 'high',
        },
        notification: {
          title: messagePayload.title,
          body: messagePayload.body,
          icon: `${this.getFrontendBaseUrl()}/icons/icon-192.svg`,
          badge: `${this.getFrontendBaseUrl()}/icons/badge.svg`,
          tag: `${eventType}-${order.orderId}`,
          vibrate: [200, 100, 200],
          silent: false,
          requireInteraction: true,
        },
        fcmOptions: {
          link: `${this.getFrontendBaseUrl()}/cooker/${order.restaurantId}?orderId=${order.orderId}&event=${eventType}`,
        },
      },
      android: {
          priority: 'high',
          notification: {
            sound: 'default',
            channelId: 'high_priority',
          }
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
            }
          }
        },
    });

    const invalidTokenIds: string[] = [];
    let lastErrorMessage: string | undefined;

    await Promise.all(
      response.responses.map(async (result, index) => {
        const tokenRecord = tokens[index];
        const errorCode = result.error?.code;
        const errorMessage = result.error?.message;
        if (!result.success && this.isInvalidTokenError(errorCode)) {
          invalidTokenIds.push(tokenRecord.deviceTokenId);
        }
        if (!result.success && !lastErrorMessage) {
          lastErrorMessage = errorMessage ?? errorCode ?? 'push_failed';
        }

        await this.createDeliveryLog({
          orderId: order.orderId,
          restaurantId: order.restaurantId,
          userId,
          eventType,
          attemptNumber,
          success: result.success,
          providerMessageId: result.success ? result.messageId : undefined,
          errorCode,
          errorMessage,
          deviceTokenId: tokenRecord.deviceTokenId,
          pushNotificationJobId: jobId,
        });
      }),
    );

    if (invalidTokenIds.length) {
      await this.prisma.deviceToken.updateMany({
        where: { deviceTokenId: { in: invalidTokenIds } },
        data: { isActive: false, lastSeenAt: new Date() },
      });
    }

    return { errorMessage: lastErrorMessage };
  }

  private buildMessagePayload(
    order: NotificationOrder,
    eventType: PushEventType,
    attemptNumber: number,
  ) {
    const summary = order.orderMenus
      .slice(0, 2)
      .map((item) => `${item.menuName} x${item.quantity}`)
      .join(', ');
    const body =
      eventType === PushEventType.payment_verified
        ? 'ชำระเงินแล้ว'
        : summary || `Order ${order.orderId.slice(0, 6)}`;

    const title = eventType === PushEventType.payment_verified
        ? 'ยืนยันการชำระเงิน' : 'แจ้งเตือนออเดอร์ใหม่'

    return {
      title,
      body,
      data: {
        title,
        body,
        orderId: order.orderId,
        restaurantId: order.restaurantId,
        type: eventType,
      },
    };
  }

  private async createDeliveryLog(data: {
    orderId: string;
    userId: string;
    restaurantId: string;
    eventType: PushEventType;
    attemptNumber: number;
    success: boolean;
    providerMessageId?: string;
    errorCode?: string;
    errorMessage?: string;
    deviceTokenId?: string;
    pushNotificationJobId?: string;
  }) {
    await this.prisma.pushDelivery.create({
      data,
    });
  }

  private async getOrderForNotification(orderId: string): Promise<NotificationOrder | null> {
    return this.prisma.order.findUnique({
      where: { orderId },
      select: {
        orderId: true,
        restaurantId: true,
        status: true,
        paymentStatus: true,
        restaurant: {
          select: {
            name: true,
            userId: true,
          },
        },
        orderMenus: {
          select: {
            quantity: true,
            menuName: true,
          },
        },
      },
    }) as Promise<NotificationOrder | null>;
  }

  private isInvalidTokenError(errorCode?: string) {
    if (!errorCode) return false;

    return [
      'messaging/registration-token-not-registered',
      'messaging/invalid-registration-token',
      'messaging/invalid-argument',
    ].includes(errorCode);
  }

  private getFrontendBaseUrl() {
    return (
      this.configService.get<string>('frontendBaseUrl') ??
      process.env.FRONTEND_BASE_URL ??
      'http://localhost:3000'
    );
  }

  private async cancelJob(pushNotificationJobId: string, reason: string) {
    await this.prisma.pushNotificationJob.update({
      where: { pushNotificationJobId },
      data: {
        cancelledAt: new Date(),
        lastError: reason,
      },
    });
  }

  private async completeJob(pushNotificationJobId: string, reason: string) {
    await this.prisma.pushNotificationJob.update({
      where: { pushNotificationJobId },
      data: {
        completedAt: new Date(),
        lastError: reason,
      },
    });
  }
}
