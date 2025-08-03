import {
    Controller,
    Res,
    Post,
    Logger,
    Req,
    Headers,
    Param,
    ForbiddenException,
    InternalServerErrorException,
    Body
} from '@nestjs/common';
import { OrderService } from 'src/order/order.service';
import { PaymentService } from './payment.service';
import { Request, Response } from 'express';
import { PaymentPayload } from 'src/common/interface/payment-gateway';
import { PaymentMethod } from '@prisma/client';
import { Public } from 'src/decorators/public.decorator';

@Public()
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

    @Post('create/:orderId')
    async createPayment(@Req() req: any, @Param('orderId') orderId: string, @Body() body: unknown) {
        const userId = req.user?.userId;
        const order = await this.orderService.findOneOrder(orderId);

        if (userId && order.userId !== userId) {
            throw new ForbiddenException('You do not own this order');
        }

        try {
            const paymentPayload: PaymentPayload = {
                userId,
                userEmail: order.userEmail,
                orderId,
                amountInStang: Math.round(Number(order.totalAmount.toFixed(2)) * 100),
                currency: 'thb',
                method: PaymentMethod.promptpay,
                restaurantId: order.restaurantId,
            };

            const paymentIntent = await this.paymentService.createPaymentCharge(paymentPayload);

            return {
                orderId: order.orderId,
                intentId: paymentIntent.id,
                checkoutUrl: paymentIntent.url,
                paymentGatewayIntentId: paymentIntent.payment_intent as string,
                status: 'pending',
            }
        } catch (error) {
            this.logger.error(`Failed to create payment for order: ${orderId}: ${error.message}`);
            throw new InternalServerErrorException('Failed to create payment session');
        }
    }
}
