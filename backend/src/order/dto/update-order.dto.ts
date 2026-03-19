import { Type } from 'class-transformer';
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
  ArrayMaxSize,
} from 'class-validator';
import { PaymentMethod, OrderStatus, PaymentStatus } from '@prisma/client';
import { CreateOrderDto, CreateOrderMenusDto } from './create-order.dto';
import { PartialType } from '@nestjs/swagger';

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

  @IsString()
  @IsOptional()
  userTel: string;

  @IsEnum(PaymentStatus)
  @IsOptional()
  paymentStatus: PaymentStatus;

  @IsDate()
  @IsOptional()
  @Type(() => Date)
  orderAt?: Date;

  @IsDate()
  @IsOptional()
  @Type(() => Date)
  deliverAt?: Date;

  @IsDate()
  @IsOptional()
  @Type(() => Date)
  acceptAt?: Date;

  @IsDate()
  @IsOptional()
  @Type(() => Date)
  completedAt?: Date;

  @IsDate()
  @IsOptional()
  @Type(() => Date)
  paidAt?: Date;

  @IsDate()
  @IsOptional()
  @Type(() => Date)
  cancelledAt?: Date;

  @IsDate()
  @IsOptional()
  @Type(() => Date)
  rejectedAt?: Date;

  @IsDate()
  @IsOptional()
  @Type(() => Date)
  refundAt?: Date;

  @IsOptional()
  @IsBoolean()
  isDelay?: boolean;

  @IsArray()
  @IsOptional({ message: 'Order must contain at least one menu item' })
  @ArrayMinSize(1, { message: 'Order must contain at least one menu item' })
  @ArrayMaxSize(10, {
    message: 'Order cannot contain more than 10 different items',
  })
  @ValidateNested({ each: true })
  @Type(() => UpdateOrderMenusDto)
  orderMenus?: UpdateOrderMenusDto[];

  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @IsOptional()
  @IsString()
  paymentGatewayStatus?: string;
}