import { BadRequestException, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { S3Service } from '../s3/s3.service';
import sharp from "sharp";

export interface UploadImageInfo {
    originalName: string;
    key: string;
    url: string;
}

@Injectable()
export class UploadService {
    private readonly logger = new Logger('UploadService');

    constructor(private readonly s3Service: S3Service) { }

    private async fixOrientation(file: Express.Multer.File): Promise<Express.Multer.File> {
        const correctedBuffer = await sharp(file.buffer).rotate().toBuffer();
        return { ...file, buffer: correctedBuffer };
    }

    async saveImage(file: Express.Multer.File): Promise<UploadImageInfo> {
        try {
            const correctedFile = await this.fixOrientation(file);
            const { fileName, url } = await this.s3Service.uploadFile(correctedFile);
            const uploadedInfo = {
                originalName: file.originalname,
                key: fileName,
                url: url,
            };

            return uploadedInfo;
        } catch (error) {
            this.logger.error(`Error uploading image ${file.originalname}: ${error.message}`, error.stack);
            throw new InternalServerErrorException(`อัพโหลดรูป ${file.originalname}ล้มเหลว`);
        }
    }

    async saveBulkImages(files: Express.Multer.File[]): Promise<UploadImageInfo[]> {
        const uplaodPromises = files.map((file) => this.saveImage(file));

        try {
            return await Promise.all(uplaodPromises);
        } catch (error) {
            this.logger.error(`อัพโหลดหลายรูปล้มเหลว`);
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
            throw new InternalServerErrorException('อัพโหลดหลายรูปล้มเหลว');
        }
    }

    private detectImageType(buffer: Buffer): string | null {
        if (buffer.slice(0, 3).toString("hex") === "ffd8ff") return "jpeg";
        if (buffer.slice(0, 8).toString("hex") === "89504e470d0a1a0a") return "png";
        if (buffer.slice(0, 4).toString() === "RIFF") return "webp";
    
        return null;
    }

    async uploadBase64(base64: string, fileNamePrefix = "slip") {
        const { buffer, mime } = this.parseBase64Image(base64);
    
        const fileType = this.detectImageType(buffer);
        if (!fileType) {
            throw new BadRequestException("Invalid image format");
        }
    
        const file: Express.Multer.File = {
            fieldname: "file",
            originalname: `${fileNamePrefix}.${fileType}`,
            encoding: "7bit",
            mimetype: mime,
            size: buffer.length,
            buffer,
            stream: null as any,
            destination: "",
            filename: "",
            path: "",
        };
    
        return this.saveImage(file);
    }

    parseBase64Image(base64: string): { buffer: Buffer; mime: string; dataUrl: string } {
    let mime = "image/jpeg";
    let pureBase64 = base64;

    // If Data URL format
    if (base64.startsWith("data:")) {
        const matches = base64.match(/^data:(image\/\w+);base64,(.+)$/);
        if (!matches) {
            throw new BadRequestException("Invalid base64 format");
        }

        mime = matches[1];
        pureBase64 = matches[2];
    }

    const buffer = Buffer.from(pureBase64, "base64");

    return {
        buffer,
        mime,
        dataUrl: `data:${mime};base64,${pureBase64}`,
    };
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
            throw new InternalServerErrorException(`ลบรูปล้มเหลว`);
        }
    }
}