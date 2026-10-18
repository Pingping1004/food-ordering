"use client";

import { use, useCallback, useId, useMemo, useState } from "react";
import clsx from "clsx";
import { ActionButton, Card, EmptyState, ErrorState, Icon, Notice, SearchInput, Skeleton, TD, TH, TableSkeleton, TableWrap, CardListSkeleton } from "@/components/ui/kit";
import { Dialog } from "@/components/ui/Dialog";
import { SchoolPageHeader, SchoolShell } from "@/components/school/SchoolShell";
import { StatCard, StatGrid } from "@/components/admin/AdminUI";
import { RefundItems, RefundStatusChip, RefundTimeline, refundSteps } from "@/components/refunds/RefundParts";
import { useSchoolAccess } from "@/hook/useSchoolAccess";
import { useDecideRefund, useRefundDetail, useRefundSummary, useRefundedThisWeek, useSchoolRefunds } from "@/hook/useRefunds";
import { formatBaht, formatDateTime, orderCode, refundReasonLabel, waitLabel } from "@/lib/schema/format";
import type { RefundDecisionAction, RefundRequest, RefundRequestStatus } from "@/lib/schema";

type Tab = RefundRequestStatus | "ALL";
const TABS: { value: Tab; label: string }[] = [
    { value: "PENDING", label: "รอตัดสินใจ" },
    { value: "APPROVED", label: "รอโอนคืน" },
    { value: "REFUNDED", label: "โอนคืนแล้ว" },
    { value: "REJECTED", label: "ไม่อนุมัติ" },
    { value: "ALL", label: "ทั้งหมด" },
];

const DAY_MIN = 24 * 60;
/** Pending for over a day is highlighted – students are waiting on their money. */
const isLate = (r: Pick<RefundRequest, "status" | "createdAt">) => r.status === "PENDING" && Date.now() - new Date(r.createdAt).getTime() > DAY_MIN * 60000;
const codeOf = (r: RefundRequest) => r.orderCode ?? orderCode(r.orderId);

const ACTION_COPY: Record<RefundDecisionAction, { title: string; body: string; confirm: string; variant: "primary" | "danger"; noteLabel: string; noteRequired: boolean }> = {
    approve: { title: "อนุมัติคำขอคืนเงิน", body: "เมื่ออนุมัติ นักเรียนจะเห็นว่ากำลังรอโอนคืน จากนั้นประสานกับร้านเพื่อคืนเงิน แล้วกด “บันทึกว่าโอนคืนแล้ว”", confirm: "อนุมัติ", variant: "primary", noteLabel: "ข้อความถึงนักเรียน (ไม่บังคับ)", noteRequired: false },
    reject: { title: "ไม่อนุมัติคำขอคืนเงิน", body: "นักเรียนจะเห็นเหตุผลที่คุณเขียน และการตัดสินใจนี้เปลี่ยนไม่ได้ (นักเรียนส่งคำขอใหม่ได้)", confirm: "ไม่อนุมัติ", variant: "danger", noteLabel: "เหตุผลที่ไม่อนุมัติ (จำเป็น อย่างน้อย 3 ตัวอักษร)", noteRequired: true },
    mark_refunded: { title: "บันทึกว่าโอนคืนแล้ว", body: "กดเมื่อนักเรียนได้รับเงินคืนจริงแล้วเท่านั้น ระบบนี้บันทึกผลเฉพาะสถานะ ไม่ได้โอนเงินให้ และเปลี่ยนกลับไม่ได้", confirm: "ยืนยัน โอนคืนแล้ว", variant: "primary", noteLabel: "หมายเหตุ เช่น ช่องทางที่โอนคืน (ไม่บังคับ)", noteRequired: false },
};

function DecisionDialog({ action, onCancel, onConfirm, pending }: Readonly<{ action: RefundDecisionAction | null; onCancel: () => void; onConfirm: (note: string) => void; pending: boolean }>) {
    const [note, setNote] = useState("");
    const id = useId();
    const copy = action ? ACTION_COPY[action] : null;
    const valid = !copy?.noteRequired || note.trim().length >= 3;

    return (
        <Dialog open={!!action} onClose={onCancel} title={copy?.title ?? ""}>
            {copy && (
                <form
                    className="flex flex-col gap-4"
                    onSubmit={(e) => { e.preventDefault(); if (valid && !pending) onConfirm(note.trim()); }}
                >
                    <p className="text-[15px] leading-relaxed text-brand-muted">{copy.body}</p>
                    <label htmlFor={id} className="flex flex-col gap-1.5 text-sm font-semibold">
                        {copy.noteLabel}
                        <textarea
                            id={id}
                            rows={3}
                            maxLength={500}
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            aria-required={copy.noteRequired}
                            aria-invalid={copy.noteRequired && note.length > 0 && !valid}
                            className="rounded-[10px] border-[1.5px] border-line px-3 py-2.5 font-app text-[15px] font-normal outline-none focus:border-primary-main focus:ring-2 focus:ring-primary-main/20 aria-[invalid=true]:border-danger-main"
                        />
                    </label>
                    <div className="flex flex-wrap justify-end gap-2.5">
                        <ActionButton variant="outline" size="md" onClick={onCancel} disabled={pending}>ยกเลิก</ActionButton>
                        <ActionButton type="submit" variant={copy.variant} size="md" disabled={!valid || pending}>{pending ? "กำลังบันทึก..." : copy.confirm}</ActionButton>
                    </div>
                </form>
            )}
        </Dialog>
    );
}

function Fact({ k, v }: Readonly<{ k: string; v: React.ReactNode }>) {
    return <div className="flex flex-col gap-0.5"><dt className="text-[13px] text-brand-muted">{k}</dt><dd className="m-0 text-[15px] font-semibold">{v}</dd></div>;
}

function RefundDetail({ schoolId, base, onAction, canWrite, hint }: Readonly<{ schoolId: string; base: RefundRequest; onAction: (a: RefundDecisionAction) => void; canWrite: boolean; hint?: string }>) {
    const detail = useRefundDetail(schoolId, base.id);
    const r: RefundRequest = { ...base, ...(detail.data ?? {}) };
    const items = r.order?.items;
    const writeProps = canWrite ? {} : ({ disabled: true, title: hint, "aria-disabled": true } as const);

    return (
        <div className="flex flex-col gap-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-1">
                    <span className="text-[13px] font-bold text-danger-text">ขอคืนเงิน</span>
                    <p className="text-xl font-bold">ออเดอร์ {codeOf(r)} · {formatBaht(r.amount)} บาท</p>
                    <span className="text-sm text-brand-muted">{r.restaurant?.name ?? "-"} · ส่งเมื่อ {formatDateTime(r.createdAt)}</span>
                </div>
                <RefundStatusChip status={r.status} />
            </div>

            <dl className="m-0 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                <Fact k="เหตุผลที่นักเรียนเลือก" v={refundReasonLabel(r.reason)} />
                <Fact k="นักเรียน" v={r.student?.name ?? "ไม่ระบุชื่อ"} />
                <Fact k="สถานะการจ่าย" v={r.order?.paymentStatus === "PAID" ? "จ่ายแล้ว · สลิปตรวจผ่าน" : r.order?.paymentStatus === "REFUNDED" ? "คืนเงินแล้ว" : r.order?.paymentStatus ?? "-"} />
                <Fact k="จ่ายเมื่อ" v={formatDateTime(r.order?.paidAt)} />
                <Fact k="สั่งเมื่อ" v={formatDateTime(r.order?.orderAt)} />
                <Fact k="นัดรับ" v={formatDateTime(r.order?.pickupAt)} />
            </dl>

            {detail.isLoading && <Skeleton className="h-24 w-full rounded-[14px]" />}
            {detail.isError && <ErrorState message="โหลดรายละเอียดออเดอร์ไม่สำเร็จ" onRetry={() => detail.refetch()} />}
            {items && items.length > 0 && (
                <section aria-label="รายการอาหาร" className="flex flex-col gap-2"><h3 className="text-base font-bold">รายการอาหาร</h3><RefundItems items={items} total={r.order?.totalAmount ?? r.amount} /></section>
            )}

            <section aria-label="ข้อความจากนักเรียน" className="flex flex-col gap-2">
                <h3 className="text-base font-bold">ข้อความจากนักเรียน</h3>
                {r.details ? <blockquote className="m-0 whitespace-pre-line rounded-xl bg-ground p-3.5 text-[15px] leading-relaxed">“{r.details}”</blockquote> : <p className="text-sm text-brand-muted">นักเรียนไม่ได้เขียนรายละเอียดเพิ่ม</p>}
            </section>

            {r.decisionNote && (
                <section aria-label="หมายเหตุของโรงเรียน" className="flex flex-col gap-2">
                    <h3 className="text-base font-bold">หมายเหตุของโรงเรียน</h3>
                    <blockquote className="m-0 whitespace-pre-line rounded-xl bg-ground-blue p-3.5 text-[15px] leading-relaxed">{r.decisionNote}</blockquote>
                </section>
            )}

            <section aria-label="ความคืบหน้า" className="flex flex-col gap-3 rounded-[14px] border border-line-soft p-4">
                <h3 className="text-base font-bold">ความคืบหน้า</h3>
                <RefundTimeline steps={refundSteps(r)} />
            </section>

            {(r.status === "PENDING" || r.status === "APPROVED") && (
                <div className="flex flex-col gap-2.5 border-t border-row-line pt-4">
                    {!canWrite && <p className="flex items-start gap-2 text-sm text-brand-muted"><Icon name="lock" size={16} className="mt-0.5" />{hint}</p>}
                    <div className="flex flex-wrap justify-end gap-2.5">
                        {r.status === "PENDING" ? (
                            <>
                                <ActionButton variant="dangerOutline" size="md" onClick={() => onAction("reject")} {...writeProps}>ไม่อนุมัติ</ActionButton>
                                <ActionButton size="md" onClick={() => onAction("approve")} {...writeProps}>อนุมัติ</ActionButton>
                            </>
                        ) : (
                            <ActionButton size="md" onClick={() => onAction("mark_refunded")} {...writeProps}>บันทึกว่าโอนคืนแล้ว</ActionButton>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default function SchoolRefundsPage({ params }: Readonly<{ params: Promise<{ schoolId: string }> }>) {
    const { schoolId } = use(params);
    const access = useSchoolAccess(schoolId);
    const summary = useRefundSummary(schoolId);
    const week = useRefundedThisWeek(schoolId);
    const [tab, setTab] = useState<Tab>("PENDING");
    const [q, setQ] = useState("");
    const list = useSchoolRefunds(schoolId, tab === "ALL" ? undefined : tab);
    const decide = useDecideRefund(schoolId);

    const [selected, setSelected] = useState<RefundRequest | null>(null);
    const [action, setAction] = useState<RefundDecisionAction | null>(null);
    const closeDetail = useCallback(() => setSelected(null), []);
    const cancelAction = useCallback(() => setAction(null), []);

    const counts = summary.data?.counts;
    const total = counts ? counts.PENDING + counts.APPROVED + counts.REJECTED + counts.REFUNDED : null;
    const countOf = (t: Tab) => (!counts ? null : t === "ALL" ? total : counts[t]);

    const rows = useMemo(() => {
        const needle = q.trim().toLowerCase();
        if (!needle) return list.items;
        return list.items.filter((r) => [codeOf(r), r.restaurant?.name, refundReasonLabel(r.reason), r.details, r.student?.name].some((x) => x?.toLowerCase().includes(needle)));
    }, [list.items, q]);

    // keep the open dialog in sync with refreshed list data
    const current = selected ? (list.items.find((r) => r.id === selected.id) ?? selected) : null;

    const confirm = (note: string) => {
        if (!current || !action) return;
        decide.mutate({ id: current.id, action, note: note || undefined }, { onSuccess: () => { setAction(null); if (action !== "approve") setSelected(null); } });
    };

    const oldest = summary.data?.oldestPendingAt ? waitLabel(summary.data.oldestPendingAt) : null;

    return (
        <SchoolShell schoolId={schoolId} active="refunds">
            <div className="flex flex-col gap-6">
                <SchoolPageHeader eyebrow="คำขอจากนักเรียน" title="คำขอคืนเงิน" />

                <Notice tone="primary" icon="info">
                    <span className="text-[15px]"><b>ระบบไม่โอนเงินให้</b> · โรงเรียนอนุมัติ แล้วประสานกับร้านเพื่อคืนเงินให้นักเรียน จากนั้นกด “บันทึกว่าโอนคืนแล้ว” นักเรียนจะเห็นสถานะในแอป</span>
                </Notice>

                <StatGrid min={190}>
                    <StatCard label="รอตัดสินใจ" value={counts ? counts.PENDING : "–"} sub={counts && counts.PENDING > 0 ? "รอคุณอนุมัติหรือไม่อนุมัติ" : "ไม่มีเรื่องค้าง"} />
                    <StatCard label="อนุมัติแล้ว รอโอนคืน" value={counts ? counts.APPROVED : "–"} sub="รอประสานร้านและบันทึกผล" />
                    <StatCard label="โอนคืนแล้ว 7 วันล่าสุด" value={week.data ? `${week.data.count}${week.data.more ? "+" : ""}` : "–"} />
                    <StatCard label="เรื่องที่รอนานที่สุด" value={summary.data ? (oldest ?? "ไม่มี") : "–"} sub={oldest ? "นับจากที่นักเรียนส่งคำขอ" : undefined} />
                </StatGrid>
                {summary.isError && <p role="status" className="text-sm text-danger-text">โหลดตัวเลขสรุปไม่สำเร็จ <button type="button" onClick={() => summary.refetch()} className="font-semibold underline">ลองใหม่</button></p>}

                <Card className="flex min-w-0 flex-col gap-4 p-4 sm:p-5">
                    <div className="flex flex-wrap items-center gap-3">
                        <div role="tablist" aria-label="สถานะคำขอ" className="flex max-w-full gap-1.5 overflow-x-auto rounded-xl border border-line-soft bg-white p-1">
                            {TABS.map((t) => {
                                const n = countOf(t.value);
                                return (
                                    <button key={t.value} type="button" role="tab" aria-selected={t.value === tab} onClick={() => setTab(t.value)}
                                        className={clsx("h-10 shrink-0 rounded-[9px] px-3.5 font-app text-[15px] font-semibold", t.value === tab ? "bg-primary-main text-white" : "text-slate hover:bg-ground")}>
                                        {t.label}{n != null && <span className="ml-1.5 tabular-nums opacity-90">{n}</span>}
                                    </button>
                                );
                            })}
                        </div>
                        <SearchInput label="ค้นหาคำขอ" placeholder="ค้นหารหัสออเดอร์ ร้าน เหตุผล" value={q} onChange={(e) => setQ(e.target.value)} className="min-w-[220px] max-w-[420px] flex-1 !h-11 !rounded-[10px] !border" />
                    </div>

                    {list.isLoading && (
                        <>
                            <div className="hidden md:block"><TableSkeleton rows={5} cols={6} /></div>
                            <div className="md:hidden"><CardListSkeleton count={3} /></div>
                        </>
                    )}
                    {list.isError && <ErrorState onRetry={() => list.refetch()} />}
                    {!list.isLoading && !list.isError && rows.length === 0 && (
                        <EmptyState
                            title={q ? "ไม่พบคำขอที่ค้นหา" : tab === "PENDING" ? "ไม่มีคำขอรอตัดสินใจ" : "ยังไม่มีรายการ"}
                            body={q ? "ลองค้นหาด้วยคำอื่น" : "เมื่อนักเรียนส่งคำขอคืนเงิน จะแสดงที่นี่และแจ้งเตือนผู้ดูแล"}
                        />
                    )}

                    {rows.length > 0 && (
                        <>
                            <div className="hidden md:block">
                                <TableWrap minWidth={760}>
                                    <thead><tr>
                                        <th scope="col" className={TH}>ออเดอร์</th><th scope="col" className={TH}>เหตุผล</th><th scope="col" className={`${TH} text-right`}>ยอด</th>
                                        <th scope="col" className={TH}>ส่งเมื่อ</th><th scope="col" className={TH}>สถานะ</th><th scope="col" className={TH}><span className="sr-only-x">ดู</span></th>
                                    </tr></thead>
                                    <tbody>
                                        {rows.map((r) => (
                                            <tr key={r.id} className="cursor-pointer hover:bg-ground-blue" onClick={() => setSelected(r)}>
                                                <td className={TD}><span className="flex flex-col"><span className="font-bold">{codeOf(r)}</span><span className="text-[13px] text-brand-muted">{r.restaurant?.name ?? "-"}</span></span></td>
                                                <td className={TD}>{refundReasonLabel(r.reason)}</td>
                                                <td className={`${TD} text-right font-semibold tabular-nums`}>{formatBaht(r.amount)}</td>
                                                <td className={TD}><span className="flex flex-col"><span>{formatDateTime(r.createdAt)}</span>{r.status === "PENDING" && <span className={clsx("text-[13px] font-semibold", isLate(r) ? "text-danger-text" : "text-brand-muted")}>รอมา {waitLabel(r.createdAt)}</span>}</span></td>
                                                <td className={TD}><RefundStatusChip status={r.status} short /></td>
                                                <td className={`${TD} text-right`}><button type="button" onClick={(e) => { e.stopPropagation(); setSelected(r); }} className="inline-flex min-h-11 items-center text-sm font-semibold text-primary-dark underline" aria-label={`ดูคำขอของออเดอร์ ${codeOf(r)}`}>ดูรายละเอียด</button></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </TableWrap>
                            </div>
                            <ul className="m-0 flex list-none flex-col gap-2.5 p-0 md:hidden">
                                {rows.map((r) => (
                                    <li key={r.id}>
                                        <button type="button" onClick={() => setSelected(r)} className="flex w-full flex-col gap-1.5 rounded-[14px] border border-line-soft bg-white p-4 text-left font-app">
                                            <span className="flex items-center justify-between gap-2">
                                                <RefundStatusChip status={r.status} short />
                                                <span className={clsx("text-[13px] font-semibold", isLate(r) ? "text-danger-text" : "text-brand-muted")}>{r.status === "PENDING" ? `รอมา ${waitLabel(r.createdAt)}` : formatDateTime(r.createdAt)}</span>
                                            </span>
                                            <span className="text-base font-bold">{codeOf(r)} · {formatBaht(r.amount)} บาท</span>
                                            <span className="flex justify-between gap-2 text-[13px] text-brand-muted"><span className="truncate">{r.restaurant?.name ?? "-"}</span><span className="shrink-0">{refundReasonLabel(r.reason)}</span></span>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </>
                    )}

                    {list.hasNextPage && (
                        <div className="flex justify-center"><ActionButton variant="outline" size="md" onClick={() => list.fetchNextPage()} disabled={list.isFetchingNextPage}>{list.isFetchingNextPage ? "กำลังโหลด..." : "โหลดเพิ่ม"}</ActionButton></div>
                    )}
                </Card>
            </div>

            <Dialog open={!!current} onClose={action ? () => undefined : closeDetail} title={current ? `คำขอคืนเงิน · ${codeOf(current)}` : "คำขอคืนเงิน"} wide>
                {current && <RefundDetail schoolId={schoolId} base={current} onAction={setAction} canWrite={access.canWrite} hint={access.hint} />}
            </Dialog>
            <DecisionDialog key={action ?? "none"} action={action} onCancel={cancelAction} onConfirm={confirm} pending={decide.isPending} />
        </SchoolShell>
    );
}
