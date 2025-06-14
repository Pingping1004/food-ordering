import {
  Controller,
  Post, Delete, Get, Patch,
  Body,
  Param,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
  HttpStatus,
  HttpException, // Make sure HttpException is imported
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer'; // Import diskStorage
import { imageFileFilter, editFileName } from '../utils/file-upload.utils'; // Your utility functions
import { Public } from '../decorators/public.decorator';

import { RestaurantService } from './restaurant.service';
import { CreateRestaurantDto } from './dto/create-restaurant.dto';
import { UpdateRestaurantDto } from './dto/update-restaurant.dto';

@Controller('restaurant')
export class RestaurantController {
  constructor(private readonly restaurantService: RestaurantService) {}
  @Post()
  @UseInterceptors(FileInterceptor('restaurantImg'))
  async createRestaurant(@Body() createRestaurantDto: CreateRestaurantDto, @UploadedFile() file?: Express.Multer.File) {
    console.log(file);
    return this.restaurantService.createRestaurant(createRestaurantDto, file);
  }
  
  @Public()
  @Get()
  async findAllRestaurant() {
        return this.restaurantService.findAllRestaurant();
    }

    @Public()
    @Get(':restaurantId')
    async findRestaurant(@Param('restaurantId') restaurantId: string) {
        return this.restaurantService.findRestaurant(restaurantId);
    }
    
    @Patch(':restaurantId')
    async updateRestaurant(@Param('restaurantId') restaurantId: string, @Body() updateRestaurantDto: UpdateRestaurantDto) {
        return this.restaurantService.updateRestaurant(restaurantId, updateRestaurantDto);
    }
    
    @Delete(':restaurantId')
    async deleteRestaurant(@Param('restaurantId') restaurantId: string) {
        return this.restaurantService.removeRestaurant(restaurantId);
    }
}
