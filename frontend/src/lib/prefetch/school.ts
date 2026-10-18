import type { QueryClient } from "@tanstack/react-query";
import { key as schoolKey } from "@/hook/useSchool";
import { key as refundKey, STALE as REFUND_STALE } from "@/hook/useRefunds";
import { complaintsKey } from "@/components/complaints/ComplaintsCard";
import * as schools from "@/lib/services/school";
import { getSchoolRefundSummary } from "@/lib/services/refunds";
import { listSchoolComplaints } from "@/lib/services/complaints";

const FIVE_MIN = 5 * 60 * 1000;

/**
 * Starts the school overview's requests without waiting for the auth profile (`/user/profile`) to resolve.
 * Without this the page only mounts after auth, so its 4 requests run *after* the profile call instead of beside it.
 * Safe: the edge middleware already requires a session and the API enforces membership (`SchoolScopeGuard`) –
 * a non-member's prefetch just 403s into the query cache and the guard redirects them. Keys and fetchers are shared
 * with the hooks, so the page reads these results as cache hits. Errors are swallowed by `prefetchQuery`.
 */
export function prefetchSchoolOverview(qc: QueryClient, schoolId: string) {
    void qc.prefetchQuery({ queryKey: schoolKey.school(schoolId), queryFn: () => schools.getSchool(schoolId), staleTime: FIVE_MIN });
    void qc.prefetchQuery({ queryKey: schoolKey.summary(schoolId, "this_week"), queryFn: () => schools.getSchoolSummary(schoolId, "this_week"), staleTime: FIVE_MIN });
    void qc.prefetchQuery({ queryKey: refundKey.summary(schoolId), queryFn: () => getSchoolRefundSummary(schoolId), staleTime: REFUND_STALE });
    void qc.prefetchQuery({ queryKey: complaintsKey(schoolId), queryFn: () => listSchoolComplaints(schoolId, "OPEN"), staleTime: FIVE_MIN });
}
