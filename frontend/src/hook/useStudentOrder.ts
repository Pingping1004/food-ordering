"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { StudentOrder } from "@/lib/order-flow";

/** One cache entry per order, shared by the shop-list card and every order screen (payment, wait, done, failed, slip-failed). */
export const studentOrderKey = (orderId: string | null | undefined) => ["student-order", orderId] as const;

/** `GET /order/:id` is a public route guarded by the `x-order-secret` the browser stored at checkout. */
export async function fetchStudentOrder(orderId: string): Promise<StudentOrder> {
    const secret = localStorage.getItem(`orderSecret:${orderId}`);
    return (await api.get<StudentOrder>(`/order/${orderId}`, { headers: { "x-order-secret": secret } })).data;
}

/**
 * Order status changes every few seconds, so it is never "fresh" (staleTime 0): cached data paints the next screen
 * instantly while a refetch runs. Polling pauses while the tab is hidden and resumes (with a refetch) when it is shown.
 */
export function useStudentOrder(orderId: string | null | undefined, { pollMs }: { pollMs?: number } = {}) {
    return useQuery({
        queryKey: studentOrderKey(orderId),
        queryFn: () => fetchStudentOrder(orderId as string),
        enabled: !!orderId,
        staleTime: 0,
        refetchOnWindowFocus: true,
        refetchIntervalInBackground: false,
        // Stop polling once retries are exhausted; the screen shows its error + retry button instead of hammering the API.
        refetchInterval: pollMs ? (query) => (query.state.status === "error" ? false : pollMs) : false,
    });
}
