"use client";

import { useEffect } from "react";
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { isAxiosError, type AxiosResponse } from "axios";
import { api } from "@/lib/api";
import { pollIntervalFor, withJitter, type StudentOrder } from "@/lib/order-flow";
import { getNotificationPermission, readStoredPushToken, subscribeToForegroundMessages } from "@/lib/firebase-messaging";

/** One cache entry per order, shared by the shop-list card and every order screen (payment, wait, done, failed, slip-failed). */
export const studentOrderKey = (orderId: string | null | undefined) => ["student-order", orderId] as const;
/** The small status record that screens poll; the full order (above) is reloaded only when it changes. */
export const studentOrderStateKey = (orderId: string | null | undefined) => ["student-order-state", orderId] as const;

export type StudentOrderState = Pick<StudentOrder, "status" | "paymentStatus"> & {
    acceptAt: string | null;
    updatedAt?: string;
    /** From the server's `X-Poll-After` (0 = stop); null when the server did not send one. */
    pollAfterMs: number | null;
};

const secretHeader = (orderId: string) => ({ "x-order-secret": localStorage.getItem(`orderSecret:${orderId}`) });

/** This device gets order pushes: the server then lets the accept-wait poll slower. */
const pushOn = () => getNotificationPermission() === "granted" && !!readStoredPushToken();

function pollAfterMs(res: AxiosResponse): number | null {
    const raw = res.headers["x-poll-after"];
    if (raw === undefined || raw === null || raw === "") return null;
    const s = Number(raw);
    return Number.isFinite(s) && s >= 0 ? s * 1000 : null;
}

const stateOf = (o: StudentOrder, pollAfter: number | null): StudentOrderState => ({
    status: o.status,
    paymentStatus: o.paymentStatus,
    acceptAt: o.acceptAt ?? null,
    updatedAt: o.updatedAt,
    pollAfterMs: pollAfter,
});

/** `GET /order/:id`: the whole order (items, shop, QR). Also seeds the status record so polling starts from it. */
export async function fetchStudentOrder(orderId: string, queryClient?: QueryClient): Promise<StudentOrder> {
    const res = await api.get<StudentOrder>(`/order/${orderId}`, { headers: secretHeader(orderId), params: pushOn() ? { push: 1 } : undefined });
    queryClient?.setQueryData(studentOrderStateKey(orderId), stateOf(res.data, pollAfterMs(res)));
    return res.data;
}

/** `GET /order/:id/status`: one row, four fields. Falls back to the full order on a server that predates the route. */
async function fetchStudentOrderState(orderId: string, queryClient: QueryClient): Promise<StudentOrderState> {
    try {
        const res = await api.get<Omit<StudentOrderState, "pollAfterMs">>(`/order/${orderId}/status`, {
            headers: secretHeader(orderId),
            params: pushOn() ? { push: 1 } : undefined,
        });
        return { ...res.data, pollAfterMs: pollAfterMs(res) };
    } catch (err) {
        if (!isAxiosError(err) || err.response?.status !== 404) throw err;
        const full = await fetchStudentOrder(orderId, queryClient);
        queryClient.setQueryData(studentOrderKey(orderId), full);
        return stateOf(full, null);
    }
}

/** The status record says the order moved on since the full copy was loaded. */
function isNewer(state: StudentOrderState, full: StudentOrder | undefined): boolean {
    if (!full) return false;
    if (state.status !== full.status || state.paymentStatus !== full.paymentStatus || state.acceptAt !== (full.acceptAt ?? null)) return true;
    return !!state.updatedAt && !!full.updatedAt && new Date(state.updatedAt) > new Date(full.updatedAt);
}

/**
 * Order status changes every few seconds, so the full order is never "fresh" (staleTime 0): cached data paints the
 * next screen instantly while a refetch runs.
 *
 * `poll`: re-check on a schedule. Polls hit the light `/status` route; the full order is reloaded only when that
 * reports a change. The server sets the pace (`X-Poll-After`, see backend poll-policy.ts; `pollIntervalFor` is the
 * fallback), with ±20 % jitter so a whole class does not poll in step. `minPollMs` lets low-priority places (the
 * shop-list card) poll less often. Polling pauses while the tab is hidden, the full order refetches when it is shown
 * again, polling stops after retries fail or when the order is finished, and a push about this order (accepted /
 * ready / delay) refreshes it immediately.
 */
export function useStudentOrder(orderId: string | null | undefined, { poll = false, minPollMs = 0 }: { poll?: boolean; minPollMs?: number } = {}) {
    const queryClient = useQueryClient();
    const query = useQuery({
        queryKey: studentOrderKey(orderId),
        queryFn: () => fetchStudentOrder(orderId as string, queryClient),
        enabled: !!orderId,
        staleTime: 0,
        refetchOnWindowFocus: true,
    });

    const state = useQuery({
        queryKey: studentOrderStateKey(orderId),
        queryFn: () => fetchStudentOrderState(orderId as string, queryClient),
        // Seeded by the full fetch above, so the first poll waits one interval instead of repeating that request.
        enabled: poll && !!orderId && query.isSuccess,
        staleTime: Infinity,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        refetchIntervalInBackground: false,
        refetchInterval: (q) => {
            if (q.state.status === "error") return false;
            const s = q.state.data;
            const ms = s?.pollAfterMs ?? pollIntervalFor(s, { push: pushOn() });
            if (ms === false || ms === 0) return false;
            return withJitter(Math.max(ms, minPollMs));
        },
    });

    const { refetch } = query;
    const stateUpdatedAt = state.dataUpdatedAt;
    useEffect(() => {
        if (!poll || !orderId) return;
        const s = queryClient.getQueryData<StudentOrderState>(studentOrderStateKey(orderId));
        const full = queryClient.getQueryData<StudentOrder>(studentOrderKey(orderId));
        if (s && isNewer(s, full) && !queryClient.isFetching({ queryKey: studentOrderKey(orderId) })) void refetch();
    }, [poll, orderId, stateUpdatedAt, queryClient, refetch]);

    useEffect(() => {
        if (!poll || !orderId || getNotificationPermission() !== "granted") return;
        let unsubscribe: (() => void) | undefined;
        let cancelled = false;
        void subscribeToForegroundMessages((payload) => {
            const link = payload.data?.link ?? payload.fcmOptions?.link ?? "";
            if (link.includes(orderId)) void refetch();
        }).then((u) => (cancelled ? u() : (unsubscribe = u)));
        return () => { cancelled = true; unsubscribe?.(); };
    }, [poll, orderId, refetch]);

    return query;
}
