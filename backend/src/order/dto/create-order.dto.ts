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
  ValidateNested } from "class-validator";
import { IsPaid, OrderStatus } from "@prisma/client";
import { BadRequestException } from "@nestjs/common";
import { ApiProperty } from '@nestjs/swagger'
import { plainToInstance } from "class-transformer";

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
  value: string;

  @IsNumber()
  @IsNotEmpty()
  @IsPositive()
  @Type(() => Number)
  price: number;
}

export class CreateOrderDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  price: number;

  @IsNotEmpty()
  @IsEnum(OrderStatus)
  status: OrderStatus;

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
  details?: string;

  @IsBoolean()
  @IsNotEmpty()
  @Type(() => Boolean)
  isDelay: boolean;

  @IsString()
  @IsOptional()
  refCode?: string;

  @Transform(({ value }) => {
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      throw new Error('orderMenus must be a JSON array string.');
    }

    // Manually convert each plain object into class instance
    return parsed.map(item => plainToInstance(CreateOrderMenusDto, item));
  } catch (e) {
    throw new BadRequestException('orderMenus must be a valid JSON array string.');
  }
})
@IsArray()
@IsNotEmpty({ message: 'Order must contain at least one menu item' })
@ValidateNested({ each: true })
@Type(() => CreateOrderMenusDto)
orderMenus: CreateOrderMenusDto[];

}