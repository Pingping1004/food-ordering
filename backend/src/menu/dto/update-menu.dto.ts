import {
  IsOptional,
  IsNumber,
  IsString,
  IsPositive,
  IsBoolean,
  IsNotEmpty,
  IsUUID,
  Matches,
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
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message: 'price must be a valid number with up to 2 decimal places'
  })
  price?: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true )
  @IsBoolean()
  isAvailable?: boolean;
}
