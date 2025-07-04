import { Controller, Get, Post, Body, Patch, UsePipes, ValidationPipe, Param, Delete, Req, UseGuards, UploadedFile, UploadedFiles, BadRequestException, UseInterceptors, NotFoundException, Query } from '@nestjs/common';
import { MenuService, MenusWithDisplayPrices } from './menu.service';
import { CreateBulkMenusJsonPayload, CreateMenuDto } from './dto/create-menu.dto';
import { UpdateMenuDto } from './dto/update-menu.dto';
import * as fs from 'fs/promises';
import { Public } from '../decorators/public.decorator';
import { RolesGuard } from '../guards/roles.guard';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { imageFileFilter, editFileName } from 'src/utils/file-upload.utils';
import { Express } from 'express';
import { CsvMenuItemData } from './dto/create-menu.dto';
import { JwtAuthGuard } from 'src/guards/jwt-auth.guard';
import { Role } from '@prisma/client';
import { Roles } from 'src/decorators/role.decorator';

@Controller('menu')
// @UseGuards(JwtAuthGuard, RolesGuard)
// @Roles([Role.admin, Role.cooker])
export class MenuController {
  constructor(
    private readonly menuService: MenuService) { }

  @Post('single')
  @UseInterceptors(
    FileInterceptor('menuImg', {
      storage: diskStorage({
        destination: './uploads/menus',
        filename: editFileName,
      }),
      fileFilter: imageFileFilter,
    }
    ))

  async createSingleMenu(
    @Req() req: any,
    @Body() createMenuDto: CreateMenuDto,
    @UploadedFile() file?: Express.Multer.File
  ) {
    console.log('Request object: ', createMenuDto);
    if (!createMenuDto.restaurantId) throw new NotFoundException('RestaurantId not found in create mneu controller');
    
    let uploadedFilePath: string | undefined;

    try {
      const menuData: CreateMenuDto = { ...createMenuDto };
      if (file) {
        menuData.menuImg = `/uploads/menus/${file.filename}`;
        uploadedFilePath = file.path;
      }

      const result = await this.menuService.createSingleMenu(menuData);

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

  @Post('bulk')
  async createBulkMenus(
        @Body() payload: CreateBulkMenusJsonPayload, // <-- Using the correct DTO
    ) {
        console.log('Received JSON payload for bulk create:', payload); // This log is correct

        // --- THE FIX IS HERE ---
        // Change the check to refer to 'createMenuDto'
        if (!payload.createMenuDto || !Array.isArray(payload.createMenuDto) || payload.createMenuDto.length === 0) {
            // Also, update the message to be more specific to 'createMenuDto'
            throw new BadRequestException('The request body must contain a non-empty "createMenuDto" array.');
        }

        // Now, pass the correct data to your service
        try {
            const result = await this.menuService.createBulkMenus( // Assuming your service method name
                payload.restaurantId,
                payload.createMenuDto, // <-- Pass the correct array
            );
            return result; // Return the result from the service
        } catch (error) {
            // Re-throw exceptions from the service layer to be caught by NestJS filters
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
  async getRestaurantMenus(@Param('restaurantId') restaurantId: string): Promise<MenusWithDisplayPrices[]> {
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
    })
  )

  async updateSingleMenu(
    @Req() req: any,
    @Param('menuId') menuId: string,
    @Body() updateMenuDto: UpdateMenuDto,
    @UploadedFile() file?: Express.Multer.File
  ) {
    // const restaurantId = req.user.restaurantId;
    const restaurantId = req.body.restaurantId;
    if (!restaurantId) throw new NotFoundException('RestaurantId not found in update menu controller');

    let uploadedFilePath: string | undefined;
    try {
      if (!menuId) throw new BadRequestException('Menu ID is required in URL params');

      const menuData: UpdateMenuDto = { ...updateMenuDto };

      if (file) {
        menuData.menuImg = `uploads/menus/${file.filename}`;
        uploadedFilePath = file.path;
      } else if (updateMenuDto.menuImg === undefined) {
        menuData.menuImg = updateMenuDto.menuImg;
      }

      const result = await this.menuService.updateMenu(
        restaurantId,
        [menuId],
        [menuData],
      );

      console.log('Single menu update successful in controller: ', result);
      return result;
    } catch (error) {
      console.error('Single menu update failed in controller: ', error);
      if (uploadedFilePath) {
        try {
          await fs.unlink(uploadedFilePath);
          console.log(`Controller: Successfully deleted temporary uploaded file: ${uploadedFilePath}`);
        } catch (fileDeleteError) {
          console.error(`Controller: Failed to delete uploaded file ${uploadedFilePath}:`, fileDeleteError);
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
    })
  )
  async bulkUpdateMenus(
    @Req() req: any,
    @Query('menuIds') menuIds: string[],
    @Body() updateMenuDto: string,
    @UploadedFiles() files?: Express.Multer.File[]
  ) {
    // const restaurantId = req.user.restaurantId;
    const restaurantId = req.body.restaurantId;
    if (!restaurantId) throw new NotFoundException('RestaurantId not found in bulk update menu controller');

    let parsedUpdateMenuDtos: UpdateMenuDto[];
    let uploadedFilePaths: string[] = [];
    try {
      try {
        parsedUpdateMenuDtos = JSON.parse(updateMenuDto);
        if (!Array.isArray(parsedUpdateMenuDtos)) {
          throw new BadRequestException('UpdateMenuDto field must be a JSON array');
        }
      } catch (parseError) {
        throw new BadRequestException('Invalida JSON format for updateMenuDto field');
      }

      parsedUpdateMenuDtos.forEach((dto, index) => {
        const file = files && files[index];

        if (file) {
          dto.menuImg = `uploads/menus/${file.filename}`;
          uploadedFilePaths.push(file.path);
        }
      });

      const result = await this.menuService.updateMenu(
        restaurantId,
        menuIds,
        parsedUpdateMenuDtos,
        // files,
      );

      console.log('Bulk menu update successfully in controller: ', result);
      return result;
    } catch (error) {
      console.error('Bulk menu update failed in controller: ', error);
      await Promise.all(uploadedFilePaths.map(async (filePath) => {
        try {
          await fs.unlink(filePath);
          console.log(`Controller: Successfully deleted temporary uploaded file: ${filePath}`);
        } catch (fileDeleteError) {
          console.error(`Controller: Failed to delete uploaded file ${filePath}:`, fileDeleteError);
        }
      }));
      throw error;
    }
  }

  @Patch('is-available/:menuId')
  async updateAvailability(
    @Param('menuId') menuId: string,
    @Body() updateMenuDto: UpdateMenuDto,
  ) {
    const updateAvailability = await this.menuService.updateIsAvailable(menuId, updateMenuDto);
    return updateAvailability;
  }

  @Delete(':menuId')
  async remove(@Param('menuId') menuId: string) {
    return this.menuService.removeMenu(menuId);
  }
}
