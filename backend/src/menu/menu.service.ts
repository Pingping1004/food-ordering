import { Injectable, Inject, forwardRef, NotFoundException, ConflictException, InternalServerErrorException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { CreateMenuDto } from './dto/create-menu.dto';
import { UpdateMenuDto } from './dto/update-menu.dto';
import { PrismaService } from 'prisma/prisma.service';
import { RestaurantService } from 'src/restaurant/restaurant.service';
import { Menu } from '@prisma/client';
import Decimal from 'decimal.js';
import { numberRound } from 'src/utils/round-number';
import { UploadService } from 'src/upload/upload.service';
import { CsvMenuItemData } from './dto/create-menu.dto';

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
export class MenuService {
  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => RestaurantService))
    private restaurantService: RestaurantService,
    private uploadService: UploadService,
  ) { }

  async createSingleMenu(
    createMenuDto: CreateMenuDto,
  ) {
    const existingName = await this.findMenuByName(createMenuDto.name);
    if (existingName) throw new BadRequestException(`Menu name ${createMenuDto.name} has already exists`);
    try {
      const newMenu: CreateMenuDto = {
        restaurantId: createMenuDto.restaurantId,
        name: createMenuDto.name,
        price: createMenuDto.price,
        maxDaily: createMenuDto.maxDaily,
        menuImg: createMenuDto.menuImg,
        cookingTime: createMenuDto.cookingTime,
        isAvailable: true,
      };

      const result = await this.prisma.menu.create({
        data: newMenu,
      })

      return result;
    } catch (error) {
      console.error(`Failed to create menu ${createMenuDto.name}`);
    }
  }

  async createBulkMenus(
    restaurantId: string,
    menusData: CsvMenuItemData[],
  ): Promise<BulkCreateMenuResult> {
    try {
      // --- 1. Initial Validations ---
      if (!restaurantId) {
        throw new BadRequestException('Restaurant ID is required.');
      }

      const existingRestaurant = await this.restaurantService.findRestaurant(restaurantId);
      if (!existingRestaurant) {
        throw new BadRequestException(`Restaurant with ID ${restaurantId} not found.`);
      }

      const newMenuNames = menusData.map(dto => dto.name);

      // --- 2. Check for Duplicates Within the Incoming Batch ---
      const uniqueNewMenuNames = new Set(newMenuNames);
      if (uniqueNewMenuNames.size !== newMenuNames.length) {
        const duplicateNamesInBatch = newMenuNames.filter((name, index) => newMenuNames.indexOf(name) !== index);
        throw new ConflictException(
          `Duplicate menu names found within the batch: ${[...new Set(duplicateNamesInBatch)].join(', ')}. ` +
          `Each menu name in a bulk creation request must be unique within the batch.`
        );
      }

      // --- 3. Check for Duplicates Against Existing Menus in the Database (for this restaurant) ---
      const existingMenusWithSameNames = await this.prisma.menu.findMany({
        where: {
          name: { in: newMenuNames },
          restaurantId: restaurantId, // Crucial: Scope to the current restaurant
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

      // --- 4. Process Each Menu Item Individually ---
      const createdMenuResults: Menu[] = [];
      const failedCreations: { item: CsvMenuItemData; error: string }[] = []; // Clearer property name: 'item' instead of 'menuData'

      for (const dto of menusData) {
        let menuImgUrl: string | undefined;

        try {
          // Move image from temporary storage to permanent storage if an image is referenced
          if (dto.imageFileName) {
            // `imageFileName` is the temporary ID (UUID.ext) assigned during the initial upload
            menuImgUrl = await this.uploadService.moveTempImageToPermanent(dto.imageFileName);
          } // If no imageFileName, menuImgUrl remains undefined

          // Prepare data for Prisma creation
          const menuDataToCreate = {
            name: dto.name,
            description: dto.description, // Ensure this property is correctly handled (e.g., nullable in Prisma schema)
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
          // Log specific errors for individual items and collect them
          console.error(
            `Failed to create menu item "${dto.name}" (Original file: ${dto.originalFileName || 'N/A'}): `,
            itemError.message,
            itemError.stack // Include stack trace for better debugging of individual failures
          );
          failedCreations.push({ item: dto, error: itemError.message });
        }
      }

      // --- 5. Prepare and Return Comprehensive Results ---
      const totalAttempted = menusData.length;
      const totalCreated = createdMenuResults.length;
      const totalFailed = failedCreations.length;

      let responseMessage = `Bulk menu creation completed for restaurant ${restaurantId}. `;

      if (totalFailed > 0) {
        const failedNames = failedCreations.map(f => f.item.name).join(', ');
        responseMessage += `Created: ${totalCreated}, Failed: ${totalFailed}. Failed items: ${failedNames}. Please check details for errors.`;
        console.warn(`Partial bulk menu creation for restaurant ${restaurantId}. Failed items: ${failedNames}`);
      } else {
        responseMessage += `All ${totalCreated} menus were successfully created.`;
      }

      console.log(responseMessage); // Log final summary

      return {
        message: responseMessage,
        createdMenus: createdMenuResults,
        failedMenus: failedCreations,
        totalAttempted,
        totalCreated,
        totalFailed,
      };

    } catch (error: any) {
      // --- 6. Top-Level Error Handling ---
      console.error(`An unexpected error occurred during bulk menu creation for restaurant ${restaurantId}: `, error);

      // Re-throw specific, client-facing exceptions (e.g., from initial validations)
      if (error instanceof BadRequestException || error instanceof ConflictException) {
        throw error;
      }
      // For any other uncaught errors, throw a generic Internal Server Error
      throw new InternalServerErrorException('Failed to perform bulk menu creation due to an internal server error. Please try again or contact support.');
    }
  }

  async findMenuByName(name: string) {
    const menu = await this.prisma.menu.findUnique({
      where: {
        name,
      },
    });

    return menu;
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
          isAvailable: updateMenuDto.isAvailable
         },
      });

      return { result, message: `Sucessfully update availability of menu ${result.name} to be ${result.isAvailable}`};
    } catch (error) {
      console.error(`An unexpected error occurred during update menu isavailable`, error);
      throw new InternalServerErrorException('Failed to update isAvailable state of menu');
    }
  }

  async removeMenu(menuId: string) {
    return this.prisma.menu.delete({
      where: { menuId },
    });
  }
}
