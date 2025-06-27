import { z } from "zod"

export const signupSchema = z.object({
    email: z.string().email({ message: 'Email is required' }),
    password: z.string().min(4, { message: 'Password is required' }),
});

export type signupSchemaType = z.infer<typeof signupSchema>;