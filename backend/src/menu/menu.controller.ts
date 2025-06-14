import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, UploadedFile, UseInterceptors } from '@nestjs/common';
import { MenuService } from './menu.service';
import { CreateMenuDto } from './dto/create-menu.dto';
import { UpdateMenuDto } from './dto/update-menu.dto';
import { extname } from 'path';
import { Roles } from '../decorators/role.decorator';
import { Public } from '../decorators/public.decorator';
import { RolesGuard } from '../guards/roles.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { imageFileFilter, editFileName } from 'src/utils/file-upload.utils';

@Controller('menu')
@UseGuards(RolesGuard)
@Roles(['cooker'])
export class MenuController {
  constructor(private readonly menuService: MenuService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
    storage: diskStorage({
      destination: './uploads/menus',
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = extname(file.originalname);
        cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
      },
    }),
  }))

  async createMenu(@Body() createMenuDto: CreateMenuDto, @UploadedFile() file?: Express.Multer.File) {
    return this.menuService.createMenu(createMenuDto, file);
  }

  @Public()
  @Get()
  async findAllMenus() {
    return this.menuService.findAllMenus();
  }

  @Public()
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
