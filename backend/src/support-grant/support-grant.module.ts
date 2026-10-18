import { Module } from '@nestjs/common';
import { SupportGrantController } from './support-grant.controller';
import { SupportGrantService } from './support-grant.service';

@Module({
  controllers: [SupportGrantController],
  providers: [SupportGrantService],
  exports: [SupportGrantService],
})
export class SupportGrantModule {}
