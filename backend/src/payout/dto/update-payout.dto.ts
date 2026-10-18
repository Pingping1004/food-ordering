import { PartialType } from '@nestjs/swagger';
import { CreatePayoutDto } from './create-payout.dto';
import {
  IsOptional,
  IsDate,
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
export enum PayoutStatus {
  initiated = 'initiated',
  processing = 'processing',
  success = 'success',
  failed = 'failed',
}

export class UpdatePayoutDto extends PartialType(CreatePayoutDto) {
  @IsEnum(PayoutStatus)
  @IsNotEmpty()
  payoutStatus: PayoutStatus;

  @IsOptional()
  @IsPositive()
  @IsNumber()
  @Type(() => Number)
  refundAmount?: number;

  @IsDate()
  @IsOptional()
  paidAt?: string;

  @IsDate()
  @IsOptional()
  refundAt?: string;
}
