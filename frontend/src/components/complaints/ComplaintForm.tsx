"use client";

import { useState } from "react";
import clsx from "clsx";
import { ActionButton } from "@/components/ui/kit";
import { toastError, toastSuccess } from "@/components/ui/Toast";
import { sendComplaint, type ComplaintTarget } from "@/lib/services/complaints";

const TARGETS: { value: ComplaintTarget; label: string; hint: string }[] = [
    { value: "SCHOOL", label: "ผู้ดูแลโรงเรียน", hint: "เรื่องร้านค้า อาหาร หรือการรับของในโรงอาหาร" },
    { value: "SYSTEM", label: "ผู้ดูแลระบบ", hint: "เรื่องแอป การชำระเงิน หรือข้อผิดพลาดของระบบ" },
];

/** Student complaint about an order; the student picks who receives it. */
export function ComplaintForm({ orderId }: Readonly<{ orderId: string }>) {
    const [target, setTarget] = useState<ComplaintTarget>("SCHOOL");
    const [message, setMessage] = useState("");
    const [busy, setBusy] = useState(false);
    const [sent, setSent] = useState(false);
    const valid = message.trim().length >= 5;

    const submit = async () => {
        if (!valid || busy) return;
        setBusy(true);
        try {
            await sendComplaint(orderId, { target, message: message.trim() });
            setSent(true);
            toastSuccess("ส่งเรื่องแล้ว");
        } catch (e) {
            toastError("ส่งเรื่องไม่สำเร็จ", e);
        } finally {
            setBusy(false);
        }
    };

    return (
        <section className="flex flex-col gap-3.5 rounded-[20px] border border-line-soft bg-white p-5">
            <h2 className="text-[17px] font-bold">มีปัญหากับออเดอร์? แจ้งเรา</h2>
            {sent ? (
                <p role="status" className="rounded-xl bg-success-light px-4 py-3 text-[15px] font-semibold text-success-main">ส่งเรื่องเรียบร้อย ผู้ดูแลจะตรวจสอบ</p>
            ) : (
                <>
                    <div role="radiogroup" aria-label="ส่งเรื่องถึงใคร" className="grid gap-2 sm:grid-cols-2">
                        {TARGETS.map((t) => (
                            <button key={t.value} type="button" role="radio" aria-checked={target === t.value} onClick={() => setTarget(t.value)}
                                className={clsx("flex flex-col gap-0.5 rounded-xl p-3 text-left", target === t.value ? "border-2 border-primary-main bg-ground-blue" : "border-[1.5px] border-line bg-white")}>
                                <span className="text-[15px] font-semibold">{t.label}</span>
                                <span className="text-[13px] text-brand-muted">{t.hint}</span>
                            </button>
                        ))}
                    </div>
                    <textarea value={message} onChange={(e) => setMessage(e.target.value)} maxLength={1000} rows={4} aria-label="รายละเอียดปัญหา" placeholder="เล่าปัญหาที่เจอ (อย่างน้อย 5 ตัวอักษร)"
                        className="w-full resize-none rounded-xl border-[1.5px] border-line bg-white p-3 text-[15px] outline-none focus:border-primary-main" />
                    <ActionButton variant="outline" size="md" disabled={!valid || busy} onClick={submit}>ส่งเรื่อง</ActionButton>
                </>
            )}
        </section>
    );
}
