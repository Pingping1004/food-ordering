import clsx from "clsx";
import { Icon, type IconName } from "@/components/ui/kit";
import type { KpiValue } from "@/lib/schema";

/** n < 5 is suppressed server-side (plan §6.3): `null` renders as a plain-language placeholder, never as 0. */
export const NO_DATA = "ไม่มีข้อมูลพอ";

export function KpiCard({ label, value, unit, delta, progress }: Readonly<{ label: string; value: string | null; unit?: string; delta: Pick<KpiValue, "deltaLabel" | "good" | "direction">; progress?: { percent: number | null; label: string } }>) {
    return (
        <div className="flex flex-col gap-2 rounded-[18px] border border-line-soft bg-white p-5">
            <span className="text-sm font-medium text-brand-muted">{label}</span>
            {value === null ? (
                <span className="text-lg font-bold leading-tight text-brand-muted">{NO_DATA}</span>
            ) : (
                <span className="text-[32px] font-bold leading-[1.1]">
                    {value}
                    {unit && <span className="text-base font-semibold text-brand-muted">{unit}</span>}
                </span>
            )}
            <span className={clsx("inline-flex items-center gap-1 text-[13px] font-semibold", delta.good ? "text-success-main" : "text-danger-text")}>
                <Icon name={delta.direction === "up" ? "arrowUp" : "arrowDown"} size={14} strokeWidth={2.6} />
                {delta.deltaLabel}
            </span>
            {progress && (
                <div className="mt-1 flex flex-col gap-1.5">
                    <span
                        role="progressbar"
                        aria-label={progress.label}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={progress.percent ?? undefined}
                        className="h-2.5 overflow-hidden rounded-full bg-row-line"
                    >
                        <span className="block h-full rounded-full bg-primary-main" style={{ width: `${progress.percent ?? 0}%` }} />
                    </span>
                    <span className="text-[13px] text-brand-muted">{progress.label}</span>
                </div>
            )}
        </div>
    );
}

export function DayBars({ data }: Readonly<{ data: { label: string; count: number }[] }>) {
    const max = Math.max(1, ...data.map((d) => d.count));
    return (
        <div>
            <div
                role="img"
                aria-label={`ออเดอร์รายวัน ${data.map((d) => `${d.label} ${d.count}`).join(" ")}`}
                className="flex h-[220px] items-end gap-3 border-b border-line-soft sm:gap-4"
            >
                {data.map((d) => (
                    <span key={d.label} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
                        <span className="text-sm font-bold">{d.count}</span>
                        <span className={clsx("w-full max-w-[72px] rounded-t-lg", d.count === max ? "bg-brand-orange" : "bg-primary-main")} style={{ height: `${Math.round((d.count / max) * 82)}%` }} />
                    </span>
                ))}
            </div>
            <div className="mt-2 flex gap-3 sm:gap-4">
                {data.map((d) => <span key={d.label} className="flex-1 text-center text-sm text-brand-muted">{d.label}</span>)}
            </div>
        </div>
    );
}

const shade = (n: number) => (n >= 60 ? "bg-primary-dark text-white" : n >= 40 ? "bg-primary-main text-white" : n >= 20 ? "bg-primary-border text-brand-dark" : "bg-primary-light text-brand-dark");

/** Numbers are printed inside every cell – colour depth is a hint, not the only signal. */
export function Heatmap({ slots, rows }: Readonly<{ slots: string[]; rows: { day: string; cells: number[]; total?: number }[] }>) {
    return (
        <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-separate border-spacing-1.5 text-sm">
                <thead>
                    <tr>
                        <th scope="col" className="w-[72px] text-left font-semibold text-brand-muted"><span className="sr-only-x">วัน</span></th>
                        {slots.map((s) => <th key={s} scope="col" className="font-semibold text-brand-muted">{s}</th>)}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((r) => (
                        <tr key={r.day}>
                            <th scope="row" className="text-left font-semibold">{r.day}</th>
                            {r.cells.map((n, i) => {
                                const total = r.total ?? r.cells.reduce((a, b) => a + b, 0);
                                const pct = total > 0 ? Math.round((n / total) * 100) : 0;
                                return (
                                    <td key={i} title={`${slots[i]} · ${n} ออเดอร์ (${pct}% ของออเดอร์ทั้งวัน)`} className={clsx("h-12 rounded-lg text-center font-bold leading-tight", shade(n))}>
                                        {n}
                                        <span className="block text-[11px] font-semibold opacity-90">({pct}%)</span>
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

const RELIABILITY_ICONS: Record<string, IconName> = {
    "ยกเลิกโดยร้าน": "x",
    "ร้านไม่กดรับทันเวลา": "clock",
    "ทำเสร็จช้ากว่าที่แจ้ง": "alert",
    "ตรวจสลิปไม่ผ่าน": "file",
    "ออเดอร์ซ้ำ": "clipboard",
};

export const reliabilityIcon = (label: string): IconName => RELIABILITY_ICONS[label] ?? "shield";
