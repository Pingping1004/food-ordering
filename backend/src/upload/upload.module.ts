// src/upload/upload.module.ts
import { Module } from '@nestjs/common';
import { UploadService } from './upload.service';
import { UploadController } from './upload.controller';
import { S3Module } from 'src/s3/s3.module';

@Module({
  imports: [S3Module],
  providers: [UploadService],
  controllers: [UploadController],
  exports: [UploadService],
})
export class UploadModule {}
