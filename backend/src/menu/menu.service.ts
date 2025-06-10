import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateMenuDto } from './dto/create-menu.dto';
import { UpdateMenuDto } from './dto/update-menu.dto';
import { PrismaService } from 'prisma/prisma.service';
import { RestaurantService } from '../restaurant/restaurant.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class MenuService {
  constructor(
    private prisma: PrismaService,
    private restaurantService: RestaurantService,
  ) {}

  async createMenu(createMenuDto: CreateMenuDto) {
    const existingRestaurant =
      await this.restaurantService.findRestaurantByname(
        createMenuDto.restaurantName,
      );

    if (!existingRestaurant) {
      throw new NotFoundException(
        `Restaurant with name "${createMenuDto.restaurantName}" not found.`,
      );
    }

    const newMenu = {
      name: createMenuDto.name,
      price: createMenuDto.price,
      maxDaily: createMenuDto.maxDaily,
      cookingTime: createMenuDto.cookingTime,
      menuImg: createMenuDto.menuImg,

      // Connect to the restaurant using its unique name
      restaurant: {
        connect: {
          name: existingRestaurant.name,
        },
      },
    };

    return this.prisma.menu.create({
      data: newMenu,
    })
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
