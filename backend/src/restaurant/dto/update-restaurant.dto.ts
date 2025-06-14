import { IsString, IsOptional, IsArray, IsEnum } from 'class-validator';
import { RestaurantCategory } from '@prisma/client';

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
}
