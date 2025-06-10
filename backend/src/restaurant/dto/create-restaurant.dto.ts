import { IsNotEmpty, IsString, IsEnum, IsArray } from "class-validator";
import { RestaurantCategory } from "../enums/restaurant-category";


export class createRestaurantDto {
    @IsNotEmpty()
    @IsString()
    name: string;

    @IsNotEmpty()
    @IsString()
    email: string;

    @IsNotEmpty()
    @IsString()
    password: string;

    @IsNotEmpty()
    @IsEnum(RestaurantCategory, { each: true })
    @IsArray()
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