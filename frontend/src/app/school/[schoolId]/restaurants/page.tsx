"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { ActionButton, Card, Chip, EmptyState, ErrorState, Notice, TD, TH, TableSkeleton, TableWrap } from "@/components/ui/kit";
import { SchoolPageHeader, SchoolShell } from "@/components/school/SchoolShell";
import { CodeManager } from "@/components/codes/CodeManager";
import { useAuth } from "@/auth/auth.hooks";
import { isSchoolAdmin, isSystemAdmin } from "@/auth/access";
import { WriteScope } from "@/components/school/WriteScope";
import { useSchoolAccess } from "@/hook/useSchoolAccess";
import { useAddOverride, useCanteens, useOverrides, useRemoveOverride, useSchoolHours, useSchoolRestaurants } from "@/hook/useSchool";
import { DAYS, ENTITY_STATUS, formatRange, splitDate, summarizeHours } from "@/lib/schema/format";

export default function SchoolRestaurantsPage({ params }: Readonly<{ params: Promise<{ schoolId: string }> }>) {
    const { schoolId } = use(params);
    const access = useSchoolAccess(schoolId);
    const { user } = useAuth();
    const canSeeCode = isSchoolAdmin(user, schoolId) || isSystemAdmin(user);
    const canteens = useCanteens(schoolId);
    const restaurants = useSchoolRestaurants(schoolId);
    const hours = useSchoolHours(schoolId);
    const overrides = useOverrides(schoolId);
    const addOverride = useAddOverride(schoolId);
    const removeOverride = useRemoveOverride(schoolId);

    const [canteenId, setCanteenId] = useState<string>();
    const activeCanteen = canteenId ?? canteens.data?.[0]?.canteenId;

    const inCanteen = useMemo(() => (restaurants.data ?? []).filter((r) => !activeCanteen || r.canteenId === activeCanteen), [restaurants.data, activeCanteen]);
    const pending = inCanteen.filter((r) => r.pendingApproval);
    const live = inCanteen.filter((r) => !r.pendingApproval);

    const [date, setDate] = useState("");
    const [kind, setKind] = useState<"closed" | "special">("closed");
    const [reason, setReason] = useState("");

    return (
        <SchoolShell schoolId={schoolId} active="restaurants">
            <div className="flex flex-col gap-6">
                <SchoolPageHeader
                    eyebrow={canteens.data?.find((c) => c.canteenId === activeCanteen)?.name ?? "โรงอาหาร"}
                    title="โรงอาหาร & ร้านค้า"
                    actions={
                        <div role="tablist" aria-label="โรงอาหาร" className="flex flex-wrap gap-1.5 rounded-xl border border-line-soft bg-white p-1">
                            {canteens.isLoading && <span aria-hidden className="block h-10 w-60 animate-pulse rounded-[9px] bg-row-line" />}
                            {canteens.data?.map((c) => (
                                <button key={c.canteenId} type="button" role="tab" aria-selected={c.canteenId === activeCanteen} onClick={() => setCanteenId(c.canteenId)}
                                    className={clsx("h-10 rounded-[9px] px-4 text-[15px] font-semibold", c.canteenId === activeCanteen ? "bg-primary-main text-white" : "text-slate hover:bg-ground")}>
                                    {c.name}
                                </button>
                            ))}
                            {access.canWrite ? (
                                <Link href={`/school/${schoolId}/canteens/new`} className="flex h-10 items-center rounded-[9px] px-4 text-[15px] font-semibold text-slate hover:bg-ground">+ เพิ่มโรงอาหาร</Link>
                            ) : (
                                <span aria-disabled="true" title={access.hint} className="flex h-10 cursor-not-allowed items-center rounded-[9px] px-4 text-[15px] font-semibold text-slate opacity-50">+ เพิ่มโรงอาหาร</span>
                            )}
                        </div>
                    }
                />

                {restaurants.isError && <ErrorState onRetry={() => restaurants.refetch()} />}

                {pending.length > 0 && (
                    <Notice tone="orange" icon="clock" role="status">
                        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            <b>มี {pending.length} ร้านรออนุมัติ</b>
                            <Link href={`/school/${schoolId}/approvals`} className="font-semibold text-primary-dark underline">ไปหน้ารออนุมัติ</Link>
                        </span>
                    </Notice>
                )}

                <div className="flex flex-wrap items-start gap-5">
                    <Card className="flex min-w-0 flex-[3_1_520px] flex-col gap-3.5 p-6">
                        <div className="flex flex-wrap items-center justify-between gap-2.5">
                            <h2 className="text-lg font-bold">ร้านในโรงอาหาร ({live.length})</h2>
                        </div>
                        {restaurants.isLoading ? <TableSkeleton rows={2} cols={5} /> : live.length === 0 ? <EmptyState title="ยังไม่มีร้านในโรงอาหารนี้" body="ร้านค้าสมัครเองด้วยรหัสเชิญเจ้าของร้าน (สร้างรหัสได้ด้านล่าง) แล้วรออนุมัติที่หน้า “รออนุมัติ”" /> : (
                            <TableWrap minWidth={560}>
                                <thead><tr><th scope="col" className={TH}>ร้าน</th><th scope="col" className={TH}>ล็อก</th><th scope="col" className={TH}>เวลาเปิด</th><th scope="col" className={TH}>สถานะ</th><th scope="col" className={TH}><span className="sr-only-x">จัดการ</span></th></tr></thead>
                                <tbody>
                                    {live.map((r) => {
                                        const st = ENTITY_STATUS[r.status];
                                        return (
                                            <tr key={r.restaurantId}>
                                                <td className={`${TD} font-semibold`}>{r.name}</td>
                                                <td className={TD}>{r.location ?? "-"}</td>
                                                <td className={TD}>{r.hoursLabel}</td>
                                                <td className={TD}><Chip tone={st.tone} icon={r.status === "ACTIVE" ? "check" : "clock"}>{r.status === "INACTIVE" ? "ปิดชั่วคราว" : st.label}</Chip></td>
                                                <td className={`${TD} text-right`}><Link href={`/school/${schoolId}/restaurants/${r.restaurantId}`} className="inline-flex min-h-11 items-center text-sm font-semibold text-primary-dark underline">จัดการ</Link></td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </TableWrap>
                        )}
                    </Card>

                    <Card className="flex min-w-0 flex-[2_1_320px] flex-col gap-4 p-6">
                        <h2 className="text-lg font-bold">เวลาเปิดโรงอาหาร</h2>
                        <div className="flex min-h-[4.25rem] flex-col gap-1">
                            {(hours.data ? [summarizeHours(hours.data)] : []).map((line) => <p key={line} className="text-[15px] font-semibold">{line}</p>)}
                            {hours.data && DAYS.filter((d) => !hours.data.some((h) => h.dayOfWeek === d.key)).length > 0 && (
                                <p className="text-sm text-brand-muted">ปิด: {DAYS.filter((d) => !hours.data.some((h) => h.dayOfWeek === d.key)).map((d) => d.short).join(" ")}</p>
                            )}
                        </div>
                        <Link href={`/school/${schoolId}/settings`} className="flex h-11 items-center justify-center rounded-[10px] border-[1.5px] border-line bg-white text-[15px] font-semibold hover:bg-ground">แก้ไขเวลา</Link>

                        <WriteScope schoolId={schoolId}>
                        <div className="flex flex-col gap-2.5 border-t border-row-line pt-3.5">
                            <h3 className="text-base font-bold">วันหยุด / ปิดพิเศษ</h3>
                            {overrides.data?.map((o) => {
                                const d = splitDate(o.date);
                                return (
                                    <div key={o.id} className="flex items-center gap-3 rounded-[10px] bg-ground px-3 py-2.5">
                                        <span className="flex w-11 shrink-0 flex-col items-center"><span className="text-lg font-bold leading-none">{d.d}</span><span className="text-xs text-brand-muted">{d.m}</span></span>
                                        <span className="flex-1 text-sm leading-snug">{o.reason} · {o.isClosed ? "ปิดทั้งวัน" : `เปิด ${formatRange(o.openMinute, o.closeMinute)}`}</span>
                                        <button type="button" aria-label={`ลบ ${o.reason ?? "วันหยุด"}`} onClick={() => removeOverride.mutate(o.id)} className="h-9 rounded-lg px-2 text-sm font-semibold text-danger-text">ลบ</button>
                                    </div>
                                );
                            })}
                            <form className="grid gap-2.5" onSubmit={(e) => {
                                e.preventDefault();
                                if (!date) return;
                                addOverride.mutate({ date, isClosed: kind === "closed", openMinute: kind === "closed" ? null : 420, closeMinute: kind === "closed" ? null : 660, reason: reason.trim() || null }, { onSuccess: () => { setDate(""); setReason(""); } });
                            }}>
                                <input type="date" aria-label="วันที่" value={date} onChange={(e) => setDate(e.target.value)} required className="h-[42px] rounded-lg border-[1.5px] border-line px-2 text-sm" />
                                <select aria-label="ประเภท" value={kind} onChange={(e) => setKind(e.target.value as "closed" | "special")} className="h-[42px] rounded-lg border-[1.5px] border-line px-2 text-sm"><option value="closed">ปิดทั้งวัน</option><option value="special">เวลาพิเศษ (แก้เวลาในตั้งค่า)</option></select>
                                <input type="text" aria-label="เหตุผล" placeholder="เช่น สอบกลางภาค" value={reason} onChange={(e) => setReason(e.target.value)} className="h-[42px] rounded-lg border-[1.5px] border-line px-2 text-sm" />
                                <ActionButton type="submit" size="md" disabled={addOverride.isPending}>+ เพิ่มวันปิด</ActionButton>
                            </form>
                        </div>
                        </WriteScope>
                    </Card>
                </div>

                {canSeeCode && (
                    <CodeManager
                        scope={{ kind: "school", schoolId }}
                        types={["SHOP_OWNER"]}
                        title="รหัสเชิญเจ้าของร้าน"
                        readOnlyHint={access.hint}
                        description="สร้างรหัสแล้วส่งให้เจ้าของร้านในโรงเรียนเพื่อสมัครเปิดร้าน ร้านที่สมัครจะรออนุมัติที่หน้า “รออนุมัติ” ก่อนเปิดขาย"
                    />
                )}
            </div>
        </SchoolShell>
    );
}

