"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, Skeleton } from "@/components/ui/kit";
import { getSalesTrend, type SalesTrend, type TrendRange } from "@/lib/services/cooker";
import { formatBaht } from "@/lib/schema/format";

const COMPARE_LABEL: Record<TrendRange, { now: string; prev: string }> = {
    today: { now: "วันนี้", prev: "เมื่อวาน" },
    week: { now: "สัปดาห์นี้", prev: "สัปดาห์ที่แล้ว" },
    month: { now: "เดือนนี้", prev: "เดือนที่แล้ว" },
    "3months": { now: "3 เดือนล่าสุด", prev: "3 เดือนก่อนหน้า" },
    year: { now: "1 ปีล่าสุด", prev: "1 ปีก่อนหน้า" },
};

const TZ = "Asia/Bangkok";
const bucketLabel = (iso: string, unit: SalesTrend["unit"]) => {
    const d = new Date(iso);
    if (unit === "hours") return d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
    if (unit === "months") return d.toLocaleDateString("th-TH", { month: "short", year: "2-digit", timeZone: TZ });
    return d.toLocaleDateString("th-TH", { day: "numeric", month: "short", timeZone: TZ });
};

const pctText = (pct: number | null) => (pct === null ? "–" : `${pct > 0 ? "+" : ""}${pct.toLocaleString("th-TH")}%`);
const pctTone = (pct: number | null) => (pct === null || pct === 0 ? "text-brand-muted" : pct > 0 ? "text-success-main" : "text-danger-text");

function Chart({ t }: Readonly<{ t: SalesTrend }>) {
    const W = 640, H = 220, PL = 8, PR = 8, PT = 14, PB = 26;
    const n = t.buckets.length;
    const max = Math.max(1, ...t.buckets.flatMap((b) => [b.current, b.previous]));
    const x = (i: number) => PL + (n <= 1 ? (W - PL - PR) / 2 : (i * (W - PL - PR)) / (n - 1));
    const y = (v: number) => PT + (1 - v / max) * (H - PT - PB);
    const line = (key: "current" | "previous") => t.buckets.map((b, i) => `${x(i)},${y(b[key])}`).join(" ");
    const step = Math.max(1, Math.ceil(n / 6));

    return (
        <svg viewBox={`0 0 ${W} ${H}`} role="img" className="h-auto w-full"
            aria-label={`ยอดขายช่วงนี้ ${t.currentTotal} บาท เทียบช่วงก่อนหน้า ${t.previousTotal} บาท ${pctText(t.revenuePct)}`}>
            <line x1={PL} x2={W - PR} y1={y(0)} y2={y(0)} stroke="currentColor" className="text-line" />
            <text x={PL} y={PT - 3} className="fill-brand-muted text-[11px]">฿{formatBaht(max)}</text>
            <polyline points={line("previous")} fill="none" stroke="#9DB8E8" strokeWidth="2.5" strokeDasharray="6 5" strokeLinejoin="round" />
            <polyline points={line("current")} fill="none" stroke="#006CFE" strokeWidth="3" strokeLinejoin="round" />
            {t.buckets.map((b, i) => <circle key={b.start} cx={x(i)} cy={y(b.current)} r={n > 20 ? 2.5 : 4} fill="#006CFE" />)}
            {t.buckets.map((b, i) => i % step === 0 && (
                <text key={`l${b.start}`} x={x(i)} y={H - 7} textAnchor="middle" className="fill-brand-muted text-[11px]">{bucketLabel(b.start, t.unit)}</text>
            ))}
        </svg>
    );
}

/** Sales vs. the previous period (like-for-like), with a line chart and the per-bucket numbers. */
export function SalesTrendCard({ restaurantId, range }: Readonly<{ restaurantId: string; range: TrendRange }>) {
    const { data: t, isLoading, isError } = useQuery({
        queryKey: ["cooker-trend", restaurantId, range],
        queryFn: () => getSalesTrend(restaurantId, range),
        refetchInterval: 60_000,
    });
    const L = COMPARE_LABEL[range];

    return (
        <Card className="flex flex-col gap-4 !rounded-[20px] p-5">
            <div className="flex flex-col gap-1">
                <h2 className="text-[21px] font-bold">แนวโน้มยอดขาย</h2>
                <span className="text-[15px] text-brand-muted">เทียบ{L.now}กับ{L.prev} (ช่วงเวลาเท่ากัน)</span>
            </div>

            {isLoading && <Skeleton className="h-40 w-full rounded-xl" />}
            {isError && <p className="text-sm text-danger-text">โหลดแนวโน้มไม่สำเร็จ</p>}

            {t && (
                <>
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                        <div className="flex flex-col"><span className="text-sm text-brand-muted">{L.now}</span><span className="text-2xl font-bold">฿{formatBaht(t.currentTotal)}</span></div>
                        <div className="flex flex-col"><span className="text-sm text-brand-muted">{L.prev}</span><span className="text-2xl font-bold">฿{formatBaht(t.previousTotal)}</span></div>
                        <div className="flex flex-col"><span className="text-sm text-brand-muted">ยอดขายเปลี่ยนแปลง</span><span className={`text-2xl font-bold ${pctTone(t.revenuePct)}`}>{pctText(t.revenuePct)}</span></div>
                        <div className="flex flex-col"><span className="text-sm text-brand-muted">จำนวนออเดอร์</span><span className="text-2xl font-bold">{t.currentOrders} <span className={`text-base ${pctTone(t.ordersPct)}`}>({pctText(t.ordersPct)})</span></span></div>
                    </div>
                    {t.revenuePct === null && <p className="text-sm text-brand-muted">ช่วงก่อนหน้าไม่มียอดขาย จึงคำนวณเปอร์เซ็นต์ไม่ได้</p>}

                    <Chart t={t} />
                    <div className="flex gap-5 text-sm text-brand-muted">
                        <span className="flex items-center gap-2"><span className="h-1 w-6 rounded bg-primary-main" />{L.now}</span>
                        <span className="flex items-center gap-2"><span className="h-1 w-6 rounded border-t-2 border-dashed border-primary-border" />{L.prev}</span>
                    </div>

                    {(() => {
                        // Real mode: only buckets inside opening hours, plus any outside them that actually had sales.
                        const rows = t.restricted ? t.buckets.filter((b) => b.open || b.current > 0 || b.previous > 0 || b.currentOrders > 0 || b.previousOrders > 0) : t.buckets;
                        const extra = t.restricted ? rows.filter((b) => !b.open).length : 0;
                        return (
                    <details className="rounded-xl border border-line-soft">
                        <summary className="cursor-pointer select-none px-4 py-3 text-[15px] font-semibold">ดูตัวเลขรายช่วง</summary>
                        <div className="max-h-72 overflow-auto px-4 pb-3">
                            {t.restricted && <p className="pb-2 text-[13px] text-brand-muted">แสดงเฉพาะช่วงที่โรงเรียน โรงอาหาร และร้านเปิด{extra > 0 && ` · มี ${extra} ช่วงนอกเวลาเปิดที่มียอดขาย (ทำเครื่องหมาย *)`}</p>}
                            {rows.length === 0 && <p className="py-2 text-sm text-brand-muted">ไม่มีช่วงเวลาเปิดทำการในช่วงนี้</p>}
                            <table className="w-full text-left text-[14px]">
                                <thead className="text-brand-muted"><tr><th className="py-1.5">ช่วง</th><th>{L.now}</th><th>{L.prev}</th><th>เปลี่ยนแปลง</th></tr></thead>
                                <tbody>
                                    {rows.map((b) => {
                                        const pct = b.previous === 0 ? null : Math.round(((b.current - b.previous) / b.previous) * 1000) / 10;
                                        return (
                                            <tr key={b.start} className="border-t border-row-line">
                                                <td className="py-1.5">{bucketLabel(b.start, t.unit)}{t.restricted && !b.open && " *"}</td>
                                                <td>฿{formatBaht(b.current)}</td>
                                                <td>฿{formatBaht(b.previous)}</td>
                                                <td className={`font-semibold ${pctTone(pct)}`}>{pctText(pct)}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </details>
                        );
                    })()}
                </>
            )}
        </Card>
    );
}
