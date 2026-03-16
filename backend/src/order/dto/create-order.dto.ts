import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDate,
  IsEnum,
  IsNotEmpty,
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
import { PaymentMethod } from '@prisma/client';
import { CreatePaymentDto } from 'src/payment/dto/create-payment.dto';

export class CreateOrderMenusDto {
  @IsUUID('4', { message: 'menuId must be a valida UUID' })
  @IsNotEmpty()
  menuId: string;

  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  quantity: number;

  @IsNotEmpty()
  @IsString()
  menuName: string;

  @IsNumber()
  @IsNotEmpty()
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

export class CreateOrderDto {
  @IsNotEmpty()
  @IsUUID()
  restaurantId!: string;

  @IsString()
  @IsNotEmpty()
  userTel: string;

  @IsDate()
  @IsNotEmpty()
  @Type(() => Date)
  deliverAt: Date;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  acceptAt?: Date;

  @IsOptional()
  @IsBoolean()
  isDelay?: boolean;

  @IsArray()
  @IsNotEmpty({ message: 'Order must contain at least one menu item' })
  @ArrayMinSize(1, { message: 'Order must contain at least one menu item' })
  @ArrayMaxSize(10, {
    message: 'Order cannot contain more than 10 different items',
  })
  @ValidateNested({ each: true })
  @Type(() => CreateOrderMenusDto)
  orderMenus: CreateOrderMenusDto[];

  @IsNotEmpty()
  @IsDate()
  @Type(() => Date)
  paidAt: Date

  @IsOptional() // Could be null if no payment initiated or failed initiation
  @IsString()
  paymentId?: string;

  @IsNotEmpty()
  @IsString()
  paymentSlipImg: string;

  @IsOptional()
  @IsString()
  paymentGatewayStatus?: string;
}
