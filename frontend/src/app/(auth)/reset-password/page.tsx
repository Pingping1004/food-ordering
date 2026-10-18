"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { CenteredScreen } from "@/components/users/StudentShell";
import { ActionButton, Field, TextInput } from "@/components/ui/kit";
import { toastError, toastDanger, toastSuccess } from "@/components/ui/Toast";
import { authErrorMessage, updatePasswordApi } from "@/auth/auth.service";
import { useAuth } from "@/auth/auth.hooks";
import { postLoginPath } from "@/auth/access";
import LoadingPage from "@/components/LoadingPage";

const schema = z.object({
    password: z.string().min(6, "รหัสผ่านอย่างน้อย 6 ตัวอักษร"),
    confirm: z.string(),
}).refine((v) => v.password === v.confirm, { path: ["confirm"], message: "รหัสผ่านไม่ตรงกัน" });

/** Opened from the e-mail link (the callback route has already turned it into a session). */
export default function ResetPasswordPage() {
    const router = useRouter();
    const { user, initializing } = useAuth();
    const [v, setV] = useState({ password: "", confirm: "" });
    const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({});
    const [busy, setBusy] = useState(false);

    if (initializing) return <LoadingPage />;

    if (!user) {
        return (
            <CenteredScreen>
                <h1 className="text-[28px] font-bold">ลิงก์หมดอายุแล้ว</h1>
                <p className="text-base text-brand-muted">ลิงก์ตั้งรหัสผ่านใช้ได้ครั้งเดียวและมีอายุจำกัด กรุณาขอลิงก์ใหม่</p>
                <ActionButton full onClick={() => router.push("/forgot-password")}>ขอลิงก์ใหม่</ActionButton>
            </CenteredScreen>
        );
    }

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        const parsed = schema.safeParse(v);
        if (!parsed.success) {
            const next: typeof errors = {};
            parsed.error.issues.forEach((i) => { const k = i.path[0] as keyof typeof errors; if (!next[k]) next[k] = i.message; });
            return setErrors(next);
        }
        setErrors({});
        setBusy(true);
        try {
            await updatePasswordApi(parsed.data.password);
            toastSuccess("เปลี่ยนรหัสผ่านแล้ว");
            router.push(postLoginPath(user));
        } catch (err) {
            toastError(authErrorMessage(err, "เปลี่ยนรหัสผ่านไม่สำเร็จ กรุณาลองใหม่อีกครั้ง"), err);
        } finally {
            setBusy(false);
        }
    };

    return (
        <CenteredScreen>
            <div className="flex flex-col gap-2">
                <h1 className="text-[28px] font-bold leading-tight">ตั้งรหัสผ่านใหม่</h1>
                <p className="text-base leading-relaxed text-brand-muted">สำหรับบัญชี {user.email}</p>
            </div>
            <form onSubmit={submit} noValidate className="flex flex-col gap-5">
                <Field label="รหัสผ่านใหม่" size="lg" error={errors.password}>
                    <TextInput size="lg" type="password" autoComplete="new-password" value={v.password} invalid={!!errors.password} onChange={(e) => setV({ ...v, password: e.target.value })} />
                </Field>
                <Field label="ยืนยันรหัสผ่านใหม่" size="lg" error={errors.confirm}>
                    <TextInput size="lg" type="password" autoComplete="new-password" value={v.confirm} invalid={!!errors.confirm} onChange={(e) => setV({ ...v, confirm: e.target.value })} />
                </Field>
                <ActionButton type="submit" full disabled={busy}>{busy ? "กำลังบันทึก..." : "บันทึกรหัสผ่าน"}</ActionButton>
            </form>
        </CenteredScreen>
    );
}
