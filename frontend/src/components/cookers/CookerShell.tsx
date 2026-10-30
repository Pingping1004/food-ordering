"use client";

import { useAuth } from "@/auth/auth.hooks";
import { AccountBadge } from "@/components/shell/AccountBadge";
import { isSystemAdmin, restaurantRole } from "@/auth/access";
import { useCooker } from "@/hook/useCooker";
import { OrderShortcut } from "@/components/RoleLinks";
import { ResponsiveShell, ShellFooterButton, ShellFooterLink, type ShellNavItem } from "@/components/shell/ResponsiveShell";
import { Icon, type IconName } from "@/components/ui/kit";
import { DataModeBar } from "@/components/shell/DataModeBar";
import { useShopPendingRefunds } from "@/hook/useRefunds";

type Tab = "orders" | "menu" | "summary" | "refunds" | "staff" | "settings";

const ROLE_LABEL = { OWNER: "เจ้าของร้าน", ADMIN: "ผู้จัดการร้าน", STAFF: "พนักงานร้าน" } as const;

const ICONS: Record<Tab, IconName> = { orders: "clipboard", menu: "menu", summary: "chart", refunds: "refund", staff: "users", settings: "settings" };

/** Cooker app shell: navbar below 768px, sidebar from 768px up. Content uses the whole remaining width (the order board needs it on tablets). */
export function CookerShell({ restaurantId, active, children }: Readonly<{ restaurantId: string; active: Tab; children: React.ReactNode }>) {
    const { user, logout } = useAuth();
    const { data: cooker } = useCooker(restaurantId);
    const unverified = cooker?.status === "PENDING";
    const tabs: { key: Tab; label: string; href: string }[] = [
        { key: "orders", label: "ออเดอร์", href: `/cooker/${restaurantId}` },
        { key: "menu", label: "เมนู", href: `/cooker/restaurant/managed-menu/${restaurantId}` },
        { key: "summary", label: "สรุป", href: `/cooker/summary/${restaurantId}` },
        { key: "refunds", label: "คำขอคืนเงิน", href: `/cooker/refunds/${restaurantId}` },
        { key: "staff", label: "คนในร้าน", href: `/cooker/staff/${restaurantId}` },
        { key: "settings", label: "ตั้งค่า", href: `/cooker/profile/${restaurantId}` },
    ];
    // Managing people (codes, approvals, removals) is the owner's job; cooks never see the tab.
    const isOwner = restaurantRole(user, restaurantId) === "OWNER" || isSystemAdmin(user);
    const { data: pendingRefunds } = useShopPendingRefunds(restaurantId);
    const refundBadge = pendingRefunds && pendingRefunds.count > 0 ? `${pendingRefunds.count}${pendingRefunds.more ? "+" : ""}` : null;
    const items: ShellNavItem[] = tabs.filter((n) => n.key !== "staff" || isOwner).map((n) => ({
        ...n, icon: ICONS[n.key], active: n.key === active,
        badge: n.key === "refunds" && refundBadge ? <span aria-label={`${refundBadge} คำขอรอร้านตัดสินใจ`}>{refundBadge}</span> : undefined,
    }));

    return (
        <ResponsiveShell
            brand={{ href: `/cooker/${restaurantId}`, ariaLabel: "หน้าหลักร้านอาหาร", title: "PromptServe", subtitle: "สำหรับร้านอาหาร" }}
            navLabel="เมนูหลักของร้าน"
            items={items}
            /* kitchen staff can preorder their own lunch through the student screens */
            mobileActions={<OrderShortcut />}
            footerTop={<AccountBadge role={isSystemAdmin(user) ? "ผู้ดูแลระบบ" : ROLE_LABEL[restaurantRole(user, restaurantId) ?? "STAFF"]} />}
            footer={
                <>
                    <OrderShortcut block />
                    <ShellFooterLink href="/user/account#security" icon="lock">บัญชีและความปลอดภัย</ShellFooterLink>
                    <ShellFooterButton icon="logout" onClick={() => logout()}>ออกจากระบบ</ShellFooterButton>
                </>
            }
        >
            {unverified && (
                <div role="status" className="flex items-start gap-3 border-b border-brand-orange-text/20 bg-brand-orange-light px-5 py-3.5 text-brand-orange-text">
                    <Icon name="clock" size={22} />
                    <p className="text-base leading-relaxed">
                        <b>ร้านของคุณยังไม่ได้รับการยืนยัน</b> ผู้ดูแลโรงเรียนกำลังพิจารณาอนุมัติร้าน ระหว่างนี้ยังไม่เปิดรับออเดอร์ แต่เพิ่มเมนูและตั้งค่าร้านรอไว้ได้
                    </p>
                </div>
            )}
            <div className="px-[clamp(12px,2vw,24px)] pt-3 empty:hidden">
                <DataModeBar kind="restaurant" id={restaurantId} />
            </div>
            {children}
        </ResponsiveShell>
    );
}
