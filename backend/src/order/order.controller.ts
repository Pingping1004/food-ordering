import { Controller, Get, Post, Body, Patch, Param, Delete, BadRequestException, UseGuards, UseInterceptors, UploadedFile, Query, Res } from '@nestjs/common';
import { OrderService } from './order.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { Response } from 'express';
import Omise from 'omise';
import { Public } from '../decorators/public.decorator';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/role.decorator';
import { JwtAuthGuard } from 'src/guards/jwt-auth.guard';
import { OrderStatus, Role } from '@prisma/client';
import { CsrfGuard } from 'src/guards/csrf.guard';

@Controller('order')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles([Role.user, Role.admin, Role.cooker])
export class OrderController {
  constructor(private readonly orderService: OrderService) { }

  @Public()
  @Post('omise')
  async createOrder(@Body() createOrderDto: CreateOrderDto) {
    try {
      const result = await this.orderService.createOrderWithPayment(createOrderDto);
      console.log('Result object: ', result);

      return {
        message: 'Order created and payment initiated successfully',
        orderId: result.orderId,
        chargeId: result.chargeId,
        authorizeUri: result.authorizeUri,
        status: result.status,
        qrDownloadUri: result.qrDownloadUri,
      };
    } catch (error) {
      console.error('Error in createOrder controller function: ', error.message, error.stack);
      throw error;
    }
  }

  @Get('omise/complete')
  async handleOmiseReturn(
    @Query('charge_id') chargeId: string,
    @Query('orderId') orderId: string,
    @Res() res: Response
  ) {
    if (!chargeId) {
      console.error('Omise return_uri called without charge_id');
      return res.redirect(`${process.env.NGROK_FRONTEND_URL}/user/order/done/error`);
    }

    const omise = Omise({
      publicKey: process.env.OMISE_PUBLIC_KEY,
      secretKey: process.env.OMISE_SECRET_KEY,
    });

    try {
      const retrievedCharge = await omise.charges.retrieve(chargeId);

      if (retrievedCharge.paid) {
        console.log(`Omise charge ${chargeId} for order ${orderId} is paid successfully.`);
        // res.redirect(`${process.env.NGROK_FRONTEND_URL}/user/order/done`)
      } else {
        console.log(`Omise charge ${chargeId} not paid. Status: ${retrievedCharge.status}. Failure: ${retrievedCharge.failure_message}`);
        // res.redirect(`${process.env.NGROK_FRONTEND_URL}/user/order/done/${orderId}?status=failed`);
      }
    } catch (error) {
      console.error('Error handling Omise return: ', error);
      // res.redirect(`${process.env.NGROK_FRONTEND_URL}/user/order/done/${orderId}?status=error&message=${error.message}`);
    }
  }

  @Public()
  @Get('get-orders/:restaurantId')
  async findRestaurantOrders(@Param('restaurantId') restaurantId: string) {
    return this.orderService.findRestaurantOrders(restaurantId);
  }

  @Get(':orderId')
  async findOneOrder(@Param('orderId') orderId: string) {
    return this.orderService.findOneOrder(orderId);
  }

  @Patch(':orderId')
  async updateOrder(@Param('orderId') orderId: string, @Body() updateOrderDto: UpdateOrderDto) {
    return this.orderService.updateOrder(orderId, updateOrderDto);
  }

  @Patch('delay/:orderId')
  async updateDelay(@Param('orderId') orderId: string, @Body() updateOrderDto: UpdateOrderDto) {
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
