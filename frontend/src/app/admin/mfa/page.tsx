"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CenteredScreen } from "@/components/users/StudentShell";
import { Card, ErrorState, Icon, Logo, Skeleton } from "@/components/ui/kit";
import { MFA_APP_NAME, MFA_CODE_ERROR_FORMAT, MFA_CODE_ERROR_WRONG } from "@/components/auth/MfaGuide";
import { MfaEnrollPanel } from "@/components/auth/MfaEnrollPanel";
import { MfaVerifyPanel } from "@/components/auth/MfaVerifyPanel";
import { getSupabase } from "@/lib/supabase/client";

type Mode = "loading" | "enroll" | "verify" | "error";
interface Enrollment { factorId: string; qr: string; secret: string }

/** TOTP enrol (first time) / verify (every session). Verifying upgrades the session to aal2, which the API requires for /admin/*. */
export default function AdminMfaPage() {
    const router = useRouter();
    const params = useSearchParams();
    const next = (() => { const n = params.get("next"); return n && n.startsWith("/admin") && !n.startsWith("//") ? n : "/admin/schools"; })();

    const [mode, setMode] = useState<Mode>("loading");
    const [factorId, setFactorId] = useState<string>();
    const [enrollment, setEnrollment] = useState<Enrollment>();
    const [code, setCode] = useState("");
    const [error, setError] = useState<string>();
    const [busy, setBusy] = useState(false);
    const started = useRef(false);

    const init = useCallback(async () => {
        setMode("loading");
        const mfa = getSupabase().auth.mfa;
        try {
            const { data, error: listErr } = await mfa.listFactors();
            if (listErr) throw listErr;

            const verified = data.totp[0]; // `totp` only lists verified factors
            if (verified) {
                setFactorId(verified.id);
                return setMode("verify");
            }

            // Leftovers from an abandoned enrolment would block a new one with the same name → drop them first.
            for (const f of data.all.filter((x) => x.factor_type === "totp" && x.status === "unverified")) await mfa.unenroll({ factorId: f.id });

            const { data: enrolled, error: enrollErr } = await mfa.enroll({ factorType: "totp", friendlyName: MFA_APP_NAME });
            if (enrollErr) throw enrollErr;
            setFactorId(enrolled.id);
            setEnrollment({ factorId: enrolled.id, qr: enrolled.totp.qr_code, secret: enrolled.totp.secret });
            setMode("enroll");
        } catch {
            setMode("error");
        }
    }, []);

    useEffect(() => {
        if (started.current) return;
        started.current = true;
        void init();
    }, [init]);

    const submit = async () => {
        if (!/^\d{6}$/.test(code)) return setError(MFA_CODE_ERROR_FORMAT);
        if (!factorId) return;

        setBusy(true);
        setError(undefined);
        const { error: verifyErr } = await getSupabase().auth.mfa.challengeAndVerify({ factorId, code });
        setBusy(false);
        if (verifyErr) return setError(MFA_CODE_ERROR_WRONG);
        router.replace(next);
    };

    return (
        <CenteredScreen tone="ground">
            <div className="flex items-center gap-2.5">
                <Logo size={32} />
                <span className="text-base font-bold">PromptServe Admin</span>
            </div>

            <Card className="flex flex-col gap-5 p-5 sm:p-6">
                <div className="flex items-start gap-3">
                    <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-light text-primary-dark"><Icon name="shield" size={22} /></span>
                    <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-semibold text-primary-dark">แอดมินแพลตฟอร์ม</span>
                        <h1 className="text-[24px] font-bold leading-tight">{mode === "enroll" ? "ตั้งค่าการยืนยันตัวตน 2 ชั้น" : "ยืนยันตัวตน 2 ชั้น"}</h1>
                    </div>
                </div>

                {mode === "loading" && <div role="status" aria-label="กำลังโหลด" className="flex flex-col gap-3"><Skeleton className="h-48 w-48 rounded-2xl" /><Skeleton className="h-12 w-full rounded-[10px]" /></div>}
                {mode === "error" && <ErrorState message="เริ่มการยืนยันตัวตนไม่สำเร็จ (ตรวจว่าเปิด MFA แบบ TOTP ใน Supabase แล้ว)" onRetry={() => void init()} />}

                {mode === "enroll" && enrollment && (
                    <MfaEnrollPanel enrollment={enrollment} code={code} onCodeChange={setCode} onSubmit={() => void submit()} busy={busy} error={error} />
                )}
                {mode === "verify" && (
                    <MfaVerifyPanel
                        code={code}
                        onCodeChange={setCode}
                        onSubmit={() => void submit()}
                        busy={busy}
                        error={error}
                        systemAdmin
                        onFactorChange={(newId) => setFactorId(newId)}
                        submitLabel="ยืนยันและเข้าหน้าแอดมิน"
                        why="หน้าแอดมินจัดการข้อมูลทุกโรงเรียน จึงต้องยืนยันตัวตนด้วยรหัสจากมือถือของคุณทุกครั้งที่เข้าสู่ระบบ"
                    />
                )}
            </Card>
        </CenteredScreen>
    );
}
