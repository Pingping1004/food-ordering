import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { InviteCodeType } from '@prisma/client';

export const SCHOOL_CREATABLE_TYPES = [
  InviteCodeType.SHOP_OWNER,
  InviteCodeType.SCHOOL_ADMIN,
] as const;

export class CreateSchoolCodeDto {
  @IsEnum(SCHOOL_CREATABLE_TYPES)
  type: 'SHOP_OWNER' | 'SCHOOL_ADMIN';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  maxUses?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0) // 0 = never expires
  @Max(365)
  expiresInDays?: number;
}

export class CreateStaffCodeDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0) // 0 = never expires
  @Max(365)
  expiresInDays?: number;
}

export class ListCodesQueryDto {
  @IsOptional()
  @IsEnum([
    InviteCodeType.SHOP_OWNER,
    InviteCodeType.SHOP_STAFF,
    InviteCodeType.SCHOOL_ADMIN,
  ])
  type?: 'SHOP_OWNER' | 'SCHOOL_ADMIN' | 'SHOP_STAFF';
}
