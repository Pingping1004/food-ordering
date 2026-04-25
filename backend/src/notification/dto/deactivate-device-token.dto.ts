import { IsString, MaxLength } from 'class-validator';

export class DeactivateDeviceTokenDto {
  @IsString()
  @MaxLength(4096)
  token: string;
}
