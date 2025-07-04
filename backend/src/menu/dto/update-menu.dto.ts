import { PartialType } from '@nestjs/mapped-types';
import { CreateMenuDto } from './create-menu.dto';
import { IsOptional, IsNumber, IsString, IsPositive, IsDate, IsBoolean, IsNotEmpty, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateMenuDto extends PartialType(CreateMenuDto) {
        @IsString()
        @IsNotEmpty()
        @IsUUID()
        restaurantId: string;

        @IsString()
        @IsOptional()
        name?: string;

        @IsOptional()
        @IsString()
        menuImg?: string;

        @IsOptional()
        @IsString()
        role?: string;

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
        @IsNumber({ maxDecimalPlaces: 2 })
        @IsPositive()
        @Type(() => Number)
        price?: number;

        @IsBoolean()
        isAvailable?: boolean;
}
