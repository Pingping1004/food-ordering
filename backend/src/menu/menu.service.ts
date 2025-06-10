import { Injectable } from '@nestjs/common';
import { CreateMenuDto } from './dto/create-menu.dto';
import { UpdateMenuDto } from './dto/update-menu.dto';
import { PrismaService } from 'prisma/prisma.service';

@Injectable()
export class MenuService {
  constructor(private prisma: PrismaService) {}

  async createMenu(createMenuDto: CreateMenuDto) {
    return this.prisma.menu.create({
      data: createMenuDto,
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
