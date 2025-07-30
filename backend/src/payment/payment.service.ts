import {
    forwardRef,
    Inject,
    Injectable,
    InternalServerErrorException,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import { PaymentStatus } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { PaymentPayload } from 'src/common/interface/payment-gateway';
import { OrderService } from 'src/order/order.service';
import { UserService } from 'src/user/user.service';
import { PayoutService } from 'src/payout/payout.service';

@Injectable()
export class PaymentService {
    private readonly logger = new Logger(PaymentService.name);
    private readonly stripe: Stripe;

    constructor(
        private readonly configService: ConfigService,
        private readonly userService: UserService,
        private readonly payoutService: PayoutService,
        @Inject(forwardRef(() => OrderService)) private readonly orderService: OrderService,
    ) {

        // const stripeSecret = this.configService.get<string>('STRIPE_SECRET_API_KEY');
        const stripeSecret = process.env.STRIPE_SECRET_API_KEY;
        if (!stripeSecret) {
            throw new Error('Missing STRIPE_SECRET_API_KEY in env');
        }

        this.stripe = new Stripe(stripeSecret, {
            apiVersion: process.env.STRIPE_API_VERSION as Stripe.LatestApiVersion,
        });
    }

    async createPaymentCharge(payload: PaymentPayload) {
        const platformFee = Number(process.env.PLATFORM_COMMISSION_RATE);
        const successUrl = `${process.env.PAYMENT_SUCCESS_URL}/${payload.orderId}`;
        const { email: userEmail } = await this.userService.findOneUser(payload.userId);
        if (!platformFee) throw new NotFoundException('No value for PLATFORM_COMMISSION_RATE in ENV');

        try {
            const paymentSession = await this.stripe.checkout.sessions.create({
                payment_method_types: ['promptpay'],
                line_items: [
                    {
                        price_data: {
                            currency: payload.currency || 'thb',
                            product_data: {
                                name: 'Promptserve service',
                            },
                            unit_amount: payload.amountInStang,
                        },
                        quantity: 1,
                    },
                ],
                mode: 'payment',
                success_url: successUrl,
                customer_email: userEmail,
                metadata: {
                    orderId: payload.orderId,
                    restaurantId: payload.restaurantId,
                },
                payment_intent_data: {
                    metadata: {
                        orderId: payload.orderId,
                        restaurantId: payload.restaurantId,
                    }
                }
            });

            return paymentSession;
        } catch (error) {
            this.logger.error('Failed to create Payment charge: ', error.message);
            throw new InternalServerErrorException('Failed to process payment');
        }
    }

    async verifyWebhook(rawBody: Buffer, signature: string): Promise<Stripe.Event> {
        // const webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');
        const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
        if (!webhookSecret) throw new NotFoundException('No value for STRIPE_WEBHOOK_SECRET in ENV');

        try {
            const event = this.stripe.webhooks.constructEvent(
                rawBody,
                signature,
                webhookSecret,
            );

            return event;
        } catch (error) {
            this.logger.error(`Failed to verify webhook: ${error.message}`, error.stack);
            throw new InternalServerErrorException('Invalid Stripe webhook signature');
        }
    }

    async handleWebhook(event: Stripe.Event): Promise<void> {
        if (event.type === 'payment_intent.succeeded' || event.type === 'checkout.session.completed') {
            const paymentIntent = event.data.object;

            const orderId = paymentIntent.metadata?.orderId;
            const paymentIntentId = paymentIntent.id;

            if (!orderId || !paymentIntentId) {
                throw new Error('Missing metadata in session');
            }

            await this.orderService.updateOrderPaymentStatus(orderId, PaymentStatus.paid);
            await this.payoutService.createPayout(orderId);
        }
    }
}
