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

        try {
            const response = await axios.post("https://connect.slip2go.com/api/verify-slip/qr-base64/info", data, {
                headers: {
                    Authorization: `Bearer ${process.env.SLIP_VERIFY_SECRET}`
                },
            });
    
            const result = response.data
            this.logger.debug(`Payment account response data: ${JSON.stringify(result, null, 2)}`)

            if (result.code !== "200200") throw new HttpException({ message: result.message, code: result.code }, HttpStatus.BAD_REQUEST);
          
            return result;

        } catch (error) {
            if (error instanceof HttpException) throw error;

            const err = error as AxiosError;
            const errorLog = {
                message: err.message,
                status: err.response?.status,
                statusText: err.response?.statusText,
                data: err.response?.data,
                headers: err.response?.headers,
            };
        
            this.logger.warn(`ยืนยันการชำระเงินล้มเหลว: ${JSON.stringify(errorLog, null, 2)}`);
            throw new HttpException({ message: err.message }, HttpStatus.BAD_REQUEST);
        }
    }
}
