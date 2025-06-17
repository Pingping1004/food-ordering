import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, UploadedFile, BadRequestException, UseInterceptors } from '@nestjs/common';
import { MenuService } from './menu.service';
import { CreateMenuDto } from './dto/create-menu.dto';
import { UpdateMenuDto } from './dto/update-menu.dto';
import { extname, join } from 'path';
import * as fs from 'fs/promises';
import { Public } from '../decorators/public.decorator';
import { RolesGuard } from '../guards/roles.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { imageFileFilter, editFileName } from 'src/utils/file-upload.utils';

@Controller('menu')
// @UseGuards(RolesGuard)
// @Roles(['cooker'])
export class MenuController {
  constructor(private readonly menuService: MenuService) { }

  @Post()
  @UseInterceptors(
    FileInterceptor('menuImg', {
      storage: diskStorage({
        destination: './uploads/menus',
        filename: editFileName,
      }),
      // fileFilter: imageFileFilter,
    }))

  async createMenu(
    @Body() createMenuDto: CreateMenuDto,
    @UploadedFile() file?: Express.Multer.File
  ) {
    const uploadedFilePath = file?.path;

    try {
      // Only throw if the file or a direct link for menuImg is absolutely mandatory
      if (!file && createMenuDto.menuImg === undefined) throw new BadRequestException('Menu image or direct URL is required.');

      const result = await this.menuService.createMenu(createMenuDto, file);

      console.log('Create menu in controller: ', result);
      return result;
    } catch (error) {
      if (uploadedFilePath) {
        try {
          await fs.unlink(uploadedFilePath);
          console.log(`Controller: Successfully deleted temporary uploaded file: ${uploadedFilePath}`)
        } catch (fileDeleteError) {
          console.error(`Controller: Failed to delete uploaded file ${uploadedFilePath}:`, fileDeleteError)
        }
      }

      console.error('Create menu controller failed: ', error);
      throw error;
    }
  }

  @Public()
  @Get()
  async findAllMenus() {
    return this.menuService.findAllMenus();
  }

  @Public()
  @Get(':restaurantId')
  async getRestaurantMenus(@Param('restaurantId') restaurantId: string) {
    return this.menuService.getRestaurantMenus(restaurantId);
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
