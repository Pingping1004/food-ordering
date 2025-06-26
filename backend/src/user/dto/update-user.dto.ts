import { PartialType } from '@nestjs/swagger';
import { CreateUserDto } from './create-user.dto';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { Role } from '@prisma/client';

export class UpdateUserDto extends PartialType(CreateUserDto) {
    @IsString()
    @IsOptional()
    profileImg?: string;

    @IsString()
    @IsOptional()
    name?: string;

    @IsEnum(Role)
    @IsOptional()
    role?: Role;
}
