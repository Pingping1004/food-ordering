"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";

const STEP_MINS = 15;
const VISIBLE = 6;

const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

/** Round up to the next 15-minute boundary so slots read 12:30, 12:45 … instead of 12:37. */
const ceilToStep = (d: Date) => new Date(Math.ceil(d.getTime() / (STEP_MINS * 60_000)) * STEP_MINS * 60_000);

/**
 * Pick-up time chooser (design: "จะมารับกี่โมง?"): a grid of 15-minute slots starting at the earliest the kitchen can make it.
 * `earliest` already includes accept + pay + cooking buffers; `closeAt` (HH:mm, optional) caps the list at the restaurant's closing time.
 * "เวลาอื่น" falls back to a native time input so nobody is blocked by the grid.
 */
export function PickupSlots({ value, onChange, earliest, closeAt, error }: Readonly<{ value: string; onChange: (v: string) => void; earliest: Date; closeAt?: string; error?: string }>) {
    const [custom, setCustom] = useState(false);

    const slots = useMemo(() => {
        const first = ceilToStep(earliest);
        const list: { time: string; sub: string }[] = [];
        for (let i = 0; i < VISIBLE * 2 && list.length < VISIBLE; i++) {
            const t = new Date(first.getTime() + i * STEP_MINS * 60_000);
            const label = hhmm(t);
            if (closeAt && label > closeAt) break;
            list.push({ time: label, sub: list.length === 0 ? "เร็วที่สุด" : "ว่าง" });
        }
        return list;
    }, [earliest, closeAt]);

    return (
        <div className="flex flex-col gap-3">
            <div role="radiogroup" aria-label="เวลารับอาหาร" className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {slots.map((s) => {
                    const on = value === s.time;
                    return (
                        <button
                            key={s.time}
                            type="button"
                            role="radio"
                            aria-checked={on}
                            onClick={() => { setCustom(false); onChange(s.time); }}
                            className={clsx("flex h-16 flex-col items-center justify-center gap-0.5 rounded-[14px]", on ? "bg-primary-main text-white" : "border-[1.5px] border-line bg-white text-brand-dark hover:bg-ground")}
                        >
                            <span className="text-lg font-bold">{s.time}</span>
                            <span className="text-xs font-medium">{on ? "เลือกแล้ว" : s.sub}</span>
                        </button>
                    );
                })}
                {slots.length === 0 && <p className="col-span-full text-sm text-brand-muted">ไม่มีช่วงเวลาว่างแล้วในวันนี้ ลองเลือกเวลาอื่น</p>}
            </div>

            <button type="button" aria-expanded={custom} onClick={() => setCustom((v) => !v)} className="self-start text-[15px] font-semibold text-primary-dark">
                {custom ? "ซ่อนเวลาอื่น" : "เลือกเวลาอื่น"}
            </button>
            {custom && (
                <input
                    type="time"
                    aria-label="เวลารับอาหารที่ต้องการ"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className="h-[52px] w-full rounded-xl border-[1.5px] border-line bg-white px-3.5 text-lg font-bold outline-none focus:border-primary-main focus:ring-2 focus:ring-primary-main/20"
                />
            )}
            {error && <p role="alert" className="text-sm font-medium text-danger-text">{error}</p>}
        </div>
    );
}
