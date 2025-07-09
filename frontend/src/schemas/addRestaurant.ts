import { z } from "zod";

export const createRestaurantSchema = z.object({
    restaurantImg: z
    .any()
    .refine(
      (f) =>
        f === undefined ||
        (f instanceof FileList && (f.length === 0 || f.length === 1)),
      { message: "Invalid file" }
    )
    .optional(),
    name: z.string({ message: 'กรุณาใส่ชื่อร้านอาหารด้วยตัวอักษร' }),
    openTime: z.string()
        .min(1, 'กรุณาเลือกเวลาเปิดทำการร้าน')
        .refine(
            (time) => {
                const [h, m] = time.split(':').map(Number);
                return RegExp(/^\d{2}:\d{2}$/).test(time) && h >= 0 && h <= 23 && m >= 0 && m <= 59;
            },
            { message: 'รูปแบบเวลาไม่ถูกต้อง (HH:mm)' }
        )
        .transform((timeString, ctx) => {
            try {
                const [hours, minutes] = timeString.split(':').map(Number);
                const today = new Date();
                today.setHours(hours, minutes, 0, 0);
                return today;
            } catch (e) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: 'ไม่สามารถแปลงเวลาได้',
                    path: ['openTime'],
                });
                return z.NEVER;
            }
        }),

    closeTime: z.string()
        .min(1, 'กรุณาเลือกเวลาปิดทำการร้าน')
        .refine(
            (time) => {
                const [h, m] = time.split(':').map(Number);
                return RegExp(/^\d{2}:\d{2}$/).test(time) && h >= 0 && h <= 23 && m >= 0 && m <= 59;
            },
            { message: 'รูปแบบเวลาไม่ถูกต้อง (HH:mm)' }
        )
        .transform((timeString, ctx) => {
            try {
                const [hours, minutes] = timeString.split(':').map(Number);
                const today = new Date();
                today.setHours(hours, minutes, 0, 0);
                return today;
            } catch (e) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: 'ไม่สามารถแปลงเวลาได้',
                    path: ['closeTime'],
                });
                return z.NEVER;
            }
        }),
    // openTime: z.string().min(1, 'กรุณาเลือกเวลาเปิดทำการร้าน'),
    // closeTime: z.string().min(1, 'กรุณาเลือกเวลาปิดทำการร้าน'),
    avgCookingTime: z.coerce.number().min(1, 'โปรดเลือกเวลาในการทำอาหารต่อจาน '),
    adminName: z.string().trim().min(1, { message: 'กรุณาระบุชื่อผู้ดูแลร้าน' }),
    adminSurname: z.string().trim().min(1, { message: 'กรุณาระบุนามสกุลผู้ดูแลร้าน' }),
    adminTel: z.string()
        .trim()
        .regex(/^\d{10}$/, { message: 'กรุณาระบุเบอร์โทรที่ถูกต้อง 10 หลัก' }),
    adminEmail: z.string().trim().email('กรุณาระบุอีเมลที่ถูกต้อง').optional().or(z.literal('')),
})
    .refine(
        (data) => {
            const { openTime, closeTime } = data;
            if (openTime && closeTime) {
                return closeTime > openTime;
            }
            return true;
        },
        {
            message: 'เวลาปิดทำการต้องหลังเวลาเปิดทำการ',
            path: ['closeTime'],
        });

export type CreateRestaurantSchemaType = z.infer<typeof createRestaurantSchema>