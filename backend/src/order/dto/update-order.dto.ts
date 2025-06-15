import { IsOptional, IsString, IsNumber, IsEnum, IsDate, IsArray, IsBoolean, IsPositive, ValidateNested } from 'class-validator'
import { Type } from 'class-transformer';
import { PartialType } from '@nestjs/mapped-types';
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
    units?: number;

    @IsOptional()
    @IsString()
    value?: string;
}

export class UpdateOrderDto extends PartialType(CreateOrderDto) {
    @IsOptional()
    @IsString()
    name?: string;

    @IsOptional()
    @IsNumber()
    @IsPositive()
    @Type(() => Number)
    price?: number;

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
    details?: string;

    @IsOptional()
    @IsEnum(IsPaid, { each: true })
    isPaid?: IsPaid;

    @IsBoolean()
    @IsOptional()
    isDelay?: boolean;

    @IsString()
    @IsOptional()
    refCode?: string;

    @IsArray()
    @IsOptional()
    @ValidateNested({ each: true })
    @Type(() => UpdateOrderMenusDto)
    orderMenus?: OrderMenu[];
    // orderMenus?: string;
}