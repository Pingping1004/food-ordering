"use client";

import clsx from "clsx";
import { useAuth } from "@/auth/auth.hooks";

/** Who is signed in: name (or email) plus the role they are acting as. Shown at the bottom of every sidebar / drawer. */
export function AccountBadge({ role, tone = "light" }: Readonly<{ role: string; tone?: "light" | "dark" }>) {
    const { user } = useAuth();
    if (!user) return null;
    const dark = tone === "dark";
    const primary = user.name?.trim() || user.email;
    const secondary = user.name?.trim() ? user.email : null;

    return (
        <div className={clsx("flex flex-col gap-0.5 rounded-[14px] px-3.5 py-3", dark ? "bg-white/10" : "bg-ground")} title={user.email}>
            <span className="truncate text-[15px] font-bold">{primary}</span>
            {secondary && <span className={clsx("truncate text-[13px]", dark ? "text-white/70" : "text-brand-muted")}>{secondary}</span>}
            <span className={clsx("mt-1 w-fit rounded-full px-2.5 py-0.5 text-xs font-semibold", dark ? "bg-white/15 text-white" : "bg-primary-light text-primary-dark")}>{role}</span>
        </div>
    );
}
