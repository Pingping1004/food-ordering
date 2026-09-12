import { Type, Transform } from "class-transformer";
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
  IsIn,
  ArrayMinSize,
  ArrayMaxSize
} from "class-validator";

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
}

export class CreateOrderDto {
  @IsNotEmpty()
  @IsUUID()
  restaurantId!: string;

  @IsOptional()
  @IsString()
  details?: string;

  @IsDate()
  @IsNotEmpty()
  @Type(() => Date)
  pickupAt: Date;

  @IsArray()
  @IsNotEmpty({ message: 'Order must contain at least one menu item' })
  @ArrayMinSize(1, { message: 'Order must contain at least one menu item' })
  @ArrayMaxSize(10, { message: 'Order cannot contain more than 10 different items' })
  @ValidateNested({ each: true })
  @Type(() => CreateOrderMenusDto)
  orderMenus: CreateOrderMenusDto[];
}