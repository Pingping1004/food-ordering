import {
  IsBoolean,
  IsArray,
  ValidateNested,
  IsNotEmpty,
  Min,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CsvMenuItemData {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxDaily?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  cookingTime?: number;

  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;

  @IsNotEmpty()
  @IsString()
  menuImgTempId: string;

  @IsOptional()
  @IsString()
  originalFileName?: string;

  // @IsOptional()
  // @IsString()
  // description?: string;
}

export class CreateMenuDto {
  @IsString()
  @IsNotEmpty()
  restaurantId: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsNotEmpty()
  @IsString()
  menuImg: string;

  @IsNotEmpty()
  @IsPositive()
  @IsNumber()
  @Type(() => Number)
  maxDaily: number;

  @IsNotEmpty()
  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  cookingTime: number;

  @IsNotEmpty()
  @IsNumber({}, { message: 'Price must be a number' })
  @IsPositive()
  @Type(() => Number)
  price: number;

  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  isAvailable?: boolean;
}

export class CreateBulkMenusJsonPayload {
  @IsString()
  @IsNotEmpty()
  restaurantId: string;

  @IsArray()
  @IsNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => CsvMenuItemData)
  createMenuDto: CsvMenuItemData[];
}
