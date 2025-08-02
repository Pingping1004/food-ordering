import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
  Logger,
} from '@nestjs/common';
import { OrderService } from './order.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { Request } from 'express';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/role.decorator';
import { JwtAuthGuard } from 'src/guards/jwt-auth.guard';
import { Role, User } from '@prisma/client';
import { CsrfGuard } from 'src/guards/csrf.guard';
import { Public } from 'src/decorators/public.decorator';

@Controller('order')
@UseGuards(JwtAuthGuard, RolesGuard, CsrfGuard)
@Roles([Role.user, Role.admin, Role.cooker])
export class OrderController {
  constructor(private readonly orderService: OrderService) { }

  private readonly logger = new Logger('OrderController');

  @Public()
  @Post('create')
  async createOrder(
    @Body() createOrderDto: CreateOrderDto,
    @Req() req: Request & { user?: User },
  ) {
    try {
      const userId = req.user?.userId || undefined;
      if (!userId && !createOrderDto.userEmail) throw new Error('User ID is required to create an order');

      // const result = await this.orderService.createOrderWithPayment(userId, createOrderDto);
      const result = await this.orderService.createOrderWithPayment(createOrderDto, userId);
      return result;
    } catch (error) {
      this.logger.error(
        'Error in createOrder controller function: ',
        error.message,
        error.stack,
      );
      throw error;
    }
  }

  @Get('get-orders/:restaurantId')
  async findRestaurantOrders(@Param('restaurantId') restaurantId: string) {
    return this.orderService.findRestaurantOrders(restaurantId);
  }

  @Public()
  @Get(':orderId')
  async findOneOrder(@Param('orderId') orderId: string) {
    return this.orderService.findOneOrder(orderId);
  }

  @Get('weekly/:restaurantId')
  async findWeeklyOrdersForRestaurant(
    @Param('restaurantId') restaurantId: string,
  ) {
    return this.orderService.findWeeklyOrderForRestaurant(restaurantId);
  }

  @Patch(':orderId')
  async updateOrder(
    @Param('orderId') orderId: string,
    @Body() updateOrderDto: UpdateOrderDto,
  ) {
    return this.orderService.updateOrder(orderId, updateOrderDto);
  }

  @Patch('delay/:orderId')
  async updateDelay(
    @Param('orderId') orderId: string,
    @Body() updateOrderDto: UpdateOrderDto,
  ) {
    return this.orderService.updateDelay(orderId, updateOrderDto);
  }

  @Patch('update-status/:orderId')
  async updateOrderStatus(@Param('orderId') orderId: string) {
    return this.orderService.updateOrderStatus(orderId);
  }

  @Delete(':orderId')
  async removeOrder(@Param('orderId') orderId: string) {
    return this.orderService.removeOrder(orderId);
  }
}
