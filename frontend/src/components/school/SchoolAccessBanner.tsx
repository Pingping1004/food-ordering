"use client";

import { useEffect, useId, useState } from "react";
import clsx from "clsx";
import { toast } from "sonner";
import { ActionButton, Icon } from "@/components/ui/kit";
import { Dialog } from "@/components/ui/Dialog";
import { useSchoolAccess } from "@/hook/useSchoolAccess";
import { useEndSupportGrant, useStartSupportGrant } from "@/hook/useSchool";
import { SYSADMIN_READ_ONLY_EVENT, apiMessage } from "@/lib/api";

export const MIN_REASON = 10;

export const formatRemaining = (ms: number) => {
    const total = Math.ceil(ms / 1000);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const mm = String(m).padStart(2, "0");
    const ss = String(s).padStart(2, "0");
    return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
};

/** Break-glass dialog: a written reason (>= 10 characters) is mandatory and stored in the school's audit log. */
export function BreakGlassDialog({ schoolId, open, onClose }: Readonly<{ schoolId: string; open: boolean; onClose: () => void }>) {
    const start = useStartSupportGrant(schoolId);
    const [reason, setReason] = useState("");
    const [error, setError] = useState<string>();
    const id = useId();
    const valid = reason.trim().length >= MIN_REASON;

    useEffect(() => { if (!open) { setReason(""); setError(undefined); } }, [open]);

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!valid || start.isPending) return;
        setError(undefined);
        start.mutate(reason.trim(), {
            onSuccess: onClose,
            onError: (err) => setError(apiMessage(err, "เข้าโหมดช่วยเหลือไม่สำเร็จ กรุณาลองใหม่")),
        });
    };

    return (
        <Dialog open={open} onClose={onClose} title="เข้าโหมดช่วยเหลือ (Break-glass)">
            <form onSubmit={submit} className="flex flex-col gap-4">
                <p className="text-[15px] leading-relaxed text-brand-muted">
                    โหมดนี้ให้ผู้ดูแลระบบแก้ไขข้อมูลของโรงเรียนนี้ได้ <b className="text-brand-dark">ชั่วคราว</b> <br /> ทุกการกระทำถูกบันทึกและ<b className="text-brand-dark">ผู้ดูแลโรงเรียนเห็นเหตุผลที่คุณระบุ</b> <br /> ใช้เมื่อโรงเรียนขอความช่วยเหลือเท่านั้น
                </p>
                <label htmlFor={id} className="flex flex-col gap-1.5 text-sm font-semibold">
                    เหตุผลที่ต้องเข้าโหมดช่วยเหลือ
                    <textarea
                        id={id}
                        rows={3}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        aria-invalid={reason.length > 0 && !valid}
                        aria-describedby={`${id}-hint`}
                        placeholder="เช่น ผู้ดูแลโรงเรียนแจ้งว่าตั้งเวลาเปิดผิด ขอให้ช่วยแก้ (ตั๋ว #123)"
                        className="rounded-[10px] border-[1.5px] border-line px-3 py-2.5 font-app text-[15px] font-normal outline-none focus:border-primary-main focus:ring-2 focus:ring-primary-main/20 aria-[invalid=true]:border-danger-main"
                    />
                    <span id={`${id}-hint`} className={clsx("text-[13px] font-normal", reason.length > 0 && !valid ? "text-danger-text" : "text-brand-muted")}>
                        อย่างน้อย {MIN_REASON} ตัวอักษร ({reason.trim().length}/{MIN_REASON})
                    </span>
                </label>
                {error && <p role="alert" className="flex items-center gap-1.5 text-sm font-medium text-danger-text"><Icon name="alert" size={16} />{error}</p>}
                <div className="flex flex-wrap justify-end gap-2.5">
                    <ActionButton variant="outline" size="md" onClick={onClose} disabled={start.isPending}>ยกเลิก</ActionButton>
                    <ActionButton type="submit" variant="danger" size="md" disabled={!valid || start.isPending}>{start.isPending ? "กำลังเข้าโหมด..." : "เข้าโหมดช่วยเหลือ"}</ActionButton>
                </div>
            </form>
        </Dialog>
    );
}

/**
 * Persistent, sticky strip at the top of every school page for a system admin:
 *  - no grant  -> "read-only" + button to start break-glass
 *  - grant     -> amber / red countdown + "exit" button
 * It also listens for a 403 SYSADMIN_READ_ONLY from any write and offers break-glass in a toast.
 */
export function SchoolAccessBanner({ schoolId }: Readonly<{ schoolId: string }>) {
    const { sysadminReadOnly, canStartGrant, grant, remainingMs } = useSchoolAccess(schoolId);
    const end = useEndSupportGrant(schoolId);
    const [open, setOpen] = useState(false);

    useEffect(() => {
        if (!canStartGrant) return;
        const onDenied = (e: Event) => {
            (e as CustomEvent<{ handled: boolean }>).detail.handled = true;
            toast.error("ผู้ดูแลระบบแก้ไขข้อมูลโรงเรียนไม่ได้ในโหมดอ่านอย่างเดียว", {
                description: "ต้องเข้าโหมดช่วยเหลือ (Break-glass) พร้อมระบุเหตุผลก่อน",
                action: { label: "เข้าโหมดช่วยเหลือ", onClick: () => setOpen(true) },
                style: { fontFamily: "var(--font-kanit), system-ui, sans-serif" },
            });
        };
        window.addEventListener(SYSADMIN_READ_ONLY_EVENT, onDenied);
        return () => window.removeEventListener(SYSADMIN_READ_ONLY_EVENT, onDenied);
    }, [canStartGrant]);

    if (!sysadminReadOnly && !grant) return null;

    const urgent = !!grant && remainingMs <= 5 * 60 * 1000;
    const tone = grant ? (urgent ? "border-danger-main bg-danger-light" : "border-[#FFD2BD] bg-brand-orange-light") : "border-primary-border bg-ground-blue";

    return (
        <>
            <div
                role={grant ? "timer" : "status"}
                aria-live={urgent ? "assertive" : "off"}
                className={clsx("no-print sticky top-[var(--mobile-nav-h,0px)] z-30 -mx-1 mb-5 flex flex-wrap items-center gap-x-4 gap-y-2.5 rounded-2xl border-[1.5px] px-4 py-3 text-brand-dark shadow-sm md:top-3", tone)}
            >
                <Icon name={grant ? "alert" : "shield"} size={22} className={clsx("shrink-0", urgent ? "text-danger-main" : grant ? "text-brand-orange-text" : "text-primary-dark")} />
                {grant ? (
                    <>
                        <span className="flex min-w-0 flex-1 basis-64 flex-col gap-0.5">
                            <span className="text-[15px] font-bold">
                                โหมดช่วยเหลือ (Break-glass) · เหลือ <span className="tabular-nums" aria-label={`เหลือเวลา ${formatRemaining(remainingMs)}`}>{formatRemaining(remainingMs)}</span>
                            </span>
                            <span className="truncate text-[13px] text-slate" title={grant.reason}>เหตุผล: {grant.reason} · ทุกการกระทำถูกบันทึกให้ผู้ดูแลโรงเรียนเห็น</span>
                        </span>
                        <ActionButton variant={urgent ? "danger" : "outline"} size="md" disabled={end.isPending} onClick={() => end.mutate()}>
                            {end.isPending ? "กำลังออก..." : "ออกจากโหมดช่วยเหลือ"}
                        </ActionButton>
                    </>
                ) : (
                    <>
                        <span className="flex min-w-0 flex-1 basis-64 flex-col gap-0.5">
                            <span className="text-[15px] font-bold">โหมดอ่านอย่างเดียว</span>
                            <span className="text-[13px] text-slate">คุณดูโรงเรียนนี้ในฐานะผู้ดูแลระบบ ปุ่มแก้ไขทั้งหมดถูกปิดไว้ จนกว่าจะเข้าโหมดช่วยเหลือ</span>
                        </span>
                        <ActionButton variant="outline" size="md" onClick={() => setOpen(true)}>เข้าโหมดช่วยเหลือ (Break-glass)</ActionButton>
                    </>
                )}
            </div>
            <BreakGlassDialog schoolId={schoolId} open={open} onClose={() => setOpen(false)} />
        </>
    );
}
