"use client";

import { use, useState } from "react";
import Link from "next/link";
import { ActionButton, Card, Chip, ErrorState, Skeleton } from "@/components/ui/kit";
import { Dialog } from "@/components/ui/Dialog";
import { SchoolShell } from "@/components/school/SchoolShell";
import { useSchoolAccess } from "@/hook/useSchoolAccess";
import { useCanteens, useMoveRestaurantCanteen, useRestaurantDetail, useSetRestaurantStatus } from "@/hook/useSchool";
import { CATEGORY_LABEL, DAYS, ENTITY_STATUS, RESTAURANT_ROLE_LABEL, formatRange } from "@/lib/schema/format";
import { splitDate } from "@/lib/schema/format";

export default function SchoolRestaurantDetailPage({ params }: Readonly<{ params: Promise<{ schoolId: string; restaurantId: string }> }>) {
    const { schoolId, restaurantId } = use(params);
    const { data: r, isLoading, isError, refetch } = useRestaurantDetail(schoolId, restaurantId);
    const setStatus = useSetRestaurantStatus(schoolId);
    const { writeProps } = useSchoolAccess(schoolId);
    const { data: canteens, isLoading: canteensLoading } = useCanteens(schoolId);
    const moveCanteen = useMoveRestaurantCanteen(schoolId);
    const [moveOpen, setMoveOpen] = useState(false);
    const [target, setTarget] = useState<string | null>(null);
    const closeMove = () => { setMoveOpen(false); setTarget(null); };

    const suspended = r?.status === "SUSPENDED";
    const toggleSuspend = () => {
        if (!r) return;
        const next = suspended ? "ACTIVE" : "SUSPENDED";
        const ok = suspended || window.confirm(`ระงับร้าน “${r.name}” ชั่วคราว? นักเรียนจะสั่งไม่ได้จนกว่าจะเปิดอีกครั้ง`);
        if (ok) setStatus.mutate({ restaurantId, status: next, label: suspended ? "เปิดร้านอีกครั้งแล้ว" : "ระงับร้านแล้ว" });
    };

    const stats = r && [
        { label: "ออเดอร์สัปดาห์นี้", value: r.week.orders.toLocaleString("th-TH"), sub: "ข้อมูลตัวอย่าง" },
        { label: "ร้านกดรับภายใน", value: `${r.week.medianAcceptSeconds} วิ`, sub: "ค่ากลาง" },
        { label: "แจ้งล่าช้า", value: `${r.week.delayRate}%`, sub: "ของออเดอร์ที่รับ" },
        { label: "ร้านปฏิเสธ", value: `${r.week.rejectRate}%`, sub: "ของออเดอร์ทั้งหมด" },
    ];

    const info = r && [
        ["ประเภท", r.categories.map((c) => CATEGORY_LABEL[c]).join(", ")],
        ["ผู้ติดต่อ", [r.contactName, r.contactSurname].filter(Boolean).join(" ")], ["เบอร์โทร", r.contactTel], ["อีเมล", r.contactEmail],
        ["รับพร้อมกันสูงสุด", r.maxActiveOrders ? `${r.maxActiveOrders} ออเดอร์` : "-"],
        ["รับออเดอร์อัตโนมัติ", r.isAutoAcceptedOrder ? "เปิด" : "ปิด"],
        ["เวลาทำเฉลี่ย", r.avgCookingTimeMins ? `${r.avgCookingTimeMins} นาที / เมนู` : "-"],
    ];

    return (
        <SchoolShell schoolId={schoolId} active="restaurants">
            <div className="flex flex-col gap-6">
                {isLoading && (
                    <div className="flex flex-col gap-6">
                        <div className="flex flex-col gap-2">
                            <Skeleton className="h-4 w-32 rounded" />
                            <div className="flex items-center gap-3">
                                <Skeleton className="h-8 w-60 rounded-lg" />
                                <Skeleton className="h-6 w-20 rounded-full" />
                            </div>
                            <Skeleton className="h-4 w-48 rounded" />
                        </div>
                        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                            {Array.from({ length: 4 }).map((_, i) => (
                                <div key={i} className="flex flex-col gap-2 rounded-[20px] border border-line-soft bg-white p-4">
                                    <Skeleton className="h-4 w-20 rounded" />
                                    <Skeleton className="h-7 w-28 rounded-md" />
                                </div>
                            ))}
                        </div>
                        <div className="grid gap-5 md:grid-cols-2">
                            <div className="flex flex-col gap-3 rounded-[20px] border border-line-soft bg-white p-5">
                                <Skeleton className="h-6 w-32 rounded-md" />
                                <Skeleton className="h-4 w-full rounded" />
                                <Skeleton className="h-4 w-3/4 rounded" />
                                <Skeleton className="h-4 w-5/6 rounded" />
                            </div>
                            <div className="flex flex-col gap-3 rounded-[20px] border border-line-soft bg-white p-5">
                                <Skeleton className="h-6 w-32 rounded-md" />
                                <Skeleton className="h-4 w-full rounded" />
                                <Skeleton className="h-4 w-3/4 rounded" />
                                <Skeleton className="h-4 w-5/6 rounded" />
                            </div>
                        </div>
                    </div>
                )}
                {isError && <ErrorState onRetry={() => refetch()} />}

                {r && stats && info && (
                    <>
                        <header className="flex flex-wrap items-end justify-between gap-4">
                            <div className="flex min-w-0 flex-col gap-1.5">
                                <Link href={`/school/${schoolId}/restaurants`} className="text-sm font-semibold text-primary-dark">‹ โรงอาหาร &amp; ร้านค้า</Link>
                                <div className="flex flex-wrap items-center gap-3">
                                    <h1 className="text-[26px] font-bold leading-tight md:text-[30px]">{r.name}</h1>
                                    <Chip tone={r.pendingApproval ? "orange" : ENTITY_STATUS[r.status].tone} icon={r.status === "ACTIVE" ? "check" : "clock"}>{r.pendingApproval ? "รออนุมัติ" : ENTITY_STATUS[r.status].label}</Chip>
                                </div>
                                <span className="text-sm text-brand-muted">{r.canteenName} · {r.location ?? "-"} · เข้าร่วมเมื่อ {(() => { const d = splitDate(r.joinedAt); return `${d.d} ${d.m}`; })()}</span>
                            </div>
                            <div className="flex flex-wrap gap-2.5">
                                {r.pendingApproval ? (
                                    <>
                                        <ActionButton variant="outline" size="md" disabled={setStatus.isPending} {...writeProps} onClick={() => window.confirm("ไม่อนุมัติร้านนี้?") && setStatus.mutate({ restaurantId, status: "REMOVED", label: "ไม่อนุมัติร้านแล้ว" })}>ไม่อนุมัติ</ActionButton>
                                        <ActionButton size="md" disabled={setStatus.isPending} {...writeProps} onClick={() => setStatus.mutate({ restaurantId, status: "ACTIVE", label: "อนุมัติร้านแล้ว" })}>อนุมัติ</ActionButton>
                                    </>
                                ) : (
                                    <>
                                        <ActionButton variant="outline" size="md" {...writeProps} onClick={() => setMoveOpen(true)}>ย้ายโรงอาหาร</ActionButton>
                                        <ActionButton variant={suspended ? "primary" : "dangerOutline"} size="md" disabled={setStatus.isPending} {...writeProps} onClick={toggleSuspend}>{suspended ? "เปิดร้านอีกครั้ง" : "ระงับร้านชั่วคราว"}</ActionButton>
                                    </>
                                )}
                            </div>
                        </header>

                        <section aria-label="สัปดาห์นี้" className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
                            {stats.map((s) => (
                                <Card as="div" key={s.label} className="flex flex-col gap-1.5 !rounded-2xl p-[18px]">
                                    <span className="text-sm text-brand-muted">{s.label}</span>
                                    <span className="text-[28px] font-bold">{s.value}</span>
                                    <span className="text-[13px] text-slate">{s.sub}</span>
                                </Card>
                            ))}
                        </section>

                        <div className="flex flex-wrap items-start gap-5">
                            <Card className="flex min-w-0 flex-[1_1_380px] flex-col gap-3 p-6">
                                <h2 className="text-lg font-bold">ข้อมูลร้าน</h2>
                                <dl className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-2.5 text-[15px]">
                                    {info.map(([k, v]) => <div key={k} className="contents"><dt className="text-brand-muted">{k}</dt><dd className="font-semibold">{v}</dd></div>)}
                                </dl>
                            </Card>
                            <div className="flex min-w-0 flex-[1_1_380px] flex-col gap-5">
                                <Card className="flex flex-col gap-3 p-6">
                                    <h2 className="text-lg font-bold">เวลาเปิด</h2>
                                    {DAYS.map((d) => {
                                        const h = r.hours.find((x) => x.dayOfWeek === d.key);
                                        return <div key={d.key} className="flex justify-between text-[15px]"><span className="font-semibold">{d.long}</span><span className={h ? "" : "text-brand-muted"}>{h ? formatRange(h.openMinute, h.closeMinute) : "ปิด"}</span></div>;
                                    })}
                                </Card>
                                <Card className="flex flex-col gap-3 p-6">
                                    <h2 className="text-lg font-bold">คนในร้าน</h2>
                                    {r.people.map((p) => <div key={p.name} className="flex justify-between text-[15px]"><span className="font-semibold">{p.name}</span><span className="text-brand-muted">{RESTAURANT_ROLE_LABEL[p.role]}</span></div>)}
                                </Card>
                            </div>
                        </div>
                    </>
                )}
            </div>

            <Dialog open={moveOpen} onClose={closeMove} title="ย้ายโรงอาหาร">
                <p className="text-base text-slate">เลือกโรงอาหารที่ต้องการย้าย{r ? ` “${r.name}”` : "ร้าน"} ไปอยู่</p>
                <ul className="flex flex-col gap-2" role="radiogroup" aria-label="โรงอาหารปลายทาง">
                    {canteensLoading && <li className="text-brand-muted">กำลังโหลด…</li>}
                    {canteens?.map((c) => {
                        const current = c.canteenId === r?.canteenId;
                        const selected = target === c.canteenId;
                        return (
                            <li key={c.canteenId}>
                                <button type="button" role="radio" aria-checked={selected} disabled={current} onClick={() => setTarget(c.canteenId)}
                                    className={`flex min-h-[52px] w-full items-center justify-between rounded-[14px] border-[1.5px] px-4 text-left text-base font-semibold disabled:opacity-50 ${selected ? "border-primary-main bg-primary-light" : "border-line hover:bg-ground"}`}>
                                    <span>{c.name}</span>
                                    {current && <span className="text-sm font-normal text-brand-muted">โรงอาหารปัจจุบัน</span>}
                                </button>
                            </li>
                        );
                    })}
                    {canteens && canteens.length < 2 && <li className="text-brand-muted">ยังไม่มีโรงอาหารอื่นในโรงเรียนนี้</li>}
                </ul>
                <div className="flex justify-end gap-2.5">
                    <ActionButton variant="outline" size="md" onClick={closeMove}>ยกเลิก</ActionButton>
                    <ActionButton size="md" disabled={!target || moveCanteen.isPending} onClick={() => target && moveCanteen.mutate({ restaurantId, canteenId: target }, { onSuccess: closeMove })}>ย้าย</ActionButton>
                </div>
            </Dialog>
        </SchoolShell>
    );
}
