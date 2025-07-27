import {
  IsDate,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import Decimal from 'decimal.js';

export class CreatePayoutDto {
  @IsNumber()
  @IsNotEmpty()
  restaurantRevenue: number | Decimal;

  @IsNumber()
  @IsNotEmpty()
  platformFee: number | Decimal;

  @IsDate()
  @IsOptional()
  paidAt?: string;

  @IsDate()
  @IsNotEmpty()
  startDate: Date;

  @IsDate()
  @IsNotEmpty()
  endDate: Date;

  @IsUUID()
  @IsNotEmpty()
  orderId: string;

  @IsUUID()
  @IsNotEmpty()
  restaurantId: string;

  @IsString()
  @IsNotEmpty()
  restaurantName: string;
}
