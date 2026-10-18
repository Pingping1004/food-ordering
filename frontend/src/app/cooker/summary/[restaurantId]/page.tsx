"use client";

import { use, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { SalesTrendCard } from "@/components/cookers/SalesTrendCard";
import { CookerShell } from "@/components/cookers/CookerShell";
import { Card, CookerSummarySkeleton, EmptyState, ErrorState } from "@/components/ui/kit";
import { getOrderHistory, summarizeOrders, topMenus, type SummaryRange, type TopMetric } from "@/lib/services/cooker";
import { ORDER_STATUS, formatBaht, orderCode } from "@/lib/schema/format";
import type { Order } from "@/lib/schema";

const today = () => new Date().toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "short", timeZone: "Asia/Bangkok" });

const RANGES: { value: SummaryRange; label: string; title: string; sales: string; top: string }[] = [
    { value: "today", label: "วันนี้", title: "สรุปวันนี้", sales: "ยอดขายวันนี้", top: "ขายดีวันนี้" },
    { value: "week", label: "สัปดาห์นี้", title: "สรุปสัปดาห์นี้", sales: "ยอดขายสัปดาห์นี้", top: "ขายดีสัปดาห์นี้" },
    { value: "month", label: "เดือนนี้", title: "สรุปเดือนนี้", sales: "ยอดขายเดือนนี้", top: "ขายดีเดือนนี้" },
    { value: "3months", label: "3 เดือน", title: "สรุป 3 เดือนล่าสุด", sales: "ยอดขาย 3 เดือนล่าสุด", top: "ขายดีใน 3 เดือน" },
    { value: "year", label: "1 ปี", title: "สรุป 1 ปีล่าสุด", sales: "ยอดขาย 1 ปีล่าสุด", top: "ขายดีใน 1 ปี" },
    { value: "all", label: "ทั้งหมด", title: "สรุปทั้งหมด", sales: "ยอดขายทั้งหมด", top: "ขายดีตลอดกาล" },
];

type Category = "all" | "done" | "cancelled" | "delayed";
/** Same definitions as `summarizeOrders`, so a card's number equals the length of its list. */
const CATEGORY_MATCH: Record<Category, (o: Order) => boolean> = {
    all: () => true,
    done: (o) => o.status === "done",
    cancelled: (o) => o.status === "rejected" || o.paymentStatus === "CANCELLED",
    delayed: (o) => o.isDelay,
};
const CATEGORY_LABEL: Record<Category, string> = { all: "ออเดอร์ทั้งหมด", done: "ทำเสร็จ", cancelled: "ยกเลิก", delayed: "แจ้งช้า" };

const PAGE = 30;

const fmtWhen = (iso: string) => new Date(iso).toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" });

export default function CookerSummaryPage({ params }: Readonly<{ params: Promise<{ restaurantId: string }> }>) {
    const { restaurantId } = use(params);
    const [range, setRange] = useState<SummaryRange>("today");
    const [search, setSearch] = useState("");
    const [topMetric, setTopMetric] = useState<TopMetric>("qty");
    const [topLimit, setTopLimit] = useState(5);
    const [category, setCategory] = useState<Category | null>(null);
    const [visible, setVisible] = useState(PAGE);
    const listRef = useRef<HTMLDivElement>(null);
    const R = RANGES.find((r) => r.value === range) ?? RANGES[0];
    const { data, isLoading, isError, refetch } = useQuery({
        queryKey: ["cooker-summary", restaurantId, range],
        queryFn: () => getOrderHistory(restaurantId, range),
        refetchInterval: 60_000,
    });

    // Category card + search combine: search narrows within the chosen category. Matches the full order id or the short code (e.g. "A1B2").
    const listed = useMemo(() => {
        if (!data) return [];
        const q = search.trim().toLowerCase().replace(/^#/, "");
        return data.filter((o) => (!category || CATEGORY_MATCH[category](o)) && (!q || o.orderId.toLowerCase().includes(q) || orderCode(o.orderId).toLowerCase().includes(q)));
    }, [data, category, search]);

    useEffect(() => setVisible(PAGE), [range, category, search]);

    const s = useMemo(() => (data ? summarizeOrders(data) : null), [data]);
    const top = useMemo(() => (data ? topMenus(data, topMetric, topLimit) : []), [data, topMetric, topLimit]);
    const maxTop = Math.max(1, ...top.map((t) => t[topMetric]));
    const maxSlot = Math.max(1, ...(s?.hourly.map((h) => h.count) ?? [1]));

    const stats = s && [
        { key: "all" as Category, label: "ออเดอร์ทั้งหมด", value: s.total, fg: "text-brand-dark" },
        { key: "done" as Category, label: "ทำเสร็จ", value: s.done, fg: "text-success-main" },
        { key: "cancelled" as Category, label: "ยกเลิก", value: s.cancelled, fg: "text-danger-text" },
        { key: "delayed" as Category, label: "แจ้งช้า", value: s.delayed, fg: "text-brand-orange-text" },
    ];

    return (
        <CookerShell restaurantId={restaurantId} active="summary">
            <header className="flex items-end justify-between gap-3 border-line-soft bg-white p-5">
                <div className="flex flex-col gap-1">
                    <span className="text-base text-brand-muted">{today()}</span>
                    <h1 className="text-[28px] font-bold">{R.title}</h1>
                </div>
            </header>

            <div className="flex flex-col gap-3 border-b border-line-soft bg-white px-5 pb-4">
                <div role="radiogroup" aria-label="ช่วงเวลา" className="flex flex-wrap gap-2">
                    {RANGES.map((r) => (
                        <button key={r.value} type="button" role="radio" aria-checked={range === r.value} onClick={() => setRange(r.value)}
                            className={`h-11 rounded-xl px-4 text-[15px] font-semibold ${range === r.value ? "border-2 border-primary-main bg-ground-blue text-primary-dark" : "border-[1.5px] border-line bg-white"}`}>
                            {r.label}
                        </button>
                    ))}
                </div>
            </div>

            <main className="flex flex-col gap-4 p-5">
                {isLoading && <CookerSummarySkeleton />}
                {isError && <ErrorState onRetry={() => refetch()} />}
                {s && s.total === 0 && <EmptyState title="ยังไม่มีออเดอร์ในช่วงนี้" body="เมื่อมีออเดอร์ สรุปยอดขายจะแสดงที่นี่" />}

                {s && s.total > 0 && (
                    <>
                        <section className="flex flex-col gap-1.5 rounded-3xl bg-primary-main p-6 text-white">
                            <span className="text-lg opacity-95">{R.sales}</span>
                            <span className="text-[44px] font-bold leading-[1.1] md:text-[48px]">{formatBaht(s.revenue)} <span className="text-2xl">บาท</span></span>
                            <span className="text-[15px] opacity-95">นับเฉพาะออเดอร์ที่จ่ายแล้วและไม่ถูกปฏิเสธ</span>
                        </section>

                        {range !== "all" && <SalesTrendCard restaurantId={restaurantId} range={range} />}

                        <div className="grid gap-4 lg:grid-cols-2">
                            <Card className="flex flex-col gap-3.5 !rounded-[20px] p-5">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <h2 className="text-[21px] font-bold">{R.top}</h2>
                                    <select aria-label="จำนวนเมนูที่แสดง" value={topLimit} onChange={(e) => setTopLimit(Number(e.target.value))} className="h-9 rounded-lg border border-line bg-white px-2 text-sm font-semibold">
                                        {[3, 4, 5].map((n) => <option key={n} value={n}>Top {n}</option>)}
                                    </select>
                                </div>
                                <div role="radiogroup" aria-label="เรียงตาม" className="flex gap-2">
                                    {([["qty", "จำนวนจาน"], ["revenue", "ยอดขาย"]] as const).map(([v, label]) => (
                                        <button key={v} type="button" role="radio" aria-checked={topMetric === v} onClick={() => setTopMetric(v)}
                                            className={`h-10 flex-1 rounded-xl text-sm font-semibold ${topMetric === v ? "border-2 border-primary-main bg-ground-blue text-primary-dark" : "border-[1.5px] border-line bg-white"}`}>{label}</button>
                                    ))}
                                </div>
                                {top.length === 0 ? <p className="text-base text-brand-muted">ยังไม่มีออเดอร์ที่จ่ายแล้ว</p> : (
                                    <ol className="flex flex-col gap-3.5">
                                        {top.map((t, i) => (
                                            <li key={t.menuId} className="flex flex-col gap-1.5">
                                                <span className="flex justify-between gap-3 text-[19px]">
                                                    <span><span className="text-brand-muted">{i + 1}.</span> {t.name}</span>
                                                    <span className="shrink-0 text-right font-bold">
                                                        {topMetric === "qty" ? `${t.qty} จาน` : `฿${formatBaht(t.revenue)}`}
                                                        <span className="block text-[13px] font-normal text-brand-muted">{topMetric === "qty" ? `฿${formatBaht(t.revenue)}` : `${t.qty} จาน`}</span>
                                                    </span>
                                                </span>
                                                <span className="h-3 overflow-hidden rounded-full bg-row-line"><span className="block h-full rounded-full bg-primary-main" style={{ width: `${Math.round((t[topMetric] / maxTop) * 100)}%` }} /></span>
                                            </li>
                                        ))}
                                    </ol>
                                )}
                            </Card>

                            <Card className="flex flex-col gap-3.5 !rounded-[20px] p-5">
                                <h2 className="text-[21px] font-bold">ช่วงที่ยุ่งที่สุด</h2>
                                <div role="img" aria-label={`ออเดอร์ตามช่วงเวลา ${s.hourly.map((h) => `${h.label} ${h.count}`).join(" ")}`} className="flex h-[120px] items-end gap-2">
                                    {s.hourly.map((h) => (
                                        <span key={h.label} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
                                            <span className="text-sm font-bold">{h.count}</span>
                                            <span className={`w-full rounded-t-lg rounded-b ${h.count === maxSlot ? "bg-brand-orange" : "bg-primary-border"}`} style={{ height: `${Math.max(6, Math.round((h.count / maxSlot) * 75))}%` }} />
                                        </span>
                                    ))}
                                </div>
                                <div className="flex gap-2">
                                    {s.hourly.map((h) => <span key={h.label} className="flex-1 text-center text-[13px] text-brand-muted">{h.label}</span>)}
                                </div>
                                {s.peakLabel && <p className="text-[17px] leading-normal">ออเดอร์มากที่สุด <b>{s.peakLabel}</b></p>}
                            </Card>
                        </div>

                        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
                            {stats?.map((x) => (
                                <button key={x.label} type="button" aria-pressed={category === x.key} onClick={() => { const next = category === x.key ? null : x.key; setCategory(next); if (next) requestAnimationFrame(() => listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })); }}
                                    className={`flex flex-col items-start gap-1.5 rounded-[20px] bg-white p-[18px] text-left ${category === x.key ? "border-2 border-primary-main" : "border border-line-soft hover:bg-ground"}`}>
                                    <span className="text-[17px] text-brand-muted">{x.label}</span>
                                    <span className={`text-[34px] font-bold leading-[1.1] ${x.fg}`}>{x.value}</span>
                                </button>
                            ))}
                        </section>

                        <div ref={listRef} className="scroll-mt-4">
                            <Card className="flex flex-col gap-3 !rounded-[20px] p-5">
                                <div className="flex items-center justify-between gap-3">
                                    <h2 className="text-[21px] font-bold">{category ? CATEGORY_LABEL[category] : "ออเดอร์ทั้งหมด"} ({listed.length})</h2>
                                    {category && <button type="button" onClick={() => setCategory(null)} className="text-sm font-semibold text-primary-dark underline">ล้างตัวกรอง</button>}
                                </div>
                                <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="ค้นหาออเดอร์" placeholder="ค้นหาออเดอร์ด้วยเลขออเดอร์ (เช่น A1B2)"
                                    className="h-12 w-full rounded-xl border-[1.5px] border-line bg-white px-4 text-base outline-none focus:border-primary-main" />
                                {listed.length === 0 && <p className="text-base text-brand-muted">ไม่พบออเดอร์{search.trim() ? "ที่ตรงกับคำค้นหา" : "ในหมวดนี้"} ลองเลือกช่วงเวลาที่กว้างขึ้น</p>}
                                {listed.slice(0, visible).map((o) => (
                                    <div key={o.orderId} className="flex flex-col gap-1 rounded-xl border border-line-soft p-3.5">
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <span className="text-xl font-bold uppercase tracking-wide">{orderCode(o.orderId)}</span>
                                            <span className="text-sm font-semibold">{ORDER_STATUS[o.status]?.label ?? o.status} · {formatBaht(o.totalAmount)} บาท</span>
                                        </div>
                                        <span className="text-[15px]">{o.orderMenus.map((m) => `${m.quantity} × ${m.menuName}`).join(" · ")}</span>
                                        <span className="text-[13px] text-brand-muted">สั่งเมื่อ {fmtWhen(o.orderAt)} · {o.orderId}</span>
                                    </div>
                                ))}
                                {listed.length > visible && (
                                    <button type="button" onClick={() => setVisible((v) => v + PAGE)} className="h-11 rounded-xl border-[1.5px] border-line text-[15px] font-semibold hover:bg-ground">แสดงเพิ่ม ({listed.length - visible} รายการ)</button>
                                )}
                                {(data?.length ?? 0) >= 5000 && <p className="text-sm text-brand-muted">แสดงเฉพาะ 5,000 ออเดอร์ล่าสุดของช่วงนี้</p>}
                            </Card>
                        </div>

                    </>
                )}
            </main>
        </CookerShell>
    );
}
