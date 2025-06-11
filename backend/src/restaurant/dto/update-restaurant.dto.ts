import { IsString, IsOptional, IsArray, IsEnum } from 'class-validator';
import { RestaurantCategory } from '../enums/restaurant-category';

export class updateRestaurantDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  password?: string;

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
