"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import clsx from "clsx";
import { getParamId } from "@/util/param";
import { ActionButton, ErrorState, Icon, OrderTrackingSkeleton } from "@/components/ui/kit";
import { StepHeader } from "@/components/users/Stepper";
import { useOrderPoll } from "@/hook/useOrderPoll";
import { useCart } from "@/context/CartContext";
import { NotifyPrompt } from "@/components/users/NotifyPrompt";
import { useEffect } from "react";
import { TIMELINE, fmtTime, normalizeStatus, pickupAtOf, restaurantTelOf, timelineIndex, timelineLabels } from "@/lib/order-flow";
import { formatBaht, orderCode } from "@/lib/schema/format";

const STATUS_COPY: Record<string, { chip: string; sub: string }> = {
    receive: { chip: "รอร้านรับออเดอร์", sub: "ร้านมีเวลา 3 นาทีในการรับ เมื่อร้านรับแล้วจะพาไปหน้าชำระเงินอัตโนมัติ หากไม่รับ ระบบจะยกเลิกให้" },
    cooking: { chip: "กำลังทำอาหาร", sub: "หน้านี้อัปเดตเองเมื่ออาหารพร้อม" },
    delay: { chip: "ร้านแจ้งว่าช้า", sub: "ร้านขอเวลาเพิ่ม หน้านี้อัปเดตเองเมื่ออาหารพร้อม" },
};

/** Tracking screen (design: "ติดตามออเดอร์"). Redirects itself to pay / pick-up / failed when the order moves. */
export default function OrderTrackingPage() {
    const params = useParams();
    const orderId = getParamId(params.orderId);
    const { clearCart } = useCart();
    const { order, loading, error, retry } = useOrderPoll(orderId, "wait");

    useEffect(() => { clearCart(); }, [clearCart]);

    if (loading) return <OrderTrackingSkeleton />;
    if (error) return <div className="mx-auto flex min-h-app w-full max-w-[640px] flex-col justify-center bg-ground font-app"><ErrorState message="ไม่สามารถโหลดสถานะออเดอร์ได้" onRetry={retry} /></div>;
    if (!order) return <div className="p-6 font-app">ไม่พบออเดอร์ของคุณ</div>;

    const status = normalizeStatus(order.status);
    const copy = STATUS_COPY[status] ?? STATUS_COPY.cooking;
    const now = timelineIndex(order);
    const tel = restaurantTelOf(order);
    const total = order.orderMenus.reduce((n, m) => n + m.unitPrice * m.quantity, 0);
    const times: Record<number, string> = { 0: fmtTime(order.orderAt), 1: fmtTime(order.acceptAt), 2: fmtTime(order.paidAt), 4: `ประมาณ ${fmtTime(pickupAtOf(order))}` };

    return (
        <div className="mx-auto flex min-h-app w-full max-w-[640px] flex-col bg-ground font-app text-brand-dark md:max-w-[720px]">
            <StepHeader title={`ออเดอร์ ${orderCode(order.orderId)}`} backHref="/user/restaurant" backLabel="กลับหน้าหลัก" right={<span className="text-[13px] text-brand-muted">อัปเดตอัตโนมัติ</span>} />

            <main className="flex flex-1 flex-col gap-4 p-4">
                <NotifyPrompt orderId={order.orderId} />
                <section aria-live="polite" className="flex flex-col gap-4 rounded-3xl bg-primary-main p-6 text-white">
                    <span className="inline-flex items-center gap-2 self-start rounded-full bg-white/20 px-3 py-1.5 text-sm font-semibold">
                        <Icon name="clock" size={16} strokeWidth={2.2} />
                        {copy.chip}
                    </span>
                    <div className="flex flex-col gap-1">
                        <span className="text-base opacity-90">พร้อมรับประมาณ</span>
                        <span className="text-5xl font-bold leading-none">{fmtTime(pickupAtOf(order))}</span>
                        <span className="text-[15px] opacity-90">{order.restaurant?.name}{order.restaurant?.location ? ` · ${order.restaurant.location}` : ""}</span>
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <div className="h-2.5 overflow-hidden rounded-full bg-white/25"><div className="h-full rounded-full bg-white transition-all" style={{ width: `${Math.min(100, ((now + 1) / TIMELINE.length) * 100)}%` }} /></div>
                        <span className="text-[13px] opacity-90">{copy.sub}</span>
                    </div>
                </section>

                <section className="rounded-[20px] border border-line-soft bg-white p-5">
                    <h2 className="mb-4 text-[17px] font-bold">สถานะ</h2>
                    <ol className="flex flex-col">
                        {timelineLabels(order).map((label, i) => {
                            const state = i < now ? "done" : i === now ? "now" : "todo";
                            return (
                                <li key={label} className="flex gap-3.5" aria-current={state === "now" ? "step" : undefined}>
                                    <span className="flex flex-col items-center">
                                        <span className={clsx("flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white", state === "done" && "bg-success-main", state === "now" && "bg-primary-main", state === "todo" && "box-border border-2 border-line bg-white")}>
                                            {state === "done" && <Icon name="check" size={16} strokeWidth={3} />}
                                        </span>
                                        {i < TIMELINE.length - 1 && <span className={clsx("min-h-5 w-0.5 flex-1", state === "done" ? "bg-success-main" : "bg-line-soft")} />}
                                    </span>
                                    <span className="flex flex-col gap-0.5 pb-[18px] pt-1">
                                        <span className={clsx("text-base", state === "now" ? "font-bold" : "font-medium", state === "todo" && "text-brand-muted")}>{label}</span>
                                        <span className="text-sm text-brand-muted">{state === "now" ? "ตอนนี้" : times[i] ?? ""}</span>
                                    </span>
                                </li>
                            );
                        })}
                    </ol>
                </section>

                <section className="flex flex-col gap-2.5 rounded-[20px] border border-line-soft bg-white p-5">
                    <h2 className="text-[17px] font-bold">รายการ</h2>
                    {order.orderMenus.map((m) => <div key={m.orderMenuId ?? m.menuName} className="flex justify-between gap-3 text-[15px]"><span>{m.quantity} × {m.menuName}</span><span>{formatBaht(m.unitPrice * m.quantity)}</span></div>)}
                    {order.details && <p className="rounded-xl bg-brand-orange-light px-3 py-2 text-sm"><b>หมายเหตุ:</b> {order.details}</p>}
                    <div className="flex justify-between border-t border-row-line pt-2.5 text-base font-bold"><span>รวม</span><span>{formatBaht(total)} บาท</span></div>
                </section>

                {tel ? (
                    <a href={`tel:${tel}`} className="flex h-[52px] items-center justify-center gap-2 rounded-[14px] border-[1.5px] border-line bg-white text-base font-semibold hover:bg-ground">
                        <Icon name="user" size={20} />โทรหาร้าน
                    </a>
                ) : (
                    <ActionButton variant="outline" full disabled>โทรหาร้าน</ActionButton>
                )}
                <Link href="/user/orders" className="py-1 text-center text-[15px] font-semibold text-primary-dark">ดูออเดอร์ทั้งหมดของฉัน</Link>
            </main>
        </div>
    );
}
