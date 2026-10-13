"use client";

import React, { useEffect, useState, useMemo } from "react";
import { api } from "@/lib/api";
import { toastDanger } from "@/components/ui/Toast";
import { Button } from "@/components/Button";
import { useRouter } from "next/navigation";
import LoadingPage from "@/components/LoadingPage";

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
    <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold tracking-wide ${isPaid
            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
            : "bg-amber-50 text-amber-700 border border-amber-200"
            }`}
    >
        <span className={`w-1.5 h-1.5 rounded-full ${isPaid ? "bg-emerald-500" : "bg-amber-400"}`} />
        {isPaid ? "จ่ายแล้ว" : "รอดำเนินการ"}
    </span>
);

const SortIcon = ({ active, dir }: { active: boolean; dir: SortDir }) => (
    <span className={`ml-1 inline-flex flex-col gap-px transition-opacity ${active ? "opacity-100" : "opacity-30"}`}>
        <span className={`w-0 h-0 border-l-[4px] border-r-[4px] border-b-[5px] border-transparent ${active && dir === "asc" ? "border-b-slate-800" : "border-b-slate-400"}`} />
        <span className={`w-0 h-0 border-l-[4px] border-r-[4px] border-t-[5px] border-transparent ${active && dir === "desc" ? "border-t-slate-800" : "border-t-slate-400"}`} />
    </span>
);

export default function PayoutLedgerPage() {
    const router = useRouter();

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
            if (typeof error === 'object' && error !== null && 'response' in error) {
                const err = error as { response: { status: number; data?: { message?: string, code?: string } } };

                const backendMessage = err.response.data?.message;

                toastDanger(backendMessage ?? "เกิดข้อผิดพลาด กรุณาลองใหม่");
            }
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
            if (typeof error === 'object' && error !== null && 'response' in error) {
                const err = error as { response: { status: number; data?: { message?: string, code?: string } } };
                const backendMessage = err.response.data?.message;

                setPayouts(prev => prev.map(p => p.payoutId === payoutId ? previous : { ...p, isPaid: currentIsPaid }));

                toastDanger(backendMessage ?? "อัพเดทสถานะบันทึกชำระเงินผิดพลาด");
            }
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

    return (
        <div className="min-h-screen bg-slate-50 font-sans">
            {/* Confirm Modal */}
            {confirmToggle && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4">
                        <h2 className=" font-bold text-slate-900 mb-1">ยืนยันการเปลี่ยนสถานะ</h2>
                        <p className="text-sm text-slate-500 mb-5">
                            {confirmToggle.currentIsPaid
                                ? "ต้องการเปลี่ยนสถานะเป็น รอดำเนินการ ใช่หรือไม่?"
                                : "ต้องการยืนยันว่าได้จ่ายเงินแล้ว ใช่หรือไม่?"}
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setConfirmToggle(null)}
                                className="flex-1 px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                            >
                                ยกเลิก
                            </button>
                            <button
                                onClick={() => handleToggleIsPaid(confirmToggle.payoutId, confirmToggle.currentIsPaid)}
                                className={`flex-1 px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors ${confirmToggle.currentIsPaid
                                    ? "bg-amber-500 hover:bg-amber-600"
                                    : "bg-emerald-600 hover:bg-emerald-700"
                                    }`}
                            >
                                {confirmToggle.currentIsPaid ? "เปลี่ยนเป็นรอดำเนินการ" : "ยืนยันจ่ายแล้ว"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="bg-white border-b border-slate-200 px-8 py-6">
                <div className="max-w-screen-2xl mx-auto flex items-center justify-between">
                    <div>
                        <p className="text-xs font-semibold tracking-widest text-slate-400 uppercase mb-1">แอดมินแดชบอร์ด</p>
                        <h1 className="text-2xl font-bold text-slate-900">รายการทางการเงิน</h1>
                        <p className="text-sm text-slate-500 mt-0.5">บัญชีการเงินและรายการชำระเงิน</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-400">อัพเดทล่าสุด: {new Date().toLocaleTimeString("th-TH")}</span>
                        <button
                            onClick={loadPayouts}
                            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-700 transition-colors"
                        >
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                                <path d="M1 4v6h6M23 20v-6h-6" />
                                <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" />
                            </svg>
                            รีเฟรช
                        </button>

                        <Button type="button" variant="secondary" onClick={() => router.push(`/admin/role-requests`)}>กลับสู่หน้าหลัก</Button>
                    </div>
                </div>
            </div>

            <div className="max-w-screen-2xl mx-auto px-8 py-8 space-y-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                        { label: "Gross Amount รวม", value: `฿${fmt(totals.gross)}`, sub: `${totals.count} รายการ`, color: "border-slate-900" },
                        { label: "Platform Revenue", value: `฿${fmt(totals.platform - totals.vat)}`, sub: "ค่าคอมมิชชัน", color: "border-blue-500" },
                        { label: "Transaction Fees", value: `฿${fmt(totals.transaction)}`, sub: "ค่าธรรมเนียม", color: "border-violet-500" },
                        { label: "Restaurant Payout", value: `฿${fmt(totals.restaurant)}`, sub: `จ่ายแล้ว ${totals.paid}/${totals.count}`, color: "border-emerald-500" },
                    ].map(card => (
                        <div key={card.label} className={`bg-white rounded-xl border-l-4 ${card.color} shadow-sm px-5 py-4`}>
                            <p className="text-xs font-medium text-slate-500 mb-1">{card.label}</p>
                            <p className="text-xl font-bold text-slate-900 tabular-nums">{card.value}</p>
                            <p className="text-xs text-slate-400 mt-0.5">{card.sub}</p>
                        </div>
                    ))}
                </div>

                {/* Filters */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-4 space-y-3">
                    {/* Time filter row */}
                    <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide shrink-0">ช่วงเวลา</span>
                        <div className="flex gap-2 flex-wrap">
                            {timeLabels.map(({ key, label }) => (
                                <button
                                    key={key}
                                    onClick={() => setTimeFilter(key)}
                                    className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${timeFilter === key
                                        ? "bg-slate-900 text-white"
                                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                        }`}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="border-t border-slate-100" />

                    {/* Search + status filter row */}
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-1">
                            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                            </svg>
                            <input
                                type="text"
                                placeholder="ค้นหา Order ID, ร้านอาหาร, Payout ID..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-300 bg-slate-50"
                            />
                        </div>
                        <div className="flex gap-2">
                            {(["all", "paid", "pending"] as StatusFilter[]).map(s => (
                                <button
                                    key={s}
                                    onClick={() => setFilterStatus(s)}
                                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${filterStatus === s
                                        ? "bg-slate-900 text-white"
                                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                        }`}
                                >
                                    {s === "all" ? "ทั้งหมด" : s === "paid" ? "จ่ายแล้ว" : "รอดำเนินการ"}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Table */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    {isLoading ? (
                        <div className="flex items-center justify-center h-64">
                            <div className="flex flex-col items-center gap-3">
                                <div className="w-8 h-8 border-2 border-slate-300 border-t-slate-800 rounded-full animate-spin" />
                                <LoadingPage />
                            </div>
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="flex items-center justify-center h-64 text-slate-400 text-sm">ไม่พบรายการ</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200">
                                        {cols.map(col => (
                                            <th
                                                key={col.key}
                                                onClick={() => handleSort(col.key)}
                                                className={`px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer select-none hover:text-slate-800 transition-colors whitespace-nowrap ${col.align === "right" ? "text-right" : "text-left"}`}
                                            >
                                                {col.label}
                                                <SortIcon active={sortKey === col.key} dir={sortDir} />
                                            </th>
                                        ))}
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">อัพเดทสถานะ</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">รายละเอียด</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filtered.map((payout) => {
                                        const isExpanded = expandedId === payout.payoutId;
                                        const isToggling = togglingId === payout.payoutId;

                                        return (
                                            <React.Fragment key={payout.payoutId}>
                                                <tr className={`hover:bg-slate-50 transition-colors ${isExpanded ? "bg-slate-50" : ""}`}>
                                                    <td className="px-4 py-3 font-mono text-xs text-slate-500">
                                                        {payout.orderId.substring(0, 8)}...
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <p className="font-medium text-right text-slate-800 font-noto-thai text-bold">{payout.restaurantName}</p>
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-semibold text-slate-800 tabular-nums">฿{fmt(payout.grossAmount)}</td>
                                                    <td className="px-4 py-3 text-right text-blue-600 tabular-nums">฿{fmt(Number(payout.platformFee))}</td>
                                                    <td className="px-4 py-3 text-right text-violet-600 tabular-nums">฿{fmt(Number(payout.transactionFee))}</td>
                                                    <td className="px-4 py-3 text-right text-orange-500 tabular-nums">฿{fmt(Number(payout.vat))}</td>
                                                    <td className="px-4 py-3 text-right text-emerald-600 font-medium tabular-nums">฿{fmt(Number(payout.restaurantRevenue))}</td>
                                                    <td className="px-4 py-3 text-right text-slate-400 tabular-nums">
                                                        ฿{fmt(payout.refundAmount ? Number(payout.refundAmount) : 0)}
                                                    </td>
                                                    <td className="px-4 py-3 text-right text-slate-400 tabular-nums">{fmtDate(payout.refundAt)}</td>
                                                    <td className="px-4 py-3"><StatusBadge isPaid={payout.isPaid} /></td>
                                                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{fmtDate(payout.createdAt)}</td>

                                                    {/* isPaid toggle */}
                                                    <td className="px-4 py-3">
                                                        <button
                                                            disabled={isToggling}
                                                            onClick={() => setConfirmToggle({ payoutId: payout.payoutId, currentIsPaid: payout.isPaid })}
                                                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border whitespace-nowrap ${isToggling
                                                                ? "opacity-50 cursor-not-allowed bg-slate-100 border-slate-200 text-slate-400"
                                                                : payout.isPaid
                                                                    ? "bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100"
                                                                    : "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100"
                                                                }`}
                                                        >
                                                            {isToggling ? (
                                                                <span className="w-3 h-3 border border-slate-400 border-t-transparent rounded-full animate-spin" />
                                                            ) : payout.isPaid ? (
                                                                <>
                                                                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                                                                        <path d="M18 6 6 18M6 6l12 12" />
                                                                    </svg>
                                                                    ยกเลิกการจ่าย
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                                                                        <path d="M20 6 9 17l-5-5" />
                                                                    </svg>
                                                                    ยืนยันจ่ายแล้ว
                                                                </>
                                                            )}
                                                        </button>
                                                    </td>

                                                    {/* Expand toggle */}
                                                    <td className="px-4 py-3">
                                                        <button
                                                            onClick={() => setExpandedId(isExpanded ? null : payout.payoutId)}
                                                            className="text-slate-400 hover:text-slate-700 transition-colors"
                                                        >
                                                            <svg className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                                                <path d="m6 9 6 6 6-6" />
                                                            </svg>
                                                        </button>
                                                    </td>
                                                </tr>

                                                {isExpanded && (
                                                    <tr className="bg-slate-50">
                                                        <td colSpan={11} className="px-6 py-4">
                                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                                                <div>
                                                                    <p className="text-xs text-slate-400 mb-1">Payout ID</p>
                                                                    <p className="font-mono text-xs text-slate-600 break-all">{payout.payoutId}</p>
                                                                </div>
                                                                <div>
                                                                    <p className="text-xs text-slate-400 mb-1">Order ID</p>
                                                                    <p className="font-mono text-xs text-slate-600 break-all">{payout.orderId}</p>
                                                                </div>
                                                                <div>
                                                                    <p className="text-xs text-slate-400 mb-1">ช่วงเวลา</p>
                                                                    <p className="text-slate-600">{fmtDate(payout.startDate)} → {fmtDate(payout.endDate)}</p>
                                                                </div>
                                                                <div>
                                                                    <p className="text-xs text-slate-400 mb-1">จ่ายเมื่อ</p>
                                                                    <p className="text-slate-600">{payout.paidAt ? fmtDateTime(payout.paidAt) : "—"}</p>
                                                                </div>

                                                                <div className="col-span-2 md:col-span-4">
                                                                    <p className="text-xs text-slate-400 mb-2">การกระจายรายได้</p>
                                                                    <div className="flex rounded-lg overflow-hidden h-6 text-xs font-medium">
                                                                        <div
                                                                            style={{ width: `${(Number(payout.restaurantRevenue) / payout.grossAmount) * 100}%` }}
                                                                            className="bg-emerald-400 flex items-center justify-center text-white"
                                                                        >
                                                                            {((Number(payout.restaurantRevenue) / payout.grossAmount) * 100).toFixed(0)}%
                                                                        </div>
                                                                        <div
                                                                            style={{ width: `${(Number(payout.platformFee) / payout.grossAmount) * 100}%` }}
                                                                            className="bg-blue-400 flex items-center justify-center text-white"
                                                                        >
                                                                            {((Number(payout.platformFee) / payout.grossAmount) * 100).toFixed(0)}%
                                                                        </div>
                                                                        <div
                                                                            style={{ width: `${(Number(payout.transactionFee) / payout.grossAmount) * 100}%` }}
                                                                            className="bg-violet-400 flex items-center justify-center text-white"
                                                                        >
                                                                            {((Number(payout.transactionFee) / payout.grossAmount) * 100).toFixed(0)}%
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex gap-4 mt-1.5">
                                                                        <span className="flex items-center gap-1 text-xs text-slate-500"><span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />ร้านอาหาร</span>
                                                                        <span className="flex items-center gap-1 text-xs text-slate-500"><span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />Platform</span>
                                                                        <span className="flex items-center gap-1 text-xs text-slate-500"><span className="w-2 h-2 rounded-full bg-violet-400 inline-block" />Transaction</span>
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
                                    <tr className="bg-slate-100 border-t-2 border-slate-200 font-semibold">
                                        <td className="px-4 py-3 text-xs text-slate-500 uppercase tracking-wide" colSpan={2}>
                                            รวม ({filtered.length} รายการ)
                                        </td>
                                        <td className="px-4 py-3 text-right text-slate-800 tabular-nums">
                                            ฿{fmt(filtered.reduce((s, p) => s + Number(p.grossAmount), 0))}
                                        </td>
                                        <td className="px-4 py-3 text-right text-blue-600 tabular-nums">
                                            ฿{fmt(filtered.reduce((s, p) => s + Number(p.platformFee), 0))}
                                        </td>
                                        <td className="px-4 py-3 text-right text-violet-600 tabular-nums">
                                            ฿{fmt(filtered.reduce((s, p) => s + Number(p.transactionFee), 0))}
                                        </td>
                                        <td className="px-4 py-3 text-right text-orange-500 tabular-nums">
                                            ฿{fmt(filtered.reduce((s, p) => s + Number(p.vat), 0))}
                                        </td>
                                        <td className="px-4 py-3 text-right text-emerald-600 tabular-nums">
                                            ฿{fmt(filtered.reduce((s, p) => s + Number(p.restaurantRevenue), 0))}
                                        </td>
                                        <td className="px-4 py-3 text-right text-slate-400">฿0.00</td>
                                        <td colSpan={4} />
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )}
                </div>

                <p className="text-sm font-noto-thai text-center text-slate-500">
                    รายการทางการเงินเป็นข้อมูลทางการเงินที่เป็นความลับ ห้ามเผยแพร่
                </p>
            </div>
        </div>
    );
}
