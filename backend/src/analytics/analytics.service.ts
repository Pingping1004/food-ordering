import { Injectable, Logger } from '@nestjs/common';
import {
  CreateEventDto,
  EventMetadata,
  EventName,
  EventSource,
  Events,
} from './dto/analytics.dto';
import { Order, Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateClientEventDto } from './dto/client-event.dto';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}
  private readonly logger = new Logger(AnalyticsService.name);
  private readonly recentEvents: Events[] = [];

  async trackEvent(dto: CreateEventDto): Promise<void> {
    try {
      const event: Events = {
        name: dto.name,
        source: dto.source,
        userId: dto.userId,
        restaurantId: dto.restaurantId,
        metadata: dto.metadata,
        createdAt: new Date(),
      };
      this.recentEvents.unshift(event);
      if (this.recentEvents.length > 500) {
        this.recentEvents.pop();
      }
      this.logger.log(
        `[Event ${dto.name}] from ${dto.source}: restaurant=${dto.restaurantId ?? 'none'}`,
      );
    } catch (error) {
      this.logger.warn(
        `Failed to save event: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /** Persists a client-emitted event. Never throws: analytics must not break the caller. */
  async recordClientEvent(dto: CreateClientEventDto, userId?: string) {
    try {
      await this.prisma.events.create({
        data: {
          name: dto.name,
          source: dto.source,
          userId,
          restaurantId: dto.restaurantId,
          schoolId: dto.schoolId,
          metadata: dto.metadata as Prisma.InputJsonValue | undefined,
        },
      });
    } catch (error) {
      this.logger.warn(
        `Failed to save client event: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async trackOrderEvent(
    name: EventName,
    order: Pick<
      Order,
      'orderId' | 'restaurantId' | 'status' | 'paymentStatus'
    > & { userId?: string | null },
    metadata?: EventMetadata,
  ) {
    await this.trackEvent({
      name,
      source: EventSource.backend_system,
      restaurantId: order.restaurantId,
      userId: order.userId ?? undefined,
      metadata: {
        ...metadata,
        order: {
          orderId: order.orderId,
          ...metadata?.order,
        },
      },
    });
  }

  async getEvents(): Promise<Events[]> {
    return this.recentEvents.slice(0, 100);
  }

  async getEventsByRestaurantId(restaurantId: string): Promise<Events[]> {
    return this.recentEvents
      .filter((e) => e.restaurantId === restaurantId)
      .slice(0, 100);
  }

  async getEventsByUserId(userId: string): Promise<Events[]> {
    return this.recentEvents.filter((e) => e.userId === userId).slice(0, 100);
  }

  async getEventsBySource(eventSource: EventSource): Promise<Events[]> {
    return this.recentEvents
      .filter((e) => e.source === eventSource)
      .slice(0, 100);
  }

  async getEventsByName(eventName: EventName): Promise<Events[]> {
    return this.recentEvents.filter((e) => e.name === eventName).slice(0, 100);
  }
}
