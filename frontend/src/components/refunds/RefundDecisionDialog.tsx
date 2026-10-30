"use client";

import { useId, useState } from "react";
import { ActionButton } from "@/components/ui/kit";
import { Dialog } from "@/components/ui/Dialog";
import type { RefundDecisionAction } from "@/lib/schema";

const ACTION_COPY: Record<RefundDecisionAction, { title: string; body: string; confirm: string; variant: "primary" | "danger"; noteLabel: string; noteRequired: boolean }> = {
    approve: { title: "อนุมัติคำขอคืนเงิน", body: "เมื่ออนุมัติ นักเรียนจะเห็นว่ากำลังรอโอนคืน โอนเงินคืนให้นักเรียน แล้วกด “โอนคืนแล้ว”", confirm: "อนุมัติ", variant: "primary", noteLabel: "ข้อความถึงนักเรียน (ไม่บังคับ)", noteRequired: false },
    reject: { title: "ไม่อนุมัติคำขอคืนเงิน", body: "นักเรียนและโรงเรียนจะเห็นเหตุผลที่คุณเขียน การตัดสินใจนี้เปลี่ยนไม่ได้ (นักเรียนส่งคำขอใหม่ได้)", confirm: "ไม่อนุมัติ", variant: "danger", noteLabel: "เหตุผลที่ไม่อนุมัติ (จำเป็น อย่างน้อย 3 ตัวอักษร)", noteRequired: true },
    mark_refunded: { title: "โอนคืนแล้ว", body: "กดเมื่อนักเรียนได้รับเงินคืนจริงแล้วเท่านั้น ระบบนี้บันทึกผลเฉพาะสถานะ ไม่ได้โอนเงินให้ และเปลี่ยนกลับไม่ได้", confirm: "ยืนยัน โอนคืนแล้ว", variant: "primary", noteLabel: "หมายเหตุ เช่น ช่องทางที่โอนคืน (ไม่บังคับ)", noteRequired: false },
};

/** Confirm step for the shop's refund decisions. Reject needs a reason (the API checks it too). */
export function RefundDecisionDialog({ action, onCancel, onConfirm, pending }: Readonly<{ action: RefundDecisionAction | null; onCancel: () => void; onConfirm: (note: string) => void; pending: boolean }>) {
    const [note, setNote] = useState("");
    const id = useId();
    const copy = action ? ACTION_COPY[action] : null;
    const valid = !copy?.noteRequired || note.trim().length >= 3;

    return (
        <Dialog open={!!action} onClose={onCancel} title={copy?.title ?? ""}>
            {copy && (
                <form
                    className="flex flex-col gap-4"
                    onSubmit={(e) => { e.preventDefault(); if (valid && !pending) onConfirm(note.trim()); }}
                >
                    <p className="text-[15px] leading-relaxed text-brand-muted">{copy.body}</p>
                    <label htmlFor={id} className="flex flex-col gap-1.5 text-sm font-semibold">
                        {copy.noteLabel}
                        <textarea
                            id={id}
                            rows={3}
                            maxLength={500}
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            aria-required={copy.noteRequired}
                            aria-invalid={copy.noteRequired && note.length > 0 && !valid}
                            className="rounded-[10px] border-[1.5px] border-line px-3 py-2.5 font-app text-[15px] font-normal outline-none focus:border-primary-main focus:ring-2 focus:ring-primary-main/20 aria-[invalid=true]:border-danger-main"
                        />
                    </label>
                    <div className="flex flex-wrap justify-end gap-2.5">
                        <ActionButton variant="outline" size="md" onClick={onCancel} disabled={pending}>ยกเลิก</ActionButton>
                        <ActionButton type="submit" variant={copy.variant} size="md" disabled={!valid || pending}>{pending ? "กำลังบันทึก..." : copy.confirm}</ActionButton>
                    </div>
                </form>
            )}
        </Dialog>
    );
}
