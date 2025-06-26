import { IsOptional, IsString, IsEmail, IsEnum } from 'class-validator'
import { Role, RoleRequestStatus } from '@prisma/client';

export class UpdateAdminDto {
    @IsOptional()
    @IsString()
    name?: string;

    @IsOptional()
    @IsEmail()
    email?: string;

    @IsOptional()
    @IsEnum(Role)
    role?: Role;

    @IsOptional()
    @IsEnum(RoleRequestStatus)
    status: RoleRequestStatus;
}
