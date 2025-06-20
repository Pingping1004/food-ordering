import { Type } from "class-transformer";
import { IsNotEmpty, IsNumber, IsOptional, Min, IsString } from "class-validator";

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
    @IsString()
    bankType: string;

    @IsOptional()
    @IsString()
    platformType: string;
}
