"use client";

import { useState } from "react";
import { z } from "zod";
import { CenteredScreen } from "@/components/users/StudentShell";
import { ActionButton, ButtonLink, Field, Icon, Notice, TextInput } from "@/components/ui/kit";
import { toastError, toastDanger } from "@/components/ui/Toast";
import { requestPasswordReset } from "@/lib/services/student";

const emailSchema = z.string().trim().email("กรุณากรอกอีเมลให้ถูกต้อง");

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState("");
    const [error, setError] = useState<string>();
    const [sent, setSent] = useState(false);
    const [busy, setBusy] = useState(false);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        const parsed = emailSchema.safeParse(email);
        if (!parsed.success) return setError(parsed.error.issues[0]?.message);

        setError(undefined);
        setBusy(true);
        try {
            await requestPasswordReset(parsed.data);
            // Same message whether or not the account exists – do not leak which emails are registered.
            setSent(true);
        } catch (err) {
            toastError("ส่งลิงก์ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง", err);
        } finally {
            setBusy(false);
        }
    };

    return (
        <CenteredScreen>
            <a href="/login" aria-label="กลับไปเข้าสู่ระบบ" className="-ml-2.5 flex h-11 w-11 items-center justify-center rounded-xl text-brand-dark hover:bg-ground">
                <Icon name="back" size={24} />
            </a>

            <div className="flex flex-col gap-2">
                <h1 className="text-[28px] font-bold leading-tight">ตั้งรหัสผ่านใหม่</h1>
                <p className="text-base leading-relaxed text-brand-muted">ใส่อีเมลที่ใช้สมัคร เราจะส่งลิงก์ตั้งรหัสผ่านใหม่ให้</p>
            </div>

            <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
                <Field label="อีเมล" size="lg" error={error}>
                    <TextInput size="lg" type="email" autoComplete="email" placeholder="name@school.ac.th" value={email} invalid={!!error} onChange={(e) => setEmail(e.target.value)} />
                </Field>
                <ActionButton type="submit" full disabled={busy}>{busy ? "กำลังส่ง..." : sent ? "ส่งลิงก์อีกครั้ง" : "ส่งลิงก์"}</ActionButton>
            </form>

            {sent && (
                <Notice tone="success" icon="check" role="status">
                    ถ้ามีบัญชีนี้อยู่ เราส่งลิงก์ไปแล้ว ลิงก์ใช้ได้ 30 นาที ไม่เห็นอีเมล? ดูในโฟลเดอร์สแปม
                </Notice>
            )}

            <div className="mt-auto flex flex-col gap-1 rounded-2xl bg-ground p-4">
                <span className="text-[15px] font-bold">ร้านค้าที่ไม่ได้ใช้อีเมล</span>
                <span className="text-sm leading-relaxed text-slate">ติดต่อผู้ดูแลโรงเรียน หรือเจ้าของร้าน ให้ส่งคำเชิญใหม่</span>
            </div>

            <ButtonLink href="/login" variant="outline" size="md" className="self-center">กลับไปเข้าสู่ระบบ</ButtonLink>
        </CenteredScreen>
    );
}
