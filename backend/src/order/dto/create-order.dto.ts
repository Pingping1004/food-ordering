import { Type, Transform } from "class-transformer";
import { IsArray, IsBoolean, IsDate, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, IsUUID, Min, ValidateNested } from "class-validator";
import { IsPaid, OrderStatus } from "@prisma/client";
import { BadRequestException } from "@nestjs/common";

export class CreateOrderMenusDto {
    @IsNotEmpty()
    @IsString()
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
    @IsEnum(OrderStatus, { each: true })
    status: OrderStatus;

    @IsNotEmpty()
    @IsUUID()
    restaurantId: string;

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

    @IsNotEmpty()
    @IsEnum(IsPaid, { each: true })
    isPaid: IsPaid;

    @IsBoolean()
    @IsNotEmpty()
    @Type(() => Boolean)
    isDelay: boolean;

    @IsString()
    @IsOptional()
    refCode?: string;

     @Transform(({ value }) => {
    console.log('Transforming orderMenus. Incoming value type:', typeof value); // What type is it?
    console.log('Transforming orderMenus. Incoming value:', value); // What is the actual value?
    try {
      const parsed = JSON.parse(value);
      console.log('Transforming orderMenus. Parsed value type:', typeof parsed); // What type after parse?
      console.log('Transforming orderMenus. Parsed value:', parsed); // What is the parsed value?

      if (!Array.isArray(parsed)) {
        // This check should trigger if JSON.parse worked but it wasn't an array (e.g., it was "null" or "{}")
        throw new Error('orderMenus must be a JSON array string.');
      }
      return parsed;
    } catch (e) {
      // This catch block will tell us if JSON.parse itself is failing
      console.error('Transforming orderMenus. JSON parsing failed:', e);
      throw new BadRequestException('orderMenus must be a valid JSON array string.');
    }
  })
    @IsArray()
    @IsNotEmpty({ message: 'Order must contain at least one menu item' })
    @ValidateNested({ each: true })
    @Type(() => CreateOrderMenusDto)
    orderMenus: CreateOrderMenusDto[];
}