import {
    Injectable,
    Inject,
    OnModuleInit,
    forwardRef,
    NotFoundException,
    ConflictException,
    InternalServerErrorException,
    BadRequestException,
    ForbiddenException,
    Logger,
} from '@nestjs/common';
import { CreateMenuDto, CsvMenuItemData } from './dto/create-menu.dto';
import { UpdateMenuDto } from './dto/update-menu.dto';
import { PrismaService } from '../prisma/prisma.service';
import { RestaurantService } from 'src/restaurant/restaurant.service';
import { Menu } from '@prisma/client';
import Decimal from 'decimal.js';
import { UploadService } from 'src/upload/upload.service';
import { randomUUID } from 'crypto';
import { InventoryService } from 'src/inventory/inventory.service';
import { clearMenuCache, clearMenuQuotaCache, getMenuCache, getMenuQuotaCache, setMenuCache, setMenuQuotaCache } from './menuCache';
import { DEFAULT_FALLBACK_IMG_URL } from 'src/constant/image';

export interface MenusWithDisplayPrices {
    menuId: string;
    name: string;
    menuImg?: string;
    price: number;
    restaurantId: string;
    maxDaily: number;
    isAvailable: boolean;
    sellPriceDisplay: number;
    platformFeeDisplay?: number;
}

export interface BulkCreateMenuResult {
    message: string;
    createdMenus: Menu[];
    failedMenus: { item: CsvMenuItemData; error: string }[]; // Items that failed with their original data and error
    totalAttempted: number;
    totalCreated: number;
    totalFailed: number;
}

@Injectable()
export class MenuService implements OnModuleInit {
    constructor(
        private readonly prisma: PrismaService,
        @Inject(forwardRef(() => RestaurantService))
        private readonly restaurantService: RestaurantService,
        private readonly uploadService: UploadService,
        @Inject(forwardRef(() => InventoryService))
        private readonly inventoryService: InventoryService,
    ) { }

    onModuleInit() {
        this.scheduleTempImageCleanup();
        this.logger.log(`Temp image cleanup scheduler initialized`);
    }

    private readonly logger = new Logger('menuService');
    private pendingMenuRequest = new Map<string, Promise<MenusWithDisplayPrices[]>>();
    private readonly tempImageStore = new Map<string, { url: string; createdAt: Date }>();
    private readonly MENU_CACHE_TTL_MS = 10 * 60 * 1000;
    private readonly QUOTA_CACHE_TTL_MS = 5 * 1000;
    private markupRate = new Decimal(process.env.SELL_PRICE_MARKUP_RATE ?? '0');
    private commissionRate = new Decimal(process.env.PLATFORM_COMMISSION_RATE ?? '0');

    private getMenuCacheKey(restaurantId: string): string {
        return `menus:restaurant:${restaurantId}`;
    }

    private getMenuQuotaCacheKey(restaurantId: string): string {
        return `menuQuota:restaurant:${restaurantId}`;
    }

    private invalidateRestaurantMenuCache(restaurantId: string): void {
        const menuCacheKey = this.getMenuCacheKey(restaurantId);
        const quotaCacheKey = this.getMenuQuotaCacheKey(restaurantId);
        clearMenuCache(menuCacheKey);
        clearMenuQuotaCache(quotaCacheKey);

        this.pendingMenuRequest.delete(menuCacheKey);
    }

    async createSingleMenu(createMenuDto: CreateMenuDto, file: Express.Multer.File) {
        const existingName = await this.checkDuplicateMenuNameInRestaurant(createMenuDto.name, createMenuDto.restaurantId);
        if (existingName) throw new BadRequestException(`เมนู ${createMenuDto.name} มีอยู่แล้ว`);

        const menuImgUrl = file ? (await this.uploadService.saveImage(file)).url : DEFAULT_FALLBACK_IMG_URL;
        try {
            const newMenu: CreateMenuDto & { menuImg: string } = {
                restaurantId: createMenuDto.restaurantId,
                name: createMenuDto.name,
                price: createMenuDto.price,
                maxDaily: createMenuDto.maxDaily,
                menuImg: menuImgUrl,
                cookingTime: createMenuDto.cookingTime,
                isAvailable: true,
            };

            const result = await this.prisma.menu.create({
                data: newMenu,
            });

            this.invalidateRestaurantMenuCache(createMenuDto.restaurantId);

            return result;
        } catch (error) {
            this.logger.error(`Failed to create menu ${createMenuDto.name}:`, error);
            throw new InternalServerErrorException('สร้างเมนูล้มเหลว: ' + error.message);
        }
    }

    async createBulkMenus(
        restaurantId: string,
        menusData: CsvMenuItemData[],
    ): Promise<BulkCreateMenuResult> {
        try {
            // 1. Validate inputs and check for duplicate names
            const existingRestaurant = await this.validateBulkInput(restaurantId, menusData);

            // 3. Process each menu item and create database records
            const { createdMenus, failedCreations } = await this.processMenuCreations(menusData, existingRestaurant.restaurantId);

            this.invalidateRestaurantMenuCache(restaurantId);

            // 4. Format and return the final comprehensive result
            return this.formatResponse(menusData.length, createdMenus, failedCreations);
        } catch (error: any) {
            this.logger.error(`สร้างหลายเมนูพร้อมกันล้มเหลว ${restaurantId}: `, error);
            if (error instanceof BadRequestException || error instanceof ConflictException) {
                throw error;
            }

            throw new InternalServerErrorException('เซิฟเวอร์ขัดข้อง กรุณาลองใหม่');
        }
    }

    private async validateBulkInput(restaurantId: string, menusData: CsvMenuItemData[]) {
        if (!restaurantId) throw new BadRequestException('ไม่พบไอดีร้านอาหาร.');
        const existingRestaurant = await this.restaurantService.findRestaurant(restaurantId);

        const newMenuNames = menusData.map((dto) => dto.name);
        await this.checkDuplicateNames(newMenuNames, restaurantId);

        return existingRestaurant;
    }

    private async checkDuplicateNames(newMenuNames: string[], restaurantId: string): Promise<void> {
        // Check for Duplicates Within the Incoming Batch
        const uniqueNewMenuNames = new Set(newMenuNames);
        if (uniqueNewMenuNames.size !== newMenuNames.length) {
            const duplicateNamesInBatch = newMenuNames.filter(
                (name, index) => newMenuNames.indexOf(name) !== index,
            );

            throw new ConflictException(
                `พบเมนูซ้ำดังต่อไปนี้: ${[...new Set(duplicateNamesInBatch)].join(', ')}. ` +
                `ชื่อเมนูในร้านต้องไม่ซ้ำกัน`);
        }

        const existingMenusWithSameNames = await this.prisma.menu.findMany({
            where: {
                name: { in: newMenuNames },
                restaurantId: restaurantId,
            },
            select: { name: true },
        });

        if (existingMenusWithSameNames.length > 0) {
            const duplicateNamesInDb = existingMenusWithSameNames.map((menu) => menu.name);
            throw new ConflictException(
                `เมนูดังต่อไปนี้มีอยู่แล้ว: ${duplicateNamesInDb.join(', ')}. ` +
                `ชื่อเมนูในร้านต้องไม่ซ้ำกัน`,
            );
        }
    }

    generateTempId(): string {
        return `temp_${randomUUID()}`;
    }

    uploadTempImages(files: Express.Multer.File[]) {
        return Promise.all(files.map(async (file) => {
            const tempId = this.generateTempId();
            const { url } = await this.uploadService.saveImage(file);
            this.tempImageStore.set(tempId, { url, createdAt: new Date() }); // store for later use

            return { originalName: file.originalname, tempId, url };
        }));
    }

    private scheduleTempImageCleanup() {
        const interval = 1000 * 60 * 2; // cleanup every 2 minutes
        const maxLifetimeMs = 1000 * 60 * 10; // max 10 mins

        setInterval(() => {
            const now = Date.now();
            for (const [tempId, data] of this.tempImageStore.entries()) {
                if (now - data.createdAt.getTime() > maxLifetimeMs) {
                    this.tempImageStore.delete(tempId);
                }
            }
        }, interval);
    }

    private async processMenuCreations(menusData: CsvMenuItemData[], restaurantId: string) {
        const results = await Promise.all(
            menusData.map(async (dto) => {
                try {
                    const imageData = this.tempImageStore.get(dto.menuImgTempId);
                    if (!imageData) throw new BadRequestException(`ไม่พบรูปภาพ: ${dto.menuImgTempId}`);

                    const menuDataToCreate = {
                        name: dto.name,
                        // description: dto.description,
                        price: dto.price,
                        maxDaily: dto.maxDaily,
                        cookingTime: dto.cookingTime ?? 5,
                        isAvailable: dto.isAvailable,
                        menuImg: imageData.url,
                        restaurant: { connect: { restaurantId: restaurantId } },
                    };
                    const createdMenu = await this.prisma.menu.create({ data: menuDataToCreate });

                    return {
                        success: true as const,
                        menu: createdMenu,
                    }
                } catch (itemError: any) {
                    this.logger.error(
                        `Failed to create menu item "${dto.name}" (Original file: ${dto.originalFileName || 'N/A'}): `,
                        itemError.message,
                        itemError.stack,
                    );

                    return {
                        success: false as const,
                        error: itemError.message,
                        item: dto,
                    };
                }
            }),
        );

        const createdMenus: Menu[] = [];
        const failedCreations: { item: CsvMenuItemData; error: string }[] = [];

        for (const result of results) {
            if (result.success) {
                createdMenus.push(result.menu);
            } else {
                failedCreations.push({
                    item: result.item,
                    error: result.error,
                });
            }
        }

        return { createdMenus, failedCreations }
    }

    private formatResponse(
        totalAttempted: number,
        createdMenus: Menu[],
        failedCreations: { item: CsvMenuItemData; error: string }[],
    ): BulkCreateMenuResult {
        const totalCreated = createdMenus.length;
        const totalFailed = failedCreations.length;

        let responseMessage = `สร้างหลายเมนูสำเร็จ `;
        if (totalFailed > 0) {
            const failedNames = failedCreations.map((f) => f.item.name).join(', ');
            responseMessage += `เพิ่ม: ${totalCreated}, ล้มเหลว: ${totalFailed} เมนูดังนี้: ${failedNames}.`;
        } else {
            responseMessage += `${totalCreated} เมนู`;
        }

        return {
            message: responseMessage,
            createdMenus: createdMenus,
            failedMenus: failedCreations,
            totalAttempted,
            totalCreated,
            totalFailed,
        };
    }

    async checkDuplicateMenuNameInRestaurant(name: string, restaurantId: string) {
        const menu = await this.prisma.menu.findFirst({
            where: {
                name: {
                    equals: name,
                    mode: 'insensitive',
                },
                restaurantId,
            },
        });

        return menu;
    }

    private calculateDisplayPrice(menu: Pick<Menu, 'price'>) {
        if (menu.price === null) throw new NotFoundException('ไม่สามารถคำนวณราคาของเมนูได้');

        const priceInSatang = new Decimal(menu.price);
        const sellingPriceInSatang = priceInSatang.times(new Decimal(1).plus(this.markupRate));
        const platformFeeInSatang = sellingPriceInSatang.times(this.commissionRate);

        return {
            sellPriceDisplay: sellingPriceInSatang.toNumber(),
            platformFeeDisplay: platformFeeInSatang.toNumber(),
        };
    }

    async getRestaurantMenusDisplay(restaurantId: string): Promise<MenusWithDisplayPrices[]> {
        const cacheKey = this.getMenuCacheKey(restaurantId);
        const quotaCacheKey = this.getMenuQuotaCacheKey(restaurantId);

        const cachedMenus = getMenuCache(cacheKey);
        if (cachedMenus) {
            this.logger.debug(`Menu cache hit for key: ${cacheKey}`);

            const menuIds = cachedMenus.map(m => m.menuId);
            let quotas = getMenuQuotaCache(quotaCacheKey);

            if (quotas) {
                this.logger.debug(`Quota cache hit for key: ${quotaCacheKey}`);
            } else {
                quotas = await this.inventoryService.getRemainingQuotas(menuIds);
                setMenuQuotaCache(quotaCacheKey, quotas, this.QUOTA_CACHE_TTL_MS);
            }

            return cachedMenus.map(menu => {
                const remainingQuota = quotas[menu.menuId] ?? menu.maxDaily;

                return {
                    ...menu,
                    isOrderable: menu.isAvailable && remainingQuota > 0,
                };
            });
        }

        const pending = this.pendingMenuRequest.get(cacheKey);
        if (pending) {
            this.logger.debug(`Reusing pending menu request for key: ${cacheKey}`);
            return pending;
        }

        const requestPromise = (async () => {
            const dbMenus = await this.prisma.menu.findMany({
                where: { restaurantId },
                select: {
                    menuId: true,
                    name: true,
                    menuImg: true,
                    price: true,
                    restaurantId: true,
                    isAvailable: true,
                    cookingTime: true,
                    maxDaily: true,
                },
                orderBy: {
                    name: "asc"
                },
            });

            const menuIds = dbMenus.map(m => m.menuId);
            let quotas = getMenuQuotaCache(quotaCacheKey);

            if (quotas) {
                this.logger.debug(`Quota cache hit for key: ${quotaCacheKey}`);
            } else {
                quotas = await this.inventoryService.getRemainingQuotas(menuIds);
                setMenuQuotaCache(quotaCacheKey, quotas, this.QUOTA_CACHE_TTL_MS);
            }

            const menus = dbMenus.map(menu => {
                const displayPrices = this.calculateDisplayPrice(menu);
                const remainingQuota = quotas[menu.menuId] ?? menu.maxDaily;

                return {
                    ...menu,
                    menuImg: menu.menuImg ?? undefined,
                    sellPriceDisplay: displayPrices.sellPriceDisplay,
                    isOrderable: menu.isAvailable && remainingQuota > 0
                };
            });

            setMenuCache(cacheKey, menus, this.MENU_CACHE_TTL_MS);

            return menus;
        })();

        this.pendingMenuRequest.set(cacheKey, requestPromise);

        try {
            return await requestPromise;
        } finally {
            this.pendingMenuRequest.delete(cacheKey);
        }
    }

    async findMenu(menuId: string) {
        try {
            const menu = await this.prisma.menu.findUnique({
                where: { menuId },
            });

            if (!menu) throw new Error('ไม่พบเมนูที่ค้นหา');

            await this.restaurantService.findRestaurant(menu.restaurantId);
            return menu;
        } catch (error) {
            if (error.code === 'P2025') throw new NotFoundException(`ไม่พบออเดอร์ที่มีID: ${menuId}`); // Prisma "Record not found"

            throw error;
        }
    }

    private async isOwnerOfMultipleMenus(restaurantId: string, menuIds: string[]) {
        if (menuIds.length === 0) throw new BadRequestException("ไม่พบเมนูไอดี");

        await this.restaurantService.findRestaurant(restaurantId);

        const allMenus = await this.prisma.menu.findMany({
            where: { menuId: { in: menuIds } },
            select: { menuId: true, restaurantId: true, name: true },
        });

        if (allMenus.length !== menuIds.length) {
            const foundMenuIds = new Set(allMenus.map(menu => menu.menuId));
            const notFoundMenuIds = menuIds.filter(id => !foundMenuIds.has(id));

            if (notFoundMenuIds.length > 0) throw new NotFoundException(`ไม่พบเมนูดังนี้: ${notFoundMenuIds.join(", ")}`);
        }

        const unauthorizedMenus = allMenus.filter(
            menu => menu.restaurantId !== restaurantId
        );

        if (unauthorizedMenus.length > 0) {
            const unauthorizedMenuName = unauthorizedMenus.map(menu => menu.name);

            throw new ForbiddenException(`เมนูดังต่อไปนี้เป็นของร้านอื่น: ${unauthorizedMenuName.join(", ")}`);
        }
    }

    omitUnchangedFields<T extends object>(original: T, updates: Partial<T>): Partial<T> {
        const changedFields: Partial<T> = {};

        for (const key in updates) {
            if (updates[key] !== undefined && updates[key] !== original[key]) changedFields[key] = updates[key];

            if (key === 'menuImg' && typeof updates[key] === 'string' && updates[key] === '/') continue
        }

        return changedFields;
    }

    async updateMenu(menuId: string, updateMenuDto: UpdateMenuDto, file?: Express.Multer.File) {
        const results: Menu[] = [];

        await this.isOwnerOfSingleMenu(updateMenuDto.restaurantId, menuId);

        const existingMenu = await this.findMenu(menuId);
        const updateData = this.omitUnchangedFields(existingMenu, updateMenuDto);

        // filter undefined explicitly
        Object.keys(updateData).forEach((key) => {
            if (updateData[key] === undefined) {
                delete updateData[key];
            }
        });

        if (file) {
            const { url } = await this.uploadService.saveImage(file);
            updateData.menuImg = url;
        }

        const result = await this.prisma.$transaction(async (tx) => {
            const updatedMenu = await tx.menu.update({
                where: { menuId },
                data: updateData,
            });

            if (updateData.maxDaily !== undefined) await this.inventoryService.syncInventoryQuotaTx(tx, menuId, updateData.maxDaily);

            return updatedMenu;
        });

        this.invalidateRestaurantMenuCache(existingMenu.restaurantId);
        results.push(result);

        return results;
    }

    async bulkUpdateMenus(
        menuIds: string[],
        updateDtos: UpdateMenuDto[],
        files?: Express.Multer.File[],
    ) {
        if (menuIds.length !== updateDtos.length) throw new BadRequestException('เมนูไอดีไม่ถูกต้อง');

        const restaurantId = updateDtos[0].restaurantId;
        await this.isOwnerOfMultipleMenus(restaurantId, menuIds)

        // Upload images optionally and concurrently
        const imageUrl = await this.uploadService.saveOptionalBulkImages(files);

        // Prepare the updates with the new image URLs
        const updates = updateDtos.map((dto, index) => {
            const menuImgUrl = imageUrl[index].url;

            if (menuImgUrl) dto.menuImg = menuImgUrl;

            return {
                where: { menuId: menuIds[index] },
                data: dto,
            };
        });

        try {
            const updatePromises = updates.map(update => this.prisma.menu.update(update));

            const result = await this.prisma.$transaction(updatePromises);

            this.invalidateRestaurantMenuCache(restaurantId);
            return result;
        } catch (error) {
            this.logger.error('Failed to perform bulk menu update in transaction:', error);
            throw new InternalServerErrorException('อัพเดทหลายเมนูล้มเหลว ไม่มีการแก้ไขเมนูใดๆ');
        }
    }

    private async isOwnerOfSingleMenu(restaurantId: string, menuId: string) {
        await this.restaurantService.findRestaurant(restaurantId);
        const isOwner = await this.prisma.menu.findFirst({
            where: {
                menuId,
                restaurantId,
            },
        });

        if (!isOwner) throw new BadRequestException(`คุณไม่ใช่ผู้ดูแลของร้านนี้`);
    }

    async updateIsAvailable(menuId: string, updateMenuDto: UpdateMenuDto) {
        try {
            await this.isOwnerOfSingleMenu(updateMenuDto.restaurantId, menuId);

            const result = await this.prisma.menu.update({
                where: { menuId },
                data: { isAvailable: updateMenuDto.isAvailable },
            });

            this.invalidateRestaurantMenuCache(updateMenuDto.restaurantId);

            return {
                result,
                message: `อัพเดทสถานะเมนู ${result.name} ให้เป็น ${result.isAvailable} สำเร็จ`,
            };
        } catch (error) {
            this.logger.error(`An unexpected error occurred during update menu isavailable`, error);
            throw new InternalServerErrorException('อัพเดทสถานะเมนูล้มเหลว');
        }
    }

    async removeMenu(menuId: string) {
        const restaurant = await this.prisma.menu.findUnique({
            where: { menuId },
            select: { restaurantId: true }
        });

        const result = await this.prisma.menu.delete({
            where: { menuId },
        });

        if (restaurant?.restaurantId) {
            this.invalidateRestaurantMenuCache(restaurant.restaurantId);
        }
        return result
    }
}