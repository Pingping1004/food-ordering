import {
  IsOptional,
  IsNumber,
  IsString,
  IsPositive,
  IsBoolean,
  IsNotEmpty,
  IsUUID,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class UpdateMenuDto {
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  restaurantId: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsOptional()
  @IsString()
  menuImg?: string;

  @IsOptional()
  @IsString()
  role?: string;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  maxDaily?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  cookingTime?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Type(() => Number)
  price?: number;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true )
  @IsBoolean()
  isAvailable?: boolean;
}
