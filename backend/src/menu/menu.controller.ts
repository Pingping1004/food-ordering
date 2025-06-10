import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { MenuService } from './menu.service';
import { CreateMenuDto } from './dto/create-menu.dto';
import { UpdateMenuDto } from './dto/update-menu.dto';

@Controller('cooker-menu')
export class MenuController {
  constructor(private readonly menuService: MenuService) {}

  @Post()
  async createMenu(@Body() createMenuDto: CreateMenuDto) {
    return this.menuService.createMenu(createMenuDto);
  }

  @Get()
  async findAllMenus() {
    return this.menuService.findAllMenus();
  }

  @Get(':menuId')
  async findMenu(@Param('menuId') menuId: string) {
    return this.menuService.findMenu(menuId);
  }

  @Patch(':menuId')
  updateMenu(@Param('menuId') menuId: string, @Body() updateMenuDto: UpdateMenuDto) {
    return this.menuService.updateMenu(menuId, updateMenuDto);
  }

  @Delete(':menuId')
  remove(@Param('menuId') menuId: string) {
    return this.menuService.removeMenu(menuId);
  }
}
