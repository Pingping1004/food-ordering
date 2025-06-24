import { OmiseBankType, OMISE_BANK_TYPE_VALUES } from "@/common/bank-type.enum";
import { z } from "zod";

export const createOrderSchema = z.object({
    restaurantId: z.string().uuid('Invalid restaurant ID'),
    deliverAt: z.string() // It receives a string from TimePickerInput
    .min(1, 'กรุณาเลือกเวลารับอาหารขั้นต่ำ 5 นาทีหลังสั่ง') // Basic validation for non-empty string
    .refine(
      (time) => {
        // More robust validation for HH:mm format
        const [h, m] = time.split(':').map(Number);
        return time.match(/^\d{2}:\d{2}$/) && h >= 0 && h <= 23 && m >= 0 && m <= 59;
      },
      { message: 'รูปแบบเวลารับอาหารไม่ถูกต้อง (HH:mm)' }
    )
    .transform((timeString, ctx) => {
      // This transformation converts the "HH:mm" string into a Date object
      // with the CURRENT DATE and the specified time.
      try {
        const [hours, minutes] = timeString.split(':').map(Number);
        const today = new Date(); // Get today's date (e.g., June 24, 2025)
        today.setHours(hours, minutes, 0, 0); // Set the time components, reset seconds/ms
        return today; // The output of this transform is a Date object
      } catch (e) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'ไม่สามารถแปลงเวลาเป็นวันที่ได้',
          path: ['deliverAt'],
        });
        return z.NEVER; // Indicates a transformation failure for Zod
      }
    })
    .refine(
      (deliverAtDate) => {
        const now = new Date();
        const bufferMinutes = 5;
        const minimumAllowedDeliverTime = new Date(now.getTime() + bufferMinutes * 60 * 1000); // 10 minutes in milliseconds
        return deliverAtDate > minimumAllowedDeliverTime;
      },
      {
        message: 'เวลารับอาหารต้องอยู่หลังจากเวลาปัจจุบันอย่างน้อย 5นาที',
        path: ['deliverAt'],
      }
    ),
    paymentMethod: z.string().optional(),
});

export type CreateOrderSchemaType = z.infer<typeof createOrderSchema>