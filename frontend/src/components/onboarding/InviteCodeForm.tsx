"use client";

import { useState } from "react";
import { ActionButton, Field, TextInput } from "@/components/ui/kit";
import { conflictReasons, formatInviteCode, normalizeInviteCode } from "@/lib/services/student";

/**
 * Human message for a failed redeem / change-school call. The API answers every kind of bad code with the same 400 on
 * purpose (it never reveals whether a code exists), so the text lists the usual reasons instead of guessing one.
 */
export function inviteCodeError(err: unknown): string {
    const res = (err as { response?: { status?: number; data?: { message?: string | string[] } } })?.response;
    const status = res?.status;
    const server = Array.isArray(res?.data?.message) ? res?.data?.message.join(" ") : res?.data?.message;
    if (status === 429) return "ลองผิดบ่อยเกินไป กรุณารอ 15 นาทีแล้วลองใหม่";
    if (status === 409) return conflictReasons(err).join(" · ") || server || "ใช้รหัสนี้ไม่ได้ เพราะคุณอยู่ในโรงเรียนอื่นแล้ว เปลี่ยนโรงเรียนได้ที่ ตั้งค่า > โรงเรียน";
    if (status === 403 && server) return server;
    if (status && status >= 500) return "ระบบขัดข้อง กรุณาลองใหม่อีกครั้ง";
    if (!status) return "เชื่อมต่อไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่";
    return "รหัสเชิญไม่ถูกต้อง หมดอายุ ถูกยกเลิก หรือถูกใช้ครบแล้ว กรุณาตรวจสอบตัวอักษรอีกครั้ง หรือขอรหัสใหม่จากผู้ออกรหัส";
}

/** One field, XXXX-XXXX. Used by onboarding, the redeem dialog and the Change school dialog. */
export function InviteCodeForm({ onSubmit, label = "ยืนยัน", busy, error, fieldLabel = "รหัสเชิญ", hint = "ขอรหัสจากโรงเรียนหรือเจ้าของร้าน เช่น ABCD-2345" }: Readonly<{ onSubmit: (code: string) => void | Promise<void>; label?: string; busy?: boolean; error?: string; fieldLabel?: string; hint?: string }>) {
    const [code, setCode] = useState("");
    const [touched, setTouched] = useState(false);
    const invalid = touched && normalizeInviteCode(code).length !== 8;

    return (
        <form
            className="flex flex-col gap-4"
            noValidate
            onSubmit={(e) => {
                e.preventDefault();
                setTouched(true);
                if (normalizeInviteCode(code).length === 8) void onSubmit(code);
            }}
        >
            <Field label={fieldLabel} size="lg" hint={hint} error={invalid ? "รหัสเชิญมี 8 ตัวอักษร" : error}>
                <TextInput
                    size="lg"
                    value={code}
                    invalid={invalid || !!error}
                    placeholder="ABCD-2345"
                    autoComplete="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                    maxLength={9}
                    className="font-mono tracking-widest"
                    onChange={(e) => setCode(formatInviteCode(e.target.value))}
                />
            </Field>
            <ActionButton type="submit" full disabled={busy}>{busy ? "กำลังตรวจสอบ..." : label}</ActionButton>
        </form>
    );
}
