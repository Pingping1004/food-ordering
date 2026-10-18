"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { ComplaintsCard } from "@/components/complaints/ComplaintsCard";
import { Card, Chip, EmptyState, ErrorState, Field, Icon, Notice, SearchInput, TableSkeleton, TableWrap, TextInput, ActionButton } from "@/components/ui/kit";
import { A_TD as TD, A_TH as TH, AdminPage, FormGrid, PageHeader, SCHOOL_STATUS, StatCard, StatGrid, StepCard } from "@/components/admin/AdminUI";
import { copyText } from "@/components/school/InviteCode";
import { useAdminSchools, useCreateSchool, useRotateAdminInviteCode } from "@/hook/useSchool";
import { useAuth } from "@/auth/auth.hooks";
import { READ_ONLY_REASON, canWriteSchool } from "@/auth/access";
import { conflictReasons, formatInviteCode } from "@/lib/services/student";
import type { CreatedSchool } from "@/lib/schema";

const fmtDateTime = (iso: string) => new Date(iso).toLocaleString("th-TH", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

/** Shown once, right after creating a school: the first SCHOOL_ADMIN code. It stays listed in the school's code manager. */
function CreatedPanel({ created, onClose }: Readonly<{ created: CreatedSchool; onClose: () => void }>) {
    const { school, adminCode } = created;
    return (
        <Card className="flex flex-col gap-4 border-2 border-success-main p-5 sm:p-6" role="status">
            <div className="flex flex-col gap-1">
                <h2 className="flex items-center gap-2 text-lg font-bold"><Icon name="check" size={22} strokeWidth={2.6} className="text-success-main" />สร้างโรงเรียน “{school.name}” แล้ว</h2>
                <span className="text-sm text-brand-muted">ส่งรหัสนี้ให้ผู้ดูแลโรงเรียนคนแรก เขาสมัครบัญชีด้วยรหัสนี้แล้วจะเป็นผู้ดูแลโรงเรียนได้ทันที ไม่ต้องรออนุมัติ</span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
                <output aria-label="รหัสผู้ดูแลโรงเรียน" className="rounded-2xl bg-ground-blue px-5 py-3 font-mono text-[28px] font-bold tracking-[0.2em] text-primary-dark">{formatInviteCode(adminCode.code)}</output>
                <ActionButton variant="outline" size="md" onClick={() => copyText(formatInviteCode(adminCode.code), "คัดลอกรหัสผู้ดูแลโรงเรียนแล้ว")}>
                    <Icon name="link" size={18} />คัดลอก
                </ActionButton>
            </div>
            <p className="text-[15px] text-brand-muted">ใช้ได้ 1 ครั้ง หมดอายุ {fmtDateTime(adminCode.expiresAt)} (7 วัน)</p>
            <Notice tone="orange" icon="alert" role="alert">รหัสนี้แสดงเฉพาะตรงนี้ครั้งเดียว กรุณาคัดลอกเก็บไว้ หากหายยังดูรหัสที่ยังไม่หมดอายุได้ที่หน้าจัดการรหัสของโรงเรียน (จัดการรหัสผู้ดูแล) หรือสร้างรหัสใหม่ที่นั่น</Notice>
            <div className="flex flex-wrap gap-4">
                <Link href={`/admin/schools/${school.schoolId}`} className="inline-flex min-h-11 items-center text-sm font-semibold text-primary-dark underline">จัดการรหัสของโรงเรียน</Link>
                <ActionButton variant="ghost" size="md" onClick={onClose}>เสร็จแล้ว</ActionButton>
            </div>
        </Card>
    );
}

function CreateSchoolForm({ onCreated, onCancel }: Readonly<{ onCreated: (c: CreatedSchool) => void; onCancel: () => void }>) {
    const create = useCreateSchool();
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [students, setStudents] = useState("");
    const [profile, setProfile] = useState("");
    const [error, setError] = useState<string>();

    const emailOk = /^\S+@\S+\.\S+$/.test(email.trim());
    const canSubmit = name.trim().length >= 2 && emailOk && !create.isPending;

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!canSubmit) return;
        setError(undefined);
        create.mutate(
            { name: name.trim(), email: email.trim(), studentAmount: students ? Math.max(0, Math.floor(Number(students)) || 0) : undefined, profile: profile.trim() || undefined },
            {
                onSuccess: onCreated,
                onError: (err) => setError(conflictReasons(err)[0] ?? "สร้างโรงเรียนไม่สำเร็จ กรุณาลองใหม่"),
            },
        );
    };

    return (
        <form onSubmit={submit} noValidate aria-label="สร้างโรงเรียน" className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
                <h2 className="text-[22px] font-bold leading-tight">เพิ่มโรงเรียนใหม่</h2>
                <span className="text-[15px] text-brand-muted">2 ขั้นตอน · ระบบสร้างรหัสผู้ดูแลโรงเรียนให้หลังสร้างเสร็จ ผู้ดูแลตั้งเวลาเปิดและเชิญร้านค้าต่อเองได้</span>
            </div>
            <ol className="m-0 flex list-none flex-col gap-4 p-0">
                <StepCard step={1} title="ข้อมูลโรงเรียน">
                    <FormGrid>
                        <Field label="ชื่อโรงเรียน"><TextInput value={name} onChange={(e) => setName(e.target.value)} maxLength={200} required autoComplete="off" /></Field>
                        <Field label="อีเมลโรงเรียน"><TextInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="office@school.ac.th" required autoComplete="off" /></Field>
                        <Field label="จำนวนนักเรียน (ไม่บังคับ)"><TextInput type="number" inputMode="numeric" min={0} value={students} onChange={(e) => setStudents(e.target.value)} /></Field>
                    </FormGrid>
                    <Field label="รายละเอียดโรงเรียน (ไม่บังคับ)"><TextInput value={profile} onChange={(e) => setProfile(e.target.value)} /></Field>
                </StepCard>
                <StepCard step={2} title="รหัสผู้ดูแลโรงเรียน">
                    <Notice tone="primary" icon="info">รหัสผู้ดูแลโรงเรียนคนแรกจะถูกสร้างให้หลังกดสร้างโรงเรียน ใช้ได้ 1 ครั้ง ส่งต่อให้ผู้ดูแลเพื่อสมัครบัญชี ไม่ต้องรออนุมัติ</Notice>
                </StepCard>
            </ol>
            {error && <Notice tone="danger" icon="alert" role="alert">{error}</Notice>}
            <div className="flex flex-wrap justify-end gap-3">
                <ActionButton variant="outline" size="md" className="!h-[46px] !px-5" onClick={onCancel} disabled={create.isPending}>ยกเลิก</ActionButton>
                <ActionButton type="submit" size="md" className="!h-[46px] !px-6" disabled={!canSubmit}>{create.isPending ? "กำลังสร้าง..." : "สร้างโรงเรียนและรหัสผู้ดูแล"}</ActionButton>
            </div>
        </form>
    );
}

export default function AdminSchoolsPage() {
    const [q, setQ] = useState("");
    const [creating, setCreating] = useState(false);
    const [created, setCreated] = useState<CreatedSchool | null>(null);
    const list = useAdminSchools();
    const rotate = useRotateAdminInviteCode();
    const busy = rotate.isPending;
    const { user } = useAuth();

    const rows = useMemo(() => (list.data ?? []).filter((s) => s.name.toLowerCase().includes(q.trim().toLowerCase())), [list.data, q]);
    const active = useMemo(() => (list.data ?? []).filter((s) => s.status === "ACTIVE"), [list.data]);

    const totals = [
        { label: "โรงเรียนที่ใช้งาน", value: list.data ? active.length : "–" },
        { label: "โรงอาหาร", value: list.data ? active.reduce((n, s) => n + s.canteenCount, 0) : "–" },
        { label: "ร้านค้า", value: list.data ? active.reduce((n, s) => n + s.restaurantCount, 0) : "–" },
    ];

    return (
        <AdminShell active="schools">
            <AdminPage>
                {creating ? (
                    <>
                        <PageHeader back={{ href: "/admin/schools", label: "โรงเรียนทั้งหมด" }} title="สร้างโรงเรียน" />
                        <div className="max-w-[920px]"><CreateSchoolForm onCancel={() => setCreating(false)} onCreated={(c) => { setCreated(c); setCreating(false); }} /></div>
                    </>
                ) : (
                    <PageHeader
                        title="โรงเรียนทั้งหมด"
                        subtitle={list.data ? `${list.data.length} โรงเรียนในระบบ` : undefined}
                        action={<ActionButton size="md" onClick={() => { setCreated(null); setCreating(true); }}><Icon name="plus" size={18} />เพิ่มโรงเรียน</ActionButton>}
                    />
                )}

                {created && <CreatedPanel created={created} onClose={() => setCreated(null)} />}

                {!creating && (
                    <>
                        <ComplaintsCard />

                        <StatGrid>
                            {totals.map((t) => <StatCard key={t.label} label={t.label} value={t.value} />)}
                        </StatGrid>

                        <Card className="flex flex-col gap-3 p-4 sm:p-5">
                            <SearchInput label="ค้นหาโรงเรียน" placeholder="ค้นหาโรงเรียน" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-[420px] !h-11 !rounded-[10px] !border" />

                            {list.isLoading && <TableSkeleton rows={5} cols={7} />}
                            {list.isError && <ErrorState onRetry={() => list.refetch()} />}
                            {!list.isLoading && !list.isError && rows.length === 0 && (
                                <EmptyState title="ไม่พบโรงเรียน" body={q ? "ลองค้นหาด้วยคำอื่น" : "กด “เพิ่มโรงเรียน” เพื่อเริ่มต้น"} />
                            )}

                            {rows.length > 0 && (
                                <TableWrap minWidth={900}>
                                    <thead><tr><th scope="col" className={TH}>โรงเรียน</th><th scope="col" className={TH}>โรงอาหาร</th><th scope="col" className={TH}>ร้านค้า</th><th scope="col" className={TH}>ผู้ดูแลโรงเรียน</th><th scope="col" className={TH} title="ใช้แล้ว / จำกัดจำนวนครั้ง (ไม่เกิน 5 คนต่อโรงเรียน)">รหัสผู้ดูแล (ใช้แล้ว/จำกัด)</th><th scope="col" className={TH}>รหัสเชิญ (นักเรียน)</th><th scope="col" className={TH}>สถานะ</th><th scope="col" className={TH}><span className="sr-only-x">จัดการ</span></th></tr></thead>
                                    <tbody>
                                        {rows.map((s) => {
                                            const code = s.inviteCode ? formatInviteCode(s.inviteCode) : null;
                                            const st = SCHOOL_STATUS[s.status];
                                            return (
                                                <tr key={s.schoolId} className="hover:bg-ground-blue">
                                                    <td className={TD}><span className="flex flex-col"><span className="font-semibold">{s.name}</span><span className="text-[13px] text-brand-muted">{s.email}</span></span></td>
                                                    <td className={TD}>{s.canteenCount}</td>
                                                    <td className={TD}>{s.restaurantCount}</td>
                                                    <td className={TD}>{s.adminName ?? <span className="text-brand-muted">-</span>}</td>
                                                    <td className={TD}>{s.adminCodeLimit === undefined ? "-" : `${s.adminCodeUsed ?? 0}/${s.adminCodeLimit}`}</td>
                                                    <td className={TD}>
                                                        <span className="flex flex-wrap items-center gap-1.5">
                                                            <code className="font-mono text-[15px] font-bold tracking-wider">{code ?? "-"}</code>
                                                            {code && <button type="button" onClick={() => copyText(code, "คัดลอกรหัสเชิญแล้ว")} className="h-9 rounded-lg px-2 text-sm font-semibold text-primary-dark hover:bg-primary-light focus-visible:outline-2 focus-visible:outline-primary-main">คัดลอก</button>}
                                                        </span>
                                                    </td>
                                                    <td className={TD}>{st ? <Chip tone={st.tone} icon={st.tone === "success" ? "check" : undefined}>{st.label}</Chip> : <Chip>{s.status}</Chip>}</td>
                                                    <td className={`${TD} text-right`}>
                                                        <span className="inline-flex flex-wrap justify-end gap-x-4">
                                                            <Link href={`/admin/schools/${s.schoolId}`} className="inline-flex min-h-11 items-center text-sm font-semibold text-primary-dark">จัดการรหัสผู้ดูแล</Link>
                                                            <Link href={`/school/${s.schoolId}`} className="inline-flex min-h-11 items-center text-sm font-semibold text-primary-dark">ข้อมูลเพิ่มเติม</Link>
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </TableWrap>
                            )}
                        </Card>
                    </>
                )}
            </AdminPage>
        </AdminShell>
    );
}
