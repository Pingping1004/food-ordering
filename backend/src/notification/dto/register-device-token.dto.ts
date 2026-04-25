import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RegisterDeviceTokenDto {
  @IsString()
  @MaxLength(4096)
  token: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  platform?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1024)
  userAgent?: string;
}
