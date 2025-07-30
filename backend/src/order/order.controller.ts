import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  Res,
  Req,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { OrderService } from './order.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { Response, Request } from 'express';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/role.decorator';
import { JwtAuthGuard } from 'src/guards/jwt-auth.guard';
import { PaymentStatus, Role, User } from '@prisma/client';
import { CsrfGuard } from 'src/guards/csrf.guard';

@Controller('order')
@UseGuards(JwtAuthGuard, RolesGuard, CsrfGuard)
@Roles([Role.user, Role.admin, Role.cooker])
export class OrderController {
  constructor(private readonly orderService: OrderService) { }

  private readonly logger = new Logger('OrderController');

  @Post('create')
  async createOrder(
    @Body() createOrderDto: CreateOrderDto,
    @Req() req: Request & { user: User },
  ) {
    try {
      const userId = req.user.userId;
      if (!userId) throw new Error('User ID is required to create an order');

      const result = await this.orderService.createOrderWithPayment(userId, createOrderDto);
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

  @Get('omise/complete')
  async handleOmiseReturn(
    @Query('intentId') intentId: string,
    @Query('orderId') orderId: string,
    @Res() res: Response,
  ) {
    if (!intentId) {
      this.logger.error('Return_uri called without intentId');
      throw new NotFoundException('Cannot find intentId');
    }

    if (!orderId) {
      this.logger.error(`Not found userId in handle payment status return`);
      throw new NotFoundException('Cannot find orderId');
    }

    try {
      // const retrievedCharge = await omise.charges.retrieve(chargeId);

      const successRedirectUrl = `${process.env.FRONTEND_BASE_URL}/user/order/done/${orderId}`;

        await this.orderService.updateOrderPaymentStatus(orderId, PaymentStatus.paid);
        return res.status(200).json({
          message: 'Payment successful',
          redirectUrl: successRedirectUrl,
        });
    } catch (error) {
      this.logger.error('Error handling Omise return: ', error);
      return res.status(400).json({
        message: 'Payment failed',
        // redirectUrl: successRedirectUrl,
      });
    }
  }

  @Get('get-orders/:restaurantId')
  async findRestaurantOrders(@Param('restaurantId') restaurantId: string) {
    return this.orderService.findRestaurantOrders(restaurantId);
  }

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
