import { IsBoolean, IsDate, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator'
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
    @IsNumber()
    @Type(() => Number)
    maxDaily: number;

    @IsNotEmpty()
    @IsNumber()
    @Type(() => Number)
    cookingTime: number;

    @IsNotEmpty()
    @IsDate()
    createdAt: string;

    @IsNotEmpty()
    @IsNumber()
    @Type(() => Number)
    price: number;

    @IsBoolean()
    isAvailable: boolean;
}
