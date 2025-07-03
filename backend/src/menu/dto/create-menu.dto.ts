import { IsBoolean, IsArray, ValidateNested, IsNotEmpty, Min, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator'
import { Type, Expose } from 'class-transformer';
// import { CsvMenuItemData } from '../menu.service';

export class CsvMenuItemData { // <-- Change 'interface' to 'class'
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsNumber()
  @Min(0) // Assuming price cannot be negative
  price: number;

  @IsOptional() // Make sure optional fields are explicitly marked as such
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

  @IsOptional()
  @IsString() // imageFileName is a string (the temp ID UUID.ext)
  imageFileName?: string;

  @IsOptional()
  @IsString()
  originalFileName?: string; // For backend reference

  @IsOptional()
  @IsString()
  description?: string;
}

export class CreateMenuDto {
    @IsString()
    @IsNotEmpty()
    restaurantId: string;

    @IsString()
    @IsNotEmpty()
    name: string;

    @IsOptional()
    @IsString()
    menuImg?: string;

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
  @Type(() => CsvMenuItemData) // Make sure CsvMenuItemData is correctly imported and defined
  createMenuDto: CsvMenuItemData[]; // <-- THIS IS THE KEY NAME FROM YOUR FRONTEND
}