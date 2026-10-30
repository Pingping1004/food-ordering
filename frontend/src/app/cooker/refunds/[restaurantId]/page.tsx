"use client";

import { use, useCallback, useState } from "react";
import clsx from "clsx";
import { CookerShell } from "@/components/cookers/CookerShell";
import { ActionButton, Card, CardListSkeleton, EmptyState, ErrorState, Icon, Notice } from "@/components/ui/kit";
import { RefundItems, RefundStatusChip } from "@/components/refunds/RefundParts";
import { RefundDecisionDialog } from "@/components/refunds/RefundDecisionDialog";
import { useAuth } from "@/auth/auth.hooks";
import { isSystemAdmin, restaurantRole } from "@/auth/access";
import { useDecideRefund, useShopRefunds } from "@/hook/useRefunds";
import { formatBaht, formatDateTime, orderCode, refundReasonLabel } from "@/lib/schema/format";
import type { RefundDecisionAction, RefundRequest, RefundRequestStatus } from "@/lib/schema";

type Tab = RefundRequestStatus | "ALL";
const TABS: { value: Tab; label: string }[] = [
    { value: "PENDING", label: "รอร้านตัดสินใจ" },
    { value: "APPROVED", label: "รอโอนคืน" },
    { value: "REFUNDED", label: "โอนคืนแล้ว" },
    { value: "REJECTED", label: "ไม่อนุมัติ" },
    { value: "ALL", label: "ทั้งหมด" },
];

/** The shop decides refunds (OWNER / ADMIN); staff see the list read-only. The school sees every request. */
export default function CookerRefundsPage({ params }: Readonly<{ params: Promise<{ restaurantId: string }> }>) {
    const { restaurantId } = use(params);
    const { user } = useAuth();
    const role = restaurantRole(user, restaurantId);
    const canDecide = role === "OWNER" || role === "ADMIN" || isSystemAdmin(user);
    const [tab, setTab] = useState<Tab>("PENDING");
    const list = useShopRefunds(restaurantId, tab === "ALL" ? undefined : tab);
    const decide = useDecideRefund(restaurantId);
    const [target, setTarget] = useState<{ r: RefundRequest; action: RefundDecisionAction } | null>(null);
    const cancel = useCallback(() => setTarget(null), []);

    const confirm = (note: string) => {
        if (!target) return;
        decide.mutate({ id: target.r.id, action: target.action, note: note || undefined }, { onSuccess: () => setTarget(null) });
    };

    return (
        <CookerShell restaurantId={restaurantId} active="refunds">
            <header className="flex flex-col gap-3 border-b border-line-soft bg-white p-5">
                <div className="flex flex-col gap-1">
                    {!canDecide && <span className="text-base text-brand-muted">ดูอย่างเดียว</span>}
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
                    <span className="text-[15px]">นักเรียนส่งคำขอคืนเงินถึงร้าน ร้านเป็นผู้พิจารณาและโอนคืนเอง โรงเรียนเห็นทุกรายการ</span>
                </Notice>

                {list.isLoading && <CardListSkeleton count={3} />}
                {list.isError && <ErrorState onRetry={() => list.refetch()} />}
                {!list.isLoading && !list.isError && list.items.length === 0 && (
                    <Card><EmptyState title={tab === "PENDING" ? "ไม่มีคำขอรอร้านตัดสินใจ" : "ไม่มีคำขอคืนเงิน"} body="เมื่อนักเรียนขอคืนเงินออเดอร์ของร้านคุณ จะแสดงที่นี่และแจ้งเตือนเจ้าของร้าน" /></Card>
                )}

                <ul className="m-0 grid list-none gap-3 p-0 [grid-template-columns:repeat(auto-fill,minmax(min(100%,320px),1fr))]">
                    {list.items.map((r) => (
                        <Card as="li" key={r.id} className="flex flex-col gap-2 !rounded-[20px] p-[18px]">
                            <span className="flex items-center justify-between gap-2">
                                <span className="text-xl font-bold">{r.orderCode ?? orderCode(r.orderId)}</span>
                                <RefundStatusChip status={r.status} short />
                            </span>
                            <span className="text-[17px] font-semibold tabular-nums">{formatBaht(r.amount)} บาท</span>
                            <span className="text-[15px] text-slate">{refundReasonLabel(r.reason)}{r.student?.name && <> · {r.student.name}</>}</span>
                            {r.details && <p className="m-0 rounded-xl bg-ground p-3 text-[15px] leading-relaxed">“{r.details}”</p>}
                            {r.order?.items && r.order.items.length > 0 && (
                                <section aria-label={`รายการอาหารของออเดอร์ ${r.orderCode ?? orderCode(r.orderId)}`} className="flex flex-col gap-1.5">
                                    <span className="text-[13px] text-brand-muted">
                                        สั่งเมื่อ {formatDateTime(r.order.orderAt)}{r.order.pickupAt && <> · นัดรับ {formatDateTime(r.order.pickupAt)}</>}
                                    </span>
                                    <RefundItems items={r.order.items} total={r.order.totalAmount} />
                                </section>
                            )}
                            {r.decisionNote && <p className="m-0 text-sm text-brand-muted">ร้าน: {r.decisionNote}</p>}
                            <span className="text-[13px] text-brand-muted">
                                ส่งเมื่อ {formatDateTime(r.createdAt)}
                                {r.decidedAt && <> · ตัดสินใจ {formatDateTime(r.decidedAt)}</>}
                                {r.refundedAt && <> · โอนคืน {formatDateTime(r.refundedAt)}</>}
                            </span>
                            {canDecide && r.status === "PENDING" && (
                                <div className="mt-1 flex flex-wrap justify-end gap-2.5 border-t border-row-line pt-3">
                                    <ActionButton variant="dangerOutline" size="md" onClick={() => setTarget({ r, action: "reject" })}>ไม่อนุมัติ</ActionButton>
                                    <ActionButton size="md" onClick={() => setTarget({ r, action: "approve" })}>อนุมัติ</ActionButton>
                                </div>
                            )}
                            {canDecide && r.status === "APPROVED" && (
                                <div className="mt-1 flex flex-wrap justify-end gap-2.5 border-t border-row-line pt-3">
                                    <ActionButton size="md" onClick={() => setTarget({ r, action: "mark_refunded" })}><Icon name="refund" size={18} />โอนคืนแล้ว</ActionButton>
                                </div>
                            )}
                        </Card>
                    ))}
                </ul>

                {list.hasNextPage && <div className="flex justify-center"><ActionButton variant="outline" size="md" onClick={() => list.fetchNextPage()} disabled={list.isFetchingNextPage}>{list.isFetchingNextPage ? "กำลังโหลด..." : "โหลดเพิ่ม"}</ActionButton></div>}
            </main>

            <RefundDecisionDialog key={target ? `${target.r.id}-${target.action}` : "none"} action={target?.action ?? null} onCancel={cancel} onConfirm={confirm} pending={decide.isPending} />
        </CookerShell>
    );
}
