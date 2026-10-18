"use client";

import { use, useState } from "react";
import { Card, Chip, EmptyState, ErrorState, Icon, SchoolOverviewSkeleton, SectionHeading } from "@/components/ui/kit";
import { SchoolPageHeader, SchoolShell } from "@/components/school/SchoolShell";
import { KpiCard } from "@/components/school/dashboard";
import { useSchoolSummary } from "@/hook/useSchool";

const fmt = (n: number | null, digits = 0) => (n === null ? null : n.toLocaleString("th-TH", { maximumFractionDigits: digits }));

export default function SchoolFeedbackPage({ params }: Readonly<{ params: Promise<{ schoolId: string }> }>) {
    const { schoolId } = use(params);
    const { data: s, isLoading, isError, refetch } = useSchoolSummary(schoolId);

    const k = s?.kpis;
    const [starFilter, setStarFilter] = useState<number | null>(null);
    const comments = s?.feedback.comments ?? [];
    const countOf = (star: number) => comments.filter((c) => c.rating === star).length;
    const shown = starFilter === null ? comments : comments.filter((c) => c.rating === starFilter);

    return (
        <SchoolShell schoolId={schoolId} active="feedback">
            <div className="flex flex-col gap-6">
                <SchoolPageHeader
                    backHref={`/school/${schoolId}`}
                    backLabel="ภาพรวมโรงอาหาร"
                    title="เสียงจากนักเรียน (Feedback)"
                />

                {isLoading && <SchoolOverviewSkeleton />}
                {isError && <ErrorState onRetry={() => refetch()} />}

                {s && (
                    <>
                        <section aria-label="ตัวชี้วัดความพึงพอใจ" className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))]">
                            {k?.rating && <KpiCard label="คะแนนความพึงพอใจเฉลี่ย" value={fmt(k.rating.value, 1)} unit=" / 5" delta={k.rating} />}
                            <div className="flex flex-col justify-between rounded-[18px] border border-line-soft bg-white p-5">
                                <span className="text-sm font-medium text-brand-muted">จำนวนนักเรียนที่ประเมิน</span>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-[32px] font-bold leading-none">{s.feedback.responses.toLocaleString("th-TH")}</span>
                                    <span className="text-sm font-semibold text-brand-muted">ความเห็น</span>
                                </div>
                                <span className="text-[13px] text-brand-muted">ประเมินหลังได้รับอาหารสำเร็จ</span>
                            </div>
                            <div className="flex flex-col justify-between rounded-[18px] border border-line-soft bg-white p-5">
                                <span className="text-sm font-medium text-brand-muted">รอนานกว่าเวลาที่ร้านแจ้ง</span>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-[32px] font-bold leading-none text-brand-orange-text">{s.feedback.waitedLongerPct}%</span>
                                    <span className="text-sm font-semibold text-brand-muted">ของนักเรียน</span>
                                </div>
                                <div className="h-2 w-full overflow-hidden rounded-full bg-row-line">
                                    <div className="h-full bg-brand-orange" style={{ width: `${s.feedback.waitedLongerPct}%` }} />
                                </div>
                            </div>
                        </section>

                        <div className="flex flex-wrap gap-5">
                            <Card className="flex min-w-0 flex-[2_1_340px] flex-col gap-4 p-6">
                                <SectionHeading aside="เกณฑ์ 1 - 5 ดาว">ภาพรวมความพึงพอใจ</SectionHeading>
                                <div className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-ground py-8">
                                    <span className="text-5xl font-black text-brand-dark">{s.feedback.mean.toFixed(1)}</span>
                                    <div className="flex items-center gap-1 text-brand-orange">
                                        {[1, 2, 3, 4, 5].map((star) => (
                                            <Icon
                                                key={star}
                                                name="check"
                                                size={20}
                                                className={star <= Math.round(s.feedback.mean) ? "text-brand-orange" : "text-line"}
                                            />
                                        ))}
                                    </div>
                                    <span className="text-sm font-medium text-brand-muted">จาก {s.feedback.responses.toLocaleString("th-TH")} ความเห็น</span>
                                </div>

                                <div className="flex flex-col gap-2 rounded-xl border border-line-soft p-4">
                                    <div className="flex items-center justify-between text-sm font-semibold">
                                        <span>อัตราการได้รับอาหารตรงเวลา</span>
                                        <span className="text-success-main">{100 - s.feedback.waitedLongerPct}%</span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm font-semibold">
                                        <span>อัตราที่แจ้งว่ารอนานกว่าปกติ</span>
                                        <span className="text-brand-orange-text">{s.feedback.waitedLongerPct}%</span>
                                    </div>
                                </div>
                            </Card>

                            <Card className="flex min-w-0 flex-[3_1_480px] flex-col gap-4 p-6">
                                <div className="flex items-center justify-between">
                                    <SectionHeading aside="ข้อความจริงจากนักเรียน">ความคิดเห็นและข้อเสนอแนะ</SectionHeading>
                                    <Chip tone="neutral">{shown.length} ความเห็น</Chip>
                                </div>

                                <div role="group" aria-label="กรองตามดาว" className="flex flex-wrap gap-2">
                                    {[null, 5, 4, 3, 2, 1].map((star) => {
                                        const on = starFilter === star;
                                        return (
                                            <button
                                                key={star ?? "all"}
                                                type="button"
                                                aria-pressed={on}
                                                onClick={() => setStarFilter(star)}
                                                className={`h-9 rounded-full border px-3.5 text-sm font-semibold transition-colors ${on ? "border-brand-orange bg-brand-orange-light text-brand-orange-text" : "border-line-soft bg-white text-brand-muted hover:bg-ground"}`}
                                            >
                                                {star === null ? `ทั้งหมด (${comments.length})` : `${star} ดาว (${countOf(star)})`}
                                            </button>
                                        );
                                    })}
                                </div>

                                {shown.length === 0 ? (
                                    <EmptyState
                                        title={comments.length === 0 ? "ยังไม่มีข้อความความเห็น" : `ไม่มีความเห็น ${starFilter} ดาว`}
                                        body={comments.length === 0 ? "เมื่อนักเรียนส่งความคิดเห็นเพิ่มเติมจะปรากฏที่นี่" : "ลองเลือกระดับดาวอื่น หรือดูทั้งหมด"}
                                    />
                                ) : (
                                    <div className="flex flex-col gap-3">
                                        {shown.map((c, i) => (
                                            <blockquote
                                                key={i}
                                                className="relative flex flex-col gap-1.5 rounded-2xl border border-line-soft bg-ground/50 p-4 transition-colors hover:bg-ground"
                                            >
                                                <div className="flex items-center justify-between gap-2">
                                                    <div className="flex items-center gap-2 text-primary-main">
                                                        <Icon name="chat" size={16} />
                                                        <span className="text-xs font-bold uppercase tracking-wider text-brand-muted">ความเห็น #{i + 1}</span>
                                                    </div>
                                                    <Chip tone="neutral">{c.rating} ดาว</Chip>
                                                </div>
                                                <p className="whitespace-pre-wrap text-[15px] font-normal leading-relaxed text-brand-dark">“{c.text}”</p>
                                                {(c.restaurantName || c.createdAt) && (
                                                    <span className="text-[13px] text-brand-muted">
                                                        {[c.restaurantName, c.createdAt && new Date(c.createdAt).toLocaleString("th-TH", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" })].filter(Boolean).join(" · ")}
                                                    </span>
                                                )}
                                            </blockquote>
                                        ))}
                                    </div>
                                )}
                            </Card>
                        </div>
                    </>
                )}
            </div>
        </SchoolShell>
    );
}
