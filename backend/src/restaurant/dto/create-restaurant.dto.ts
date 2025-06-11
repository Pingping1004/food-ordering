import { IsNotEmpty, IsString, IsEnum, IsArray } from "class-validator";
import { Prisma, RestaurantCategory } from "@prisma/client";
import { Role } from "./update-restaurant.dto";

export class createRestaurantDto {
    @IsNotEmpty()
    @IsString()
    name: string;

    @IsNotEmpty()
    @IsString()
    email: string;

    @IsNotEmpty()
    @IsEnum(Role)
    role: Role;

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