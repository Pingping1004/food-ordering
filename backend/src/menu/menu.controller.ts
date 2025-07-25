import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  UploadedFile,
  UploadedFiles,
  BadRequestException,
  UseInterceptors,
  NotFoundException,
  Query,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { MenuService, MenusWithDisplayPrices } from './menu.service';
import {
  CreateBulkMenusJsonPayload,
  CreateMenuDto,
} from './dto/create-menu.dto';
import { UpdateMenuDto } from './dto/update-menu.dto';
import { Public } from '../decorators/public.decorator';
import { RolesGuard } from '../guards/roles.guard';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';

import { imageFileFilter } from 'src/utils/file-upload.utils';
import { Express } from 'express';
import { JwtAuthGuard } from 'src/guards/jwt-auth.guard';
import { Role } from '@prisma/client';
import { Roles } from 'src/decorators/role.decorator';

@Controller('menu')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles([Role.admin, Role.cooker])
export class MenuController {
  constructor(
    private readonly menuService: MenuService,
  ) { }

  private readonly logger = new Logger('MenuService');

  @Post('single')
  @UseInterceptors(
    FileInterceptor('menuImg', {
      storage: null,
      fileFilter: imageFileFilter,
    }),
  )
  async createSingleMenu(
    @Body() createMenuDto: CreateMenuDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!createMenuDto.restaurantId)
      throw new NotFoundException('RestaurantId not found in create mneu controller');

    try {
      const menuData: CreateMenuDto = { ...createMenuDto };

      const result = await this.menuService.createSingleMenu(menuData, file);
      return result;
    } catch (error) {
      this.logger.error(`Create menu controller failed: ${error}`);
      throw new InternalServerErrorException('Failed to create single menu');
    }
  }

  @Post('bulk-images')
  @UseInterceptors(FilesInterceptor('images'))
  uploadMenuImages(@UploadedFiles() files: Express.Multer.File[]) {
    return this.menuService.uploadTempImages(files);
  }

  @Post('bulk')
  async createBulkMenus(@Body() payload: CreateBulkMenusJsonPayload) {
    this.logger.log(`Req body for bulk menus: `, payload);

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
      storage: null,
      fileFilter: imageFileFilter,
    }),
  )
  async updateSingleMenu(
    @Param('menuId') menuId: string,
    @Body() updateMenuDto: UpdateMenuDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const restaurantId = updateMenuDto.restaurantId;
    if (!restaurantId)
      throw new NotFoundException(
        'RestaurantId not found in update menu controller',
      );

    let uploadedFilePath: string | undefined;
    try {
      if (!menuId)
        throw new BadRequestException('Menu ID is required in URL params');

      const menuData: UpdateMenuDto = { ...updateMenuDto };

      const result = await this.menuService.updateMenu(menuId, menuData, file);

      return result;
    } catch (error) {
      this.logger.error('Single menu update failed in controller: ', error);
      throw new InternalServerErrorException('Failed to update single menu');
    }
  }

  @Patch('bulk')
  @UseInterceptors(
    FilesInterceptor('menuImg', 20, {
      storage: null,
      limits: {
        fileSize: 10 * 1024 * 1024,
      },
      fileFilter: imageFileFilter,
    }),
  )
  async bulkUpdateMenus(
    @Query('menuIds') menuIds: string[],
    @Body() updateMenuDto: string,
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    let parsedUpdateMenuDtos: UpdateMenuDto[];

    if (!menuIds || menuIds.length === 0) {
      throw new BadRequestException('At least one menuId is required for bulk update.');
    }

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

      parsedUpdateMenuDtos.forEach((dto) => {
        const restaurantId = dto.restaurantId;
        if (!restaurantId)
          throw new NotFoundException(
            'RestaurantId is missing in the update payload',
          );
      });

      const result = await this.menuService.bulkUpdateMenus(
        menuIds,
        parsedUpdateMenuDtos,
        files,
      );

      return result;
    } catch (error) {
      this.logger.error('Bulk menu update failed in controller: ', error);
      throw new InternalServerErrorException('Failed to update bulk menu');
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
