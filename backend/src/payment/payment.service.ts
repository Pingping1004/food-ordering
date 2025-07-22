import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PaymentMethodType } from '@prisma/client';
import * as crypto from 'crypto';
import Omise from 'omise';
import type { Charges } from 'omise';
import { ConfigService } from '@nestjs/config';
import * as moment from 'moment';
import Decimal from 'decimal.js';
@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  private readonly omiseClient: Omise.IOmise;

  constructor(private readonly configService: ConfigService) {
    const omiseConfig = this.configService.get('omise');
    this.omiseClient = Omise({
      publicKey: omiseConfig.publicKey,
      secretKey: omiseConfig.secretKey,
      omiseVersion: omiseConfig.apiVersion,
    });
  }

  async createPromptPayCharge(
    amount: number | Decimal,
    paymentMethodType: PaymentMethodType,
    returnUri: string,
    orderId: string,
  ): Promise<Charges.ICharge> {
    try {
      type ChargeCreateOptions = Parameters<
        typeof this.omiseClient.charges.create
      >[0];
      const decimalAmount = amount instanceof Decimal ? amount : new Decimal(amount);
      const amountInStang = decimalAmount.mul(100).toNumber();

      const expirationTime = moment.utc().add(10, 'minutes').toISOString();
      const chargeOptions: ChargeCreateOptions = {
        amount: (amountInStang),
        currency: 'THB',
        return_uri: returnUri,
        metadata: {
          order_id: orderId,
        },
        expires_at: expirationTime,
      };

      if (paymentMethodType === 'promptpay') {
        chargeOptions.source = {
          type: 'promptpay',
        } as any;
      } else if (paymentMethodType.startsWith('mobile_banking')) {
        chargeOptions.source = {
          type: paymentMethodType,
          amount: amountInStang,
          currency: 'THB',
        };
      } else {
        throw new Error('Unsupported payment method type');
      }

      const charge = await this.omiseClient.charges.create(chargeOptions);
      // this.logger.log('Charge object: ', charge);
      return charge;
    } catch (error) {
      this.logger.error('Failed to create Payment charge: ', error.message);
      throw new InternalServerErrorException('Failed to process payment');
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

  async retrieveCharge(chargeId: string): Promise<Omise.Charges.ICharge> {
    try {
      const result = await this.omiseClient.charges.retrieve(chargeId);
      console.log('Retrieve charge result: ', result);
      return result;
    } catch (error) {
      this.logger.error(
        `Omise Retrieve Charge Error for ${chargeId}: ${error.message || error}`,
      );
      throw new InternalServerErrorException(
        'Failed to retrieve charge details.',
      );
    }
  }
}
