import { Transform, Type } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { MembershipStatus, Status } from '@prisma/client';

export class InviteCodeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  code: string;
}

export class CreateSchoolDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  studentAmount?: number;

  @IsOptional()
  @IsString()
  profile?: string;
}

export class UpdateSchoolDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  profile?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  studentAmount?: number;
}

export class ListSchoolsQueryDto {
  @IsOptional()
  @IsEnum(Status)
  status?: Status;
}

export class CreateCanteenDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  profile?: string;

  @IsOptional()
  @IsEnum(Status)
  status?: Status;

  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }
    return value;
  })
  hours?: any[];
}

export class UpdateCanteenDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  profile?: string;

  @IsOptional()
  @IsEnum([Status.ACTIVE, Status.INACTIVE])
  status?: 'ACTIVE' | 'INACTIVE';

  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }
    return value;
  })
  hours?: any[];
}

export class RestaurantStatusDto {
  @IsEnum([Status.ACTIVE, Status.REMOVED, Status.SUSPENDED])
  status: 'ACTIVE' | 'REMOVED' | 'SUSPENDED';
}

export class MoveRestaurantCanteenDto {
  @IsString()
  @IsNotEmpty()
  canteenId: string;
}

export class StatusQueryDto {
  @IsOptional()
  @IsEnum(Status)
  status?: Status;
}

export class MembershipQueryDto {
  @IsOptional()
  @IsEnum(MembershipStatus)
  status?: MembershipStatus;
}

export class SchoolStatusDto {
  @IsIn([Status.ACTIVE, Status.SUSPENDED])
  status: 'ACTIVE' | 'SUSPENDED';

  @IsString()
  @MinLength(5, { message: 'กรุณาระบุเหตุผลอย่างน้อย 5 ตัวอักษร' })
  @MaxLength(500)
  reason: string;
}

export class AuditLogQueryDto {
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @IsOptional()
  @IsIn(['sysadmin'])
  actor?: 'sysadmin';
}
