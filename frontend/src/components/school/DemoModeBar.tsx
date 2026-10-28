"use client";

import Link from "next/link";
import clsx from "clsx";
import { Icon } from "@/components/ui/kit";
import { useAuth } from "@/auth/auth.hooks";
import { isSystemAdmin, schoolMemberships } from "@/auth/access";
import { useSchoolInfo } from "@/hook/useSchool";

/**
 * Real ↔ demo switch for the school pages. The demo school (School.isDemo, filled by `npm run demo:seed`) is a
 * separate school, so "switching mode" just moves between the two school ids – real data is never mixed with demo.
 * Shows nothing for people who belong to only one of the two.
 */
export function DemoModeBar({ schoolId }: Readonly<{ schoolId: string }>) {
    const { user } = useAuth();
    const { data: school } = useSchoolInfo(schoolId);
    if (!school) return null;

    const approved = schoolMemberships(user).filter((m) => (m.status ?? "APPROVED") === "APPROVED");
    const realSchoolId =
        approved.find((m) => !m.schoolIsDemo && m.schoolId !== schoolId)?.schoolId ??
        (user?.school && user.school.schoolId !== schoolId ? user.school.schoolId : undefined);
    const demoSchoolId = approved.find((m) => m.schoolIsDemo && m.schoolId !== schoolId)?.schoolId;

    if (school.isDemo) {
        const backHref = realSchoolId ? `/school/${realSchoolId}` : isSystemAdmin(user) ? "/admin/schools" : undefined;
        return (
            <div role="note" className="no-print -mx-1 mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border-[1.5px] border-[#FFD2BD] bg-brand-orange-light px-4 py-3">
                <Icon name="info" size={22} className="shrink-0 text-brand-orange-text" />
                <span className="flex min-w-0 flex-1 basis-64 flex-col gap-0.5">
                    <span className="text-[15px] font-bold text-brand-dark">โหมดสาธิต · ข้อมูลจำลองเพื่อการนำเสนอ</span>
                    <span className="text-[13px] text-brand-dark">ตัวเลขทั้งหมดในโรงเรียนนี้สร้างขึ้นเพื่อสาธิต ไม่ใช่ข้อมูลจริงของโรงเรียนใด</span>
                </span>
                {backHref && <ModeToggle realHref={backHref} demoHref={`/school/${schoolId}`} demo />}
            </div>
        );
    }

    if (!demoSchoolId) return null;
    return (
        <div className="no-print -mx-1 mb-4 flex justify-end">
            <ModeToggle realHref={`/school/${schoolId}`} demoHref={`/school/${demoSchoolId}`} demo={false} />
        </div>
    );
}

function ModeToggle({ realHref, demoHref, demo }: Readonly<{ realHref: string; demoHref: string; demo: boolean }>) {
    const item = (active: boolean) =>
        clsx(
            "flex h-10 items-center gap-1.5 rounded-[9px] px-3.5 text-sm font-semibold transition",
            active ? "bg-white text-brand-dark shadow-xs" : "text-brand-muted hover:text-brand-dark",
        );
    return (
        <nav aria-label="เลือกชุดข้อมูล" className="flex gap-1 rounded-xl border border-line bg-ground p-1">
            <Link href={realHref} aria-current={!demo ? "page" : undefined} className={item(!demo)}>
                <Icon name="school" size={16} />ข้อมูลจริง
            </Link>
            <Link href={demoHref} aria-current={demo ? "page" : undefined} className={item(demo)}>
                <Icon name="chart" size={16} />ข้อมูลสาธิต
            </Link>
        </nav>
    );
}
