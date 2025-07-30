import {
    Controller,
    Res,
    Post,
    Logger,
    Req,
    Headers,
} from '@nestjs/common';
import { PaymentService } from './payment.service';
import { OrderService } from 'src/order/order.service';
import { Request, Response } from 'express';

@Controller('payment')
export class PaymentController {
    constructor(
        private readonly paymentService: PaymentService,
        private readonly orderService: OrderService,
    ) { }

    private readonly logger = new Logger('PaymentController');

    @Post('webhook')
    async handleStripeWebhook(
        @Req() req: Request,
        @Res() res: Response,
        @Headers('stripe-signature') signature: string,
    ) {
        try {
            const event = await this.paymentService.verifyWebhook(req.body, signature);

            await this.paymentService.handleWebhook(event);
            res.status(200).send('Successfully handle webhook');
        } catch (error) {
            this.logger.error(`Stripe webhook error: ${error.message}`);
            res.status(400).send(`Webhook error: ${error.message}`);
        }
    }
}
