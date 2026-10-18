"use client";

import { useState } from "react";
import { ActionButton, Card, Chip, EmptyState, ErrorState, Field, Icon, SelectInput, Skeleton, TextInput } from "@/components/ui/kit";
import { copyText } from "@/components/school/InviteCode";
import { useCodes, useCreateCode, useDeleteCode, useRevokeCode } from "@/hook/useCodes";
import type { CodeScope } from "@/lib/services/codes";
import type { ManagedCode, ManagedCodeState, ManagedCodeType } from "@/lib/schema";
import type { Tone } from "@/lib/schema/format";

const TYPE_LABEL: Record<ManagedCodeType, string> = { SHOP_OWNER: "เจ้าของร้าน", SCHOOL_ADMIN: "ผู้ดูแลโรงเรียน", SHOP_STAFF: "พนักงานร้าน" };
const STATE_CHIP: Record<ManagedCodeState, { tone: Tone; label: string }> = {
    ACTIVE: { tone: "success", label: "ใช้งานได้" },
    REVOKED: { tone: "neutral", label: "ยกเลิกแล้ว" },
    EXPIRED: { tone: "orange", label: "หมดอายุ" },
    USED_UP: { tone: "orange", label: "ใช้ครบแล้ว" },
};
const DEFAULT_DAYS: Record<ManagedCodeType, number> = { SHOP_OWNER: 14, SCHOOL_ADMIN: 7, SHOP_STAFF: 0 };
const MAX_USES: Record<ManagedCodeType, number> = { SHOP_OWNER: 100, SCHOOL_ADMIN: 5, SHOP_STAFF: 100 };
const DEFAULT_USES: Record<ManagedCodeType, number> = { SHOP_OWNER: 1, SCHOOL_ADMIN: 5, SHOP_STAFF: 1 };
const SCHOOL_DAYS = [1, 3, 7, 14, 30, 60, 90, 180, 365, 0]; // 0 = never expires
const STAFF_DAYS = [0, 7, 30, 90, 180, 365]; // 0 = never expires

const dateLabel = (iso: string) => new Date(iso).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });
const daysLabel = (d: number) => (d === 0 ? "ถาวร (ไม่หมดอายุ)" : d === 180 ? "6 เดือน" : d === 365 ? "1 ปี" : `${d} วัน`);

/** Invite codes that grant a role. Only ever mounted for the roles allowed to mint them (school admin, system admin, shop owner). */
export function CodeManager({ scope, types, title, description, readOnlyHint }: Readonly<{ scope: CodeScope; types: ManagedCodeType[]; title: string; description: string; /** Set when the viewer may read but not mint / revoke codes. */ readOnlyHint?: string }>) {
    const staff = scope.kind === "staff";
    const locked = !!readOnlyHint;
    const [type, setType] = useState<ManagedCodeType>(types[0]);
    const [maxUses, setMaxUses] = useState(String(DEFAULT_USES[types[0]]));
    const [days, setDays] = useState<number>(DEFAULT_DAYS[types[0]]);
    const [confirming, setConfirming] = useState<string | null>(null);
    const [deleting, setDeleting] = useState<string | null>(null);

    const list = useCodes(scope);
    const create = useCreateCode(scope);
    const revoke = useRevokeCode(scope);
    const remove = useDeleteCode(scope);

    const rows = (list.data ?? []).filter((c) => types.includes(c.type));
    // Admin-code usage across codes that can still count: used / total use limit (unlimited codes excluded from the total).
    const counted = rows.filter((c) => c.state !== "REVOKED");
    const usage = types.includes("SCHOOL_ADMIN") && types.length === 1 && !counted.some((c) => c.maxUses === 0)
        ? `${counted.reduce((n, c) => n + c.usedCount, 0)}/${counted.reduce((n, c) => n + c.maxUses, 0)}`
        : null;
    const maxN = Math.min(MAX_USES[type], Math.max(1, Number(maxUses) || 1));

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        create.mutate(staff ? { expiresInDays: days || undefined } : { type: type as "SHOP_OWNER" | "SCHOOL_ADMIN", maxUses: maxN, expiresInDays: days });
    };

    const pickType = (t: ManagedCodeType) => { setType(t); setDays(DEFAULT_DAYS[t]); setMaxUses(String(DEFAULT_USES[t])); };

    const usesLabel = (c: ManagedCode) => (c.maxUses === 0 ? `ใช้แล้ว ${c.usedCount} ครั้ง (ไม่จำกัด)` : `ใช้แล้ว ${c.usedCount}/${c.maxUses}`);

    return (
        <Card className="flex flex-col gap-4 p-6">
            <div className="flex flex-col gap-1">
                <h2 className="text-lg font-bold">{title}{usage && <span className="ml-2 text-base font-semibold text-brand-muted" title="ใช้แล้ว / จำกัดจำนวนครั้ง (ผู้ดูแลได้ไม่เกิน 5 คนต่อโรงเรียน)">({usage})</span>}</h2>
                <span className="text-sm text-brand-muted">{description}</span>
            </div>

            <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
                <fieldset disabled={locked} title={readOnlyHint} className="contents">
                {types.length > 1 && (
                    <div className="min-w-[150px] flex-1">
                    <Field label="ประเภทรหัส">
                        <SelectInput value={type} onChange={(e) => pickType(e.target.value as ManagedCodeType)}>
                            {types.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
                        </SelectInput>
                    </Field>
                    </div>
                )}
                {!staff && (
                    <div className="min-w-[150px] flex-1">
                        <Field label="ใช้โค้ดได้กี่ครั้ง">
                            <TextInput inputMode="numeric" placeholder={`1–${MAX_USES[type]} ครั้ง`} value={maxUses} onChange={(e) => { const n = e.target.value.replace(/\D/g, "").slice(0, 3); setMaxUses(n && Number(n) > MAX_USES[type] ? String(MAX_USES[type]) : n); }} />
                        </Field>
                    </div>
                )}
                <div className="min-w-[150px] flex-1">
                    <Field label="หมดอายุใน">
                        <SelectInput value={days} onChange={(e) => setDays(Number(e.target.value))}>
                            {(staff ? STAFF_DAYS : SCHOOL_DAYS).map((d) => <option key={d} value={d}>{daysLabel(d)}</option>)}
                        </SelectInput>
                    </Field>
                </div>
                <ActionButton type="submit" size="md" disabled={create.isPending} className="shrink-0">
                    <Icon name="plus" size={18} />{create.isPending ? "กำลังสร้าง..." : "สร้างรหัส"}
                </ActionButton>
                </fieldset>
            </form>
            {locked && <p className="flex items-start gap-2 text-sm text-brand-muted"><Icon name="lock" size={16} className="mt-0.5 shrink-0" />{readOnlyHint}</p>}

            {list.isLoading && (
                <div className="flex flex-col gap-2.5">
                    <Skeleton className="h-16 w-full rounded-2xl" />
                    <Skeleton className="h-16 w-full rounded-2xl" />
                </div>
            )}
            {list.isError && <ErrorState onRetry={() => list.refetch()} />}
            {list.data && rows.length === 0 && <EmptyState title="ยังไม่มีรหัสเชิญ" body="กด “สร้างรหัส” แล้วคัดลอกส่งให้ผู้ที่ต้องการเข้าร่วม" />}

            <ul className="flex flex-col gap-2.5">
                {rows.map((c) => {
                    const active = c.state === "ACTIVE";
                    const chip = STATE_CHIP[c.state];
                    return (
                        <li key={c.id} className="flex flex-col gap-2.5 rounded-2xl border border-line-soft bg-ground px-4 py-3">
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                                <output aria-label={`รหัสเชิญ${TYPE_LABEL[c.type]}`} className={`font-mono text-[22px] font-bold tracking-[0.15em] ${active ? "text-primary-dark" : "text-brand-muted line-through"}`}>{c.code}</output>
                                <Chip tone={chip.tone}>{chip.label}</Chip>
                                {types.length > 1 && <Chip tone="primary">{TYPE_LABEL[c.type]}</Chip>}
                                <span className="ml-auto flex flex-wrap gap-2">
                                    <ActionButton variant="outline" size="md" onClick={() => copyText(c.code, "คัดลอกรหัสเชิญแล้ว")} aria-label={`คัดลอกรหัส ${c.code}`}>
                                        <Icon name="link" size={18} />คัดลอก
                                    </ActionButton>
                                    {active && <ActionButton variant="dangerOutline" size="md" disabled={revoke.isPending || locked} title={readOnlyHint} onClick={() => setConfirming(c.id)} aria-label={`ยกเลิกรหัส ${c.code}`}>ยกเลิกรหัส</ActionButton>}
                                    {!active && <ActionButton variant="dangerOutline" size="md" disabled={remove.isPending || locked} title={readOnlyHint} onClick={() => setDeleting(c.id)} aria-label={`ลบรหัส ${c.code}`}>ลบ</ActionButton>}
                                </span>
                            </div>
                            <p className="text-sm text-brand-muted">
                                {usesLabel(c)} · {c.expiresAt ? `หมดอายุ ${dateLabel(c.expiresAt)}` : "ไม่มีวันหมดอายุ"}
                            </p>
                            {confirming === c.id && (
                                <div role="alertdialog" aria-label="ยืนยันยกเลิกรหัส" className="flex flex-col gap-3 rounded-2xl border border-danger-main bg-danger-light p-4">
                                    <p className="text-[15px] leading-relaxed"><b>รหัส {c.code} จะใช้ไม่ได้ทันที</b> คนที่ใช้รหัสนี้ไปแล้วจะไม่ถูกถอนสิทธิ์ ต้องลบหรือไม่อนุมัติที่หน้าสมาชิกเอง</p>
                                    <div className="flex flex-wrap gap-2.5">
                                        <ActionButton variant="outline" size="md" onClick={() => setConfirming(null)}>ไม่ยกเลิก</ActionButton>
                                        <ActionButton variant="danger" size="md" disabled={revoke.isPending} onClick={() => { revoke.mutate(c.id); setConfirming(null); }}>ยืนยันยกเลิกรหัส</ActionButton>
                                    </div>
                                </div>
                            )}
                            {deleting === c.id && (
                                <div role="alertdialog" aria-label="ยืนยันลบรหัส" className="flex flex-col gap-3 rounded-2xl border border-danger-main bg-danger-light p-4">
                                    <p className="text-[15px] leading-relaxed"><b>ลบรหัส {c.code} ถาวร</b> รหัสจะหายจากรายการและกู้คืนไม่ได้ คนที่เคยใช้รหัสนี้ไม่ถูกถอนสิทธิ์</p>
                                    <div className="flex flex-wrap gap-2.5">
                                        <ActionButton variant="outline" size="md" onClick={() => setDeleting(null)}>ไม่ลบ</ActionButton>
                                        <ActionButton variant="danger" size="md" disabled={remove.isPending} onClick={() => { remove.mutate(c.id); setDeleting(null); }}>ยืนยันลบรหัส</ActionButton>
                                    </div>
                                </div>
                            )}
                        </li>
                    );
                })}
            </ul>
        </Card>
    );
}
