import { z } from "zod";

export const orderPaymentSchema = z.object({
    orderId: z.string().uuid('ออเดอร์ไม่ถูกต้อง'),
    paymentSlipImg: z.any().superRefine((file, ctx) => {
        if (!file) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "กรุณาอัพโหลดสลิป",
            });
            return;
        }
          
        if (file.size > 2 * 1024 * 1024) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "ขนาดไฟล์ต้องไม่เกิน 2MB",
              });
        }
    })
});

export type OrderPaymentSchema = z.infer<typeof orderPaymentSchema>