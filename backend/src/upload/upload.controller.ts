import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFiles,
  Res,
  BadRequestException,
  InternalServerErrorException,
  UseGuards
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { UploadService, UploadImageInfo } from './upload.service';
import { JwtAuthGuard } from 'src/guards/jwt-auth.guard';
import { RolesGuard } from 'src/guards/roles.guard';
import { Roles } from 'src/decorators/role.decorator';
import { Role } from '@prisma/client';

@Controller('upload')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles([Role.admin, Role.cooker])
export class UploadController {
    constructor(
        private readonly uploadService: UploadService
    ) {}

    @Post('temp-images')
    @UseInterceptors(
        FilesInterceptor('images', 50, {
            storage: null,
            limits: {
                fileSize: 10 * 1024 * 1024,
            },
            fileFilter: (req, file, cb) => {
                if (!RegExp(/\.(jpg|jpeg|png)$/i).test(file.originalname)) {
                    return cb(new BadRequestException('Only image with JPG JPEG and PNG is allowed'), false)
                }
                cb(null, true);
            },
        }),
    )
    async uploadTempImages(
        @UploadedFiles() files: Express.Multer.File[],
        @Res() res: Response,
    ) {
        if (!files || files.length === 0) {
            throw new BadRequestException('No image files provided for upload');
        }

        console.log(`Received ${files.length} images for temporary upload`);

        try {
            const uploadedInfos: UploadImageInfo[] = await this.uploadService.saveTempImages(files);
            res.status(200).json(uploadedInfos);
        } catch (error) {
            console.error(`Error during temporary image uplaod: ${error.message}`, error.stack);
            if (error instanceof BadRequestException) {
                throw error;
            }
            throw new InternalServerErrorException(`Failed to upload images to temporary storage`)
        }
    }
}