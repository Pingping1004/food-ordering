"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/kit";
import { getNotificationPermission } from "@/lib/firebase-messaging";

const SEEN_KEY = "notify_prompt_seen";

/** One-time, skippable invitation to turn on push, shown on the tracking page of the student's first order. */
export function NotifyPrompt({ orderId }: Readonly<{ orderId: string }>) {
    const [show, setShow] = useState(false);

    useEffect(() => {
        try {
            if (localStorage.getItem(SEEN_KEY)) return;
            localStorage.setItem(SEEN_KEY, "1");
        } catch { return; } // storage blocked: never nag
        const permission = getNotificationPermission();
        if (permission === "default") setShow(true);
    }, []);

    if (!show) return null;
    return (
        <section className="flex flex-col gap-3 rounded-[20px] border border-line-soft bg-white p-5">
            <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-light text-primary-dark"><Icon name="bell" size={20} /></span>
                <span className="flex flex-col gap-0.5">
                    <h2 className="text-[17px] font-bold">รับแจ้งเตือนเมื่อร้านรับออเดอร์ อาหารพร้อม หรือร้านทำช้า</h2>
                    <span className="text-[15px] text-brand-muted">ไม่เปิดก็ได้ ดูสถานะได้ที่หน้านี้เสมอ</span>
                </span>
            </div>
            <div className="flex gap-2.5">
                <button type="button" onClick={() => setShow(false)} className="h-12 flex-1 rounded-xl border-[1.5px] border-line bg-white text-base font-semibold hover:bg-ground">ไว้ทีหลัง</button>
                <Link href={`/user/onboarding/notify?next=${encodeURIComponent(`/user/order/wait/${orderId}`)}`} className="flex h-12 flex-1 items-center justify-center rounded-xl bg-primary-main text-base font-semibold text-white">เปิดแจ้งเตือน</Link>
            </div>
        </section>
    );
}
