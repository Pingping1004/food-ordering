import {
  Controller,
  Post,
  Delete,
  Get,
  Patch,
  Body,
  Param,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  Req,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer'; // Import diskStorage
import { imageFileFilter, editFileName } from '../utils/file-upload.utils'; // Your utility functions
import * as fs from 'fs/promises';

import { RestaurantService } from './restaurant.service';
import { CreateRestaurantDto } from './dto/create-restaurant.dto';
import { UpdateRestaurantDto } from './dto/update-restaurant.dto';
import { RolesGuard } from 'src/guards/roles.guard';
import { JwtAuthGuard } from 'src/guards/jwt-auth.guard';
import { Roles } from 'src/decorators/role.decorator';
import { Role } from '@prisma/client';
import { CsrfGuard } from 'src/guards/csrf.guard';

@UseGuards(JwtAuthGuard, RolesGuard, CsrfGuard)
@Roles([Role.user, Role.admin, Role.cooker])
@Controller('restaurant')
export class RestaurantController {
  constructor(private readonly restaurantService: RestaurantService) {}

  private readonly logger = new Logger('RestaurantController');
  @Post()
  @UseInterceptors(
    FileInterceptor('restaurantImg', {
      storage: diskStorage({
        destination: './uploads/restaurants',
        filename: editFileName,
      }),
      fileFilter: imageFileFilter,
    }),
  )
  async createRestaurant(
    @Req() req: any,
    @Body() createRestaurantDto: CreateRestaurantDto,
    @UploadedFile(
      new ParseFilePipe({
        fileIsRequired: false,
      }),
    )
    file?: Express.Multer.File,
  ) {
    const userId = req.user.userId;
    return this.restaurantService.createRestaurant(
      createRestaurantDto,
      userId,
      file,
    );
  }

  // @Public()
  @Roles([Role.user, Role.admin, Role.cooker])
  @Get()
  async findAllRestaurant() {
    return this.restaurantService.getOpenRestaurants();
  }

  // @Public()
  @Roles([Role.user, Role.admin, Role.cooker])
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
    }),
  )
  async updateRestaurant(
    @Req() req: any,
    @Param('restaurantId') restaurantId: string,
    @Body() updateRestaurantDto: UpdateRestaurantDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    let uploadedFilePath: string | undefined;
    try {
      const dataToUpdate: UpdateRestaurantDto = { ...updateRestaurantDto };

      if (file) {
        dataToUpdate.restaurantImg = `uploads/restaurants/${file.filename}`;
      }
      return await this.restaurantService.updateRestaurant(
        restaurantId,
        dataToUpdate,
      );
    } catch (error) {
      this.logger.error(
        `Failed to update restaurant ${restaurantId} in controller:`,
        error,
      );

      // --- 4. Clean up Uploaded File on Error ---
      if (uploadedFilePath) {
        try {
          await fs.unlink(uploadedFilePath);
        } catch (fileDeleteError) {
          this.logger.error(
            `Controller: Failed to delete uploaded file ${uploadedFilePath}:`,
            fileDeleteError,
          );
        }
      }
      // Re-throw the error so NestJS's global exception filters can handle it
      throw error;
    }
  }

  @Roles([Role.user, Role.admin, Role.cooker])
  @Patch('temporarily-close/:restaurantId')
  async updateIsTemporarilyClose(
    @Param('restaurantId') restaurantId: string,
    @Body() updateRestaurantDto: UpdateRestaurantDto,
  ) {
    const updateData = await this.restaurantService.updateIsTemporailyClose(
      restaurantId,
      updateRestaurantDto,
    );
    return updateData;
  }

  @Roles([Role.user, Role.admin, Role.cooker])
  @Delete(':restaurantId')
  async deleteRestaurant(@Param('restaurantId') restaurantId: string) {
    return await this.restaurantService.removeRestaurant(restaurantId);
  }
}
