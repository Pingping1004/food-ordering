import { Controller, Get, Post, Body, Patch, Param, Delete, UploadedFile, UseInterceptors } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { OrderService } from 'src/order/order.service';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller('payment')
export class PaymentController {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly orderService: OrderService,
  ) {}

  @Post(':orderId')
  @UseInterceptors(FileInterceptor('file'))
  async validatePayment(@Param() orderId: string, @UploadedFile() file: Express.Multer.File): Promise<boolean> {
    console.log('OrderId for validate payment: ', orderId);
    console.log('File for validate payment: ', file);
    const isValid = this.paymentService.validatePayments(orderId, file);
    if (!isValid) throw new Error('ยืนยันการชำระเงินล้มเหลว กรุณาอัพโหลดสลิปที่ถูกต้อง');
    return true;
  }
}
