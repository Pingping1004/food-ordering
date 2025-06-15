import { Controller, Get, Post, Body, Patch, Param, Delete, BadRequestException, UseGuards, UseInterceptors, UploadedFile } from '@nestjs/common';
import { OrderService } from './order.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/role.decorator';
import { Public } from '../decorators/public.decorator';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { imageFileFilter, editFileName } from 'src/utils/file-upload.utils';
import * as fs from 'fs/promises'

@Controller('order')
@UseGuards(RolesGuard)
@Roles(['user'])
export class OrderController {
  constructor(private readonly orderService: OrderService) { }

  @Public()
  @Post()
  @UseInterceptors(FileInterceptor('orderSlip', {
    storage: diskStorage({
      destination: './uploads/paymentQR',
      filename: editFileName,
    }),
    // fileFilter: imageFileFilter,
  }))

  async createOrder(
    @Body() createOrderDto: CreateOrderDto,
    @UploadedFile() file: Express.Multer.File
  ) {
    const uploadedFilePath = file.path;

    try {
      // Only throw if the file or a direct link for menuImg is absolutely mandatory
      if (!file) throw new BadRequestException('Menu image or direct URL is required.');

      const result = await this.orderService.createOrder(createOrderDto, file);
      return result;
    } catch (error) {
      if (uploadedFilePath) {
        try {
          await fs.unlink(uploadedFilePath);
          console.log('Controller: Successfully delete temporary uploaded file: ', uploadedFilePath);
        } catch (fileDeleteError) {
          console.error('Controller: Failed to delete uploaded file ', uploadedFilePath, ' : ', fileDeleteError);
        }
      }

      console.error('Create menu controller failed: ', error);
      throw error;
    }
  }

  @Get()
  async findAllOrders() {
    return this.orderService.findAllOrders();
  }

  @Get(':orderId')
  async findOneOrder(@Param('orderId') orderId: string) {
    return this.orderService.findOneOrder(orderId);
  }

  @Patch(':orderId')
  async updateOrder(@Param('orderId') orderId: string, @Body() updateOrderDto: UpdateOrderDto) {
    return this.orderService.updateOrder(orderId, updateOrderDto);
  }

  @Delete(':orderId')
  async removeOrder(@Param('orderId') orderId: string) {
    return this.orderService.removeOrder(orderId);
  }
}
