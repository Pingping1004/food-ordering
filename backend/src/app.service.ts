import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'API running successfully!';
  }

  uploadFile(file?: Express.Multer.File) {
    return { message: 'File uploaded successfully', filePath: file?.path }
  }
}