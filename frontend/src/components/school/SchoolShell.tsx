"use client";

import Link from "next/link";
import { ResponsiveShell, ShellFooterButton, ShellFooterLink, type ShellNavItem } from "@/components/shell/ResponsiveShell";
import { OrderShortcut } from "@/components/RoleLinks";
import { Icon, type IconName } from "@/components/ui/kit";
import { useAuth } from "@/auth/auth.hooks";
import { AccountBadge } from "@/components/shell/AccountBadge";
import { isSystemAdmin, userHomePath } from "@/auth/access";
import { useSchoolInfo } from "@/hook/useSchool";
import { SchoolAccessBanner } from "@/components/school/SchoolAccessBanner";
import { DataModeBar } from "@/components/shell/DataModeBar";
import { useRefundSummary } from "@/hook/useRefunds";

export type SchoolTab = "overview" | "reliability" | "restaurants" | "approvals" | "refunds" | "feedback" | "staff" | "report" | "settings" | "audit";

const NAV: { key: SchoolTab; label: string; icon: IconName; path: string }[] = [
    { key: "overview", label: "ภาพรวม", icon: "dashboard", path: "" },
    { key: "restaurants", label: "โรงอาหาร & ร้านค้า", icon: "store", path: "/restaurants" },
    { key: "approvals", label: "รออนุมัติ", icon: "clipboard", path: "/approvals" },
    { key: "refunds", label: "คำขอคืนเงิน", icon: "refund", path: "/refunds" },
    { key: "feedback", label: "ความเห็นนักเรียน", icon: "chat", path: "/feedback" },
    { key: "staff", label: "ผู้ดูแลโรงเรียน", icon: "users", path: "/staff" },
    { key: "settings", label: "ตั้งค่าโรงเรียน", icon: "settings", path: "/settings" },
    { key: "audit", label: "บันทึกการเข้าถึง", icon: "lock", path: "/audit" },
];

/** School: top navbar below 768px, persistent left sidebar from 768px up. Chrome is hidden when printing the weekly report. */
export function SchoolShell({ schoolId, active, children }: Readonly<{ schoolId: string; active: SchoolTab; children: React.ReactNode }>) {
    const { user, logout } = useAuth();
    const { data: school } = useSchoolInfo(schoolId);
    const base = `/school/${schoolId}`;
    const homeHref = userHomePath(user, schoolId);
    const { data: refunds } = useRefundSummary(schoolId);
    const pendingRefunds = refunds?.counts.PENDING ?? 0;
    const items: ShellNavItem[] = NAV.map((n) => ({
        key: n.key, label: n.label, icon: n.icon, href: `${base}${n.path}`, active: n.key === active,
        badge: n.key === "refunds" && pendingRefunds > 0 ? <span aria-label={`${pendingRefunds} คำขอรอร้านดำเนินการ`}>{pendingRefunds}</span> : undefined,
    }));

    return (
        <ResponsiveShell
            brand={{ href: base, ariaLabel: "หน้าหลักโรงเรียน", title: "PromptServe", subtitle: "สำหรับโรงเรียน" }}
            navLabel="เมนูโรงเรียน"
            items={items}
            mobileActions={<OrderShortcut />}
            footerTop={<AccountBadge role={isSystemAdmin(user) ? "ผู้ดูแลระบบ" : "ผู้ดูแลโรงเรียน"} />}
            brandBelow={
                <div className="flex flex-col gap-1 rounded-[14px] bg-primary-main p-3.5">
                    <span className="text-base text-white font-bold leading-snug">{school?.name ?? "…"}</span>
                    <span className="text-[13px] text-white text-brand-muted">นักเรียน {school?.studentAmount ? school.studentAmount.toLocaleString("th-TH") : "[จำนวนนักเรียน]"} คน</span>
                </div>
            }
            footer={
                <>
                    <OrderShortcut block />
                    <ShellFooterLink href={homeHref} icon="home">กลับหน้าหลัก</ShellFooterLink>
                    <ShellFooterLink href="/user/account#security" icon="lock">บัญชีและความปลอดภัย</ShellFooterLink>
                    <ShellFooterButton icon="logout" onClick={() => logout()}>ออกจากระบบ</ShellFooterButton>
                </>
            }
            contentAs="main"
            mainClassName="px-[clamp(16px,3vw,40px)] pb-12 pt-5 md:pt-7"
        >
            <DataModeBar kind="school" id={schoolId} isDemo={school?.isDemo} />
            <SchoolAccessBanner schoolId={schoolId} />
            {children}
        </ResponsiveShell>
    );
}

export function SchoolPageHeader({
    eyebrow,
    title,
    actions,
    backHref,
    backLabel = "กลับหน้าหลัก",
}: Readonly<{
    eyebrow?: React.ReactNode;
    title: string;
    actions?: React.ReactNode;
    backHref?: string;
    backLabel?: string;
}>) {
    return (
        <header className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex min-w-0 flex-col gap-1.5">
                {eyebrow && <span className="flex flex-wrap items-center gap-2 text-sm text-brand-muted">{eyebrow}</span>}
                <div className="flex items-center gap-3">
                    {backHref && (
                        <Link
                            href={backHref}
                            aria-label={backLabel}
                            title={backLabel}
                            className="group flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-line bg-white px-3 text-[15px] font-semibold text-brand-dark shadow-xs transition hover:border-brand-muted hover:bg-ground active:scale-95 sm:px-3.5"
                        >
                            <Icon name="back" size={20} className="transition-transform group-hover:-translate-x-0.5" />
                            <span className="hidden sm:inline">{backLabel}</span>
                        </Link>
                    )}
                    <h1 className="text-[26px] font-bold leading-tight md:text-[30px]">{title}</h1>
                </div>
            </div>
            {actions && <div className="flex flex-wrap gap-2.5">{actions}</div>}
        </header>
    );
}
