import {
    forwardRef,
    Inject,
    Injectable,
    InternalServerErrorException,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import { PaymentStatus } from '@prisma/client';
import * as crypto from 'crypto';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { PaymentPayload } from 'src/common/interface/payment-gateway';
import { OrderService } from 'src/order/order.service';

@Injectable()
export class PaymentService {
    private readonly logger = new Logger(PaymentService.name);
    private readonly stripe: Stripe;

    constructor(
        private readonly configService: ConfigService,
        @Inject(forwardRef(() => OrderService)) private readonly orderService: OrderService,
    ) {

        const stripeSecret = this.configService.get<string>('STRIPE_SECRET_API_KEY');
        if (!stripeSecret) {
            throw new Error('Missing STRIPE_SECRET_API_KEY in env');
        }

        this.stripe = new Stripe(stripeSecret, {
            apiVersion: process.env.STRIPE_API_VERSION as Stripe.LatestApiVersion,
        });
    }

    async createPaymentCharge(payload: PaymentPayload) {
        console.log('Payment payload object: ', payload);
        const platformFee = Number(process.env.PLATFORM_COMMISSION_RATE);
        const successUrl = `${process.env.PAYMENT_SUCCESS_URL}/${payload.orderId}`;
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
        const webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');
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
        if (event.type === 'payment_intent.succeeded') {
            const paymentIntent = event.data.object;

            const orderId = paymentIntent.metadata?.orderId;
            const paymentIntentId = paymentIntent.id;

            console.log('orderId: ', orderId);
            console.log('paymentIntentId: ', paymentIntentId);

            if (!orderId || !paymentIntentId) {
                throw new Error('Missing metadata in session');
            }

            await this.orderService.updateOrderPaymentStatus(orderId, PaymentStatus.paid);
        }
    }

    verifyWebhookSignature(signature: string, payload: string): boolean {
        const webhookSecret = this.configService.get('omise').webhookSecret;

        if (!webhookSecret) {
            this.logger.error(
                'OMISE_WEBHOOK_SECRET is not set in environment variables!',
            );
            return false;
        }

        const parts = signature.split(',');
        let timestamp: string | undefined;
        let omiseSignature: string | undefined;

        for (const part of parts) {
            if (part.startsWith('t=')) {
                timestamp = part.substring(2);
            } else if (part.startsWith('v1-')) {
                omiseSignature = part.substring(3);
            }
        }

        if (!timestamp || !omiseSignature) {
            this.logger.warn('Invalid Omise webhook signature format.');
            return false;
        }

        const signedPayload = `${timestamp}.${payload}`;

        const expectedSignature = crypto
            .createHmac('sha256', webhookSecret)
            .update(signedPayload)
            .digest('hex');

        if (expectedSignature === omiseSignature) {
            return true;
        } else {
            this.logger.warn('Omise webhook signature verification failed.');
            return false;
        }
    }
}
