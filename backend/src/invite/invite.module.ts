import { Module } from '@nestjs/common';
import { InviteCodeService } from './invite-code.service';
import { MeCodesController } from './me-codes.controller';

@Module({
  controllers: [MeCodesController],
  providers: [InviteCodeService],
  exports: [InviteCodeService],
})
export class InviteModule {}
