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
  Req,
  UseGuards,
  Logger,
  InternalServerErrorException,
  UploadedFiles,
  BadRequestException,
} from '@nestjs/common';
import { FileFieldsInterceptor, FileInterceptor } from '@nestjs/platform-express';
import { imageFileFilter } from '../utils/file-upload.utils'

import { RestaurantService } from './restaurant.service';
import { CreateRestaurantDto } from './dto/create-restaurant.dto';
import { UpdateRestaurantDto } from './dto/update-restaurant.dto';
import { RolesGuard } from 'src/guards/roles.guard';
import { JwtAuthGuard } from 'src/guards/jwt-auth.guard';
import { Roles } from 'src/decorators/role.decorator';
import { Role } from '@prisma/client';
import { CsrfGuard } from 'src/guards/csrf.guard';
import { Public } from 'src/decorators/public.decorator';

@UseGuards(JwtAuthGuard, RolesGuard, CsrfGuard)
@Roles([Role.user, Role.admin, Role.cooker])
@Controller('restaurant')
export class RestaurantController {
  constructor(private readonly restaurantService: RestaurantService) { }

  private readonly logger = new Logger('RestaurantController');

  @Post()
  @UseInterceptors(FileFieldsInterceptor([
    { name: 'restaurantImg', maxCount: 1 },
    { name: 'paymentQr', maxCount: 1 },
  ]))
  async createRestaurant(
    @Req() req: any,
    @Body() createRestaurantDto: CreateRestaurantDto,
    @UploadedFiles() files?: {
      paymentQr?: Express.Multer.File[],
      restaurantImg?: Express.Multer.File[],
    },
  ) {
    const paymentQr = files?.paymentQr?.[0];
  
    if (!paymentQr) throw new BadRequestException('กรุณาอัพโหลด QR');
  
    const userId = req.user.userId;
    return this.restaurantService.createRestaurant(
      createRestaurantDto,
      userId,
      paymentQr,
      files.restaurantImg?.[0],
    );
  }

  @Public()
  @Get()
  async findAllRestaurant() {
    return this.restaurantService.getOpenRestaurants();
  }

  @Public()
  // @Roles([Role.user, Role.admin, Role.cooker])
  @Get(':restaurantId')
  async findRestaurant(@Param('restaurantId') restaurantId: string) {
    return this.restaurantService.findRestaurant(restaurantId);
  }

  @Patch(':restaurantId')
  @UseInterceptors(
    FileInterceptor('restaurantImg', {
      storage: null,
      fileFilter: imageFileFilter,
    }),
  )
  async updateRestaurant(
    @Param('restaurantId') restaurantId: string,
    @Body() updateRestaurantDto: UpdateRestaurantDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    try {
      const dataToUpdate: UpdateRestaurantDto = { ...updateRestaurantDto };

      return await this.restaurantService.updateRestaurant(
        restaurantId,
        dataToUpdate,
        file,
      );
    } catch (error) {
      this.logger.error(`Failed to update restaurant ${restaurantId} in controller: `, error);

      throw new InternalServerErrorException('อัพเดทร้านอาหรรล้มเหลว');
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
