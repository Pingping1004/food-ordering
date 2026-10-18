"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { StudentShell } from "@/components/users/StudentShell";
import { Card, Chip, EmptyState, ErrorState, OrderListSkeleton, Segmented } from "@/components/ui/kit";
import { isActiveOrder, listMyOrders, type MyOrderRow } from "@/lib/services/student";
import { RefundStatusChip } from "@/components/refunds/RefundParts";
import { requestFor } from "@/components/refunds/RefundEntry";
import { useMyRefunds } from "@/hook/useRefunds";
import { ORDER_STATUS, PAYMENT_STATUS, formatBaht } from "@/lib/schema/format";

const fmtWhen = (iso: string) => {
    const d = new Date(iso);
    const today = new Date();
    const yesterday = new Date(today.getTime() - 86400000);
    const time = d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", hour12: false });
    if (d.toDateString() === today.toDateString()) return `วันนี้ ${time}`;
    if (d.toDateString() === yesterday.toDateString()) return `เมื่อวาน ${time}`;
    return `${d.toLocaleDateString("th-TH", { day: "numeric", month: "short" })} ${time}`;
};

/** Where "ดูรายละเอียด" goes for a finished order. */
const detailHref = (o: MyOrderRow, hasRefund: boolean) =>
    hasRefund || o.paymentStatus === "REFUNDED" ? `/user/order/refund/${o.orderId}` : o.status === "rejected" ? `/user/order/failed/${o.orderId}` : `/user/order/done/${o.orderId}`;

export default function MyOrdersPage() {
    const [tab, setTab] = useState<"active" | "past">("active");
    const { data = [], isLoading, isError, refetch } = useQuery({ queryKey: ["my-orders"], queryFn: listMyOrders, refetchInterval: 30_000 });

    const refunds = useMyRefunds();
    const openRefunds = (refunds.data ?? []).filter((r) => r.status === "PENDING" || r.status === "APPROVED").length;
    const active = useMemo(() => data.filter(isActiveOrder), [data]);
    const past = useMemo(() => data.filter((o) => !isActiveOrder(o)), [data]);
    const list = tab === "active" ? active : past;

    return (
        <StudentShell active="orders">
            <header className="flex flex-col gap-3.5 border-b border-line-soft bg-white px-5 pb-4 pt-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <h1 className="text-[26px] font-bold">ออเดอร์ของฉัน</h1>
                    {(refunds.data?.length ?? 0) > 0 && (
                        <Link href="/user/refunds" className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border-[1.5px] border-line bg-white px-3.5 text-sm font-semibold hover:bg-ground">
                            คำขอคืนเงินของฉัน{openRefunds > 0 && <span className="rounded-full bg-brand-orange px-2 py-0.5 text-xs font-bold text-white" aria-label={`${openRefunds} รายการกำลังดำเนินการ`}>{openRefunds}</span>}
                        </Link>
                    )}
                </div>
                <Segmented
                    label="ประเภทออเดอร์"
                    value={tab}
                    onChange={setTab}
                    options={[{ value: "active", label: `กำลังดำเนินการ (${active.length})` }, { value: "past", label: "ที่ผ่านมา" }]}
                />
            </header>

            <main className="flex flex-col gap-3 p-4">
                {isLoading && <OrderListSkeleton count={4} />}
                {isError && <ErrorState onRetry={() => refetch()} />}
                {!isLoading && !isError && list.length === 0 && (
                    <EmptyState
                        title={tab === "active" ? "ยังไม่มีออเดอร์ที่กำลังทำ" : "ยังไม่มีออเดอร์ที่ผ่านมา"}
                        body="เลือกร้านและสั่งอาหารล่วงหน้า แล้วมารับได้เลย"
                        action={<Link href="/user/restaurant" className="inline-flex h-12 items-center rounded-xl bg-primary-main px-5 font-bold text-white">เลือกร้าน</Link>}
                    />
                )}

                {tab === "active" && active.map((o) => {
                    const s = ORDER_STATUS[o.status];
                    return (
                        <Link key={o.orderId} href={`/user/order/wait/${o.orderId}`} className="flex flex-col gap-2.5 rounded-[18px] border-[1.5px] border-primary-main bg-white p-4">
                            <span className="flex items-center justify-between gap-2">
                                <span className="text-lg font-bold">{o.code} · {o.restaurantName}</span>
                                <Chip tone={s.tone} icon={o.status === "ready" ? "check" : "clock"}>{s.label}</Chip>
                            </span>
                            <span className="text-sm text-brand-muted">{o.itemCount} จาน · {formatBaht(o.totalAmount)} บาท · รับประมาณ {new Date(o.pickupAt).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", hour12: false })}</span>
                        </Link>
                    );
                })}

                {tab === "past" && (
                    <ul className="flex flex-col gap-2.5">
                        {past.map((o) => {
                            const status = o.paymentStatus === "REFUNDED" ? PAYMENT_STATUS.REFUNDED : ORDER_STATUS[o.status];
                            const refund = requestFor(refunds.data, o.orderId);
                            return (
                                <Card as="li" key={o.orderId} className="flex flex-col gap-2.5 p-4">
                                    <span className="flex items-center justify-between gap-2">
                                        <span className="flex min-w-0 flex-col gap-0.5">
                                            <span className="truncate text-base font-bold">{o.restaurantName}</span>
                                            <span className="text-[13px] text-brand-muted">{fmtWhen(o.orderAt)} · {o.code}</span>
                                        </span>
                                        <Chip tone={status.tone}>{status.label}</Chip>
                                    </span>
                                    <span className="text-sm text-slate">{o.itemsLabel}</span>
                                    {refund && (
                                        <span className="flex flex-col gap-1.5 rounded-xl bg-ground p-2.5 text-sm">
                                            <span className="flex flex-wrap items-center gap-2"><span className="font-semibold">คำขอคืนเงิน</span><RefundStatusChip status={refund.status} short /></span>
                                            {refund.decisionNote && <span className="leading-relaxed">โรงเรียน: {refund.decisionNote}</span>}
                                        </span>
                                    )}
                                    <span className="flex items-center justify-between">
                                        <span className="text-[15px] font-bold">{formatBaht(o.totalAmount)} บาท</span>
                                        <Link
                                            href={o.status === "done" && !refund ? `/user/restaurant` : detailHref(o, !!refund)}
                                            className="flex h-11 items-center rounded-[10px] border-[1.5px] border-line px-3.5 text-sm font-semibold hover:bg-ground"
                                        >
                                            {o.status === "done" && !refund ? "สั่งอีกครั้ง" : "ดูรายละเอียด"}
                                        </Link>
                                    </span>
                                </Card>
                            );
                        })}
                    </ul>
                )}
            </main>
        </StudentShell>
    );
}
