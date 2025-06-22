import { IsDate, IsNotEmpty, IsNumber, IsOptional, IsUUID } from "class-validator";

export class CreatePayoutDto {
    @IsNumber()
    @IsNotEmpty()
    restaurantRevenue: number;

    @IsNumber()
    @IsNotEmpty()
    platformFee: number;

    @IsDate()
    @IsOptional()
    paidAt?: string;
    
    @IsDate()
    @IsNotEmpty()
    startDate: Date;
    
    @IsDate()
    @IsNotEmpty()
    endDate: Date;

    @IsUUID()
    @IsNotEmpty()
    orderId: string;

    @IsUUID()
    @IsNotEmpty()
    restaurantId: string;
}