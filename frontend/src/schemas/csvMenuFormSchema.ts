import { z } from "zod";

export const bulkCsvFormSchema = z.object({
    csvFile: z
        .instanceof(FileList)
        .refine((files) => files.length > 0, 'CSV file is required.')
        .refine((files) => files[0]?.type === 'text/csv', 'Only CSV files are allowed.')
        .refine((files) => files[0]?.size <= 5 * 1024 * 1024, 'Max file size is 5MB.') // Example: 5MB limit
        .optional(), // Make it optional if submission without file is possible
});

export type BulkCsvFormValues = z.infer<typeof bulkCsvFormSchema>;