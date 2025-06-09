import { z } from "zod";

export const createMenuSchema = z.object({
  id: z.string().uuid({ message: "Menu ID is required" }),
  name: z.string().min(1, { message: "Menu name is required" }),
    menuImg: z
    .any()
    .optional()
    .refine(
      (file) =>
        file === undefined || file instanceof FileList || file === null,
      {
        message: "Invalid file input",
      }
    )
    .refine(
      (file) => !file || (file instanceof FileList && file.length <= 1),
      {
        message: "Only one image file is allowed",
      }
    ),
  restaurantName: z.string().min(1, { message: "Restaurant name is required" }),
  maxDaily: z.coerce
    .number()
    .positive({ message: "Max daily order must be a positive number" }),
  cookingTime: z.coerce
    .number()
    .min(1)
    .max(10, { message: "Max cooking time must be between 1-10 minutes" }),
  price: z.coerce
    .number()
    .positive({ message: "Price must be a positive number" }),
  createdAt: z.coerce.date(),
  isAvailable: z.boolean(),
});

export type createMenuSchemaType = z.infer<typeof createMenuSchema>;

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
