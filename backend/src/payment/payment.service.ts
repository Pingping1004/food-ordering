import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { OrderService } from '../order/order.service';
import * as  crypto from 'crypto'
import * as Omise from 'omise';
import { ConfigService } from '@nestjs/config';
import { startOfDay, endOfDay } from 'date-fns';
import { CreatePaymentDto } from './dto/create-payment.dto';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  private omiseClient: Omise.IOmise;
  
  constructor(
    private configService: ConfigService,
  ) {
    const omiseConfig = this.configService.get('omise');
    this.omiseClient = Omise({
      publicKey: omiseConfig.publicKey,
      secretKey: omiseConfig.secretKey,
      omiseVersion: omiseConfig.apiVersion,
    });
  }

  async createMobileBankingCharge(
    amount: number,
    bankType: string,
    returnUri: string,
    orderId: string,
  ): Promise<Omise.Charges.ICharge> {
    try {
      const charge = await this.omiseClient.charges.create({
        amount: amount * 100,
        currency: 'THB',
        source: {
          type: bankType,
          amount: amount * 100,
          currency: 'THB',
        },
        return_uri: returnUri,
        metadata: {
          order_id: orderId,
        },
        webhook_endpoints: ["https://fefb-124-120-2-163.ngrok-free.app/webhooks/omise"],
      });

      return charge;
    } catch (error) {
      this.logger.error(`Failed to create mobile banking charge for order ${orderId}: ${error.message || error}`);
      throw new InternalServerErrorException('Failed to process mobile banking payment.');
    }
  }

  verifyWebhookSignature(signature: string, payload: string): boolean {
    const webhookSecret = this.configService.get('omise').webhookSecret;

    if (!webhookSecret) {
      this.logger.error('OMISE_WEBHOOK_SECRET is not set in environment variables!')
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

    const expectedSignature = crypto.createHmac('sha256', webhookSecret).update(signedPayload).digest('hex');

    if (expectedSignature === omiseSignature) {
      return true;
    } else {
      this.logger.warn('Omise webhook signature verification failed.');
      return false;
    }
  }

  async retrieveCharge(chargeId: string): Promise<Omise.Charges.ICharge> {
    try {
      return await this.omiseClient.charges.retrieve(chargeId);
    } catch (error) {
      this.logger.error(`Omise Retrieve Charge Error for ${chargeId}: ${error.message || error}`);
      throw new InternalServerErrorException('Failed to retrieve charge details.')
    }
  }
}
