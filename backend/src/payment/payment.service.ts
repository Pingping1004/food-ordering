import {
    HttpException,
    HttpStatus,
    Injectable,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import axios, { AxiosError } from 'axios';
import { PaymentPayload } from 'src/common/interface/accountType';
import { PayoutService } from 'src/payout/payout.service';

@Injectable()
export class PaymentService {
    private readonly logger = new Logger(PaymentService.name);

    constructor(
        private readonly payoutService: PayoutService,
    ) { }

    async verifyPayment(data: PaymentPayload) {
        if (!process.env.SLIP_VERIFY_SECRET) throw new NotFoundException("SLIP_VERIFY_SECRET key missing");
        this.logger.log("Secret:", process.env.SLIP_VERIFY_SECRET);

        try {
            const response = await axios.post("https://connect.slip2go.com/api/verify-slip/qr-base64/info", data, {
                headers: {
                    Authorization: `Bearer ${process.env.SLIP_VERIFY_SECRET}`
                },
            });
    
            const result = response.data
            this.logger.debug("Payment account response data: ", response.data.receiver.account.proxy)

            if (result.code !== "200200") throw new HttpException({ message: result.message, code: result.code }, HttpStatus.BAD_REQUEST);
          
            return result;

        } catch (error) {
            if (error instanceof HttpException) throw error;

            const err = error as AxiosError;
        
            this.logger.warn("ยืนยันการชำระเงินล้มเหลว:", err.response?.data || err.message);
            throw new HttpException({ message: err.message }, HttpStatus.BAD_REQUEST);
        }
    }
}
