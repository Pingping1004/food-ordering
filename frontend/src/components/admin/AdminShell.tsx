"use client";

import { useAuth } from "@/auth/auth.hooks";
import { AccountBadge } from "@/components/shell/AccountBadge";
import { OrderShortcut } from "@/components/RoleLinks";
import { ResponsiveShell, ShellFooterButton, type ShellNavItem } from "@/components/shell/ResponsiveShell";
import { hasSchool } from "@/auth/access";

type Tab = "schools" | "payout";

/** Admin: top navbar below 768px, dark left sidebar from 768px up (see ResponsiveShell). */
export function AdminShell({ active, children }: Readonly<{ active: Tab; children: React.ReactNode }>) {
    const { user, logout } = useAuth();
    const items: ShellNavItem[] = [
        { key: "schools", label: "โรงเรียน", href: "/admin/schools", icon: "school", active: active === "schools", group: "แพลตฟอร์ม" },
        { key: "payout", label: "การเงิน", href: "/admin/payout", icon: "chart", active: active === "payout", group: "การเงิน" },
    ];

    return (
        <ResponsiveShell
            tone="dark"
            brand={{ href: "/admin/schools", ariaLabel: "หน้าหลักแอดมิน", title: "PromptServe Admin", subtitle: "คอนโซลผู้ดูแลระบบ" }}
            navLabel="เมนูแอดมิน"
            items={items}
            /* a platform admin who also belongs to a school can preorder like anyone else */
            mobileActions={hasSchool(user) ? <OrderShortcut tone="dark" /> : undefined}
            footerTop={<AccountBadge tone="dark" role="ผู้ดูแลระบบ" />}
            footer={
                <>
                    {hasSchool(user) && <OrderShortcut tone="dark" block />}
                    <ShellFooterButton tone="dark" icon="logout" onClick={() => logout()}>ออกจากระบบ</ShellFooterButton>
                </>
            }
        >
            {children}
        </ResponsiveShell>
    );
}
