import { z } from "zod"

export const signupSchema = z.object({
    email: z.string().email({ message: 'กรุณาใส่อีเมล' }),
    password: z.string().min(4, { message: 'กรุณาใส่รหัสผ่าน' }),
});

export type signupSchemaType = z.infer<typeof signupSchema>;