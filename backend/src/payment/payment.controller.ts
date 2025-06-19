import { Controller, Req, Post, Body, UsePipes, BadRequestException, ValidationPipe, HttpCode, HttpStatus, Header, Headers } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { OrderService } from 'src/order/order.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { WebhookEventDto } from './dto/webhook-event.dto';
import { Request } from 'express';
import Omise from 'omise';

@Controller('payment')
export class PaymentController {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly orderService: OrderService,
  ) {}

  @Post('mobile-payment')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ 
    transform: true, 
    whitelist: true, 
    forbidNonWhitelisted: true,
  }))
  async createMobilePayment(@Body() createPaymentDto: CreatePaymentDto) {
    try {
      const charge = await this.paymentService.createMobileBankingCharge(createPaymentDto);

      return {
        message: 'Payment initiated successfully',
        chargeId: charge.id,
        authorizeUri: charge.authorize_uri,
        status: charge.status,
      }
    } catch (error) {
      console.error(`Error in createMobileBankingCharge: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Post('webhooks')
  @HttpCode(HttpStatus.OK)
  async handleOmiseWebhook(
    @Headers('x-omise-signature') signature: string,
    @Req() req: Request,
    @Body() eventDto: WebhookEventDto,
  ) {
    const rawBody = (req as any).rawBody;

    if (!rawBody) {
      console.error('Raw body not available for webhook verification.');
    throw new BadRequestException('Raw body is missing for signature verification.');
    }

    const isValidSignature = this.paymentService.verifyWebhookSignature(signature, rawBody.toString());
    if (!isValidSignature) {
      console.warn('Invalid Omise webhook signature.');
      throw new BadRequestException('Invalid webhook signature.');
    }

    console.log('Receive Omise webhook event: ', eventDto.type);

    try {
      switch (eventDto.type) {
        case 'charge.complete':
          const charge = eventDto.data as Omise.Charges.ICharge;

          if (charge.status === 'successful') {
            await this.orderService.updateOrderPaymentStatus(
              charge.metadata.order_id,
              'paid',
              charge.id,
              charge.amount,
              charge.failure_message,
            );

            console.log(`Order ${charge.metadata.order_id} marked as completed for charge ${charge.id}`);
          } else if (charge.status === 'failed') {
            await this.orderService.updateOrderPaymentStatus(
            charge.metadata.order_id,
            'unpaid',
            charge.id,
            charge.amount,
            charge.failure_message,
            );

            console.warn(`Order ${charge.metadata.order_id} marked as failed: ${charge.failure_message}`);
          } else {
            console.log(`Charge ${charge.id} has status: ${charge.status}. No action taken.`)
          }
          break;

          case 'transfer.complete':
             // Handle transfer complete events if you are dealing with payouts
            console.log(`Transfer ${eventDto.data.id} completed.`);
            break;

          // Add other event types you need to handle (e.g., refund.complete)
          default:
            console.log(`Unhandled Omise event type: ${eventDto.type}`)
            break;
      }

      return { received: true, message: 'Webhook processed successfully' };
    } catch (error) {
      console.log(`Error processing webhook event ${eventDto.id}: ${error.message}`, error.stack);
      return { received: true, message: 'Webhook processed with internal errors, check logs.' };
    }
  }
}
