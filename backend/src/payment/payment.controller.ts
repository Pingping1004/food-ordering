import {
    Controller,
    Post,
    Logger,
    Body,
} from '@nestjs/common';
import { OrderService } from 'src/order/order.service';
import { PaymentService } from './payment.service';
import { Public } from 'src/decorators/public.decorator';
import { CreatePaymentDto } from './dto/create-payment.dto';

@Public()
@Controller('payment')
export class PaymentController {
    constructor(
        private readonly paymentService: PaymentService,
    ) { }

    private readonly logger = new Logger('PaymentController');

    @Post('verify')
    verifyPayment(@Body() body: CreatePaymentDto) {
        return this.paymentService.verifyPayment(body.restaurantId, body.orderId, body.paymentSlipImg)
    }
}
