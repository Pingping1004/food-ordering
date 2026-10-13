import { EventName, EventSource, OrderStatus, PaymentStatus, Prisma } from "@prisma/client";
import { IsEnum, IsNotEmpty, IsOptional, IsUUID } from "class-validator";

export enum EventActor {
    user = "user",
    restaurant = "restaurant",
    system = "system",
    cron_job = "cron_job",
    payment_gateway = "payment_gateway",
}

export interface EventMetadata {
    actor?: EventActor;
    reason?: string;
    order?: {
        orderId?: string;
        previousStatus?: OrderStatus;
        autoAccepted?: boolean;
        nextStatus?: OrderStatus;
    }
    counts?: {
        completed?: number;
        cancelled?: number;
        rejected?: number;
    };

    payment?: {
        status?: PaymentStatus;
        transactionId?: string;
        paidAt?: Date;
        gatewayStatus?: string;
    };

    inventory?: {
        outOfStockMenus?: string[];
    };

    queue?: {
        activeOrders?: number;
        maxActiveOrders?: number;
    };
    extra?: Record<string, any>;
}

export class CreateEventDto {
    @IsNotEmpty()
    @IsEnum(EventName)
    name: EventName;

    @IsNotEmpty()
    @IsEnum(EventSource)
    source: EventSource;

    @IsOptional()
    @IsUUID()
    userId?: string;

    @IsOptional()
    @IsUUID()
    restaurantId?: string;

    @IsOptional()
    metadata?: Prisma.InputJsonValue & EventMetadata;
}