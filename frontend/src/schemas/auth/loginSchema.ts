import { z } from 'zod';

export const loginSchema = z.object({
    email: z.string().trim().email('อีเมลไม่ถูกต้อง'),
    password: z.string().trim().min(4, 'รหัสผ่านต้องมีความยาวมากกว่า4ตัวอักษร'),
});

export type loginSchemaType = z.infer<typeof loginSchema>;