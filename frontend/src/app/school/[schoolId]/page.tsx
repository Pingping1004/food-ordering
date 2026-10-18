"use client";

import { use, useState } from "react";
import Link from "next/link";
import { Card, ErrorState, Icon, SchoolOverviewSkeleton, SectionHeading, TD, TH, TableWrap } from "@/components/ui/kit";
import { Chip } from "@/components/ui/kit";
import { SchoolPageHeader, SchoolShell } from "@/components/school/SchoolShell";
import { DayBars, Heatmap, KpiCard, NO_DATA, reliabilityIcon } from "@/components/school/dashboard";
import { RefundsCard } from "@/components/refunds/RefundsCard";
import { ComplaintsCard } from "@/components/complaints/ComplaintsCard";
import { useSchoolSummary } from "@/hook/useSchool";
import { useAuth } from "@/auth/auth.hooks";
import { userHomePath } from "@/auth/access";
import type { SchoolSummary, SummaryRange } from "@/lib/schema";

const RANGES: { value: SummaryRange; label: string }[] = [
    { value: "this_week", label: "สัปดาห์นี้" },
    { value: "last_week", label: "สัปดาห์ที่แล้ว" },
    { value: "this_month", label: "เดือนนี้" },
    { value: "last_month", label: "เดือนที่แล้ว" },
];

const fmt = (n: number | null, digits = 0) => (n === null ? null : n.toLocaleString("th-TH", { maximumFractionDigits: digits }));

const RANGE_PREV: Record<SummaryRange, string> = {
    this_week: "สัปดาห์ก่อนหน้า", last_week: "สัปดาห์ก่อนหน้า", this_month: "เดือนก่อนหน้า", last_month: "เดือนก่อนหน้า", this_semester: "ภาคเรียนก่อนหน้า",
};

function Revenue({ amount, deltaPct }: Readonly<{ amount: number; deltaPct: number | null }>) {
    const up = (deltaPct ?? 0) >= 0;
    return (
        <span className="flex flex-col">
            <span className="font-semibold">฿{amount.toLocaleString("th-TH")}</span>
            {deltaPct === null ? <span className="text-[13px] text-brand-muted">ไม่มีข้อมูลช่วงก่อน</span> : (
                <span className={`inline-flex items-center gap-0.5 text-[13px] font-semibold ${up ? "text-success-main" : "text-danger-text"}`}>
                    <Icon name={up ? "arrowUp" : "arrowDown"} size={12} strokeWidth={2.6} />{up ? "+" : ""}{deltaPct}%
                </span>
            )}
        </span>
    );
}

const FEEDBACK_VIEWS = [
    { value: "best", label: "ทั้งหมด · ดี → แย่" },
    { value: "worst", label: "ทั้งหมด · แย่ → ดี" },
    { value: "good", label: "เฉพาะความเห็นดี (4–5 ดาว)" },
    { value: "bad", label: "เฉพาะความเห็นแย่ (1–2 ดาว)" },
] as const;

function StarBreakdown({ distribution, responses }: Readonly<{ distribution: { star: number; count: number }[]; responses: number }>) {
    const [view, setView] = useState<(typeof FEEDBACK_VIEWS)[number]["value"]>("best");
    const rows = distribution
        .filter((d) => (view === "good" ? d.star >= 4 : view === "bad" ? d.star <= 2 : true))
        .sort((a, b) => (view === "worst" || view === "bad" ? a.star - b.star : b.star - a.star));
    const max = Math.max(1, ...rows.map((d) => d.count));
    return (
        <div className="flex flex-col gap-2">
            <select aria-label="กรองความเห็น" value={view} onChange={(e) => setView(e.target.value as typeof view)} className="h-9 rounded-lg border border-line bg-white px-2.5 text-sm font-semibold outline-none">
                {FEEDBACK_VIEWS.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
            </select>
            {rows.map((d) => (
                <div key={d.star} className="flex items-center gap-2.5 text-sm">
                    <span className="w-14 shrink-0 font-semibold">{d.star} ดาว</span>
                    <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-row-line"><span className="block h-full bg-brand-orange" style={{ width: `${Math.round((d.count / max) * 100)}%` }} /></span>
                    <span className="w-16 shrink-0 text-right">({d.count.toLocaleString("th-TH")}){responses > 0 ? <span className="text-[12px] text-brand-muted"> {Math.round((d.count / responses) * 100)}%</span> : null}</span>
                </div>
            ))}
        </div>
    );
}

/** Until a school has 5 orders the API returns illustrative figures; say so, so nobody reads them as results. */
function SampleNotice({ s }: Readonly<{ s: SchoolSummary }>) {
    if (!s.isSample) return null;
    return (
        <div role="status" className="rounded-xl border-2 border-brand-orange bg-ground px-4 py-3 text-[15px] font-semibold text-brand-dark">
            ตัวเลขด้านล่างเป็นข้อมูลตัวอย่างเท่านั้น (ยังมีออเดอร์ไม่ถึง 5 รายการ) จะแสดงข้อมูลจริงเมื่อเริ่มมีการสั่งอาหาร
        </div>
    );
}

function Kpis({ s }: Readonly<{ s: SchoolSummary }>) {
    const k = s.kpis;
    return (
        <>
        <SampleNotice s={s} />
        <section aria-label="ตัวชี้วัดหลัก" className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
            <KpiCard label="ออเดอร์ทั้งหมด" value={fmt(k.totalOrders.value)} delta={k.totalOrders} />
            <KpiCard
                label="นักเรียนที่ใช้งาน"
                value={fmt(k.activeStudents.value)}
                unit={k.activeStudents.enrolled ? ` / ${fmt(k.activeStudents.enrolled)} คน` : " คน"}
                delta={k.activeStudents}
                progress={k.activeStudents.value === null ? undefined : { percent: k.activeStudents.percentOfEnrolled, label: k.activeStudents.percentOfEnrolled === null ? "ยังไม่ระบุจำนวนนักเรียนทั้งหมด" : `${k.activeStudents.percentOfEnrolled}% ของนักเรียนทั้งหมด` }}
            />
            <KpiCard label="ออเดอร์สำเร็จ" value={fmt(k.successRate.value, 1)} unit="%" delta={k.successRate} />
            <KpiCard label="ร้านกดรับภายใน" value={fmt(k.medianAcceptSeconds.value)} unit=" วินาที" delta={k.medianAcceptSeconds} />
            <KpiCard label="ความพึงพอใจ" value={fmt(k.rating.value, 1)} unit=" / 5" delta={k.rating} />
            <KpiCard label="คำขอคืนเงิน" value={fmt(k.refunds.value)} unit=" รายการ" delta={k.refunds} />
        </section>
        </>
    );
}

export default function SchoolOverviewPage({ params }: Readonly<{ params: Promise<{ schoolId: string }> }>) {
    const { schoolId } = use(params);
    const { user } = useAuth();
    const [range, setRange] = useState<SummaryRange>("this_week");
    const { data: s, isLoading, isError, refetch } = useSchoolSummary(schoolId, range);
    const backHref = userHomePath(user, schoolId);
    const totalOrdersInRange = s?.ordersByDay.reduce((acc, d) => acc + d.count, 0) ?? 0;
    const maxDayCount = Math.max(0, ...(s?.ordersByDay.map((d) => d.count) ?? []));

    return (
        <SchoolShell schoolId={schoolId} active="overview">
            <div className="flex flex-col gap-6">
                <SchoolPageHeader
                    title="ภาพรวมโรงอาหาร"
                    actions={
                        <>
                            <label className="flex h-11 items-center gap-2 rounded-xl border border-line bg-white px-3.5 text-[15px]">
                                <Icon name="calendar" size={18} />
                                <select aria-label="ช่วงเวลา" value={range} onChange={(e) => setRange(e.target.value as SummaryRange)} className="bg-transparent font-app text-[15px] font-semibold outline-none">
                                    {RANGES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                                </select>
                            </label>
                            <Link href={`/school/${schoolId}/report`} className="flex h-11 items-center gap-2 rounded-xl bg-primary-main px-[18px] text-[15px] font-semibold text-white hover:bg-primary-dark">
                                <Icon name="file" size={18} />
                                รายงาน
                            </Link>
                        </>
                    }
                />

                <RefundsCard schoolId={schoolId} />
                <ComplaintsCard schoolId={schoolId} />

                {isLoading && <SchoolOverviewSkeleton />}
                {isError && <ErrorState onRetry={() => refetch()} />}

                {s && (
                    <>
                        <Kpis s={s} />

                        <div className="flex flex-wrap gap-5">
                            <Card id="demand" className="flex min-w-0 flex-[3_1_420px] scroll-mt-6 flex-col gap-4 p-6">
                                <div className="flex items-center justify-between">
                                    <SectionHeading aside="สีส้ม = วันที่มากที่สุด">ออเดอร์รายวัน</SectionHeading>
                                </div>
                                <DayBars data={s.ordersByDay} />

                                <div className="mt-4 border-t border-row-line pt-4">
                                    <TableWrap minWidth={400}>
                                        <thead>
                                            <tr>
                                                <th scope="col" className={TH}>วัน</th>
                                                <th scope="col" className={TH}>จำนวนออเดอร์</th>
                                                <th scope="col" className={TH}>สัดส่วน</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {s.ordersByDay.map((d) => {
                                                const pct = totalOrdersInRange > 0 ? Math.round((d.count / totalOrdersInRange) * 100) : 0;
                                                return (
                                                    <tr key={d.label}>
                                                        <td className={`${TD} font-semibold`}>{d.label}</td>
                                                        <td className={TD}>{d.count.toLocaleString("th-TH")}</td>
                                                        <td className={TD}>
                                                            <div className="flex items-center gap-2">
                                                                <div className="h-2 w-24 overflow-hidden rounded-full bg-row-line">
                                                                    <div className={d.count === maxDayCount ? "h-full bg-brand-orange" : "h-full bg-primary-main"} style={{ width: `${pct}%` }} />
                                                                </div>
                                                                <span className="text-xs text-brand-muted">{pct}%</span>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </TableWrap>
                                </div>                            </Card>

                            <Card id="reliability" className="flex min-w-0 flex-[2_1_320px] scroll-mt-6 flex-col gap-1 p-6">
                                <div className="mb-2 flex items-center justify-between">
                                    <h2 className="text-lg font-bold">ความน่าเชื่อถือของระบบ</h2>
                                    <Link href={`/school/${schoolId}/reliability`} className="text-sm font-semibold text-primary-dark hover:underline">
                                        ดูรายละเอียด ›
                                    </Link>
                                </div>
                                {s.reliability.map((r) => (
                                    <div key={r.label} className="flex items-center justify-between gap-3 border-b border-row-line py-2.5 last:border-b-0">
                                        <span className="flex flex-col gap-0.5"><span className="flex items-center gap-2"><Icon name={reliabilityIcon(r.label)} size={16} className="text-primary-main" /><span className="text-[15px] font-semibold">{r.label}</span></span><span className="text-[13px] text-brand-muted">{r.definition}</span></span>
                                        <span className="flex flex-col items-end whitespace-nowrap"><span className="text-lg font-bold">{r.display}</span><span className="text-[13px] text-brand-muted">{r.count.toLocaleString("th-TH")} จาก {r.total.toLocaleString("th-TH")} ออเดอร์</span></span>
                                    </div>
                                ))}
                            </Card>
                        </div>

                        <Card className="flex flex-col gap-4 p-6">
                            <div className="flex items-center justify-between">
                                <SectionHeading aside="ออเดอร์ต่อช่วง 30 นาที (% ของออเดอร์ทั้งวัน) · สีเข้ม = มาก">ช่วงเวลาที่คนสั่งมากที่สุด</SectionHeading>
                            </div>
                            <Heatmap slots={s.heatmap.slots} rows={s.heatmap.rows} />
                        </Card>

                        <div className="flex flex-wrap gap-5">
                            <Card className="flex min-w-0 flex-[3_1_480px] flex-col gap-3.5 p-6">
                                <SectionHeading aside={`รายได้เทียบ${RANGE_PREV[range]}`}>ร้านค้าที่เข้าร่วม</SectionHeading>
                                <TableWrap minWidth={760}>
                                    <thead>
                                        <tr><th scope="col" className={TH}>ร้าน</th><th scope="col" className={TH}>ออเดอร์</th><th scope="col" className={TH}>รับออเดอร์ใน</th><th scope="col" className={TH}>ช้า</th><th scope="col" className={TH}>ปฏิเสธ</th><th scope="col" className={TH}>รายได้</th><th scope="col" className={TH}>สถานะ</th></tr>
                                    </thead>
                                    <tbody>
                                        {s.restaurants.map((r) => (
                                            <tr key={r.name}>
                                                <td className={`${TD} font-semibold`}>{r.name}</td>
                                                <td className={TD}>{r.orders.toLocaleString("th-TH")}</td>
                                                <td className={TD}>{r.acceptLabel}</td>
                                                <td className={TD}>{r.delayRate.toFixed(1)}%</td>
                                                <td className={TD}>{r.rejected.toLocaleString("th-TH")}</td>
                                                <td className={TD}><Revenue amount={r.revenue} deltaPct={r.revenueDeltaPct} /></td>
                                                <td className={TD}>{r.status === "ACTIVE" ? <Chip tone="success" icon="check">เปิดอยู่</Chip> : <Chip tone="neutral" icon="clock">ปิดชั่วคราว</Chip>}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </TableWrap>
                            </Card>

                            <Card id="feedback" className="flex min-w-0 flex-[2_1_300px] scroll-mt-6 flex-col gap-3.5 p-6">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-lg font-bold">เสียงจากนักเรียน</h2>
                                    <Link href={`/school/${schoolId}/feedback`} className="text-sm font-semibold text-primary-dark hover:underline">
                                        ดูทั้งหมด ›
                                    </Link>
                                </div>
                                <div className="flex items-baseline gap-2"><span className="text-4xl font-bold">{s.feedback.mean.toFixed(1)}</span><span className="text-[15px] text-brand-muted">/ 5 จาก {s.feedback.responses.toLocaleString("th-TH")} ความเห็น</span></div>
                                <StarBreakdown distribution={s.feedback.distribution} responses={s.feedback.responses} />
                                <div className="flex flex-col gap-1.5">
                                    <span className="text-sm">รอนานกว่าที่แจ้ง <b>{s.feedback.waitedLongerPct}%</b></span>
                                    <span className="h-2.5 overflow-hidden rounded-full bg-row-line"><span className="block h-full bg-brand-orange" style={{ width: `${s.feedback.waitedLongerPct}%` }} /></span>
                                </div>
                                {s.feedback.comments.map((c, i) => <blockquote key={i} className="rounded-xl bg-ground p-3.5 text-sm leading-relaxed">“{c.text}”</blockquote>)}
                            </Card>
                        </div>

                        <p className="text-[13px] leading-relaxed text-brand-muted">
                            ตัวเลขที่มีข้อมูลน้อยกว่า 5 รายการจะแสดงเป็น “{NO_DATA}” · ไม่แสดงข้อมูลส่วนตัวของนักเรียน · <Link href={`/school/${schoolId}/report`} className="font-semibold text-primary-dark underline">ดูคำอธิบายตัวชี้วัด</Link>
                        </p>
                    </>
                )}
            </div>
        </SchoolShell>
    );
}
