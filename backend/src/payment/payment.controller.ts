import {
    Controller,
    Res,
    Post,
    Body,
    HttpStatus,
    Logger,
} from '@nestjs/common';
import { PaymentService } from './payment.service';
import { OrderService } from 'src/order/order.service';
import { Response } from 'express';
import { Public } from 'src/decorators/public.decorator';
import { IsPaid } from '@prisma/client';

@Controller('webhooks')
export class PaymentController {
    constructor(
        private readonly paymentService: PaymentService,
        private readonly orderService: OrderService,
    ) { }

    private readonly logger = new Logger('PaymentController');

    @Public()
    @Post('omise')
    async handleOmiseWebhook(@Body() event: any, @Res() res: Response) {
        this.logger.log('Webhook received and processed');

        if (!event || typeof event !== 'object') {
            this.logger.error(
                'Webhook event body is missing or not an object:',
                event,
            );
            return res.status(HttpStatus.BAD_REQUEST).send('Invalid webhook payload');
        }

        try {
            if (event.data?.object === 'charge') {
                // Check if the event is about a charge
                const omiseChargeId = event.data.id;
                this.logger.log(`Omise chargeId: ${omiseChargeId}`);

                let retrievedCharge;
                try {
                    retrievedCharge = await this.paymentService.retrieveCharge(omiseChargeId);
                    this.logger.log(`Payment status: ${retrievedCharge.status}`);
                } catch (err) {
                    this.logger.error(`Failed to retrieve charge: ${err.message}`, err.stack);
                    return res.status(500).send('Failed to retrieve Omise charge');
                }

                this.logger.log(`Webhook event key: ${event.key}`);
                this.logger.log(`Received full webhook payload: ${JSON.stringify(event)}`);

                if (event.key === 'charge.complete') {
                    await this.orderService.handleWebhookUpdate(retrievedCharge.id, IsPaid.paid);
                } else if (event.key === 'charge.failure') {
                    await this.orderService.handleWebhookUpdate(retrievedCharge.id, IsPaid.rejected);
                } else if (event.key === 'charge.expire') {
                    await this.orderService.handleWebhookUpdate(retrievedCharge.id, IsPaid.unpaid);
                }
            }

            res.status(HttpStatus.OK).send('Webhook received and processed.');
        } catch (error) {
            this.logger.error(`Error processing Omise webhook: ${error.message}`, error.stack);
            res.status(HttpStatus.INTERNAL_SERVER_ERROR).send('Error processing webhook (logged on server).');
        }
    }
}
