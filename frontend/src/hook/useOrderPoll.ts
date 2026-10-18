"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { routeForOrder, screenForOrder, type StudentOrder, type StudentScreen } from "@/lib/order-flow";

/**
 * Polls `GET /order/:id` (public route guarded by the `x-order-secret` the browser stored at checkout).
 * If the order belongs on a different screen it redirects there, so every student page can call this
 * with `screen` = "the screen I am" and never needs its own status switch.
 */
export function useOrderPoll(orderId: string | undefined, screen: StudentScreen, { intervalMs = 3000 }: { intervalMs?: number } = {}) {
    const router = useRouter();
    const [order, setOrder] = useState<StudentOrder>();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const fails = useRef(0);
    const timer = useRef<ReturnType<typeof setInterval> | null>(null);

    const stop = useCallback(() => {
        if (timer.current) clearInterval(timer.current);
        timer.current = null;
    }, []);

    const fetchOrder = useCallback(async () => {
        if (!orderId || document.hidden) return;
        try {
            const secret = localStorage.getItem(`orderSecret:${orderId}`);
            const res = await api.get<StudentOrder>(`/order/${orderId}`, { headers: { "x-order-secret": secret } });
            fails.current = 0;
            setError(false);
            setOrder(res.data);
            setLoading(false);

            if (screenForOrder(res.data) !== screen) {
                stop();
                router.replace(routeForOrder(orderId, res.data));
            }
        } catch {
            fails.current += 1;
            if (fails.current >= 3) {
                stop();
                setError(true);
                setLoading(false);
            }
        }
    }, [orderId, screen, router, stop]);

    const start = useCallback(() => {
        stop();
        fails.current = 0;
        setError(false);
        void fetchOrder();
        timer.current = setInterval(fetchOrder, intervalMs);
    }, [fetchOrder, intervalMs, stop]);

    useEffect(() => {
        start();
        const onVisible = () => { if (!document.hidden) void fetchOrder(); };
        document.addEventListener("visibilitychange", onVisible);
        return () => { stop(); document.removeEventListener("visibilitychange", onVisible); };
    }, [start, fetchOrder, stop]);

    return { order, loading, error, retry: start, refresh: fetchOrder };
}
