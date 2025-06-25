import { Injectable, Inject, forwardRef, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { CreateMenuDto } from './dto/create-menu.dto';
import { UpdateMenuDto } from './dto/update-menu.dto';
import { PrismaService } from 'prisma/prisma.service';
import { RestaurantService } from 'src/restaurant/restaurant.service';

@Injectable()
export class MenuService {
  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => RestaurantService))
    private restaurantService: RestaurantService,
  ) { }

  async createMenu(createMenuDto: CreateMenuDto, file?: Express.Multer.File) {
    try {
      console.log('CreateMenuDto in service: ', createMenuDto);

      const menuImgUrl = file ? `uploads/menus/${file.filename}` : createMenuDto.menuImg;
      const existingRestaurant = await this.restaurantService.findRestaurant(createMenuDto.restaurantId);

      const newMenu = {
        name: createMenuDto.name,
        price: createMenuDto.price,
        maxDaily: createMenuDto.maxDaily,
        cookingTime: createMenuDto.cookingTime,
        menuImg: menuImgUrl,

        // Connect to the restaurant using restaurantId
        restaurant: {
          connect: {
            restaurantId: existingRestaurant.restaurantId,
          },
        },
      };

      const result = await this.prisma.menu.create({
        data: newMenu,
      });

      console.log("Created restaurant in service : ", result);
      return { message: 'File uploaded successfully', result, fileInfo: file };
    } catch (error) {
      console.error('Failed to create restaurant service: ', error);
      throw error;
    }
  }

  async findAllMenus() {
    return this.prisma.menu.findMany();
  }

  async getRestaurantMenus(restaurantId: string) {
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
        }
      });
      return menus;
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

  async updateMenu(menuId: string, updateMenuDto: UpdateMenuDto) {
    // Exclude restaurantId and role from updateMenuDto because they should not be updated.
    const { restaurantId, role, ...data } = updateMenuDto;
    return this.prisma.menu.update({
      where: { menuId },
      data,
    });
  }

  async removeMenu(menuId: string) {
    return this.prisma.menu.delete({
      where: { menuId },
    });
  }
}
