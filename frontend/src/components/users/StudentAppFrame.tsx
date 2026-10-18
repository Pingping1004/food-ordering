"use client";

import { usePathname } from "next/navigation";
import { useAuth } from "@/auth/auth.hooks";
import { AccountBadge } from "@/components/shell/AccountBadge";
import { RoleHomeLink } from "@/components/RoleLinks";
import { ResponsiveShell, ShellFooterButton, type ShellNavItem } from "@/components/shell/ResponsiveShell";
import { STUDENT_TABS, type StudentTab } from "@/components/users/StudentShell";

/** Routes that are full-screen setup flows: no navigation chrome. */
const BARE_PREFIXES = ["/user/onboarding"];

function activeTab(pathname: string): StudentTab {
    if (pathname.startsWith("/user/orders") || pathname.startsWith("/user/order/")) return "orders";
    if (pathname.startsWith("/user/account")) return "account";
    return "home";
}

/** Student area chrome: top navbar below 768px, left sidebar from 768px up. */
export function StudentAppFrame({ children }: Readonly<{ children: React.ReactNode }>) {
    const pathname = usePathname();
    const { logout } = useAuth();
    if (BARE_PREFIXES.some((p) => pathname.startsWith(p))) return <>{children}</>;

    const current = activeTab(pathname);
    const items: ShellNavItem[] = STUDENT_TABS.map((t) => ({ ...t, active: t.key === current }));

    return (
        <ResponsiveShell
            brand={{ href: "/user/restaurant", ariaLabel: "หน้าหลัก PromptServe", title: "PromptServe", subtitle: "สั่งอาหารล่วงหน้า" }}
            navLabel="เมนูหลัก"
            items={items}
            footerTop={<AccountBadge role="นักเรียน" />}
            footer={
                <>
                    {/* someone who also holds another role: one tap back to that role's own page */}
                    <RoleHomeLink />
                    <ShellFooterButton icon="logout" onClick={() => logout()}>ออกจากระบบ</ShellFooterButton>
                </>
            }
        >
            {children}
        </ResponsiveShell>
    );
}
