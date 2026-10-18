"use client";

import { use } from "react";
import { ActionButton, Card, Chip, EmptyState, ErrorState, Notice, TD, TH, TableSkeleton, TableWrap } from "@/components/ui/kit";
import { SchoolPageHeader, SchoolShell } from "@/components/school/SchoolShell";
import { useSchoolAccess } from "@/hook/useSchoolAccess";
import { useApproveMember, useMembers, useRejectMember, useRemoveMember } from "@/hook/useSchool";
import { SCHOOL_ROLE_LABEL } from "@/lib/schema/format";
import type { SchoolRole } from "@/lib/schema";

/** People with school-admin access. They join by asking (signup with the school code → admin request), never by e-mail invite. */
export default function SchoolStaffPage({ params }: Readonly<{ params: Promise<{ schoolId: string }> }>) {
    const { schoolId } = use(params);
    const access = useSchoolAccess(schoolId);
    const members = useMembers(schoolId);
    const approve = useApproveMember(schoolId);
    const reject = useRejectMember(schoolId);
    const remove = useRemoveMember(schoolId);

    const list = members.data ?? [];
    const adminCount = list.filter((m) => m.role === "ADMIN" && m.status === "APPROVED").length;
    const busy = approve.isPending || reject.isPending || remove.isPending || !access.canWrite;
    // waiting requests first
    const sorted = [...list].sort((a, b) => Number(b.status === "PENDING") - Number(a.status === "PENDING"));

    return (
        <SchoolShell schoolId={schoolId} active="staff">
            <div className="flex flex-col gap-6">
                <SchoolPageHeader title="เจ้าหน้าที่โรงเรียน" />

                <Notice tone="primary" icon="info">
                    <span className="text-[15px]">สร้างรหัสผู้ดูแลโรงเรียนที่หน้า “ตั้งค่าโรงเรียน” ส่งให้ผู้ดูแลคนใหม่ เมื่อเขาใช้รหัส คำขอจะมาแสดงที่นี่ให้คุณอนุมัติ</span>
                </Notice>

                <Card className="flex min-w-0 flex-col gap-3 p-6">
                    <h2 className="text-lg font-bold">ผู้มีสิทธิ์เข้าถึง ({list.length})</h2>
                    {members.isLoading && <TableSkeleton rows={4} cols={4} />}
                    {members.isError && <ErrorState onRetry={() => members.refetch()} />}
                    {members.data?.length === 0 && <EmptyState title="ยังไม่มีเจ้าหน้าที่" />}
                    {sorted.length > 0 && (
                        <TableWrap minWidth={560}>
                            <thead><tr><th scope="col" className={TH}>ชื่อ</th><th scope="col" className={TH}>สิทธิ์</th><th scope="col" className={TH}>สถานะ</th><th scope="col" className={TH}><span className="sr-only-x">จัดการ</span></th></tr></thead>
                            <tbody>
                                {sorted.map((m) => {
                                    const waiting = m.status === "PENDING";
                                    const lastAdmin = m.role === "ADMIN" && !waiting && adminCount <= 1;
                                    return (
                                        <tr key={m.id}>
                                            <td className={TD}><span className="flex flex-col"><span className="font-semibold">{m.name ?? "—"}</span><span className="text-[13px] text-brand-muted">{m.email}</span></span></td>
                                            <td className={TD}>{SCHOOL_ROLE_LABEL[m.role as SchoolRole] ?? m.role}</td>
                                            <td className={TD}>{waiting ? <Chip tone="orange" icon="clock">รออนุมัติ</Chip> : <Chip tone="success" icon="check">ใช้งาน</Chip>}</td>
                                            <td className={`${TD} text-right`}>
                                                {waiting ? (
                                                    <span className="inline-flex gap-2">
                                                        <ActionButton variant="outline" size="md" disabled={busy} onClick={() => window.confirm(`ไม่อนุมัติ ${m.name ?? m.email}?`) && reject.mutate(m.id)}>ไม่อนุมัติ</ActionButton>
                                                        <ActionButton size="md" disabled={busy} onClick={() => approve.mutate(m.id)}>อนุมัติ</ActionButton>
                                                    </span>
                                                ) : (
                                                    <button type="button" disabled={lastAdmin || busy} title={!access.canWrite ? access.hint : lastAdmin ? "ต้องมีผู้ดูแลอย่างน้อย 1 คน" : undefined}
                                                        onClick={() => window.confirm(`นำ ${m.name ?? m.email} ออก?`) && remove.mutate(m.id)}
                                                        className="h-11 rounded-lg px-2.5 text-sm font-semibold text-danger-text hover:bg-danger-light disabled:opacity-40">นำออก</button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </TableWrap>
                    )}
                </Card>

                <Card className="flex flex-col gap-2.5 px-6 py-5 text-sm leading-relaxed">
                    <h3 className="text-base font-bold">สิทธิ์แต่ละแบบ</h3>
                    <p><b>ผู้ดูแล</b> · อนุมัติ/ระงับร้าน แก้เวลาเปิด วันหยุด อนุมัติผู้ดูแลคนอื่น ดูรหัสเชิญและรายงาน</p>
                    <p><b>เจ้าหน้าที่</b> · ดูแดชบอร์ดและรายงานเท่านั้น</p>
                    <p className="text-brand-muted">ทั้งสองแบบไม่เห็นชื่อหรือเบอร์โทรของนักเรียน</p>
                </Card>
            </div>
        </SchoolShell>
    );
}
