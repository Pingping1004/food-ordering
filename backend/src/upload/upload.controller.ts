import {
    Controller,
    Post,
    UseInterceptors,
    UploadedFiles,
    Res,
    BadRequestException,
    InternalServerErrorException,
    UseGuards,
    Logger,
    UploadedFile,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { UploadService, UploadImageInfo } from './upload.service';
import { JwtAuthGuard } from 'src/guards/jwt-auth.guard';
import { RolesGuard } from 'src/guards/roles.guard';
import { Roles } from 'src/decorators/role.decorator';
import { Role } from '@prisma/client';
import { imageFileFilter } from 'src/utils/file-upload.utils';

@Controller('upload')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles([Role.admin, Role.cooker])
export class UploadController {
    constructor(private readonly uploadService: UploadService) { }

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
        @UploadedFile() file: Express.Multer.File,
        @Res() res: Response,
    ) {
        if (!file) {
            throw new BadRequestException('No image file provided for upload.');
        }

        try {
            const uploadedInfo: UploadImageInfo = await this.uploadService.saveImage(file);
            res.status(200).json(uploadedInfo);
        } catch (error) {
            this.logger.error(
                `Error during single image upload: ${error.message}`,
                error.stack,
            );
            throw new InternalServerErrorException(`Failed to upload image.`);
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
        @UploadedFiles() files: Express.Multer.File[],
        @Res() res: Response,
    ) {
        if (!files || files.length === 0) {
            throw new BadRequestException('No image files provided for upload.');
        }

        try {
            const uploadedInfos: UploadImageInfo[] = await this.uploadService.saveBulkImages(files);
            res.status(200).json(uploadedInfos);
        } catch (error) {
            this.logger.error(
                `Error during bulk image upload: ${error.message}`,
                error.stack,
            );
            throw new InternalServerErrorException(`Failed to upload images.`);
        }
    }
}
