"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { useAuth } from "@/auth/auth.hooks";
import { awaitingApproval, pendingSchoolMembership, pendingStaffMembership, postLoginPath } from "@/auth/access";
import { CenteredScreen } from "@/components/users/StudentShell";
import { ActionButton, Icon } from "@/components/ui/kit";

/** Where an account sits while someone else must approve it. Polls the profile politely; moves on when approved. */
export default function PendingApprovalPage() {
    const { user, refreshUser, logout } = useAuth();
    const router = useRouter();

    useEffect(() => {
        const id = window.setInterval(() => { void refreshUser(); }, 20_000);
        return () => window.clearInterval(id);
    }, [refreshUser]);

    useEffect(() => {
        if (user && !awaitingApproval(user)) router.replace(postLoginPath(user));
    }, [user, router]);

    // Which request is waiting decides the copy: a school-admin code from a school admin (existing admin approves) or a shop-staff code (shop owner approves).
    const kind: "admin" | "staff" = user && pendingStaffMembership(user) && !pendingSchoolMembership(user) ? "staff" : "admin";
    const staffShop = user ? pendingStaffMembership(user)?.restaurantName ?? pendingStaffMembership(user)?.restaurant?.name : undefined;

    const copy = {
        staff: { title: "ส่งคำขอเป็นพนักงานร้านแล้ว", body: `${staffShop ? `ร้าน${staffShop} ` : ""}รอเจ้าของร้านอนุมัติ เมื่ออนุมัติแล้วคุณจะเห็นออเดอร์ของร้านทันที`, who: "เจ้าของร้าน" },
        admin: { title: "ส่งคำขอเป็นผู้ดูแลโรงเรียนแล้ว", body: "รอผู้ดูแลโรงเรียนคนปัจจุบันอนุมัติ เมื่ออนุมัติแล้วคุณจะเข้าแดชบอร์ดโรงเรียนได้ทันที", who: "ผู้ดูแลโรงเรียน" },
    }[kind];

    const steps = [
        { label: "ส่งคำขอ", state: "done" },
        { label: `${copy.who}ตรวจสอบ`, state: "current" },
        { label: "เริ่มใช้งาน", state: "todo" },
    ] as const;

    return (
        <CenteredScreen tone="ground">
            <section className="flex flex-col items-center gap-3.5 pt-6 text-center">
                <span className="flex h-20 w-20 items-center justify-center rounded-full bg-brand-orange-light text-brand-orange-text"><Icon name="clock" size={40} /></span>
                <h1 className="text-[28px] font-bold">{copy.title}</h1>
                <p className="text-lg leading-relaxed text-slate">{copy.body}</p>
            </section>

            <section className="rounded-[20px] border border-line-soft bg-white p-5">
                <ol className="flex flex-col gap-[18px]">
                    {steps.map((s) => (
                        <li key={s.label} className="flex items-center gap-3" aria-current={s.state === "current" ? "step" : undefined}>
                            <span className={clsx("flex h-8 w-8 shrink-0 items-center justify-center rounded-full", s.state === "done" && "bg-success-main text-white", s.state === "current" && "bg-primary-main", s.state === "todo" && "box-border border-2 border-line")}>
                                {s.state === "done" && <Icon name="check" size={16} strokeWidth={3} />}
                            </span>
                            <span className={clsx("text-lg", s.state === "current" && "font-bold", s.state === "todo" && "text-brand-muted")}>{s.label}</span>
                        </li>
                    ))}
                </ol>
            </section>

            <div className="mt-auto flex flex-col gap-2.5">
                <p className="text-center text-base text-brand-muted">หน้านี้อัปเดตเองเมื่อมีการอนุมัติ</p>
                <ActionButton variant="ghost" size="md" onClick={() => logout()}>ออกจากระบบ</ActionButton>
            </div>
        </CenteredScreen>
    );
}
