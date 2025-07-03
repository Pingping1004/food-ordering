import { Injectable, Inject, forwardRef, NotFoundException, ConflictException, InternalServerErrorException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { CreateMenuDto } from './dto/create-menu.dto';
import { UpdateMenuDto } from './dto/update-menu.dto';
import { PrismaService } from 'prisma/prisma.service';
import { RestaurantService } from 'src/restaurant/restaurant.service';
import { Menu } from '@prisma/client';
import Decimal from 'decimal.js';
import { numberRound } from 'src/utils/round-number';
import { UploadService } from 'src/upload/upload.service';

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

export interface CsvMenuItemData {
  name: string;
  description: string; // Ensure your Prisma Menu model has this field
  price: number;
  maxDaily: number;
  cookingTime: number;
  isAvailable: boolean; // Ensure your Prisma Menu model has this field
  imageFileName: string; // This is the temporary ID (UUID.ext) from the initial image upload
  originalFileName: string; // The user's original filename, for reference/logging
}

@Injectable()
export class MenuService {
  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => RestaurantService))
    private restaurantService: RestaurantService,
    private uploadService: UploadService,
  ) { }

  async createMenu(
    restaurantId: string,
    createMenuDto: CreateMenuDto[],
    files?: Express.Multer.File | Express.Multer.File[]
  ) {
    try {
      if (!restaurantId) throw new BadRequestException('RestaurantId is required');
      const existingRestaurant = await this.restaurantService.findRestaurant(restaurantId);

      const newMenuNames = createMenuDto.map(dto => dto.name);
      // 2a. Check for duplicates *within the incoming batch itself*
      const uniqueNewMenuNames = new Set(newMenuNames);
      if (uniqueNewMenuNames.size !== newMenuNames.length) {
        const duplicateNamesInBatch = newMenuNames.filter((name, index) => newMenuNames.indexOf(name) !== index);
        throw new ConflictException(
          `Duplicate menu names found within the batch: ${[...new Set(duplicateNamesInBatch)].join(', ')}. ` +
          `Each menu name in a bulk creation request must be unique.`
        );
      }

      // 2b. Check against existing menu names in the database for THIS restaurant
      const existingMenusWithSameNames = await this.prisma.menu.findMany({
        where: {
          name: { in: newMenuNames }, // Check if any of the new names exist in DB
          restaurantId: restaurantId, // IMPORTANT: Scope to the current restaurant
        },
        select: { name: true }, // Only retrieve the name for the check
      });

      if (existingMenusWithSameNames.length > 0) {
        const duplicateNamesInDb = existingMenusWithSameNames.map(menu => menu.name);
        throw new ConflictException(
          `The following menu names already exist for restaurant ${restaurantId}: ${duplicateNamesInDb.join(', ')}. ` +
          `Menu names must be unique per restaurant.`
        );
      }

      // 3. Check for different restaurantId
      const differentRestaurantId = createMenuDto.filter(dto => dto.restaurantId !== undefined && dto.restaurantId !== restaurantId);
      if (differentRestaurantId.length > 0) {
        const inconsistentIds = [...new Set(differentRestaurantId.map(m => m.name))];
        throw new BadRequestException(
          `Menu (${inconsistentIds.join(', ')}) ` +
          `have restaurantId that does not match the authenticated restaurant ID (${restaurantId}). ` +
          `All menus in a bulk creation must belong to the authenticated restaurant.`
        )
      }

      const menuLists = createMenuDto.map(async (dto, index) => {
        const file = files && files[index];

        let menuImgUrl: string | undefined;
        if (file) {
          menuImgUrl = `uploads/menus/${file.filename};`
        } else if (dto.menuImg) {
          menuImgUrl = dto.menuImg;
        }

        const newMenuLists = {
          name: dto.name,
          price: dto.price,
          maxDaily: dto.maxDaily,
          cookingTime: dto.cookingTime ?? existingRestaurant.avgCookingTime ?? 5,
          menuImg: menuImgUrl,

          restaurant: {
            connect: {
              restaurantId: existingRestaurant.restaurantId,
            },
          },
        };

        const createdMenus = await this.prisma.menu.create({
          data: newMenuLists,
        });

        return createdMenus
      });

      const results = await Promise.all(menuLists);
      console.log(`Bulk menu creation successful for restaurant ${restaurantId}. Created menus:`, results.map(m => m.name)); // Log menu names for brevity
      return {
        message: `Menus created successfully for restaurant ${restaurantId}`,
        results: results,
        fileInfos: files, // Optionally return information about processed files
      };
    } catch (error) {
      console.error(`Failed to create menus for ${restaurantId}: `, error);
      throw error;
    }
  }

  async createBulkMenus( // Renamed from createMenu for clarity
    restaurantId: string,
    menusData: CsvMenuItemData[], // Now expects an array of CsvMenuItemData
  ): Promise<{ message: string; results: Menu[] }> {
    try {
      if (!restaurantId) {
        throw new BadRequestException('Restaurant ID is required.');
      }
      const existingRestaurant = await this.restaurantService.findRestaurant(restaurantId);
      if (!existingRestaurant) {
        throw new BadRequestException(`Restaurant with ID ${restaurantId} not found.`);
      }

      const newMenuNames = menusData.map(dto => dto.name);

      // 1. Check for duplicates *within the incoming batch itself*
      const uniqueNewMenuNames = new Set(newMenuNames);
      if (uniqueNewMenuNames.size !== newMenuNames.length) {
        const duplicateNamesInBatch = newMenuNames.filter((name, index) => newMenuNames.indexOf(name) !== index);
        throw new ConflictException(
          `Duplicate menu names found within the batch: ${[...new Set(duplicateNamesInBatch)].join(', ')}. ` +
          `Each menu name in a bulk creation request must be unique within the batch.`
        );
      }

      // 2. Check against existing menu names in the database for THIS restaurant
      const existingMenusWithSameNames = await this.prisma.menu.findMany({
        where: {
          name: { in: newMenuNames },
          restaurantId: restaurantId, // IMPORTANT: Scope to the current restaurant
        },
        select: { name: true },
      });

      if (existingMenusWithSameNames.length > 0) {
        const duplicateNamesInDb = existingMenusWithSameNames.map(menu => menu.name);
        throw new ConflictException(
          `The following menu names already exist for restaurant ${restaurantId}: ${duplicateNamesInDb.join(', ')}. ` +
          `Menu names must be unique per restaurant.`
        );
      }

      // The check for `differentRestaurantId` is removed because the `restaurantId`
      // for the entire bulk operation is now provided as a parameter,
      // ensuring all items belong to the same restaurant.

      const createdMenuResults: Menu[] = [];
      const failedCreations: { menuData: CsvMenuItemData; error: string }[] = [];

      // Use a for...of loop to correctly await asynchronous operations for each menu item
      for (const dto of menusData) {
        let menuImgUrl: string | undefined;

        try {
          // Process image: Move from temporary storage to permanent storage
          if (dto.imageFileName) {
            // `imageFileName` is the temporary ID (UUID.ext) assigned during the initial upload
            menuImgUrl = await this.uploadService.moveTempImageToPermanent(dto.imageFileName);
          } else {
            // If `imageFileName` is not provided in the CSV, no image will be linked.
            menuImgUrl = undefined;
          }

          // Prepare data for Prisma creation
          const menuDataToCreate = {
            name: dto.name,
            description: dto.description,
            price: dto.price,
            maxDaily: dto.maxDaily,
            // Use restaurant's average cooking time as fallback if not provided or invalid
            cookingTime: dto.cookingTime ?? existingRestaurant.avgCookingTime ?? 5,
            isAvailable: dto.isAvailable,
            menuImg: menuImgUrl, // Use the public URL of the permanently stored image

            restaurant: {
              connect: {
                restaurantId: existingRestaurant.restaurantId, // Link to the current restaurant
              },
            },
          };

          const createdMenu = await this.prisma.menu.create({
            data: menuDataToCreate,
          });

          createdMenuResults.push(createdMenu);

        } catch (itemError: any) {
          // Log errors for individual items and collect them
          console.error(
            `Failed to create menu item "${dto.name}" (Original file: ${dto.originalFileName}): `,
            itemError.message
          );
          failedCreations.push({ menuData: dto, error: itemError.message });
          // Note: If an image was successfully moved but DB creation failed,
          // the permanent image might become "orphaned." A separate cleanup process
          // (e.g., a scheduled job) is often used to manage such scenarios.
        }
      }

      if (failedCreations.length > 0) {
        const failedNames = failedCreations.map(f => f.menuData.name).join(', ');
        console.warn(`Partial bulk menu creation for restaurant ${restaurantId}. Failed items: ${failedNames}`);
        // You might consider returning a more detailed response here,
        // e.g., an array of successes and an array of failures.
      }

      console.log(`Bulk menu creation successful for restaurant ${restaurantId}. Created ${createdMenuResults.length} menus, failed ${failedCreations.length}.`);

      return {
        message: `Menus created successfully for restaurant ${restaurantId}. Created: ${createdMenuResults.length}, Failed: ${failedCreations.length}.`,
        results: createdMenuResults, // Return only successfully created menus
      };
    } catch (error) {
      console.error(`An error occurred during bulk menu creation for restaurant ${restaurantId}: `, error);
      // Re-throw specific, client-facing exceptions
      if (error instanceof BadRequestException || error instanceof ConflictException) {
        throw error;
      }
      throw new Error('Failed to perform bulk menu creation due to an internal server error.');
    }
  }

  async findAllMenus() {
    return this.prisma.menu.findMany();
  }

  private calculateDisplayPrice(menu: Partial<Menu>): { sellPriceDisplay: number; platformFeeDisplay: number } {
    if (!menu.price) throw new NotFoundException('Cannot find menu price, cannot calculate display price');
    const markup = new Decimal(Number(process.env.SELL_PRICE_MARKUP_RATE));
    const rate = new Decimal(Number(process.env.PLATFORM_COMMISSION_RATE));

    const priceInSatang = new Decimal(menu.price);
    const sellingPriceInSatang = priceInSatang.times(new Decimal(1).plus(markup));
    const platformFeeInSatang = sellingPriceInSatang.times(rate);

    return {
      sellPriceDisplay: sellingPriceInSatang.toNumber(),
      platformFeeDisplay: platformFeeInSatang.toNumber(),
    }
  }

  async getRestaurantMenusDisplay(restaurantId: string): Promise<MenusWithDisplayPrices[]> {
    try {
      const menus = await this.prisma.menu.findMany({
        where: {
          restaurantId,
          isAvailable: true,
        },
        select: {
          menuId: true,
          name: true,
          menuImg: true,
          price: true,
          restaurantId: true,
          isAvailable: true,
        }
      });

      const menusWithCalculatedPrices: MenusWithDisplayPrices[] = menus.map(menu => {
        const displayPrices = this.calculateDisplayPrice(menu);
        return {
          ...menu,
          menuImg: menu.menuImg ?? undefined,
          sellPriceDisplay: displayPrices.sellPriceDisplay,
          // platformFeeDisplay: displayPrices.platformFeeDisplay,
        };
      });

      console.log('Menu with display price: ', menusWithCalculatedPrices);

      return menusWithCalculatedPrices;
    } catch (error) {
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
        throw new NotFoundException(
          `ไม่พบออเดอร์ที่มีID: ${menuId}`,
        );
      }

      throw error;
    }
  }

  private async isOwnerOfMenu(restaurantId: string, menuIds: string[]) {
    await this.restaurantService.findRestaurant(restaurantId);
    const ownedAndExistingMenus = await this.prisma.menu.findMany({
      where: {
        menuId: { in: menuIds },
        restaurantId,
      },
      select: { menuId: true, restaurantId: true },
    });

    if (ownedAndExistingMenus.length !== menuIds.length) {
      const foundOwnedMenuids = new Set(ownedAndExistingMenus.map(menu => menu.menuId));
      const problematicMenuIds = menuIds.filter(id => !foundOwnedMenuids.has(id));

      const allRequestMenus = await this.prisma.menu.findMany({
        where: { menuId: { in: problematicMenuIds } },
        select: { menuId: true, restaurantId: true },
      });

      if (allRequestMenus.length === 0) {
        throw new NotFoundException('The following menus were not found: ', problematicMenuIds.join(', '));
      } else {
        throw new ForbiddenException(`The following menus exist but do not belong to restaurant "${restaurantId}": ${problematicMenuIds.join(', ')}.`);
      }
    }
  }

  async updateMenu(restaurantId: string, menuIds: string[], updateMenuDto: UpdateMenuDto[]) {
    try {
      // Find existing restaurant
      await this.restaurantService.findRestaurant(restaurantId);

      // Check for menu ownership
      await this.isOwnerOfMenu(restaurantId, menuIds);

      const updateMenuLists = updateMenuDto.map(async (dto, index) => {
        const menuId = menuIds[index];
        // const file = files && files[index];
        const menuImgUrl = dto.menuImg;

        const updateLists: Partial<Menu> = {};
        if (dto.name !== undefined) updateLists.name = dto.name;
        if (dto.price !== undefined) updateLists.price = dto.price;
        if (dto.maxDaily !== undefined) updateLists.maxDaily = dto.maxDaily;
        if (dto.cookingTime !== undefined) updateLists.cookingTime = dto.cookingTime;
        if (dto.isAvailable !== undefined) updateLists.isAvailable = dto.isAvailable;
        if (menuImgUrl !== undefined) updateLists.menuImg = menuImgUrl;

        const updateMenus = await this.prisma.menu.update({
          where: {
            menuId: menuId,
            restaurantId,
          },
          data: updateLists,
        });

        return updateMenus;
      });

      if (Object.keys(updateMenuLists).length === 0) {
        throw new BadRequestException('ไม่พบข้อมูลให้อัพเดต');
      }

      const results = await Promise.all(updateMenuLists);
      console.log(`Bulk menus update successful for restaurant ${restaurantId}. Updated menus: `, results.map(m => m.name));
      return {
        message: `Menus updated successfully for restaurant ${restaurantId}`,
        results: results
      };
    } catch (error: any) {
      console.error(`Failed to update menus for ${restaurantId}: `, error);
      throw error;
    }
  }

  async removeMenu(menuId: string) {
    return this.prisma.menu.delete({
      where: { menuId },
    });
  }
}
