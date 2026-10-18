"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import clsx from "clsx";
import { getParamId } from "@/util/param";
import { ActionButton, ErrorState, Icon, OrderTrackingSkeleton } from "@/components/ui/kit";
import { useOrderPoll } from "@/hook/useOrderPoll";
import { normalizeStatus, restaurantTelOf, type StudentOrder } from "@/lib/order-flow";
import { orderCode } from "@/lib/schema/format";
import { trackEvent } from "@/lib/track";
import { toastSuccess } from "@/components/ui/Toast";
import { ComplaintForm } from "@/components/complaints/ComplaintForm";
import { RefundEntry } from "@/components/refunds/RefundEntry";
import { normalizePayment } from "@/lib/order-flow";

/** Kept so older imports (`import type { Order } from "…/done/[orderId]/page"`) keep compiling. */
export type Order = StudentOrder;

const STAR_LABELS = ["แย่มาก", "แย่", "พอใช้", "ดี", "ดีมาก"];

/** Pick-up screen (design: "พร้อมรับอาหาร"): big order code to show the cook + one-tap anonymous feedback. */
export default function PickupPage() {
    const params = useParams();
    const router = useRouter();
    const orderId = getParamId(params.orderId);
    const { order, loading, error, retry } = useOrderPoll(orderId, "done");

    const [rating, setRating] = useState(0);
    const [waitedLonger, setWaitedLonger] = useState<boolean | null>(null);
    const [comment, setComment] = useState("");
    const [sent, setSent] = useState(false);
    const [received, setReceived] = useState(false);
    const reviewRef = useRef<HTMLElement>(null);
    const wasPicked = useRef<boolean | null>(null);

    useEffect(() => {
        try { localStorage.removeItem("activeOrderId"); } catch { /* ignore */ }
    }, []);

    useEffect(() => {
        if (!orderId) return;
        try { if (localStorage.getItem("feedback:" + orderId)) setSent(true); } catch { /* storage blocked */ }
    }, [orderId]);

    const pickedNow = !!order && normalizeStatus(order.status) === "done";
    useEffect(() => {
        if (!order) return;
        // Ready -> done while the student is on this page: bring the review section into view once.
        if (wasPicked.current === false && pickedNow) reviewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        wasPicked.current = pickedNow;
    }, [order, pickedNow]);

    if (loading) return <OrderTrackingSkeleton />;
    if (error) return <div className="mx-auto flex min-h-app w-full max-w-[640px] flex-col justify-center bg-ground font-app"><ErrorState message="ไม่สามารถโหลดออเดอร์ได้" onRetry={retry} /></div>;
    if (!order) return <div className="p-6 font-app">ไม่พบออเดอร์ของคุณ</div>;

    const picked = normalizeStatus(order.status) === "done";
    const where = [order.restaurant?.name, order.restaurant?.location].filter(Boolean).join(" · ");
    const tel = restaurantTelOf(order);

    const acknowledge = () => {
        setReceived(true);
        reviewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    const sendFeedback = async (r: number, w: boolean | null, c: string) => {
        if (!r || sent) return;
        await trackEvent("feedback_submitted", { restaurantId: order.restaurantId, metadata: { orderId: order.orderId, rating: r, waitedLonger: w, comment: c.trim().slice(0, 300) || undefined } });
        try { localStorage.setItem("feedback:" + order.orderId, "1"); } catch { /* ignore */ }
        setSent(true);
        toastSuccess("ขอบคุณสำหรับความเห็น");
    };

    return (
        <div className="mx-auto flex min-h-app w-full max-w-[640px] flex-col bg-ground font-app text-brand-dark md:max-w-[720px]">
            <section aria-live="assertive" className="flex flex-col items-center gap-3.5 rounded-b-[32px] bg-success-main px-6 pb-9 pt-7 text-center text-white">
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-success-main"><Icon name="check" size={34} strokeWidth={3} /></span>
                <h1 className="text-[28px] font-bold">{picked ? "รับอาหารเรียบร้อยแล้ว" : "อาหารพร้อมแล้ว!"}</h1>
                {where && <span className="text-base opacity-95">{picked ? where : `ไปรับที่ ${where}`}</span>}
            </section>

            <main className="-mt-2 flex flex-1 flex-col gap-4 px-4 py-5">
                <section className="flex flex-col items-center gap-1.5 rounded-3xl border border-line-soft bg-white p-6">
                    <span className="text-[15px] text-brand-muted">แสดงเลขนี้ให้ร้านดู</span>
                    <span className="text-[72px] font-bold uppercase leading-[1.05] tracking-wide sm:text-[80px]">{orderCode(order.orderId)}</span>
                    <span className="text-center text-[15px] text-brand-muted">{order.orderMenus.map((m) => `${m.quantity} × ${m.menuName}`).join(" · ")}</span>
                </section>

                {!picked && !received && (
                    <ActionButton full onClick={acknowledge}>ได้รับอาหารแล้ว</ActionButton>
                )}

                <section ref={reviewRef} className="flex scroll-mt-4 flex-col gap-3.5 rounded-[20px] border border-line-soft bg-white p-5">
                    <div className="flex flex-col gap-1">
                        <h2 className="text-[17px] font-bold">ครั้งนี้เป็นอย่างไรบ้าง?</h2>
                        <span className="text-sm text-brand-muted">ไม่ระบุชื่อ ช่วยให้โรงเรียนปรับปรุงโรงอาหาร</span>
                    </div>

                    {sent ? (
                        <p role="status" className="flex items-center gap-2 rounded-xl bg-success-light px-4 py-3 text-[15px] font-semibold text-success-main"><Icon name="check" size={18} strokeWidth={2.6} />ขอบคุณ เราได้รับความเห็นของคุณแล้ว</p>
                    ) : (
                        <>
                            <div role="radiogroup" aria-label="ให้คะแนน 1 ถึง 5" className="grid grid-cols-5 gap-2">
                                {STAR_LABELS.map((label, i) => {
                                    const on = i < rating;
                                    return (
                                        <button key={label} type="button" role="radio" aria-checked={i + 1 === rating} aria-label={`${i + 1} ดาว · ${label}`} onClick={() => setRating(i + 1)}
                                            className={clsx("flex h-14 items-center justify-center rounded-[14px] border-[1.5px]", on ? "border-brand-orange bg-brand-orange-light text-brand-orange-text" : "border-line-soft bg-white text-[#98A2B3]")}>
                                            <svg width="26" height="26" viewBox="0 0 24 24" fill={on ? "#FF5C1A" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true"><path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z" /></svg>
                                        </button>
                                    );
                                })}
                            </div>
                            <fieldset className="flex flex-col gap-2">
                                <legend className="mb-2 text-[15px] font-semibold">ต้องรออาหารนานกว่าที่แจ้งไหม?</legend>
                                <div className="flex gap-2">
                                    {[{ v: false, label: "ตรงเวลา" }, { v: true, label: "รอนานกว่ากำหนด" }].map((o) => (
                                        <button key={o.label} type="button" aria-pressed={waitedLonger === o.v} onClick={() => setWaitedLonger(o.v)}
                                            className={clsx("h-12 flex-1 rounded-xl text-[15px] font-semibold", waitedLonger === o.v ? "border-2 border-primary-main bg-ground-blue text-primary-dark" : "border-[1.5px] border-line bg-white")}>
                                            {o.label}
                                        </button>
                                    ))}
                                </div>
                            </fieldset>
                            <textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={300} rows={3} aria-label="ความคิดเห็นเพิ่มเติม" placeholder="ความคิดเห็นเพิ่มเติม (ไม่บังคับ)"
                                className="w-full resize-none rounded-xl border-[1.5px] border-line bg-white p-3 text-[15px] outline-none focus:border-primary-main" />
                            <ActionButton variant="outline" size="md" disabled={!rating} onClick={() => sendFeedback(rating, waitedLonger, comment)}>ส่งความเห็น</ActionButton>
                        </>
                    )}

                </section>

                <ComplaintForm orderId={order.orderId} />

                <RefundEntry orderId={order.orderId} canRequest={normalizePayment(order.paymentStatus) === "PAID"} />

                <div className="flex flex-col gap-2.5">
                    {tel && <a href={`tel:${tel}`} className="flex h-[52px] items-center justify-center rounded-[14px] border-[1.5px] border-line bg-white text-base font-semibold hover:bg-ground">โทรหาร้าน</a>}
                    <ActionButton full variant="outline" onClick={() => router.push("/user/restaurant")}>กลับสู่หน้าหลัก</ActionButton>
                </div>
            </main>
        </div>
    );
}
