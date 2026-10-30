"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { getParamId } from "@/util/param";
import { ActionButton, Chip, ErrorState, Field, Notice, OrderTrackingSkeleton, SelectInput } from "@/components/ui/kit";
import { Dialog } from "@/components/ui/Dialog";
import { StepHeader } from "@/components/users/Stepper";
import { REFUND_ERROR_TEXT, RefundItems, RefundStatusChip, RefundTimeline, refundSteps } from "@/components/refunds/RefundParts";
import { requestFor } from "@/components/refunds/RefundEntry";
import { useCreateRefund, useMyRefunds } from "@/hook/useRefunds";
import { getOrderForRefund } from "@/lib/services/refunds";
import { normalizePayment } from "@/lib/order-flow";
import { REFUND_REASONS, formatBaht, orderCode, refundReasonLabel } from "@/lib/schema/format";
import { toastSuccess } from "@/components/ui/Toast";
import type { RefundRequest } from "@/lib/schema";

const MAX_DETAILS = 1000;
const errorCode = (e: unknown) => (e as { response?: { data?: { code?: string; message?: string | string[] } } })?.response?.data?.code;
const errorMessage = (e: unknown) => {
    const m = (e as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
    return Array.isArray(m) ? m.join(", ") : m;
};

const Frame = ({ title, children, footer }: Readonly<{ title: string; children: React.ReactNode; footer?: React.ReactNode }>) => (
    <div className="mx-auto flex min-h-app w-full max-w-[640px] flex-col bg-ground font-app text-brand-dark md:max-w-[720px]">
        <StepHeader title={title} backHref="/user/orders" backLabel="กลับไปออเดอร์ของฉัน" />
        <main className="flex flex-1 flex-col gap-4 px-4 py-6">{children}</main>
        {footer && <footer className="flex flex-col gap-2.5 px-4 pb-6">{footer}</footer>}
    </div>
);

/** The request exists: where it stands, what the school said, and (if rejected) a way to ask again. */
function RequestStatus({ req, onRefile }: Readonly<{ req: RefundRequest; onRefile: () => void }>) {
    const router = useRouter();
    const label = { PENDING: "ส่งคำขอคืนเงินแล้ว", APPROVED: "ร้านอนุมัติแล้ว", REFUNDED: "โอนคืนเงินแล้ว", REJECTED: "คำขอไม่ได้รับอนุมัติ" }[req.status];
    const sub = {
        PENDING: "ร้านจะตรวจสอบ แล้วแจ้งผลให้คุณทราบ",
        APPROVED: "ร้านกำลังโอนคืนเงินให้คุณ",
        REFUNDED: "ตรวจสอบยอดในบัญชีที่คุณใช้จ่าย",
        REJECTED: "ดูเหตุผลจากร้านด้านล่าง หากข้อมูลเปลี่ยนไป ส่งคำขอใหม่ได้",
    }[req.status];

    return (
        <Frame
            title={`คืนเงิน · ${orderCode(req.orderId)}`}
            footer={
                <>
                    {req.status === "REJECTED" && <ActionButton full onClick={onRefile}>ส่งคำขอใหม่</ActionButton>}
                    <ActionButton full variant="outline" onClick={() => router.push("/user/orders")}>กลับไปออเดอร์ของฉัน</ActionButton>
                </>
            }
        >
            <section className="flex flex-col items-center gap-3 px-3 text-center" aria-live="polite">
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-light text-primary-dark">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></svg>
                </span>
                <h2 className="text-[26px] font-bold">{label}</h2>
                <p className="text-base leading-relaxed text-brand-muted">{sub}</p>
                <RefundStatusChip status={req.status} />
            </section>

            {req.decisionNote && (
                <section className="flex flex-col gap-1.5 rounded-[20px] border border-line-soft bg-white p-5" aria-label="ข้อความจากร้าน">
                    <h3 className="text-base font-bold">ข้อความจากร้าน</h3>
                    <p className="m-0 whitespace-pre-line text-[15px] leading-relaxed">{req.decisionNote}</p>
                </section>
            )}

            <section className="rounded-[20px] border border-line-soft bg-white p-5" aria-label="ความคืบหน้า"><RefundTimeline steps={refundSteps(req, true)} /></section>

            <section className="flex flex-col gap-2.5 rounded-[20px] border border-line-soft bg-white p-5 text-[15px]">
                <div className="flex justify-between gap-3"><span className="text-brand-muted">ร้าน</span><span className="font-semibold">{req.restaurant?.name ?? "-"}</span></div>
                <div className="flex justify-between gap-3"><span className="text-brand-muted">ยอดที่ขอคืน</span><span className="font-semibold">{formatBaht(req.amount)} บาท</span></div>
                <div className="flex justify-between gap-3"><span className="text-brand-muted">เหตุผล</span><span className="text-right font-semibold">{refundReasonLabel(req.reason)}</span></div>
                {req.details && <p className="m-0 rounded-xl bg-ground p-3 leading-relaxed">“{req.details}”</p>}
            </section>
        </Frame>
    );
}

export default function RefundRequestPage() {
    const params = useParams();
    const router = useRouter();
    const orderId = getParamId(params.orderId);

    const order = useQuery({ queryKey: ["order-for-refund", orderId], queryFn: () => getOrderForRefund(orderId as string), enabled: !!orderId });
    const mine = useMyRefunds();
    const create = useCreateRefund(orderId ?? "");

    const [reason, setReason] = useState("");
    const [details, setDetails] = useState("");
    const [confirming, setConfirming] = useState(false);
    const [error, setError] = useState<string>();
    const [refiling, setRefiling] = useState(false);

    if (order.isLoading || mine.isLoading) return <OrderTrackingSkeleton title="กำลังโหลด..." />;
    if (order.isError || mine.isError) {
        const gone = (order.error as { response?: { status?: number } } | null)?.response?.status === 404;
        return (
            <div className="mx-auto flex min-h-app w-full max-w-[640px] flex-col justify-center bg-ground font-app">
                {gone ? <div className="p-6 text-center text-base">ไม่พบออเดอร์ของคุณ</div> : <ErrorState onRetry={() => { void order.refetch(); void mine.refetch(); }} />}
            </div>
        );
    }
    const o = order.data;
    if (!o) return <div className="p-6 font-app">ไม่พบออเดอร์ของคุณ</div>;

    const existing = requestFor(mine.data, o.orderId);
    if (existing && !(existing.status === "REJECTED" && refiling)) return <RequestStatus req={existing} onRefile={() => { setRefiling(true); setReason(""); setDetails(""); setError(undefined); }} />;

    const pay = normalizePayment(o.paymentStatus);
    const items = o.orderMenus.map((m) => ({ menuName: m.menuName, quantity: m.quantity, unitPrice: m.unitPrice, totalPrice: m.totalPrice ?? m.unitPrice * m.quantity }));
    const total = o.totalAmount ?? items.reduce((n, i) => n + i.totalPrice, 0);
    const eligible = pay === "PAID";
    const valid = !!reason && details.length <= MAX_DETAILS && (reason !== "OTHER" || details.trim().length >= 3);

    const submit = () => {
        setError(undefined);
        create.mutate(
            { reason, details },
            {
                onSuccess: () => { setConfirming(false); toastSuccess("ส่งคำขอคืนเงินแล้ว"); },
                onError: (e) => {
                    setConfirming(false);
                    const code = errorCode(e);
                    if (code === "REFUND_ALREADY_REQUESTED") { void mine.refetch(); return; }
                    setError((code && REFUND_ERROR_TEXT[code]) ?? errorMessage(e) ?? "ส่งคำขอไม่สำเร็จ กรุณาลองใหม่");
                },
            },
        );
    };

    return (
        <Frame
            title={`ขอคืนเงิน · ${orderCode(o.orderId)}`}
            footer={eligible ? <ActionButton full disabled={!valid || create.isPending} onClick={() => setConfirming(true)}>ตรวจสอบและส่งคำขอ</ActionButton> : <ActionButton full variant="outline" onClick={() => router.push("/user/orders")}>กลับไปออเดอร์ของฉัน</ActionButton>}
        >
            <section aria-label="ออเดอร์" className="flex flex-col gap-3 rounded-[20px] border border-line-soft bg-white p-5">
                <div className="flex items-center justify-between gap-2">
                    <h2 className="text-[17px] font-bold">{o.restaurant?.name ?? "ออเดอร์ของคุณ"}</h2>
                    {pay === "PAID" ? <Chip tone="success" icon="check">จ่ายแล้ว</Chip> : <Chip tone="neutral" icon="clock">{pay === "REFUNDED" ? "คืนเงินแล้ว" : "ยังไม่ได้จ่าย"}</Chip>}
                </div>
                <RefundItems items={items} total={total} />
            </section>

            {!eligible ? (
                <Notice tone="orange" icon="alert" role="alert">{pay === "REFUNDED" ? "ออเดอร์นี้ได้รับเงินคืนแล้ว" : REFUND_ERROR_TEXT.ORDER_NOT_PAID}</Notice>
            ) : (
                <>
                    {existing?.status === "REJECTED" && <Notice tone="orange" icon="info">คำขอก่อนหน้าไม่ได้รับอนุมัติ{existing.decisionNote ? ` · ${existing.decisionNote}` : ""} คุณส่งคำขอใหม่ได้</Notice>}
                    <section className="flex flex-col gap-4 rounded-[20px] border border-line-soft bg-white p-5">
                        <Field label="เหตุผลที่ขอคืนเงิน" size="lg">
                            <SelectInput size="lg" value={reason} onChange={(e) => setReason(e.target.value)} aria-required>
                                <option value="" disabled>เลือกเหตุผล</option>
                                {REFUND_REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                            </SelectInput>
                        </Field>
                        <label className="flex flex-col gap-2 text-[15px] font-semibold">
                            รายละเอียดเพิ่มเติม {reason === "OTHER" ? "(จำเป็น)" : "(ไม่บังคับ)"}
                            <textarea
                                rows={4}
                                maxLength={MAX_DETAILS}
                                value={details}
                                onChange={(e) => setDetails(e.target.value)}
                                placeholder="เล่าให้ร้านเข้าใจว่าเกิดอะไรขึ้น"
                                className="w-full rounded-[14px] border-[1.5px] border-line px-4 py-3 font-app text-[16px] font-normal outline-none focus:border-primary-main focus:ring-2 focus:ring-primary-main/20"
                            />
                            <span className="text-right text-[13px] font-normal text-brand-muted">{details.length}/{MAX_DETAILS}</span>
                        </label>
                        <p className="m-0 text-[13px] leading-relaxed text-brand-muted">ร้านเป็นผู้พิจารณาและโอนคืนเอง โรงเรียนเห็นทุกรายการ ขอคืนเงินได้ภายใน 24 ชั่วโมงหลังรับอาหาร</p>
                    </section>
                    {error && <Notice tone="danger" icon="alert" role="alert">{error}</Notice>}
                </>
            )}

            <Dialog open={confirming} onClose={() => (create.isPending ? undefined : setConfirming(false))} title="ยืนยันส่งคำขอคืนเงิน">
                <div className="flex flex-col gap-4">
                    <dl className="m-0 flex flex-col gap-2 text-[15px]">
                        <div className="flex justify-between gap-3"><dt className="text-brand-muted">ออเดอร์</dt><dd className="m-0 font-semibold">{orderCode(o.orderId)} · {o.restaurant?.name ?? "-"}</dd></div>
                        <div className="flex justify-between gap-3"><dt className="text-brand-muted">ยอดที่ขอคืน</dt><dd className="m-0 font-semibold">{formatBaht(total)} บาท</dd></div>
                        <div className="flex justify-between gap-3"><dt className="text-brand-muted">เหตุผล</dt><dd className="m-0 text-right font-semibold">{refundReasonLabel(reason)}</dd></div>
                    </dl>
                    {details.trim() && <p className="m-0 rounded-xl bg-ground p-3 text-[15px] leading-relaxed">“{details.trim()}”</p>}
                    <div className="flex flex-wrap justify-end gap-2.5">
                        <ActionButton variant="outline" size="md" onClick={() => setConfirming(false)} disabled={create.isPending}>กลับไปแก้ไข</ActionButton>
                        <ActionButton size="md" onClick={submit} disabled={create.isPending}>{create.isPending ? "กำลังส่ง..." : "ยืนยันส่งคำขอ"}</ActionButton>
                    </div>
                </div>
            </Dialog>

            <Link href="/user/refunds" className="self-center py-2 text-[15px] font-semibold text-primary-dark">ดูคำขอคืนเงินของฉัน</Link>
        </Frame>
    );
}
