import Link from "next/link";
import clsx from "clsx";
import type { ReactNode } from "react";
import { Card, Icon } from "@/components/ui/kit";

/** Page container shared by every /admin page (design: max 1280px, 28px top padding, 20px rhythm). */
export function AdminPage({ children, width = 1280 }: Readonly<{ children: ReactNode; width?: number }>) {
    return (
        <main className="mx-auto flex w-full flex-1 flex-col gap-5 px-[clamp(16px,3vw,40px)] py-7" style={{ maxWidth: width }}>
            {children}
        </main>
    );
}

/** Title + subtitle on the left, primary action(s) on the right; optional back link above. */
export function PageHeader({ title, subtitle, action, back }: Readonly<{ title: ReactNode; subtitle?: ReactNode; action?: ReactNode; back?: { href: string; label: string } }>) {
    return (
        <div className="flex flex-col gap-1.5">
            {back && (
                <Link href={back.href} className="inline-flex min-h-11 items-center gap-1 self-start rounded-md text-sm font-semibold text-primary-dark hover:text-[#003E94] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-main">
                    <Icon name="back" size={16} strokeWidth={2.4} />{back.label}
                </Link>
            )}
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-1">
                    <h1 className="text-[28px] font-bold leading-tight">{title}</h1>
                    {subtitle && <span className="text-sm text-brand-muted">{subtitle}</span>}
                </div>
                {action && <div className="flex flex-wrap items-center gap-2.5">{action}</div>}
            </div>
        </div>
    );
}

/** KPI tile: 16px radius, 1px #E3E7EF border, tabular numbers. */
export function StatCard({ label, value, sub, className }: Readonly<{ label: string; value: ReactNode; sub?: ReactNode; className?: string }>) {
    return (
        <Card as="div" className={clsx("flex flex-col gap-1.5 !rounded-2xl p-[18px]", className)}>
            <span className="text-sm text-brand-muted">{label}</span>
            <span className="text-[26px] font-bold leading-tight tabular-nums sm:text-[28px]">{value}</span>
            {sub && <span className="text-[13px] text-slate">{sub}</span>}
        </Card>
    );
}

export function StatGrid({ children, min = 200 }: Readonly<{ children: ReactNode; min?: number }>) {
    return <section className="grid gap-4" style={{ gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, ${min}px), 1fr))` }}>{children}</section>;
}

/** Form section card with the numbered blue badge from the "add school" board. */
export function StepCard({ step, title, children }: Readonly<{ step: number; title: string; children: ReactNode }>) {
    return (
        <li className="flex list-none flex-col gap-3.5 rounded-[18px] border border-line-soft bg-white p-5 sm:p-6">
            <h2 className="flex items-center gap-2.5 text-lg font-bold">
                <span aria-hidden="true" className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-main text-sm text-white">{step}</span>
                {title}
            </h2>
            {children}
        </li>
    );
}

/** Same grid the design uses for form rows: 240px min columns. */
export function FormGrid({ children }: Readonly<{ children: ReactNode }>) {
    return <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr))]">{children}</div>;
}

/** Table typography for the admin console: muted 13px header, tabular numbers, 12px row padding. */
export const A_TH = "sticky top-0 z-10 whitespace-nowrap border-b border-line-soft bg-white px-2 py-2.5 text-left text-[13px] font-semibold text-brand-muted";
export const A_TD = "border-b border-row-line px-2 py-3 align-middle tabular-nums";

/** Status chip colours from the design (ใช้งาน green, ตั้งค่าอยู่ orange, ระงับ red, ไม่ใช้งาน grey). */
export const SCHOOL_STATUS: Record<string, { label: string; tone: "success" | "orange" | "danger" | "neutral" }> = {
    ACTIVE: { label: "ใช้งาน", tone: "success" },
    SETUP: { label: "ตั้งค่าอยู่", tone: "orange" },
    SUSPENDED: { label: "ระงับ", tone: "danger" },
    INACTIVE: { label: "ไม่ใช้งาน", tone: "neutral" },
};
