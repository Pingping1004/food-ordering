import {
  IsNotEmpty,
  IsString,
  IsEnum,
  IsArray,
  IsOptional,
  IsEmail,
  IsNumber,
  IsInt,
  Min,
  Max,
  IsDate,
} from 'class-validator';
import { DayOfWeek, RestaurantCategory } from '@prisma/client';
import { AccountType } from 'src/common/interface/accountType';
import { Type, Transform } from 'class-transformer';

export class CreateRestaurantDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  profile?: string;

  @IsOptional()
  @IsString()
  restaurantImg?: string;

  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  canteenId?: string;

  @IsOptional()
  @IsString()
  location?: string;

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
  @IsOptional()
  openDate?: string[];

  @IsOptional()
  openTime?: Date | string;

  @IsOptional()
  closeTime?: Date | string;

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  avgCookingTime?: number;

  @IsInt()
  @Min(1)
  @Max(120)
  @Type(() => Number)
  @IsOptional()
  avgCookingTimeMins?: number;

  @IsInt()
  @Min(1)
  @Max(50)
  @Type(() => Number)
  @IsOptional()
  maxActiveOrders?: number;

  @IsOptional()
  @IsString()
  contactName?: string;

  @IsOptional()
  @IsString()
  contactSurname?: string;

  @IsOptional()
  @IsString()
  contactTel?: string;

  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @IsOptional()
  @IsString()
  adminName?: string;

  @IsOptional()
  @IsString()
  adminSurname?: string;

  @IsOptional()
  @IsString()
  adminTel?: string;

  @IsOptional()
  @IsString()
  adminEmail?: string;

  @IsOptional()
  @IsString()
  accountNumber?: string;

  @IsOptional()
  @IsEnum(AccountType)
  bankAccount?: AccountType;

  @IsOptional()
  @IsString()
  paymentQr?: string;

  @IsOptional()
  @IsString()
  accountName?: string;

  @IsOptional()
  @IsString()
  accountHolderFullName?: string;
}
