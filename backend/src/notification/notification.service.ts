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
    memberships?: Array<{ userId: string }>;
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

  /**
   * Best-effort generic push (no order, no retry job, no delivery log) - used for refund notices.
   * Never throws: callers must not depend on it.
   */
  async sendToUsers(
    userIds: string[],
    payload: { title: string; body: string; path?: string },
  ): Promise<void> {
    try {
      if (!this.messaging || userIds.length === 0) return;
      const tokens = await this.prisma.deviceToken.findMany({
        where: { userId: { in: userIds }, isActive: true },
        select: { token: true },
      });
      if (!tokens.length) return;
      const link = `${this.getFrontendBaseUrl()}${payload.path ?? '/'}`;
      await this.messaging.sendEachForMulticast({
        tokens: tokens.map((t) => t.token),
        data: { title: payload.title, body: payload.body, link },
        webpush: {
          notification: {
            title: payload.title,
            body: payload.body,
            icon: `${this.getFrontendBaseUrl()}/favicon.svg`,
          },
          fcmOptions: { link },
        },
      });
    } catch (error) {
      this.logger.warn(
        `sendToUsers failed: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  /**
   * Tells the student who placed the order that it is ready, or that the shop is running late.
   * Only students who enabled notifications (an active device token) receive it; never throws.
   */
  async notifyStudentOrderUpdate(
    orderId: string,
    event: 'ready' | 'delay',
  ): Promise<void> {
    try {
      const order = await this.prisma.order.findUnique({
        where: { orderId },
        select: { userId: true, restaurant: { select: { name: true } } },
      });
      if (!order?.userId) return;
      const shop = order.restaurant?.name ?? 'ร้านอาหาร';
      const payload =
        event === 'ready'
          ? {
              title: 'อาหารพร้อมแล้ว',
              body: `ออเดอร์จาก ${shop} พร้อมรับแล้ว มารับได้เลย`,
            }
          : {
              title: 'ร้านแจ้งว่าอาหารจะช้ากว่าเดิม',
              body: `${shop} ขอเวลาเพิ่มอีกเล็กน้อย ดูเวลารับใหม่ได้ที่หน้าออเดอร์`,
            };
      await this.sendToUsers([order.userId], {
        ...payload,
        path: `/user/order/wait/${orderId}`,
      });
    } catch (error) {
      this.logger.warn(
        `notifyStudentOrderUpdate failed: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  async queueOrderCreated(orderId: string) {
    const order = await this.getOrderForNotification(orderId);
    if (!order) return;

    const targetUserId = order.restaurant.memberships?.[0]?.userId;
    if (!targetUserId) return;

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

    const targetUserId = order.restaurant.memberships?.[0]?.userId;
    if (!targetUserId) return;

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

  private processingJobs = false;

  /**
   * Sends the "new order" push to shops. It used to take 20 jobs per 20 s tick and send them one by one, i.e. at
   * most ~1 push per second: with a lunch rush of a few orders per second the queue fell minutes behind. Now a
   * tick takes up to 200 due jobs and works through them 5 at a time (a small, fixed share of the DB pool), and a
   * tick is skipped while the previous one is still running so slow pushes cannot pile up.
   */
  @Cron('*/5 * * * * *')
  async processPendingNotificationJobs() {
    if (this.processingJobs) return;
    this.processingJobs = true;
    try {
      const dueJobs = await this.prisma.withRetry(() =>
        this.prisma.pushNotificationJob.findMany({
          where: {
            eventType: PushEventType.new_order,
            completedAt: null,
            cancelledAt: null,
            attemptCount: { lt: 3 },
            nextAttemptAt: { lte: new Date() },
          },
          take: 200,
          orderBy: {
            nextAttemptAt: 'asc',
          },
        }),
      );

      const CONCURRENCY = 5;
      for (let i = 0; i < dueJobs.length; i += CONCURRENCY) {
        const results = await Promise.allSettled(
          dueJobs
            .slice(i, i + CONCURRENCY)
            .map((job) => this.dispatchJob(job.orderId, job.userId, job.eventType)),
        );
        for (const r of results)
          if (r.status === 'rejected')
            this.logger.warn(`Push job failed: ${(r.reason as Error)?.message}`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to process pending notification jobs: ${(error as Error).message}`,
      );
    } finally {
      this.processingJobs = false;
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

    if (
      eventType === PushEventType.new_order &&
      order.status !== OrderStatus.receive
    ) {
      await this.completeJob(
        job.pushNotificationJobId,
        'order_already_acknowledged',
      );
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

      this.logger.warn(
        'Skipping push send because Firebase Admin config is missing',
      );
      return { errorMessage: 'Firebase Admin SDK is not configured' };
    }

    const messagePayload = this.buildMessagePayload(order, eventType);
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
          icon: `${this.getFrontendBaseUrl()}/favicon.svg`,
          badge: `${this.getFrontendBaseUrl()}/favicon.svg`,
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
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
          },
        },
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
  ) {
    const summary = order.orderMenus
      .slice(0, 2)
      .map((item) => `${item.menuName} x${item.quantity}`)
      .join(', ');
    const body =
      eventType === PushEventType.payment_verified
        ? `ออเดอร์${order.orderId.slice(0, 4)} ชำระเงินแล้ว`
        : summary || `ออเดอร์ ${order.orderId.slice(0, 6)}`;

    const title =
      eventType === PushEventType.payment_verified
        ? `ยืนยันการชำระเงิน ออเดอร์${order.orderId.slice(0, 4)}`
        : `ออเดอร์ใหม่ ${order.orderId.slice(0, 4)}`;

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

  private async getOrderForNotification(
    orderId: string,
  ): Promise<NotificationOrder | null> {
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
            memberships: {
              select: {
                userId: true,
              },
            },
          },
        },
        orderMenus: {
          select: {
            quantity: true,
            menuName: true,
          },
        },
      },
    });
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
