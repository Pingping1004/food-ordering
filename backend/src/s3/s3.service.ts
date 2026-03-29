import { Injectable, InternalServerErrorException, Logger } from "@nestjs/common";
import { S3Client, PutObjectCommand, PutObjectCommandInput, DeleteObjectCommandInput, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from 'uuid';
import { extname } from "path";
import sharp from "sharp";

@Injectable()
export class S3Service {
    private readonly s3Client: S3Client;
    private readonly s3BucketName: string;
    private readonly s3CustomDomain: string;
    private readonly logger = new Logger('S3Service');

    constructor() {
        const endpointUrl = process.env.S3_ENDPOINT_URL;
        const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
        const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

        if (!endpointUrl || !accessKeyId || !secretAccessKey) {
            throw new InternalServerErrorException('S3 client configuration is missing. Please check environment variables.');
        }

        this.s3BucketName = process.env.S3_BUCKET_NAME || '';
        this.s3CustomDomain = process.env.S3_CUSTOM_DOMAIN || '';

        this.s3Client = new S3Client({
            region: 'auto',
            endpoint: endpointUrl,
            credentials: {
                accessKeyId: accessKeyId,
                secretAccessKey: secretAccessKey,
            },
        });
    }

    async uploadFile(file: Express.Multer.File): Promise<{ fileName: string; url: string }> {
        const isImage = file.mimetype.startsWith('image/');

        let uploadBuffer: Buffer;
        let contentType: string;
        let uniqueFilename: string;

        if (isImage) {
            uploadBuffer = await sharp(file.buffer)
                .resize(500, 500, {
                    fit: 'inside',
                    withoutEnlargement: true,
                })
                .webp({ quality: 50 })
                .toBuffer();
            contentType = 'image/webp';
            uniqueFilename = `${uuidv4()}.webp`; // always .webp for images
        } else {
            uploadBuffer = file.buffer;
            contentType = file.mimetype;
            uniqueFilename = `${uuidv4()}${extname(file.originalname)}`;
        }

        const uploadParams: PutObjectCommandInput = {
            Bucket: process.env.S3_BUCKET_NAME,
            Key: uniqueFilename,
            Body: uploadBuffer,
            ContentType: contentType,
            ACL: 'public-read',
        };

        try {
            const command = new PutObjectCommand(uploadParams);
            await this.s3Client.send(command);
            const url = `${this.s3CustomDomain}/${uniqueFilename}`;

            return { fileName: uniqueFilename, url: url };
        } catch (error) {
            this.logger.log(`Error uploading file to R2: ${error}`);
            throw new InternalServerErrorException('อัพโหลดไฟล์ล้มเหลว');
        }
    }

    async deleteFile(fileName: string): Promise<void> {
        const deleteParams: DeleteObjectCommandInput = {
            Bucket: this.s3BucketName,
            Key: fileName,
        };

        try {
            const command = new DeleteObjectCommand(deleteParams);
            await this.s3Client.send(command);
        } catch (error) {
            this.logger.log(`Error deleting file ${fileName} from R2: ${error}`);
            throw new InternalServerErrorException(`ลบไฟล์ ${fileName} ล้มเหลว`);
        }
    }
}