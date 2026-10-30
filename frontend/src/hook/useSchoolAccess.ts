"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/auth/auth.hooks";
import { READ_ONLY_REASON, activeSupportGrant, canStartSupportGrant, canWriteSchool, isSysadminReadOnly } from "@/auth/access";

/**
 * Single source of truth for "may I change things in this school?" on every /school/[schoolId]/** page.
 * Wraps the helpers in `auth/access.ts` and ticks once a second while a break-glass grant is running,
 * so controls lock again the moment it expires (and the profile is re-read).
 */
export function useSchoolAccess(schoolId: string) {
    const { user, refreshUser } = useAuth();
    const hasGrant = !!user?.supportGrant && user.supportGrant.schoolId === schoolId;
    const [now, setNow] = useState(() => Date.now());
    const refreshed = useRef<string | null>(null);

    useEffect(() => {
        if (!hasGrant) return;
        setNow(Date.now());
        const t = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(t);
    }, [hasGrant]);

    const grant = activeSupportGrant(user, schoolId, now);
    const canWrite = canWriteSchool(user, schoolId, now);
    const sysadminReadOnly = isSysadminReadOnly(user, schoolId, now);
    const remainingMs = grant ? Math.max(0, new Date(grant.expiresAt).getTime() - now) : 0;

    // The grant ran out while the page was open: re-read the profile so the server state and the UI agree.
    const expiredKey = hasGrant && !grant ? user?.supportGrant?.expiresAt ?? null : null;
    useEffect(() => {
        if (expiredKey && refreshed.current !== expiredKey) {
            refreshed.current = expiredKey;
            void refreshUser();
        }
    }, [expiredKey, refreshUser]);

    const hint = canWrite ? undefined : READ_ONLY_REASON;

    return {
        canWrite,
        /** System admin without membership and without an active grant. */
        sysadminReadOnly,
        canStartGrant: canStartSupportGrant(user, schoolId),
        grant,
        remainingMs,
        hint,
        /** Spread onto any write button: `<ActionButton {...writeProps} />`. */
        writeProps: canWrite ? ({} as const) : ({ disabled: true, title: hint, "aria-disabled": true } as const),
    };
}
