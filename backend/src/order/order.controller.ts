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
  Query,
  NotFoundException,
  BadRequestException,
  Headers,
} from '@nestjs/common';
import { OrderService } from './order.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { Request } from 'express';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/role.decorator';
import { JwtAuthGuard } from 'src/guards/jwt-auth.guard';
import { OrderStatus, Role, User } from '@prisma/client';
import { CsrfGuard } from 'src/guards/csrf.guard';
import { Public } from 'src/decorators/public.decorator';
import { UpdateOrderDto } from './dto/update-order.dto';

@Controller('order')
@UseGuards(JwtAuthGuard, RolesGuard, CsrfGuard)
@Roles([Role.user, Role.admin, Role.cooker])
export class OrderController {
  constructor(private readonly orderService: OrderService) { }

  private readonly logger = new Logger('OrderController');

  @Public()
  @Post('verify-and-create-order')
  async createOrder(
    @Body() createOrderDto: CreateOrderDto,
    @Req() req: Request & { user?: User },
  ) {
    try {
      const userId = req.user?.userId || undefined;

      const result = await this.orderService.createOrder(createOrderDto, userId);
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

  @Get('today/:restaurantId')
  async findRestaurantTodayOrders(@Param('restaurantId') restaurantId: string) {
    return this.orderService.findRestaurantTodayOrders(restaurantId);
  }

  @Public()
  @Get(':orderId')
  async findOneOrder(@Param('orderId') orderId: string, @Headers('x-order-secret') orderSecret: string) {
    return this.orderService.findOneOrder(orderId, orderSecret);
  }

  @Get('new/:restaurantId')
  async getNewOrders(@Param('restaurantId') restaurantId: string, @Query('after') after?: Date) {
    const timestamp = after ? new Date(after) : undefined
    return this.orderService.getOrdersAfterTimeStamp(restaurantId, timestamp)
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
    if (!updateOrderDto.isDelay) throw new NotFoundException('ไม่พบสถานะออเดอร์ที่ต้องการแก้ไข')

    return this.orderService.updateDelay(orderId, updateOrderDto.isDelay);
  }

  @Public()
  @Patch('cancel/:orderId')
  async cancelOrder(@Param('orderId') orderId: string, @Body('orderSecret') orderSecret: string) {
    if (!orderId) throw new NotFoundException("ไม่พบออเดอร์ไอดี")

    return this.orderService.cancelOrder(orderId, orderSecret);
  }

  @Patch('reject/:orderId')
  async rejectOrder(@Param('orderId') orderId: string) {
    return this.orderService.updateOrderStatus(orderId, "rejected");
  }

  @Patch('accept/:orderId')
  async acceptOrder(@Param('orderId') orderId: string) {
    return this.orderService.updateOrderStatus(orderId, "accepted");
  }

  @Delete(':orderId')
  async removeOrder(@Param('orderId') orderId: string) {
    return this.orderService.removeOrder(orderId);
  }
}
