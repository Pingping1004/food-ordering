import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDate,
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

export class CreateOrderMenusDto {
  @IsUUID('4', { message: 'menuId must be a valid UUID' })
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

  @IsNotEmpty()
  @IsPositive()
  @IsNumber()
  @Type(() => Number)
  unitPrice: number;

  @IsOptional()
  @IsString()
  menuImg?: string;
}

export class CreateOrderDto {
  @IsNotEmpty()
  @IsUUID()
  restaurantId!: string;

  @IsString()
  @IsOptional()
  userTel?: string;

  @IsDate()
  @IsOptional()
  @Type(() => Date)
  deliverAt?: Date;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  acceptAt?: Date;

  @IsDate()
  @IsOptional()
  @Type(() => Date)
  pickupAt?: Date;

  @IsOptional()
  @IsString()
  details?: string;

  @IsArray()
  @IsNotEmpty({ message: 'Order must contain at least one menu item' })
  @ArrayMinSize(1, { message: 'Order must contain at least one menu item' })
  @ArrayMaxSize(10, {
    message: 'Order cannot contain more than 10 different items',
  })
  @ValidateNested({ each: true })
  @Type(() => CreateOrderMenusDto)
  orderMenus: CreateOrderMenusDto[];
}
