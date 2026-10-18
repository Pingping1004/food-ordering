import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsBoolean,
  IsArray,
  IsInt,
  ValidateNested,
  IsNotEmpty,
  Max,
  MaxLength,
  Min,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

/** Form-data and JSON both send booleans; `@Type(() => Boolean)` turns the string 'false' into true. */
const toBoolean = ({ value }: { value: unknown }) =>
  value === 'false' ? false : value === 'true' ? true : value;

const trimString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/** Hard cap for one bulk request, keeps a single call from creating hundreds of rows. */
export const MAX_BULK_MENUS = 100;

export class CsvMenuItemData {
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  /** Whole baht, same rule as Menu.price (Int) in schema.prisma. */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  price: number;

  /** Optional: the database default (30) applies when omitted. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxDaily?: number;

  /** @deprecated send `cookingTimeMins`. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  cookingTime?: number;

  /** Optional: the database default (5) applies when omitted. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  cookingTimeMins?: number;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  isAvailable?: boolean;

  /** Photos are optional; they can be attached later with PATCH /menu/single/:menuId. */
  @IsOptional()
  @IsString()
  menuImgTempId?: string;

  @IsOptional()
  @IsString()
  originalFileName?: string;
}

export class CreateMenuDto {
  @IsString()
  @IsNotEmpty()
  restaurantId: string;

  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsNotEmpty()
  @IsInt({ message: 'Price must be a whole number of baht' })
  @IsPositive()
  @Type(() => Number)
  price: number;

  @IsOptional()
  @IsPositive()
  @IsNumber()
  @Type(() => Number)
  maxDaily?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  cookingTime?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  cookingTimeMins?: number;

  @IsBoolean()
  @IsOptional()
  @Transform(toBoolean)
  isAvailable?: boolean;
}

export class CreateBulkMenusJsonPayload {
  @IsString()
  @IsNotEmpty()
  restaurantId: string;

  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(MAX_BULK_MENUS)
  @ValidateNested({ each: true })
  @Type(() => CsvMenuItemData)
  createMenuDto: CsvMenuItemData[];
}
