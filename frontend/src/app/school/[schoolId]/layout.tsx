"use client";

import { use, useCallback, useEffect } from "react";
import { usePathname } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { AuthGuard } from "@/auth/auth.guard";
import { canUseSchool, postLoginPath } from "@/auth/access";
import type { User } from "@/auth/auth.types";
import { prefetchSchoolOverview } from "@/lib/prefetch/school";

/**
 * Membership gate: only members of *this* school (or the platform admin) get in. This is a UX guard –
 * the backend `SchoolScopeGuard` is what actually protects `/schools/:schoolId/*`.
 */
export default function SchoolLayout({ children, params }: Readonly<{ children: React.ReactNode; params: Promise<{ schoolId: string }> }>) {
    const { schoolId } = use(params);
    const qc = useQueryClient();
    const onOverview = usePathname() === `/school/${schoolId}`;
    // Effects run while the guard below is still resolving auth, so the overview's requests overlap it.
    useEffect(() => { if (onOverview) prefetchSchoolOverview(qc, schoolId); }, [qc, schoolId, onOverview]);
    const allow = useCallback((user: User) => canUseSchool(user, schoolId), [schoolId]);

    return <AuthGuard allow={allow} fallback={postLoginPath} optimistic>{children}</AuthGuard>;
}
