"use client";

import { use } from "react";
import Link from "next/link";
import { ActionButton, Card, EmptyState, ErrorState, Skeleton } from "@/components/ui/kit";
import { SchoolPageHeader, SchoolShell } from "@/components/school/SchoolShell";
import { useSchoolAccess } from "@/hook/useSchoolAccess";
import { useApproveMember, useMembers, usePendingRestaurants, useRejectMember, useSetRestaurantStatus } from "@/hook/useSchool";
import { CATEGORY_LABEL, SCHOOL_ROLE_LABEL } from "@/lib/schema/format";

/** Everything waiting on a school admin: new shops and people asking to become school admins. */
export default function SchoolApprovalsPage({ params }: Readonly<{ params: Promise<{ schoolId: string }> }>) {
    const { schoolId } = use(params);
    const { writeProps } = useSchoolAccess(schoolId);
    const shops = usePendingRestaurants(schoolId);
    const members = useMembers(schoolId);
    const setStatus = useSetRestaurantStatus(schoolId);
    const approveMember = useApproveMember(schoolId);
    const rejectMember = useRejectMember(schoolId);

    const pendingMembers = members.data?.filter((m) => m.status === "PENDING") ?? [];
    const loading = shops.isLoading || members.isLoading;
    const nothing = !loading && !shops.isError && !members.isError && (shops.data?.length ?? 0) === 0 && pendingMembers.length === 0;

    return (
        <SchoolShell schoolId={schoolId} active="approvals">
            <div className="flex flex-col gap-6">
                <SchoolPageHeader title="รออนุมัติ" />

                {loading && <Skeleton className="h-40 w-full rounded-[18px]" />}
                {(shops.isError || members.isError) && <ErrorState onRetry={() => { void shops.refetch(); void members.refetch(); }} />}
                {nothing && <Card className="p-2"><EmptyState title="ไม่มีรายการรออนุมัติ" body="ร้านค้าที่สมัครใหม่และคำขอเป็นผู้ดูแลจะมาแสดงที่นี่" /></Card>}

                {(shops.data?.length ?? 0) > 0 && (
                    <section aria-labelledby="shops-title" className="flex flex-col gap-3.5 rounded-[18px] border border-[#FFD2BD] bg-brand-orange-light px-6 py-5">
                        <h2 id="shops-title" className="text-lg font-bold">ร้านค้ารออนุมัติ {shops.data?.length} ร้าน</h2>
                        <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr))]">
                            {shops.data?.map((p) => (
                                <article key={p.restaurantId} className="flex flex-col gap-2.5 rounded-[14px] bg-white p-[18px]">
                                    <div className="flex justify-between gap-3">
                                        <span className="flex min-w-0 flex-col gap-0.5">
                                            <span className="truncate text-[17px] font-bold">{p.name}</span>
                                            <span className="text-sm text-brand-muted">{[p.categories.map((c) => CATEGORY_LABEL[c]).join(", "), p.createdAt && `สมัครเมื่อ ${new Date(p.createdAt).toLocaleDateString("th-TH", { day: "numeric", month: "short" })}`].filter(Boolean).join(" · ") || "-"}</span>
                                        </span>
                                        <Link href={`/school/${schoolId}/restaurants/${p.restaurantId}`} className="whitespace-nowrap text-sm font-semibold text-primary-dark underline">ดูข้อมูล</Link>
                                    </div>
                                    <span className="text-sm text-slate">ผู้ติดต่อ: {p.contactName}{p.hoursLabel !== "-" && ` · เวลาเปิด ${p.hoursLabel}`}</span>
                                    <div className="flex gap-2.5">
                                        <ActionButton variant="outline" className="flex-1" disabled={setStatus.isPending} {...writeProps}
                                            onClick={() => window.confirm(`ไม่อนุมัติร้าน “${p.name}”?`) && setStatus.mutate({ restaurantId: p.restaurantId, status: "REMOVED", label: "ไม่อนุมัติร้านแล้ว" })}>ไม่อนุมัติ</ActionButton>
                                        <ActionButton className="flex-1" disabled={setStatus.isPending} {...writeProps}
                                            onClick={() => setStatus.mutate({ restaurantId: p.restaurantId, status: "ACTIVE", label: `อนุมัติ “${p.name}” แล้ว` })}>อนุมัติ</ActionButton>
                                    </div>
                                </article>
                            ))}
                        </div>
                    </section>
                )}

                {pendingMembers.length > 0 && (
                    <Card className="flex flex-col gap-3 p-6">
                        <h2 className="text-lg font-bold">คำขอเป็นผู้ดูแลโรงเรียน ({pendingMembers.length})</h2>
                        <ul className="flex flex-col gap-2.5">
                            {pendingMembers.map((m) => (
                                <li key={m.id} className="flex flex-wrap items-center gap-3 rounded-[14px] bg-ground p-3.5">
                                    <span className="flex min-w-0 flex-1 flex-col">
                                        <span className="truncate font-semibold">{m.name ?? "—"}</span>
                                        <span className="truncate text-[13px] text-brand-muted">{m.email} · ขอเป็น{SCHOOL_ROLE_LABEL[m.role as "ADMIN"] ?? m.role}</span>
                                    </span>
                                    <span className="flex gap-2">
                                        <ActionButton variant="outline" size="md" disabled={rejectMember.isPending} {...writeProps} onClick={() => window.confirm(`ไม่อนุมัติ ${m.name ?? m.email}?`) && rejectMember.mutate(m.id)}>ไม่อนุมัติ</ActionButton>
                                        <ActionButton size="md" disabled={approveMember.isPending} {...writeProps} onClick={() => approveMember.mutate(m.id)}>อนุมัติ</ActionButton>
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </Card>
                )}
            </div>
        </SchoolShell>
    );
}
