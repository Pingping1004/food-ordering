"use client";

import { use, useEffect, useState } from "react";
import { ActionButton, Card, ErrorState, Field, FormSkeleton, Skeleton, TableSkeleton, TextInput } from "@/components/ui/kit";
import { SchoolPageHeader, SchoolShell } from "@/components/school/SchoolShell";
import { InviteCodeCard } from "@/components/school/InviteCode";
import { CodeManager } from "@/components/codes/CodeManager";
import { useAuth } from "@/auth/auth.hooks";
import { isSchoolAdmin, isSystemAdmin } from "@/auth/access";
import { WriteScope } from "@/components/school/WriteScope";
import { useSchoolAccess } from "@/hook/useSchoolAccess";
import Link from "next/link";
import { useAddOverride, useOverrides, useRemoveOverride, useRotateInviteCode, useSaveSchool, useSaveSchoolHours, useSchoolHours, useSchoolInfo } from "@/hook/useSchool";
import { DAYS, formatRange, hhmmToMinutes, splitDate, toDayRows, type DayRow } from "@/lib/schema/format";
import { z } from "zod";

const infoSchema = z.object({
    name: z.string().trim().min(1, "กรุณาใส่ชื่อโรงเรียน"),
    email: z.string().trim().email("กรุณาใส่อีเมลให้ถูกต้อง"),
    studentAmount: z.coerce.number().int("ต้องเป็นจำนวนเต็ม").min(0, "ต้องไม่ติดลบ"),
});

export default function SchoolSettingsPage({ params }: Readonly<{ params: Promise<{ schoolId: string }> }>) {
    const { schoolId } = use(params);
    const school = useSchoolInfo(schoolId);
    const hours = useSchoolHours(schoolId);
    const overrides = useOverrides(schoolId);
    const saveSchool = useSaveSchool(schoolId);
    const saveHours = useSaveSchoolHours(schoolId);
    const addOverride = useAddOverride(schoolId);
    const removeOverride = useRemoveOverride(schoolId);
    const rotate = useRotateInviteCode(schoolId);
    const { user } = useAuth();
    const access = useSchoolAccess(schoolId);
    // The invite code is for school admins / system admins only – never rendered for anyone else.
    const canSeeCode = isSchoolAdmin(user, schoolId) || isSystemAdmin(user);

    const [info, setInfo] = useState({ name: "", email: "", studentAmount: "" });
    const [errors, setErrors] = useState<Partial<Record<keyof typeof info, string>>>({});
    const [rows, setRows] = useState<DayRow[]>([]);
    const [dirty, setDirty] = useState(false);

    useEffect(() => { if (school.data) setInfo({ name: school.data.name, email: school.data.email, studentAmount: school.data.studentAmount ? String(school.data.studentAmount) : "" }); }, [school.data]);
    useEffect(() => { if (hours.data) setRows(toDayRows(hours.data, { from: "07:00", to: "15:30" })); }, [hours.data]);

    const badRow = rows.find((r) => r.open && hhmmToMinutes(r.to) <= hhmmToMinutes(r.from));

    const [date, setDate] = useState("");
    const [kind, setKind] = useState<"closed" | "special">("closed");
    const [reason, setReason] = useState("");
    const [from, setFrom] = useState("07:00");
    const [to, setTo] = useState("11:00");

    const saveAll = () => {
        const parsed = infoSchema.safeParse(info);
        if (!parsed.success) {
            const next: typeof errors = {};
            parsed.error.issues.forEach((i) => { const k = i.path[0] as keyof typeof info; if (!next[k]) next[k] = i.message; });
            return setErrors(next);
        }
        setErrors({});
        if (badRow) return;
        saveSchool.mutate(parsed.data);
        saveHours.mutate(rows, { onSuccess: () => setDirty(false) });
    };

    const patchRow = (i: number, p: Partial<DayRow>) => { setRows((r) => r.map((x, j) => (j === i ? { ...x, ...p } : x))); setDirty(true); };
    const busy = saveSchool.isPending || saveHours.isPending;

    return (
        <SchoolShell schoolId={schoolId} active="settings">
            <div className="flex flex-col gap-6">
                <SchoolPageHeader
                    title="ตั้งค่าโรงเรียน"
                    actions={<ActionButton size="md" onClick={saveAll} disabled={busy || !!badRow || !access.canWrite} title={access.hint} aria-disabled={!access.canWrite || undefined}>{busy ? "กำลังบันทึก..." : "บันทึกการเปลี่ยนแปลง"}</ActionButton>}
                />

                {school.isLoading && (
                    <Card className="flex flex-col gap-4 p-6">
                        <Skeleton className="h-6 w-36 rounded-md" />
                        <FormSkeleton fields={3} />
                    </Card>
                )}
                {school.isError && <ErrorState onRetry={() => school.refetch()} />}

                {school.data && canSeeCode && (
                    <div className="flex flex-wrap items-start gap-5">
                        <div className="flex min-w-0 flex-[1_1_420px] flex-col"><InviteCodeCard code={school.data.inviteCode} onRotate={() => rotate.mutate()} rotating={rotate.isPending} readOnlyHint={access.hint} /></div>
                        <div className="flex min-w-0 flex-[1_1_420px] flex-col">
                            <CodeManager
                                scope={{ kind: "school", schoolId }}
                                types={["SHOP_OWNER", "SCHOOL_ADMIN"]}
                                title="รหัสเชิญเจ้าของร้านและผู้ดูแล"
                                readOnlyHint={access.hint}
                                description="รหัสแต่ละแบบกำหนดสิทธิ์ของผู้ใช้ รหัสเจ้าของร้านให้เปิดร้านได้ (รออนุมัติร้าน) รหัสผู้ดูแลต้องให้ผู้ดูแลคนปัจจุบันอนุมัติอีกครั้ง"
                            />
                        </div>
                    </div>
                )}

                <WriteScope schoolId={schoolId}>
                {school.data && (
                    <Card className="flex flex-col gap-4 p-6">
                        <h2 className="text-lg font-bold">ข้อมูลโรงเรียน</h2>
                        <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr))]">
                            <Field label="ชื่อโรงเรียน" error={errors.name}><TextInput value={info.name} invalid={!!errors.name} onChange={(e) => setInfo({ ...info, name: e.target.value })} /></Field>
                            <Field label="อีเมลติดต่อ" error={errors.email}><TextInput type="email" value={info.email} invalid={!!errors.email} onChange={(e) => setInfo({ ...info, email: e.target.value })} /></Field>
                            <Field label="จำนวนนักเรียนทั้งหมด" hint="ใช้คำนวณสัดส่วนนักเรียนที่ใช้งาน" error={errors.studentAmount}>
                                <TextInput inputMode="numeric" value={info.studentAmount} placeholder="[จำนวนนักเรียน]" invalid={!!errors.studentAmount} onChange={(e) => setInfo({ ...info, studentAmount: e.target.value.replace(/\D/g, "") })} />
                            </Field>
                        </div>
                    </Card>
                )}

                <div className="flex flex-wrap items-start gap-5">
                    <Card className="flex min-w-0 flex-[1_1_420px] flex-col gap-3.5 p-6">
                        <div className="flex flex-col gap-1">
                            <h2 className="text-lg font-bold">เวลาเปิดโรงเรียน</h2>
                            <span className="text-sm text-brand-muted">โรงอาหารและร้านค้าตั้งเวลาได้ภายในช่วงนี้เท่านั้น</span>
                        </div>
                        {hours.isLoading && <TableSkeleton rows={7} cols={4} />}
                        {hours.isError && <ErrorState onRetry={() => hours.refetch()} />}
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[420px] border-collapse text-[15px]">
                                <thead><tr className="text-left text-[13px] text-brand-muted"><th scope="col" className="p-2 font-semibold">วัน</th><th scope="col" className="p-2 font-semibold">เปิด</th><th scope="col" className="p-2 font-semibold">เวลาเปิด</th><th scope="col" className="p-2 font-semibold">เวลาปิด</th></tr></thead>
                                <tbody>
                                    {rows.map((r, i) => (
                                        <tr key={r.day} className="border-t border-row-line">
                                            <th scope="row" className="p-2 text-left font-semibold">{DAYS[i].long}</th>
                                            <td className="p-2"><input type="checkbox" aria-label={`เปิดวัน${DAYS[i].long}`} checked={r.open} onChange={(e) => patchRow(i, { open: e.target.checked })} className="h-5 w-5 accent-primary-main" /></td>
                                            <td className="p-2"><input type="time" aria-label={`เวลาเปิดวัน${DAYS[i].long}`} value={r.from} disabled={!r.open} onChange={(e) => patchRow(i, { from: e.target.value })} className="h-10 rounded-lg border-[1.5px] border-line px-2 text-sm disabled:opacity-40" /></td>
                                            <td className="p-2"><input type="time" aria-label={`เวลาปิดวัน${DAYS[i].long}`} value={r.to} disabled={!r.open} onChange={(e) => patchRow(i, { to: e.target.value })} className="h-10 rounded-lg border-[1.5px] border-line px-2 text-sm disabled:opacity-40" /></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {badRow && <p role="alert" className="text-sm font-medium text-danger-text">เวลาปิดวัน{DAYS.find((d) => d.key === badRow.day)?.long}ต้องหลังเวลาเปิด</p>}
                        {dirty && !badRow && <p className="text-sm text-brand-orange-text">มีการเปลี่ยนแปลงที่ยังไม่บันทึก</p>}
                    </Card>

                    <Card className="flex min-w-0 flex-[1_1_420px] flex-col gap-3.5 p-6">
                        <div className="flex flex-col gap-1">
                            <h2 className="text-lg font-bold">วันหยุด &amp; เวลาพิเศษ</h2>
                            <span className="text-sm text-brand-muted">นักเรียนจะเห็นประกาศนี้ และสั่งอาหารไม่ได้ในวันที่ปิด</span>
                        </div>
                        {overrides.isError && <ErrorState onRetry={() => overrides.refetch()} />}
                        <ul className="flex flex-col gap-2">
                            {overrides.data?.map((o) => {
                                const d = splitDate(o.date);
                                return (
                                    <li key={o.id} className="flex items-center gap-3 rounded-[10px] bg-ground px-3 py-2.5">
                                        <span className="flex w-[52px] shrink-0 flex-col items-center"><span className="text-lg font-bold leading-[1.1]">{d.d}</span><span className="text-xs text-brand-muted">{d.m}</span></span>
                                        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                                            <span className="text-[15px] font-semibold">{o.reason ?? "ปิดพิเศษ"}</span>
                                            <span className={`text-[13px] ${o.isClosed ? "text-danger-text" : "text-brand-orange-text"}`}>{o.isClosed ? "ปิดทั้งวัน" : `เปิด ${formatRange(o.openMinute, o.closeMinute)}`}</span>
                                        </span>
                                        <button type="button" aria-label={`ลบ ${o.reason ?? o.date}`} onClick={() => window.confirm("ลบวันหยุดนี้?") && removeOverride.mutate(o.id)} className="h-11 rounded-lg px-2.5 text-sm font-semibold text-danger-text hover:bg-danger-light">ลบ</button>
                                    </li>
                                );
                            })}
                            {overrides.data?.length === 0 && <li className="py-2 text-sm text-brand-muted">ยังไม่มีวันหยุดพิเศษ</li>}
                        </ul>
                        <form
                            className="grid gap-2.5 border-t border-row-line pt-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,150px),1fr))]"
                            onSubmit={(e) => {
                                e.preventDefault();
                                if (!date) return;
                                addOverride.mutate(
                                    { date, isClosed: kind === "closed", openMinute: kind === "closed" ? null : hhmmToMinutes(from), closeMinute: kind === "closed" ? null : hhmmToMinutes(to), reason: reason.trim() || null },
                                    { onSuccess: () => { setDate(""); setReason(""); } },
                                );
                            }}
                        >
                            <label className="flex flex-col gap-1.5 text-[13px] font-semibold">วันที่<input type="date" value={date} required onChange={(e) => setDate(e.target.value)} className="h-[42px] rounded-lg border-[1.5px] border-line px-2 text-sm font-normal" /></label>
                            <label className="flex flex-col gap-1.5 text-[13px] font-semibold">ประเภท<select value={kind} onChange={(e) => setKind(e.target.value as "closed" | "special")} className="h-[42px] rounded-lg border-[1.5px] border-line px-2 text-sm font-normal"><option value="closed">ปิดทั้งวัน</option><option value="special">เวลาพิเศษ</option></select></label>
                            {kind === "special" && (
                                <>
                                    <label className="flex flex-col gap-1.5 text-[13px] font-semibold">เปิด<input type="time" value={from} onChange={(e) => setFrom(e.target.value)} className="h-[42px] rounded-lg border-[1.5px] border-line px-2 text-sm font-normal" /></label>
                                    <label className="flex flex-col gap-1.5 text-[13px] font-semibold">ปิด<input type="time" value={to} onChange={(e) => setTo(e.target.value)} className="h-[42px] rounded-lg border-[1.5px] border-line px-2 text-sm font-normal" /></label>
                                </>
                            )}
                            <label className="flex flex-col gap-1.5 text-[13px] font-semibold">เหตุผล<input type="text" value={reason} placeholder="เช่น สอบกลางภาค" onChange={(e) => setReason(e.target.value)} className="h-[42px] rounded-lg border-[1.5px] border-line px-2 text-sm font-normal" /></label>
                            <ActionButton type="submit" size="md" className="self-end !h-[42px] !text-sm" disabled={addOverride.isPending}>+ เพิ่ม</ActionButton>
                        </form>
                    </Card>
                </div>
                </WriteScope>

                <Card className="flex flex-wrap items-center gap-x-5 gap-y-3 p-5">
                    <div className="flex min-w-0 flex-1 basis-64 flex-col gap-0.5">
                        <h2 className="text-lg font-bold">บันทึกการเข้าถึงของผู้ดูแลระบบ</h2>
                        <span className="text-sm text-brand-muted">ดูว่าใครจากแพลตฟอร์มเข้ามาดูหรือแก้ข้อมูลของโรงเรียน เมื่อไหร่ และเพราะอะไร</span>
                    </div>
                    <Link href={`/school/${schoolId}/audit`} className="flex h-11 items-center rounded-xl border-[1.5px] border-line bg-white px-4 text-[15px] font-semibold hover:bg-ground">เปิดบันทึก</Link>
                </Card>
            </div>
        </SchoolShell>
    );
}
