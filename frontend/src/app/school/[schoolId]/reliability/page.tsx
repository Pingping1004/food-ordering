"use client";

import { use } from "react";
import { Card, Chip, ErrorState, Icon, SchoolOverviewSkeleton, SectionHeading, TD, TH, TableWrap } from "@/components/ui/kit";
import { SchoolPageHeader, SchoolShell } from "@/components/school/SchoolShell";
import { KpiCard, reliabilityIcon } from "@/components/school/dashboard";
import { useSchoolSummary } from "@/hook/useSchool";

const fmt = (n: number | null, digits = 0) => (n === null ? null : n.toLocaleString("th-TH", { maximumFractionDigits: digits }));

export default function SchoolReliabilityPage({ params }: Readonly<{ params: Promise<{ schoolId: string }> }>) {
    const { schoolId } = use(params);
    const { data: s, isLoading, isError, refetch } = useSchoolSummary(schoolId);

    const k = s?.kpis;

    return (
        <SchoolShell schoolId={schoolId} active="reliability">
            <div className="flex flex-col gap-6">
                <SchoolPageHeader
                    backHref={`/school/${schoolId}`}
                    backLabel="ภาพรวมโรงอาหาร"
                    title="ความน่าเชื่อถือของระบบ (Reliability)"
                />

                {isLoading && <SchoolOverviewSkeleton />}
                {isError && <ErrorState onRetry={() => refetch()} />}

                {s && (
                    <>
                        <section aria-label="ตัวชี้วัดความน่าเชื่อถือ" className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
                            {k?.onTime && <KpiCard label="ส่งมอบตรงเวลา" value={fmt(k.onTime.value, 1)} unit="%" delta={k.onTime} />}
                            {k?.successRate && <KpiCard label="ออเดอร์สำเร็จ" value={fmt(k.successRate.value, 1)} unit="%" delta={k.successRate} />}
                            {k?.medianAcceptSeconds && <KpiCard label="ร้านกดรับภายใน" value={fmt(k.medianAcceptSeconds.value)} unit=" วินาที" delta={k.medianAcceptSeconds} />}
                        </section>

                        <div className="flex flex-wrap gap-5">
                            <Card className="flex min-w-0 flex-[2_1_360px] flex-col gap-3 p-6">
                                <SectionHeading>ตัวชี้วัดความน่าเชื่อถือของระบบ</SectionHeading>
                                <div className="flex flex-col divide-y divide-row-line">
                                    {s.reliability.map((r) => (
                                        <div key={r.label} className="flex items-center justify-between gap-4 py-3.5 first:pt-1 last:pb-1">
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-2">
                                                    <Icon name={reliabilityIcon(r.label)} size={16} className="text-primary-main" />
                                                    <span className="text-[15px] font-semibold">{r.label}</span>
                                                </div>
                                                <span className="text-[13px] leading-relaxed text-brand-muted">{r.definition}</span>
                                            </div>
                                            <span className="whitespace-nowrap rounded-xl bg-ground px-3.5 py-1.5 text-lg font-bold text-brand-dark">
                                                {r.display}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </Card>

                            <Card className="flex min-w-0 flex-[3_1_480px] flex-col gap-3.5 p-6">
                                <SectionHeading aside="ประสิทธิภาพการรับออเดอร์">ความรวดเร็วและความแม่นยำของร้านค้า</SectionHeading>
                                <TableWrap minWidth={500}>
                                    <thead>
                                        <tr>
                                            <th scope="col" className={TH}>ร้าน</th>
                                            <th scope="col" className={TH}>ออเดอร์</th>
                                            <th scope="col" className={TH}>กดรับใน</th>
                                            <th scope="col" className={TH}>ล่าช้า</th>
                                            <th scope="col" className={TH}>สถานะ</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {s.restaurants.map((r) => (
                                            <tr key={r.name}>
                                                <td className={`${TD} font-semibold`}>{r.name}</td>
                                                <td className={TD}>{r.orders.toLocaleString("th-TH")}</td>
                                                <td className={TD}>{r.acceptLabel}</td>
                                                <td className={TD}>
                                                    <span className={r.delayRate > 10 ? "font-bold text-danger-text" : "text-brand-dark"}>
                                                        {r.delayRate.toFixed(1)}%
                                                    </span>
                                                </td>
                                                <td className={TD}>
                                                    {r.status === "ACTIVE" ? (
                                                        <Chip tone="success" icon="check">เปิดอยู่</Chip>
                                                    ) : (
                                                        <Chip tone="neutral" icon="clock">ปิดชั่วคราว</Chip>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </TableWrap>
                            </Card>
                        </div>
                    </>
                )}
            </div>
        </SchoolShell>
    );
}
