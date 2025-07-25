import { PaymentMethodType } from "@prisma/client";
import { Type } from "class-transformer";
import { IsNotEmpty, IsNumber, IsOptional, Min, IsString, IsEnum } from "class-validator";

export class CreatePaymentDto {
    @IsNotEmpty()
    @IsNumber()
    @Min(1)
    @Type(() => Number)
    amount: number;

    @IsNotEmpty()
    @IsString()
    orderId: string;

    @IsOptional()
    @IsString()
    currency?: string;

    @IsNotEmpty()
    @IsEnum(PaymentMethodType)
    paymentMethod: string;

    @IsOptional()
    @IsString()
    platformType: string;

    @IsString()
    @IsNotEmpty()
    qrDownloadUri: string;
}
