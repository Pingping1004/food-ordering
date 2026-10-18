"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, Chip, ActionButton, ErrorState, Icon, Notice, Skeleton } from "@/components/ui/kit";
import { Dialog } from "@/components/ui/Dialog";
import { toastError, toastSuccess } from "@/components/ui/Toast";
import { getSupabase } from "@/lib/supabase/client";
import { MFA_APP_NAME, MFA_CODE_ERROR_FORMAT, MFA_CODE_ERROR_WRONG, MfaWhereFrom } from "./MfaGuide";
import { MfaEnrollPanel, type MfaEnrollment } from "./MfaEnrollPanel";
import { MfaVerifyPanel } from "./MfaVerifyPanel";

type Status = { state: "loading" } | { state: "error" } | { state: "off" } | { state: "on"; factorId: string };

/** Optional 2-step verification (TOTP) for every account. System admins cannot turn it off – the API requires it for /admin. */
export function MfaSettings({ systemAdmin, recommended }: Readonly<{ systemAdmin?: boolean; recommended?: boolean }>) {
    const [status, setStatus] = useState<Status>({ state: "loading" });
    const [dialog, setDialog] = useState<"enable" | "disable" | null>(null);
    const [enrollment, setEnrollment] = useState<MfaEnrollment>();
    const [code, setCode] = useState("");
    const [error, setError] = useState<string>();
    const [busy, setBusy] = useState(false);

    const refresh = useCallback(async () => {
        try {
            const { data, error: err } = await getSupabase().auth.mfa.listFactors();
            if (err) throw err;
            const verified = data.totp[0]; // `totp` only lists verified factors
            setStatus(verified ? { state: "on", factorId: verified.id } : { state: "off" });
        } catch {
            setStatus({ state: "error" });
        }
    }, []);

    useEffect(() => { void refresh(); }, [refresh]);

    const reset = () => { setCode(""); setError(undefined); setBusy(false); };

    /** Abandoned, never-verified factors would block a new enrolment with the same name. */
    const dropUnverified = async () => {
        const mfa = getSupabase().auth.mfa;
        const { data } = await mfa.listFactors();
        for (const f of data?.all.filter((x) => x.factor_type === "totp" && x.status === "unverified") ?? []) await mfa.unenroll({ factorId: f.id });
    };

    const openEnable = async () => {
        reset();
        setEnrollment(undefined);
        setDialog("enable");
        try {
            await dropUnverified();
            const { data, error: err } = await getSupabase().auth.mfa.enroll({ factorType: "totp", friendlyName: MFA_APP_NAME });
            if (err) throw err;
            setEnrollment({ factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
        } catch (err) {
            setDialog(null);
            toastError("เริ่มตั้งค่าการยืนยันตัวตนสองชั้นไม่สำเร็จ กรุณาลองใหม่", err);
        }
    };

    const closeEnable = () => {
        const pending = enrollment;
        setDialog(null);
        setEnrollment(undefined);
        reset();
        if (pending) void getSupabase().auth.mfa.unenroll({ factorId: pending.factorId }).catch(() => undefined); // best effort cleanup
    };

    const confirmEnable = async () => {
        if (!enrollment) return;
        if (!/^\d{6}$/.test(code)) return setError(MFA_CODE_ERROR_FORMAT);
        setBusy(true);
        setError(undefined);
        const { error: err } = await getSupabase().auth.mfa.challengeAndVerify({ factorId: enrollment.factorId, code });
        setBusy(false);
        if (err) return setError(MFA_CODE_ERROR_WRONG);
        setDialog(null);
        setEnrollment(undefined);
        reset();
        toastSuccess("เปิดการยืนยันตัวตน 2 ชั้นแล้ว");
        await refresh();
    };

    /** Removing a verified factor needs an aal2 session → ask for the current code first. */
    const confirmDisable = async () => {
        if (status.state !== "on") return;
        if (!/^\d{6}$/.test(code)) return setError(MFA_CODE_ERROR_FORMAT);
        setBusy(true);
        setError(undefined);
        const mfa = getSupabase().auth.mfa;
        const { error: verifyErr } = await mfa.challengeAndVerify({ factorId: status.factorId, code });
        if (verifyErr) { setBusy(false); return setError(MFA_CODE_ERROR_WRONG); }
        const { error: unenrollErr } = await mfa.unenroll({ factorId: status.factorId });
        setBusy(false);
        if (unenrollErr) return setError("ปิดการใช้งานไม่สำเร็จ กรุณาลองใหม่");
        setDialog(null);
        reset();
        toastSuccess("ปิดการยืนยันตัวตน 2 ชั้นแล้ว");
        await refresh();
    };

    return (
        <Card id="security" className="flex flex-col gap-3 p-4" aria-labelledby="mfa-heading">
            <div className="flex items-start gap-3">
                <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-light text-primary-dark"><Icon name="shield" size={22} /></span>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <h2 id="mfa-heading" className="text-base font-bold">ยืนยันตัวตน 2 ชั้น</h2>
                    <p className="text-sm leading-relaxed text-brand-muted">
                        {systemAdmin
                            ? "บังคับสำหรับแอดมินแพลตฟอร์ม เพราะบัญชีนี้เข้าถึงข้อมูลทุกโรงเรียน"
                            : recommended
                                ? "แนะนำ: บัญชีของคุณจัดการข้อมูลโรงเรียน/ร้าน การเปิดนี้ช่วยกันคนอื่นเข้าบัญชีแม้รู้รหัสผ่านของคุณ"
                                : "เป็นตัวเลือก ช่วยให้บัญชีปลอดภัยขึ้นโดยต้องใช้รหัสจากแอปบนมือถือร่วมกับรหัสผ่าน"}
                    </p>
                </div>
            </div>

            {status.state === "loading" && <div role="status" aria-label="กำลังโหลด"><Skeleton className="h-11 w-full rounded-[10px]" /></div>}
            {status.state === "error" && <ErrorState message="ตรวจสถานะการยืนยันตัวตนไม่สำเร็จ" onRetry={() => { setStatus({ state: "loading" }); void refresh(); }} />}

            {status.state === "on" && (
                <>
                    <div><Chip tone="success" icon="check">เปิดอยู่</Chip></div>
                    {systemAdmin
                        ? <Notice tone="neutral" icon="lock"><span className="text-[14px]">ปิดไม่ได้สำหรับแอดมินแพลตฟอร์ม เพราะระบบเซิร์ฟเวอร์ต้องการการยืนยัน 2 ชั้นก่อนเข้าหน้าแอดมิน</span></Notice>
                        : <ActionButton variant="dangerOutline" size="md" onClick={() => { reset(); setDialog("disable"); }}>ปิดใช้งาน</ActionButton>}
                </>
            )}

            {status.state === "off" && (
                <>
                    <div><Chip tone="neutral" icon="alert">ยังไม่เปิด</Chip></div>
                    {systemAdmin && <Notice tone="orange" icon="alert" role="alert"><span className="text-[14px]">ต้องเปิดก่อนจึงเข้าหน้าแอดมินได้</span></Notice>}
                    <ActionButton size="md" onClick={() => void openEnable()}>เปิดใช้งาน</ActionButton>
                </>
            )}

            <Dialog open={dialog === "enable"} onClose={closeEnable} title="เปิดการยืนยันตัวตน 2 ชั้น" wide>
                {enrollment ? (
                    <MfaEnrollPanel enrollment={enrollment} code={code} onCodeChange={setCode} onSubmit={() => void confirmEnable()} busy={busy} error={error} />
                ) : (
                    <div role="status" aria-label="กำลังเตรียม QR" className="flex flex-col gap-3"><MfaWhereFrom /><Skeleton className="h-48 w-48 self-center rounded-2xl" /></div>
                )}
            </Dialog>

            <Dialog open={dialog === "disable"} onClose={() => { setDialog(null); reset(); }} title="ปิดการยืนยันตัวตน 2 ชั้น?">
                <Notice tone="orange" icon="alert"><span className="text-[14px]">บัญชีจะปลอดภัยน้อยลง เพราะเข้าสู่ระบบได้ด้วยรหัสผ่านอย่างเดียว</span></Notice>
                <MfaVerifyPanel code={code} onCodeChange={setCode} onSubmit={() => void confirmDisable()} busy={busy} error={error} submitLabel="ยืนยันและปิดใช้งาน" onCancel={() => { setDialog(null); reset(); }} />
            </Dialog>
        </Card>
    );
}
