import { Controller, Res, Post, Body, HttpStatus, Logger } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { OrderService } from 'src/order/order.service';
import { Response } from 'express';
import { Public } from 'src/decorators/public.decorator';

@Controller('webhooks')
export class PaymentController {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly orderService: OrderService,
  ) {}

  private readonly logger = new Logger('PaymentController');

  @Public()
  @Post('omise')
  async handleOmiseWebhook(@Body() event: any, @Res() res: Response) {
    if (!event || typeof event !== 'object') {
      this.logger.error('Webhook event body is missing or not an object:', event);
      return res.status(HttpStatus.BAD_REQUEST).send('Invalid webhook payload');
    }

    try {
      if (event.data?.object === 'charge') { // Check if the event is about a charge
        const omiseChargeId = event.data.id;
        const retrievedCharge = await this.paymentService.retrieveCharge(omiseChargeId); // <--- Use the service method

        if (event.key === 'charge.complete') {
          await this.orderService.handleWebhookUpdate(retrievedCharge.id, retrievedCharge.status);
        } else if (event.key === 'charge.failure') {
          await this.orderService.handleWebhookUpdate(retrievedCharge.id, 'failed');
        } else if (event.key === 'charge.expire') {
          await this.orderService.handleWebhookUpdate(retrievedCharge.id, 'expired');
        }

      }

      res.status(HttpStatus.OK).send('Webhook received and processed.');
    } catch (error) {
      this.logger.error('Error processing Omise webhook: ', error);
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).send('Error processing webhook (logged on server).'); // Send 500 on internal error
    }
  }
}