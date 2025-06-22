import { PartialType } from '@nestjs/swagger';
import { CreatePayoutDto } from './create-payout.dto';
import { IsOptional, IsDate, IsNumber, IsNotEmpty, IsUUID } from 'class-validator';

export class UpdatePayoutDto extends PartialType(CreatePayoutDto) {
        @IsNumber()
        @IsOptional()
        restaurantRevenue?: number;
    
        @IsNumber()
        @IsOptional()
        platformFee?: number;
    
        @IsDate()
        @IsOptional()
        paidAt: string;
        
        @IsDate()
        @IsOptional()
        startDate?: Date;
        
        @IsDate()
        @IsOptional()
        endDate?: Date;
    
        @IsUUID()
        @IsNotEmpty()
        orderId: string;
    
        @IsUUID()
        @IsNotEmpty()
        restaurantId: string;
}
