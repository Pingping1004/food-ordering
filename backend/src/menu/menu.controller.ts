import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { MenuService } from './menu.service';
import { CreateMenuDto } from './dto/create-menu.dto';
import { UpdateMenuDto } from './dto/update-menu.dto';
import { HttpExceptionFilter } from 'src/common/http-exception.filter';
import { Roles } from '../decorators/role.decorator';
import { RolesGuard } from 'src/guards/roles.guard';

@Controller('menu')
@UseGuards(RolesGuard)
@Roles(['cooker'])
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
  async updateMenu(@Param('menuId') menuId: string, @Body() updateMenuDto: UpdateMenuDto) {
    return this.menuService.updateMenu(menuId, updateMenuDto);
  }

  @Delete(':menuId')
  async remove(@Param('menuId') menuId: string) {
    return this.menuService.removeMenu(menuId);
  }
}
