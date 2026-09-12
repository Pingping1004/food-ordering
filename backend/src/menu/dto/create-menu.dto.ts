import { IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator'
import { Type } from 'class-transformer';

export class CreateMenuDto {
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsOptional()
    @IsString()
    menuImg?: string;

    @IsNotEmpty()
    @IsNumber({}, { message: 'Price must be a number' })
    @IsPositive()
    @Type(() => Number)
    price: number;

    @IsNotEmpty()
    @IsPositive()
    @IsNumber()
    @Type(() => Number)
    maxDaily: number;

    @IsNotEmpty()
    @IsNumber()
    @IsPositive()
    @Type(() => Number)
    cookingTimeMins: number;

    @IsBoolean()
    @IsOptional()
    @Type(() => Boolean)
    isAvailable?: boolean;

    @IsString()
    @IsNotEmpty()
    restaurantId: string;
}
