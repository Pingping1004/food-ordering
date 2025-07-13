import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { CreateRestaurantDto } from './dto/create-restaurant.dto';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateRestaurantDto } from './dto/update-restaurant.dto';
import { OrderService } from 'src/order/order.service';
import { UserService } from 'src/user/user.service';
import { UpdateUserDto } from 'src/user/dto/update-user.dto';
import moment from 'moment-timezone';

@Injectable()
export class RestaurantService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orderService: OrderService,
    private readonly userService: UserService,
  ) { }

  private readonly logger = new Logger('RestaurantService');

  async createRestaurant(
    createRestaurantDto: CreateRestaurantDto,
    userId: string,
    file?: Express.Multer.File,
  ) {
    try {
      const existingRestaurant = await this.findExistingRestaurant(userId);
      if (existingRestaurant)
        throw new ConflictException(
          `User already register as restaurant: ${existingRestaurant.name}`,
        );
      const restaurantImgUrl = file
        ? `uploads/restaurants/${file.filename}`
        : createRestaurantDto.restaurantImg;

      let openTime: string = '';
      let closeTime: string = '';

      if (typeof createRestaurantDto.openTime === 'string') {
        openTime = createRestaurantDto.openTime;
      } else if (createRestaurantDto.openTime instanceof Date) {
        openTime = createRestaurantDto.openTime.toISOString().substring(11, 16);
      }

      if (typeof createRestaurantDto.closeTime === 'string') {
        closeTime = createRestaurantDto.closeTime;
      } else if (createRestaurantDto.closeTime instanceof Date) {
        closeTime = createRestaurantDto.closeTime
          .toISOString()
          .substring(11, 16);
      }

      const newRestaurant = {
        userId,
        name: createRestaurantDto.name,
        email: createRestaurantDto.email,
        categories: createRestaurantDto.categories,
        restaurantImg: restaurantImgUrl,
        avgCookingTime: createRestaurantDto.avgCookingTime,
        openDate: createRestaurantDto.openDate,
        openTime: openTime,
        closeTime: closeTime,
        adminName: createRestaurantDto.adminName,
        adminSurname: createRestaurantDto.adminSurname,
        adminTel: createRestaurantDto.adminTel,
        adminEmail: createRestaurantDto.adminEmail,
      };

      const result = await this.prisma.restaurant.create({
        data: newRestaurant,
      });

      const updateDto: UpdateUserDto = { role: 'cooker' };
      await this.userService.updateUser(userId, updateDto);

      return { message: 'File uploaded successfully', result, fileInfo: file };
    } catch (error) {
      this.logger.error('Failed to create restaurant service: ', error);
      throw error;
    }
  }

  async findAllRestaurant() {
    return this.prisma.restaurant.findMany();
  }

  async findExistingRestaurant(userId: string) {
    const result = await this.prisma.restaurant.findUnique({
      where: { userId },
    });

    return result;
  }

  async findRestaurant(restaurantId: string) {
    try {
      const currentTimeString = moment().tz('Asia/Bangkok').format('HH:mm');
      const restaurant = await this.prisma.restaurant.findUnique({
        where: { restaurantId },
      });

      if (!restaurant) {
        throw new NotFoundException(`ไม่พบร้านอาหารที่มีID: ${restaurantId}`);
      }

      const isScheduledOpenDay = this.isTodayOpen(restaurant.openDate, restaurant.openTime, restaurant.closeTime);
      const isScheduledOpenTime = this.isTimeBetween(
        currentTimeString,
        restaurant.openTime,
        restaurant.closeTime,
      );

      const isOpen = isScheduledOpenDay && isScheduledOpenTime;
      const isManuallyClosed = restaurant.isTemporarilyClosed;
      const isActuallyOpen = isOpen && !isManuallyClosed;

      return { ...restaurant, isActuallyOpen };
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

  async findRestaurantByname(name: string) {
    return this.prisma.restaurant.findUnique({
      where: { name: name },
    });
  }

  private isTimeBetween(now: string, open: string, close: string): boolean {
    this.logger.log('Opentime: ', open);
    this.logger.log('Closetime: ', close);
    this.logger.log('Now: ', now);

    const nowParts = now.split(':').map(Number);
    const openParts = open.split(':').map(Number);
    const closeParts = close.split(':').map(Number);

    this.logger.log('Opentime min: ', openParts);
    this.logger.log('Closetime min: ', closeParts);
    this.logger.log('Now parts: ', nowParts);

    const nowMinutes = nowParts[0] * 60 + nowParts[1];
    const openMinutes = openParts[0] * 60 + openParts[1];
    const closeMinutes = close === '00:00' ? 1440 : closeParts[0] * 60 + closeParts[1];

    if (openMinutes <= closeMinutes) {
      return nowMinutes >= openMinutes && nowMinutes < closeMinutes;
    } else {
      return nowMinutes >= openMinutes || nowMinutes < closeMinutes;
    }
  }

  private isTodayOpen(openDate: string[], openTime: string, closeTime: string): boolean {
    const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    const todayIndex = now.getDay();
    const yesterdayIndex = (todayIndex + 6) % 7;

    const today = days[todayIndex];
    const yesterday = days[yesterdayIndex];

    const openParts = openTime.split(':').map(Number);
    const closeParts = closeTime.split(':').map(Number);

    const openMinutes = openParts[0] * 60 + openParts[1];
    const closeMinutes = closeParts[0] * 60 + closeParts[1];

    const isOvernight = openMinutes > closeMinutes;

    // If it's an overnight shift, check if yesterday was in openDate
    if (isOvernight) {
      return openDate.includes(today) || (nowMinutes < closeMinutes && openDate.includes(yesterday));
    }

    // Normal schedule (e.g. 09:00–17:00)
    return openDate.includes(today);
  }

  async getOpenRestaurants() {
    const currentTimeString = moment().tz('Asia/Bangkok').format('HH:mm');

    const allRestaurants = await this.findAllRestaurant();
    const openRestaurant = allRestaurants.map((restaurant) => {
      const isScheduledOpenDay = this.isTodayOpen(restaurant.openDate, restaurant.openTime, restaurant.closeTime);
      const isScheduledOpenTime = this.isTimeBetween(
        currentTimeString,
        restaurant.openTime,
        restaurant.closeTime,
      );
      const isOpen = isScheduledOpenDay && isScheduledOpenTime;
      const isManuallyClosed = restaurant.isTemporarilyClosed;
      const isActuallyOpen = isOpen && !isManuallyClosed;

      return {
        ...restaurant,
        isScheduledOpenDay,
        isScheduledOpenTime,
        isOpen,
        isActuallyOpen,
      };
    });

    return openRestaurant;
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

  async updateIsTemporailyClose(
    restaurantId: string,
    updateRestaurantDto: UpdateRestaurantDto,
  ) {
    try {
      await this.findRestaurant(restaurantId);

      const result = await this.prisma.restaurant.update({
        where: { restaurantId },
        data: { isTemporarilyClosed: updateRestaurantDto.isTemporarilyClosed },
      });

      return {
        result,
        message: `Successfully update temporarilyClose status of restaurant ${result.name} to be ${result.isTemporarilyClosed}`,
      };
    } catch (error) {
      this.logger.error(
        'Failed to update temporary close status of restaurant',
        error.message,
        error.stack,
      );
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
