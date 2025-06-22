import { z } from "zod";

export const createMenuSchema = z.object({
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
});

export type createMenuSchemaType = z.input<typeof createMenuSchema>;

export const editMenuSchema = z.object({
  id: z.string().optional(),
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

export type editMenuSchemaType = z.infer<typeof editMenuSchema>;
