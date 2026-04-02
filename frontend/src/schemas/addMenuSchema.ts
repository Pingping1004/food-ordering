import { z } from "zod";

export const baseCreateMenuSchema = z.object({
    name: z.string().min(0.1, "กรุณากรอกชื่อเมนู"),
    price: z.coerce.number().min(1, "ราคาต้องมากกว่าหรือเท่ากับ 0.1 บาท"),
    maxDaily: z.coerce.number().min(1, "จำนวนสูงสุดต่อวันต้องมากกว่า 0"),
    cookingTime: z.coerce.number().min(1, "เวลาทำอาหารต้องอย่างน้อย 1 นาที"),
    menuImg: z
        .any()
        .refine(
            (f) =>
                f === undefined ||
                (f instanceof FileList && (f.length === 0 || f.length === 1)),
            { message: "อัปโหลดรูปได้เพียง 1 รูปเท่านั้น" }
        ),
    isAvailable: z.boolean().optional(),
});

export const baseEditMenuSchema = z.object({
    menuId: z.string().optional(),
    name: z.string().optional(),
    menuImg: z.string().optional(),
    maxDaily: z.coerce
        .number()
        .min(1, { message: "จำนวนสูงสุดต่อวันต้องมากกว่า 0" })
        .optional(),
    cookingTime: z.coerce
        .number()
        .min(1, { message: "เวลาทำอาหารต้องอย่างน้อย 1 นาที" })
        .max(10, { message: "เวลาทำอาหารต้องไม่เกิน 10 นาที" })
        .optional(),
    price: z.coerce
        .number()
        .positive({ message: "ราคาต้องมากกว่า 0" })
        .optional(),
    createdAt: z.coerce.date().optional(),
    isAvailable: z.boolean().optional(),
});

export const singleEditMenuSchema = baseEditMenuSchema.extend({
    restaurantId: z.string()
        .min(1, "ไม่พบรหัสร้านอาหาร")
        .uuid("รหัสร้านอาหารไม่ถูกต้อง"),
    menuImg: z
        .union([
            z.string(),
            z.any().refine(
                (file) => {
                    if (file === undefined) return true;
                    if (file instanceof FileList) {
                        return file.length === 0 || file.length === 1;
                    }
                    return false;
                },
                { message: "อัปโหลดรูปได้เพียง 1 รูปเท่านั้น" }
            ),
        ])
        .optional(),
});

export type singleEditMenuSchemaType = z.infer<typeof singleEditMenuSchema>;

export const singleCreateMenuSchema = baseCreateMenuSchema.extend({
    restaurantId: z.string()
        .min(1, "ไม่พบรหัสร้านอาหาร")
        .uuid("รหัสร้านอาหารไม่ถูกต้อง"),
    menuImg: z
        .any()
        .refine(
            (file) => {
                if (file === undefined) return true;
                if (file instanceof FileList) {
                    return file.length === 0 || file.length === 1;
                }
                return false;
            },
            { message: "อัปโหลดรูปได้เพียง 1 รูปเท่านั้น" }
        )
        .optional(),
});

export type SingleCreateMenuSchemaType = z.infer<typeof singleCreateMenuSchema>;

export const bulkUploadFormSchema = z.object({
    csvFile: z.any(),
    menuImgs: z.any(),
    restaurantId: z.string()
        .min(1, "ไม่พบรหัสร้านอาหาร")
        .uuid("รหัสร้านอาหารไม่ถูกต้อง"),
});

export type BulkUploadFormValues = z.infer<typeof bulkUploadFormSchema>;

export const csvMenuItemSchema = z.object({
    name: z.string().min(1, "กรุณากรอกชื่อเมนู"),
    price: z.coerce
        .number()
        .min(0.01, "ราคาต้องมากกว่า 0 บาท"),
    maxDaily: z.coerce
        .number()
        .int()
        .min(0, "จำนวนต่อวันต้องเป็นตัวเลข 0 หรือมากกว่า")
        .optional()
        .default(0),
    cookingTime: z.coerce
        .number()
        .int()
        .min(1, "เวลาทำอาหารต้องอย่างน้อย 1 นาที")
        .optional()
        .default(1),
    isAvailable: z.coerce.boolean().optional().default(true),
    originalImageFileNameCsv: z.string().optional(),
});

export type CsvMenuItemSchemaType = z.infer<typeof csvMenuItemSchema>;

export const finalBulkMenuPayloadSchema = z.array(
    baseCreateMenuSchema.extend({
        imageFileName: z.string().optional(),
        originalFileName: z.string().optional(),
    })
);

export type FinalBulkMenuPayloadType = z.infer<typeof finalBulkMenuPayloadSchema>;