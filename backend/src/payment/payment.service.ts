import {
    BadRequestException,
    ConflictException,
    HttpException,
    HttpStatus,
    Injectable,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import { PaymentStatus } from '@prisma/client';
import axios, { AxiosError } from 'axios';
import { BANK_CODE_MAP, PaymentPayload } from 'src/common/interface/accountType';
import { OrderService } from 'src/order/order.service';
import { PayoutService } from 'src/payout/payout.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { RestaurantService } from 'src/restaurant/restaurant.service';
import { toThaiDate } from 'src/utils/timezone';

@Injectable()
export class PaymentService {
    private readonly logger = new Logger(PaymentService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly restaurantService: RestaurantService,
        private readonly orderService: OrderService,
        private readonly payoutService: PayoutService,
    ) { }

    async verifyPayment(restaurantId: string, orderId: string, paymentSlipImg: string) {
        if (!process.env.SLIP_VERIFY_SECRET) throw new NotFoundException("SLIP_VERIFY_SECRET key missing");

        try {
            const { accountNumber, bankAccount, accountHolderFullName } = await this.restaurantService.findRestaurant(restaurantId);
            const { acceptAt, totalAmount } = await this.orderService.findOneOrder(orderId);

            const accountTypeCode = BANK_CODE_MAP[bankAccount];
            if (!accountTypeCode) throw new ConflictException("ไม่พบข้อมูลบัญชีธนาคาร")
            if (!acceptAt) throw new ConflictException("ออเดอร์ยังไม่ถูกรับโดยร้านอาหร")

            const acceptAtDate = new Date((acceptAt))
            const bufferMinsLater = new Date(acceptAtDate.getTime() + 11 * 60 * 1000);
            console.log("Order At: ", JSON.stringify(acceptAtDate));
            console.log("Buffer time: ", JSON.stringify(toThaiDate(bufferMinsLater)))

            const paymentData: PaymentPayload = {
                payload: {
                    imageBase64: paymentSlipImg,
                    checkCondition: {
                        checkAmount: {
                            type: "eq",
                            amount: totalAmount.toString(),
                        },
                        checkDate: {
                            type: "gte",
                            date: toThaiDate(acceptAtDate),
                        },
                        checkDuplicate: true,
                        checkReceiver: [
                            {
                                accountType: accountTypeCode,
                                accountNameTH: accountHolderFullName,
                                accountNumber: accountNumber.toString(),
                            }
                        ]
                    }
                }
            }

            this.logger.debug(`Sending account receiver info: ${JSON.stringify(paymentData.payload.checkCondition.checkReceiver, null, 2)}`)
            const response = await axios.post("https://connect.slip2go.com/api/verify-slip/qr-base64/info", paymentData, {
                headers: {
                    Authorization: `Bearer ${process.env.SLIP_VERIFY_SECRET}`
                },
            });

            const result = response.data
            this.logger.debug(`Payment account response data: ${JSON.stringify(result, null, 2)}`)

            if (result.code !== "200200") throw new HttpException({ message: result.message, code: result.code }, HttpStatus.BAD_REQUEST);

            if (!result?.data?.dateTime) throw new BadRequestException("ข้อมูลการชำระเงินไม่สมบูรณ์");
            const paidAt = new Date(result.data.dateTime);
            console.log("Paid at: ", paidAt)

            // if (Date.now() - paidAt.getTime() > 11 * 60 * 1000) throw new BadRequestException("เวลาในการชำระเงินหมดอายุ กรุณาทำรายการใหม่")
            if (paidAt < acceptAt || paidAt > bufferMinsLater) throw new BadRequestException("Invalid slip time");

            await this.prisma.$transaction(async (tx) => {
                await this.orderService.updateOrderPaymentTx(tx, orderId, PaymentStatus.paid, paymentSlipImg, 'verified', result.data.transRef, paidAt)
                await this.payoutService.createPayoutTx(tx, orderId, paidAt)
            });

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
