import { IsBoolean, IsDate, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator'
import { Type } from 'class-transformer';

export class CreateMenuDto {
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsOptional()
    menuImg?: string;

    @IsString()
    @IsNotEmpty()
    restaurantName: string;

    @IsNotEmpty()
    @IsPositive()
    @IsNumber()
    @Type(() => Number)
    maxDaily: number;

    @IsNotEmpty()
    @IsNumber()
    @IsPositive()
    @Type(() => Number)
    cookingTime: number;

    @IsNotEmpty()
    @IsDate()
    createdAt: string;

    @IsNotEmpty()
    @IsNumber()
    @IsPositive()
    @Type(() => Number)
    price: number;

    @IsBoolean()
    isAvailable: boolean;
}
