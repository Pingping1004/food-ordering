import {
    BadRequestException,
    forwardRef,
    Injectable,
    Logger,
} from '@nestjs/common';
import axios from 'axios';
import { PaymentPayload } from 'src/common/interface/accountType';
import { PayoutService } from 'src/payout/payout.service';

@Injectable()
export class PaymentService {
    private readonly logger = new Logger(PaymentService.name);

    constructor(
        private readonly payoutService: PayoutService,
    ) { }

    async verifyPayment(data: PaymentPayload) {
        try {
            const response = await axios.post("https://connect.slip2go.com/api/verify-slip/qr-code/info", data, {
                headers: {
                    Authorization: `Bearer ${process.env.SLIP_VEERIFY_SECRET}`
                },
            });
    
            const result = response.data
            console.log("Payment Verification Response: ", result)

            if (!result || result.message !== "Slip found") {
                throw new BadRequestException("Payment verification failed");
            }
          
            return result.data;

        } catch (error) {
            this.logger.warn('⚠️ Order created but Make webhook failed:', error.message);
            throw error
        }
    }
}
