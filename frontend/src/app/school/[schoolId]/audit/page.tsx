"use client";

import { use, useState } from "react";
import { ActionButton, Card, Chip, EmptyState, ErrorState, Notice, Segmented, TD, TH, TableSkeleton, TableWrap, CardListSkeleton } from "@/components/ui/kit";
import { SchoolPageHeader, SchoolShell } from "@/components/school/SchoolShell";
import { useAuditLog } from "@/hook/useSchool";
import { formatDateTime } from "@/lib/schema/format";
import type { AuditEntry } from "@/lib/schema";

const ACTION_LABEL: Record<string, string> = {
    SYSADMIN_WRITE: "แก้ไขข้อมูลของโรงเรียน",
    SCHOOL_ADMIN_CREATE: "เพิ่มข้อมูล",
    SCHOOL_ADMIN_UPDATE: "แก้ไขข้อมูล",
    SCHOOL_ADMIN_DELETE: "ลบข้อมูล",
    SUPPORT_GRANT_CREATE: "เข้าโหมดช่วยเหลือ (Break-glass)",
    SUPPORT_GRANT_END: "ออกจากโหมดช่วยเหลือ",
    SCHOOL_CREATE: "สร้างโรงเรียน",
    SCHOOL_STATUS_CHANGE: "เปลี่ยนสถานะโรงเรียน",
    SCHOOL_ADMIN_CODE_CREATE: "สร้างรหัสผู้ดูแลโรงเรียน",
    SCHOOL_ADMIN_CODE_REVOKE: "ยกเลิกรหัสผู้ดูแลโรงเรียน",
    SCHOOL_ADMIN_CODE_DELETE: "ลบรหัสผู้ดูแลโรงเรียน",
    PAYOUT_CONFIRM: "ยืนยันการโอนเงินให้ร้าน",
    REFUND_APPROVE: "อนุมัติคำขอคืนเงิน",
    REFUND_REJECT: "ไม่อนุมัติคำขอคืนเงิน",
    REFUND_MARK_REFUNDED: "บันทึกว่าโอนคืนแล้ว",
};
const ROLE: Record<AuditEntry["actor"]["role"], { label: string; tone: "danger" | "primary" | "neutral" }> = {
    SYSADMIN: { label: "ผู้ดูแลระบบ", tone: "danger" },
    SCHOOL_ADMIN: { label: "ผู้ดูแลโรงเรียน", tone: "primary" },
    USER: { label: "ผู้ใช้", tone: "neutral" },
};

const actionOf = (e: AuditEntry) => ACTION_LABEL[e.action] ?? e.action;
/** SYSADMIN_WRITE rows only carry the request; STATUS_CHANGE rows carry from/to in `meta`. */
const detailOf = (e: AuditEntry) => {
    const m = e.meta as { from?: string; to?: string } | null;
    if (e.action === "SCHOOL_STATUS_CHANGE" && m?.from && m?.to) return `${m.from} → ${m.to}`;
    return e.method && e.path ? `${e.method} ${e.path.replace(/^\/api/, "")}` : null;
};

function Who({ e }: Readonly<{ e: AuditEntry }>) {
    const r = ROLE[e.actor.role] ?? ROLE.USER;
    return <span className="flex flex-wrap items-center gap-2"><span className="font-semibold">{e.actor.name ?? "ไม่ทราบชื่อ"}</span><Chip tone={r.tone} icon={e.actor.role === "SYSADMIN" ? "shield" : undefined}>{r.label}</Chip></span>;
}

/** What platform admins (and school admins) changed here – so a school can always see who touched its data, when and why. */
export default function SchoolAuditPage({ params }: Readonly<{ params: Promise<{ schoolId: string }> }>) {
    const { schoolId } = use(params);
    const [who, setWho] = useState<"sysadmin" | "all">("all");
    const log = useAuditLog(schoolId, who === "sysadmin");

    return (
        <SchoolShell schoolId={schoolId} active="audit">
            <div className="flex flex-col gap-6">
                <SchoolPageHeader
                    eyebrow="ความโปร่งใส"
                    title="บันทึกการเข้าถึงของผู้ดูแลระบบ"
                    backHref={`/school/${schoolId}/settings`}
                    backLabel="ตั้งค่าโรงเรียน"
                />

                <Notice tone="primary" icon="shield">
                    <span className="text-[15px]">ผู้ดูแลระบบของ PromptServe <b>ดูข้อมูลโรงเรียนได้อย่างเดียว</b> หากต้องแก้ไขเพื่อช่วยเหลือ ต้องเข้าโหมดช่วยเหลือ (Break-glass) พร้อมระบุเหตุผล ซึ่งจะบันทึกไว้ที่นี่ทุกครั้ง</span>
                </Notice>

                <Card className="flex min-w-0 flex-col gap-4 p-4 sm:p-5">
                    <div className="max-w-sm"><Segmented label="กรองผู้กระทำ" value={who} onChange={setWho} options={[{ value: "all", label: "ทุกคน" }, { value: "sysadmin", label: "เฉพาะผู้ดูแลระบบ" }]} /></div>

                    {log.isLoading && (<><div className="hidden md:block"><TableSkeleton rows={5} cols={4} /></div><div className="md:hidden"><CardListSkeleton count={3} /></div></>)}
                    {log.isError && <ErrorState onRetry={() => log.refetch()} />}
                    {!log.isLoading && !log.isError && log.items.length === 0 && (
                        <EmptyState title={who === "sysadmin" ? "ยังไม่มีการเข้าถึงโดยผู้ดูแลระบบ" : "ยังไม่มีบันทึก"} body="เมื่อมีการกระทำที่ต้องบันทึก จะแสดงที่นี่พร้อมเวลาและเหตุผล" />
                    )}

                    {log.items.length > 0 && (
                        <>
                            <div className="hidden md:block">
                                <TableWrap minWidth={720}>
                                    <thead><tr><th scope="col" className={TH}>เวลา</th><th scope="col" className={TH}>ใคร</th><th scope="col" className={TH}>ทำอะไร</th><th scope="col" className={TH}>เหตุผล</th></tr></thead>
                                    <tbody>
                                        {log.items.map((e) => (
                                            <tr key={e.id}>
                                                <td className={`${TD} whitespace-nowrap`}>{formatDateTime(e.createdAt)}</td>
                                                <td className={TD}><Who e={e} /></td>
                                                <td className={TD}>
                                                    <span className="flex flex-col gap-0.5">
                                                        <span className="font-semibold">{actionOf(e)}{e.supportGrantId && <span className="ml-2 align-middle"><Chip tone="orange" icon="alert">โหมดช่วยเหลือ</Chip></span>}</span>
                                                        {detailOf(e) && <code className="break-all text-[12px] text-brand-muted">{detailOf(e)}</code>}
                                                    </span>
                                                </td>
                                                <td className={TD}>{e.reason ?? <span className="text-brand-muted">-</span>}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </TableWrap>
                            </div>
                            <ul className="m-0 flex list-none flex-col gap-2.5 p-0 md:hidden">
                                {log.items.map((e) => (
                                    <li key={e.id} className="flex flex-col gap-1.5 rounded-[14px] border border-line-soft bg-white p-4">
                                        <span className="text-[13px] text-brand-muted">{formatDateTime(e.createdAt)}</span>
                                        <Who e={e} />
                                        <span className="font-semibold">{actionOf(e)}</span>
                                        {e.supportGrantId && <span><Chip tone="orange" icon="alert">โหมดช่วยเหลือ</Chip></span>}
                                        {detailOf(e) && <code className="break-all text-[12px] text-brand-muted">{detailOf(e)}</code>}
                                        {e.reason && <p className="m-0 rounded-lg bg-ground p-2.5 text-sm">เหตุผล: {e.reason}</p>}
                                    </li>
                                ))}
                            </ul>
                        </>
                    )}

                    {log.hasNextPage && <div className="flex justify-center"><ActionButton variant="outline" size="md" onClick={() => log.fetchNextPage()} disabled={log.isFetchingNextPage}>{log.isFetchingNextPage ? "กำลังโหลด..." : "โหลดเพิ่ม"}</ActionButton></div>}
                </Card>
            </div>
        </SchoolShell>
    );
}
