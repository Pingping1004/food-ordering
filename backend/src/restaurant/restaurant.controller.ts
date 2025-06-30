import {
  Controller,
  Post, Delete, Get, Patch,
  Body,
  Param,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  Req,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer'; // Import diskStorage
import { imageFileFilter, editFileName } from '../utils/file-upload.utils'; // Your utility functions
import { Public } from '../decorators/public.decorator';
import * as fs from 'fs/promises';

import { RestaurantService } from './restaurant.service';
import { CreateRestaurantDto } from './dto/create-restaurant.dto';
import { UpdateRestaurantDto } from './dto/update-restaurant.dto';
import { RolesGuard } from 'src/guards/roles.guard';
import { JwtAuthGuard } from 'src/guards/jwt-auth.guard';
import { Roles } from 'src/decorators/role.decorator';
import { Role } from '@prisma/client';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles([Role.user, Role.admin, Role.cooker])
@Controller('restaurant')
export class RestaurantController {
  constructor(private readonly restaurantService: RestaurantService) { }
  @Post()
  @UseInterceptors(FileInterceptor('restaurantImg', {
    storage: diskStorage({
      destination: './uploads/restaurants',
      filename: editFileName,
    }),
    fileFilter: imageFileFilter,
  }))
  async createRestaurant(
    @Req() req: any,
    @Body() createRestaurantDto: CreateRestaurantDto,
    @UploadedFile(new ParseFilePipe({
      fileIsRequired: false,
    }),
    ) file?: Express.Multer.File
  ) {
    const userId = req.user.userId;
    console.log('Controller: DTO (createRestaurantDto):', createRestaurantDto);
    return this.restaurantService.createRestaurant(createRestaurantDto, userId, file);
  }

  @Public()
  @Roles([])
  @Get()
  async findAllRestaurant() {
    return this.restaurantService.getOpenRestaurants();
  }

  @Public()
  @Get(':restaurantId')
  async findRestaurant(@Param('restaurantId') restaurantId: string) {
    return this.restaurantService.findRestaurant(restaurantId);
  }

  @Patch(':restaurantId')
  @UseInterceptors(
    FileInterceptor('restaurantImg', {
      storage: diskStorage({
        destination: './uploads/restaurants',
        filename: editFileName,
      }),
      fileFilter: imageFileFilter,
    })
  )
  async updateRestaurant(
    @Req() req: any,
    @Param('restaurantId') restaurantId: string,
    @Body() updateRestaurantDto: UpdateRestaurantDto,
    @UploadedFile() file?: Express.Multer.File
  ) {

    let uploadedFilePath: string | undefined;
    try {
      const dataToUpdate: UpdateRestaurantDto = { ...updateRestaurantDto };

      if (file) {
        dataToUpdate.restaurantImg = `uploads/restaurants/${file.filename}`;
        uploadedFilePath = file.path;
      }
      return this.restaurantService.updateRestaurant(restaurantId, dataToUpdate);
    } catch (error) {
      console.error(`Failed to update restaurant ${restaurantId} in controller:`, error);

      // --- 4. Clean up Uploaded File on Error ---
      if (uploadedFilePath) {
        try {
          await fs.unlink(uploadedFilePath);
          console.log(`Controller: Successfully deleted temporary uploaded file: ${uploadedFilePath}`);
        } catch (fileDeleteError) {
          console.error(`Controller: Failed to delete uploaded file ${uploadedFilePath}:`, fileDeleteError);
        }
      }
      // Re-throw the error so NestJS's global exception filters can handle it
      throw error;
    }
  }

  @Delete(':restaurantId')
  async deleteRestaurant(@Param('restaurantId') restaurantId: string) {
    return await this.restaurantService.removeRestaurant(restaurantId);
  }
}
