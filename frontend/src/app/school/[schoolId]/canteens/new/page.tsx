"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ActionButton, Card, Field, Icon, SelectInput, TextInput } from "@/components/ui/kit";
import { SchoolShell } from "@/components/school/SchoolShell";
import { WriteScope } from "@/components/school/WriteScope";
import { useCreateCanteen, useSchoolHours } from "@/hook/useSchool";
import { DAYS, hhmmToMinutes, toDayRows, type DayRow } from "@/lib/schema/format";
import type { Status } from "@/lib/schema";

export default function NewCanteenPage({ params }: Readonly<{ params: Promise<{ schoolId: string }> }>) {
    const { schoolId } = use(params);
    const router = useRouter();
    const schoolHours = useSchoolHours(schoolId);
    const create = useCreateCanteen(schoolId);

    const [name, setName] = useState("");
    const [status, setStatus] = useState<Status>("INACTIVE");
    const [image, setImage] = useState<File>();
    const [rows, setRows] = useState<DayRow[]>(() => toDayRows([], { from: "07:00", to: "15:30" }));
    const [nameError, setNameError] = useState<string>();

    const copySchoolHours = () => schoolHours.data && setRows(toDayRows(schoolHours.data, { from: "07:00", to: "15:30" }));
    // Start from the school's own hours – a canteen can only ever be narrower than the school.
    useEffect(() => { if (schoolHours.data) setRows(toDayRows(schoolHours.data, { from: "07:00", to: "15:30" })); }, [schoolHours.data]);

    const outside = (r: DayRow) => {
        const sh = schoolHours.data?.find((h) => h.dayOfWeek === r.day);
        return r.open && (!sh || hhmmToMinutes(r.from) < sh.openMinute || hhmmToMinutes(r.to) > sh.closeMinute);
    };
    const hasOutside = rows.some(outside);

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return setNameError("กรุณาใส่ชื่อโรงอาหาร");
        if (hasOutside) return;
        create.mutate({ name: name.trim(), status, hours: rows, image }, { onSuccess: () => router.push(`/school/${schoolId}/restaurants`) });
    };

    return (
        <SchoolShell schoolId={schoolId} active="restaurants">
            <form onSubmit={submit} className="flex max-w-[960px] flex-col gap-6">
                <WriteScope schoolId={schoolId}>
                <div className="flex flex-col gap-1.5">
                    <Link href={`/school/${schoolId}/restaurants`} className="text-sm font-semibold text-primary-dark">‹ โรงอาหาร &amp; ร้านค้า</Link>
                    <h1 className="text-[26px] font-bold md:text-[30px]">เพิ่มโรงอาหาร</h1>
                </div>

                <Card className="flex flex-col gap-4 p-6">
                    <h2 className="text-lg font-bold">ข้อมูลโรงอาหาร</h2>
                    <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr))]">
                        <Field label="ชื่อโรงอาหาร" error={nameError}>
                            <TextInput value={name} invalid={!!nameError} placeholder="เช่น โรงอาหาร ม.ต้น" onChange={(e) => { setName(e.target.value); setNameError(undefined); }} />
                        </Field>
                        <Field label="สถานะ">
                            <SelectInput value={status} onChange={(e) => setStatus(e.target.value as Status)}>
                                <option value="INACTIVE">ยังไม่เปิดใช้ (ตั้งค่าก่อน)</option>
                                <option value="ACTIVE">เปิดใช้งาน</option>
                            </SelectInput>
                        </Field>
                    </div>
                    <label className="flex cursor-pointer items-center gap-3.5 rounded-[14px] border-2 border-dashed border-primary-border bg-ground-blue p-4 text-primary-dark focus-within:ring-2 focus-within:ring-primary-main">
                        <Icon name="camera" size={28} strokeWidth={1.8} />
                        <span className="flex min-w-0 flex-col"><span className="text-[15px] font-bold">{image ? "เปลี่ยนรูป" : "รูปโรงอาหาร"}</span><span className="truncate text-[13px] text-brand-muted">{image ? image.name : "ไม่บังคับ · ช่วยให้นักเรียนจำได้ว่าอยู่ตรงไหน"}</span></span>
                        <input type="file" accept="image/*" className="sr-only" onChange={(e) => setImage(e.target.files?.[0])} />
                    </label>
                </Card>

                <Card className="flex flex-col gap-3.5 p-6">
                    <div className="flex flex-wrap items-end justify-between gap-2.5">
                        <div className="flex flex-col gap-1">
                            <h2 className="text-lg font-bold">เวลาเปิดโรงอาหาร</h2>
                            <span className="text-sm text-brand-muted">ต้องอยู่ในเวลาเปิดโรงเรียน</span>
                        </div>
                        <ActionButton variant="outline" size="md" className="!h-[38px] !text-sm" onClick={copySchoolHours}>ใช้เวลาเดียวกับโรงเรียน</ActionButton>
                    </div>
                    <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(150px,1fr))]">
                        {rows.map((r, i) => (
                            <div key={r.day} className={`flex flex-col gap-1.5 rounded-xl border p-3 ${r.open ? "border-line bg-white" : "border-line-soft bg-ground"}`}>
                                <label className="flex items-center gap-2 text-[15px] font-bold">
                                    <input type="checkbox" checked={r.open} onChange={(e) => setRows((x) => x.map((y, j) => (j === i ? { ...y, open: e.target.checked } : y)))} className="h-[18px] w-[18px] accent-primary-main" />
                                    {DAYS[i].long}
                                </label>
                                {r.open ? (
                                    <div className="flex gap-1.5">
                                        <input type="time" aria-label={`เปิด ${DAYS[i].long}`} value={r.from} onChange={(e) => setRows((x) => x.map((y, j) => (j === i ? { ...y, from: e.target.value } : y)))} className="h-10 min-w-0 flex-1 rounded-lg border-[1.5px] border-line px-1.5 text-sm" />
                                        <input type="time" aria-label={`ปิด ${DAYS[i].long}`} value={r.to} onChange={(e) => setRows((x) => x.map((y, j) => (j === i ? { ...y, to: e.target.value } : y)))} className="h-10 min-w-0 flex-1 rounded-lg border-[1.5px] border-line px-1.5 text-sm" />
                                    </div>
                                ) : <span className="text-sm text-brand-muted">ปิด</span>}
                                {outside(r) && <span role="alert" className="text-xs font-medium text-danger-text">อยู่นอกเวลาเปิดโรงเรียน</span>}
                            </div>
                        ))}
                    </div>
                </Card>

                <div className="flex flex-wrap justify-end gap-3">
                    <Link href={`/school/${schoolId}/restaurants`} className="flex h-[46px] items-center rounded-[10px] border-[1.5px] border-line px-5 text-[15px] font-semibold hover:bg-ground">ยกเลิก</Link>
                    <ActionButton type="submit" size="md" className="!h-[46px] !px-6" disabled={create.isPending || hasOutside}>{create.isPending ? "กำลังสร้าง..." : "สร้างโรงอาหาร"}</ActionButton>
                </div>
                </WriteScope>
            </form>
        </SchoolShell>
    );
}
