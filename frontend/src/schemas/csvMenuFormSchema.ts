import { z } from "zod";

export const bulkCsvFormSchema = z.object({
    csvFile: z
        .instanceof(FileList)
        .refine((files) => files.length > 0, 'กรรุณาแนบCSVไฟล์')
        .refine((files) => files[0]?.type === 'text/csv', 'กรุณาใส่ไฟล์ CSV เท่านั้น.')
        .refine((files) => files[0]?.size <= 5 * 1024 * 1024, 'ขนาดไฟล์ต้องไม่เกิน 5MB.')
        .optional(), // Make it optional if submission without file is possible
});

export type BulkCsvFormValues = z.infer<typeof bulkCsvFormSchema>;