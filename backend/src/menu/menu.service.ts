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

export interface MenusWithDisplayPrices {
    menuId: string;
    name: string;
    menuImg?: string;
    price: number;
    restaurantId: string;
    isAvailable: boolean;
    sellPriceDisplay: number;
    platformFeeDisplay?: number;
}

export interface BulkCreateMenuResult {
    message: string;
    createdMenus: Menu[]; // Successfully created menu items
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
    ) { }

    onModuleInit() {
        this.scheduleTempImageCleanup();
        this.logger.log(`Temp image cleanup scheduler initialized`);
    }

    private readonly logger = new Logger('menuService');
    private readonly tempImageStore = new Map<string, { url: string; createdAt: Date }>();

    async createSingleMenu(createMenuDto: CreateMenuDto, file: Express.Multer.File) {
        const existingName = await this.findMenuByName(createMenuDto.name);
        if (existingName)
            throw new BadRequestException(`Menu name ${createMenuDto.name} has already exists`);

        const { url: menuImageUrl } = await this.uploadService.saveImage(file);
        try {
            const newMenu: CreateMenuDto & { menuImg: string } = {
                restaurantId: createMenuDto.restaurantId,
                name: createMenuDto.name,
                price: createMenuDto.price,
                maxDaily: createMenuDto.maxDaily,
                menuImg: menuImageUrl,
                cookingTime: createMenuDto.cookingTime,
                isAvailable: true,
            };

            const result = await this.prisma.menu.create({
                data: newMenu,
            });

            return result;
        } catch (error) {
            this.logger.error(`Failed to create menu ${createMenuDto.name}:`, error);
            throw new InternalServerErrorException(
                'Failed to create menu: ' + error.message,
            );
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
            const { createdMenus, failedCreations } = await this.processMenuCreations(
                menusData,
                existingRestaurant.restaurantId,
            );

            // 4. Format and return the final comprehensive result
            return this.formatResponse(menusData.length, createdMenus, failedCreations);
        } catch (error: any) {
            this.logger.error(`An unexpected error occurred during bulk menu creation for restaurant ${restaurantId}: `, error);
            if (error instanceof BadRequestException || error instanceof ConflictException) {
                throw error;
            }

            throw new InternalServerErrorException('Failed to perform bulk menu creation due to an internal server error. Please try again.');
        }
    }

    private async validateBulkInput(restaurantId: string, menusData: CsvMenuItemData[]) {
        if (!restaurantId) throw new BadRequestException('Restaurant ID is required.');
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
                `Duplicate menu names found within the batch: ${[...new Set(duplicateNamesInBatch)].join(', ')}. ` +
                `Each menu name must be unique within the batch.`,
            );
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
                `The following menu names already exist for restaurant ${restaurantId}: ${duplicateNamesInDb.join(', ')}. ` +
                `Menu names must be unique per restaurant.`,
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

    private async processMenuCreations(
        menusData: CsvMenuItemData[],
        restaurantId: string,
    ) {
        const createdMenus: Menu[] = [];
        const failedCreations: { item: CsvMenuItemData; error: string }[] = [];

        for (const [, dto] of menusData.entries()) {
            try {

                const imageData = this.tempImageStore.get(dto.menuImgTempId);
                if (!imageData) throw new BadRequestException(`Image not found for tempId: ${dto.menuImgTempId}`);

                const menuDataToCreate = {
                    name: dto.name,
                    // description: dto.description,
                    price: dto.price,
                    maxDaily: dto.maxDaily,
                    cookingTime: dto.cookingTime ?? 5,
                    isAvailable: dto.isAvailable,
                    menuImg: imageData.url,
                    restaurant: {
                        connect: {
                            restaurantId: restaurantId,
                        },
                    },
                };
                const createdMenu = await this.prisma.menu.create({ data: menuDataToCreate });
                createdMenus.push(createdMenu);
            } catch (itemError: any) {
                this.logger.error(
                    `Failed to create menu item "${dto.name}" (Original file: ${dto.originalFileName || 'N/A'}): `,
                    itemError.message,
                    itemError.stack,
                );
                failedCreations.push({ item: dto, error: itemError.message });
            }
        }
        return { createdMenus, failedCreations };
    }

    private formatResponse(
        totalAttempted: number,
        createdMenus: Menu[],
        failedCreations: { item: CsvMenuItemData; error: string }[],
    ): BulkCreateMenuResult {
        const totalCreated = createdMenus.length;
        const totalFailed = failedCreations.length;

        let responseMessage = `Bulk menu creation completed. `;
        if (totalFailed > 0) {
            const failedNames = failedCreations.map((f) => f.item.name).join(', ');
            responseMessage += `Created: ${totalCreated}, Failed: ${totalFailed}. Failed items: ${failedNames}.`;
        } else {
            responseMessage += `All ${totalCreated} menus were successfully created.`;
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

    async findMenuByName(name: string) {
        const menu = await this.prisma.menu.findUnique({
            where: {
                name,
            },
        });

        return menu;
    }

    private calculateDisplayPrice(menu: Partial<Menu>): {
        sellPriceDisplay: number;
        platformFeeDisplay: number;
    } {
        if (!menu.price)
            throw new NotFoundException(
                'Cannot find menu price, cannot calculate display price',
            );
        const markup = new Decimal(Number(process.env.SELL_PRICE_MARKUP_RATE));
        const rate = new Decimal(Number(process.env.PLATFORM_COMMISSION_RATE));

        const priceInSatang = new Decimal(menu.price);
        const sellingPriceInSatang = priceInSatang.times(
            new Decimal(1).plus(markup),
        );
        const platformFeeInSatang = sellingPriceInSatang.times(rate);

        return {
            sellPriceDisplay: sellingPriceInSatang.toNumber(),
            platformFeeDisplay: platformFeeInSatang.toNumber(),
        };
    }

    async getRestaurantMenusDisplay(
        restaurantId: string,
    ): Promise<MenusWithDisplayPrices[]> {
        try {
            const menus = await this.prisma.menu.findMany({
                where: {
                    restaurantId,
                },
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
            });

            const menusWithCalculatedPrices: MenusWithDisplayPrices[] = menus.map(
                (menu) => {
                    const displayPrices = this.calculateDisplayPrice(menu);
                    return {
                        ...menu,
                        menuImg: menu.menuImg ?? undefined,
                        sellPriceDisplay: displayPrices.sellPriceDisplay,
                        // platformFeeDisplay: displayPrices.platformFeeDisplay,
                    };
                },
            );

            return menusWithCalculatedPrices;
        } catch (error) {
            this.logger.error(
                'An error occurred while fetching restaurant menus with display prices:',
                error,
            );
            throw new InternalServerErrorException('ค้นหาเมนูขัดข้อง');
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
            if (error.code === 'P2025') {
                // Prisma "Record not found"
                throw new NotFoundException(`ไม่พบออเดอร์ที่มีID: ${menuId}`);
            }

            throw error;
        }
    }

    private async isOwnerOfMultipleMenus(restaurantId: string, menuIds: string[]) {
        await this.restaurantService.findRestaurant(restaurantId);
        const ownedAndExistingMenus = await this.prisma.menu.findMany({
            where: {
                menuId: { in: menuIds },
                restaurantId,
            },
            select: { menuId: true, restaurantId: true },
        });

        if (ownedAndExistingMenus.length !== menuIds.length) {
            const foundOwnedMenuids = new Set(
                ownedAndExistingMenus.map((menu) => menu.menuId),
            );
            const problematicMenuIds = menuIds.filter(
                (id) => !foundOwnedMenuids.has(id),
            );

            const allRequestMenus = await this.prisma.menu.findMany({
                where: { menuId: { in: problematicMenuIds } },
                select: { menuId: true, restaurantId: true },
            });

            if (allRequestMenus.length === 0) {
                throw new NotFoundException(
                    'The following menus were not found: ',
                    problematicMenuIds.join(', '),
                );
            } else {
                throw new ForbiddenException(
                    `The following menus exist but do not belong to restaurant "${restaurantId}": ${problematicMenuIds.join(', ')}.`,
                );
            }
        }
    }

    omitUnchangedFields<T extends object>(
        original: T,
        updates: Partial<T>,
    ): Partial<T> {
        const changedFields: Partial<T> = {};

        for (const key in updates) {
            if (updates[key] !== undefined && updates[key] !== original[key]) {
                changedFields[key] = updates[key];
            }

            if (
                key === 'menuImg' &&
                typeof updates[key] === 'string' &&
                updates[key] === '/'
            ) {
                continue;
            }
        }

        return changedFields;
    }

    async updateMenu(menuId: string, updateMenuDto: UpdateMenuDto, file?: Express.Multer.File) {
        const results: Menu[] = [];

        this.isOwnerOfSingleMenu(updateMenuDto.restaurantId, menuId);

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

        const result = await this.prisma.menu.update({
            where: { menuId },
            data: updateData,
        });

        results.push(result);

        return results;
    }

    async bulkUpdateMenus(
        menuIds: string[],
        updateDtos: UpdateMenuDto[],
        files?: Express.Multer.File[],
    ) {
        if (menuIds.length !== updateDtos.length) {
            throw new BadRequestException(
                'The number of menu IDs must match the number of update payloads.',
            );
        }

        // --- 1. Upload images optionally and concurrently
        const imageUrl = await this.uploadService.saveOptionalBulkImages(files);

        // 2. Prepare the updates with the new image URLs
        const updates = updateDtos.map((dto, index) => {
            const menuImgUrl = imageUrl[index].url;

            if (menuImgUrl) {
                dto.menuImg = menuImgUrl;
            }

            return {
                where: { menuId: menuIds[index] },
                data: dto,
            };
        });

        try {
            const updatePromises = updates.map(update =>
                this.prisma.menu.update(update),
            );

            return await this.prisma.$transaction(updatePromises);
        } catch (error) {
            this.logger.error('Failed to perform bulk menu update in transaction:', error);
            throw new InternalServerErrorException('A transaction failed during bulk menu update. No changes were applied.');
        }
    }

    private async isOwnerOfSingleMenu(restaurantId: string, menuId: string) {
        await this.restaurantService.findRestaurant(restaurantId);
        const isOwner = await this.prisma.menu.findUnique({
            where: {
                menuId,
                restaurantId,
            },
        });

        if (!isOwner) throw new BadRequestException(`You are not the owner of the menu or restaurant`);
    }

    async updateIsAvailable(menuId: string, updateMenuDto: UpdateMenuDto) {
        try {
            await this.isOwnerOfSingleMenu(updateMenuDto.restaurantId, menuId);

            const result = await this.prisma.menu.update({
                where: { menuId },
                data: {
                    isAvailable: updateMenuDto.isAvailable,
                },
            });

            return {
                result,
                message: `Sucessfully update availability of menu ${result.name} to be ${result.isAvailable}`,
            };
        } catch (error) {
            this.logger.error(
                `An unexpected error occurred during update menu isavailable`,
                error,
            );
            throw new InternalServerErrorException(
                'Failed to update isAvailable state of menu',
            );
        }
    }

    async removeMenu(menuId: string) {
        return this.prisma.menu.delete({
            where: { menuId },
        });
    }
}