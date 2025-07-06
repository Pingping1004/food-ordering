import { Module } from '@nestjs/common';
import { CsrfController } from './csrf.controller';
import { CsrfTokenService } from './csrf.service';

@Module({
  controllers: [CsrfController],
  providers: [CsrfTokenService], 
  exports: [CsrfTokenService],
})
export class CsrfModule {}