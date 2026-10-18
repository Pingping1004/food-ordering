import { IsEnum, IsOptional, IsString } from 'class-validator';
import { Role } from '@prisma/client';

/** Admin-only. Credentials (e-mail / password) are managed by Supabase Auth, not here. */
export class UpdateUserDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsEnum(Role)
  @IsOptional()
  role?: Role;
}
