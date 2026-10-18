"use client";

import { useState } from "react";
import { ActionButton, Card, Icon } from "@/components/ui/kit";
import { toastDanger, toastSuccess } from "@/components/ui/Toast";
import { formatInviteCode } from "@/lib/services/student";

export async function copyText(text: string, okMessage: string) {
    try {
        await navigator.clipboard.writeText(text);
        toastSuccess(okMessage);
    } catch {
        toastDanger("คัดลอกไม่สำเร็จ", "เบราว์เซอร์ไม่อนุญาตให้คัดลอกอัตโนมัติ กรุณากดค้างที่รหัสแล้วเลือกคัดลอกเอง");
    }
}

/**
 * Student invite code: only ever rendered for system admins and approved school admins (the API sends it to nobody else).
 * Never call this from student / shop screens.
 */
export function InviteCodeCard({ code, onRotate, rotating, readOnlyHint }: Readonly<{ code?: string | null; onRotate: () => void; rotating?: boolean; /** Set when the viewer may not rotate: the button is disabled and this is its tooltip. */ readOnlyHint?: string }>) {
    const [confirming, setConfirming] = useState(false);
    const shown = code ? formatInviteCode(code) : null;

    return (
        <Card className="flex flex-col gap-4 p-6">
            <div className="flex flex-col gap-1">
                <h2 className="text-lg font-bold">รหัสนักเรียน</h2>
                <span className="text-sm text-brand-muted">รหัสสำหรับนักเรียนเท่านั้น ใช้ได้ไม่จำกัดครั้ง สมัครแล้วสั่งอาหารได้ทันที อย่าโพสต์ในที่สาธารณะ ส่วนเจ้าของร้านและผู้ดูแลต้องใช้รหัสของตัวเอง</span>
            </div>

            <div className="flex flex-wrap items-center gap-3">
                <output aria-label="รหัสเชิญ" className="rounded-2xl bg-ground-blue px-5 py-3 font-mono text-[28px] font-bold tracking-[0.2em] text-primary-dark">{shown ?? "— — — —"}</output>
                <ActionButton variant="outline" size="md" disabled={!shown} onClick={() => shown && copyText(shown, "คัดลอกรหัสเชิญแล้ว")}>
                    <Icon name="link" size={18} />คัดลอก
                </ActionButton>
            </div>

            {!confirming ? (
                <div>
                    <ActionButton variant="dangerOutline" size="md" onClick={() => setConfirming(true)} disabled={rotating || !!readOnlyHint} title={readOnlyHint} aria-disabled={!!readOnlyHint || undefined}>สร้างรหัสใหม่</ActionButton>
                </div>
            ) : (
                <div role="alertdialog" aria-label="ยืนยันสร้างรหัสใหม่" className="flex flex-col gap-3 rounded-2xl border border-danger-main bg-danger-light p-4">
                    <p className="text-[15px] leading-relaxed"><b>รหัสเดิมจะใช้ไม่ได้ทันที</b> คนที่เข้าร่วมแล้วไม่ได้รับผลกระทบ แต่ผู้ที่ยังไม่ได้สมัครต้องใช้รหัสใหม่</p>
                    <div className="flex flex-wrap gap-2.5">
                        <ActionButton variant="outline" size="md" onClick={() => setConfirming(false)}>ยกเลิก</ActionButton>
                        <ActionButton variant="danger" size="md" disabled={rotating} onClick={() => { onRotate(); setConfirming(false); }}>{rotating ? "กำลังสร้าง..." : "ยืนยันสร้างรหัสใหม่"}</ActionButton>
                    </div>
                </div>
            )}
        </Card>
    );
}
