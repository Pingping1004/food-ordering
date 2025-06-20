import { Controller, Req, Post, Body, UsePipes, BadRequestException, ValidationPipe, HttpCode, HttpStatus, Header, Headers } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { OrderService } from 'src/order/order.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { WebhookEventDto } from './dto/webhook-event.dto';
import { Request } from 'express';
import Omise from 'omise';

@Controller('webhooks')
export class PaymentController {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly orderService: OrderService,
  ) {}
}
