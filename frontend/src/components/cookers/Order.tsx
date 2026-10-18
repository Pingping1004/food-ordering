import React, { useCallback, useMemo } from "react";
import clsx from "clsx";
import { getTimeFormat } from "@/util/time";
import { OrderStatus, PaymentStatus } from "./OrderNavbar";
import { formatBaht, orderCode } from "@/lib/schema/format";

export type OrderMenuEntry = {
    quantity: number;
    menuName: string;
    menuImg?: string;
};

export type OrderProps = React.HTMLAttributes<HTMLDivElement> & {
    orderId: string;
    orderAt: string;
    orderCreatedAt: string;
    /** Order.pickupAt (schema) */
    pickupAt: string;
    status: OrderStatus;
    selected?: boolean;
    totalAmount: number;
    paymentStatus: PaymentStatus;
    isDelay?: boolean;
    orderMenus: OrderMenuEntry[];
    details?: string;
    /** Not part of the new schema – only rendered when the API still returns it. */
    userTel?: string;
    acceptAt?: Date;
    completedAt?: Date;
    cancelledAt?: Date;
    refundAt?: Date;
    isLargeTextMode?: boolean;
    isDelayDisabled?: boolean;
    isRejectedDisabled?: boolean;
    onDelayUpdate: (orderId: string) => void;
    onStatusUpdate: (orderId: string, status: OrderStatus) => void;
};

export const Order = ({
    orderId,
    selected = false,
    orderAt,
    orderCreatedAt,
    userTel,
    status,
    pickupAt,
    totalAmount,
    paymentStatus,
    isDelay = false,
    acceptAt,
    orderMenus = [],
    details,
    className,
    isLargeTextMode = false,
    isDelayDisabled = false,
    isRejectedDisabled = false,
    onDelayUpdate,
    onStatusUpdate,
    ...props
}: OrderProps) => {
    const lg = isLargeTextMode;

    // Stable references so child Buttons don't re-render unnecessarily
    const handleAccept = useCallback(
        () => onStatusUpdate(orderId, OrderStatus.accepted),
        [orderId, onStatusUpdate]
    );
    const handleReady = useCallback(
        () => onStatusUpdate(orderId, OrderStatus.ready),
        [orderId, onStatusUpdate]
    );
    const handleDone = useCallback(
        () => onStatusUpdate(orderId, OrderStatus.done),
        [orderId, onStatusUpdate]
    );
    const handleReject = useCallback(
        () => onStatusUpdate(orderId, OrderStatus.rejected),
        [orderId, onStatusUpdate]
    );
    const handleDelay = useCallback(
        () => onDelayUpdate(orderId),
        [orderId, onDelayUpdate]
    );

    const isDeliveryPast = useMemo(
        () => new Date(pickupAt).getTime() <= Date.now(),
        [pickupAt]
    );

    const formattedAmount = `${formatBaht(totalAmount)} บาท`;

    const acceptButtonDisabled = useMemo(() => {
        const nowMs = Date.now();
        const parsedOrderAtMs = new Date(orderCreatedAt).getTime();
        const elapsedMs = nowMs - parsedOrderAtMs;
        const thresholdMs = 3 * 60 * 1000;
        const disabled = elapsedMs > thresholdMs;
        return { disabled, nowMs, parsedOrderAtMs, elapsedMs, thresholdMs, orderAtRaw: orderAt, orderCreatedAtRaw: orderCreatedAt };
    }, [orderAt, orderCreatedAt]);

    const isNew = status === OrderStatus.sent || status === OrderStatus.receive;
    const isCooking = status === OrderStatus.accepted || status === OrderStatus.cooking || status === OrderStatus.delay;
    const isReady = status === OrderStatus.ready;
    const isDone = status === OrderStatus.completed || status === OrderStatus.done;
    const isRejected = status === OrderStatus.rejected || status === OrderStatus.cancelled;
    const isPaid = paymentStatus === PaymentStatus.paid || (paymentStatus as string) === "PAID";
    // Accepted, the student has not paid yet: nothing to do but wait (cooking starts by itself once the slip is verified).
    const awaitingPayment = isNew && !!acceptAt && !isPaid;

    const body = lg ? "text-[21px]" : "text-lg";
    const btnH = lg ? "h-[68px]" : "h-[60px]";
    const btnText = lg ? "text-[23px]" : "text-xl";

    return (
        <article
            className={clsx(
                "flex flex-col gap-4 rounded-[20px] bg-white p-5 font-app text-brand-dark",
                isNew ? "border-2 border-brand-orange" : "border border-line-soft",
                selected && "ring-2 ring-primary-main",
                className
            )}
            {...props}
        >
            <header className="flex items-start justify-between gap-3">
                <div className="flex flex-col gap-1.5">
                    <h3 className={clsx("font-bold uppercase leading-none", lg ? "text-[40px]" : "text-[32px]")}>
                        {orderCode(orderId)}
                    </h3>
                    {isNew && (
                        <span className="inline-flex items-center gap-1.5 self-start rounded-full bg-brand-orange-light px-3 py-1 text-[15px] font-bold text-brand-orange-text">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /></svg>
                            {awaitingPayment ? "รอชำระเงิน" : "ใหม่"}
                        </span>
                    )}
                    {isReady && (
                        <span className="inline-flex items-center gap-1.5 self-start rounded-full bg-success-light px-3 py-1 text-[15px] font-bold text-success-main">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
                            พร้อมรับ
                        </span>
                    )}
                    <span className="text-[15px] text-brand-muted">สั่งเมื่อ {orderAt}</span>
                </div>
                <div className="flex flex-col items-end gap-0.5">
                    <span className="text-[15px] text-brand-muted">มารับเวลา</span>
                    <span className={clsx("font-bold leading-tight", lg ? "text-[32px]" : "text-[26px]", isDeliveryPast ? "text-brand-orange-text" : "text-primary-dark")}>
                        {getTimeFormat(pickupAt)}
                    </span>
                </div>
            </header>

            <ul className="flex flex-col gap-2.5 border-t border-[#EEF1F6] pt-3.5">
                {orderMenus.map((item, index) => (
                    <li key={`${item.menuName}-${index}`} className={clsx("flex gap-3 leading-snug", body)}>
                        <span className="min-w-10 font-bold">{item.quantity} ×</span>
                        <span>{item.menuName}</span>
                    </li>
                ))}
            </ul>

            {details && (
                <div className={clsx("flex gap-2.5 rounded-xl bg-[#FFF8E6] px-3.5 py-3 leading-snug", body)}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#8A5A00" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="mt-0.5 shrink-0"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>
                    <span><b>หมายเหตุ:</b> {details}</span>
                </div>
            )}

            <div className="flex items-center justify-between gap-3">
                <span className={clsx(
                    "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-base font-bold",
                    isPaid ? "bg-success-light text-success-main" : "bg-[#F2F4F7] text-[#475467]"
                )}>
                    {isPaid ? (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
                    ) : (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
                    )}
                    {isPaid ? "จ่ายแล้ว" : "ยังไม่ชำระเงิน"}
                </span>
                <span className={clsx("font-bold", body)}>รวม {formattedAmount}</span>
            </div>

            {userTel && (
                <a href={`tel:${userTel}`} className="text-[15px] font-semibold text-primary-dark underline">
                    โทรหาลูกค้า {userTel}
                </a>
            )}

            {awaitingPayment && (
                <p className={clsx("rounded-2xl bg-brand-orange-light px-4 py-3 font-semibold leading-snug text-brand-orange-text", body)}>
                    รับออเดอร์แล้ว รอนักเรียนชำระเงิน (ภายใน 3 นาที) ยังไม่ต้องเริ่มทำ ระบบจะแจ้งเมื่อชำระเงินแล้ว
                </p>
            )}

            {isNew && !awaitingPayment && (
                <div className="flex gap-3">
                    <button
                        type="button"
                        disabled={isRejectedDisabled}
                        onClick={handleReject}
                        className={clsx("flex-1 rounded-2xl border-2 border-line bg-white font-semibold disabled:pointer-events-none disabled:opacity-50", btnH, lg ? "text-xl" : "text-lg")}
                    >
                        ปฏิเสธ
                    </button>
                    <button
                        type="button"
                        disabled={acceptButtonDisabled.disabled}
                        onClick={handleAccept}
                        className={clsx("flex flex-[2] items-center justify-center gap-2.5 rounded-2xl bg-primary-main font-bold text-white hover:bg-primary-dark disabled:pointer-events-none disabled:opacity-50", btnH, btnText)}
                    >
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
                        รับออเดอร์
                    </button>
                </div>
            )}

            {isCooking && (
                <button
                    type="button"
                    onClick={handleReady}
                    className={clsx("flex items-center justify-center gap-2.5 rounded-2xl bg-success-main font-bold text-white", btnH, btnText)}
                >
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
                    ทำเสร็จแล้ว
                </button>
            )}

            {isCooking && (
                <button
                    type="button"
                    disabled={isDelay || isDelayDisabled || isDeliveryPast}
                    onClick={handleDelay}
                    className={clsx("h-[52px] rounded-[14px] border-[1.5px] border-line bg-white text-lg font-semibold disabled:pointer-events-none disabled:opacity-50")}
                >
                    {isDelay ? "แจ้งล่าช้าสำเร็จ" : "แจ้งลูกค้าว่าช้า 10 นาที"}
                </button>
            )}

            {isReady && (
                <button
                    type="button"
                    onClick={handleDone}
                    className={clsx("rounded-2xl bg-primary-main font-bold text-white hover:bg-primary-dark", btnH, btnText)}
                >
                    นักเรียนรับแล้ว
                </button>
            )}

            {isRejected && (
                <span className={clsx("flex items-center justify-center gap-2 rounded-2xl bg-danger-light font-bold text-danger-text", btnH, btnText)}>
                    ออเดอร์ถูกยกเลิก
                </span>
            )}

            {isDone && (
                <span className={clsx("flex items-center justify-center gap-2 rounded-2xl bg-success-light font-bold text-success-main", btnH, btnText)}>
                    ออเดอร์เสร็จสิ้น
                </span>
            )}
        </article>
    );
};

export default Order;
