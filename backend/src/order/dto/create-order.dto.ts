import { Type, Transform } from "class-transformer";
import {
  IsArray,
  isEnum,
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
  IsIn,
  ArrayMinSize,
  ArrayMaxSize
} from "class-validator";
import { IsPaid, OrderStatus } from "@prisma/client";
import { CreatePaymentDto } from "src/payment/dto/create-payment.dto";

console.log('--- CORRECT CreateOrderMenusDto file is being loaded! ---');

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
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @IsNotEmpty()
  @IsUUID()
  restaurantId!: string;

  @IsDate()
  @IsNotEmpty()
  @Type(() => Date)
  orderAt: Date;

  @IsDate()
  @IsNotEmpty()
  @Type(() => Date)
  deliverAt: Date;

  @IsOptional()
  @IsString()
  orderSlip?: string;

  @IsOptional()
  @IsString()
  details?: string;

  // @IsEnum(IsPaid)
  // @IsNotEmpty()
  // @ValidateNested({ each: true })
  // @IsIn(['unpaid'])
  // isPaid: IsPaid;

  // @Transform(({ value }) => {
  //   try {
  //     const parsed = JSON.parse(value);
  //     if (!Array.isArray(parsed)) {
  //       throw new Error('orderMenus must be a JSON array string.');
  //     }

  //     // Manually convert each plain object into class instance
  //     return parsed.map(item => plainToInstance(CreateOrderMenusDto, item));
  //   } catch (e) {
  //     throw new BadRequestException('orderMenus must be a valid JSON array string.');
  //   }
  // })
  @IsArray()
  @IsNotEmpty({ message: 'Order must contain at least one menu item' })
  @ArrayMinSize(1, { message: 'Order must contain at least one menu item' })
  @ArrayMaxSize(10, { message: 'Order cannot contain more than 10 different items' })
  @ValidateNested({ each: true })
  @Type(() => CreateOrderMenusDto)
  orderMenus: CreateOrderMenusDto[];

  @IsNotEmpty()
  paymentDetails: CreatePaymentDto;

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