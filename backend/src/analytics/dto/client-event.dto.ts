import { EventName, EventSource } from '@prisma/client';
import { IsEnum, IsIn, IsObject, IsOptional, IsUUID } from 'class-validator';

/** Events the web clients may emit; backend-only events (order_*, cron, …) are not accepted here. */
export const CLIENT_EVENT_NAMES = [
  EventName.feedback_submitted,
  EventName.client_error,
  EventName.restaurant_viewed,
  EventName.menu_viewed,
  EventName.checkout_started,
] as const;

export const CLIENT_EVENT_SOURCES = [
  EventSource.student_web,
  EventSource.restaurant_cms,
  EventSource.admin_panel,
] as const;

export class CreateClientEventDto {
  @IsEnum(EventName)
  @IsIn(CLIENT_EVENT_NAMES)
  name: EventName;

  @IsEnum(EventSource)
  @IsIn(CLIENT_EVENT_SOURCES)
  source: EventSource;

  @IsOptional()
  @IsUUID()
  restaurantId?: string;

  @IsOptional()
  @IsUUID()
  schoolId?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
