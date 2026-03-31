import { PartialType } from '@nestjs/swagger';
import { CreatePayoutDto } from './create-payout.dto';
import {
  IsOptional,
  IsDate,
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsPositive,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdatePayoutDto extends PartialType(CreatePayoutDto) {
  @IsBoolean()
  @IsNotEmpty()
  isPaid: boolean

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
