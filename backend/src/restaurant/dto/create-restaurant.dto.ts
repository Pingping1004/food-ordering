import { IsNotEmpty, IsString, IsEnum, IsArray, IsOptional, IsEmail, IsNumber, IsDate } from "class-validator";
import { DateWeek, RestaurantCategory } from "@prisma/client";
import { Type, Transform } from "class-transformer";

export class CreateRestaurantDto {
    @IsNotEmpty()
    @IsString()
    name: string;

    @IsOptional()
    @IsString()
    restaurantImg?: string;

    @IsNotEmpty()
    @IsEmail()
    email: string;

    @Transform(({ value }) => {
        if (value === null || value === undefined || Array.isArray(value)) {
            return value;
        } 
        return [value];
    })
    @IsArray()
    @IsEnum(RestaurantCategory, { each: true })
    @IsNotEmpty()
    categories: RestaurantCategory[];

    @Transform(({ value }) => {
        if (value === null || value === undefined || Array.isArray(value)) {
            return value;
        }
        return [value];
    })
    @IsArray()
    @IsEnum(DateWeek, { each: true })
    @IsNotEmpty()
    openDate: DateWeek[];

    @IsNotEmpty()
    @IsDate()
    openTime: Date;

    @IsNotEmpty()
    @IsDate()
    closeTime: Date;

    @IsNumber()
    @Type(() => Number)
    @IsNotEmpty()
    avgCookingTime: number;

    @IsNotEmpty()
    @IsString()
    adminName: string;

    @IsNotEmpty()
    @IsString()
    adminSurname: string;

    @IsNotEmpty()
    @IsString()
    adminTel: string;

    @IsNotEmpty()
    @IsString()
    adminEmail: string;
}