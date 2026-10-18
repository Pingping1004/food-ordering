"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/auth/auth.hooks";
import { clearOnboardingMeta, getProfileApi, readOnboardingMeta, type SignupMeta } from "@/auth/auth.service";
import { hasSchool, isSystemAdmin, pendingSchoolMembership, postLoginPath } from "@/auth/access";
import { CenteredScreen } from "@/components/users/StudentShell";
import { ActionButton, ErrorState, Skeleton } from "@/components/ui/kit";
import { InviteCodeForm, inviteCodeError } from "@/components/onboarding/InviteCodeForm";
import { redeemCode, redeemLanding } from "@/lib/services/student";

type Phase = "working" | "need-code" | "error";

/**
 * Landing point after sign-up / e-mail confirmation (`/auth/callback?next=/onboarding`).
 * The invite code decides the role – nobody picks one:
 *   student → canteen · shop owner → register shop · shop staff / school admin → wait for approval.
 * No code saved at sign-up → ask for it here. (A school admin's code comes from the system admin who created the school.)
 */
function Onboarding() {
    const { user, refreshUser, logout } = useAuth();
    const router = useRouter();
    const [phase, setPhase] = useState<Phase>("working");
    const [formError, setFormError] = useState<string>();
    const [busy, setBusy] = useState(false);
    const meta = useRef<SignupMeta>({});
    const started = useRef(false);

    const finish = useCallback(async (target: string) => {
        try { await clearOnboardingMeta(); } catch { /* metadata is only a hint; leaving it is harmless */ }
        router.replace(target);
    }, [router]);

    /** Redeem → refresh the profile → route by what the code made the user. */
    const redeem = useCallback(async (code: string) => {
        const result = await redeemCode(code);
        const fresh = await getProfileApi();
        await refreshUser();
        await finish(redeemLanding(result, fresh));
    }, [refreshUser, finish]);

    const run = useCallback(async () => {
        if (!user) return;
        try {
            if (isSystemAdmin(user)) return router.replace("/admin/schools");
            meta.current = await readOnboardingMeta();
            const { invite_code: code } = meta.current;

            // Already set up (e.g. a second visit): nothing to redeem, go to the role's own home.
            if (hasSchool(user) || pendingSchoolMembership(user)) return await finish(postLoginPath(user));

            if (!code) return setPhase("need-code");
            try {
                await redeem(code);
            } catch (err) {
                setFormError(inviteCodeError(err));
                setPhase("need-code");
            }
        } catch {
            setPhase("error");
        }
    }, [user, router, finish, redeem]);

    useEffect(() => {
        if (!user || started.current) return;
        started.current = true;
        void run();
    }, [user, run]);

    const submitCode = async (code: string) => {
        setBusy(true);
        setFormError(undefined);
        try {
            await redeem(code);
        } catch (err) {
            setFormError(inviteCodeError(err));
        } finally {
            setBusy(false);
        }
    };

    return (
        <CenteredScreen>
            {phase === "working" && (
                <div role="status" aria-live="polite" className="flex flex-col gap-4">
                    <h1 className="text-[28px] font-bold leading-tight">กำลังตั้งค่าบัญชี...</h1>
                    <Skeleton className="h-14 w-full rounded-2xl" />
                    <Skeleton className="h-14 w-2/3 rounded-2xl" />
                </div>
            )}

            {phase === "need-code" && (
                <>
                    <div className="flex flex-col gap-2">
                        <span className="text-sm font-bold text-primary-dark">ขั้นแรก</span>
                        <h1 className="text-[28px] font-bold leading-tight">ใส่รหัสเชิญ</h1>
                        <p className="text-base leading-relaxed text-brand-muted">รหัสที่ได้รับจากโรงเรียนหรือเจ้าของร้านจะกำหนดว่าคุณเข้าร่วมในฐานะนักเรียน เจ้าของร้าน พนักงานร้าน หรือผู้ดูแลโรงเรียน</p>
                    </div>
                    <InviteCodeForm onSubmit={submitCode} busy={busy} error={formError} label="ใช้รหัสเชิญ" />
                    <ActionButton variant="ghost" size="md" className="!text-danger-text hover:!bg-danger-light" onClick={() => logout()}>ออกจากระบบ</ActionButton>
                </>
            )}

            {phase === "error" && <ErrorState message="ตั้งค่าบัญชีไม่สำเร็จ" onRetry={() => { setPhase("working"); void run(); }} />}
        </CenteredScreen>
    );
}

export default function OnboardingPage() {
    return <Onboarding />;
}
