import { PartialType } from '@nestjs/mapped-types';
import { CreateMenuDto } from './create-menu.dto';
import { IsOptional, IsNumber, IsString, IsPositive, IsDate, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateMenuDto extends PartialType(CreateMenuDto) {
        @IsString()
        @IsOptional()
        name?: string;

        @IsOptional()
        @IsString()
        menuImg?: string;

        @IsOptional()
        @IsString()
        role?: string;

        @IsString()
        @IsOptional()
        restaurantName?: string;

        @IsOptional()
        @IsNumber()
        @IsPositive()
        @Type(() => Number)
        maxDaily?: number;

        @IsOptional()
        @IsNumber()
        @IsPositive()
        @Type(() => Number)
        cookingTime?: number;

        @IsOptional()
        @IsDate()
        createdAt?: string;

        @IsOptional()
        @IsNumber()
        @IsPositive()
        @Type(() => Number)
        price?: number;

        @IsBoolean()
        isAvailable?: boolean;
}
