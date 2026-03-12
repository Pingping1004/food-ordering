import {
    Controller,
    Res,
    Post,
    Logger,
    Req,
    Headers,
    Param,
    ForbiddenException,
    InternalServerErrorException,
    Body
} from '@nestjs/common';
import { OrderService } from 'src/order/order.service';
import { PaymentService } from './payment.service';
import { Request, Response } from 'express';
import { PaymentMethod } from '@prisma/client';
import { Public } from 'src/decorators/public.decorator';

@Public()
@Controller('payment')
export class PaymentController {
    constructor(
        private readonly paymentService: PaymentService,
        private readonly orderService: OrderService,
    ) { }

    private readonly logger = new Logger('PaymentController');

    //
}
