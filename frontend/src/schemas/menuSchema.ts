import { z } from 'zod';

export const menuSchema = z.object({
    id: z.string().uuid({ message: 'Menu ID is required' }),
    name: z.string().min(1, { message: 'Menu name is required' }),
    menuImg: z.string().optional(),
    restaurantName: z.string().min(1, { message: 'Restaurant name is required' }),
    createdAt: z.date().optional(),
    price: z.number().positive({ message: 'Price must be a positive number' }),
    isAvailable: z.boolean(),
});

export type menuSchemaType = z.infer<typeof menuSchema>;