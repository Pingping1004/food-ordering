import { z } from "zod";

export const baseCreateMenuSchema = z.object({
  name: z.string().min(1, "Name is required"),
  price: z.coerce.number().min(1, "Price must be at least 1"),
  maxDaily: z.coerce.number().min(1, "Max daily must be at least 1"),
  cookingTime: z.coerce.number().min(1, "Cooking time must be at least 1"),
  menuImg: z
    .any()
    .refine(
      (f) =>
        f === undefined ||
        (f instanceof FileList && (f.length === 0 || f.length === 1)),
      { message: "Invalid file" }
    )
    .optional(),
  isAvailable: z.boolean().optional(),
});

export const baseEditMenuSchema = z.object({
  menuId: z.string().optional(),
  name: z.string().optional(),
  menuImg: z.string().optional(),
  restaurantName: z.string().optional(),
  maxDaily: z.coerce
    .number()
    .min(1, { message: "Max daily order must be a positive number" })
    .optional(),
  cookingTime: z.coerce
    .number()
    .min(1)
    .max(10, { message: "Max cooking time must be between 1-10 minutes" })
    .optional(),
  price: z.coerce
    .number()
    .positive({ message: "Price must be a positive number" })
    .optional(),
  createdAt: z.coerce.date().optional(),
  isAvailable: z.boolean().optional(),
});

export const singleCreateMenuSchema = baseCreateMenuSchema.extend({
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
      { message: 'Menu image must be a single file' }
    )
    .optional(),
});

export type SingleCreateMenuSchemaType = z.infer<typeof singleCreateMenuSchema>

export const bulkUploadFormSchema = z.object({
  // Field for multiple menu images to be uploaded
  // menuImgs: z
  //   .instanceof(FileList, { message: 'Menu images must be file(s).' })
  //   .refine((files) => files.length > 0, { message: 'At least one menu image is required.' })
  //   .refine((files) => Array.from(files).every(file => file.size <= 5 * 1024 * 1024), { message: 'Each image must be max 5MB.' })
  //   .refine((files) => Array.from(files).every(file => ['image/jpeg', 'image/png', 'image/webp'].includes(file.type)), {
  //     message: 'Only JPG, PNG, or WebP images are allowed.',
  //   }),

  // // Field for the CSV file
  // csvFile: z
  //   .instanceof(FileList, { message: 'CSV file is required.' })
  //   .refine((files) => files.length > 0, { message: 'Please select a CSV file.' })
  //   .refine((files) => files[0]?.type === 'text/csv', { message: 'Only CSV files (.csv) are allowed.' })
  //   .refine((files) => files[0]?.size <= 10 * 1024 * 1024, { message: 'Max CSV file size is 10MB.' }),
  csvFile: z.any(),
  menuImgs: z.any(),
  // csvFile: z
  //   .instanceof(FileList, { message: 'CSV file is required.' })
  //   .refine((files) => files.length > 0, 'CSV file is required.')
  //   .refine((files) => files[0] && files[0].type === 'text/csv', 'Only CSV files are allowed.'),

  // // Client-side validation for menu images
  // menuImgs: z
  //   .instanceof(FileList, { message: 'Menu images are required.' })
  //   .refine((files) => files.length > 0, 'At least one menu image is required.')
  //   .refine((files) => files.length <= 10, 'You can upload a maximum of 10 images.')
  //   .refine((files) =>
  //     Array.from(files).every(file => ['image/png', 'image/jpeg', 'image/webp'].includes(file.type)),
  //     'Only PNG, JPEG, or WebP images are allowed.'
  //   ),
  restaurantId: z.string().min(1, "Restaurant ID is required").uuid(),
});

export type BulkUploadFormValues = z.infer<typeof bulkUploadFormSchema>;

export const csvMenuItemSchema = z.object({
  name: z.string().min(1, "Menu name is required."),
  description: z.string().optional(), // Description can be empty
  price: z.coerce.number().min(0.01, "Price must be a number greater than 0."), // Coerce string to number
  maxDaily: z.coerce.number().int().min(0, "Max daily must be a non-negative integer.").optional().default(0), // Coerce string to number, allow 0
  cookingTime: z.coerce.number().int().min(1, "Cooking time must be an integer at least 1.").optional().default(1), // Coerce string to number
  isAvailable: z.coerce.boolean().optional().default(true), // Coerce string to boolean, default to true
  // This field is for the original filename from the user's computer, used for matching
  originalImageFileNameCsv: z.string().optional(), // This column might be empty if no image
});

export type CsvMenuItemSchemaType = z.infer<typeof csvMenuItemSchema>;

// export const csvMenuItemSchema = baseCreateMenuSchema.extend({
//   originalImageFileNameCsv: z.string().optional(),
// });

// export type CsvMenuItemSchemaType = z.infer<typeof csvMenuItemSchema>;

export const finalBulkMenuPayloadSchema = z.array(baseCreateMenuSchema.extend({
  imageFileName: z.string().optional(),
  originalFileName: z.string().optional(),
}));

export type FinalBulkMenuPayloadType = z.infer<typeof finalBulkMenuPayloadSchema>;
