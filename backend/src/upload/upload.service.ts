import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { S3Service } from '../s3/s3.service';

export interface UploadImageInfo {
    originalName: string;
    key: string;
    url: string;
}

@Injectable()
export class UploadService {
    private readonly logger = new Logger('UploadService');

    constructor(private readonly s3Service: S3Service) { }

    async saveImage(file: Express.Multer.File): Promise<UploadImageInfo> {
        try {
            const { fileName, url } = await this.s3Service.uploadFile(file);
            const uploadedInfo = {
                originalName: file.originalname,
                key: fileName,
                url: url,
            };

            return uploadedInfo;
        } catch (error) {
            this.logger.error(`Error uploading image ${file.originalname}: ${error.message}`, error.stack);
            throw new InternalServerErrorException(`Failed to upload image ${file.originalname}`);
        }
    }

    async saveBulkImages(files: Express.Multer.File[]): Promise<UploadImageInfo[]> {
        const uplaodPromises = files.map((file) => this.saveImage(file));

        try {
            return await Promise.all(uplaodPromises);
        } catch (error) {
            this.logger.error(`Failed to upload bulk images`);
            throw error;
        }
    }

    async saveOptionalBulkImages(files?: Express.Multer.File[]): Promise<UploadImageInfo[]> {
        if (!files || files.length === 0) {
            this.logger.log('No files provided for otional bulk upload');
            return [];
        }

        const uploadImagesUrl = files?.map(async (file) => {
            const { fileName, url } = await this.s3Service.uploadFile(file);

            return {
                originalName: file.originalname,
                key: fileName,
                url,
            } as UploadImageInfo;
        });

        try {
            const results = await Promise.all(uploadImagesUrl);
            return results;
        } catch (error) {
            this.logger.log(`Failed to save optional bulk images: ${error}`);
            throw new InternalServerErrorException('Failed to save optional bulk images');
        }
    }

    extractKeyFromUrl(url: string): string | null {
        if (!url) return null;

        try {
            const urlObj = new URL(url);

            // The pathname property gives you the path with a leading slash.
            // We remove the leading slash with substring(1).
            const key = urlObj.pathname.substring(1);
            return key || null;
        } catch (error) {
            this.logger.error(`Failed to parse URL to extract R2 key: ${url}`, error);
            return null;
        }
    }

    async cleanupImage(key: string): Promise<void> {
        try {
            await this.s3Service.deleteFile(key);
            this.logger.log(`Image with key ${key} successfully deleted from R2.`);
        } catch (error) {
            this.logger.error(
                `Error deleting image with key ${key} from R2: ${error.message}`,
                error.stack,
            );
            throw new InternalServerErrorException(`Failed to delete image with key ${key}.`);
        }
    }
}