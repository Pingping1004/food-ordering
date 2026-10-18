"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, Chip, Skeleton } from "@/components/ui/kit";
import { toastError } from "@/components/ui/Toast";
import { listAdminComplaints, listSchoolComplaints, resolveAdminComplaint, resolveSchoolComplaint } from "@/lib/services/complaints";
import { orderCode } from "@/lib/schema/format";

const when = (iso: string) => new Date(iso).toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export const complaintsKey = (schoolId?: string) => ["complaints", schoolId ?? "system"] as const;

/** Open complaints addressed to the school (pass `schoolId`) or to the platform (omit it). */
export function ComplaintsCard({ schoolId }: Readonly<{ schoolId?: string }>) {
    const qc = useQueryClient();
    const key = complaintsKey(schoolId);
    const { data, isLoading, isError, refetch } = useQuery({
        queryKey: key,
        queryFn: () => (schoolId ? listSchoolComplaints(schoolId, "OPEN") : listAdminComplaints("OPEN")),
        refetchInterval: 60_000,
    });
    const resolve = useMutation({
        mutationFn: (id: string) => (schoolId ? resolveSchoolComplaint(schoolId, id) : resolveAdminComplaint(id)),
        onSuccess: () => qc.invalidateQueries({ queryKey: key }),
        onError: (e) => toastError("บันทึกไม่สำเร็จ", e),
    });

    return (
        <Card className="flex flex-col gap-3 p-5">
            <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-bold">ข้อร้องเรียนจากนักเรียน</h2>
                {data && data.length > 0 && <Chip tone="orange" icon="alert">{data.length} รอดำเนินการ</Chip>}
            </div>
            {isLoading && <Skeleton className="h-5 w-48 rounded" />}
            {isError && <span className="text-sm text-danger-text">โหลดไม่สำเร็จ <button type="button" onClick={() => refetch()} className="font-semibold underline">ลองใหม่</button></span>}
            {data && data.length === 0 && <span className="text-[15px] text-brand-muted">ไม่มีข้อร้องเรียนที่รอดำเนินการ</span>}
            {data?.map((c) => (
                <div key={c.id} className="flex flex-col gap-1.5 rounded-xl border border-line-soft p-3.5">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[13px] text-brand-muted">
                        <span>ออเดอร์ {orderCode(c.orderId)} · {c.order.restaurant.name}{!schoolId && ` · ${c.school.name}`}</span>
                        <span>{when(c.createdAt)}</span>
                    </div>
                    <p className="whitespace-pre-wrap text-[15px]">{c.message}</p>
                    <button type="button" disabled={resolve.isPending} onClick={() => resolve.mutate(c.id)} className="self-end rounded-lg border-[1.5px] border-line px-3 py-1.5 text-sm font-semibold hover:bg-ground disabled:opacity-50">
                        จัดการแล้ว
                    </button>
                </div>
            ))}
        </Card>
    );
}
