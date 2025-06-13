import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { OrderService } from './order.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/role.decorator';
import { Public } from '../decorators/public.decorator';

@Controller('order')
@UseGuards(RolesGuard)
@Roles(['user'])
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Public()
  @Post()
  async createPost(@Body() createOrderDto: CreateOrderDto) {
    return this.orderService.createOrder(createOrderDto);
  }

  @Get()
  async findAll() {
    return this.orderService.findAllOrders();
  }

  @Get(':orderId')
  async findOne(@Param('orderId') orderId: string) {
    return this.orderService.findOneOrder(orderId);
  }

  @Patch(':orderId')
  async update(@Param('orderId') orderId: string, @Body() updateOrderDto: UpdateOrderDto) {
    return this.orderService.updateOrder(orderId, updateOrderDto);
  }

  @Delete(':orderId')
  async remove(@Param('orderId') orderId: string) {
    return this.orderService.removeOrder(orderId);
  }
}
