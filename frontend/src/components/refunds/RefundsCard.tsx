"use client";

import Link from "next/link";
import clsx from "clsx";
import { Card, Chip, Icon, Skeleton } from "@/components/ui/kit";
import { useRefundSummary } from "@/hook/useRefunds";
import { waitLabel } from "@/lib/schema/format";

/** Overview-dashboard tile: how many refund requests wait for the school, and a way in. */
export function RefundsCard({ schoolId }: Readonly<{ schoolId: string }>) {
    const { data, isLoading, isError, refetch } = useRefundSummary(schoolId);
    const pending = data?.counts.PENDING ?? 0;
    const approved = data?.counts.APPROVED ?? 0;

    return (
        <Card className={clsx("flex flex-wrap items-center gap-x-5 gap-y-3 p-5", pending > 0 && "border-[#FFD2BD] bg-brand-orange-light")}>
            <span className={clsx("flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl", pending > 0 ? "bg-white text-brand-orange-text" : "bg-primary-light text-primary-dark")}><Icon name="refund" size={24} /></span>
            <div className="flex min-w-0 flex-1 basis-60 flex-col gap-0.5">
                <h2 className="text-lg font-bold">คำขอคืนเงิน</h2>
                {isLoading && <Skeleton className="h-5 w-48 rounded" />}
                {isError && <span className="text-sm text-danger-text">โหลดไม่สำเร็จ <button type="button" onClick={() => refetch()} className="font-semibold underline">ลองใหม่</button></span>}
                {data && (
                    <span className="text-[15px] text-slate">
                        {pending > 0 ? <><b className="text-brand-dark">{pending}</b> เรื่องรอตัดสินใจ{data.oldestPendingAt && <> · รอนานสุด {waitLabel(data.oldestPendingAt)}</>}</> : "ไม่มีเรื่องรอตัดสินใจ"}
                        {approved > 0 && <> · รอโอนคืน {approved}</>}
                    </span>
                )}
            </div>
            {data && pending > 0 && <Chip tone="orange" icon="clock">{pending} รอตัดสินใจ</Chip>}
            <Link href={`/school/${schoolId}/refunds`} className="flex h-11 items-center gap-2 rounded-xl border-[1.5px] border-line bg-white px-4 text-[15px] font-semibold text-brand-dark hover:bg-ground">
                ดูคำขอคืนเงิน<Icon name="chevron" size={18} />
            </Link>
        </Card>
    );
}
