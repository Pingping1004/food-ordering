import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateMenuDto } from './dto/create-menu.dto';
import { UpdateMenuDto } from './dto/update-menu.dto';
import { PrismaService } from 'prisma/prisma.service';
import { RestaurantService } from '../restaurant/restaurant.service';

@Injectable()
export class MenuService {
  constructor(
    private prisma: PrismaService,
    private restaurantService: RestaurantService,
  ) {}

  async createMenu(createMenuDto: CreateMenuDto, file?: Express.Multer.File) {
    const existingRestaurant =
      await this.restaurantService.findRestaurant(
        createMenuDto.restaurantId,
      );

    if (!existingRestaurant) {
      throw new NotFoundException(
        `ไม่พบร้านอาหารที่ค้นหา`,
      );
    }

    let menuImgUrl: string | undefined;
    if (file) {
      menuImgUrl = `uploads/${file.originalname}`;
    } else if (createMenuDto.menuImg) {
      menuImgUrl = createMenuDto.menuImg;
    }

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

    return this.prisma.menu.create({
      data: newMenu,
    });
  }

  async findAllMenus() {
    return this.prisma.menu.findMany();
  }

  async findMenu(menuId: string) {
    return this.prisma.menu.findUnique({
      where: { menuId },
    });
  }

  async updateMenu(menuId: string, updateMenuDto: UpdateMenuDto) {
    return this.prisma.menu.update({
      where: { menuId },
      data: updateMenuDto,
    });
  }

  async removeMenu(menuId: string) {
    return this.prisma.menu.delete({
      where: { menuId },
    });
  }
}
