"use client";

import { isAxiosError } from "axios";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useState } from "react";

export function ReactQueryProvider({ children }: { children: React.ReactNode }) {
    const [queryClient] = useState(() => new QueryClient({
        defaultOptions: {
            queries: {
                retry: (failureCount, error: unknown) => {
                    const isAxios = isAxiosError(error);
                    const hasResponse = isAxios && error.response !== undefined;
                    const status = isAxios ? error.response?.status : undefined;
                    const code = isAxios ? error.code : undefined;

                    if (typeof status === "number" && status >= 400 && status < 500) return false;

                    // ⚠️ Timeout (slow network / backend lag)
                    if (code === "ECONNABORTED") return failureCount < 1;

                    // ⚠️ Network error (no response at all)
                    if (!hasResponse) return failureCount < 2;

                    // 🔥 Server error (5xx)
                    if (typeof status === "number" && status >= 500) return failureCount < 2;

                    return false;
                },
                retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5000),
                staleTime: 5 * 60 * 1000,
                refetchOnWindowFocus: false,
                refetchOnReconnect: true,
                gcTime: 10 * 60 * 1000,
                networkMode: 'online',
            },
        },
    }));

    return (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    )
}