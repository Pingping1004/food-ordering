import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, UseInterceptors, UploadedFile } from '@nestjs/common';
import { OrderService } from './order.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/role.decorator';
import { Public } from '../decorators/public.decorator';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller('order')
@UseGuards(RolesGuard)
@Roles(['user'])
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Public()
  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async createOrder(@Body() createOrderDto: CreateOrderDto, @UploadedFile() file?: Express.Multer.File) {
    return this.orderService.createOrder(createOrderDto);
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
