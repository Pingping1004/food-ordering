import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Req,
  UseGuards,
  UploadedFile,
  UploadedFiles,
  BadRequestException,
  UseInterceptors,
  NotFoundException,
  Query,
  Logger,
} from '@nestjs/common';
import { MenuService, MenusWithDisplayPrices } from './menu.service';
import {
  CreateBulkMenusJsonPayload,
  CreateMenuDto,
} from './dto/create-menu.dto';
import { UpdateMenuDto } from './dto/update-menu.dto';
import * as fs from 'fs/promises';
import { Public } from '../decorators/public.decorator';
import { RolesGuard } from '../guards/roles.guard';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { imageFileFilter, editFileName } from 'src/utils/file-upload.utils';
import { Express } from 'express';
import { JwtAuthGuard } from 'src/guards/jwt-auth.guard';
import { Role } from '@prisma/client';
import { Roles } from 'src/decorators/role.decorator';

@Controller('menu')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles([Role.admin, Role.cooker])
export class MenuController {
  constructor(private readonly menuService: MenuService) {}

  private readonly logger = new Logger('MenuService');

  @Post('single')
  @UseInterceptors(
    FileInterceptor('menuImg', {
      storage: diskStorage({
        destination: './uploads/menus',
        filename: editFileName,
      }),
      fileFilter: imageFileFilter,
    }),
  )
  async createSingleMenu(
    @Req() req: any,
    @Body() createMenuDto: CreateMenuDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!createMenuDto.restaurantId)
      throw new NotFoundException(
        'RestaurantId not found in create mneu controller',
      );

    let uploadedFilePath: string | undefined;

    try {
      const menuData: CreateMenuDto = { ...createMenuDto };
      if (file) {
        menuData.menuImg = `/uploads/menus/${file.filename}`;
      }

      const result = await this.menuService.createSingleMenu(menuData);
      return result;
    } catch (error) {
      if (uploadedFilePath) {
        try {
          await fs.unlink(uploadedFilePath);
        } catch (fileDeleteError) {
          this.logger.error(
            `Controller: Failed to delete uploaded file ${uploadedFilePath}:`,
            fileDeleteError,
          );
        }
      }

      this.logger.error('Create menu controller failed: ', error);
      throw error;
    }
  }

  @Post('bulk')
  async createBulkMenus(@Body() payload: CreateBulkMenusJsonPayload) {
    if (
      !payload.createMenuDto ||
      !Array.isArray(payload.createMenuDto) ||
      payload.createMenuDto.length === 0
    ) {
      throw new BadRequestException(
        'The request body must contain a non-empty "createMenuDto" array.',
      );
    }

    try {
      const result = await this.menuService.createBulkMenus(
        payload.restaurantId,
        payload.createMenuDto,
      );
      return result;
    } catch (error) {
      this.logger.error('Bulk menu creation failed in controller: ', error);
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
  async getRestaurantMenus(
    @Param('restaurantId') restaurantId: string,
  ): Promise<MenusWithDisplayPrices[]> {
    const menuList = this.menuService.getRestaurantMenusDisplay(restaurantId);
    return menuList;
  }

  @Public()
  @Get('find/:menuId')
  async findMenu(@Param('menuId') menuId: string) {
    return this.menuService.findMenu(menuId);
  }

  @Patch('single/:menuId')
  @UseInterceptors(
    FileInterceptor('menuImg', {
      storage: diskStorage({
        destination: './uploads/menus',
        filename: editFileName,
      }),
      fileFilter: imageFileFilter,
    }),
  )
  async updateSingleMenu(
    @Param('menuId') menuId: string,
    @Body() updateMenuDto: UpdateMenuDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const restaurantId = updateMenuDto.restaurantId;
    const existingMenu = await this.findMenu(menuId);
    if (!restaurantId)
      throw new NotFoundException(
        'RestaurantId not found in update menu controller',
      );

    let uploadedFilePath: string | undefined;
    try {
      if (!menuId)
        throw new BadRequestException('Menu ID is required in URL params');

      const menuData: UpdateMenuDto = { ...updateMenuDto };

      if (file) {
        menuData.menuImg = `uploads/menus/${file.filename}`;
      } else if (
        updateMenuDto.menuImg === 'undefined' ||
        typeof updateMenuDto.menuImg === 'string'
      ) {
        menuData.menuImg = existingMenu.menuImg;
      } else {
        menuData.menuImg = null;
      }

      const result = await this.menuService.updateMenu([menuId], [menuData]);

      return result;
    } catch (error) {
      this.logger.error('Single menu update failed in controller: ', error);
      if (uploadedFilePath) {
        try {
          await fs.unlink(uploadedFilePath);
        } catch (fileDeleteError) {
          this.logger.error(
            `Controller: Failed to delete uploaded file ${uploadedFilePath}:`,
            fileDeleteError,
          );
        }
      }
      throw error;
    }
  }

  @Patch('bulk')
  @UseInterceptors(
    FilesInterceptor('menuImg', 20, {
      storage: diskStorage({
        destination: './uploads/menus',
        filename: editFileName,
      }),
      fileFilter: imageFileFilter,
    }),
  )
  async bulkUpdateMenus(
    @Req() req: any,
    @Query('menuIds') menuIds: string[],
    @Body() updateMenuDto: string,
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    let parsedUpdateMenuDtos: UpdateMenuDto[];
    const uploadedFilePaths: string[] = [];
    try {
      try {
        parsedUpdateMenuDtos = JSON.parse(updateMenuDto);
        if (!Array.isArray(parsedUpdateMenuDtos)) {
          throw new BadRequestException(
            'UpdateMenuDto field must be a JSON array',
          );
        }
      } catch (parseError) {
        this.logger.error('Failed to parse updateMenuDto:', parseError);
        throw new BadRequestException(
          'Invalida JSON format for updateMenuDto field',
        );
      }

      parsedUpdateMenuDtos.forEach((dto, index) => {
        const file = files?.[index];
        const restaurantId = dto.restaurantId;
        if (!restaurantId)
          throw new NotFoundException(
            'RestaurantId is missing in the update payload',
          );

        if (file) {
          dto.menuImg = `uploads/menus/${file.filename}`;
          uploadedFilePaths.push(file.path);
        }
      });

      const result = await this.menuService.updateMenu(
        menuIds,
        parsedUpdateMenuDtos,
        // files,
      );

      return result;
    } catch (error) {
      this.logger.error('Bulk menu update failed in controller: ', error);
      await Promise.all(
        uploadedFilePaths.map(async (filePath) => {
          try {
            await fs.unlink(filePath);
          } catch (fileDeleteError) {
            this.logger.error(
              `Controller: Failed to delete uploaded file ${filePath}:`,
              fileDeleteError,
            );
          }
        }),
      );
      throw error;
    }
  }

  @Patch('is-available/:menuId')
  async updateAvailability(
    @Param('menuId') menuId: string,
    @Body() updateMenuDto: UpdateMenuDto,
  ) {
    const updateAvailability = await this.menuService.updateIsAvailable(
      menuId,
      updateMenuDto,
    );
    return updateAvailability;
  }

  @Delete(':menuId')
  async remove(@Param('menuId') menuId: string) {
    return this.menuService.removeMenu(menuId);
  }
}
