import { IsString, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateSupportGrantDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(10, { message: 'กรุณาระบุเหตุผลอย่างน้อย 10 ตัวอักษร' })
  @MaxLength(500)
  reason: string;
}
