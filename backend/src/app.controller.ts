import { Controller, Get, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { AppService } from './app.service';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService) {}

  @Get('get-hello')
  getHello(): string {
    return this.appService.getHello();
  }

  @Post('uploaded-file')
  @UseInterceptors(FileInterceptor('restaurantImg'))
  uploadFile(@UploadedFile() file?: Express.Multer.File) {
    return this.appService.uploadFile(file);
  }
}
