import { Type, Transform } from "class-transformer";
import {
  IsArray,
  IsDate,
  IsEnum,
  IsOptional,
  IsNumber,
  IsPositive,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
  IsIn
} from "class-validator";
import { IsPaid, OrderStatus } from "@prisma/client";
import { BadRequestException } from "@nestjs/common";
import { plainToInstance } from "class-transformer";
import { CreatePaymentDto } from "src/payment/dto/create-payment.dto";

console.log('--- CORRECT CreateOrderMenusDto file is being loaded! ---');

export class UpdateOrderMenusDto {
  @IsUUID('4', { message: 'menuId must be a valida UUID' })
  @IsOptional()
  menuI?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  quantity?: number;

  @IsOptional()
  @IsString()
  menuName?: string;

  @IsNumber()
  @IsOptional()
  @IsPositive()
  @Type(() => Number)
  unitPrice?: number;

  @IsOptional()
  @IsString()
  menuImg?: string;

  @IsOptional()
  @IsString()
  details?: string;
}

export class UpdateOrderDto {
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @IsOptional()
  @IsUUID()
  restaurantId?: string;

  @IsDate()
  @IsOptional()
  @Type(() => Date)
  orderAt?: Date;

  @IsDate()
  @IsOptional()
  @Type(() => Date)
  deliverAt?: Date;

  @IsOptional()
  @IsString()
  orderSlip?: string;

  @IsOptional()
  @IsString()
  details?: string;

  @IsEnum(IsPaid)
  @IsOptional()
  @ValidateNested({ each: true })
  @IsIn(['unpaid'])
  isPaid?: IsPaid;

  @IsArray()
  @IsOptional({ message: 'Order must contain at least one menu item' })
  @ValidateNested({ each: true })
  @Type(() => UpdateOrderMenusDto)
  orderMenu?: UpdateOrderMenusDto[];

  @IsOptional()
  paymentDetail?: CreatePaymentDto;

  @IsOptional() // Could be null if no payment initiated or failed initiation
  @IsString()
  omiseChargeId?: string;

  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @IsOptional() // Could be null if no payment initiated or before first update
  @IsString() // Use string as Omise provides various statuses
  paymentGatewayStatus?: string;
}