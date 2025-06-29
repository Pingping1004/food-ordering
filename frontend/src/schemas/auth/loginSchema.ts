import { z } from 'zod';

export const loginSchema = z.object({
    email: z.string().trim().email('Invalid email address'),
    password: z.string().trim().min(4, 'Password must be at least 4 characters'),
});

export type loginSchemaType = z.infer<typeof loginSchema>;