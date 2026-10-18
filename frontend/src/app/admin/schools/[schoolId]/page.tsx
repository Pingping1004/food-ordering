"use client";

import { use, useId, useState } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { InviteCodeCard } from "@/components/school/InviteCode";
import { CodeManager } from "@/components/codes/CodeManager";
import { ActionButton, ButtonLink, Card, Chip, ErrorState, Notice, Skeleton } from "@/components/ui/kit";
import { Dialog } from "@/components/ui/Dialog";
import { AdminPage, PageHeader, SCHOOL_STATUS } from "@/components/admin/AdminUI";
import { useRotateAdminInviteCode, useSchoolInfo, useSetSchoolStatus } from "@/hook/useSchool";
import { useAuth } from "@/auth/auth.hooks";
import { READ_ONLY_REASON, canWriteSchool } from "@/auth/access";

const MIN_REASON = 5;

/** Suspend / reactivate: a platform action, always with a written reason that lands in the school's audit log. */
function StatusDialog({ schoolId, schoolName, next, onClose }: Readonly<{ schoolId: string; schoolName: string; next: "ACTIVE" | "SUSPENDED" | null; onClose: () => void }>) {
    const set = useSetSchoolStatus(schoolId);
    const [reason, setReason] = useState("");
    const id = useId();
    const suspending = next === "SUSPENDED";
    const valid = reason.trim().length >= MIN_REASON;

    return (
        <Dialog open={!!next} onClose={set.isPending ? () => undefined : onClose} title={suspending ? "ระงับโรงเรียน" : "เปิดใช้งานโรงเรียนอีกครั้ง"}>
            <form
                className="flex flex-col gap-4"
                onSubmit={(e) => { e.preventDefault(); if (next && valid && !set.isPending) set.mutate({ status: next, reason: reason.trim() }, { onSuccess: onClose }); }}
            >
                <p className="text-[15px] leading-relaxed text-brand-muted">
                    {suspending
                        ? <>ระงับ “{schoolName}” ชั่วคราว นักเรียนจะสั่งอาหารและสมัครด้วยรหัสของโรงเรียนนี้ไม่ได้จนกว่าจะเปิดใช้งานอีกครั้ง ผู้ดูแลโรงเรียนเห็นเหตุผลในบันทึกการเข้าถึง</>
                        : <>เปิด “{schoolName}” ให้นักเรียนสั่งอาหารได้อีกครั้ง เหตุผลจะถูกบันทึกในบันทึกการเข้าถึงของโรงเรียน</>}
                </p>
                <label htmlFor={id} className="flex flex-col gap-1.5 text-sm font-semibold">
                    เหตุผล (อย่างน้อย {MIN_REASON} ตัวอักษร)
                    <textarea id={id} rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} aria-required
                        className="rounded-[10px] border-[1.5px] border-line px-3 py-2.5 font-app text-[15px] font-normal outline-none focus:border-primary-main focus:ring-2 focus:ring-primary-main/20" />
                </label>
                <div className="flex flex-wrap justify-end gap-2.5">
                    <ActionButton variant="outline" size="md" onClick={onClose} disabled={set.isPending}>ยกเลิก</ActionButton>
                    <ActionButton type="submit" variant={suspending ? "danger" : "primary"} size="md" disabled={!valid || set.isPending}>
                        {set.isPending ? "กำลังบันทึก..." : suspending ? "ยืนยันระงับ" : "ยืนยันเปิดใช้งาน"}
                    </ActionButton>
                </div>
            </form>
        </Dialog>
    );
}

/** System admin: one school – its student code and the codes that make new school admins (sysadmin-issued codes approve instantly). */
export default function AdminSchoolDetailPage({ params }: Readonly<{ params: Promise<{ schoolId: string }> }>) {
    const { schoolId } = use(params);
    const school = useSchoolInfo(schoolId);
    const rotate = useRotateAdminInviteCode();
    const { user } = useAuth();
    const [target, setTarget] = useState<"ACTIVE" | "SUSPENDED" | null>(null);
    // Rotating the student code is a school-admin write: a system admin needs an active break-glass grant for this school.
    const canRotate = canWriteSchool(user, schoolId);

    return (
        <AdminShell active="schools">
            <AdminPage width={1000}>
                {school.isLoading && (
                    <>
                        <PageHeader back={{ href: "/admin/schools", label: "โรงเรียนทั้งหมด" }} title={<Skeleton className="h-8 w-64 rounded-md" />} />
                        <Card className="p-6"><Skeleton className="h-24 w-full rounded-xl" /></Card>
                    </>
                )}
                {school.isError && (
                    <>
                        <PageHeader back={{ href: "/admin/schools", label: "โรงเรียนทั้งหมด" }} title="โรงเรียน" />
                        <Card><ErrorState onRetry={() => school.refetch()} /></Card>
                    </>
                )}

                {school.data && (
                    <>
                        <PageHeader
                            back={{ href: "/admin/schools", label: "โรงเรียนทั้งหมด" }}
                            title={school.data.name}
                            subtitle={school.data.email}
                            action={
                                <>
                                    {school.data.status === "SUSPENDED"
                                        ? <ActionButton variant="primary" size="md" onClick={() => setTarget("ACTIVE")}>เปิดใช้งานอีกครั้ง</ActionButton>
                                        : school.data.status === "ACTIVE" && <ActionButton variant="dangerOutline" size="md" onClick={() => setTarget("SUSPENDED")}>ระงับโรงเรียน</ActionButton>}
                                    <ButtonLink href={`/school/${schoolId}`} variant="outline" size="md" className="!h-11">เปิดแดชบอร์ดโรงเรียน (อ่านอย่างเดียว)</ButtonLink>
                                </>
                            }
                        />

                        <div className="flex flex-wrap items-center gap-3">
                            {(() => { const st = SCHOOL_STATUS[school.data.status]; return st ? <Chip tone={st.tone} icon={st.tone === "success" ? "check" : st.tone === "danger" ? "alert" : undefined}>สถานะ: {st.label}</Chip> : <Chip>{school.data.status}</Chip>; })()}
                        </div>
                        {school.data.status === "SUSPENDED" && <Notice tone="danger" icon="alert" role="status">โรงเรียนนี้ถูกระงับ นักเรียนสั่งอาหารและสมัครด้วยรหัสของโรงเรียนไม่ได้ จนกว่าจะเปิดใช้งานอีกครั้ง</Notice>}

                        <div className="flex flex-wrap items-start gap-5">
                            <div className="flex min-w-0 flex-[1_1_380px] flex-col">
                                <InviteCodeCard code={school.data.inviteCode} onRotate={() => rotate.mutate(schoolId)} rotating={rotate.isPending} readOnlyHint={canRotate ? undefined : READ_ONLY_REASON} />
                            </div>
                            <div className="flex min-w-0 flex-[1_1_380px] flex-col">
                                <CodeManager
                                    scope={{ kind: "admin-school", schoolId }}
                                    types={["SCHOOL_ADMIN"]}
                                    title="รหัสผู้ดูแลโรงเรียน"
                                    description="รหัสที่ผู้ดูแลระบบสร้างจะอนุมัติผู้ใช้ให้เป็นผู้ดูแลโรงเรียนทันที ส่วนรหัสที่ผู้ดูแลโรงเรียนสร้างต้องรอการอนุมัติ"
                                />
                            </div>
                        </div>
                        <StatusDialog key={target ?? "closed"} schoolId={schoolId} schoolName={school.data.name} next={target} onClose={() => setTarget(null)} />
                    </>
                )}
            </AdminPage>
        </AdminShell>
    );
}
