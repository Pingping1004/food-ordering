import { IsNotEmpty, IsString, IsEnum, IsArray, IsOptional } from "class-validator";
import { Prisma, RestaurantCategory } from "@prisma/client";
import { Role } from "./update-restaurant.dto";

export class CreateRestaurantDto {
    @IsNotEmpty()
    @IsString()
    name: string;

    @IsNotEmpty()
    @IsString()
    email: string;

    @IsOptional()
    @IsString()
    restaurantImg?: string;

    @IsNotEmpty()
    @IsString()
    password: string;

    @IsArray()
    @IsEnum(RestaurantCategory, { each: true })
    @IsNotEmpty()
    categories: RestaurantCategory[];

    @IsNotEmpty()
    @IsString()
    openTime: string;

    @IsNotEmpty()
    @IsString()
    closeTime: string;

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