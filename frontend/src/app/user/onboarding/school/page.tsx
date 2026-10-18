"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import clsx from "clsx";
import { CenteredScreen } from "@/components/users/StudentShell";
import { ActionButton, ChoiceButton, EmptyState, ErrorState, Skeleton } from "@/components/ui/kit";
import { useMySchool } from "@/hook/useSchool";
import { readSelection, saveSelection } from "@/lib/services/student";

/** Canteen picker. The school itself was fixed by the invite code – only the caller's own canteens are ever listed. */
export default function CanteenPickerPage() {
    const router = useRouter();
    const params = useSearchParams();
    const isOnboarding = params.get("from") !== "account";

    const { data: school, isLoading, isError, refetch } = useMySchool();
    const [canteenId, setCanteenId] = useState<string>();

    // Pre-select what the student chose last time (changing canteen from the account page).
    useEffect(() => {
        const saved = readSelection();
        if (saved) setCanteenId(saved.canteenId);
    }, []);

    // A school with a single canteen needs no choice at all.
    useEffect(() => {
        if (school?.canteens.length === 1) setCanteenId(school.canteens[0].canteenId);
    }, [school]);

    const canteen = school?.canteens.find((c) => c.canteenId === canteenId);

    const next = () => {
        if (!school || !canteen) return;
        saveSelection({ schoolId: school.schoolId, canteenId: canteen.canteenId, schoolName: school.name, canteenName: canteen.name });
        router.push("/user/restaurant");
    };

    return (
        <CenteredScreen>
            <div className="flex flex-col gap-2">
                {isOnboarding && <span className="text-sm font-bold text-primary-dark">ขั้นสุดท้ายก่อนเริ่มสั่ง</span>}
                <h1 className="text-[28px] font-bold leading-tight">กินที่โรงอาหารไหน?</h1>
                <p className="text-base leading-relaxed text-brand-muted">{school ? `${school.name} · ` : ""}เราจะแสดงเฉพาะร้านในโรงอาหารที่คุณเลือก เปลี่ยนทีหลังได้ในหน้าบัญชี</p>
            </div>

            <fieldset className="flex flex-col gap-2.5">
                <legend className="mb-2.5 text-[15px] font-bold">โรงอาหาร</legend>
                {isLoading && (
                    <div className="flex flex-col gap-2.5">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="flex min-h-16 items-center gap-3 rounded-2xl border border-line-soft bg-white px-4">
                                <Skeleton className="h-[22px] w-[22px] shrink-0 rounded-full" />
                                <Skeleton className="h-4.5 w-40 rounded-md" />
                            </div>
                        ))}
                    </div>
                )}
                {isError && <ErrorState onRetry={() => refetch()} />}
                {school?.canteens.length === 0 && <EmptyState title="โรงเรียนยังไม่มีโรงอาหาร" body="สอบถามเจ้าหน้าที่โรงเรียนให้เพิ่มโรงอาหารก่อน" />}
                <div role="radiogroup" aria-label="โรงอาหาร" className="flex flex-col gap-2.5">
                    {school?.canteens.map((c) => {
                        const on = c.canteenId === canteenId;
                        return (
                            <ChoiceButton key={c.canteenId} selected={on} onClick={() => setCanteenId(c.canteenId)} className="!min-h-16 !justify-start gap-3 !rounded-2xl !px-4 text-left">
                                <span className={clsx("h-[22px] w-[22px] shrink-0 rounded-full border-box", on ? "border-[7px] border-primary-main" : "border-2 border-[#98A2B3]")} />
                                <span className="flex flex-col gap-0.5">
                                    <span className="text-base font-bold text-brand-dark">{c.name}</span>
                                    {c.restaurantCount != null && <span className="text-[13px] font-normal text-brand-muted">{c.restaurantCount} ร้าน</span>}
                                </span>
                            </ChoiceButton>
                        );
                    })}
                </div>
            </fieldset>

            <ActionButton full className="mt-auto" disabled={!school || !canteen} onClick={next}>ไปต่อ</ActionButton>
        </CenteredScreen>
    );
}
