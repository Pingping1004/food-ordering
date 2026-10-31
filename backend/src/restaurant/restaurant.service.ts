import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { isDebugAlwaysOpen } from '../utils/debug';
import { CreateRestaurantDto } from './dto/create-restaurant.dto';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateRestaurantDto } from './dto/update-restaurant.dto';
import moment from 'moment-timezone';
import { UploadService } from 'src/upload/upload.service';
import {
  clearRestaurantCache,
  clearRestaurantCacheByPrefix,
  getRestaurantCache,
  OpenRestaurant,
  RestaurantCache,
  setRestaurantCache,
} from './restaurantCache';
import { DEFAULT_FALLBACK_IMG_URL } from 'src/constant/image';
import { AnalyticsService } from 'src/analytics/analytics.service';
import { EventName, EventSource } from 'src/analytics/dto/analytics.dto';
import {
  DayOfWeek,
  MembershipStatus,
  RestaurantRole,
  Status,
  Prisma,
} from '@prisma/client';
import { assertHasOwnerGrant, consumeOwnerGrant } from '../invite/owner-grant';
import { QrReaderService } from '../utils/qr-reader.service';
import { AccountType } from '../common/interface/accountType';
import { minutesToHHmm, summarizeHours } from '../utils/hours.util';
import { invalidateRestaurantVisibility } from '../access/restaurant-visibility.cache';

const ALL_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

@Injectable()
export class RestaurantService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uploadService: UploadService,
    private readonly analyticsService: AnalyticsService,
    private readonly qrReaderService: QrReaderService,
  ) {}

  private readonly logger = new Logger('RestaurantService');
  private pendingRestaurantRequests = new Map<
    string,
    Promise<RestaurantCache[]>
  >();
  private requestVersion = new Map<string, number>();

  /** Drop the per-school list caches (and optionally one restaurant). */
  private invalidateLists(restaurantId?: string) {
    invalidateRestaurantVisibility(restaurantId);
    const now = Date.now();
    for (const key of this.requestVersion.keys()) {
      if (key.startsWith('restaurants:')) this.requestVersion.set(key, now);
    }
    clearRestaurantCacheByPrefix('restaurants:');
    if (restaurantId) {
      this.requestVersion.set(`restaurant:${restaurantId}`, now);
      clearRestaurantCache(`restaurant:${restaurantId}`);
    }
  }

  /** The canteen must be an ACTIVE canteen of the caller's own school; anything else is a 404. */
  private async resolveOwnCanteen(
    userId: string,
    canteenId?: string,
  ): Promise<{ canteenId: string; schoolId: string }> {
    const user = await this.prisma.user.findUnique({
      where: { userId },
      select: { schoolId: true },
    });
    if (!user?.schoolId)
      throw new ForbiddenException('กรุณาเข้าร่วมโรงเรียนก่อนลงทะเบียนร้านค้า');
    if (!canteenId) throw new BadRequestException('กรุณาเลือกโรงอาหาร');

    const canteen = await this.prisma.canteen.findFirst({
      where: { canteenId, schoolId: user.schoolId, status: Status.ACTIVE },
      select: { canteenId: true },
    });
    if (!canteen) throw new NotFoundException('ไม่พบโรงอาหาร');
    return { canteenId: canteen.canteenId, schoolId: user.schoolId };
  }

  async createRestaurant(
    createRestaurantDto: CreateRestaurantDto,
    userId: string,
    paymentFile: Express.Multer.File,
    file?: Express.Multer.File,
  ) {
    try {
      const { canteenId, schoolId } = await this.resolveOwnCanteen(
        userId,
        createRestaurantDto.canteenId,
      );

      const existingRestaurant = await this.findExistingRestaurant(userId);
      if (existingRestaurant)
        throw new ConflictException(
          `ผู้ใช้ได้ลงทะเบียนกับร้าน: ${existingRestaurant.name}แล้ว`,
        );

      // The SHOP_OWNER invite code is what entitles a user to open a shop (fail early, before any upload).
      await assertHasOwnerGrant(this.prisma, userId, schoolId);

      const restaurantImgUrl = file
        ? (await this.uploadService.saveImage(file)).url
        : DEFAULT_FALLBACK_IMG_URL;

      if (!paymentFile)
        throw new NotFoundException(`กรุณาอัพโหลดQR สำหรับให้ลูกค้าชำระเงิน`);

      let extractedAccount = createRestaurantDto.accountNumber;
      let extractedBank = createRestaurantDto.bankAccount;

      try {
        const qrInfo = await this.qrReaderService.processPaymentQr(
          paymentFile.buffer,
        );

        extractedAccount = qrInfo.accountNumber || extractedAccount;
        extractedBank = qrInfo.bankAccount || extractedBank;

        if (qrInfo.warnings.length > 0) {
          this.logger.warn(
            `QR Warnings for restaurant ${createRestaurantDto.name}: ${qrInfo.warnings.join(', ')}`,
          );
        }
      } catch (qrError) {
        this.logger.warn(`QR warning: ${(qrError as Error).message}`);
      }

      const paymentQr = (await this.uploadService.saveImage(paymentFile)).url;

      const contactName =
        createRestaurantDto.contactName ||
        createRestaurantDto.adminName ||
        'Contact';
      const contactTel =
        createRestaurantDto.contactTel ||
        createRestaurantDto.adminTel ||
        '0000000000';
      const contactEmail =
        createRestaurantDto.contactEmail ||
        createRestaurantDto.adminEmail ||
        createRestaurantDto.email;
      const accountName =
        createRestaurantDto.accountName ||
        createRestaurantDto.accountHolderFullName ||
        'Account Holder';
      const avgCookingTime =
        createRestaurantDto.avgCookingTimeMins ??
        createRestaurantDto.avgCookingTime ??
        10;

      const result = await this.prisma.$transaction(async (tx) => {
        await consumeOwnerGrant(tx, userId, schoolId);
        return tx.restaurant.create({
          data: {
            name: createRestaurantDto.name,
            email: createRestaurantDto.email,
            profile: restaurantImgUrl,
            location: createRestaurantDto.location ?? null,
            categories: createRestaurantDto.categories,
            avgCookingTimeMins: avgCookingTime,
            maxActiveOrders: createRestaurantDto.maxActiveOrders ?? 50,
            status: Status.PENDING,
            contactName,
            contactSurname: createRestaurantDto.contactSurname ?? '',
            contactTel,
            contactEmail,
            bankType: extractedBank ?? AccountType.PROMPTPAY_PHONE,
            accountNumber: (extractedAccount as string) || '0000000000',
            accountName,
            paymentQr,
            canteenId,
            memberships: {
              create: {
                userId,
                role: RestaurantRole.OWNER,
                status: MembershipStatus.APPROVED,
              },
            },
          },
        });
      });

      this.invalidateLists();

      return {
        message: 'อัพโหลดไฟล์สำเร็จ',
        result,
        imageUrl: restaurantImgUrl,
      };
    } catch (error) {
      this.logger.error('ลงทะเบียนร้านอาหารล้มเหลว: ', error);
      throw error;
    }
  }

  async findAllRestaurant(
    schoolId: string,
    limit: number = 6,
  ): Promise<RestaurantCache[]> {
    const cacheKey = `restaurants:all:${schoolId}`;
    const cached = getRestaurantCache<OpenRestaurant[]>(cacheKey);

    if (cached) return cached.slice(0, limit);

    const pendingRequest = this.pendingRestaurantRequests.get(cacheKey);
    if (pendingRequest) {
      this.logger.debug(`Using pending request for key: ${cacheKey}`);
      return pendingRequest;
    }

    const requestPromise = (async () => {
      const currentVersion = Date.now();
      this.requestVersion.set(cacheKey, currentVersion);

      const restaurants = await this.prisma.safeRead(() =>
        this.prisma.restaurant.findMany({
          where: { status: Status.ACTIVE, canteen: { schoolId } },
          take: limit * 3,
          select: {
            restaurantId: true,
            profile: true,
            name: true,
            location: true,
            categories: true,
            avgCookingTimeMins: true,
            accountNumber: true,
            accountName: true,
            paymentQr: true,
            canteenId: true,
            operatingHours: {
              select: { dayOfWeek: true, openMinute: true, closeMinute: true },
            },
          },
        }),
      );

      // Today's real opening hours of each shop (Bangkok). Shops without any hours keep the 08:00–20:00 default.
      const DAY_BY_INDEX: DayOfWeek[] = [
        DayOfWeek.SUNDAY,
        DayOfWeek.MONDAY,
        DayOfWeek.TUESDAY,
        DayOfWeek.WEDNESDAY,
        DayOfWeek.THURSDAY,
        DayOfWeek.FRIDAY,
        DayOfWeek.SATURDAY,
      ];
      const todayDay = DAY_BY_INDEX[moment().tz('Asia/Bangkok').day()];
      const hoursToday = (r: (typeof restaurants)[number]) => {
        if (!r.operatingHours?.length) {
          return { openDate: ALL_DAYS, openTime: '08:00', closeTime: '20:00' };
        }
        const h = r.operatingHours.find((x) => x.dayOfWeek === todayDay);
        if (!h) return { openDate: [] as string[], openTime: '08:00', closeTime: '20:00' };
        return {
          openDate: ALL_DAYS,
          openTime: minutesToHHmm(h.openMinute),
          closeTime: minutesToHHmm(h.closeMinute),
        };
      };

      const mapped: RestaurantCache[] = (restaurants || []).map((r) => ({
        restaurantId: r.restaurantId,
        profile: r.profile,
        restaurantImg: r.profile,
        name: r.name,
        location: r.location,
        categories: r.categories,
        ...hoursToday(r),
        avgCookingTime: r.avgCookingTimeMins ?? 10,
        avgCookingTimeMins: r.avgCookingTimeMins,
        isTemporarilyClosed: false,
        accountNumber: r.accountNumber,
        accountName: r.accountName,
        accountHolderFullName: r.accountName,
        paymentQr: r.paymentQr,
        canteenId: r.canteenId,
      }));

      if (this.requestVersion.get(cacheKey) === currentVersion) {
        setRestaurantCache(cacheKey, mapped, 15 * 60 * 1000);
      }

      return mapped.slice(0, limit);
    })();

    this.pendingRestaurantRequests.set(cacheKey, requestPromise);

    try {
      return await requestPromise;
    } finally {
      this.pendingRestaurantRequests.delete(cacheKey);
    }
  }

  async findExistingRestaurant(userId: string) {
    const result = await this.prisma.restaurant.findFirst({
      where: {
        status: { not: Status.REMOVED },
        memberships: {
          some: {
            userId,
            role: RestaurantRole.OWNER,
          },
        },
      },
      select: {
        restaurantId: true,
        name: true,
        status: true,
      },
    });

    return result;
  }

  async findRestaurant(
    restaurantId: string,
  ): Promise<RestaurantCache & { isActuallyOpen: boolean }> {
    const cacheKey = `restaurant:${restaurantId}`;
    const cached = getRestaurantCache<RestaurantCache>(cacheKey);

    const currentTimeString = moment().tz('Asia/Bangkok').format('HH:mm');

    if (cached) {
      const isScheduledOpenDay = this.isTodayOpen(
        cached.openDate,
        cached.openTime,
        cached.closeTime,
      );

      const isScheduledOpenTime = this.isTimeBetween(
        currentTimeString,
        cached.openTime,
        cached.closeTime,
      );

      const isActuallyOpen =
        isDebugAlwaysOpen() ||
        (isScheduledOpenDay &&
          isScheduledOpenTime &&
          !cached.isTemporarilyClosed);

      return { ...cached, isActuallyOpen };
    }

    try {
      const r = await this.prisma.safeRead(() =>
        this.prisma.restaurant.findUnique({
          where: { restaurantId },
          include: {
            operatingHours: {
              orderBy: { dayOfWeek: 'asc' },
            },
          },
        }),
      );

      if (!r)
        throw new NotFoundException(`ไม่พบร้านอาหารที่มีID: ${restaurantId}`);

      let openTime = '08:00';
      let closeTime = '20:00';
      let isScheduledOpenDay = true;
      let isScheduledOpenTime = true;

      if (r.operatingHours && r.operatingHours.length > 0) {
        const bkkNow = moment().tz('Asia/Bangkok');
        const dayIdx = bkkNow.day();
        const BKK_DAY_MAP: Record<number, DayOfWeek> = {
          0: DayOfWeek.SUNDAY,
          1: DayOfWeek.MONDAY,
          2: DayOfWeek.TUESDAY,
          3: DayOfWeek.WEDNESDAY,
          4: DayOfWeek.THURSDAY,
          5: DayOfWeek.FRIDAY,
          6: DayOfWeek.SATURDAY,
        };
        const todayDay = BKK_DAY_MAP[dayIdx];
        const todayHour = r.operatingHours.find(
          (h) => h.dayOfWeek === todayDay,
        );
        if (todayHour) {
          openTime = minutesToHHmm(todayHour.openMinute);
          closeTime = minutesToHHmm(todayHour.closeMinute);
          const currentMinutes = bkkNow.hours() * 60 + bkkNow.minutes();
          isScheduledOpenDay = true;
          isScheduledOpenTime =
            currentMinutes >= todayHour.openMinute &&
            currentMinutes < todayHour.closeMinute;
        } else {
          isScheduledOpenDay = false;
          isScheduledOpenTime = false;
        }
      } else {
        isScheduledOpenDay = this.isTodayOpen(
          ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
          openTime,
          closeTime,
        );
        isScheduledOpenTime = this.isTimeBetween(
          currentTimeString,
          openTime,
          closeTime,
        );
      }

      const restaurant: RestaurantCache = {
        restaurantId: r.restaurantId,
        profile: r.profile,
        restaurantImg: r.profile,
        name: r.name,
        location: r.location,
        categories: r.categories,
        openDate: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
        openTime,
        closeTime,
        avgCookingTime: r.avgCookingTimeMins ?? 10,
        avgCookingTimeMins: r.avgCookingTimeMins,
        isTemporarilyClosed: r.status === Status.SUSPENDED,
        accountNumber: r.accountNumber,
        accountName: r.accountName,
        accountHolderFullName: r.accountName,
        paymentQr: r.paymentQr,
        canteenId: r.canteenId,
        maxActiveOrders: r.maxActiveOrders ?? undefined,
        isAutoAcceptedOrder: r.isAutoAcceptedOrder,
        contactName: r.contactName,
        contactSurname: r.contactSurname,
        contactTel: r.contactTel,
        contactEmail: r.contactEmail,
        bankType: r.bankType,
        status: r.status,
        operatingHours: r.operatingHours?.map((h) => ({
          id: h.id,
          restaurantId: h.restaurantId,
          dayOfWeek: h.dayOfWeek,
          openMinute: h.openMinute,
          closeMinute: h.closeMinute,
        })),
      };

      const isOpen = isScheduledOpenDay && isScheduledOpenTime;
      const isManuallyClosed = restaurant.isTemporarilyClosed;
      const isActuallyOpen =
        isDebugAlwaysOpen() || (isOpen && !isManuallyClosed);

      setRestaurantCache(cacheKey, restaurant, 15 * 60 * 1000);
      return { ...restaurant, isActuallyOpen };
    } catch (error) {
      if (error.code === 'P2025') {
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
    const closeMinutes =
      close === '00:00' ? 1440 : closeParts[0] * 60 + closeParts[1];

    if (openMinutes <= closeMinutes) {
      return nowMinutes >= openMinutes && nowMinutes < closeMinutes;
    } else {
      return nowMinutes >= openMinutes || nowMinutes < closeMinutes;
    }
  }

  private isTodayOpen(
    openDate: string[],
    openTime: string,
    closeTime: string,
  ): boolean {
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

    if (isOvernight) {
      return (
        openDate.includes(today) ||
        (nowMinutes < closeMinutes && openDate.includes(yesterday))
      );
    }

    return openDate.includes(today);
  }

  async getOpenRestaurants(schoolId: string | null, limit: number = 6) {
    if (!schoolId) return [];
    const cacheKey = `restaurants:open:${schoolId}`;
    const cached = getRestaurantCache<RestaurantCache[]>(cacheKey);

    if (cached) return cached.slice(0, limit);

    const currentTimeString = moment().tz('Asia/Bangkok').format('HH:mm');

    const allRestaurants = await this.findAllRestaurant(schoolId, limit);
    const openRestaurants = allRestaurants
      .map((restaurant) => {
        const isScheduledOpenDay = this.isTodayOpen(
          restaurant.openDate,
          restaurant.openTime,
          restaurant.closeTime,
        );
        const isScheduledOpenTime = this.isTimeBetween(
          currentTimeString,
          restaurant.openTime,
          restaurant.closeTime,
        );
        const isOpen = isScheduledOpenDay && isScheduledOpenTime;
        const isManuallyClosed = restaurant.isTemporarilyClosed;
        const isActuallyOpen =
          isDebugAlwaysOpen() || (isOpen && !isManuallyClosed);

        return {
          ...restaurant,
          isScheduledOpenDay,
          isScheduledOpenTime,
          isOpen,
          isActuallyOpen,
        };
      })
      .filter((restaurant) => restaurant.isActuallyOpen)
      .slice(0, limit);

    setRestaurantCache(cacheKey, openRestaurants, 2 * 60 * 1000);

    return openRestaurants;
  }

  async updateRestaurant(
    restaurantId: string,
    updateRestaurantDto: UpdateRestaurantDto,
    file?: Express.Multer.File,
  ) {
    try {
      const dataToUpdate: Prisma.RestaurantUpdateInput = {};

      if (updateRestaurantDto.name)
        dataToUpdate.name = updateRestaurantDto.name;
      if (updateRestaurantDto.email)
        dataToUpdate.email = updateRestaurantDto.email;
      if (updateRestaurantDto.categories)
        dataToUpdate.categories = updateRestaurantDto.categories;
      const contactName =
        updateRestaurantDto.contactName ?? updateRestaurantDto.adminName;
      const contactTel =
        updateRestaurantDto.contactTel ?? updateRestaurantDto.adminTel;
      const contactEmail =
        updateRestaurantDto.contactEmail ?? updateRestaurantDto.adminEmail;
      if (contactName) dataToUpdate.contactName = contactName;
      if (updateRestaurantDto.contactSurname !== undefined)
        dataToUpdate.contactSurname = updateRestaurantDto.contactSurname || '';
      if (contactTel) dataToUpdate.contactTel = contactTel;
      if (contactEmail) dataToUpdate.contactEmail = contactEmail;
      if (updateRestaurantDto.maxActiveOrders !== undefined)
        dataToUpdate.maxActiveOrders = updateRestaurantDto.maxActiveOrders;
      if (updateRestaurantDto.avgCookingTimeMins !== undefined)
        dataToUpdate.avgCookingTimeMins =
          updateRestaurantDto.avgCookingTimeMins;
      if (updateRestaurantDto.bankAccount)
        dataToUpdate.bankType = updateRestaurantDto.bankAccount;
      if (updateRestaurantDto.accountName)
        dataToUpdate.accountName = updateRestaurantDto.accountName;
      if (updateRestaurantDto.accountNumber)
        dataToUpdate.accountNumber = updateRestaurantDto.accountNumber;

      const existingRestaurant = await this.prisma.restaurant.findUnique({
        where: { restaurantId },
        select: { profile: true },
      });

      if (!existingRestaurant) throw new NotFoundException(`ไม่พบร้านอาหาร`);

      if (file) {
        const { url } = await this.uploadService.saveImage(file);
        dataToUpdate.profile = url;

        if (existingRestaurant.profile) {
          const oldR2Key = this.uploadService.extractKeyFromUrl(
            existingRestaurant.profile,
          );
          if (oldR2Key) {
            await this.uploadService.cleanupImage(oldR2Key);
          }
        }
      } else if (updateRestaurantDto.restaurantImg) {
        dataToUpdate.profile = updateRestaurantDto.restaurantImg;
      }

      const result = await this.prisma.restaurant.update({
        where: { restaurantId },
        data: dataToUpdate,
      });

      this.invalidateLists(restaurantId);

      return result;
    } catch (error: any) {
      if (error.code === 'P2025')
        throw new NotFoundException(`ไม่พบร้านอาหารที่มีID: ${restaurantId}`);
      if (error.code === 'P2002')
        throw new BadRequestException(
          'ชื่อร้านอาหารนี้ถูกใช้ไปแล้ว โปรดใช้ชื่อใหม่',
        );
      throw error;
    }
  }

  async updateIsTemporailyClose(
    restaurantId: string,
    updateRestaurantDto: UpdateRestaurantDto,
  ) {
    try {
      const newStatus = updateRestaurantDto.isTemporarilyClosed
        ? Status.SUSPENDED
        : Status.ACTIVE;
      // Only ACTIVE <-> SUSPENDED: an owner must never be able to self-approve a PENDING shop or revive a REMOVED one.
      const current = await this.prisma.restaurant.findUnique({
        where: { restaurantId },
        select: { status: true },
      });
      if (!current) throw new NotFoundException('ไม่พบร้านอาหาร');
      if (
        current.status !== Status.ACTIVE &&
        current.status !== Status.SUSPENDED
      ) {
        throw new ConflictException(
          'ร้านนี้ยังไม่ได้รับการอนุมัติหรือถูกลบแล้ว',
        );
      }
      const result = await this.prisma.restaurant.update({
        where: { restaurantId },
        data: { status: newStatus },
      });

      this.invalidateLists(restaurantId);

      if (updateRestaurantDto.isTemporarilyClosed === true) {
        await this.analyticsService.trackEvent({
          name: EventName.restaurant_closed,
          source: EventSource.restaurant_cms,
          restaurantId,
        });
      }

      if (updateRestaurantDto.isTemporarilyClosed === false) {
        await this.analyticsService.trackEvent({
          name: EventName.restaurant_reopened,
          source: EventSource.restaurant_cms,
          restaurantId,
        });
      }

      return {
        result,
        message: `อัพเดทสถานะเปิด/ปิดชั่วคราวของร้านอาหาร ${result.name} สำเร็จ`,
      };
    } catch (error: any) {
      this.logger.error(
        'Failed to update temporary close status of restaurant',
        error.message,
        error.stack,
      );
      throw error;
    }
  }

  async updateIsAutoAcceptedOrder(
    restaurantId: string,
    updateRestaurantDto: UpdateRestaurantDto,
  ) {
    try {
      const result = await this.prisma.restaurant.update({
        where: { restaurantId },
        data: { isAutoAcceptedOrder: updateRestaurantDto.isAutoAcceptedOrder },
      });

      this.invalidateLists(restaurantId);

      return {
        result,
        message: `อัพเดทสถานะรับออเดอร์อัตโนมัติของร้านอาหาร ${result.name} เป็น ${result.isAutoAcceptedOrder} สำเร็จ`,
      };
    } catch (error: any) {
      this.logger.error(
        'Failed to update auto accept order status of restaurant',
        error.message,
        error.stack,
      );
      throw error;
    }
  }

  async removeRestaurant(restaurantId: string) {
    const orders = await this.prisma.order.findMany({
      where: { restaurantId },
      select: { orderId: true, status: true },
    });

    const activeOrders = orders.filter(
      (order) =>
        order.status === 'receive' ||
        order.status === 'cooking' ||
        order.status === 'ready' ||
        order.status === 'delay',
    );
    if (activeOrders.length > 0)
      throw new BadRequestException(
        'ไม่สามารถลบร้านอาหารในขณะที่ยังมีออเดอร์ค้างอยู่',
      );

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
        },
      });

      await tx.menu.deleteMany({
        where: { restaurantId },
      });

      await tx.restaurantMembership.deleteMany({
        where: { restaurantId },
      });

      return tx.restaurant.delete({
        where: { restaurantId },
      });
    });

    this.invalidateLists(restaurantId);

    return result;
  }

  // ---------------------------------------------------------------- staff membership

  async listMembers(restaurantId: string, status?: MembershipStatus) {
    const rows = await this.prisma.restaurantMembership.findMany({
      where: { restaurantId, ...(status ? { status } : {}) },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        userId: true,
        role: true,
        status: true,
        createdAt: true,
        user: { select: { name: true, email: true } },
      },
    });
    return rows.map(({ user, ...m }) => ({
      ...m,
      name: user.name,
      email: user.email,
    }));
  }

  private async findMember(restaurantId: string, memberId: string) {
    const member = await this.prisma.restaurantMembership.findFirst({
      where: { id: memberId, restaurantId },
    });
    if (!member) throw new NotFoundException('ไม่พบสมาชิก');
    return member;
  }

  async decideMember(
    restaurantId: string,
    memberId: string,
    decision: 'approve' | 'reject',
  ) {
    const member = await this.findMember(restaurantId, memberId);
    if (member.status !== MembershipStatus.PENDING)
      throw new ConflictException('คำขอนี้ถูกดำเนินการไปแล้ว');

    const status =
      decision === 'approve'
        ? MembershipStatus.APPROVED
        : MembershipStatus.REJECTED;
    const { count } = await this.prisma.restaurantMembership.updateMany({
      where: { id: memberId, status: MembershipStatus.PENDING },
      data: { status },
    });
    if (count === 0) throw new ConflictException('คำขอนี้ถูกดำเนินการไปแล้ว');
    return { id: member.id, userId: member.userId, role: member.role, status };
  }

  async removeMember(restaurantId: string, memberId: string) {
    const member = await this.findMember(restaurantId, memberId);
    if (member.role === RestaurantRole.OWNER)
      throw new ConflictException('ไม่สามารถลบเจ้าของร้านได้');

    await this.prisma.restaurantMembership.delete({ where: { id: memberId } });
    return { deleted: true };
  }

  // ---------------------------------------------------------------- hours

  async getRestaurantHours(restaurantId: string) {
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { restaurantId },
      select: { restaurantId: true },
    });
    if (!restaurant) throw new NotFoundException('ไม่พบร้านอาหาร');

    const hours = await this.prisma.restaurantOperatingHour.findMany({
      where: { restaurantId },
      orderBy: { dayOfWeek: 'asc' },
    });

    return hours.map((h) => ({
      dayOfWeek: h.dayOfWeek,
      openMinute: h.openMinute,
      closeMinute: h.closeMinute,
    }));
  }

  async saveRestaurantHours(restaurantId: string, hours: any[]) {
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { restaurantId },
      select: { restaurantId: true },
    });
    if (!restaurant) throw new NotFoundException('ไม่พบร้านอาหาร');

    const validHours = (hours || []).filter(
      (h) =>
        h &&
        h.dayOfWeek &&
        typeof h.openMinute === 'number' &&
        typeof h.closeMinute === 'number' &&
        h.openMinute >= 0 &&
        h.closeMinute <= 1440 &&
        h.openMinute < h.closeMinute,
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.restaurantOperatingHour.deleteMany({
        where: { restaurantId },
      });

      if (validHours.length > 0) {
        await tx.restaurantOperatingHour.createMany({
          data: validHours.map((h) => ({
            restaurantId,
            dayOfWeek: h.dayOfWeek,
            openMinute: Number(h.openMinute),
            closeMinute: Number(h.closeMinute),
          })),
        });
      }
    });

    clearRestaurantCache(`restaurant:${restaurantId}`);
    clearRestaurantCacheByPrefix('restaurants:');

    const saved = await this.prisma.restaurantOperatingHour.findMany({
      where: { restaurantId },
      orderBy: { dayOfWeek: 'asc' },
    });

    return saved.map((h) => ({
      dayOfWeek: h.dayOfWeek,
      openMinute: h.openMinute,
      closeMinute: h.closeMinute,
    }));
  }

  async getHoursWindow(restaurantId: string) {
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { restaurantId },
      select: {
        restaurantId: true,
        canteen: {
          select: {
            name: true,
            operatingHours: {
              orderBy: { dayOfWeek: 'asc' },
            },
            school: {
              select: {
                operatingHours: {
                  orderBy: { dayOfWeek: 'asc' },
                },
              },
            },
          },
        },
      },
    });

    if (!restaurant) throw new NotFoundException('ไม่พบร้านอาหาร');

    const canteenHours = restaurant.canteen?.operatingHours ?? [];
    const schoolHours = restaurant.canteen?.school?.operatingHours ?? [];
    const effectiveHours = canteenHours.length > 0 ? canteenHours : schoolHours;

    let label = 'ทุกวัน 06:00–18:00';
    if (effectiveHours.length > 0) {
      label = summarizeHours(effectiveHours);
    }

    return { label };
  }
}
