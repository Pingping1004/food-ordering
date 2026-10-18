"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AuthGuard } from "@/auth/auth.guard";
import { useAuth } from "@/auth/auth.hooks";
import { isSystemAdmin } from "@/auth/access";
import { UserRole } from "@/auth/auth.types";
import LoadingPage from "@/components/LoadingPage";
import { getSupabase } from "@/lib/supabase/client";

/**
 * System-admin area = role ADMIN **and** a TOTP-verified session (aal2). UX gate only – the API's `@SystemAdmin()` re-checks both.
 * Anyone who is not an admin is sent to `/` with no hint that these pages exist; an admin without MFA is sent to /admin/mfa.
 */
function MfaGate({ children }: Readonly<{ children: React.ReactNode }>) {
    const { user } = useAuth();
    const pathname = usePathname() ?? "";
    const router = useRouter();
    const [ready, setReady] = useState(false);
    const admin = isSystemAdmin(user);

    useEffect(() => {
        if (!admin) return;

        let active = true;
        getSupabase().auth.mfa.getAuthenticatorAssuranceLevel().then(({ data }) => {
            if (!active) return;
            if (data?.currentLevel === "aal2" || pathname.startsWith("/admin/mfa")) return setReady(true);
            router.replace(`/admin/mfa?next=${encodeURIComponent(pathname)}`);
        }).catch(() => router.replace("/"));
        return () => { active = false; };
    }, [admin, pathname, router]);

    if (!admin || !ready) return <LoadingPage />;
    return <>{children}</>;
}

export function AdminGate({ children }: Readonly<{ children: React.ReactNode }>) {
    return (
        <AuthGuard role={UserRole.admin} fallback="/">
            <MfaGate>{children}</MfaGate>
        </AuthGuard>
    );
}
