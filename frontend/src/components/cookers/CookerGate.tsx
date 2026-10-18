"use client";

import { usePathname } from "next/navigation";
import { AuthGuard } from "@/auth/auth.guard";
import { canUseCooker } from "@/auth/access";

/** Registration + "waiting for approval" are open to any signed-in user; everything else needs a restaurant membership. */
const OPEN_TO_SIGNED_IN = ["/cooker/restaurant-register", "/cooker/pending"];

export function CookerGate({ children }: Readonly<{ children: React.ReactNode }>) {
    const pathname = usePathname() ?? "";
    const open = OPEN_TO_SIGNED_IN.some((p) => pathname.startsWith(p));

    return open ? <AuthGuard>{children}</AuthGuard> : <AuthGuard allow={canUseCooker}>{children}</AuthGuard>;
}
