"use client";

import { useParams, useRouter } from "next/navigation";
import { getParamId } from "@/util/param";
import { ActionButton, Chip, ErrorState, Icon, Notice, OrderTrackingSkeleton } from "@/components/ui/kit";
import { StepHeader } from "@/components/users/Stepper";
import { useOrderPoll } from "@/hook/useOrderPoll";
import { normalizePayment, normalizeStatus } from "@/lib/order-flow";
import { formatBaht, orderCode } from "@/lib/schema/format";
import { useEffect } from "react";
import { RefundEntry, requestFor } from "@/components/refunds/RefundEntry";
import { useMyRefunds } from "@/hook/useRefunds";

function reasonFor(paid: boolean, expiredUnpaid: boolean) {
    if (expiredUnpaid) return "หมดเวลาชำระเงิน ระบบจึงยกเลิกออเดอร์ให้";
    if (paid) return "ร้านไม่ได้กดรับภายใน 3 นาที หรือไม่สามารถทำออเดอร์นี้ได้ ระบบจึงยกเลิกให้";
    return "ออเดอร์นี้ถูกยกเลิก";
}

export default function CancelledOrderPage() {
    const params = useParams();
    const router = useRouter();
    const orderId = getParamId(params.orderId);
    const { order, loading, error, retry } = useOrderPoll(orderId, "failed", { intervalMs: 10_000 });
    const myRefunds = useMyRefunds();

    useEffect(() => { try { localStorage.removeItem("activeOrderId"); } catch { /* ignore */ } }, []);

    if (loading) return <OrderTrackingSkeleton />;
    if (error) return <div className="mx-auto flex min-h-app w-full max-w-[640px] flex-col justify-center bg-ground font-app"><ErrorState onRetry={retry} /></div>;
    if (!order) return <div className="p-6 font-app">ไม่พบออเดอร์ของคุณ</div>;

    const pay = normalizePayment(order.paymentStatus);
    const paid = pay === "PAID";
    const refunded = pay === "REFUNDED";
    const total = order.orderMenus.reduce((n, m) => n + m.unitPrice * m.quantity, 0);
    const count = order.orderMenus.reduce((n, m) => n + m.quantity, 0);
    const request = requestFor(myRefunds.data, order.orderId);
    const expiredUnpaid = !paid && !refunded && normalizeStatus(order.status) === "rejected";

    return (
        <div className="mx-auto flex min-h-app w-full max-w-[640px] flex-col bg-ground font-app text-brand-dark md:max-w-[720px]">
            <StepHeader title={`ออเดอร์ ${orderCode(order.orderId)}`} backHref="/user/restaurant" backLabel="กลับหน้าหลัก" />

            <main className="flex flex-1 flex-col gap-4 px-4 py-6">
                <section className="flex flex-col items-center gap-3 px-3 pt-2 text-center">
                    <span className="flex h-16 w-16 items-center justify-center rounded-full bg-danger-light text-danger-text"><Icon name="x" size={32} strokeWidth={2.5} /></span>
                    <h2 className="text-[26px] font-bold">ออเดอร์ถูกยกเลิก</h2>
                    <p className="text-base leading-relaxed text-brand-muted">{reasonFor(paid || refunded, expiredUnpaid)}</p>
                </section>

                <section className="flex flex-col gap-2.5 rounded-[20px] border border-line-soft bg-white p-5">
                    <div className="flex justify-between text-[15px]"><span className="text-brand-muted">ร้าน</span><span className="font-semibold">{order.restaurant?.name ?? "-"}</span></div>
                    <div className="flex justify-between text-[15px]"><span className="text-brand-muted">รายการ</span><span className="font-semibold">{count} จาน</span></div>
                    <div className="flex justify-between text-[15px]"><span className="text-brand-muted">ยอด</span><span className="font-semibold">{formatBaht(total)} บาท</span></div>
                    <div className="flex items-center justify-between border-t border-row-line pt-2.5 text-[15px]">
                        <span className="text-brand-muted">การชำระเงิน</span>
                        {refunded ? <Chip tone="neutral" icon="check">คืนเงินแล้ว</Chip> : paid ? <Chip tone="success" icon="check">จ่ายแล้ว</Chip> : <Chip tone="neutral" icon="clock">ยังไม่ได้จ่าย</Chip>}
                    </div>
                </section>

                {paid && !request && <Notice tone="primary" icon="info">คุณจ่ายเงินแล้ว ขอคืนเงินได้เลย โรงเรียนจะตรวจสอบและประสานกับร้านให้</Notice>}
                <RefundEntry orderId={order.orderId} canRequest={false} />
            </main>

            <footer className="flex flex-col gap-2.5 px-4 pb-6 pt-4">
                {paid && (!request || request.status === "REJECTED") && <ActionButton full onClick={() => router.push(`/user/order/refund/${order.orderId}`)}>{`ขอคืนเงิน ${formatBaht(total)} บาท`}</ActionButton>}
                {(refunded || (request && request.status !== "REJECTED")) && <ActionButton full onClick={() => router.push(`/user/order/refund/${order.orderId}`)}>ดูสถานะการคืนเงิน</ActionButton>}
                <ActionButton full variant="outline" onClick={() => router.push("/user/restaurant")}>สั่งร้านอื่น</ActionButton>
            </footer>
        </div>
    );
}
