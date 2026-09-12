import { IsNotEmpty, IsString, IsEnum, IsArray, IsOptional, IsEmail, IsNumber, IsBoolean } from "class-validator";
import { Prisma, RestaurantCategory, RestaurantOperatingHour, Status } from "@prisma/client";

export class CreateRestaurantDto {
    @IsNotEmpty()
    @IsString()
    name: string;

    @IsOptional()
    @IsString()
    profile?: string;

    @IsNotEmpty()
    @IsEmail()
    email: string;

    @IsOptional()
    @IsString()
    location?: string;

    @IsArray()
    @IsEnum(RestaurantCategory, { each: true })
    @IsNotEmpty()
    categories: RestaurantCategory[];

    @IsNumber()
    @IsOptional()
    maxActiveOrders?: number;

    @IsNumber()
    @IsOptional()
    avgCookingTimeMins?: number;

    @IsEnum(Status)
    @IsNotEmpty()
    status: Status

    @IsNotEmpty()
    @IsString()
    contactName: string;

    @IsNotEmpty()
    @IsString()
    contactTel: string;

    @IsNotEmpty()
    @IsEmail()
    contactEmail: string;

    @IsNotEmpty()
    @IsString()
    accountNumber: string;

    @IsNotEmpty()
    @IsString()
    accountName: string;

    @IsNotEmpty()
    @IsString()
    paymentQr: string;

    @IsNotEmpty()
    @IsString()
    canteenId: string;

    @IsArray()
    @IsNotEmpty()
    operatingHours: RestaurantOperatingHour[];
}