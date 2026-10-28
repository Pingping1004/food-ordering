"use client";

import Link from "next/link";
import clsx from "clsx";
import { Icon } from "@/components/ui/kit";
import { useAuth } from "@/auth/auth.hooks";
import { dataHomes, isSystemAdmin, roleHomePath, type DataHome } from "@/auth/access";

/**
 * Real ↔ demo switch shown on school pages, shop pages and the workspace picker. Demo data lives in a separate
 * school (School.isDemo, filled by `npm run demo:seed`) with its own shops, so "switching mode" just moves between
 * homes the user belongs to – real data is never mixed with demo. Shows nothing for people with only one side.
 *
 * `isDemo` overrides the membership flag (a system admin can open the demo school without being a member).
 */
export function DataModeBar({ kind, id, isDemo }: Readonly<{ kind: DataHome["kind"]; id: string; isDemo?: boolean }>) {
    const { user } = useAuth();
    const homes = dataHomes(user);
    const here = homes.find((h) => h.kind === kind && h.id === id);
    const demo = isDemo ?? here?.demo;
    if (demo === undefined) return null;

    // Prefer a home of the same kind (school ↔ school, shop ↔ shop), else any home on the other side.
    const other = (wantDemo: boolean) => {
        const side = homes.filter((h) => h.demo === wantDemo && !(h.kind === kind && h.id === id));
        return (side.find((h) => h.kind === kind) ?? side[0])?.href;
    };
    const currentHref = kind === "school" ? `/school/${id}` : `/cooker/${id}`;

    if (demo) {
        const realHref = other(false) ?? (isSystemAdmin(user) ? "/admin/schools" : roleHomePath(user) ?? "/user/restaurant");
        return (
            <div role="note" className="no-print -mx-1 mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border-[1.5px] border-[#FFD2BD] bg-brand-orange-light px-4 py-3">
                <Icon name="info" size={22} className="shrink-0 text-brand-orange-text" />
                <span className="flex min-w-0 flex-1 basis-64 flex-col gap-0.5">
                    <span className="text-[15px] font-bold text-brand-dark">โหมดสาธิต · ข้อมูลจำลองเพื่อการนำเสนอ</span>
                    <span className="text-[13px] text-brand-dark">
                        {kind === "school" ? "ตัวเลขทั้งหมดในโรงเรียนนี้สร้างขึ้นเพื่อสาธิต ไม่ใช่ข้อมูลจริงของโรงเรียนใด" : "ร้านและออเดอร์ในหน้านี้สร้างขึ้นเพื่อสาธิต ไม่ใช่ข้อมูลจริงของร้านใด"}
                    </span>
                </span>
                <DataModeToggle realHref={realHref} demoHref={currentHref} demo />
            </div>
        );
    }

    const demoHref = other(true);
    if (!demoHref) return null;
    return (
        <div className="no-print -mx-1 mb-4 flex justify-end">
            <DataModeToggle realHref={currentHref} demoHref={demoHref} demo={false} />
        </div>
    );
}

/** Segmented ข้อมูลจริง / ข้อมูลสาธิต control. Links by default; pass `onSelect` to use it as an in-page filter. */
export function DataModeToggle({
    realHref,
    demoHref,
    demo,
    onSelect,
}: Readonly<{ realHref?: string; demoHref?: string; demo: boolean; onSelect?: (demo: boolean) => void }>) {
    const item = (active: boolean) =>
        clsx(
            "flex h-10 items-center gap-1.5 rounded-[9px] px-3.5 text-sm font-semibold transition",
            active ? "bg-white text-brand-dark shadow-xs" : "text-brand-muted hover:text-brand-dark",
        );
    const options = [
        { isDemo: false, href: realHref, icon: "school" as const, label: "ข้อมูลจริง" },
        { isDemo: true, href: demoHref, icon: "chart" as const, label: "ข้อมูลสาธิต" },
    ];
    return (
        <nav aria-label="เลือกชุดข้อมูล" className="flex gap-1 rounded-xl border border-line bg-ground p-1">
            {options.map((o) =>
                onSelect ? (
                    <button key={o.label} type="button" aria-pressed={demo === o.isDemo} onClick={() => onSelect(o.isDemo)} className={item(demo === o.isDemo)}>
                        <Icon name={o.icon} size={16} />{o.label}
                    </button>
                ) : (
                    <Link key={o.label} href={o.href ?? "#"} aria-current={demo === o.isDemo ? "page" : undefined} className={item(demo === o.isDemo)}>
                        <Icon name={o.icon} size={16} />{o.label}
                    </Link>
                ),
            )}
        </nav>
    );
}
