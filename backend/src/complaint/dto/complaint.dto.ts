import { ComplaintStatus, ComplaintTarget } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateComplaintDto {
  @IsEnum(ComplaintTarget)
  target: ComplaintTarget;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  message: string;
}

export class ListComplaintsQueryDto {
  @IsOptional()
  @IsEnum(ComplaintStatus)
  status?: ComplaintStatus;
}
