import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFiles,
  Res,
  BadRequestException,
  InternalServerErrorException,
  Req,
  Logger,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { UploadService, UploadImageInfo } from './upload.service';
import { AccessService } from 'src/access';
import { imageFileFilter } from 'src/utils/file-upload.utils';

@Controller('upload')
export class UploadController {
  constructor(
    private readonly uploadService: UploadService,
    private readonly access: AccessService,
  ) {}

  private readonly logger = new Logger('UploadController');

  @Post('image')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: null,
      limits: {
        fileSize: 10 * 1024 * 1024,
      },
      fileFilter: imageFileFilter,
    }),
  )
  async uploadSingleImage(
    @Req() req: any,
    @UploadedFile() file: Express.Multer.File,
    @Res() res: Response,
  ) {
    await this.access.assertCanUpload(req.user, req);
    if (!file) {
      throw new BadRequestException('ไม่พบรูปภาพที่ต้องการอัพโหลด');
    }

    try {
      const uploadedInfo: UploadImageInfo =
        await this.uploadService.saveImage(file);
      res.status(200).json(uploadedInfo);
    } catch (error) {
      this.logger.error(
        `Error during single image upload: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(`อัพโหลดรูปล้มเหลว`);
    }
  }

  @Post('images')
  @UseInterceptors(
    FilesInterceptor('images', 50, {
      storage: null,
      limits: {
        fileSize: 10 * 1024 * 1024,
      },
      fileFilter: imageFileFilter,
    }),
  )
  async uploadBulkImages(
    @Req() req: any,
    @UploadedFiles() files: Express.Multer.File[],
    @Res() res: Response,
  ) {
    await this.access.assertCanUpload(req.user, req);
    if (!files || files.length === 0) {
      throw new BadRequestException('ไม่พบรูปภาพที่ต้องการอัพโหลด');
    }

    try {
      const uploadedInfos: UploadImageInfo[] =
        await this.uploadService.saveBulkImages(files);
      res.status(200).json(uploadedInfos);
    } catch (error) {
      this.logger.error(
        `Error during bulk image upload: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(`อัพโหลดรูปล้มเหลว`);
    }
  }
}
