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
import { PayoutStatus } from '@prisma/client';

export class UpdatePayoutDto extends PartialType(CreatePayoutDto) {
  @IsEnum(PayoutStatus)
  @IsNotEmpty()
  payoutStatus: PayoutStatus

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
