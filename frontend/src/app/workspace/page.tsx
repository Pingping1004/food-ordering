"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { AuthGuard } from "@/auth/auth.guard";
import { useAuth } from "@/auth/auth.hooks";
import LoadingPage from "@/components/LoadingPage";
import { CenteredScreen } from "@/components/users/StudentShell";
import { Icon, type IconName } from "@/components/ui/kit";
import { deriveWorkspaces, readSelection } from "@/lib/services/student";
import type { Workspace } from "@/lib/schema";
import { DataModeToggle } from "@/components/shell/DataModeBar";

const LAST_KEY = "last-workspace";

const KIND: Record<Workspace["kind"], { icon: IconName; tile: string }> = {
    student: { icon: "plate", tile: "bg-primary-light text-primary-dark" },
    restaurant: { icon: "chef", tile: "bg-brand-orange-light text-brand-orange-text" },
    school: { icon: "school", tile: "bg-success-light text-success-main" },
    admin: { icon: "shield", tile: "bg-neutral-light text-neutral-text" },
};

function WorkspacePicker() {
    const { user } = useAuth();
    const router = useRouter();
    const [remember, setRemember] = useState(true);
    const [redirecting, setRedirecting] = useState(false);
    const [showDemo, setShowDemo] = useState(false);

    const spaces = useMemo(() => deriveWorkspaces(user, readSelection()), [user]);
    // Only people who belong to the demo school (or its shops) get the switch; the list then shows one side at a time.
    const hasDemo = spaces.some((s) => s.demo);
    const shown = hasDemo ? spaces.filter((s) => !!s.demo === showDemo) : spaces;

    // One workspace → no choice to make. Remembered choice → go straight in.
    useEffect(() => {
        if (!user) return;
        const remembered = (() => {
            try { return localStorage.getItem(LAST_KEY); } catch { return null; }
        })();
        const target = spaces.length === 1 ? spaces[0] : spaces.find((s) => s.key === remembered);
        if (target) {
            setRedirecting(true);
            router.replace(target.href);
        }
    }, [user, spaces, router]);

    if (redirecting) return <LoadingPage />;

    const choose = (w: Workspace) => {
        try {
            if (remember) localStorage.setItem(LAST_KEY, w.key);
            else localStorage.removeItem(LAST_KEY);
        } catch { /* ignore – choice just isn't remembered */ }
    };

    return (
        <CenteredScreen>
            <div className="flex flex-col gap-2">
                <span className="text-[15px] text-brand-muted">สวัสดี {user?.name ?? ""}</span>
                <h1 className="text-[28px] font-bold leading-tight">วันนี้จะใช้งานในฐานะ</h1>
                <p className="text-[15px] leading-relaxed text-brand-muted">บัญชีของคุณมีสิทธิ์มากกว่า 1 แบบ สลับได้ตลอดจากหน้าบัญชี</p>
            </div>

            {hasDemo && (
                <div className="flex justify-start">
                    <DataModeToggle demo={showDemo} onSelect={setShowDemo} />
                </div>
            )}

            <ul className="flex flex-col gap-3">
                {shown.map((w) => (
                    <li key={w.key}>
                        <Link
                            href={w.href}
                            onClick={() => choose(w)}
                            className="flex min-h-[88px] items-center gap-3.5 rounded-[18px] border-[1.5px] border-line-soft bg-white p-4 hover:border-primary-main"
                        >
                            <span className={clsx("flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[14px]", KIND[w.kind].tile)}>
                                <Icon name={KIND[w.kind].icon} size={26} />
                            </span>
                            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                                <span className="truncate text-[17px] font-bold">{w.name}</span>
                                <span className="text-sm text-brand-muted">{w.roleLabel}</span>
                                {w.demo && <span className="w-fit rounded-full bg-brand-orange-light px-2 py-0.5 text-xs font-bold text-brand-orange-text">ข้อมูลสาธิต</span>}
                            </span>
                            <Icon name="chevron" size={22} className="text-brand-muted" />
                        </Link>
                    </li>
                ))}
            </ul>

            <label className="mt-auto flex min-h-11 items-center gap-2.5 text-[15px]">
                <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-[22px] w-[22px] accent-primary-main" />
                จำตัวเลือกนี้ในเครื่องนี้
            </label>
        </CenteredScreen>
    );
}

export default function WorkspacePage() {
    return (
        <AuthGuard>
            <WorkspacePicker />
        </AuthGuard>
    );
}
