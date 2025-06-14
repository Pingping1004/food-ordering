import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { OrderService } from '../order/order.service';
import * as  Tesseract from 'tesseract.js';
import { startOfDay, endOfDay } from 'date-fns';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  
  constructor(
    private prisma: PrismaService,
    private orderService: OrderService,
  ) {}

  async isDupllicateRefCode(refCode: string, date: Date): Promise<boolean> {
    const existing = await this.prisma.order.findFirst({
      where: {
        refCode,
        orderAt: {
          gte: startOfDay(date),
          lte: endOfDay(date),
        },
      },
    });

    return !!existing;
  }

  async validatePayments(orderId: string, file: Express.Multer.File) {
    try {
      // Step 1: Load OCR text
      const imgBuffer = file.buffer;
      const result = await Tesseract.recognize(imgBuffer, 'tha+emg');
      const text = result.data.text;
      this.logger.debug(`OCR result text: ${text}`);

      // Step 2: Get order from DB and check the price validity
      const order = await this.orderService.findOneOrder(orderId);
      const priceMatch = text.match(/(\d+\.\d{2})\s?บาท/);

      // Step 3: Match Price
      const slipPrice = priceMatch ? parseFloat(priceMatch[1]) : null;
      if (!slipPrice || slipPrice !== order.price) {
        this.logger.warn(`Failed to extract price for order ${orderId}`);
        throw new Error('ยอดเงินในสลิปไม่ตรงกับคำสั่งซื้อ กรุณาอัพโหลดสลิปที่ถูกต้อง')
      }

      // Step 4: Date and time match
      const dateMatch = text.match(/(\d{1,2})([ก-ฮ]{2,3})\s?(\d{2})\s?(\d{1,2}:\d{2})/);
      if (!dateMatch) throw new Error('ไม่พบวันและเวลาในสลิป');

      const thaiMonthMap: Record<string, number> = {
        'ม.ค': 1, 'ก.พ': 2, 'มี.ค': 3, 'เม.ย': 4, 'พ.ค': 5, 'มิ.ย': 6,
        'ก.ค': 7, 'ส.ค': 8, 'ก.ย': 9, 'ต.ค': 10, 'พ.ย': 11, 'ธ.ค': 12,
      };

      const [_, dayStr, thaiMonth, yearStr, timeStr] = dateMatch;
      const day = parseInt(dayStr, 10);
      const month = thaiMonthMap[thaiMonth];
      const year = 2000 + parseInt(yearStr); // Adjust for Buddhist Era if needed
      const [hour, minute] = timeStr.split(':').map(Number);

      const slipDate = new Date(year, month - 1, day, hour, minute);
      const isTimeValid =
        Math.abs(slipDate.getTime() - order.orderAt.getTime()) <= 15 * 60 * 1000;

      if (!isTimeValid) throw new Error('เวลาบนสลิปไม่ตรงกับเวลาสั่งซื้อ (เกิน 15 นาที)');

      // Step 5: Validate ref code
      const refMatch = text.match(/\b[A-Z0-9]{4,}\b/g);

      if (!refMatch || refMatch.length === 0) {
        this.logger.warn(`No ref code found in slip for order ${orderId}`);
        throw new Error('รหัสอ้างอิงสลิปไม่ถูกต้อง')
      }

      // Step: 6 Check ref code uniqueness within same day
      const refCode = refMatch[0];
      await this.isDupllicateRefCode(refCode, order.orderAt);

      this.logger.log(`Slip verified successfully for order ${orderId}`);

      return {
        valid: true,
        extracted: {
          slipPrice,
          slipDate,
          refCode: refMatch[0],
        }
      };
    } catch (error) {
      console.error('Failed to validate payment: ', error.message);
    }
  }
}
