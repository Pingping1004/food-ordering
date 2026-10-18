"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { routeForOrder, screenForOrder, type StudentScreen } from "@/lib/order-flow";
import { useStudentOrder } from "./useStudentOrder";

/**
 * Polls the order (shared React Query cache, see `useStudentOrder`). If the order belongs on a different screen it
 * redirects there, so every student page can call this with `screen` = "the screen I am" and never needs its own status switch.
 */
export function useOrderPoll(orderId: string | undefined, screen: StudentScreen, { intervalMs = 3000 }: { intervalMs?: number } = {}) {
    const router = useRouter();
    const query = useStudentOrder(orderId, { pollMs: intervalMs });
    const redirected = useRef(false);
    const { data, isFetchedAfterMount, refetch } = query;

    useEffect(() => {
        // Only redirect on data fetched by this screen: the cached copy may predate the step that brought the student here
        // (e.g. still UNPAID right after paying), and acting on it would bounce them back.
        if (!orderId || !data || !isFetchedAfterMount || redirected.current) return;
        if (screenForOrder(data) !== screen) {
            redirected.current = true;
            router.replace(routeForOrder(orderId, data));
        }
    }, [orderId, data, isFetchedAfterMount, screen, router]);

    const refresh = () => void refetch();
    return { order: data, loading: query.isPending, error: query.isError, retry: refresh, refresh };
}
