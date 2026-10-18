"use client";

import { use, useState } from "react";
import clsx from "clsx";
import { CookerShell } from "@/components/cookers/CookerShell";
import { ActionButton, Card, CardListSkeleton, EmptyState, ErrorState, Notice } from "@/components/ui/kit";
import { RefundStatusChip } from "@/components/refunds/RefundParts";
import { useShopRefunds } from "@/hook/useRefunds";
import { formatBaht, formatDateTime, orderCode, refundReasonLabel } from "@/lib/schema/format";
import type { RefundRequestStatus } from "@/lib/schema";

type Tab = RefundRequestStatus | "ALL";
const TABS: { value: Tab; label: string }[] = [
    { value: "ALL", label: "ทั้งหมด" },
    { value: "PENDING", label: "รอโรงเรียน" },
    { value: "APPROVED", label: "รอโอนคืน" },
    { value: "REFUNDED", label: "โอนคืนแล้ว" },
    { value: "REJECTED", label: "ไม่อนุมัติ" },
];

/** Read-only: the school decides refunds; the shop only sees which of its orders have a request and where it stands. */
export default function CookerRefundsPage({ params }: Readonly<{ params: Promise<{ restaurantId: string }> }>) {
    const { restaurantId } = use(params);
    const [tab, setTab] = useState<Tab>("ALL");
    const list = useShopRefunds(restaurantId, tab === "ALL" ? undefined : tab);

    return (
        <CookerShell restaurantId={restaurantId} active="refunds">
            <header className="flex flex-col gap-3 border-b border-line-soft bg-white p-5">
                <div className="flex flex-col gap-1">
                    <span className="text-base text-brand-muted">ดูอย่างเดียว</span>
                    <h1 className="text-[28px] font-bold">คำขอคืนเงิน</h1>
                </div>
                <div role="tablist" aria-label="สถานะคำขอ" className="flex max-w-full gap-1.5 overflow-x-auto rounded-xl bg-neutral-light p-1">
                    {TABS.map((t) => (
                        <button key={t.value} type="button" role="tab" aria-selected={t.value === tab} onClick={() => setTab(t.value)}
                            className={clsx("h-11 shrink-0 rounded-[9px] px-4 font-app text-base", t.value === tab ? "bg-white font-bold shadow-sm" : "font-semibold text-neutral-text")}>
                            {t.label}
                        </button>
                    ))}
                </div>
            </header>

            <main className="flex flex-col gap-4 p-5">
                <Notice tone="primary" icon="info">
                    <span className="text-[15px]">นักเรียนส่งคำขอถึงโรงเรียน <b>โรงเรียนเป็นผู้อนุมัติ</b> หากอนุมัติ โรงเรียนจะติดต่อร้านเพื่อคืนเงิน ร้านไม่ต้องกดอะไรในหน้านี้</span>
                </Notice>

                {list.isLoading && <CardListSkeleton count={3} />}
                {list.isError && <ErrorState onRetry={() => list.refetch()} />}
                {!list.isLoading && !list.isError && list.items.length === 0 && <Card><EmptyState title="ไม่มีคำขอคืนเงิน" body="เมื่อนักเรียนขอคืนเงินออเดอร์ของร้านคุณ จะแสดงที่นี่" /></Card>}

                <ul className="m-0 grid list-none gap-3 p-0 [grid-template-columns:repeat(auto-fill,minmax(min(100%,320px),1fr))]">
                    {list.items.map((r) => (
                        <Card as="li" key={r.id} className="flex flex-col gap-2 !rounded-[20px] p-[18px]">
                            <span className="flex items-center justify-between gap-2">
                                <span className="text-xl font-bold">{r.orderCode ?? orderCode(r.orderId)}</span>
                                <RefundStatusChip status={r.status} short />
                            </span>
                            <span className="text-[17px] font-semibold tabular-nums">{formatBaht(r.amount)} บาท</span>
                            <span className="text-[15px] text-slate">{refundReasonLabel(r.reason)}</span>
                            {r.details && <p className="m-0 rounded-xl bg-ground p-3 text-[15px] leading-relaxed">“{r.details}”</p>}
                            {r.decisionNote && <p className="m-0 text-sm text-brand-muted">โรงเรียน: {r.decisionNote}</p>}
                            <span className="text-[13px] text-brand-muted">ส่งเมื่อ {formatDateTime(r.createdAt)}</span>
                        </Card>
                    ))}
                </ul>

                {list.hasNextPage && <div className="flex justify-center"><ActionButton variant="outline" size="md" onClick={() => list.fetchNextPage()} disabled={list.isFetchingNextPage}>{list.isFetchingNextPage ? "กำลังโหลด..." : "โหลดเพิ่ม"}</ActionButton></div>}
            </main>
        </CookerShell>
    );
}
