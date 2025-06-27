import { Injectable, Inject, forwardRef, NotFoundException, ConflictException, InternalServerErrorException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { CreateMenuDto } from './dto/create-menu.dto';
import { UpdateMenuDto } from './dto/update-menu.dto';
import { PrismaService } from 'prisma/prisma.service';
import { RestaurantService } from 'src/restaurant/restaurant.service';
import { Menu } from '@prisma/client';
import Decimal from 'decimal.js';

export interface MenusWithDisplayPrices {
  menuId: string;
  name: string;
  menuImg?: string;
  price: number;
  restaurantId: string;
  isAvailable: boolean;
  sellPriceDisplay: number;
  platformFeeDisplay: number;
}

@Injectable()
export class MenuService {
  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => RestaurantService))
    private restaurantService: RestaurantService,
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
          cookingTime: dto.cookingTime,
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
          platformFeeDisplay: displayPrices.platformFeeDisplay,
        };
      });

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
