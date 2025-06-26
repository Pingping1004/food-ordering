import { Role } from "@prisma/client";
import { IsEnum, IsNotEmpty, IsString } from "class-validator";

export class CreateUserDto {
    @IsString()
    @IsNotEmpty()
    email: string;

    @IsString()
    @IsNotEmpty()
    password: string;

    @IsEnum(Role)
    @IsNotEmpty()
    role: Role;
}