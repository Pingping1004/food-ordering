import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { createRestaurantDto } from './dto/create-restaurant.dto';
import { PrismaService } from 'prisma/prisma.service';
import { updateRestaurantDto } from './dto/update-restaurant.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class RestaurantService {
  constructor(private prisma: PrismaService) {}

  async createRestaurant(createRestaurantDto: createRestaurantDto) {
    const hashedPassword = await bcrypt.hash(createRestaurantDto.password, 10);

    const newRestaurant = {
      name: createRestaurantDto.name,
      email: createRestaurantDto.email,
      password: hashedPassword,
      categories: createRestaurantDto.categories,
      openTime: createRestaurantDto.openTime,
      closeTime: createRestaurantDto.closeTime,
      adminName: createRestaurantDto.adminName,
      adminSurname: createRestaurantDto.adminSurname,
      adminTel: createRestaurantDto.adminTel,
      adminEmail: createRestaurantDto.adminEmail,
    };
    return this.prisma.restaurant.create({
      data: newRestaurant,
    });
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
    updateRestaurantDto: updateRestaurantDto,
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
