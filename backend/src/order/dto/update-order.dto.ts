import { IsOptional, IsString, IsNumber, IsEnum, IsDate, IsArray, IsBoolean, IsPositive, ValidateNested } from 'class-validator'
import { Type } from 'class-transformer';
import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateOrderDto, CreateOrderMenusDto } from './create-order.dto';
import { OrderStatus, OrderMenu, IsPaid } from '@prisma/client';


export class UpdateOrderMenusDto extends PartialType(CreateOrderMenusDto) {
    @IsOptional()
    @IsString()
    menuId?: string;

    @IsOptional()
    @IsNumber()
    @IsPositive()
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

    @IsNumber()
    @IsOptional()
    @IsPositive()
    @Type(() => Number)
    totalPrice?: number;

    @IsOptional()
    @IsString()
    menuImg?: string;
}

export class UpdateOrderDto extends PartialType(OmitType(CreateOrderDto, ['orderMenus'] as const)) {
    @IsOptional()
    @IsEnum(OrderStatus, { each: true })
    status?: OrderStatus;

    @IsOptional()
    @IsString()
    restaurantId?: string;

    @IsDate()
    @IsOptional()
    orderAt?: Date;

    @IsDate()
    @IsOptional()
    deliverAt?: Date;

    @IsOptional()
    @IsString()
    orderSlip?: string;

    @IsOptional()
    @IsString()
    details?: string;

    @IsOptional()
    @IsBoolean()
    isPaid?: boolean;

    @IsBoolean()
    @IsOptional()
    isDelay?: boolean;

    @IsArray()
    @IsOptional()
    @ValidateNested({ each: true })
    @Type(() => UpdateOrderMenusDto)
    orderMenus?: UpdateOrderMenusDto[];
}