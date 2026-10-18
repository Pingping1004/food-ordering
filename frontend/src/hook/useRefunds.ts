import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as svc from "@/lib/services/refunds";
import { toastError, toastSuccess } from "@/components/ui/Toast";
import { isSysadminReadOnlyError, notifySysadminReadOnly } from "@/lib/api";
import type { RefundDecisionAction, RefundRequest, RefundRequestStatus } from "@/lib/schema";

export const key = {
    school: (id: string) => ["school", id, "refunds"] as const,
    list: (id: string, status?: string) => ["school", id, "refunds", "list", status ?? "all"] as const,
    week: (id: string) => ["school", id, "refunds", "week"] as const,
    summary: (id: string) => ["school", id, "refunds", "summary"] as const,
    mine: ["my-refunds"] as const,
    shop: (rid: string, status?: string) => ["restaurant", rid, "refunds", status ?? "all"] as const,
};

export const STALE = 30 * 1000;
const REFRESH = 60 * 1000;
const flatten = (pages?: { items: RefundRequest[] }[]) => pages?.flatMap((p) => p.items) ?? [];

/* ───────── school admin ───────── */

/** One status (or all) at a time, cursor paged – the API keeps oldest-pending-first for PENDING. */
export function useSchoolRefunds(schoolId: string, status?: RefundRequestStatus) {
    const q = useInfiniteQuery({
        queryKey: key.list(schoolId, status),
        queryFn: ({ pageParam }) => svc.listSchoolRefunds(schoolId, { status, cursor: pageParam }),
        initialPageParam: undefined as string | undefined,
        getNextPageParam: (last) => last.nextCursor ?? undefined,
        staleTime: STALE,
        refetchInterval: REFRESH,
    });
    return { ...q, items: flatten(q.data?.pages) };
}

export const useRefundSummary = (schoolId: string) =>
    useQuery({ queryKey: key.summary(schoolId), queryFn: () => svc.getSchoolRefundSummary(schoolId), staleTime: STALE, refetchInterval: REFRESH });

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** The summary has no "refunded this week" figure, so count it from the newest REFUNDED rows. `more` = the first page was all within the week. */
export const useRefundedThisWeek = (schoolId: string) =>
    useQuery({
        queryKey: key.week(schoolId),
        queryFn: async () => {
            const page = await svc.listSchoolRefunds(schoolId, { status: "REFUNDED", limit: 100 });
            const since = Date.now() - WEEK_MS;
            const n = page.items.filter((r) => r.refundedAt && new Date(r.refundedAt).getTime() >= since).length;
            return { count: n, more: n === page.items.length && !!page.nextCursor };
        },
        staleTime: STALE,
        refetchInterval: REFRESH,
    });

export const useRefundDetail = (schoolId: string, id: string | undefined) =>
    useQuery({ queryKey: [...key.school(schoolId), "detail", id], queryFn: () => svc.getSchoolRefund(schoolId, id as string), enabled: !!id, staleTime: STALE });

const DONE: Record<RefundDecisionAction, string> = {
    approve: "อนุมัติคำขอคืนเงินแล้ว",
    reject: "ไม่อนุมัติคำขอแล้ว นักเรียนจะเห็นเหตุผล",
    mark_refunded: "บันทึกว่าโอนคืนแล้ว",
};

export function useDecideRefund(schoolId: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (v: { id: string; action: RefundDecisionAction; note?: string }) => svc.decideRefund(schoolId, v.id, v.action, v.note),
        onSuccess: (_d, v) => { toastSuccess(DONE[v.action]); qc.invalidateQueries({ queryKey: key.school(schoolId) }); },
        onError: (err) => (isSysadminReadOnlyError(err) ? notifySysadminReadOnly() : toastError("ทำรายการไม่สำเร็จ กรุณาลองใหม่", err)),
    });
}

/* ───────── student ───────── */

export const useMyRefunds = (enabled = true) =>
    useQuery({ queryKey: key.mine, queryFn: svc.listMyRefundRequests, staleTime: STALE, enabled, refetchInterval: REFRESH });

export function useCreateRefund(orderId: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (input: svc.CreateRefundInput) => svc.createRefundRequest(orderId, input),
        onSuccess: () => { qc.invalidateQueries({ queryKey: key.mine }); qc.invalidateQueries({ queryKey: ["my-orders"] }); },
        // the page shows the API's reason (already requested / not paid / window expired) inline
    });
}

/* ───────── shop (read-only) ───────── */

export function useShopRefunds(restaurantId: string, status?: RefundRequestStatus) {
    const q = useInfiniteQuery({
        queryKey: key.shop(restaurantId, status),
        queryFn: ({ pageParam }) => svc.listRestaurantRefundRequests(restaurantId, { status, cursor: pageParam }),
        initialPageParam: undefined as string | undefined,
        getNextPageParam: (last) => last.nextCursor ?? undefined,
        staleTime: STALE,
        refetchInterval: REFRESH,
        enabled: !!restaurantId,
    });
    return { ...q, items: flatten(q.data?.pages) };
}
