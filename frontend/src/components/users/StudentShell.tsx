import Link from "next/link";
import clsx from "clsx";
import { Icon, type IconName } from "@/components/ui/kit";

export type StudentTab = "home" | "orders" | "account";

export const STUDENT_TABS: { key: StudentTab; label: string; href: string; icon: IconName }[] = [
    { key: "home", label: "หน้าหลัก", href: "/user/restaurant", icon: "home" },
    { key: "orders", label: "ออเดอร์ของฉัน", href: "/user/orders", icon: "orders" },
    { key: "account", label: "บัญชี", href: "/user/account", icon: "user" },
];

/** Content column inside the responsive shell: phone column, then wider on tablet / desktop (the sidebar already takes its share). */
export const STUDENT_FRAME = "mx-auto flex min-h-app w-full max-w-[640px] flex-col bg-ground font-app text-brand-dark md:max-w-3xl lg:max-w-6xl";

/**
 * Student pages. The navigation chrome (navbar < 768px, sidebar >= 768px) comes from `StudentAppFrame` in
 * `app/user/layout.tsx`, so this only provides the content column. `active` is kept so call sites stay explicit.
 */
export function StudentShell({ children }: Readonly<{ active?: StudentTab; children: React.ReactNode }>) {
    return <div className={STUDENT_FRAME}>{children}</div>;
}

/** Simple top bar for secondary student screens. */
export function StudentTopBar({ title, backHref, right }: Readonly<{ title: string; backHref?: string; right?: React.ReactNode }>) {
    return (
        <header className="flex items-center justify-between gap-2 border-b border-line-soft bg-white px-4 py-3 md:px-6">
            <div className="flex min-w-0 items-center gap-2">
                {backHref && (
                    <Link href={backHref} aria-label="กลับ" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl hover:bg-ground">
                        <Icon name="back" size={24} />
                    </Link>
                )}
                <h1 className="truncate text-xl font-bold">{title}</h1>
            </div>
            {right}
        </header>
    );
}

/** Full-bleed single-purpose screens (onboarding, invite, forgot-password…). */
export function CenteredScreen({ children, tone = "white" }: Readonly<{ children: React.ReactNode; tone?: "white" | "blue" | "ground" }>) {
    const bg = tone === "blue" ? "bg-ground-blue" : tone === "ground" ? "bg-ground" : "bg-white";
    return (
        <div className={clsx("min-h-app font-app text-brand-dark", bg)}>
            <div className="mx-auto flex min-h-app w-full max-w-[480px] flex-col gap-6 px-6 pb-7 pt-8 md:justify-center md:py-12">{children}</div>
        </div>
    );
}
