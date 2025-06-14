import { IsBoolean, IsDate, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator'
import { Type, Expose } from 'class-transformer';

export class CreateMenuDto {
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsOptional()
    @IsString()
    menuImg?: string;

    @IsOptional()
    @IsString()
    role?: string;

    @IsString()
    @IsNotEmpty()
    restaurantId: string;

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
    @IsNumber({}, { message: 'Price must be a number' })
    @IsPositive()
    @Type(() => Number)
    price: number;

    @IsBoolean()
    @IsOptional()
    @Type(() => Boolean)
    isAvailable?: boolean;
}
