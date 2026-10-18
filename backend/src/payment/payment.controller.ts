import { Controller, Post, Get, Body, Param, Req } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { CreatePaymentDto } from './dto/create-payment.dto';

/** Login required; only the user who placed the order may pay for it (404 for anyone else). */
@Controller('payment')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('verify')
  verifyPayment(@Body() body: CreatePaymentDto, @Req() req: any) {
    return this.paymentService.verifyPayment(body, req.user.userId);
  }

  @Get('qr-code/:orderId')
  generateQrCode(@Param('orderId') orderId: string, @Req() req: any) {
    return this.paymentService.generateQrCodeForOrder(orderId, req.user.userId);
  }
}
