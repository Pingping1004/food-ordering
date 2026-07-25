import {
    BadRequestException,
    ConflictException,
    HttpException,
    HttpStatus,
    Injectable,
    Logger,
    NotFoundException,
    UnauthorizedException,
} from '@nestjs/common';
import { PaymentStatus, Prisma } from '@prisma/client';
import axios, { AxiosError } from 'axios';
import { BANK_CODE_MAP, PaymentPayload } from 'src/common/interface/accountType';
import { OrderService } from 'src/order/order.service';
import { PayoutService } from 'src/payout/payout.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { RestaurantService } from 'src/restaurant/restaurant.service';
import { toThaiDate } from 'src/utils/timezone';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { createHash } from 'crypto';
import { UploadService } from 'src/upload/upload.service';
import { calculatePayout } from 'src/payout/payout-calculator';
import { NotificationService } from 'src/notification/notification.service';

function sha256(data: string): string {
    return createHash('sha256').update(data).digest('hex');
}

@Injectable()
export class PaymentService {
    private readonly logger = new Logger(PaymentService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly uploadService: UploadService,
        private readonly restaurantService: RestaurantService,
        private readonly orderService: OrderService,
        private readonly payoutService: PayoutService,
        private readonly notificationService: NotificationService,
    ) { }

    async verifyPayment(dto: CreatePaymentDto, orderSecret: string) {
        const { idempotencyKey, orderId, paymentSlipImg } = dto;

        const order = await this.orderService.findOneOrder(orderId, orderSecret);
        const { name, accountNumber, bankAccount } = await this.restaurantService.findRestaurant(order.restaurantId);

        if (!process.env.SLIP_VERIFY_SECRET) throw new NotFoundException("SLIP_VERIFY_SECRET key missing");
        if (order.orderSecret !== orderSecret) throw new UnauthorizedException("ไม่สามารถเข้าถึงออเดอร์ได้");
        if (order.paymentStatus === "paid") return { success: true };

        const requestHash = sha256(JSON.stringify({ orderId, slip: paymentSlipImg.slice(0, 500) }));

        let payout;
        try {
            const totalAmountDecimal = new Prisma.Decimal(order.totalAmount);
            const calculated = calculatePayout(totalAmountDecimal)

            payout = await this.prisma.payout.create({
                data: {
                    idempotencyKey,
                    requestHash,
                    orderId,
                    payoutStatus: "initiated",
                    restaurantId: order.restaurantId,
                    restaurantName: name,
                    grossAmount: order.totalAmount,
                    restaurantRevenue: calculated.restaurantEarning,
                    platformFee: calculated.platformNetEarning,
                    transactionFee: calculated.transactionFee,
                    vat: calculated.vatRate,
                    startDate: new Date(),
                    endDate: new Date(),
                }
            });
        } catch (err) {
            const existing = await this.payoutService.findPayoutByIdempotencyKey(idempotencyKey, orderId)

            if (!existing) throw err;
            if (existing.requestHash !== requestHash) throw new ConflictException("Idempotency key reused with different payload");

            if (existing.payoutStatus === "success") return { success: true };
            if (existing.payoutStatus === "initiated") return { success: false, status: "initiated" }
            if (existing.payoutStatus === "processing") return { success: false, status: "processing" }

            payout = existing;
        }

        try {
            const accountTypeCode = BANK_CODE_MAP[bankAccount];
            if (!accountTypeCode) throw new ConflictException("ไม่พบข้อมูลบัญชีธนาคาร")
            if (!order.acceptAt) throw new ConflictException("ออเดอร์ยังไม่ถูกรับโดยร้านอาหร")

            const acceptAtDate = new Date((order.acceptAt))
            const bufferMinsLater = new Date(acceptAtDate.getTime() + 3 * 60 * 1000);

            const { dataUrl: paymentSlipUrl } = this.uploadService.parseBase64Image(paymentSlipImg);
            const paymentData: PaymentPayload = {
                payload: {
                    imageBase64: paymentSlipUrl,
                    checkCondition: {
                        checkAmount: {
                            type: "eq",
                            amount: order.totalAmount.toString(),
                        },
                        checkDate: {
                            type: "gte",
                            date: toThaiDate(acceptAtDate),
                        },
                        checkDuplicate: false,
                        checkReceiver: [
                            {
                                accountType: accountTypeCode,
                                // accountNameTH: accountHolderFullName,
                                accountNumber: accountNumber.toString(),
                            }
                        ]
                    }
                }
            }

            this.logger.debug(`Sending account receiver info: ${JSON.stringify(paymentData.payload.checkCondition.checkReceiver, null, 2)}`)
            const response = await axios.post("https://connect.slip2go.com/api/verify-slip/qr-base64/info", paymentData, {
                timeout: 5000,
                headers: {
                    Authorization: `Bearer ${process.env.SLIP_VERIFY_SECRET}`
                },
            });

            const result = response.data
            this.logger.debug(`Payment account response data: ${JSON.stringify(result, null, 2)}`)

            if (result.code !== "200200") throw new HttpException({ message: result.message, code: result.code }, HttpStatus.BAD_REQUEST);

            if (!result?.data?.dateTime) throw new BadRequestException("ข้อมูลการชำระเงินไม่สมบูรณ์");
            const paidAt = new Date(result.data.dateTime);

            if (paidAt < order.acceptAt || paidAt > bufferMinsLater) throw new BadRequestException("Invalid slip time");

            const transactionId = result.data.transRef;
            const existingTx = await this.payoutService.findPayoutByTransactionId(transactionId);
            if (existingTx) throw new ConflictException("สลิปซ้ำ");

            try {
                const { url: slipUrl } = await this.uploadService.uploadBase64(paymentSlipImg, `slip-${orderId}`);

                await this.prisma.$transaction(async (tx) => {
                    await this.orderService.updateOrderPaymentTx(tx, orderId, PaymentStatus.paid, slipUrl, 'verified', transactionId, paidAt)
                    await this.payoutService.updatePayoutTx(tx, payout.payoutId, orderId, idempotencyKey, transactionId, "success", paidAt)
                });
            } catch (error) {
                this.logger.warn(`Payment DB transaction failed for order ${orderId}: ${error instanceof Error ? error.message : String(error)}`,);

                const existing = await this.payoutService.findPayoutByIdempotencyKey(idempotencyKey, orderId);

                if (!existing) throw error;

                if (existing.requestHash !== requestHash) {
                    throw new ConflictException("Idempotency key reused with different payload");
                }

                await this.payoutService.updatePayoutStatus(payout.payoutId, "failed")
                if (existing) {
                    if (existing.payoutStatus === "success") return { success: true };
                    if (existing.payoutStatus === "processing") throw new ConflictException("กำลังตรวจสอบการชำระเงิน")

                    return { success: false, retry: true };
                }
            }

            await this.notificationService.sendPaymentVerified(orderId).catch((pushError: unknown) => {
                const error = pushError as Error;
                this.logger.warn(`Payment verified but push notification failed: ${error.message}`);
            });

            return { success: true };

        } catch (error) {
            if (error instanceof HttpException) {
                await this.payoutService.updatePayoutStatus(payout.payoutId, "failed")
                throw error;
            }

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
