import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';

const uploadDir = path.join(process.cwd(), 'uploads');
const tempDir = path.join(uploadDir, 'temp');
const permanentDir = path.join(uploadDir, 'menus');

(async () => {
    try {
        if (!fsSync.existsSync(tempDir)) {
            await fs.mkdir(tempDir, { recursive: true });
        }

        if (!fsSync.existsSync(permanentDir)) {
            await fs.mkdir(permanentDir, { recursive: true });
        }
    } catch (error) {
        console.error(`Failed to ensure upload directoires exist: ${error.message}`, error.stack);
    }
})();

export interface UploadImageInfo {
    originalName: string;
    tempId: string;
    tempUrl: string;
}

@Injectable()
export class UploadService {
    async saveTempImages(files: Express.Multer.File[]): Promise<UploadImageInfo[]> {
        const uploadedInfos: UploadImageInfo[] = [];

        for (const file of files) {
            console.log('--- Debugging file object ---');
            console.log('file.originalname:', file.originalname);
            console.log('file.mimetype:', file.mimetype);
            console.log('file.size:', file.size);
            console.log('typeof file.buffer:', typeof file.buffer);
            console.log('file.buffer content (first 20 bytes):', file.buffer ? file.buffer.slice(0, 20) : 'Buffer is undefined');
            // Log the entire file object for thorough inspection:
            console.log('Full file object:', file);
            console.log('--- End file object debug ---');

            const uniqueId = uuidv4();
            const fileExtension = path.extname(file.originalname).toLowerCase();
            const tempFileName = `${uniqueId}${fileExtension}`;
            const tempFilePath = path.join(tempDir, tempFileName);
            const tempFileUrl = `/temp/${tempFileName}`;

            try {
                await fs.writeFile(tempFilePath, file.buffer);
                console.log(`Save temp image: ${file.originalname} to ${tempFilePath}`);
                uploadedInfos.push({
                    originalName: file.originalname,
                    tempId: tempFileName,
                    tempUrl: tempFileUrl,
                });
            } catch (error) {
                console.error(`Error saving temporary image ${file.originalname}: ${error.message}`);
                throw new InternalServerErrorException(`Failed to save temporary image ${file.originalname}.`);
            }
        }
        return uploadedInfos;
    }

    async moveTempImageToPermanent(tempId: string): Promise<string> {
        const tempFilePath = path.join(tempDir, tempId);
        const fileExtension = path.extname(tempId).toLowerCase();
        const permanentFileName = `${uuidv4()}${fileExtension}}`;
        const permanentFilePath = path.join(permanentDir, permanentFileName);
        const permanentFileUrl = `uploads/menus/${permanentFileName}`;

        try {
            try {
                await fs.access(tempFilePath, fsSync.constants.F_OK); // Check if file exist
            } catch (accessError) {
                console.warn('Temporay file not found for moving: ', tempId);
                throw new NotFoundException(`Temporary image file with ID ${tempId} not found`);
            }

            await fs.rename(tempFilePath, permanentFilePath);
            console.log(`Moved temp image ${tempId} to permanent storate ${permanentFilePath}`);
            return permanentFileUrl
        } catch (error) {
            if (error instanceof NotFoundException) {
                throw error; // Re-throw the specific NotFoundException
            }
            console.error(`Error moving temp image ${tempId} to permanent: ${error.message}`, error.stack);
            throw new InternalServerErrorException(`Failed to finalize image storage for ID ${tempId}.`);
        }
    }

    async cleanupTempImage(tempId: string): Promise<void> {
        const tempFilePath = path.join(tempDir, tempId);
        try {
            await fs.unlink(tempFilePath);
            console.log('Cleaned up temporaray file: ', tempId);
        } catch (error) {
            console.error(`Error cleaning up temp image ${tempId}: ${error.message}`);
        }
    }
}