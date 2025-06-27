import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { CreateRestaurantDto } from './dto/create-restaurant.dto';
import { PrismaService } from 'prisma/prisma.service';
import { UpdateRestaurantDto } from './dto/update-restaurant.dto';
import * as bcrypt from 'bcrypt';
import { OrderService } from 'src/order/order.service';

@Injectable()
export class RestaurantService {
  constructor(
    private prisma: PrismaService,
    private orderService: OrderService,
  ) { }

  async createRestaurant(
    createRestaurantDto: CreateRestaurantDto,
    file?: Express.Multer.File) {
    try {
      const restaurantImgUrl = file ? `uploads/restaurants/${file.filename}` : createRestaurantDto.restaurantImg;

      const newRestaurant = {
        name: createRestaurantDto.name,
        email: createRestaurantDto.email,
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
      return { message: 'File uploaded successfully', result, fileInfo: file };
    } catch (error) {
      console.error('Failed to create restaurant service: ', error);
      throw error;
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

  private isTimeBetween(now: string, open: string, close: string): boolean {
    const nowParts = now.split(':').map(Number);
    const openParts = open.split(':').map(Number);
    const closeParts = close.split(':').map(Number);

    const nowMinutes = nowParts[0] * 60 + nowParts[1];
    const openMinutes = openParts[0] * 60 + openParts[1];
    const closeMinutes = closeParts[0] * 60 + closeParts[1];

    if (openMinutes <= closeMinutes) {
      return nowMinutes >= openMinutes && nowMinutes <= closeMinutes;
    } else {
      return nowMinutes >= openMinutes || nowMinutes <= closeMinutes;
    }
  }

  async getOpenRestaurants() {
    const allRestaurants = await this.findAllRestaurant();
    
    const now = new Date();

    // Use getHours() and getMinutes() to build the string with padding
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const currentTimeString = `${hours}:${minutes}`; // e.g., "14:30"

    const restaurantsWithStatus = allRestaurants.map(restaurant => {
      const isOpen = this.isTimeBetween(
        currentTimeString,
        restaurant.openTime,
        restaurant.closeTime
      );

      return {
        ...restaurant,
        isOpen,
      };
    });

    return restaurantsWithStatus;
  }

  async updateRestaurant(
    restaurantId: string,
    updateRestaurantDto: UpdateRestaurantDto,
    file?: Express.Multer.File
  ) {
    try {
      const restaurantImgUrl = file ? `uploads/restaurants/${file.filename}` : updateRestaurantDto.restaurantImg;
      const dataToUpdate: Partial<UpdateRestaurantDto> = { ...updateRestaurantDto };
      
      if (file) {
        dataToUpdate.restaurantImg = restaurantImgUrl;
      } else if (file === undefined) {
        dataToUpdate.restaurantImg = updateRestaurantDto.restaurantImg;
      }

      if (Object.keys(dataToUpdate).length === 0) {
        throw new BadRequestException('ไม่พบข้อมูลให้อัปเดต.');
      }

      const result = await this.prisma.restaurant.update({
        where: { restaurantId },
        data: dataToUpdate,
      });

      return result;
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
    const orders = await this.prisma.order.findMany({
      where: { restaurantId },
      select: { orderId: true, status: true },
    });

    const allOrderDone = orders.every(order => order.status === 'done');
    if (!allOrderDone) throw new BadRequestException('ไม่สามารถลบร้านอาหารในขณะที่ยังมีออเดอร์ค้างอยู่');

    const orderIds = orders.map(order => order.orderId);

    return this.prisma.$transaction(async (tx) => {
      await tx.orderMenu.deleteMany({
        where: {
          orderId: { in: orderIds },
        }
      })

      await tx.order.deleteMany({
        where: {
          restaurantId,
          status: 'done',
        },
      });

      await tx.menu.deleteMany({
        where: { restaurantId },
      });

      return tx.restaurant.delete({
        where: { restaurantId },
      });
    });
  }
}
