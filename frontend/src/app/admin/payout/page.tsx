"use client";

import React, { useEffect, useState, useMemo } from "react";
import { api } from "@/lib/api";
import { toastError, toastDanger } from "@/components/ui/Toast";
import { AdminShell } from "@/components/admin/AdminShell";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { ActionButton, Card, Chip, EmptyState, Icon, SearchInput } from "@/components/ui/kit";
import { AdminPage, PageHeader, StatCard, StatGrid } from "@/components/admin/AdminUI";

type Payout = {
    payoutId: string;
    restaurantName: string;
    restaurantId: string;
    grossAmount: number;
    restaurantRevenue: number;
    platformFee: number;
    transactionFee: number;
    vat: number;
    refundAmount: number;
    isPaid: boolean;
    startDate: string;
    endDate: string;
    paidAt?: string;
    refundAt?: string;
    createdAt: string;
    orderId: string;
    order?: {
        totalAmount: number;
        status: string;
        paymentStatus: string;
    };
};

type SortKey = keyof Payout | "grossAmount" | "refundAmount";
type SortDir = "asc" | "desc";
type TimeFilter = "today" | "weekly" | "monthly" | "all";
type StatusFilter = "all" | "paid" | "pending";

const fmt = (val: number) =>
    new Intl.NumberFormat("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);

const fmtDate = (d?: string | null) => d ? new Date(d).toLocaleDateString("th-TH", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const fmtDateTime = (d: string) =>
    new Date(d).toLocaleString("th-TH", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

const getTimeRange = (filter: TimeFilter): { start: Date; end: Date } | null => {
    const now = new Date();
    if (filter === "all") return null;

    const start = new Date();
    const end = new Date();

    if (filter === "today") {
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
    } else if (filter === "weekly") {
        const day = now.getDay();
        start.setDate(now.getDate() - day);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
    } else if (filter === "monthly") {
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
    }

    return { start, end };
};

const StatusBadge = ({ isPaid }: { isPaid: boolean }) => (
    isPaid ? <Chip tone="success" icon="check">จ่ายแล้ว</Chip> : <Chip tone="orange" icon="clock">รอดำเนินการ</Chip>
);

const SortIcon = ({ active, dir }: { active: boolean; dir: SortDir }) => (
    <span aria-hidden="true" className={`ml-1 inline-flex flex-col gap-px align-middle transition-opacity ${active ? "opacity-100" : "opacity-30"}`}>
        <span className={`h-0 w-0 border-x-[4px] border-b-[5px] border-x-transparent ${active && dir === "asc" ? "border-b-brand-dark" : "border-b-brand-muted"}`} />
        <span className={`h-0 w-0 border-x-[4px] border-t-[5px] border-x-transparent ${active && dir === "desc" ? "border-t-brand-dark" : "border-t-brand-muted"}`} />
    </span>
);

export default function PayoutLedgerPage() {

    const [payouts, setPayouts] = useState<Payout[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [filterStatus, setFilterStatus] = useState<StatusFilter>("all");
    const [timeFilter, setTimeFilter] = useState<TimeFilter>("all");
    const [sortKey, setSortKey] = useState<SortKey>("createdAt");
    const [sortDir, setSortDir] = useState<SortDir>("desc");
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [togglingId, setTogglingId] = useState<string | null>(null);
    const [confirmToggle, setConfirmToggle] = useState<{ payoutId: string; currentIsPaid: boolean } | null>(null);

    const loadPayouts = async () => {
        setIsLoading(true);
        try {
            const res = await api.get("/payout");
            setPayouts(res.data);
        } catch (error: unknown) {
            toastError("โหลดรายการจ่ายเงินไม่สำเร็จ กรุณาลองใหม่", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { loadPayouts(); }, []);

    const handleToggleIsPaid = async (payoutId: string, currentIsPaid: boolean) => {
        if (togglingId === payoutId) return;

        setConfirmToggle(null);
        setTogglingId(payoutId);

        // Optimistic update
        setPayouts(prev => prev.map(p =>
            p.payoutId === payoutId ? { ...p, isPaid: !currentIsPaid } : p
        )
        );

        const previous = payouts.find(p => p.payoutId === payoutId);
        if (!previous) return;

        try {
            await api.patch(`/payout/update/${payoutId}`, { isPaid: !currentIsPaid });
        } catch (error: unknown) {
            setPayouts(prev => prev.map(p => p.payoutId === payoutId ? previous : { ...p, isPaid: currentIsPaid }));
            toastError("เปลี่ยนสถานะการจ่ายเงินไม่สำเร็จ ระบบได้คืนค่าเดิมให้แล้ว", error);
        } finally {
            setTogglingId(null);
        }
    };

    const totals = useMemo(() => {
        const base = payouts.filter(p =>
            filterStatus === "all" ? true : filterStatus === "paid" ? p.isPaid : !p.isPaid
        );
        return {
            gross: base.reduce((s, p) => s + Number(p.grossAmount), 0),
            platform: base.reduce((s, p) => s + Number(p.platformFee), 0),
            transaction: base.reduce((s, p) => s + Number(p.transactionFee), 0),
            vat: base.reduce((s, p) => s + Number(p.vat), 0),
            restaurant: base.reduce((s, p) => s + Number(p.restaurantRevenue), 0),
            count: base.length,
            paid: base.filter(p => p.isPaid).length,
        };
    }, [payouts, filterStatus]);

    const handleSort = (key: SortKey) => {
        if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
        else { setSortKey(key); setSortDir("asc"); }
    };

    const filtered = useMemo(() => {
        let data = [...payouts];

        const range = getTimeRange(timeFilter);
        if (range) {
            data = data.filter(p => {
                const d = new Date(p.createdAt);
                return d >= range.start && d <= range.end;
            });
        }

        if (filterStatus !== "all") {
            data = data.filter(p => filterStatus === "paid" ? p.isPaid : !p.isPaid);
        }

        if (search.trim()) {
            const q = search.toLowerCase();
            data = data.filter(p =>
                p.restaurantName.toLowerCase().includes(q) ||
                p.orderId.toLowerCase().includes(q) ||
                p.payoutId.toLowerCase().includes(q)
            );
        }

        data.sort((a, b) => {
            let av: number | string = 0;
            let bv: number | string = 0;

            if (sortKey === "grossAmount") {
                av = Number(a.restaurantRevenue) + Number(a.platformFee) + Number(a.transactionFee);
                bv = Number(b.restaurantRevenue) + Number(b.platformFee) + Number(b.transactionFee);
            } else if (sortKey === "refundAmount") {
                av = 0; bv = 0;
            } else if (sortKey in a) {
                av = (a as Record<string, unknown>)[sortKey] as string | number ?? "";
                bv = (b as Record<string, unknown>)[sortKey] as string | number ?? "";
            }

            if (av < bv) return sortDir === "asc" ? -1 : 1;
            if (av > bv) return sortDir === "asc" ? 1 : -1;
            return 0;
        });

        return data;
    }, [payouts, search, filterStatus, timeFilter, sortKey, sortDir]);

    const cols: { label: string; key: SortKey; align?: string }[] = [
        { label: "ออเดอร์ID", key: "orderId" },
        { label: "ร้านอาหาร", key: "restaurantName", align: "right" },
        { label: "ยอดเงินทั้งหมด", key: "grossAmount", align: "right" },
        { label: "ค่าธรรมเนียมPlatform", key: "platformFee", align: "right" },
        { label: "ค่าทำธุรกรรม", key: "transactionFee", align: "right" },
        { label: "ภาษี (7%)", key: "vat", align: "right" },
        { label: "รายได้ร้านอาหารสุทธิ", key: "restaurantRevenue", align: "right" },
        { label: "จำนวนเงินที่โอนคืน", key: "refundAmount", align: "right" },
        { label: "วันที่คืนเงิน", key: "refundAt", align: "right" },
        { label: "สถานะการชำระเงิน", key: "isPaid" },
        { label: "วันที่บันทึก", key: "createdAt" },
    ];

    const timeLabels: { key: TimeFilter; label: string }[] = [
        { key: "today", label: "วันนี้" },
        { key: "weekly", label: "สัปดาห์นี้" },
        { key: "monthly", label: "เดือนนี้" },
        { key: "all", label: "ทั้งหมด" },
    ];

    const TH = "sticky top-0 z-10 whitespace-nowrap border-b border-line-soft bg-white px-3 py-2.5 text-[13px] font-semibold text-brand-muted";
    const TD = "border-b border-row-line px-3 py-3 align-middle tabular-nums";
    const sumOf = (k: "grossAmount" | "platformFee" | "transactionFee" | "vat" | "restaurantRevenue") => filtered.reduce((acc, p) => acc + Number(p[k]), 0);

    return (
        <AdminShell active="payout">
            {/* Confirm Modal */}
            {confirmToggle && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" onKeyDown={(e) => { if (e.key === "Escape") setConfirmToggle(null); }}>
                    <div role="alertdialog" aria-modal="true" aria-labelledby="payout-confirm-title" className="flex w-full max-w-sm flex-col gap-4 rounded-[18px] bg-white p-6 shadow-2xl">
                        <div className="flex flex-col gap-1">
                            <h2 id="payout-confirm-title" className="text-lg font-bold">ยืนยันการเปลี่ยนสถานะ</h2>
                            <p className="text-[15px] text-brand-muted">
                                {confirmToggle.currentIsPaid
                                    ? "ต้องการเปลี่ยนสถานะเป็น รอดำเนินการ ใช่หรือไม่?"
                                    : "ต้องการยืนยันว่าได้จ่ายเงินแล้ว ใช่หรือไม่?"}
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-3">
                            <ActionButton variant="outline" size="md" className="flex-1 !h-[46px]" autoFocus onClick={() => setConfirmToggle(null)}>ยกเลิก</ActionButton>
                            <ActionButton
                                variant={confirmToggle.currentIsPaid ? "dangerOutline" : "primary"}
                                size="md"
                                className="flex-1 !h-[46px]"
                                onClick={() => handleToggleIsPaid(confirmToggle.payoutId, confirmToggle.currentIsPaid)}
                            >
                                {confirmToggle.currentIsPaid ? "เปลี่ยนเป็นรอดำเนินการ" : "ยืนยันจ่ายแล้ว"}
                            </ActionButton>
                        </div>
                    </div>
                </div>
            )}

            <AdminPage width={1600}>
                <PageHeader
                    title="การเงิน & การโอนให้ร้าน"
                    subtitle={`อัปเดตล่าสุด ${new Date().toLocaleTimeString("th-TH")}`}
                    action={
                        <div role="tablist" aria-label="ช่วงเวลา" className="flex gap-1.5 rounded-xl border border-line-soft bg-white p-1">
                            {timeLabels.map(({ key, label }) => (
                                <button
                                    key={key}
                                    type="button"
                                    role="tab"
                                    aria-selected={timeFilter === key}
                                    onClick={() => setTimeFilter(key)}
                                    className={`h-[38px] rounded-[9px] px-3.5 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary-main ${timeFilter === key ? "bg-primary-main text-white" : "text-slate hover:bg-ground"}`}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    }
                />

                {/* Summary cards */}
                <StatGrid min={220}>
                    <StatCard label="Gross Amount รวม" value={`฿${fmt(totals.gross)}`} sub={`${totals.count} รายการ`} />
                    <StatCard label="Platform Revenue" value={`฿${fmt(totals.platform - totals.vat)}`} sub="ค่าคอมมิชชัน" />
                    <StatCard label="Transaction Fees" value={`฿${fmt(totals.transaction)}`} sub="ค่าธรรมเนียม" />
                    <StatCard label="Restaurant Payout" value={`฿${fmt(totals.restaurant)}`} sub={`จ่ายแล้ว ${totals.paid}/${totals.count}`} />
                </StatGrid>

                <Card className="flex flex-col gap-3.5 p-4 sm:p-5">
                    {/* Filters */}
                    <div className="flex flex-wrap items-center gap-2.5">
                        <SearchInput
                            label="ค้นหา"
                            placeholder="ค้นหา Order ID, ร้านอาหาร, Payout ID"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="min-w-[240px] flex-[1_1_280px] !h-11 !rounded-[10px] !border"
                        />
                        <div role="group" aria-label="สถานะการชำระเงิน" className="flex flex-wrap gap-2">
                            {(["all", "paid", "pending"] as StatusFilter[]).map((st) => (
                                <button
                                    key={st}
                                    type="button"
                                    aria-pressed={filterStatus === st}
                                    onClick={() => setFilterStatus(st)}
                                    className={`h-11 rounded-[10px] px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary-main ${filterStatus === st ? "border-[1.5px] border-primary-main bg-primary-light text-primary-dark" : "border-[1.5px] border-line bg-white text-slate hover:bg-ground"}`}
                                >
                                    {st === "all" ? "ทั้งหมด" : st === "paid" ? "จ่ายแล้ว" : "รอดำเนินการ"}
                                </button>
                            ))}
                        </div>
                        <ActionButton variant="outline" size="md" onClick={loadPayouts} disabled={isLoading}><Icon name="clock" size={16} />รีเฟรช</ActionButton>
                    </div>

                    {/* Table */}
                    {isLoading ? (
                        <TableSkeleton rows={8} cols={7} />
                    ) : filtered.length === 0 ? (
                        <EmptyState title="ไม่พบรายการ" body="ลองเปลี่ยนช่วงเวลา สถานะ หรือคำค้นหา" />
                    ) : (
                        <div className="max-h-[70vh] overflow-auto rounded-xl">
                            <table className="w-full min-w-[1180px] border-collapse text-sm">
                                <thead>
                                    <tr>
                                        {cols.map(col => (
                                            <th
                                                key={col.key}
                                                scope="col"
                                                aria-sort={sortKey === col.key ? (sortDir === "asc" ? "ascending" : "descending") : undefined}
                                                className={`${TH} ${col.align === "right" ? "text-right" : "text-left"}`}
                                            >
                                                <button type="button" onClick={() => handleSort(col.key)} className="inline-flex items-center rounded font-semibold hover:text-brand-dark focus-visible:outline-2 focus-visible:outline-primary-main">
                                                    {col.label}
                                                    <SortIcon active={sortKey === col.key} dir={sortDir} />
                                                </button>
                                            </th>
                                        ))}
                                        <th scope="col" className={`${TH} text-left`}>อัพเดทสถานะ</th>
                                        <th scope="col" className={`${TH} text-left`}><span className="sr-only-x">รายละเอียด</span></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.map((payout) => {
                                        const isExpanded = expandedId === payout.payoutId;
                                        const isToggling = togglingId === payout.payoutId;
                                        const pct = (v: number) => (payout.grossAmount ? (Number(v) / payout.grossAmount) * 100 : 0);

                                        return (
                                            <React.Fragment key={payout.payoutId}>
                                                <tr className={isExpanded ? "bg-ground-blue" : "hover:bg-ground-blue"}>
                                                    <td className={`${TD} font-mono text-xs text-brand-muted`}>{payout.orderId.substring(0, 8)}...</td>
                                                    <td className={`${TD} text-right font-semibold`}>{payout.restaurantName}</td>
                                                    <td className={`${TD} text-right font-semibold`}>฿{fmt(payout.grossAmount)}</td>
                                                    <td className={`${TD} text-right`}>฿{fmt(Number(payout.platformFee))}</td>
                                                    <td className={`${TD} text-right`}>฿{fmt(Number(payout.transactionFee))}</td>
                                                    <td className={`${TD} text-right`}>฿{fmt(Number(payout.vat))}</td>
                                                    <td className={`${TD} text-right font-semibold text-success-main`}>฿{fmt(Number(payout.restaurantRevenue))}</td>
                                                    <td className={`${TD} text-right text-brand-muted`}>฿{fmt(payout.refundAmount ? Number(payout.refundAmount) : 0)}</td>
                                                    <td className={`${TD} text-right text-brand-muted`}>{fmtDate(payout.refundAt)}</td>
                                                    <td className={TD}><StatusBadge isPaid={payout.isPaid} /></td>
                                                    <td className={`${TD} whitespace-nowrap text-brand-muted`}>{fmtDate(payout.createdAt)}</td>

                                                    {/* isPaid toggle */}
                                                    <td className={TD}>
                                                        <button
                                                            type="button"
                                                            disabled={isToggling}
                                                            onClick={() => setConfirmToggle({ payoutId: payout.payoutId, currentIsPaid: payout.isPaid })}
                                                            className={`inline-flex h-10 items-center gap-1.5 whitespace-nowrap rounded-[10px] border-[1.5px] px-3 text-[13px] font-semibold focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary-main disabled:opacity-50 ${payout.isPaid ? "border-line bg-white text-slate hover:bg-ground" : "border-success-main bg-success-light text-success-main hover:brightness-95"}`}
                                                        >
                                                            {isToggling ? (
                                                                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-brand-muted border-t-transparent" />
                                                            ) : (
                                                                <Icon name={payout.isPaid ? "x" : "check"} size={14} strokeWidth={2.6} />
                                                            )}
                                                            {payout.isPaid ? "ยกเลิกการจ่าย" : "ยืนยันจ่ายแล้ว"}
                                                        </button>
                                                    </td>

                                                    {/* Expand toggle */}
                                                    <td className={TD}>
                                                        <button
                                                            type="button"
                                                            aria-expanded={isExpanded}
                                                            aria-label={isExpanded ? "ซ่อนรายละเอียด" : "ดูรายละเอียด"}
                                                            onClick={() => setExpandedId(isExpanded ? null : payout.payoutId)}
                                                            className="flex h-10 w-10 items-center justify-center rounded-[10px] text-brand-muted hover:bg-ground hover:text-brand-dark focus-visible:outline-2 focus-visible:outline-primary-main"
                                                        >
                                                            <Icon name="chevronDown" size={18} className={`transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                                                        </button>
                                                    </td>
                                                </tr>

                                                {isExpanded && (
                                                    <tr className="bg-ground-blue">
                                                        <td colSpan={13} className="border-b border-row-line px-5 py-4">
                                                            <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
                                                                <div>
                                                                    <p className="mb-1 text-xs text-brand-muted">Payout ID</p>
                                                                    <p className="break-all font-mono text-xs text-slate">{payout.payoutId}</p>
                                                                </div>
                                                                <div>
                                                                    <p className="mb-1 text-xs text-brand-muted">Order ID</p>
                                                                    <p className="break-all font-mono text-xs text-slate">{payout.orderId}</p>
                                                                </div>
                                                                <div>
                                                                    <p className="mb-1 text-xs text-brand-muted">ช่วงเวลา</p>
                                                                    <p className="text-slate">{fmtDate(payout.startDate)} → {fmtDate(payout.endDate)}</p>
                                                                </div>
                                                                <div>
                                                                    <p className="mb-1 text-xs text-brand-muted">จ่ายเมื่อ</p>
                                                                    <p className="text-slate">{payout.paidAt ? fmtDateTime(payout.paidAt) : "—"}</p>
                                                                </div>

                                                                <div className="col-span-2 md:col-span-4">
                                                                    <p className="mb-2 text-xs text-brand-muted">การกระจายรายได้</p>
                                                                    <div className="flex h-6 overflow-hidden rounded-lg text-xs font-semibold text-white">
                                                                        <div style={{ width: `${pct(payout.restaurantRevenue)}%` }} className="flex items-center justify-center bg-success-main">{pct(payout.restaurantRevenue).toFixed(0)}%</div>
                                                                        <div style={{ width: `${pct(payout.platformFee)}%` }} className="flex items-center justify-center bg-primary-main">{pct(payout.platformFee).toFixed(0)}%</div>
                                                                        <div style={{ width: `${pct(payout.transactionFee)}%` }} className="flex items-center justify-center bg-brand-orange">{pct(payout.transactionFee).toFixed(0)}%</div>
                                                                    </div>
                                                                    <div className="mt-1.5 flex flex-wrap gap-4 text-xs text-brand-muted">
                                                                        <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-success-main" />ร้านอาหาร</span>
                                                                        <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-primary-main" />Platform</span>
                                                                        <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-brand-orange" />Transaction</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        );
                                    })}
                                </tbody>

                                <tfoot>
                                    <tr className="bg-neutral-light font-bold">
                                        <td className="px-3 py-3 text-[13px] text-neutral-text" colSpan={2}>รวม ({filtered.length} รายการ)</td>
                                        <td className="px-3 py-3 text-right tabular-nums">฿{fmt(sumOf("grossAmount"))}</td>
                                        <td className="px-3 py-3 text-right tabular-nums">฿{fmt(sumOf("platformFee"))}</td>
                                        <td className="px-3 py-3 text-right tabular-nums">฿{fmt(sumOf("transactionFee"))}</td>
                                        <td className="px-3 py-3 text-right tabular-nums">฿{fmt(sumOf("vat"))}</td>
                                        <td className="px-3 py-3 text-right tabular-nums text-success-main">฿{fmt(sumOf("restaurantRevenue"))}</td>
                                        <td className="px-3 py-3 text-right tabular-nums text-brand-muted">฿0.00</td>
                                        <td colSpan={5} />
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )}
                </Card>

                <p className="text-center text-sm text-brand-muted">
                    รายการทางการเงินเป็นข้อมูลทางการเงินที่เป็นความลับ ห้ามเผยแพร่
                </p>
            </AdminPage>
        </AdminShell>
    );
}
