import { Injectable, Logger } from "@nestjs/common";
import { CreateEventDto, EventMetadata } from "./dto/analytics.dto";
import { EventName, EventSource, Events, Order } from "@prisma/client";
import { PrismaService } from "src/prisma/prisma.service";

@Injectable()
export class AnalyticsService {
    constructor(
        private readonly prisma: PrismaService,
    ) { }
    private readonly logger = new Logger(AnalyticsService.name)

    async trackEvent(dto: CreateEventDto): Promise<void> {
        try {
            await this.prisma.events.create({
                data: {
                    name: dto.name,
                    source: dto.source,
                    userId: dto.userId,
                    restaurantId: dto.restaurantId,
                    metadata: dto.metadata,
                }

            });

        } catch (error) {
            this.logger.warn(`Failed to save event: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    async trackOrderEvent(name: EventName, order: Pick<Order,'orderId' | 'restaurantId' | 'userId' | 'status' | 'paymentStatus'>, metadata?: EventMetadata) {
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
            }
        });

        console.log("Create order event successfully")
    }

    async getEvents(): Promise<Events[]> {
        const events = await this.prisma.events.findMany({
            take: 100
        });

        return events;
    }

    async getEventsByRestaurantId(restaurantId: string): Promise<Events[]> {
        const events = await this.prisma.events.findMany({
            where: { restaurantId },
            orderBy: { createdAt: 'desc' },
            take: 100,
        });

        return events;
    }

    async getEventsByUserId(userId: string): Promise<Events[]> {
        const events = await this.prisma.events.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: 100,
        });

        return events;
    }

    async getEventsBySource(eventSource: EventSource): Promise<Events[]> {
        const events = await this.prisma.events.findMany({
            where: { source: eventSource },
            orderBy: { createdAt: 'desc' },
            take: 100,
        });

        return events;
    }

    async getEventsByName(eventName: EventName): Promise<Events[]> {
        const events = await this.prisma.events.findMany({
            where: { name: eventName },
            orderBy: { createdAt: 'desc' },
            take: 100,
        });

        return events;
    }
}