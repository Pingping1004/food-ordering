import { IsBoolean, IsDate, IsNotEmpty, IsNumber, IsOptional } from 'class-validator'

export class CreateMenuDto {
    @IsNotEmpty()
    name: string;

    @IsOptional()
    menuImg?: string;

    @IsNotEmpty()
    restaurantName: string;

    @IsNotEmpty()
    @IsNumber()
    maxDaily: number;

    @IsNotEmpty()
    @IsNumber()
    cookingTime: number;

    @IsNotEmpty()
    @IsDate()
    createdAt: Date | string;

    @IsNotEmpty()
    @IsNumber()
    price: number;

    @IsBoolean()
    isAvailable: boolean;
}
