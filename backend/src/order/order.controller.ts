import { Controller, Get, Post, Body, Patch, Param, Delete, BadRequestException, UseGuards, UseInterceptors, UploadedFile, Query, Res } from '@nestjs/common';
import { OrderService } from './order.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/role.decorator';
import { Public } from '../decorators/public.decorator';
import { FileInterceptor } from '@nestjs/platform-express';
import { CreateOrderMenusDto } from './dto/create-order.dto';
import { diskStorage } from 'multer';
import { imageFileFilter, editFileName } from 'src/utils/file-upload.utils';
import * as fs from 'fs/promises'
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Response } from 'express';
import Omise from 'omise';

@Controller('order')
@UseGuards(RolesGuard)
@Roles(['user'])
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
  @Get()
  async findAllOrders() {
    return this.orderService.findAllOrders();
  }

  @Get(':orderId')
  async findOneOrder(@Param('orderId') orderId: string) {
    return this.orderService.findOneOrder(orderId);
  }

  // @Patch(':orderId')
  // async updateOrder(@Param('orderId') orderId: string, @Body() updateOrderDto: UpdateOrderDto) {
  //   return this.orderService.updateOrder(orderId, updateOrderDto);
  // }

  @Delete(':orderId')
  async removeOrder(@Param('orderId') orderId: string) {
    return this.orderService.removeOrder(orderId);
  }
}
