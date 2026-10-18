import { z } from "zod"

const base = {
    name: z.string().trim().min(1, { message: 'กรุณาใส่ชื่อ' }).max(60, { message: 'ชื่อยาวเกินไป' }),
    email: z.string().email({ message: 'กรุณาใส่อีเมล' }),
    password: z.string().min(6, { message: 'รหัสผ่านอย่างน้อย 6 ตัวอักษร' }),
}

/** Join with an invite code (the code decides the role). Format XXXX-XXXX (dash / case optional). */
export const signupSchema = z.object({
    ...base,
    inviteCode: z.string().transform((v) => v.toUpperCase().replace(/[^A-Z0-9]/g, "")).pipe(z.string().length(8, { message: 'รหัสเชิญมี 8 ตัวอักษร เช่น ABCD-2345' })),
});

export type signupSchemaType = z.input<typeof signupSchema>;
