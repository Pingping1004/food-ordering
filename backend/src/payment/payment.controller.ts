import {
    Controller,
    Post,
    Get,
    Headers,
    Body,
    Param,
} from '@nestjs/common';
import { PaymentService } from './payment.service';
import { Public } from 'src/decorators/public.decorator';
import { CreatePaymentDto } from './dto/create-payment.dto';

@Public()
@Controller('payment')
export class PaymentController {
    constructor(
        private readonly paymentService: PaymentService,
    ) { }

    @Post('verify')
    verifyPayment(@Body() body: CreatePaymentDto, @Headers('x-order-secret') orderSecret: string) {
        return this.paymentService.verifyPayment(body, orderSecret)
    }

    @Get('qr-code/:orderId')
    generateQrCode(@Param('orderId') orderId: string, @Headers('x-order-secret') orderSecret: string) {
        return this.paymentService.generateQrCodeForOrder(orderId, orderSecret)
    }
}
