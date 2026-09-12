import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { CreateRestaurantDto } from './dto/create-restaurant.dto';
import { PrismaService } from 'prisma/prisma.service';
import { UpdateRestaurantDto } from './dto/update-restaurant.dto';
import { OrderService } from 'src/order/order.service';
import { DayOfWeek } from '@prisma/client';

const DAYS_OF_WEEK: DayOfWeek[] = [
  DayOfWeek.SUNDAY,
  DayOfWeek.MONDAY,
  DayOfWeek.TUESDAY,
  DayOfWeek.WEDNESDAY,
  DayOfWeek.THURSDAY,
  DayOfWeek.FRIDAY,
  DayOfWeek.SATURDAY,
];

@Injectable()
export class RestaurantService {
  constructor(
    private prisma: PrismaService,
    private orderService: OrderService,
    private logger: Logger,
  ) {}

  async createRestaurant(
    createRestaurantDto: CreateRestaurantDto,
    file?: Express.Multer.File,
  ) {
    try {
      const restaurantImgUrl = file
        ? `uploads/restaurants/${file.filename}`
        : createRestaurantDto.profile;

      const result = await this.prisma.restaurant.create({
        data: {
          name: createRestaurantDto.name,
          profile: createRestaurantDto.profile,
          email: createRestaurantDto.email,
          location: createRestaurantDto.location,
          categories: createRestaurantDto.categories,
          maxActiveOrders: createRestaurantDto.maxActiveOrders,
          avgCookingTimeMins: createRestaurantDto.avgCookingTimeMins,
          status: createRestaurantDto.status,

          contactName: createRestaurantDto.contactName,
          contactTel: createRestaurantDto.contactTel,
          contactEmail: createRestaurantDto.contactEmail,

          accountNumber: createRestaurantDto.accountNumber,
          accountName: createRestaurantDto.accountName,
          paymentQr: createRestaurantDto.paymentQr,

          canteenId: createRestaurantDto.canteenId,

          operatingHours: {
            create: createRestaurantDto.operatingHours.map((hour) => ({
              dayOfWeek: hour.dayOfWeek,
              openMinute: hour.openMinute,
              closeMinute: hour.closeMinute,
            })),
          },
        },
      });

      this.logger.log('Created restaurant in service : ', result);
      return { message: 'File uploaded successfully', result, fileInfo: file };
    } catch (error) {
      this.logger.error('Failed to create restaurant service: ', error);
      throw error;
    }
  }

  async findAllRestaurant() {
    return this.prisma.restaurant.findMany({
      include: {
        operatingHours: true,
      },
    });
  }

  async findRestaurant(restaurantId: string) {
    try {
      const restaurant = await this.prisma.restaurant.findUnique({
        where: { restaurantId },
      });

      if (!restaurant) {
        throw new NotFoundException(`ไม่พบร้านอาหารที่มีID: ${restaurantId}`);
      }

      return restaurant;
    } catch (error) {
      // Wrap Prisma errors or other errors if needed
      if (error.code === 'P2025') {
        // Prisma "Record not found"
        throw new NotFoundException(`ไม่พบร้านอาหารที่มีID: ${restaurantId}`);
      }
      // Rethrow any other unexpected errors
      throw error;
    }
  }

  async getOpenRestaurants() {
    const allRestaurants = await this.findAllRestaurant();

    const now = new Date();

    const currentDay = DAYS_OF_WEEK[now.getDay()];
    const currentMinute = now.getHours() * 60 + now.getMinutes();

    const restaurantsWithStatus = allRestaurants.map((restaurant) => {
      const todayHours = restaurant.operatingHours.find(
        (hour) => hour.dayOfWeek === currentDay,
      );

      let isOpen = false;
      if (todayHours) {
        if (todayHours.openMinute <= todayHours.closeMinute) {
          isOpen =
            currentMinute >= todayHours.openMinute &&
            currentMinute <= todayHours.closeMinute;
        } else {
          isOpen =
            currentMinute >= todayHours.openMinute ||
            currentMinute <= todayHours.closeMinute;
        }
      }

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
    file?: Express.Multer.File,
  ) {
    try {
      const restaurantImgUrl = file
        ? `uploads/restaurants/${file.filename}`
        : updateRestaurantDto.restaurantImg;
      const dataToUpdate: Partial<UpdateRestaurantDto> = {
        ...updateRestaurantDto,
      };

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
        throw new NotFoundException(
          `ไม่สามารถแก้ไขข้อมูลได้ เนื่องจากไม่พบร้านอาหารที่มีID: ${restaurantId}`,
        );
      }
      if (error.code === 'P2002') {
        // Unique constraint failed
        throw new BadRequestException(
          'ชื่อร้านอาหารนี้ถูกใช้ไปแล้ว โปรดใช้ชื่อใหม่',
        );
      }
      throw error;
    }
  }

  async removeRestaurant(restaurantId: string) {
    const orders = await this.prisma.order.findMany({
      where: { restaurantId },
      select: { orderId: true, status: true },
    });

    const allOrderDone = orders.every((order) => order.status === 'done');
    if (!allOrderDone)
      throw new BadRequestException(
        'ไม่สามารถลบร้านอาหารในขณะที่ยังมีออเดอร์ค้างอยู่',
      );

    const orderIds = orders.map((order) => order.orderId);

    return this.prisma.$transaction(async (tx) => {
      await tx.orderMenu.deleteMany({
        where: {
          orderId: { in: orderIds },
        },
      });

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
