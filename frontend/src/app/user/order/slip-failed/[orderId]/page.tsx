"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import clsx from "clsx";
import { ActionButton, ButtonLink, Card, Icon, OrderTrackingSkeleton } from "@/components/ui/kit";
import { StudentTopBar } from "@/components/users/StudentShell";
import CountdownTimer from "@/components/Timer";
import { api } from "@/lib/api";
import { getParamId } from "@/util/param";
import { formatBaht, orderCode } from "@/lib/schema/format";
import type { Order } from "@/lib/schema";

/** `reason` is set by the payment page from the slip-verification response (Events: payment_verification_failed). */
const REASONS = {
    amount: { title: "ยอดเงินไม่ตรง", hint: "โอนเพิ่มส่วนที่ขาด แล้วส่งสลิปทั้ง 2 ใบ หรือติดต่อร้านเพื่อยกเลิก" },
    account: { title: "โอนผิดบัญชี", hint: "ตรวจชื่อบัญชีจาก QR ของร้านนี้ให้ตรง แล้วส่งสลิปใหม่" },
    duplicate: { title: "สลิปนี้เคยใช้ไปแล้ว", hint: "ใช้สลิปของการโอนครั้งนี้เท่านั้น ถ้าเพิ่งโอนให้รอสักครู่แล้วส่งใหม่" },
    unreadable: { title: "อ่านสลิปไม่ได้", hint: "ถ่ายหรือแคปหน้าจอให้เห็นข้อความทั้งหมดชัดเจน แล้วส่งใหม่" },
    bank: { title: "ธนาคารนี้ยังไม่รองรับ", hint: "ลองโอนผ่านพร้อมเพย์จากแอปธนาคารอื่น แล้วส่งสลิปใหม่" },
} as const;
type ReasonKey = keyof typeof REASONS;

const COMMON_CAUSES = [
    "ยอดเงินไม่ตรงกับออเดอร์",
    "โอนผิดบัญชี (ไม่ใช่บัญชีของร้านนี้)",
    "สลิปเคยใช้ไปแล้ว หรือรูปไม่ชัด",
    "โอนจากธนาคารที่ยังไม่รองรับ",
];

function SlipFailed() {
    const params = useParams();
    const search = useSearchParams();
    const orderId = getParamId(params.orderId);

    const reasonKey = (search.get("reason") as ReasonKey) in REASONS ? (search.get("reason") as ReasonKey) : "amount";
    const reason = REASONS[reasonKey];
    const paid = Number(search.get("paid")) || null;

    const [order, setOrder] = useState<(Order & { restaurant?: { contactTel?: string } }) | null>(null);
    const [expired, setExpired] = useState(false);

    useEffect(() => {
        let active = true;
        (async () => {
            try {
                const secret = localStorage.getItem(`orderSecret:${orderId}`);
                const res = await api.get(`order/${orderId}`, { headers: { "x-order-secret": secret } });
                if (active) setOrder(res.data);
            } catch {
                /* page still explains the failure without order details */
            }
        })();
        return () => { active = false; };
    }, [orderId]);

    const deadline = order ? new Date(new Date(order.orderAt).getTime() + 3 * 60 * 1000) : null;
    const tel = order?.restaurant?.contactTel;

    return (
        <div className="mx-auto flex min-h-app w-full max-w-[640px] flex-col bg-ground font-app text-brand-dark">
            <StudentTopBar
                title={`ชำระเงิน · ${order ? orderCode(order.orderId) : ""}`}
                backHref={`/user/order/payment/${orderId}`}
                right={deadline && !expired ? (
                    <span role="timer" className="rounded-full bg-brand-orange-light px-3 py-2 text-base font-bold text-brand-orange-text">
                        <CountdownTimer deadline={deadline} onExpire={() => setExpired(true)} />
                    </span>
                ) : undefined}
            />

            <main className="flex flex-1 flex-col gap-4 px-4 py-6">
                <section role="alert" className="flex flex-col gap-3 rounded-[20px] border-2 border-danger-main bg-white p-5">
                    <span className="flex items-center gap-2.5 text-[19px] font-bold text-danger-text">
                        <Icon name="alert" size={26} strokeWidth={2.2} />
                        สลิปยังไม่ผ่าน
                    </span>
                    <p className="text-base leading-relaxed">
                        <b>{reason.title}</b>
                        {reasonKey === "amount" && paid != null && order && <> สลิปโอน {formatBaht(paid)} บาท แต่ออเดอร์นี้ {formatBaht(order.totalAmount)} บาท</>}
                    </p>
                    <p className="text-[15px] leading-relaxed text-slate">
                        {reasonKey === "amount" && paid != null && order && paid < order.totalAmount
                            ? `โอนเพิ่ม ${formatBaht(order.totalAmount - paid)} บาท แล้วส่งสลิปทั้ง 2 ใบ หรือติดต่อร้านเพื่อยกเลิก`
                            : reason.hint}
                    </p>
                </section>

                <Card className="flex flex-col gap-2 px-[18px] py-4">
                    <h2 className="text-[15px] font-bold">สาเหตุที่พบบ่อย</h2>
                    <ul className="list-disc space-y-1 pl-5 text-sm leading-[1.8] text-slate">
                        {COMMON_CAUSES.map((c) => <li key={c}>{c}</li>)}
                    </ul>
                </Card>

                {expired && (
                    <p role="status" className="rounded-2xl bg-danger-light p-4 text-[15px] font-semibold text-danger-text">หมดเวลาชำระเงินแล้ว ออเดอร์นี้จะถูกยกเลิกอัตโนมัติ</p>
                )}
            </main>

            <footer className="flex flex-col gap-2.5 px-4 pb-6 pt-4">
                <ButtonLink href={`/user/order/payment/${orderId}`} full className={clsx(expired && "pointer-events-none opacity-50")}>ส่งสลิปใหม่</ButtonLink>
                {tel ? (
                    <a href={`tel:${tel}`} className="flex h-[52px] items-center justify-center rounded-2xl border-[1.5px] border-line bg-white text-base font-semibold">โทรหาร้าน</a>
                ) : (
                    <ActionButton variant="outline" full disabled>โทรหาร้าน</ActionButton>
                )}
            </footer>
        </div>
    );
}

export default function SlipFailedPage() {
    return (
        <Suspense fallback={<OrderTrackingSkeleton title="กำลังโหลดข้อมูล..." />}>
            <SlipFailed />
        </Suspense>
    );
}
