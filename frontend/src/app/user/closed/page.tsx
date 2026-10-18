"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Card, ErrorState, Icon, Skeleton } from "@/components/ui/kit";
import { STUDENT_FRAME } from "@/components/users/StudentShell";
import { getDayStatus, readSelection } from "@/lib/services/student";
import { splitDate } from "@/lib/schema/format";

const fmtNext = (iso: string) => {
    const d = new Date(iso);
    const day = d.toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "short", timeZone: "Asia/Bangkok" });
    const time = d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Bangkok" });
    return { line: `${day} · ${time}`, time };
};

/** Shown instead of the shop list when school date-override / operating hours say the canteen is closed today. */
export default function ClosedTodayPage() {
    const [sel, setSel] = useState<ReturnType<typeof readSelection>>(null);
    useEffect(() => setSel(readSelection()), []);

    const schoolId = sel?.schoolId;
    const { data, isLoading, isError, refetch } = useQuery({ queryKey: ["day-status", schoolId], queryFn: () => getDayStatus(schoolId as string), enabled: !!schoolId });
    const parts = data ? splitDate(data.date) : null;
    const next = data?.nextOpenAt ? fmtNext(data.nextOpenAt) : null;

    return (
        <div className={STUDENT_FRAME}>
            <header className="flex flex-col gap-1.5 rounded-b-[28px] bg-neutral-text px-5 pb-7 pt-5 text-white">
                <span className="text-sm opacity-90">{sel ? `${sel.schoolName} · ${sel.canteenName}` : "โรงเรียน · โรงอาหาร"}</span>
                <h1 className="text-[26px] font-bold">โรงอาหารปิดวันนี้</h1>
            </header>

            <main className="flex flex-1 flex-col gap-4 p-5">
                {isLoading && (
                    <div className="flex flex-col gap-4">
                        <div className="flex items-center gap-4 rounded-[20px] border border-line-soft bg-white p-5">
                            <Skeleton className="h-16 w-16 shrink-0 rounded-2xl" />
                            <div className="flex flex-1 flex-col gap-2">
                                <Skeleton className="h-5 w-32 rounded-md" />
                                <Skeleton className="h-4 w-24 rounded" />
                            </div>
                        </div>
                        <div className="flex flex-col gap-3 rounded-[20px] border border-line-soft bg-white p-5">
                            <Skeleton className="h-5 w-28 rounded-md" />
                            <Skeleton className="h-8 w-48 rounded-md" />
                            <Skeleton className="h-4 w-36 rounded" />
                        </div>
                    </div>
                )}
                {isError && <ErrorState onRetry={() => refetch()} />}

                {data && parts && (
                    <>
                        <Card className="flex items-center gap-4 rounded-[20px] p-5">
                            <span className="flex w-16 shrink-0 flex-col items-center rounded-2xl bg-neutral-light py-2">
                                <span className="text-[26px] font-bold leading-none">{parts.d}</span>
                                <span className="text-[13px] text-brand-muted">{parts.m}</span>
                            </span>
                            <span className="flex flex-col gap-1">
                                <span className="text-[17px] font-bold">{data.reason ?? "ปิดทำการ"}</span>
                                <span className="text-[15px] text-brand-muted">โรงเรียนปิดทั้งวัน</span>
                            </span>
                        </Card>

                        {next && (
                            <Card className="flex flex-col gap-3 rounded-[20px] p-5">
                                <h2 className="text-[17px] font-bold">เปิดครั้งถัดไป</h2>
                                <span className="text-[26px] font-bold leading-tight text-primary-dark sm:text-[30px]">{next.line}</span>
                                <span className="text-[15px] leading-relaxed text-brand-muted">สั่งล่วงหน้าได้ตั้งแต่ {next.time} ของวันนั้น</span>
                            </Card>
                        )}

                        {data.upcoming.length > 0 && (
                            <Card className="flex flex-col gap-2.5 rounded-[20px] p-5">
                                <h2 className="text-[17px] font-bold">วันปิดที่กำลังจะมาถึง</h2>
                                <ul className="flex flex-col gap-2.5">
                                    {data.upcoming.map((u) => (
                                        <li key={u.date} className="flex items-center justify-between gap-3 text-[15px]">
                                            <span>{u.label}</span>
                                            <span className={u.closed ? "font-semibold text-brand-muted" : "font-semibold text-brand-orange-text"}>{u.closed ? "ปิด" : u.hoursLabel}</span>
                                        </li>
                                    ))}
                                </ul>
                            </Card>
                        )}
                    </>
                )}
            </main>

            <footer className="px-5 pb-6 pt-4">
                <Link href="/user/orders" className="flex h-[52px] items-center justify-center gap-2 rounded-2xl border-[1.5px] border-line bg-white text-base font-semibold hover:bg-ground">
                    <Icon name="orders" size={20} />
                    ดูออเดอร์ที่ผ่านมา
                </Link>
            </footer>
        </div>
    );
}
