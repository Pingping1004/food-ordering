import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { CreateRestaurantDto } from './dto/create-restaurant.dto';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateRestaurantDto } from './dto/update-restaurant.dto';
import moment from 'moment-timezone';
import { UploadService } from 'src/upload/upload.service';
import { clearRestaurantCache, getRestaurantCache, OpenRestaurant, RestaurantCache, setRestaurantCache } from './restaurantCache';

@Injectable()
export class RestaurantService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uploadService: UploadService,
  ) { }

  private readonly logger = new Logger('RestaurantService');
  private pendingRestaurantRequests = new Map<string, Promise<RestaurantCache[]>>();

  async createRestaurant(
    createRestaurantDto: CreateRestaurantDto,
    userId: string,
    paymentFile: Express.Multer.File, 
    file?: Express.Multer.File,
  ) {
    try {
      const existingRestaurant = await this.findExistingRestaurant(userId);
      if (existingRestaurant)
        throw new ConflictException(`ผู้ใช้ได้ลงทะเบียนกับร้าน: ${existingRestaurant.name}แล้ว`);

      const restaurantImgUrl = file ? (await this.uploadService.saveImage(file)).url : null;
      const paymentQr = paymentFile ? (await this.uploadService.saveImage(paymentFile)).url : null;

      if (!paymentQr) throw new NotFoundException(`กรุณาอัพโหลดQR สำหรับให้ลูกค้าชำระเงิน`);

      let openTime: string = '';
      let closeTime: string = '';

      if (typeof createRestaurantDto.openTime === 'string') {
        openTime = createRestaurantDto.openTime;
      } else if (createRestaurantDto.openTime instanceof Date) {
        openTime = moment(createRestaurantDto.openTime)
          .tz('Asia/Bangkok')
          .format('HH:mm');
      }

      if (typeof createRestaurantDto.closeTime === 'string') {
        closeTime = createRestaurantDto.closeTime;
      } else if (createRestaurantDto.closeTime instanceof Date) {
        closeTime = moment(createRestaurantDto.closeTime)
          .tz('Asia/Bangkok')
          .format('HH:mm');
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
        isApproved: true,
        adminName: createRestaurantDto.adminName,
        adminSurname: createRestaurantDto.adminSurname,
        adminTel: createRestaurantDto.adminTel,
        adminEmail: createRestaurantDto.adminEmail,
        accountNumber: createRestaurantDto.accountNumber,
        bankAccount: createRestaurantDto.bankAccount,
        paymentQr: paymentQr,
        accountHolderFullName: createRestaurantDto.accountHolderFullName,
      };

      const result = await this.prisma.restaurant.create({
        data: newRestaurant,
      });

      clearRestaurantCache("restaurants:all")
      clearRestaurantCache("restaurants:open")

      return { message: 'อัพโหลดไฟล์สำเร็จ', result, imageUrl: restaurantImgUrl };
    } catch (error) {
      this.logger.error('ลงทะเบียนร้านอาหารล้มเหลว: ', error);
      throw error;
    }
  }

  async findAllRestaurant(): Promise<RestaurantCache[]> {
    const cacheKey = "restaurants:all";
    const cached = getRestaurantCache<OpenRestaurant[]>(cacheKey);

    if (cached) {
      this.logger.debug("Restaurant lists cache hit!")
      return cached
    }

    const pendingRequest = this.pendingRestaurantRequests.get(cacheKey);
    if (pendingRequest) return pendingRequest;

    const requestPromise = (async () => {
      const restaurants = await this.prisma.restaurant.findMany({
        where: { isApproved: true },
        select: {
          restaurantId: true,
          restaurantImg: true,
          name: true,
          location: true,
          categories: true,
          openDate: true,
          openTime: true,
          closeTime: true,
          avgCookingTime: true,
          isTemporarilyClosed: true,
          accountNumber: true,
          accountHolderFullName: true,
          paymentQr: true,
        }
      });

      setRestaurantCache(cacheKey, restaurants, 15 * 60 * 1000);
      return restaurants
    })();

    this.pendingRestaurantRequests.set(cacheKey, requestPromise)

    try {
      return await requestPromise;
    } finally {
      this.pendingRestaurantRequests.delete(cacheKey)
    }
  }

  async findExistingRestaurant(userId: string) {
    const result = await this.prisma.restaurant.findUnique({
      where: { userId },
    });

    return result;
  }

  async findRestaurant(restaurantId: string) {
    const cacheKey = `restaurant:${restaurantId}`;
    const cached = getRestaurantCache<RestaurantCache>(cacheKey);

    const currentTimeString = moment().tz('Asia/Bangkok').format('HH:mm');

    if (cached) {
      const isScheduledOpenDay = this.isTodayOpen(
        cached.openDate,
        cached.openTime,
        cached.closeTime
      );
  
      const isScheduledOpenTime = this.isTimeBetween(
        currentTimeString,
        cached.openTime,
        cached.closeTime
      );
  
      const isActuallyOpen =
        isScheduledOpenDay &&
        isScheduledOpenTime &&
        !cached.isTemporarilyClosed;
  
      return { ...cached, isActuallyOpen };
    }

    try {
      const restaurant = await this.prisma.restaurant.findUnique({
        where: { restaurantId },
      });

      if (!restaurant) throw new NotFoundException(`ไม่พบร้านอาหารที่มีID: ${restaurantId}`);

      const isScheduledOpenDay = this.isTodayOpen(restaurant.openDate, restaurant.openTime, restaurant.closeTime);
      const isScheduledOpenTime = this.isTimeBetween(
        currentTimeString,
        restaurant.openTime,
        restaurant.closeTime,
      );

      const isOpen = isScheduledOpenDay && isScheduledOpenTime;
      const isManuallyClosed = restaurant.isTemporarilyClosed;
      const isActuallyOpen = isOpen && !isManuallyClosed;

      setRestaurantCache(cacheKey, restaurant, 15 * 60 * 1000);
      return { ...restaurant, isActuallyOpen };
    } catch (error) {
      if (error.code === 'P2025') {
        // Prisma "Record not found"
        throw new NotFoundException(`ไม่พบร้านอาหารที่มีID: ${restaurantId}`);
      }
      throw error;
    }
  }

  private isTimeBetween(now: string, open: string, close: string): boolean {
    const nowParts = now.split(':').map(Number);
    const openParts = open.split(':').map(Number);
    const closeParts = close.split(':').map(Number);

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
    const cacheKey = "restaurants:open";
    const cached = getRestaurantCache<RestaurantCache[]>(cacheKey);

    if (cached) return cached;

    const currentTimeString = moment().tz('Asia/Bangkok').format('HH:mm');

    const allRestaurants = await this.findAllRestaurant();
    const openRestaurants = allRestaurants
      .map(restaurant => {
        const isScheduledOpenDay = this.isTodayOpen(restaurant.openDate, restaurant.openTime, restaurant.closeTime);
        const isScheduledOpenTime = this.isTimeBetween(currentTimeString, restaurant.openTime, restaurant.closeTime);
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
      })
      .filter(restaurant => restaurant.isActuallyOpen);

      setRestaurantCache(cacheKey, openRestaurants, 30 * 1000)

    return openRestaurants;
  }

  async updateRestaurant(
    restaurantId: string,
    updateRestaurantDto: UpdateRestaurantDto,
    file?: Express.Multer.File,
  ) {
    try {
      const dataToUpdate: Partial<UpdateRestaurantDto> = {
        ...updateRestaurantDto,
      };

      const existingRestaurant = await this.prisma.restaurant.findUnique({
        where: { restaurantId },
        select: { restaurantImg: true }
      });

      if (!existingRestaurant) throw new NotFoundException(`ไมพบร้านอาหาร`)

      if (file) {
        const { url } = await this.uploadService.saveImage(file);
        dataToUpdate.restaurantImg = url;

        if (existingRestaurant.restaurantImg) {
          const oldR2Key = this.uploadService.extractKeyFromUrl(existingRestaurant.restaurantImg);
          if (oldR2Key) {
            await this.uploadService.cleanupImage(oldR2Key);
          }
        }
      } else if (updateRestaurantDto.restaurantImg === undefined) {
        dataToUpdate.restaurantImg = undefined;
      }

      if (Object.keys(dataToUpdate).length === 0) {
        throw new BadRequestException('ไม่พบข้อมูลให้อัปเดต.');
      }

      const result = await this.prisma.restaurant.update({
        where: { restaurantId },
        data: dataToUpdate,
      });

      clearRestaurantCache(`restaurant:${restaurantId}`)
      clearRestaurantCache(`restaurants:all`)
      clearRestaurantCache("restaurants:open")

      return result;
    } catch (error) {
      if (error.code === 'P2025') throw new NotFoundException(`ไม่พบร้านอาหารที่มีID: ${restaurantId}`);
      // Unique constraint failed
      if (error.code === 'P2002') throw new BadRequestException('ชื่อร้านอาหารนี้ถูกใช้ไปแล้ว โปรดใช้ชื่อใหม่');
      throw error;
    }
  }

  async updateIsTemporailyClose(
    restaurantId: string,
    updateRestaurantDto: UpdateRestaurantDto,
  ) {
    try {
      const result = await this.prisma.restaurant.update({
        where: { restaurantId },
        data: { isTemporarilyClosed: updateRestaurantDto.isTemporarilyClosed },
      });

      clearRestaurantCache(`restaurant:${restaurantId}`)
      clearRestaurantCache(`restaurants:all`)
      clearRestaurantCache("restaurants:open")

      return {
        result,
        message: `อัพเดทสถานะเปิด/ปิดชั่วคราวของร้านอาหาร ${result.name} เป็น ${result.isTemporarilyClosed} สำเร็จ`,
      };
    } catch (error) {
      this.logger.error('Failed to update temporary close status of restaurant', error.message, error.stack);
      throw error
    }
  }

  async removeRestaurant(restaurantId: string) {
    const orders = await this.prisma.order.findMany({
      where: { restaurantId },
      select: { orderId: true, status: true },
    });

    const allOrderDone = orders.every((order) => order.status === 'accepted');
    if (!allOrderDone) throw new BadRequestException('ไม่สามารถลบร้านอาหารในขณะที่ยังมีออเดอร์ค้างอยู่');

    const orderIds = orders.map((order) => order.orderId);

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.orderMenu.deleteMany({
        where: {
          orderId: { in: orderIds },
        },
      });

      await tx.order.deleteMany({
        where: {
          restaurantId,
          status: 'accepted',
        },
      });

      await tx.menu.deleteMany({
        where: { restaurantId },
      });

      return tx.restaurant.delete({
        where: { restaurantId },
      });
    });

    clearRestaurantCache(`restaurant:${restaurantId}`)
    clearRestaurantCache(`restaurants:all`)
    clearRestaurantCache("restaurants:open")

    return result
  }
}
