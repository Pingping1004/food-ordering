import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsDate,
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
  ArrayMinSize,
  ArrayMaxSize
} from "class-validator";
import { PaymentMethodType, OrderStatus } from "@prisma/client";
import { CreatePaymentDto } from "src/payment/dto/create-payment.dto";
import { CreateOrderDto, CreateOrderMenusDto } from "./create-order.dto";
import { PartialType } from "@nestjs/swagger";

export class UpdateOrderMenusDto extends PartialType(CreateOrderMenusDto) {
  @IsUUID('4', { message: 'menuId must be a valida UUID' })
  menuId: string;

  @IsNumber()
  @Min(1)
  @Type(() => Number)
  quantity: number;

  @IsString()
  menuName: string;

  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  unitPrice: number;

  @IsOptional()
  @IsString()
  menuImg?: string;

  @IsOptional()
  @IsString()
  details?: string;
}

export class UpdateOrderDto extends PartialType(CreateOrderDto) {
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
  details?: string;

  @IsOptional()
  @IsBoolean()
  isDelay?: boolean;

  @IsArray()
  @IsOptional({ message: 'Order must contain at least one menu item' })
  @ArrayMinSize(1, { message: 'Order must contain at least one menu item' })
  @ArrayMaxSize(10, { message: 'Order cannot contain more than 10 different items' })
  @ValidateNested({ each: true })
  @Type(() => UpdateOrderMenusDto)
  orderMenus?: UpdateOrderMenusDto[];

  @IsOptional()
  @Type(() => CreatePaymentDto)
  paymentDetails: CreatePaymentDto;

  @IsOptional() // Could be null if no payment initiated or failed initiation
  @IsString()
  omiseChargeId?: string;

  @IsOptional()
  @IsEnum(PaymentMethodType)
  paymentMethod?: PaymentMethodType;

  @IsOptional() // Could be null if no payment initiated or before first update
  @IsString() // Use string as Omise provides various statuses
  paymentGatewayStatus?: string;
}