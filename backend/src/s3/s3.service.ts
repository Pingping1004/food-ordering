import { Injectable, InternalServerErrorException, Logger } from "@nestjs/common";
import { S3Client, PutObjectCommand, PutObjectCommandInput, DeleteObjectCommandInput, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from 'uuid';
import { extname } from "path";

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

    async uploadFile(file: Express.Multer.File): Promise<{ fileName: string; url: string}> {
        const fileExtName = extname(file.originalname);
        const uniqueFilename = `${uuidv4()}${fileExtName}`;

        const uploadParams: PutObjectCommandInput = {
            Bucket: process.env.S3_BUCKET_NAME,
            Key: uniqueFilename,
            Body: file.buffer,
            ContentType: file.mimetype,
            ACL: 'public-read',
        };

        try {
            const command = new PutObjectCommand(uploadParams);
            await this.s3Client.send(command);
            const url = `${this.s3CustomDomain}/${uniqueFilename}`;

            return { fileName: uniqueFilename, url: url };
        } catch (error) {
            this.logger.log(`Error uploading file to R2: ${error}`);
            throw new InternalServerErrorException('Failed to upload file');
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
            throw new InternalServerErrorException(`Failed to delete file ${fileName}`);
        }
    }
}