"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog } from "@/components/ui/Dialog";
import { ActionButton, ErrorState, Notice, Skeleton } from "@/components/ui/kit";
import { toastError, toastSuccess } from "@/components/ui/Toast";
import { getHoursWindow, getRestaurantHours, saveRestaurantHours } from "@/lib/services/cooker";
import { DAYS, hhmmToMinutes, toDayRows, type DayRow } from "@/lib/schema/format";

/** Weekly open / close times in a small modal, opened from the settings page (no page navigation). */
export function HoursDialog({ restaurantId, onClose }: Readonly<{ restaurantId: string; onClose: () => void }>) {
    const qc = useQueryClient();
    const hours = useQuery({ queryKey: ["restaurant-hours", restaurantId], queryFn: () => getRestaurantHours(restaurantId) });
    const window_ = useQuery({ queryKey: ["hours-window", restaurantId], queryFn: () => getHoursWindow(restaurantId) });

    const [rows, setRows] = useState<DayRow[]>([]);
    useEffect(() => {
        if (hours.data) setRows(toDayRows(hours.data));
    }, [hours.data]);

    const save = useMutation({
        mutationFn: () => saveRestaurantHours(restaurantId, rows),
        onSuccess: () => {
            toastSuccess("บันทึกเวลาแล้ว");
            qc.invalidateQueries({ queryKey: ["restaurant-hours", restaurantId] });
            qc.invalidateQueries({ queryKey: ["cooker", restaurantId] });
            onClose();
        },
        onError: (err) => toastError("บันทึกเวลาเปิด-ปิดร้านไม่สำเร็จ กรุณาลองใหม่อีกครั้ง", err),
    });

    const patch = (i: number, p: Partial<DayRow>) => setRows((r) => r.map((x, idx) => (idx === i ? { ...x, ...p } : x)));
    const copyMonday = () => setRows((r) => r.map((x, i) => (i === 0 ? x : { ...x, from: r[0].from, to: r[0].to })));
    const invalid = rows.find((r) => r.open && hhmmToMinutes(r.to) <= hhmmToMinutes(r.from));

    return (
        <Dialog open onClose={onClose} title="เวลาเปิด-ปิดร้าน">
            {window_.data && (
                <Notice tone="primary" icon="info">
                    <span className="text-[15px]">โรงอาหารเปิด <b>{window_.data.label}</b> ตั้งเวลาได้ภายในช่วงนี้</span>
                </Notice>
            )}

            {hours.isLoading && (
                <div className="flex flex-col gap-2">
                    {Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)}
                </div>
            )}
            {hours.isError && <ErrorState onRetry={() => hours.refetch()} />}

            {rows.length > 0 && (
                <ul className="flex flex-col divide-y divide-row-line">
                    {rows.map((d, i) => (
                        <li key={d.day} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5">
                            <span className={`w-16 text-lg font-bold ${d.open ? "" : "text-brand-muted"}`}>{DAYS[i].long}</span>
                            <button
                                type="button"
                                role="switch"
                                aria-checked={d.open}
                                aria-label={`เปิดร้านวัน${DAYS[i].long}`}
                                onClick={() => patch(i, { open: !d.open })}
                                className={`flex h-9 w-[68px] shrink-0 items-center rounded-full p-1 text-sm font-bold ${d.open ? "justify-end bg-success-main text-white" : "justify-start bg-[#98A2B3] text-white"}`}
                            >
                                <span className={`flex h-7 items-center rounded-full bg-white px-2.5 ${d.open ? "text-success-main" : "text-neutral-text"}`}>{d.open ? "เปิด" : "ปิด"}</span>
                            </button>
                            {d.open && (
                                <span className="flex items-center gap-1.5">
                                    {(["from", "to"] as const).map((k, idx) => (
                                        <span key={k} className="flex items-center gap-1.5">
                                            {idx === 1 && <span className="text-brand-muted">–</span>}
                                            <input
                                                type="time"
                                                aria-label={`${k === "from" ? "เวลาเปิด" : "เวลาปิด"}วัน${DAYS[i].long}`}
                                                value={d[k]}
                                                onChange={(e) => patch(i, { [k]: e.target.value })}
                                                className="h-11 w-[118px] rounded-xl border-[1.5px] border-line px-2 text-lg text-brand-dark outline-none focus:border-primary-main"
                                            />
                                        </span>
                                    ))}
                                </span>
                            )}
                        </li>
                    ))}
                </ul>
            )}

            {invalid && (
                <p role="alert" className="text-base font-medium text-danger-text">
                    เวลาปิดของวัน{DAYS.find((d) => d.key === invalid.day)?.long}ต้องหลังเวลาเปิด
                </p>
            )}

            <div className="flex flex-col gap-2.5">
                {rows.length > 0 && (
                    <ActionButton variant="outline" full onClick={copyMonday}>ใช้เวลาวันจันทร์กับทุกวัน</ActionButton>
                )}
                <div className="flex gap-2.5">
                    <ActionButton variant="outline" full onClick={onClose} disabled={save.isPending}>ยกเลิก</ActionButton>
                    <ActionButton full onClick={() => save.mutate()} disabled={save.isPending || !!invalid || rows.length === 0}>
                        {save.isPending ? "กำลังบันทึก..." : "บันทึก"}
                    </ActionButton>
                </div>
            </div>
        </Dialog>
    );
}
