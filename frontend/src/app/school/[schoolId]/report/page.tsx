"use client";

import { use, useState } from "react";
import { Icon, Logo, Skeleton, ErrorState } from "@/components/ui/kit";
import { SchoolPageHeader, SchoolShell } from "@/components/school/SchoolShell";
import { NO_DATA } from "@/components/school/dashboard";
import { useSchoolSummary } from "@/hook/useSchool";
import type { SummaryRange } from "@/lib/schema";

const REPORT_RANGES: { value: SummaryRange; label: string; title: string; prev: string }[] = [
    { value: "this_week", label: "สัปดาห์นี้", title: "รายงานประจำสัปดาห์", prev: "สัปดาห์ก่อน" },
    { value: "this_month", label: "เดือนนี้", title: "รายงานประจำเดือน", prev: "เดือนก่อน" },
    { value: "this_semester", label: "ภาคเรียนนี้ (พ.ค.–ก.ย. / พ.ย.–ก.พ.)", title: "รายงานประจำภาคเรียน", prev: "ภาคเรียนก่อน" },
];

/** dd/mm/yy in the Buddhist era, e.g. 15/10/69. */
const stamp = (d = new Date()) => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${String((d.getFullYear() + 543) % 100).padStart(2, "0")}`;

const fmt = (n: number | null, d = 0) => (n === null ? NO_DATA : n.toLocaleString("th-TH", { maximumFractionDigits: d }));

/**
 * Report (week / month / semester) = a frozen snapshot (schema plan: WeeklyReport). Rendered as an A4 sheet; the browser's
 * "Save as PDF" is the export for now, `.no-print` hides the app chrome.
 */
export default function SchoolReportPage({ params }: Readonly<{ params: Promise<{ schoolId: string }> }>) {
    const { schoolId } = use(params);
    const [range, setRange] = useState<SummaryRange>("this_week");
    const cfg = REPORT_RANGES.find((r) => r.value === range) ?? REPORT_RANGES[0];
    const { data: s, isLoading, isError, refetch } = useSchoolSummary(schoolId, range);
    const max = Math.max(1, ...(s?.ordersByDay.map((d) => d.count) ?? [1]));
    const k = s?.kpis;

    // "Save as PDF" names the file after document.title
    const print = () => {
        const prev = document.title;
        document.title = `${cfg.title}-${stamp()}`;
        window.addEventListener("afterprint", () => { document.title = prev; }, { once: true });
        window.print();
    };

    const kpis = k && [
        { label: "ออเดอร์ทั้งหมด", value: fmt(k.totalOrders.value), delta: k.totalOrders.deltaLabel },
        { label: "นักเรียนที่ใช้งาน", value: k.activeStudents.percentOfEnrolled == null ? NO_DATA : `${k.activeStudents.percentOfEnrolled}%`, delta: "ของนักเรียนทั้งหมด" },
        { label: "ออเดอร์สำเร็จ", value: k.successRate.value == null ? NO_DATA : `${fmt(k.successRate.value, 1)}%`, delta: k.successRate.deltaLabel },
        { label: "ร้านกดรับภายใน", value: k.medianAcceptSeconds.value == null ? NO_DATA : `${fmt(k.medianAcceptSeconds.value)} วิ`, delta: k.medianAcceptSeconds.deltaLabel },
        { label: "ความพึงพอใจ", value: k.rating.value == null ? NO_DATA : `${fmt(k.rating.value, 1)} / 5`, delta: `จาก ${k.rating.responses} ความเห็น` },
        { label: "ส่งมอบตรงเวลา", value: k.onTime.value == null ? NO_DATA : `${fmt(k.onTime.value, 1)}%`, delta: k.onTime.deltaLabel },
    ];

    return (
        <SchoolShell schoolId={schoolId} active="report">
            <div className="flex flex-col gap-6">
                <div className="no-print">
                    <SchoolPageHeader
                        title={cfg.title}
                        eyebrow={s && <>ตัวอย่างรายงานที่จะส่งให้ผู้ดูแล</>}
                        actions={
                            <>
                            <label className="flex h-11 items-center gap-2 rounded-xl border border-line bg-white px-3.5 text-[15px]">
                                <Icon name="calendar" size={18} />
                                <select aria-label="ช่วงเวลา" value={range} onChange={(e) => setRange(e.target.value as SummaryRange)} className="bg-transparent font-app text-[15px] font-semibold outline-none">
                                    {REPORT_RANGES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                                </select>
                            </label>
                            <button type="button" onClick={print} className="flex h-11 items-center gap-2 rounded-xl bg-primary-main px-[18px] text-[15px] font-semibold text-white hover:bg-primary-dark">
                                <Icon name="print" size={18} />
                                พิมพ์ / บันทึกเป็น PDF
                            </button>
                            </>
                        }
                    />
                </div>

                {isLoading && (
                    <article className="mx-auto flex w-full max-w-[794px] flex-col gap-6 border border-line-soft bg-white px-5 py-8 shadow-sm sm:px-[60px] sm:py-14" style={{ minHeight: 800 }}>
                        <div className="flex flex-wrap items-start justify-between gap-3 border-b-[3px] border-line-soft pb-[18px]">
                            <div className="flex flex-col gap-2">
                                <Skeleton className="h-4 w-44 rounded" />
                                <Skeleton className="h-8 w-72 rounded-lg" />
                                <Skeleton className="h-4 w-52 rounded" />
                            </div>
                            <Skeleton className="h-7 w-24 rounded-full" />
                        </div>
                        <div className="flex flex-col gap-3">
                            <Skeleton className="h-5 w-48 rounded" />
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                                {Array.from({ length: 6 }).map((_, i) => (
                                    <div key={i} className="flex flex-col gap-2 rounded-2xl border border-line-soft p-4">
                                        <Skeleton className="h-4 w-24 rounded" />
                                        <Skeleton className="h-8 w-20 rounded-md" />
                                        <Skeleton className="h-3.5 w-16 rounded" />
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="flex flex-col gap-3 pt-4">
                            <Skeleton className="h-5 w-40 rounded" />
                            <Skeleton className="h-48 w-full rounded-2xl" />
                        </div>
                    </article>
                )}
                {isError && <ErrorState onRetry={() => refetch()} />}

                {s && kpis && (
                    <article className="mx-auto flex w-full max-w-[794px] flex-col gap-6 border border-line-soft bg-white px-5 py-8 shadow-sm sm:px-[60px] sm:py-14 print:max-w-none print:border-0 print:p-0 print:shadow-none" style={{ minHeight: 1123 }}>
                        <header className="flex flex-wrap items-start justify-between gap-3 border-b-[3px] border-primary-main pb-[18px]">
                            <div className="flex items-center gap-3.5">
                                <Logo size={44} />
                                <div className="flex flex-col gap-1">
                                    <span className="text-sm font-bold tracking-wider text-primary-dark">PROMPTSERVE · รายงานช่วงทดลองใช้</span>
                                    <h1 className="text-[26px] font-bold leading-snug sm:text-[28px]">โรงอาหารกลาง · {cfg.title.replace("รายงานประจำ", "")}</h1>
                                    <span className="text-base text-brand-muted">{s.weekLabel} · จัดทำ {new Date().toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })}</span>
                                </div>
                            </div>
                           
                        </header>

                        <section className="flex flex-col gap-2">
                            <h2 className="text-lg font-bold">สรุปสั้น</h2>
                            <p className="text-base leading-[1.7]">{`[สรุป 2–3 ประโยคที่ทีม PromptServe เขียนก่อนส่ง เช่น จำนวนการใช้งานเทียบ${cfg.prev} ปัญหาที่พบ และสิ่งที่แก้ไขแล้ว]`}</p>
                        </section>

                        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                            {kpis.map((x) => (
                                <div key={x.label} className="flex flex-col gap-1 rounded-xl border border-line-soft px-4 py-3.5">
                                    <span className="text-[13px] text-brand-muted">{x.label}</span>
                                    <span className="text-2xl font-bold leading-tight">{x.value}</span>
                                    <span className="text-[13px] text-slate">{x.delta}</span>
                                </div>
                            ))}
                        </section>

                        <section className="flex flex-col gap-2.5">
                            <h2 className="text-lg font-bold">ออเดอร์รายวัน</h2>
                            {s.ordersByDay.map((d) => (
                                <div key={d.label} className="flex items-center gap-3 text-[15px]">
                                    <span className="w-14 shrink-0 sm:w-[72px]">{d.label}</span>
                                    <span className="h-[18px] flex-1 overflow-hidden rounded bg-row-line"><span className="block h-full bg-primary-main" style={{ width: `${Math.round((d.count / max) * 100)}%` }} /></span>
                                    <span className="w-11 text-right font-bold">{d.count}</span>
                                </div>
                            ))}
                        </section>

                        <div className="grid gap-5 sm:grid-cols-2">
                            <section className="flex flex-col gap-2">
                                <h2 className="text-lg font-bold">สิ่งที่เป็นไปด้วยดี</h2>
                                <ul className="list-disc space-y-1 pl-5 text-[15px] leading-[1.7]"><li>[ไฮไลต์ที่วัดได้จริง]</li><li>[ไฮไลต์ที่วัดได้จริง]</li></ul>
                            </section>
                            <section className="flex flex-col gap-2">
                                <h2 className="text-lg font-bold">ปัญหา &amp; การแก้ไข</h2>
                                <ul className="list-disc space-y-1 pl-5 text-[15px] leading-[1.7]"><li>[ปัญหาที่พบ → สิ่งที่แก้แล้ว]</li><li>[ปัญหาที่พบ → แผนช่วงถัดไป]</li></ul>
                            </section>
                        </div>

                        <footer className="mt-auto flex flex-col gap-1.5 border-t border-line-soft pt-3.5">
                            <h2 className="text-sm font-bold">คำอธิบายตัวชี้วัด</h2>
                            <p className="text-xs leading-[1.7] text-slate">
                                ออเดอร์สำเร็จ = เสร็จสิ้น ÷ (เสร็จสิ้น + ยกเลิก + ปฏิเสธ + หมดเวลา) · ร้านกดรับภายใน = ค่ากลางของเวลาตั้งแต่สั่งจนร้านกดรับ · นักเรียนที่ใช้งาน = จำนวนบัญชีที่สั่งอย่างน้อย 1 ครั้ง ÷ จำนวนนักเรียนทั้งหมด · ส่งมอบตรงเวลา = ออเดอร์ที่เสร็จสิ้นโดยร้านไม่แจ้งล่าช้า ÷ ออเดอร์ที่เสร็จสิ้นทั้งหมด · ตัวเลขที่มีข้อมูลน้อยกว่า 5 รายการแสดงเป็น “{NO_DATA}” · รายงานนี้ไม่มีข้อมูลส่วนบุคคลของนักเรียน
                            </p>
                        </footer>
                    </article>
                )}
            </div>
        </SchoolShell>
    );
}
