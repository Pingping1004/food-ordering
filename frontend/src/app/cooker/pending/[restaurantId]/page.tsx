"use client";

import { use, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { Icon } from "@/components/ui/kit";
import { useAuth } from "@/auth/auth.hooks";
import { getRegistrationStatus } from "@/lib/services/cooker";

const STEPS = [
    { label: "ส่งใบสมัคร", state: "done" },
    { label: "โรงเรียนตรวจสอบ", state: "current" },
    { label: "เปิดร้านรับออเดอร์", state: "todo" },
] as const;

export default function CookerPendingPage({ params }: Readonly<{ params: Promise<{ restaurantId: string }> }>) {
    const { restaurantId } = use(params);
    const router = useRouter();
    const { logout } = useAuth();

    // Poll politely – approval is a human action, no need to hammer the API.
    const { data } = useQuery({ queryKey: ["registration-status", restaurantId], queryFn: () => getRegistrationStatus(restaurantId), refetchInterval: 30_000 });

    useEffect(() => {
        if (data?.status === "ACTIVE") router.replace(`/cooker/${restaurantId}`);
    }, [data?.status, restaurantId, router]);

    const rejected = data?.status === "SUSPENDED" || data?.status === "REMOVED";

    return (
        <div className="min-h-app bg-ground font-app text-brand-dark">
            <div className="mx-auto flex min-h-app w-full max-w-[520px] flex-col gap-5 px-5 pb-6 pt-10">
                <section className="flex flex-col items-center gap-3.5 text-center">
                    <span className={clsx("flex h-20 w-20 items-center justify-center rounded-full", rejected ? "bg-danger-light text-danger-text" : "bg-brand-orange-light text-brand-orange-text")}>
                        <Icon name={rejected ? "alert" : "clock"} size={40} />
                    </span>
                    <h1 className="text-[28px] font-bold">{rejected ? "ใบสมัครไม่ได้รับการอนุมัติ" : "ส่งใบสมัครแล้ว"}</h1>
                    <p className="text-lg leading-relaxed text-slate">
                        {rejected ? "ติดต่อเจ้าหน้าที่โรงเรียนเพื่อสอบถามเหตุผลและสมัครใหม่" : "เจ้าหน้าที่โรงเรียนกำลังตรวจสอบ ปกติไม่เกิน 1–2 วันทำการ"}
                    </p>
                </section>

                {!rejected && (
                    <section className="rounded-[20px] border border-line-soft bg-white p-5">
                        <ol className="flex flex-col gap-[18px]">
                            {STEPS.map((s) => (
                                <li key={s.label} className="flex items-center gap-3" aria-current={s.state === "current" ? "step" : undefined}>
                                    <span className={clsx("flex h-8 w-8 shrink-0 items-center justify-center rounded-full", s.state === "done" && "bg-success-main text-white", s.state === "current" && "bg-primary-main", s.state === "todo" && "box-border border-2 border-line")}>
                                        {s.state === "done" && <Icon name="check" size={16} strokeWidth={3} />}
                                    </span>
                                    <span className={clsx("text-lg", s.state === "current" && "font-bold", s.state === "todo" && "text-brand-muted")}>{s.label}</span>
                                </li>
                            ))}
                        </ol>
                    </section>
                )}

                <section className="flex flex-col gap-3 rounded-[20px] border border-line-soft bg-white p-5">
                    <h2 className="text-xl font-bold">ระหว่างรอ ทำสิ่งนี้ได้เลย</h2>
                    <Link href={`/cooker/restaurant/add-menu/${restaurantId}`} className="flex min-h-[60px] items-center justify-between rounded-[14px] border-[1.5px] border-line px-4 text-lg font-semibold hover:bg-ground">
                        เพิ่มเมนูของร้าน<Icon name="chevron" />
                    </Link>
                    <Link href={`/user/onboarding/notify?next=${encodeURIComponent(`/cooker/pending/${restaurantId}`)}`} className="flex min-h-[60px] items-center justify-between rounded-[14px] border-[1.5px] border-line px-4 text-lg font-semibold hover:bg-ground">
                        เปิดเสียงแจ้งออเดอร์<Icon name="chevron" />
                    </Link>
                </section>

                <p className="mt-auto text-center text-base text-brand-muted">เราจะแจ้งเตือนทันทีเมื่ออนุมัติแล้ว</p>
                <button type="button" onClick={() => logout()} className="flex min-h-[52px] items-center justify-center gap-2 rounded-[14px] bg-danger-light text-lg font-semibold text-danger-text hover:brightness-95">
                    <Icon name="logout" size={20} />ออกจากระบบ
                </button>
            </div>
        </div>
    );
}
