import { OrderStatus, PaymentStatus, Prisma } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

export enum EventName {
  queue_limit_reached = 'queue_limit_reached',
  order_submitted = 'order_submitted',
  order_auto_accepted = 'order_auto_accepted',
  order_paid = 'order_paid',
  payment_verification_failed = 'payment_verification_failed',
  order_delayed = 'order_delayed',
  order_accepted = 'order_accepted',
  order_rejected = 'order_rejected',
  order_cancelled = 'order_cancelled',
  order_expired = 'order_expired',
  order_completed = 'order_completed',
  order_auto_rejected = 'order_auto_rejected',
  restaurant_closed = 'restaurant_closed',
  restaurant_reopened = 'restaurant_reopened',
}

export enum EventSource {
  backend_system = 'backend_system',
  restaurant_cms = 'restaurant_cms',
  cron_job = 'cron_job',
}

export interface Events {
  id?: string;
  name: EventName;
  source: EventSource;
  userId?: string;
  restaurantId?: string;
  metadata?: any;
  createdAt?: Date;
}

export enum EventActor {
  user = 'user',
  restaurant = 'restaurant',
  system = 'system',
  cron_job = 'cron_job',
  payment_gateway = 'payment_gateway',
}

export interface EventMetadata {
  actor?: EventActor;
  reason?: string;
  order?: {
    orderId?: string;
    previousStatus?: OrderStatus;
    autoAccepted?: boolean;
    nextStatus?: OrderStatus;
  };
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
