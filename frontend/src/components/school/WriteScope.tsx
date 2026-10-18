"use client";

import { useSchoolAccess } from "@/hook/useSchoolAccess";

/**
 * Wraps school write controls. While the viewer may not write (system admin outside break-glass, school staff),
 * every input / button inside is natively disabled via `<fieldset disabled>`. The box itself is `display: contents`
 * so layout does not change. Reading the data stays possible.
 */
export function WriteScope({ schoolId, children }: Readonly<{ schoolId: string; children: React.ReactNode }>) {
    const { canWrite, hint } = useSchoolAccess(schoolId);
    return (
        <fieldset disabled={!canWrite} title={hint} className="contents">
            {children}
        </fieldset>
    );
}
