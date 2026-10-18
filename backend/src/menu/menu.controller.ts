import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Req,
  HttpException,
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
import { AccessService, RestaurantScope } from '../access';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';

import { imageFileFilter } from 'src/utils/file-upload.utils';
import { Express } from 'express';
import { RestaurantRole } from '@prisma/client';

/** Menu create / edit / availability: owner, admin or cook of the menu's restaurant (system admin always passes). */
const MENU_WRITER = {
  roles: [RestaurantRole.OWNER, RestaurantRole.ADMIN, RestaurantRole.STAFF],
};
/** Deleting a menu is irreversible, so it stays with the owner / admin (cooks mark it unavailable instead). */
const MENU_DELETER = { roles: [RestaurantRole.OWNER, RestaurantRole.ADMIN] };

@Controller('menu')
export class MenuController {
  constructor(
    private readonly menuService: MenuService,
    private readonly access: AccessService,
  ) {}

  private assertWriter(req: any, restaurantId: string) {
    return this.access.assertRestaurantRoleScoped(
      req.user,
      restaurantId,
      MENU_WRITER.roles,
      { cacheKey: req },
    );
  }

  /** The DTO's restaurantId (if any) must be the restaurant the route was authorised for. */
  private bindRestaurant<T extends { restaurantId?: string }>(
    req: any,
    dto: T,
  ): T {
    if (dto.restaurantId && dto.restaurantId !== req.restaurantId) {
      throw new BadRequestException(
        'restaurantId ไม่ตรงกับเมนูที่ต้องการแก้ไข',
      );
    }
    return { ...dto, restaurantId: req.restaurantId };
  }

  private readonly logger = new Logger('MenuService');

  @Post('single')
  @UseInterceptors(
    FileInterceptor('menuImg', {
      fileFilter: imageFileFilter,
    }),
  )
  async createSingleMenu(
    @Req() req: any,
    @Body() createMenuDto: CreateMenuDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!createMenuDto.restaurantId)
      throw new NotFoundException('ไม่พบร้านอาหารที่ต้องการสร้างเมนู');
    await this.assertWriter(req, createMenuDto.restaurantId);

    try {
      const menuData: CreateMenuDto = { ...createMenuDto };

      const result = await this.menuService.createSingleMenu(menuData, file);
      return result;
    } catch (error) {
      this.logger.error(`Create menu controller failed: ${error}`);
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(
        `สร้างเมนู ${createMenuDto.name}ล้มเหลว`,
      );
    }
  }

  @Post('bulk-images')
  @UseInterceptors(FilesInterceptor('images'))
  async uploadMenuImages(
    @Req() req: any,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    await this.access.assertCanManageMenus(req.user, req);
    return this.menuService.uploadTempImages(files);
  }

  @Post('bulk')
  async createBulkMenus(
    @Req() req: any,
    @Body() payload: CreateBulkMenusJsonPayload,
  ) {
    if (!payload.restaurantId)
      throw new NotFoundException('ไม่พบร้านอาหารที่ต้องการสร้างเมนู');
    await this.assertWriter(req, payload.restaurantId);
    this.logger.log(`Req body for bulk menus: `, payload);

    if (
      !payload.createMenuDto ||
      !Array.isArray(payload.createMenuDto) ||
      payload.createMenuDto.length === 0
    ) {
      throw new BadRequestException('ไม่พบข้อมูลสำหรับการสร้างเมนู');
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

  @Get(':restaurantId')
  async getRestaurantMenus(
    @Req() req: any,
    @Param('restaurantId') restaurantId: string,
  ): Promise<MenusWithDisplayPrices[]> {
    await this.access.assertRestaurantVisible(req.user, restaurantId, req);
    const menuList = this.menuService.getRestaurantMenusDisplay(restaurantId);
    return menuList;
  }

  @Get('find/:menuId')
  async findMenu(@Req() req: any, @Param('menuId') menuId: string) {
    const restaurantId = await this.access.resolveRestaurantId({ menuId });
    await this.access.assertRestaurantVisible(req.user, restaurantId, req);
    return this.menuService.findMenu(menuId);
  }

  @RestaurantScope({ param: 'menuId', ...MENU_WRITER })
  @Patch('single/:menuId')
  @UseInterceptors(
    FileInterceptor('menuImg', {
      storage: null,
      fileFilter: imageFileFilter,
    }),
  )
  async updateSingleMenu(
    @Req() req: any,
    @Param('menuId') menuId: string,
    @Body() updateMenuDto: UpdateMenuDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const bound = this.bindRestaurant(req, updateMenuDto);

    try {
      if (!menuId) throw new BadRequestException('ไม่พบเมนูไอดี');

      const menuData: UpdateMenuDto = { ...bound };
      const result = await this.menuService.updateMenu(menuId, menuData, file);

      return result;
    } catch (error) {
      this.logger.error('Single menu update failed in controller: ', error);
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('แก้ไขเมนูล้มเหลว');
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
    @Req() req: any,
    @Query('menuIds') menuIds: string[],
    @Body() updateMenuDto: string,
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    let parsedUpdateMenuDtos: UpdateMenuDto[];

    if (!menuIds || menuIds.length === 0) {
      throw new BadRequestException('ไม่พบเมนูที่ต้องการแก้ไข');
    }

    try {
      try {
        parsedUpdateMenuDtos = JSON.parse(updateMenuDto);

        if (!Array.isArray(parsedUpdateMenuDtos))
          throw new BadRequestException('รูปแบบไม่ถูกต้อง');
      } catch (parseError) {
        this.logger.error('Failed to parse updateMenuDto:', parseError);
        throw new BadRequestException('รูปแบบข้อมูลไม่ถูกต้อง');
      }

      parsedUpdateMenuDtos.forEach((dto) => {
        const restaurantId = dto.restaurantId;
        if (!restaurantId)
          throw new NotFoundException(
            'RestaurantId is missing in the update payload',
          );
        if (restaurantId !== parsedUpdateMenuDtos[0].restaurantId)
          throw new BadRequestException('เมนูทั้งหมดต้องเป็นของร้านเดียวกัน');
      });

      await this.assertWriter(req, parsedUpdateMenuDtos[0].restaurantId);

      const result = await this.menuService.bulkUpdateMenus(
        menuIds,
        parsedUpdateMenuDtos,
        files,
      );

      return result;
    } catch (error) {
      this.logger.error('Bulk menu update failed in controller: ', error);
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('แก้ไขเมนูล้มเหบว');
    }
  }

  @RestaurantScope({ param: 'menuId', ...MENU_WRITER })
  @Patch('is-available/:menuId')
  async updateAvailability(
    @Req() req: any,
    @Param('menuId') menuId: string,
    @Body() updateMenuDto: UpdateMenuDto,
  ) {
    const updateAvailability = await this.menuService.updateIsAvailable(
      menuId,
      this.bindRestaurant(req, updateMenuDto),
    );
    return updateAvailability;
  }

  @RestaurantScope({ param: 'menuId', ...MENU_DELETER })
  @Delete(':menuId')
  async remove(@Param('menuId') menuId: string) {
    return this.menuService.removeMenu(menuId);
  }
}
