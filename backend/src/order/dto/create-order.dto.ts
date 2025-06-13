import { Type } from "class-transformer";
import { IsArray, IsBoolean, IsDate, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, ValidateNested } from "class-validator";
import { OrderMenu, OrderStatus } from "@prisma/client";

export class CreateOrderMenusDto {
    @IsNotEmpty()
    @IsString()
    menuId: string;

    @IsNotEmpty()
    @IsNumber()
    @IsPositive()
    @Type(() => Number)
    units: number;

    @IsNotEmpty()
    @IsString()
    value: string;
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
    @IsString()
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

    @IsBoolean()
    @IsNotEmpty()
    isPaid: boolean;

    @IsArray()
    @IsNotEmpty()
    @ValidateNested({ each: true })
    @Type(() => CreateOrderMenusDto)
    orderMenus: CreateOrderMenusDto[];
}