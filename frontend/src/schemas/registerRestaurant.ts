import { z } from "zod";
import type { DayOfWeek, RestaurantCategory } from "@/lib/schema";
import { hhmmToMinutes } from "@/lib/schema/format";

const DAY_VALUES = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"] as const satisfies readonly DayOfWeek[];
const CATEGORY_VALUES = ["Steak", "Halal", "Made_to_order", "Esan", "Rice", "Appetizer", "Noodle"] as const satisfies readonly RestaurantCategory[];

const hhmm = z.string().regex(/^\d{2}:\d{2}$/, "รูปแบบเวลาต้องเป็น HH:mm");

/** Restaurant registration, split per wizard step so each step validates on its own. */
export const registerStep1 = z.object({
    contactName: z.string().trim().min(1, "กรุณาใส่ชื่อเจ้าของร้าน").max(60, "ชื่อยาวเกินไป"),
    contactSurname: z.string().trim().min(1, "กรุณาใส่นามสกุลเจ้าของร้าน").max(60, "นามสกุลยาวเกินไป"),
    contactEmail: z.string().trim().email("รูปแบบอีเมลไม่ถูกต้อง"),
    name: z.string().trim().min(1, "กรุณาใส่ชื่อร้าน").max(60, "ชื่อร้านยาวเกินไป"),
    categories: z.array(z.enum(CATEGORY_VALUES)).min(1, "เลือกอย่างน้อย 1 ประเภท").max(3, "เลือกได้ไม่เกิน 3 ประเภท"),
    contactTel: z.string().trim().regex(/^\d{10}$/, "กรุณาใส่เบอร์โทร 10 หลัก"),
    restaurantImg: z.any().optional(),
});

export const registerStep2 = z
    .object({
        canteenId: z.string().min(1, "กรุณาเลือกโรงอาหาร"),
        location: z.string().trim().max(40, "ไม่เกิน 40 ตัวอักษร"), // optional
        days: z.array(z.enum(DAY_VALUES)).min(1, "เลือกวันเปิดอย่างน้อย 1 วัน"),
        openTime: hhmm,
        closeTime: hhmm,
        maxActiveOrders: z.number().int().min(1, "อย่างน้อย 1 ออเดอร์").max(50, "สูงสุด 50 ออเดอร์"),
        avgCookingTimeMins: z.number().int().min(1, "อย่างน้อย 1 นาที").max(120, "สูงสุด 120 นาที"),
    })
    .refine((v) => hhmmToMinutes(v.closeTime) > hhmmToMinutes(v.openTime), { path: ["closeTime"], message: "เวลาปิดต้องหลังเวลาเปิด" });

export const registerStep3 = z.object({
    bankAccount: z.string().min(1, "กรุณาเลือกธนาคาร / ประเภทบัญชี"),
    accountName: z.string().trim().min(1, "กรุณาใส่ชื่อบัญชี"),
    accountNumber: z.string().trim().regex(/^[\d-]{6,}$/, "กรุณาใส่เลขบัญชี หรือเบอร์พร้อมเพย์"),
    paymentQr: z.any().superRefine((file, ctx) => {
        if (!file) return ctx.addIssue({ code: z.ZodIssueCode.custom, message: "กรุณาอัปโหลด QR พร้อมเพย์" });
        if (file.size > 2 * 1024 * 1024) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "ไฟล์ต้องไม่เกิน 2MB" });
    }),
});

export const registerStep4 = z.object({
    consent: z.literal(true, { errorMap: () => ({ message: "กรุณายืนยันความถูกต้องของข้อมูล" }) }),
});

export const registerRestaurantSchema = z.object({
    ...registerStep1.shape,
    ...registerStep3.shape,
    ...registerStep4.shape,
    // step 2 is an effects schema (refine) so its shape is re-declared here
    canteenId: z.string(),
    location: z.string(),
    days: z.array(z.enum(DAY_VALUES)),
    openTime: hhmm,
    closeTime: hhmm,
    maxActiveOrders: z.number(),
    avgCookingTimeMins: z.number(),
});

export type RegisterRestaurantValues = z.input<typeof registerRestaurantSchema>;

export const STEP_FIELDS = {
    1: ["contactName", "contactSurname", "contactEmail", "name", "categories", "contactTel", "restaurantImg"],
    2: ["canteenId", "location", "days", "openTime", "closeTime", "maxActiveOrders", "avgCookingTimeMins"],
    3: ["bankAccount", "accountName", "accountNumber", "paymentQr"],
    4: ["consent"],
} as const satisfies Record<number, readonly (keyof RegisterRestaurantValues)[]>;

export const STEP_SCHEMAS = { 1: registerStep1, 2: registerStep2, 3: registerStep3, 4: registerStep4 } as const;

/** Schema `DayOfWeek` → the short tokens the restaurant endpoint still accepts in `openDate`. */
export const DAY_TOKEN: Record<DayOfWeek, string> = {
    MONDAY: "mon", TUESDAY: "tue", WEDNESDAY: "wed", THURSDAY: "thu", FRIDAY: "fri", SATURDAY: "sat", SUNDAY: "sun",
};
