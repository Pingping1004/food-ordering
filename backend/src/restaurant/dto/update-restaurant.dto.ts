import {
  IsString,
  IsOptional,
  IsArray,
  IsEnum,
  IsBoolean,
  IsEmail,
  IsInt,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { RestaurantCategory } from '@prisma/client';
import { AccountType } from 'src/common/interface/accountType';

export enum Role {
  admin = 'admin',
  cooker = 'cooker',
  user = 'user',
}

export class UpdateRestaurantDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  restaurantImg?: string;

  @IsOptional()
  @IsString()
  password?: string;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @IsBoolean()
  @IsOptional()
  isTemporarilyClosed?: boolean;

  @IsBoolean()
  @IsOptional()
  isAutoAcceptedOrder?: boolean;

  @IsOptional()
  @IsEnum(RestaurantCategory, { each: true })
  @IsArray()
  categories?: RestaurantCategory[];

  @IsOptional()
  @IsString()
  openTime?: string;

  @IsOptional()
  @IsString()
  closeTime?: string;

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
  @IsEnum(AccountType)
  bankAccount?: AccountType;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  accountName?: string;

  @IsOptional()
  @Matches(/^[\d-]{6,}$/, { message: 'accountNumber must be digits' })
  accountNumber?: string;

  /** Orders the kitchen accepts at once. `null` clears the limit ("ไม่จำกัด"). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  maxActiveOrders?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(60)
  avgCookingTimeMins?: number;
}
