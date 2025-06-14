import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { CreateRestaurantDto } from './dto/create-restaurant.dto';
import { PrismaService } from 'prisma/prisma.service';
import { UpdateRestaurantDto } from './dto/update-restaurant.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class RestaurantService {
  constructor(private prisma: PrismaService) { }

  async createRestaurant(createRestaurantDto: CreateRestaurantDto, file?: Express.Multer.File) {
    try {

      console.log(file);
      const hashedPassword = await bcrypt.hash(createRestaurantDto.password, 10);
      const restaurantImgUrl = file ? `uploads/restaurants/${file.filename}` : createRestaurantDto.restaurantImg;
      console.log(restaurantImgUrl);
      console.log(createRestaurantDto);
      
      const newRestaurant = {
        name: createRestaurantDto.name,
        email: createRestaurantDto.email,
        password: hashedPassword,
        categories: createRestaurantDto.categories,
        restaurantImg: restaurantImgUrl,
        openTime: createRestaurantDto.openTime,
        closeTime: createRestaurantDto.closeTime,
        adminName: createRestaurantDto.adminName,
        adminSurname: createRestaurantDto.adminSurname,
        adminTel: createRestaurantDto.adminTel,
        adminEmail: createRestaurantDto.adminEmail,
    }
    
    const result = await this.prisma.restaurant.create({
      data: newRestaurant,
    });

    console.log("Created restaurant in service : ", result);
    console.log('RestaurantImg in service: ', newRestaurant.restaurantImg);

    return { message: 'File uploaded successfully', result, fileInfo: file };
  } catch (error) {
    console.error('Failed to create restaurant service: ', error);
  }
  }

  async findAllRestaurant() {
    return this.prisma.restaurant.findMany();
  }

  async findRestaurant(restaurantId: string) {
    try {
      const restaurant = await this.prisma.restaurant.findUnique({
        where: { restaurantId },
      });

      if (!restaurant) {
        throw new NotFoundException(
          `ไม่พบร้านอาหารที่มีID: ${restaurantId}`,
        );
      }

      return restaurant;
    } catch (error) {
      // Wrap Prisma errors or other errors if needed
      if (error.code === 'P2025') {
        // Prisma "Record not found"
        throw new NotFoundException(
          `ไม่พบร้านอาหารที่มีID: ${restaurantId}`,
        );
      }
      // Rethrow any other unexpected errors
      throw error;
    }
  }

  async findRestaurantByname(name: string) {
    return this.prisma.restaurant.findUnique({
      where: { name: name },
    });
  }

  async updateRestaurant(
    restaurantId: string,
    updateRestaurantDto: UpdateRestaurantDto,
  ) {
    try {
      // You can add business logic here (e.g. validation)

      const updatedRestaurant = await this.prisma.restaurant.update({
        where: { restaurantId },
        data: updateRestaurantDto,
      });

      return updatedRestaurant;
    } catch (error) {
      if (error.code === 'P2025') {
        throw new NotFoundException(`ไม่สามารถแก้ไขข้อมูลได้ เนื่องจากไม่พบร้านอาหารที่มีID: ${restaurantId}`);
      }
      if (error.code === 'P2002') { // Unique constraint failed
        throw new BadRequestException('ชื่อร้านอาหารนี้ถูกใช้ไปแล้ว โปรดใช้ชื่อใหม่');
      }
      throw error;
    }
  }

  async removeRestaurant(restaurantId: string) {
    return this.prisma.restaurant.delete({
      where: { restaurantId },
    });
  }
}
