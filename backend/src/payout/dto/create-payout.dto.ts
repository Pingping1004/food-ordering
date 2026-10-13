import { Type } from 'class-transformer';
import {
  IsDate,
  IsISO8601,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreatePayoutDto {
  @IsString()
  @IsNotEmpty()
  restaurantEarning: string;

  @IsString()
  @IsNotEmpty()
  platformNetEarning: string;

  @IsString()
  @IsNotEmpty()
  transactionFee: string;

  @IsISO8601()
  @IsOptional()
  paidAt?: string;

  @Type(() => Date)
  @IsDate()
  startDate: Date;

  @Type(() => Date)
  @IsDate()
  endDate: Date;

  @IsUUID()
  orderId: string;

  @IsUUID()
  restaurantId: string;

  @IsString()
  restaurantName: string;
}