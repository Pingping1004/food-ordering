"use client";

import Link from "next/link";
import clsx from "clsx";
import { useAuth } from "@/auth/auth.hooks";
import { roleHomePath } from "@/auth/access";
import { Icon } from "@/components/ui/kit";

/**
 * "สั่งอาหาร" – staff and admins preorder through the student screens (/user/restaurant).
 * Icon-only below `sm` (always labelled for screen readers); `block` is the full-width row used in the school sidebar.
 */
export function OrderShortcut({ tone = "light", block, className }: Readonly<{ tone?: "light" | "dark"; block?: boolean; className?: string }>) {
    return (
        <Link
            href="/user/restaurant"
            aria-label="สั่งอาหาร"
            title="สั่งอาหาร"
            className={clsx(
                "inline-flex shrink-0 items-center justify-center gap-2 rounded-[10px] text-[15px] font-semibold",
                block ? "w-full justify-start px-3" : "min-w-11 px-2.5 sm:px-3.5",
                tone === "dark" ? "bg-white/15 text-white hover:bg-white/25 h-11" : "bg-primary-light text-primary-dark hover:bg-ground-blue h-11",
                className,
            )}
        >
            <Icon name="plate" size={20} />
            <span className={block ? "" : "hidden sm:inline"}>สั่งอาหาร</span>
        </Link>
    );
}

/** Student screens, for someone who also holds another role: one tap back to that role's own page (or the picker for several). */
export function RoleHomeLink({ tone = "light" }: Readonly<{ tone?: "light" | "dark" }>) {
    const { user } = useAuth();
    const href = roleHomePath(user);
    if (!href) return null;
    return (
        <Link href={href} className={clsx("flex min-h-11 w-full items-center gap-3 rounded-[10px] px-3 text-[15px] font-semibold", tone === "dark" ? "text-white hover:bg-white/10" : "text-primary-dark hover:bg-ground")}>
            <Icon name="dashboard" />
            หน้าหลักของฉัน
        </Link>
    );
}

/** Banner variant (full-width strip above content) – kept for screens that sit outside a shell. */
export function RoleHomeBanner() {
    const { user } = useAuth();
    const href = roleHomePath(user);
    if (!href) return null;
    return (
        <Link href={href} className="flex min-h-11 items-center gap-2 border-b border-line-soft bg-white px-4 text-[15px] font-semibold text-primary-dark hover:bg-ground">
            <Icon name="dashboard" size={18} />
            หน้าหลักของฉัน
            <Icon name="chevron" size={18} className="ml-auto text-brand-muted" />
        </Link>
    );
}
