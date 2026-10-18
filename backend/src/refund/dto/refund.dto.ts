import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { RefundReason, RefundStatus } from '@prisma/client';

export class CreateRefundRequestDto {
  @IsEnum(RefundReason)
  reason: RefundReason;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  details?: string;
}

export const REFUND_ACTIONS = ['approve', 'reject', 'mark_refunded'] as const;
export type RefundAction = (typeof REFUND_ACTIONS)[number];

export class DecideRefundDto {
  @IsIn(REFUND_ACTIONS)
  action: RefundAction;

  /** Required for `reject` (checked in the service so the message stays specific). */
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class ListRefundsQueryDto {
  @IsOptional()
  @IsEnum(RefundStatus)
  status?: RefundStatus;

  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
